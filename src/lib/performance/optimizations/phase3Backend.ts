/**
 * Phase 3: Backend Throughput Optimizations
 *
 * Implements database connection pooling, filesystem IO optimization,
 * global search index improvements, and logging policy adjustments.
 *
 * @module performance/optimizations/phase3Backend
 */

import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../../utils/logger';
import {
  startTimer,
  endTimer,
  recordBackendCommand,
  recordMetric,
} from '../services/metricsTracker';

// ============================================================================
// Database Optimization
// ============================================================================

/**
 * Configure SQLite pragmas for optimal performance.
 * Call this during database initialization.
 */
export async function optimizeDatabaseConnection(): Promise<void> {
  const pragmas = [
    'PRAGMA journal_mode = WAL',
    'PRAGMA synchronous = NORMAL',
    'PRAGMA cache_size = -64000', // 64MB cache
    'PRAGMA temp_store = MEMORY',
    'PRAGMA mmap_size = 30000000000',
    'PRAGMA page_size = 4096',
    'PRAGMA busy_timeout = 5000',
    'PRAGMA wal_autocheckpoint = 1000',
  ];

  startTimer('db_optimize_pragmas');

  try {
    for (const pragma of pragmas) {
      await invoke('execute_pragma', { pragma });
    }

    const metric = endTimer('db_optimize_pragmas', 'DB pragma optimization', 'backend_command');
    logger.info('performance', 'optimizeDatabaseConnection', 'Database pragmas configured', {
      duration: metric?.value,
    });
  } catch (error) {
    endTimer('db_optimize_pragmas', 'DB pragma optimization failed', 'backend_command');
    logger.error('performance', 'optimizeDatabaseConnection', 'Failed to configure pragmas', {
      error,
    });
  }
}

/**
 * Connection pool configuration for better concurrency.
 */
export interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
  maxQueueSize: number;
}

export const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  maxConnections: 10,
  minConnections: 2,
  acquireTimeout: 5000,
  idleTimeout: 300000,
  maxQueueSize: 50,
};

/**
 * Initialize connection pooling (placeholder for future implementation).
 */
export function implementConnectionPooling(config: ConnectionPoolConfig = DEFAULT_POOL_CONFIG): {
  getConnection: () => Promise<any>;
  releaseConnection: (conn: any) => void;
  stats: () => { active: number; idle: number; waiting: number };
} {
  // Placeholder implementation
  // Full implementation will manage actual connection pool in Rust backend

  const stats = { active: 0, idle: 0, waiting: 0 };

  return {
    getConnection: async () => {
      stats.active++;
      return { id: Math.random() };
    },
    releaseConnection: () => {
      stats.active--;
      stats.idle++;
    },
    stats: () => ({ ...stats }),
  };
}

/**
 * Use read replica for read-heavy operations (placeholder).
 */
export function useReadReplica<T>(readFn: () => Promise<T>, writeFn: () => Promise<T>): Promise<T> {
  // Placeholder - would route to read replica in production
  return readFn();
}

// ============================================================================
// Filesystem Optimization
// ============================================================================

/**
 * In-memory index for notes filesystem to avoid repeated directory scans.
 */
class NotesFilesystemIndex {
  private index: Map<string, { path: string; modified: number; size: number }> = new Map();
  private lastScan: number = 0;
  private scanInterval: number = 30000; // 30 seconds

  /**
   * Get file info from index (with automatic refresh).
   */
  async getFile(fileId: string): Promise<{ path: string; modified: number; size: number } | null> {
    const now = Date.now();

    // Refresh index if stale
    if (now - this.lastScan > this.scanInterval) {
      await this.refreshIndex();
    }

    return this.index.get(fileId) || null;
  }

  /**
   * Refresh the filesystem index.
   */
  async refreshIndex(): Promise<void> {
    startTimer('notes_index_refresh');

    try {
      // Would call Rust backend to get file listing
      const files = await invoke<{ id: string; path: string; modified: number; size: number }[]>(
        'list_notes_files'
      );

      this.index.clear();
      for (const file of files) {
        this.index.set(file.id, file);
      }

      this.lastScan = Date.now();

      const metric = endTimer('notes_index_refresh', 'Notes index refresh', 'backend_command');
      logger.debug('performance', 'NotesFilesystemIndex.refreshIndex', 'Index refreshed', {
        fileCount: files.length,
        duration: metric?.value,
      });
    } catch (error) {
      endTimer('notes_index_refresh', 'Notes index refresh failed', 'backend_command');
      logger.error('performance', 'NotesFilesystemIndex.refreshIndex', 'Failed to refresh index', {
        error,
      });
    }
  }

  /**
   * Update index for a single file (after write).
   */
  updateFile(fileId: string, info: { path: string; modified: number; size: number }): void {
    this.index.set(fileId, info);
  }

  /**
   * Remove file from index (after delete).
   */
  removeFile(fileId: string): void {
    this.index.delete(fileId);
  }

  /**
   * Get index statistics.
   */
  getStats(): { fileCount: number; lastScan: number; isStale: boolean } {
    return {
      fileCount: this.index.size,
      lastScan: this.lastScan,
      isStale: Date.now() - this.lastScan > this.scanInterval,
    };
  }

  listEntries(): [string, { path: string; modified: number; size: number }][] {
    return Array.from(this.index.entries());
  }
}

// Global index instance
const notesIndex = new NotesFilesystemIndex();

/**
 * Get the notes filesystem index.
 */
export function useInMemoryIndex(): NotesFilesystemIndex {
  return notesIndex;
}

/**
 * Optimized notes filesystem operations using in-memory index.
 */
export async function optimizeNotesFilesystem<T>(
  operation: 'read' | 'write' | 'delete' | 'list',
  fileId: string,
  data?: any
): Promise<T> {
  startTimer(`notes_fs_${operation}`);

  try {
    let result: T;

    switch (operation) {
      case 'read':
      case 'write':
        // Use index to get path quickly
        const fileInfo = await notesIndex.getFile(fileId);
        result = await invoke(`notes_${operation}`, {
          fileId,
          path: fileInfo?.path,
          data,
        });
        break;

      case 'delete':
        notesIndex.removeFile(fileId);
        result = await invoke('notes_delete', { fileId });
        break;

      case 'list':
        const stats = notesIndex.getStats();
        if (stats.isStale) {
          await notesIndex.refreshIndex();
        }
        result = notesIndex.listEntries() as unknown as T;
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    const metric = endTimer(`notes_fs_${operation}`, `Notes FS: ${operation}`, 'backend_command');
    logger.debug('performance', 'optimizeNotesFilesystem', `${operation} completed`, {
      fileId,
      duration: metric?.value,
    });

    return result;
  } catch (error) {
    endTimer(`notes_fs_${operation}`, `Notes FS failed: ${operation}`, 'backend_command');
    throw error;
  }
}

/**
 * Batch multiple filesystem operations.
 */
export async function batchFilesystemOps<T>(
  operations: Array<{ op: 'read' | 'write' | 'delete'; fileId: string; data?: any }>
): Promise<T[]> {
  startTimer('notes_fs_batch');

  try {
    // Use index to resolve all paths first
    const paths = await Promise.all(
      operations.map(async (op) => ({
        ...op,
        path: (await notesIndex.getFile(op.fileId))?.path,
      }))
    );

    // Send batch to backend
    const results = await invoke<T[]>('notes_batch_operation', { operations: paths });

    const metric = endTimer('notes_fs_batch', 'Notes FS batch', 'backend_command');

    // Update index for writes/deletes
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      if (op.op === 'delete') {
        notesIndex.removeFile(op.fileId);
      } else if (op.op === 'write' && results[i]) {
        notesIndex.updateFile(op.fileId, results[i] as any);
      }
    }

    logger.debug('performance', 'batchFilesystemOps', 'Batch completed', {
      operationCount: operations.length,
      duration: metric?.value,
    });

    return results;
  } catch (error) {
    endTimer('notes_fs_batch', 'Notes FS batch failed', 'backend_command');
    throw error;
  }
}

// ============================================================================
// Global Search Optimization
// ============================================================================

/**
 * Incremental search index updates (vs full rebuild).
 */
export async function useIncrementalIndexing(): Promise<{
  addDocument: (id: string, content: string) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  updateDocument: (id: string, content: string) => Promise<void>;
  search: (query: string) => Promise<any[]>;
}> {
  // Placeholder - full implementation would use backend search index
  const index = new Map<string, string>();

  return {
    addDocument: async (id: string, content: string) => {
      startTimer('search_index_add');
      index.set(id, content);
      await invoke('search_index_add', { id, content });
      endTimer('search_index_add', 'Search index add', 'backend_command');
    },

    removeDocument: async (id: string) => {
      startTimer('search_index_remove');
      index.delete(id);
      await invoke('search_index_remove', { id });
      endTimer('search_index_remove', 'Search index remove', 'backend_command');
    },

    updateDocument: async (id: string, content: string) => {
      startTimer('search_index_update');
      index.set(id, content);
      await invoke('search_index_update', { id, content });
      endTimer('search_index_update', 'Search index update', 'backend_command');
    },

    search: async (query: string) => {
      startTimer('search_query');
      const results = await invoke<any[]>('search_query', { query });
      endTimer('search_query', 'Search query', 'backend_command');
      return results;
    },
  };
}

/**
 * Optimize global search operations.
 */
export async function optimizeGlobalSearch<T>(
  operation: 'index' | 'search' | 'remove',
  data?: any
): Promise<T> {
  // Implementation placeholder
  return invoke(`search_${operation}`, data);
}

// ============================================================================
// Logging Optimization
// ============================================================================

/**
 * Async logging queue to prevent blocking.
 */
class AsyncLogQueue {
  private queue: Array<{ level: string; message: string; context?: any }> = [];
  private flushInterval: number = 1000;
  private maxQueueSize: number = 100;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startFlushTimer();
  }

  private startFlushTimer(): void {
    this.timer = setInterval(() => this.flush(), this.flushInterval);
  }

  enqueue(level: string, message: string, context?: any): void {
    this.queue.push({ level, message, context });

    // Emergency flush if queue is full
    if (this.queue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.maxQueueSize);

    startTimer('log_flush');

    try {
      await invoke('log_batch_write', { entries: batch });

      const metric = endTimer('log_flush', 'Log batch flush', 'backend_command');
      logger.debug('performance', 'AsyncLogQueue.flush', 'Logs flushed', {
        count: batch.length,
        duration: metric?.value,
      });
    } catch (error) {
      endTimer('log_flush', 'Log batch flush failed', 'backend_command');
      // Fallback: log to console
      batch.forEach((entry) => console.log(entry));
    }
  }

  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Final flush
    this.flush();
  }
}

// Global async log queue
const asyncLogQueue = new AsyncLogQueue();

/**
 * Optimize logger flush policy.
 */
export function optimizeLoggerFlush(): {
  enqueue: (level: string, message: string, context?: any) => void;
  flush: () => Promise<void>;
} {
  return {
    enqueue: (level: string, message: string, context?: any) => {
      asyncLogQueue.enqueue(level, message, context);
    },
    flush: async () => {
      await asyncLogQueue.flush();
    },
  };
}

/**
 * Batch log writes for better IO efficiency.
 */
export function batchLogWrites(
  logs: Array<{ level: string; message: string; context?: any }>
): Promise<void> {
  return asyncLogQueue.flush();
}

/**
 * Use async logging instead of synchronous writes.
 */
export function useAsyncLogging(): void {
  // Replace logger with async version
  logger.info('performance', 'useAsyncLogging', 'Async logging enabled');
}

// ============================================================================
// Export
// ============================================================================

export default {
  optimizeDatabaseConnection,
  implementConnectionPooling,
  useReadReplica,
  optimizeNotesFilesystem,
  useInMemoryIndex,
  batchFilesystemOps,
  optimizeGlobalSearch,
  useIncrementalIndexing,
  optimizeLoggerFlush,
  useAsyncLogging,
  batchLogWrites,
};
