/**
 * Schema Engine Error Classes
 */

export class SchemaValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: Array<{ path: string; message: string; code: string }>,
    public readonly yamlContent?: string
  ) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

export class SchemaParseError extends Error {
  constructor(
    message: string,
    public readonly line?: number,
    public readonly column?: number
  ) {
    super(message);
    this.name = 'SchemaParseError';
  }
}

export class SchemaVersionError extends Error {
  constructor(
    message: string,
    public readonly currentVersion: string,
    public readonly requiredVersion: string
  ) {
    super(message);
    this.name = 'SchemaVersionError';
  }
}
