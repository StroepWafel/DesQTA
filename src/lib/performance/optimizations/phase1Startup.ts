/**
 * Phase 1: Startup Optimization - Fast Wins
 *
 * Implements startup deferral, warmup phasing, duplicate call prevention,
 * and prioritized task scheduling for faster app initialization.
 *
 * @module performance/optimizations/phase1Startup
 */

import { logger } from '../../../utils/logger';
import { cache } from '../../../utils/cache';
import {
	startTimer,
	endTimer,
	recordStartupMetric,
	recordCacheStats,
} from '../services/metricsTracker';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type StartupPriority = 'critical' | 'high' | 'medium' | 'low' | 'deferred';

export interface StartupTask {
	id: string;
	name: string;
	priority: StartupPriority;
	execute: () => Promise<void>;
	dependencies?: string[];
	estimatedDuration?: number;
	timeout?: number;
}

export enum WarmupPhase {
	Critical = 'critical', // Phase 1: Required for first render
	Important = 'important', // Phase 2: Needed for full functionality
	Background = 'background', // Phase 3: Nice to have, can be deferred
	Idle = 'idle', // Phase 4: Only when browser is idle
}

export interface DeferredTask {
	task: StartupTask;
	phase: WarmupPhase;
	scheduledAt: number;
	executedAt?: number;
	error?: Error;
}

// ============================================================================
// Startup Task Queue
// ============================================================================

class StartupTaskQueue {
	private tasks: Map<string, StartupTask> = new Map();
	private completedTasks: Set<string> = new Set();
	private failedTasks: Map<string, Error> = new Map();
	private isRunning = false;
	private deferredTasks: DeferredTask[] = [];

	/**
	 * Register a task for execution during startup
	 */
	register(task: StartupTask): void {
		this.tasks.set(task.id, task);
		logger.debug('performance', 'StartupTaskQueue.register', `Registered task: ${task.name}`, {
			id: task.id,
			priority: task.priority,
		});
	}

	/**
	 * Execute tasks by priority level
	 */
	async executeByPriority(priorities: StartupPriority[]): Promise<void> {
		const tasksToRun = Array.from(this.tasks.values())
			.filter((t) => priorities.includes(t.priority))
			.filter((t) => !this.completedTasks.has(t.id))
			.filter((t) => !this.failedTasks.has(t.id))
			.sort((a, b) => {
				const priorityOrder = ['critical', 'high', 'medium', 'low', 'deferred'];
				return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
			});

		for (const task of tasksToRun) {
			await this.executeTask(task);
		}
	}

	/**
	 * Execute a single task with error handling
	 */
	private async executeTask(task: StartupTask): Promise<void> {
		if (this.completedTasks.has(task.id)) {
			return;
		}

		// Check dependencies
		if (task.dependencies) {
			for (const depId of task.dependencies) {
				if (!this.completedTasks.has(depId)) {
					const depTask = this.tasks.get(depId);
					if (depTask) {
						await this.executeTask(depTask);
					}
				}
			}
		}

		startTimer(`startup_task_${task.id}`);

		try {
			logger.debug('performance', 'StartupTaskQueue.executeTask', `Executing: ${task.name}`);

			const timeout = task.timeout || 10000;
			await Promise.race([
				task.execute(),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error(`Task timeout: ${task.name}`)), timeout)
				),
			]);

			this.completedTasks.add(task.id);

			const metric = endTimer(`startup_task_${task.id}`, `Startup task: ${task.name}`, 'startup');
			if (metric) {
				recordStartupMetric(`task_${task.id}`, metric.value);
			}

			logger.debug('performance', 'StartupTaskQueue.executeTask', `Completed: ${task.name}`);
		} catch (error) {
			this.failedTasks.set(task.id, error as Error);
			endTimer(`startup_task_${task.id}`, `Startup task failed: ${task.name}`, 'startup');

			logger.error('performance', 'StartupTaskQueue.executeTask', `Failed: ${task.name}`, {
				error,
			});
		}
	}

	/**
	 * Get task execution statistics
	 */
	getStats(): {
		total: number;
		completed: number;
		failed: number;
		pending: number;
	} {
		return {
			total: this.tasks.size,
			completed: this.completedTasks.size,
			failed: this.failedTasks.size,
			pending: this.tasks.size - this.completedTasks.size - this.failedTasks.size,
		};
	}

	/**
	 * Clear all tasks
	 */
	clear(): void {
		this.tasks.clear();
		this.completedTasks.clear();
		this.failedTasks.clear();
		this.deferredTasks = [];
	}
}

// Global task queue instance
const startupQueue = new StartupTaskQueue();

// ============================================================================
// Startup Deferral API
// ============================================================================

/**
 * Defer a non-critical startup task to be executed later.
 * Use this for tasks that don't block initial UI rendering.
 */
export function deferNonCriticalStartup(
	task: () => Promise<void>,
	options: {
		delay?: number;
		priority?: 'high' | 'normal' | 'low';
		name?: string;
	} = {}
): Promise<void> {
	const { delay = 0, priority = 'normal', name = 'deferred_task' } = options;

	return new Promise((resolve, reject) => {
		const executeTask = async () => {
			startTimer(`deferred_${name}`);

			try {
				await task();
				const metric = endTimer(`deferred_${name}`, `Deferred task: ${name}`, 'startup');
				if (metric) {
					logger.debug(
						'performance',
						'deferNonCriticalStartup',
						`Completed deferred task: ${name}`,
						{
							duration: metric.value,
						}
					);
				}
				resolve();
			} catch (error) {
				endTimer(`deferred_${name}`, `Deferred task failed: ${name}`, 'startup');
				reject(error);
			}
		};

		if (delay > 0) {
			setTimeout(executeTask, delay);
		} else if (priority === 'low' && 'requestIdleCallback' in window) {
			requestIdleCallback(executeTask, { timeout: 5000 });
		} else {
			// Use setTimeout to yield to main thread
			setTimeout(executeTask, 0);
		}
	});
}

/**
 * Prioritize startup tasks by criticality.
 * Critical tasks block first paint, deferred tasks run after interactive.
 */
export function prioritizeStartupTasks(tasks: StartupTask[]): {
	critical: StartupTask[];
	important: StartupTask[];
	deferred: StartupTask[];
} {
	const critical: StartupTask[] = [];
	const important: StartupTask[] = [];
	const deferred: StartupTask[] = [];

	for (const task of tasks) {
		switch (task.priority) {
			case 'critical':
				critical.push(task);
				break;
			case 'high':
			case 'medium':
				important.push(task);
				break;
			case 'low':
			case 'deferred':
				deferred.push(task);
				break;
		}
	}

	return { critical, important, deferred };
}

/**
 * Execute startup in prioritized phases.
 */
export async function executePhasedStartup(allTasks: StartupTask[]): Promise<void> {
	const { critical, important, deferred } = prioritizeStartupTasks(allTasks);

	logger.info('performance', 'executePhasedStartup', 'Starting phased startup', {
		critical: critical.length,
		important: important.length,
		deferred: deferred.length,
	});

	// Phase 1: Critical (blocking)
	startTimer('startup_phase_critical');
	for (const task of critical) {
		startupQueue.register(task);
	}
	await startupQueue.executeByPriority(['critical']);
	const criticalMetric = endTimer('startup_phase_critical', 'Startup phase: critical', 'startup');

	if (criticalMetric) {
		recordStartupMetric('phase_critical', criticalMetric.value);
	}

	// Phase 2: Important (non-blocking but needed soon)
	// Yield to main thread first to allow rendering
	await new Promise((resolve) => setTimeout(resolve, 0));

	startTimer('startup_phase_important');
	for (const task of important) {
		startupQueue.register(task);
	}

	// Execute important tasks but don't block
	const importantPromise = startupQueue.executeByPriority(['high', 'medium']).then(() => {
		const metric = endTimer('startup_phase_important', 'Startup phase: important', 'startup');
		if (metric) {
			recordStartupMetric('phase_important', metric.value);
		}
	});

	// Phase 3: Deferred (run when idle)
	if (deferred.length > 0) {
		const runDeferred = async () => {
			startTimer('startup_phase_deferred');

			for (const task of deferred) {
				await deferNonCriticalStartup(task.execute, {
					name: task.name,
					priority: 'low',
				});
			}

			const metric = endTimer('startup_phase_deferred', 'Startup phase: deferred', 'startup');
			if (metric) {
				recordStartupMetric('phase_deferred', metric.value);
			}
		};

		// Don't await - let it run in background
		if ('requestIdleCallback' in window) {
			requestIdleCallback(() => runDeferred(), { timeout: 10000 });
		} else {
			setTimeout(runDeferred, 1000);
		}
	}

	// Wait for important tasks but not deferred
	await importantPromise;

	logger.info('performance', 'executePhasedStartup', 'Phased startup completed', {
		stats: startupQueue.getStats(),
	});
}

/**
 * Measure deferred startup task performance.
 */
export async function measureDeferredStartup<T>(
	taskName: string,
	task: () => Promise<T>
): Promise<T> {
	startTimer(`deferred_measure_${taskName}`);

	try {
		const result = await task();
		const metric = endTimer(`deferred_measure_${taskName}`, `Deferred: ${taskName}`, 'startup');

		logger.debug('performance', 'measureDeferredStartup', `Task ${taskName} completed`, {
			duration: metric?.value,
		});

		return result;
	} catch (error) {
		endTimer(`deferred_measure_${taskName}`, `Deferred failed: ${taskName}`, 'startup');
		throw error;
	}
}

/**
 * Get the appropriate warmup phase for a task based on its characteristics.
 */
export function getPhaseForTask(taskName: string): WarmupPhase {
	// Critical: Required for first render
	const criticalTasks = ['lesson_colours', 'timetable', 'user_info', 'settings'];
	if (criticalTasks.some((t) => taskName.includes(t))) {
		return WarmupPhase.Critical;
	}

	// Important: Needed for full functionality
	const importantTasks = ['assessments', 'notices', 'analytics', 'cache_warmup'];
	if (importantTasks.some((t) => taskName.includes(t))) {
		return WarmupPhase.Important;
	}

	// Background: Nice to have
	const backgroundTasks = ['folios', 'goals', 'forums', 'themes'];
	if (backgroundTasks.some((t) => taskName.includes(t))) {
		return WarmupPhase.Background;
	}

	// Everything else is idle priority
	return WarmupPhase.Idle;
}

// ============================================================================
// Duplicate Request Prevention
// ============================================================================

/**
 * Tracks pending requests to prevent duplicate in-flight requests.
 */
export class RequestDeduplicator {
	private pendingRequests: Map<string, Promise<unknown>> = new Map();
	private cache: Map<string, { result: unknown; timestamp: number }> = new Map();
	private cacheTTL: number;

	constructor(cacheTTL: number = 60000) {
		this.cacheTTL = cacheTTL;
	}

	/**
	 * Execute a request with deduplication.
	 * If the same request is already in-flight, returns the pending promise.
	 */
	async execute<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
		// Check cache first
		const cached = this.cache.get(key);
		if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
			logger.debug('performance', 'RequestDeduplicator', `Cache hit for ${key}`);
			return cached.result as T;
		}

		// Check for pending request
		if (this.pendingRequests.has(key)) {
			logger.debug('performance', 'RequestDeduplicator', `Deduplicating request ${key}`);
			return this.pendingRequests.get(key)! as Promise<T>;
		}

		// Execute new request
		const requestPromise = requestFn()
			.then((result) => {
				// Cache result
				this.cache.set(key, { result, timestamp: Date.now() });
				// Clean up pending
				this.pendingRequests.delete(key);
				return result;
			})
			.catch((error) => {
				// Clean up pending on error
				this.pendingRequests.delete(key);
				throw error;
			});

		this.pendingRequests.set(key, requestPromise);
		return requestPromise;
	}

	/**
	 * Invalidate cached result for a key.
	 */
	invalidate(key: string): void {
		this.cache.delete(key);
	}

	/**
	 * Clear all cached results.
	 */
	clear(): void {
		this.cache.clear();
		this.pendingRequests.clear();
	}

	/**
	 * Get statistics about the deduplicator.
	 */
	getStats(): {
		pendingCount: number;
		cachedCount: number;
	} {
		return {
			pendingCount: this.pendingRequests.size,
			cachedCount: this.cache.size,
		};
	}
}

// Global request deduplicator instance
const globalDeduplicator = new RequestDeduplicator();

/**
 * Create a deduplicated version of a request function.
 */
export function createDeduplicatedRequest<T>(
	key: string,
	requestFn: () => Promise<T>,
	ttl?: number
): Promise<T> {
	return globalDeduplicator.execute(key, requestFn);
}

/**
 * Hook for memoized requests with automatic deduplication.
 */
export function useMemoizedRequest<T>(
	key: string,
	requestFn: () => Promise<T>,
	dependencies: unknown[] = []
): {
	data: T | null;
	loading: boolean;
	error: Error | null;
	refetch: () => Promise<void>;
} {
	let data: T | null = null;
	let loading = true;
	let error: Error | null = null;

	const execute = async () => {
		loading = true;
		error = null;

		try {
			data = await globalDeduplicator.execute(key, requestFn);
		} catch (e) {
			error = e as Error;
		} finally {
			loading = false;
		}
	};

	// Execute on mount or dependency change
	execute();

	return {
		get data() {
			return data;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		refetch: execute,
	};
}

// ============================================================================
// Export
// ============================================================================

export default {
	deferNonCriticalStartup,
	prioritizeStartupTasks,
	executePhasedStartup,
	measureDeferredStartup,
	WarmupPhase,
	getPhaseForTask,
	createDeduplicatedRequest,
	RequestDeduplicator,
	useMemoizedRequest,
	startupQueue,
	globalDeduplicator,
};
