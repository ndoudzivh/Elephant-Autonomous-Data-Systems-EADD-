/**
 * Database Schema Reader
 * 
 * Connects to client's databases (READ-ONLY, METADATA ONLY)
 * and discovers schemas, tables, columns, relationships.
 * 
 * SECURITY: Never reads actual row-level data.
 * Only reads INFORMATION_SCHEMA / system catalog metadata.
 */

export interface DatabaseConnection {
  type: 'postgres' | 'mysql' | 'sqlserver' | 'oracle';
  /** Reference to credentials in secrets manager */
  credentials_ref: string;
  host: string;
  port: number;
  database: string;
  schema?: string;
}

export interface DiscoveredTable {
  schema: string;
  name: string;
  type: 'table' | 'view';
  columns: DiscoveredColumn[];
  primaryKey: string[];
  foreignKeys: ForeignKeyInfo[];
  rowCountEstimate: number;
  sizeBytes?: number;
  lastModified?: string;
}

export interface DiscoveredColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  defaultValue?: string;
  maxLength?: number;
  comment?: string;
}

export interface ForeignKeyInfo {
  column: string;
  referencesTable: string;
  referencesColumn: string;
  constraintName: string;
}

export class DatabaseSchemaReader {
  /**
   * Discover all tables and their schemas from a database.
   * ONLY reads metadata — never touches actual data.
   */
  async discoverSchema(connection: DatabaseConnection): Promise<DiscoveredTable[]> {
    switch (connection.type) {
      case 'postgres':
        return this.discoverPostgres(connection);
      case 'mysql':
        return this.discoverMySQL(connection);
      case 'sqlserver':
        return this.discoverSQLServer(connection);
      case 'oracle':
        return this.discoverOracle(connection);
      default:
        throw new Error(`Unsupported database: ${connection.type}`);
    }
  }

  /**
   * Generate the SQL queries used for schema discovery.
   * These ONLY query system catalogs, never user data.
   */
  getDiscoveryQueries(type: string, schema?: string): string[] {
    switch (type) {
      case 'postgres':
        return this.getPostgresQueries(schema);
      case 'mysql':
        return this.getMySQLQueries(schema);
      case 'sqlserver':
        return this.getSQLServerQueries(schema);
      default:
        return [];
    }
  }

  private getPostgresQueries(schema?: string): string[] {
    const s = schema || 'public';
    return [
      // Get all tables
      `SELECT table_name, table_type 
       FROM information_schema.tables 
       WHERE table_schema = '${s}'`,

      // Get all columns with types
      `SELECT table_name, column_name, data_type, 
              is_nullable, column_default, 
              character_maximum_length
       FROM information_schema.columns 
       WHERE table_schema = '${s}'
       ORDER BY table_name, ordinal_position`,

      // Get primary keys
      `SELECT tc.table_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu 
         ON tc.constraint_name = kcu.constraint_name
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND tc.table_schema = '${s}'`,

      // Get foreign keys
      `SELECT tc.table_name, kcu.column_name,
              ccu.table_name AS references_table,
              ccu.column_name AS references_column
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu 
         ON tc.constraint_name = kcu.constraint_name
       JOIN information_schema.constraint_column_usage ccu 
         ON tc.constraint_name = ccu.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = '${s}'`,

      // Get row count estimates (no table scan)
      `SELECT relname AS table_name, 
              reltuples::bigint AS row_estimate
       FROM pg_class 
       WHERE relnamespace = '${s}'::regnamespace`,
    ];
  }

  private getMySQLQueries(schema?: string): string[] {
    const db = schema || 'DATABASE()';
    return [
      `SELECT TABLE_NAME, TABLE_TYPE, TABLE_ROWS 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ${db}`,

      `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE,
              IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ${db}`,
    ];
  }

  private getSQLServerQueries(schema?: string): string[] {
    const s = schema || 'dbo';
    return [
      `SELECT t.name AS table_name, 
              s.name AS schema_name
       FROM sys.tables t
       JOIN sys.schemas s ON t.schema_id = s.schema_id
       WHERE s.name = '${s}'`,

      `SELECT c.name AS column_name, 
              t.name AS table_name,
              ty.name AS data_type,
              c.is_nullable, c.max_length
       FROM sys.columns c
       JOIN sys.tables t ON c.object_id = t.object_id
       JOIN sys.types ty ON c.user_type_id = ty.user_type_id
       JOIN sys.schemas s ON t.schema_id = s.schema_id
       WHERE s.name = '${s}'`,
    ];
  }

  private getOracleQueries(schema?: string): string[] {
    return [
      `SELECT TABLE_NAME FROM ALL_TABLES 
       WHERE OWNER = '${schema || 'CURRENT_USER'}'`,
    ];
  }

  // Placeholder implementations for actual connections
  private async discoverPostgres(conn: DatabaseConnection): Promise<DiscoveredTable[]> {
    console.log(`[DB Reader] Discovering PostgreSQL schema: ${conn.host}:${conn.port}/${conn.database}`);
    return [];
  }
  private async discoverMySQL(conn: DatabaseConnection): Promise<DiscoveredTable[]> {
    return [];
  }
  private async discoverSQLServer(conn: DatabaseConnection): Promise<DiscoveredTable[]> {
    return [];
  }
  private async discoverOracle(conn: DatabaseConnection): Promise<DiscoveredTable[]> {
    return [];
  }
}
