import { isDevTauriPerformance } from './devTauriContext';
import type { MetricCategory } from './services/metricsTracker';

let metricsMod: typeof import('./services/metricsTracker') | null = null;

async function metrics(): Promise<typeof import('./services/metricsTracker')> {
	if (!metricsMod) metricsMod = await import('./services/metricsTracker');
	return metricsMod;
}

/** Record a metric when dev Tauri perf is enabled (lazy-loads metrics module). */
export async function devRecordMetric(
	name: string,
	description: string,
	category: MetricCategory,
	value: number,
	unit: 'ms' | 'count' | 'bytes' | 'percent',
	context?: Record<string, unknown>,
): Promise<void> {
	if (!isDevTauriPerformance()) return;
	const m = await metrics();
	m.recordMetric(name, description, category, value, unit, context as Record<string, any>);
}

/**
 * Time an async operation with a unique timer key (safe under concurrency).
 */
export async function devTimeAsync<T>(
	timerBase: string,
	category: MetricCategory,
	description: string,
	fn: () => Promise<T>,
	context?: Record<string, unknown>,
): Promise<T> {
	if (!isDevTauriPerformance()) return fn();
	const m = await metrics();
	const key = `${timerBase}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
	m.startTimer(key, context as Record<string, any>);
	try {
		const r = await fn();
		m.endTimer(key, description, category);
		return r;
	} catch (e) {
		m.endTimer(key, `${description} (failed)`, category);
		throw e;
	}
}
