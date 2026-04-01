/**
 * Performance Optimizations Index
 *
 * Centralized exports for all performance optimization implementations.
 * Organized by phase as outlined in the performance optimization guide.
 *
 * @module performance/optimizations
 */

// ============================================================================
// Phase 1: Fast Wins (Startup Deferral, CI Cache, Duplicate Call Removal, SQLite Pragmas)
// ============================================================================

export {
	// Startup deferral utilities
	deferNonCriticalStartup,
	prioritizeStartupTasks,
	executePhasedStartup,
	type StartupTask,
	type StartupPriority,

	// Warmup phasing
	WarmupPhase,
	getPhaseForTask,

	// Duplicate call prevention
	createDeduplicatedRequest,
	RequestDeduplicator,
	useMemoizedRequest,
} from './phase1Startup';

// ============================================================================
// Phase 2: UI Hotspot Optimizations (Analytics, Search, Widget Grid)
// ============================================================================

export {
	// Analytics optimizations
	memoizeAnalyticsData,
	optimizeAnalyticsFilters,
	useVirtualizedChart,

	// Search optimizations
	optimizeSearchDebounce,
	useIncrementalSearch,
	implementSearchIndexing,

	// Widget grid optimizations
	batchWidgetUpdates,
	useLayoutBatching,
	optimizeDragAndDrop,

	// Cache serialization
	optimizeSerialization,
	useStructuredClone,
} from './phase2UI';

// ============================================================================
// Phase 3: Backend Throughput (DB Contention, IO Optimization, Logging)
// ============================================================================

export {
	// Database optimizations
	optimizeDatabaseConnection,
	implementConnectionPooling,
	useReadReplica,

	// Filesystem optimizations
	optimizeNotesFilesystem,
	useInMemoryIndex,
	batchFilesystemOps,

	// Search index optimization
	optimizeGlobalSearch,
	useIncrementalIndexing,

	// Logging optimization
	optimizeLoggerFlush,
	useAsyncLogging,
	batchLogWrites,
} from './phase3Backend';

// ============================================================================
// Phase 4: Bundle and Runtime Footprint
// ============================================================================

export {
	// Lazy loading
	createLazyRoute,
	prefetchRoute,
	useLazyComponent,

	// Bundle analysis
	analyzeBundleSize,
	detectUnusedCode,
	optimizeChunks,

	// Feature auditing
	auditReleaseFeatures,
	checkFeatureFlags,
} from './phase4Bundle';

// ============================================================================
// Phase Status Tracking
// ============================================================================

export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'rolled_back';

export interface PhaseImplementation {
	phase: 1 | 2 | 3 | 4;
	name: string;
	status: PhaseStatus;
	startDate?: Date;
	completionDate?: Date;
	kpiBefore?: Record<string, number>;
	kpiAfter?: Record<string, number>;
	improvements: Array<{
		metric: string;
		before: number;
		after: number;
		percentChange: number;
	}>;
}

// Track phase implementations
const phaseImplementations: Map<number, PhaseImplementation> = new Map();

/**
 * Register a phase implementation for tracking.
 */
export function registerPhase(implementation: PhaseImplementation): void {
	phaseImplementations.set(implementation.phase, implementation);
}

/**
 * Get the status of a phase.
 */
export function getPhaseStatus(phase: number): PhaseStatus {
	return phaseImplementations.get(phase)?.status || 'pending';
}

/**
 * Update phase status.
 */
export function updatePhaseStatus(phase: number, status: PhaseStatus): void {
	const impl = phaseImplementations.get(phase);
	if (impl) {
		impl.status = status;
		if (status === 'in_progress' && !impl.startDate) {
			impl.startDate = new Date();
		}
		if (status === 'completed' && !impl.completionDate) {
			impl.completionDate = new Date();
		}
	}
}

/**
 * Record KPI improvement for a phase.
 */
export function recordPhaseImprovement(
	phase: number,
	metric: string,
	before: number,
	after: number
): void {
	const impl = phaseImplementations.get(phase);
	if (impl) {
		const percentChange = ((after - before) / before) * 100;
		impl.improvements.push({ metric, before, after, percentChange });
	}
}

/**
 * Get all phase implementations summary.
 */
export function getPhaseSummary(): PhaseImplementation[] {
	return Array.from(phaseImplementations.values()).sort((a, b) => a.phase - b.phase);
}

/**
 * Check if all phases are completed.
 */
export function areAllPhasesComplete(): boolean {
	return [1, 2, 3, 4].every((phase) => getPhaseStatus(phase) === 'completed');
}

// ============================================================================
// Version
// ============================================================================

export const OPTIMIZATIONS_VERSION = '1.0.0';
