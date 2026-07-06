/**
 * @eadpa/compiler-core
 *
 * Plugin architecture for multi-cloud compiler backends.
 * Each cloud backend implements the CompilerBackend interface
 * and registers itself with the CompilerRegistry.
 */

export { CompilerRegistry } from './registry';
export { BaseCompiler } from './base-compiler';
export type {
  CompilerBackend,
  CompilationResult,
  CompilationError,
  GeneratedFile,
  CompilerOptions,
  CompilerCapabilities,
  CompilerMetadata,
} from './interfaces';
