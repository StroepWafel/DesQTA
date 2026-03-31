/**
 * Performance Metrics Tracker
 *
 * Centralized system for tracking performance KPIs across the DesQTA application.
 * Supports timing measurements, regression detection, and data export for analysis.
 *
 * @module performance/services/metricsTracker
 */

import { writable, get, type Writable } from 'svelte/store';
import { logger } from '../../../utils/logger';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type MetricCategory =
	| 'startup'
	| 'ui_interaction'
	| 'route_transition'
	| 'backend_command'
	| 'cache'
	| 'network'
	| 'render'
	| 'build';

export type DeviceClass = 'low_end' | 'mid_desktop' | 'high_end';

export interface MetricThresholds {
	warning: number;
	critical: number;
	target: number;
}

export interface PerformanceMetric {
	name: string;
	description: string;
	category: MetricCategory;
	value: number;
	unit: 'ms' | 'count' | 'bytes' | 'percent';
	timestamp: number;
	deviceClass: DeviceClass;
	context?: Record<string, any>;
	status: 'ok' | 'warning' | 'critical';
}

export interface BenchmarkResult {
	benchmarkId: string;
	timestamp: number;
	deviceClass: DeviceClass;
	metrics: PerformanceMetric[];
	overallScore: number;
	passed: boolean;
}

// ============================================================================
// KPI Thresholds
// ============================================================================

export const KPI_THRESHOLDS: Record<DeviceClass, Record<string, MetricThresholds>> = {
	low_end: {
		startup_cold_to_interactive: { target: 3000, warning: 5000, critical: 8000 },
		startup_warm_to_interactive: { target: 1000, warning: 2000, critical: 4000 },
		startup_first_paint: { target: 1500, warning: 2500, critical: 4000 },
		ui_widget_drag_latency: { target: 50, warning: 100, critical: 200 },
		ui_search_input_latency: { target: 100, warning: 200, critical: 400 },
		ui_note_edit_latency: { target: 50, warning: 100, critical: 200 },
		ui_dropped_frames_percent: { target: 5, warning: 10, critical: 20 },
		route_analytics_load: { target: 800, warning: 1500, critical: 3000 },
		route_courses_load: { target: 600, warning: 1200, critical: 2500 },
		route_directory_load: { target: 500, warning: 1000, critical: 2000 },
		route_study_load: { target: 500, warning: 1000, critical: 2000 },
		route_notes_load: { target: 600, warning: 1200, critical: 2500 },
		backend_command_p50: { target: 100, warning: 300, critical: 600 },
		backend_command_p95: { target: 500, warning: 1000, critical: 2000 },
		backend_db_lock_wait: { target: 50, warning: 200, critical: 500 },
		cache_hit_rate: { target: 85, warning: 70, critical: 50 },
		cache_duplicate_requests: { target: 0, warning: 3, critical: 10 },
		network_payload_size_avg: { target: 50000, warning: 200000, critical: 500000 },
	},
	mid_desktop: {
		startup_cold_to_interactive: { target: 2000, warning: 3500, critical: 6000 },
		startup_warm_to_interactive: { target: 800, warning: 1500, critical: 3000 },
		startup_first_paint: { target: 1000, warning: 2000, critical: 3500 },
		ui_widget_drag_latency: { target: 33, warning: 66, critical: 150 },
		ui_search_input_latency: { target: 50, warning: 100, critical: 250 },
		ui_note_edit_latency: { target: 33, warning: 66, critical: 150 },
		ui_dropped_frames_percent: { target: 3, warning: 8, critical: 15 },
		route_analytics_load: { target: 500, warning: 1000, critical: 2000 },
		route_courses_load: { target: 400, warning: 800, critical: 1500 },
		route_directory_load: { target: 300, warning: 600, critical: 1200 },
		route_study_load: { target: 300, warning: 600, critical: 1200 },
		route_notes_load: { target: 400, warning: 800, critical: 1500 },
		backend_command_p50: { target: 50, warning: 150, critical: 400 },
		backend_command_p95: { target: 300, warning: 600, critical: 1200 },
		backend_db_lock_wait: { target: 30, warning: 100, critical: 300 },
		cache_hit_rate: { target: 90, warning: 80, critical: 60 },
		cache_duplicate_requests: { target: 0, warning: 2, critical: 5 },
		network_payload_size_avg: { target: 30000, warning: 150000, critical: 400000 },
	},
	high_end: {
		startup_cold_to_interactive: { target: 1500, warning: 2500, critical: 4000 },
		startup_warm_to_interactive: { target: 500, warning: 1000, critical: 2000 },
		startup_first_paint: { target: 800, warning: 1500, critical: 2500 },
		ui_widget_drag_latency: { target: 16, warning: 33, critical: 100 },
		ui_search_input_latency: { target: 33, warning: 66, critical: 150 },
		ui_note_edit_latency: { target: 16, warning: 33, critical: 100 },
		ui_dropped_frames_percent: { target: 1, warning: 5, critical: 10 },
		route_analytics_load: { target: 300, warning: 600, critical: 1200 },
		route_courses_load: { target: 250, warning: 500, critical: 1000 },
		route_directory_load: { target: 200, warning: 400, critical: 800 },
		route_study_load: { target: 200, warning: 400, critical: 800 },
		route_notes_load: { target: 250, warning: 500, critical: 1000 },
		backend_command_p50: { target: 30, warning: 100, critical: 300 },
		backend_command_p95: { target: 200, warning: 400, critical: 800 },
		backend_db_lock_wait: { target: 20, warning: 50, critical: 200 },
		cache_hit_rate: { target: 95, warning: 85, critical: 70 },
		cache_duplicate_requests: { target: 0, warning: 1, critical: 3 },
		network_payload_size_avg: { target: 20000, warning: 100000, critical: 300000 },
	},
};

// ============================================================================
// Stores
// ============================================================================

export const sessionMetrics: Writable<PerformanceMetric[]> = writable([]);
const activeTimers = new Map<string, { startTime: number; context?: Record<string, any> }>();
export const benchmarkHistory: Writable<BenchmarkResult[]> = writable([]);

// ============================================================================
// Device Classification
// ============================================================================

let currentDeviceClass: DeviceClass = 'mid_desktop';

function detectDeviceClass(): DeviceClass {
	const memory = (navigator as any).deviceMemory;
	const cpuCores = navigator.hardwareConcurrency;
	const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
		navigator.userAgent
	);

	if (memory && memory <= 4) return 'low_end';
	if (isMobile) return 'low_end';
	if (cpuCores && cpuCores <= 4) return 'low_end';
	if (memory && memory >= 16 && cpuCores && cpuCores >= 8) return 'high_end';
	if (cpuCores && cpuCores >= 8) return 'high_end';

	return 'mid_desktop';
}

export function initDeviceClass(): void {
	currentDeviceClass = detectDeviceClass();
	logger.info('performance', 'initDeviceClass', `Device class detected: ${currentDeviceClass}`);
}

export function getDeviceClass(): DeviceClass {
	return currentDeviceClass;
}

// ============================================================================
// Metric Recording
// ============================================================================

function getMetricStatus(
	name: string,
	value: number,
	unit: 'ms' | 'count' | 'bytes' | 'percent'
): 'ok' | 'warning' | 'critical' {
	const thresholds = KPI_THRESHOLDS[currentDeviceClass][name];
	if (!thresholds) return 'ok';

	const isHigherBetter = name.includes('hit_rate');

	if (isHigherBetter) {
		if (value >= thresholds.target) return 'ok';
		if (value >= thresholds.warning) return 'warning';
		return 'critical';
	} else {
		if (value <= thresholds.target) return 'ok';
		if (value <= thresholds.warning) return 'warning';
		return 'critical';
	}
}

export function recordMetric(
	name: string,
	description: string,
	category: MetricCategory,
	value: number,
	unit: 'ms' | 'count' | 'bytes' | 'percent',
	context?: Record<string, any>
): PerformanceMetric {
	const metric: PerformanceMetric = {
		name,
		description,
		category,
		value,
		unit,
		timestamp: performance.now(),
		deviceClass: currentDeviceClass,
		context,
		status: getMetricStatus(name, value, unit),
	};

	sessionMetrics.update((metrics) => [...metrics, metric]);

	if (metric.status === 'warning') {
		logger.warn('performance', 'recordMetric', `Performance warning: ${name}`, { value, unit });
	} else if (metric.status === 'critical') {
		logger.error('performance', 'recordMetric', `Performance critical: ${name}`, { value, unit });
	}

	return metric;
}

export function startTimer(name: string, context?: Record<string, any>): void {
	activeTimers.set(name, { startTime: performance.now(), context });
}

export function endTimer(
	name: string,
	description: string,
	category: MetricCategory,
	unit: 'ms' | 'count' | 'bytes' | 'percent' = 'ms'
): PerformanceMetric | null {
	const timer = activeTimers.get(name);
	if (!timer) {
		logger.warn('performance', 'endTimer', `Timer not found: ${name}`);
		return null;
	}

	const elapsed = performance.now() - timer.startTime;
	activeTimers.delete(name);

	return recordMetric(name, description, category, elapsed, unit, timer.context);
}

// ============================================================================
// Specialized Metrics
// ============================================================================

export function recordStartupMetric(
	metricName: string,
	valueMs: number,
	context?: Record<string, any>
): PerformanceMetric {
	return recordMetric(
		`startup_${metricName}`,
		`Startup: ${metricName}`,
		'startup',
		valueMs,
		'ms',
		context
	);
}

export function recordUIInteraction(
	interactionType:
		| 'widget_drag'
		| 'widget_resize'
		| 'search_input'
		| 'note_edit'
		| 'button_click',
	valueMs: number,
	componentName?: string
): PerformanceMetric {
	return recordMetric(
		`ui_${interactionType}_latency`,
		`UI Interaction: ${interactionType}`,
		'ui_interaction',
		valueMs,
		'ms',
		{ component: componentName }
	);
}

export function recordRouteTransition(route: string, valueMs: number): PerformanceMetric {
	const routeName = route.replace(/^\//, '').replace(/\//g, '_') || 'root';
	return recordMetric(
		`route_${routeName}_load`,
		`Route Load: ${route}`,
		'route_transition',
		valueMs,
		'ms',
		{ route }
	);
}

export function recordBackendCommand(
	commandName: string,
	valueMs: number,
	context?: Record<string, any>
): PerformanceMetric {
	return recordMetric(
		`backend_command_${commandName}`,
		`Backend Command: ${commandName}`,
		'backend_command',
		valueMs,
		'ms',
		{ command: commandName, ...context }
	);
}

export function recordCacheStats(
	hitRate: number,
	duplicateRequests: number,
	context?: Record<string, any>
): void {
	recordMetric('cache_hit_rate', 'Cache Hit Rate', 'cache', hitRate, 'percent', context);
	recordMetric(
		'cache_duplicate_requests',
		'Duplicate Request Count',
		'cache',
		duplicateRequests,
		'count',
		context
	);
}

export function recordDroppedFrames(percent: number): PerformanceMetric {
	return recordMetric(
		'ui_dropped_frames_percent',
		'Dropped Frames %',
		'ui_interaction',
		percent,
		'percent'
	);
}

// ============================================================================
// User Timing API
// ============================================================================

export function mark(name: string): void {
	if (typeof performance !== 'undefined' && performance.mark) {
		performance.mark(`desqta:${name}`);
	}
}

export function measure(name: string, startMark: string, endMark?: string): PerformanceMeasure | undefined {
	if (typeof performance !== 'undefined' && performance.measure) {
		return performance.measure(
			`desqta:${name}`,
			`desqta:${startMark}`,
			endMark ? `desqta:${endMark}` : undefined
		);
	}
	return undefined;
}

// ============================================================================
// Benchmarking
// ============================================================================

function calculateOverallScore(metrics: PerformanceMetric[]): number {
	if (metrics.length === 0) return 0;

	let totalWeight = 0;
	let weightedScore = 0;

	const categoryWeights: Record<MetricCategory, number> = {
		startup: 0.3,
		ui_interaction: 0.25,
		route_transition: 0.2,
		backend_command: 0.15,
		cache: 0.05,
		network: 0.03,
		render: 0.01,
		build: 0.01,
	};

	for (const metric of metrics) {
		const weight = categoryWeights[metric.category] || 0.01;
		totalWeight += weight;

		let statusScore = 100;
		if (metric.status === 'warning') statusScore = 70;
		if (metric.status === 'critical') statusScore = 40;

		const thresholds = KPI_THRESHOLDS[metric.deviceClass][metric.name];
		if (thresholds && metric.unit === 'ms') {
			const ratio = metric.value / thresholds.target;
			if (ratio > 1) {
				statusScore = Math.max(0, statusScore - (ratio - 1) * 30);
			}
		}

		weightedScore += statusScore * weight;
	}

	return Math.round(weightedScore / totalWeight);
}

export async function runBenchmark(
	benchmarkId: string,
	benchmarkFn: () => Promise<void> | void
): Promise<BenchmarkResult> {
	sessionMetrics.set([]);

	const startTime = Date.now();
	await benchmarkFn();

	const metrics = get(sessionMetrics);

	const result: BenchmarkResult = {
		benchmarkId,
		timestamp: startTime,
		deviceClass: currentDeviceClass,
		metrics,
		overallScore: calculateOverallScore(metrics),
		passed: metrics.every((m) => m.status !== 'critical'),
	};

	benchmarkHistory.update((history) => [...history, result]);

	logger.info('performance', 'runBenchmark', `Benchmark ${benchmarkId} completed`, {
		score: result.overallScore,
		passed: result.passed,
	});

	return result;
}

// ============================================================================
// Analysis & Export
// ============================================================================

export function getMetricsByCategory(category: MetricCategory): PerformanceMetric[] {
	return get(sessionMetrics).filter((m) => m.category === category);
}

export function calculateStats(metrics: PerformanceMetric[]): {
	count: number;
	mean: number;
	min: number;
	max: number;
	p50: number;
	p95: number;
} {
	if (metrics.length === 0) {
		return { count: 0, mean: 0, min: 0, max: 0, p50: 0, p95: 0 };
	}

	const values = metrics.map((m) => m.value).sort((a, b) => a - b);
	const count = values.length;

	return {
		count,
		mean: values.reduce((a, b) => a + b, 0) / count,
		min: values[0],
		max: values[count - 1],
		p50: values[Math.floor(count * 0.5)],
		p95: values[Math.floor(count * 0.95)],
	};
}

export function exportMetrics(): string {
	return JSON.stringify(
		{
			timestamp: Date.now(),
			deviceClass: currentDeviceClass,
			userAgent: navigator.userAgent,
			metrics: get(sessionMetrics),
			benchmarks: get(benchmarkHistory),
		},
		null,
		2
	);
}

export function downloadMetrics(filename?: string): void {
	const json = exportMetrics();
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);

	const a = document.createElement('a');
	a.href = url;
	a.download = filename || `desqta-performance-${Date.now()}.json`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

// ============================================================================
// Initialization
// ============================================================================

export function initMetricsTracker(): void {
	initDeviceClass();

	if (typeof performance !== 'undefined') {
		performance.mark('desqta:app_start');
	}

	logger.info('performance', 'initMetricsTracker', 'Metrics tracker initialized');
}

export default {
	initMetricsTracker,
	initDeviceClass,
	getDeviceClass,
	recordMetric,
	startTimer,
	endTimer,
	recordStartupMetric,
	recordUIInteraction,
	recordRouteTransition,
	recordBackendCommand,
	recordCacheStats,
	recordDroppedFrames,
	mark,
	measure,
	runBenchmark,
	getMetricsByCategory,
	calculateStats,
	exportMetrics,
	downloadMetrics,
	sessionMetrics,
	benchmarkHistory,
};
