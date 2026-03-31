# Performance Testing (Settings)

## When to run
- Use the Settings page only (intended for local regression / perf investigations).
- The suite crawls key routes first, then runs the synthetic mega benchmark suite.
- The mega synthetic suite is **not** started automatically in built/prod. It only runs when you explicitly click **Run Performance Test** on the Settings page.

## How to run
1. Open `Settings`
2. Under **Developer Settings → Performance Testing**, click **Run Performance Test**
3. Keep the app open and wait for the overlay (“Running benchmark suite”) to finish (this can take ~30–90s)

## Where results go
- Results are saved automatically and can be opened via **Open Saved Tests** (same Settings section).

## What gets measured
The test is a two-phase process:

1. **Crawl + page metrics**
   - Navigates through the main app routes in a fixed order.
   - Captures per-route load timing, DOM/content timing, and render/system warnings.

2. **Synthetic mega benchmark suite**
   - Runs the dev synthetic suite and records:
     - “startup/ui/data/backend” benchmark results
     - crawl metrics collected during the navigation phase
   - An overlay is shown while the suite runs (`performanceTestMegaSuiteRunning`).

## Interpreting results quickly
- Look at the slowest page’s `loadTime` first (page-level regressions).
- Then check whether heavy background cache rebuilds happened (watch for `*_bg_*` metrics).
- If you see `long_tasks_detected` increasing, it usually indicates UI work blocking the main thread.
- Cache metrics:
  - `cache_hit_rate` should stay high (warm start) and `cache_duplicate_requests` should stay near 0.

## Re-running / comparing safely
- Re-run the test after the change you care about (avoid comparing unrelated code paths).
- Use the same app state as much as possible (logged-in vs logged-out, same theme/settings).
- If you’re debugging a single route, focus your navigation sequence on that path by temporarily shortening the test pages list in `performanceTesting.ts` (then revert).

## Troubleshooting
- If results fail to save, the UI still attempts to proceed to `/performance-results`; check console logs for the specific error.
- If the synthetic suite appears to be “skipped”, confirm you started it from Settings (built/prod runs the suite only on explicit Settings invocation).

## Files involved (for maintainers)
- `src/routes/settings/+page.svelte`: starts the test
- `src/lib/services/performanceTesting.ts`: performs crawl + attaches mega suite results
- `src/lib/components/dev/PerformanceTestMegaSuiteOverlay.svelte`: shows overlay while the suite runs
- `src/routes/performance-results/+page.svelte`: renders stored results
