// ─── Event Companion – Resource Module ───
param baseName string
param env string
param location string
param tags object
param tenantId string = ''

var uniqueSuffix = uniqueString(resourceGroup().id, baseName)
var cosmosName = '${baseName}-cosmos-${uniqueSuffix}'
var signalRName = '${baseName}-signalr-${uniqueSuffix}'
var kvName = 'kv-${baseName}-${uniqueSuffix}'
var logName = '${baseName}-logs-${env}'
var aiName = '${baseName}-ai-${env}'
var swaName = '${baseName}-swa-${env}'

// ─── Log Analytics Workspace ───
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logName
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ─── Application Insights ───
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: aiName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    DisableLocalAuth: false
  }
}

// ─── Azure Cosmos DB (NoSQL, Autoscale) ───
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosName
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    locations: [
      { locationName: location, failoverPriority: 0, isZoneRedundant: true }
    ]
    disableLocalAuth: false
    enableAutomaticFailover: true
    enableMultipleWriteLocations: false
    publicNetworkAccess: 'Enabled'
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: 'eventcompanion'
  properties: {
    resource: { id: 'eventcompanion' }
  }
}

resource eventsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDb
  name: 'events'
  properties: {
    resource: {
      id: 'events'
      partitionKey: { paths: ['/eventCode'], kind: 'Hash' }
      defaultTtl: -1
    }
    options: { autoscaleSettings: { maxThroughput: 4000 } }
  }
}

resource questionsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDb
  name: 'questions'
  properties: {
    resource: {
      id: 'questions'
      partitionKey: { paths: ['/eventCode'], kind: 'Hash' }
      defaultTtl: -1
    }
    options: { autoscaleSettings: { maxThroughput: 4000 } }
  }
}

resource responsesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDb
  name: 'responses'
  properties: {
    resource: {
      id: 'responses'
      partitionKey: { paths: ['/eventCode'], kind: 'Hash' }
      defaultTtl: -1
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [{ path: '/*' }]
        excludedPaths: [{ path: '/"_etag"/?' }]
      }
    }
    options: { autoscaleSettings: { maxThroughput: 10000 } }
  }
}

// ─── Azure SignalR Service (Serverless) ───
resource signalR 'Microsoft.SignalRService/signalR@2024-03-01' = {
  name: signalRName
  location: location
  tags: tags
  sku: { name: 'Standard_S1', capacity: 1 }
  kind: 'SignalR'
  properties: {
    features: [
      { flag: 'ServiceMode', value: 'Serverless' }
      { flag: 'EnableConnectivityLogs', value: 'True' }
    ]
    cors: { allowedOrigins: ['*'] }
    tls: { clientCertEnabled: false }
    publicNetworkAccess: 'Enabled'
  }
}

// ─── Azure Key Vault ───
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  tags: tags
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: tenantId != '' ? tenantId : subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
  }
}

// Store Cosmos connection string in Key Vault
resource cosmosSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'cosmos-connection-string'
  properties: {
    value: cosmosAccount.listConnectionStrings().connectionStrings[0].connectionString
  }
}

resource signalRSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'signalr-connection-string'
  properties: {
    value: signalR.listKeys().primaryConnectionString
  }
}

// ─── Azure Static Web Apps (Standard) ───
resource staticWebApp 'Microsoft.Web/staticSites@2024-04-01' = {
  name: swaName
  location: location
  tags: tags
  sku: { name: 'Standard', tier: 'Standard' }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    buildProperties: {
      appLocation: 'apps/web'
      apiLocation: 'apps/api'
      outputLocation: 'out'
    }
  }
}

// ─── Application settings for SWA (linked Functions) ───
resource swaAppSettings 'Microsoft.Web/staticSites/config@2024-04-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    COSMOS_ENDPOINT: cosmosAccount.properties.documentEndpoint
    COSMOS_KEY: cosmosAccount.listKeys().primaryMasterKey
    COSMOS_DATABASE: 'eventcompanion'
    SIGNALR_CONNECTION_STRING: signalR.listKeys().primaryConnectionString
    APPINSIGHTS_INSTRUMENTATIONKEY: appInsights.properties.InstrumentationKey
  }
}

// ─── Outputs ───
output staticWebAppDefaultHostname string = staticWebApp.properties.defaultHostname
output signalREndpoint string = 'https://${signalR.properties.hostName}'
output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint
output keyVaultUri string = keyVault.properties.vaultUri
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
