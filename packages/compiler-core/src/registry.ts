/**
 * Compiler Registry
 * Central registry where backends register themselves.
 * Supports dynamic loading and discovery of compiler plugins.
 */

import type { CloudProvider } from '@eadpa/shared';
import type { CompilerBackend, CompilerMetadata } from './interfaces';

export class CompilerRegistry {
  private static instance: CompilerRegistry;
  private backends: Map<string, CompilerBackend> = new Map();

  static getInstance(): CompilerRegistry {
    if (!CompilerRegistry.instance) {
      CompilerRegistry.instance = new CompilerRegistry();
    }
    return CompilerRegistry.instance;
  }

  /**
   * Register a compiler backend
   */
  register(backend: CompilerBackend): void {
    if (this.backends.has(backend.id)) {
      throw new Error(`Backend '${backend.id}' is already registered`);
    }
    this.backends.set(backend.id, backend);
  }

  /**
   * Unregister a compiler backend
   */
  unregister(backendId: string): void {
    this.backends.delete(backendId);
  }

  /**
   * Get a specific backend by ID
   */
  getBackend(id: string): CompilerBackend | undefined {
    return this.backends.get(id);
  }

  /**
   * Get the backend for a specific cloud provider
   */
  getBackendForProvider(provider: CloudProvider): CompilerBackend | undefined {
    return Array.from(this.backends.values())
      .find(b => b.provider === provider);
  }

  /**
   * List all registered backends
   */
  listBackends(): CompilerMetadata[] {
    return Array.from(this.backends.values())
      .map(b => b.getMetadata());
  }

  /**
   * List backends for a specific provider
   */
  listBackendsForProvider(provider: CloudProvider): CompilerMetadata[] {
    return Array.from(this.backends.values())
      .filter(b => b.provider === provider)
      .map(b => b.getMetadata());
  }

  /**
   * Check if a provider has a registered backend
   */
  hasProvider(provider: CloudProvider): boolean {
    return Array.from(this.backends.values())
      .some(b => b.provider === provider);
  }

  /**
   * Get count of registered backends
   */
  get count(): number {
    return this.backends.size;
  }
}
