/**
 * @eadpa/mapping-engine
 *
 * Source-to-Target Mapping Engine
 * Handles schema discovery, column-level mappings, data model generation
 * (star schema, SCD2, Data Vault), and schema drift detection.
 */

export { MappingService } from './mapping-service';
export { SchemaDiscovery } from './schema-discovery';
export { ModelGenerator } from './model-generator';
export { DriftDetector } from './drift-detector';
export { MappingYAMLExporter } from './yaml-exporter';
