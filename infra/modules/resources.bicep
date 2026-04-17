// ─── Event Companion – Resource Module ───
param baseName string
param env string
param location string
param tags object
param tenantId string = ''

var uniqueSuffix = uniqueString(resourceGroup().id, baseName)
var storageName = toLower('stec${uniqueSuffix}')
var signalRName = '${baseName}-signalr-${uniqueSuffix}'
var kvName = 'kv-ec-${uniqueSuffix}'
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

// ─── Azure Storage Account (Table Storage) ───
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    publicNetworkAccess: 'Enabled'
  }
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource eventsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'events'
}

resource questionsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'questions'
}

resource responsesTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'responses'
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

// No storage key secret needed — using Managed Identity

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
  identity: {
    type: 'SystemAssigned'
  }
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

// ─── RBAC: Storage Table Data Contributor for SWA managed identity ───
resource storageTableRbac 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, staticWebApp.id, '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3')
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3')
    principalId: staticWebApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ─── Application settings for SWA (linked Functions) ───
resource swaAppSettings 'Microsoft.Web/staticSites/config@2024-04-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    STORAGE_ACCOUNT_URL: 'https://${storageAccount.name}.table.${environment().suffixes.storage}'
    SIGNALR_CONNECTION_STRING: signalR.listKeys().primaryConnectionString
    APPINSIGHTS_INSTRUMENTATIONKEY: appInsights.properties.InstrumentationKey
  }
}

// ─── Outputs ───
output staticWebAppDefaultHostname string = staticWebApp.properties.defaultHostname
output signalREndpoint string = 'https://${signalR.properties.hostName}'
output storageAccountName string = storageAccount.name
output keyVaultUri string = keyVault.properties.vaultUri
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
