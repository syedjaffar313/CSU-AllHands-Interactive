// ─── Event Companion – Azure Infrastructure (Bicep) ───
// Deploy: az deployment sub create --location eastus2 --template-file main.bicep --parameters env=prod
targetScope = 'subscription'

@description('Environment name (dev, staging, prod)')
param env string = 'prod'

@description('Primary Azure region')
param location string = 'eastus2'

@description('Base name for resources')
param baseName string = 'eventcompanion'

@description('Entra ID tenant for admin auth')
param tenantId string = ''

var rgName = 'rg-${baseName}-${env}'
var tags = {
  project: 'event-companion'
  environment: env
  managedBy: 'bicep'
}

// ─── Resource Group ───
resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: rgName
  location: location
  tags: tags
}

// ─── Deploy all resources into the RG ───
module resources 'modules/resources.bicep' = {
  scope: rg
  name: 'resources-${env}'
  params: {
    baseName: baseName
    env: env
    location: location
    tags: tags
    tenantId: tenantId
  }
}

output resourceGroupName string = rg.name
output staticWebAppUrl string = resources.outputs.staticWebAppDefaultHostname
output signalREndpoint string = resources.outputs.signalREndpoint
output cosmosEndpoint string = resources.outputs.cosmosEndpoint
output keyVaultUri string = resources.outputs.keyVaultUri
output appInsightsKey string = resources.outputs.appInsightsInstrumentationKey
