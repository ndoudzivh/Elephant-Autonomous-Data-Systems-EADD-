/**
 * @eadpa/integrations
 *
 * Client system integrations:
 * - Jira/Azure DevOps/ServiceNow: Read tasks assigned to data engineers
 * - Database connectors: Read schemas from client source systems
 * - Data catalogs: Read existing metadata from Alation/Collibra/DataHub
 * - Git repos: Read existing pipeline code and models
 */

export { JiraConnector } from './connectors/jira';
export { AzureDevOpsConnector } from './connectors/azure-devops';
export { ServiceNowConnector } from './connectors/servicenow';
export { DatabaseSchemaReader } from './sources/database-reader';
export { APISchemaReader } from './sources/api-reader';
export { DataCatalogReader } from './sources/catalog-reader';
export { IntegrationOrchestrator } from './integration-orchestrator';
