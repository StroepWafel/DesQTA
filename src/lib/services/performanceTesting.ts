import { goto } from '$app/navigation';
import { logger } from '../../utils/logger';

export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage_percent: number;
    cores: number[];
    frequency_mhz: number;
  };
  memory: {
    used_bytes: number;
    total_bytes: number;
    available_bytes: number;
    usage_percent: number;
    swap_used_bytes: number;
    swap_total_bytes: number;
  };
  gpu: {
    usage_percent?: number;
    memory_used_bytes?: number;
    memory_total_bytes?: number;
    temperature_celsius?: number;
    name?: string;
  };
  disk: {
    total_bytes: number;
    used_bytes: number;
    available_bytes: number;
    usage_percent: number;
  };
  network: {
    received_bytes: number;
    transmitted_bytes: number;
    received_packets: number;
    transmitted_packets: number;
  };
}

export interface PerformanceMetrics {
  pageName: string;
  path: string;
  loadTime: number;
  domContentLoaded: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
  firstInputDelay?: number;
  memoryUsage?: number;
  errors: string[];
  warnings: string[];
  networkRequests: number;
  resourceLoadTimes: Array<{
    name: string;
    duration: number;
    size?: number;
  }>;
  systemMetrics?: SystemMetrics[]; // System metrics collected during page load
}

export interface TestResults {
  startTime: number;
  endTime: number;
  totalDuration: number;
  pages: PerformanceMetrics[];
  overallErrors: string[];
  systemMetricsHistory: SystemMetrics[]; // System metrics collected throughout the test
  summary: {
    averageLoadTime: number;
    slowestPage: { name: string; time: number };
    fastestPage: { name: string; time: number };
    totalErrors: number;
    totalWarnings: number;
    averageCpuUsage?: number;
    peakCpuUsage?: number;
    averageMemoryUsage?: number;
    peakMemoryUsage?: number;
  };
}

export class PerformanceTester {
  private isRunning = false;
  private results: TestResults | null = null;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;
  private capturedErrors: string[] = [];
  private capturedWarnings: string[] = [];
  private systemMetricsHistory: SystemMetrics[] = [];
  private metricsCollectionInterval: number | null = null;

  // All main navigation pages from the app
  private readonly testPages = [
    { name: 'Dashboard', path: '/' },
    { name: 'Courses', path: '/courses' },
    { name: 'Assessments', path: '/assessments' },
    { name: 'Timetable', path: '/timetable' },
    { name: 'Study', path: '/study' },
    { name: 'Messages', path: '/direqt-messages' },
    { name: 'Portals', path: '/portals' },
    { name: 'Notices', path: '/notices' },
    { name: 'News', path: '/news' },
    { name: 'Directory', path: '/directory' },
    { name: 'Reports', path: '/reports' },
    { name: 'Analytics', path: '/analytics' },
    { name: 'Settings', path: '/settings' },
  ];

  constructor() {
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
  }

  async startPerformanceTest(): Promise<TestResults> {
    if (this.isRunning) {
      throw new Error('Performance test is already running');
    }

    this.isRunning = true;
    this.capturedErrors = [];
    this.capturedWarnings = [];
    this.systemMetricsHistory = [];
    
    // Start collecting system metrics
    this.startSystemMetricsCollection();
    
    logger.info('PerformanceTester', 'startPerformanceTest', 'Starting automated performance testing');

    const startTime = Date.now();
    const pageMetrics: PerformanceMetrics[] = [];

    // Set up console monitoring
    this.setupConsoleMonitoring();

    try {
      // Step 1: Navigate to dashboard first
      await this.navigateToPage('Dashboard', '/');
      
      // Step 2: Force reload with cache clearing (simulate Ctrl+Shift+R) - TEMPORARILY DISABLED
      // await this.forceReloadWithCacheClearing();
      
      // Step 3: Wait 2 seconds after reload - TEMPORARILY DISABLED
      // await this.delay(2000);

      // Step 4: Go through each page and collect metrics
      for (const page of this.testPages) {
        logger.info('PerformanceTester', 'testPage', `Testing page: ${page.name} (${page.path})`);
        
        try {
          const metrics = await this.testPage(page.name, page.path);
          pageMetrics.push(metrics);
          
           // No fixed delay - testPage() already waits for full page load
           // Add minimal delay to ensure DOM is stable before next navigation
           await this.delay(200);
        } catch (error) {
          logger.error('PerformanceTester', 'testPage', `Failed to test page ${page.name}:`, error as Record<string, any>);
          this.capturedErrors.push(`Failed to test page ${page.name}: ${error}`);
        }
      }

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Calculate summary statistics
      const loadTimes = pageMetrics.map(m => m.loadTime);
      const averageLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
      const slowestPage = pageMetrics.reduce((prev, current) => 
        prev.loadTime > current.loadTime ? prev : current
      );
      const fastestPage = pageMetrics.reduce((prev, current) => 
        prev.loadTime < current.loadTime ? prev : current
      );

      // Stop collecting system metrics
      this.stopSystemMetricsCollection();
      
      // Calculate system metrics summary
      const cpuUsages = this.systemMetricsHistory.map(m => m.cpu.usage_percent);
      const memoryUsages = this.systemMetricsHistory.map(m => m.memory.usage_percent);
      const averageCpuUsage = cpuUsages.length > 0 
        ? cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length 
        : undefined;
      const peakCpuUsage = cpuUsages.length > 0 ? Math.max(...cpuUsages) : undefined;
      const averageMemoryUsage = memoryUsages.length > 0 
        ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length 
        : undefined;
      const peakMemoryUsage = memoryUsages.length > 0 ? Math.max(...memoryUsages) : undefined;
      
      this.results = {
        startTime,
        endTime,
        totalDuration,
        pages: pageMetrics,
        overallErrors: [...this.capturedErrors],
        systemMetricsHistory: [...this.systemMetricsHistory],
        summary: {
          averageLoadTime,
          slowestPage: { name: slowestPage.pageName, time: slowestPage.loadTime },
          fastestPage: { name: fastestPage.pageName, time: fastestPage.loadTime },
          totalErrors: this.capturedErrors.length + pageMetrics.reduce((sum, p) => sum + p.errors.length, 0),
          totalWarnings: this.capturedWarnings.length + pageMetrics.reduce((sum, p) => sum + p.warnings.length, 0),
          averageCpuUsage,
          peakCpuUsage,
          averageMemoryUsage,
          peakMemoryUsage,
        }
      };

      logger.info('PerformanceTester', 'startPerformanceTest', 'Performance testing completed', {
        duration: totalDuration,
        pagestested: pageMetrics.length,
        averageLoadTime,
        totalErrors: this.results.summary.totalErrors
      } as Record<string, any>);

      return this.results;

    } finally {
      this.stopSystemMetricsCollection();
      this.restoreConsoleMonitoring();
      this.isRunning = false;
    }
  }

  private async testPage(pageName: string, path: string): Promise<PerformanceMetrics> {
    const pageErrors: string[] = [];
    const pageWarnings: string[] = [];
    const resourceLoadTimes: Array<{ name: string; duration: number; size?: number }> = [];
    const pageSystemMetrics: SystemMetrics[] = [];

    // Clear performance entries before navigation
    if (performance.clearMarks) performance.clearMarks();
    if (performance.clearMeasures) performance.clearMeasures();

    const navigationStart = performance.now();
    
    // Collect system metrics before navigation
    await this.collectSystemMetricsSnapshot(pageSystemMetrics);

    // Set up performance observer for this page
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          const resourceEntry = entry as PerformanceResourceTiming;
          resourceLoadTimes.push({
            name: resourceEntry.name,
            duration: resourceEntry.duration,
            size: (resourceEntry as any).transferSize || undefined
          });
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['resource', 'navigation', 'paint'] });
    } catch (e) {
      // Some browsers might not support all entry types
      logger.warn('PerformanceTester', 'testPage', 'Could not observe all performance entry types:', e as Record<string, any>);
    }

    // Navigate to the page
    await this.navigateToPage(pageName, path);

    // Collect system metrics during navigation/load
    await this.collectSystemMetricsSnapshot(pageSystemMetrics);
    
    // Wait for page to be fully loaded
    await this.waitForPageLoad();
    
    // Collect system metrics after page load
    await this.collectSystemMetricsSnapshot(pageSystemMetrics);
    
    // Collect a few more snapshots during the stabilization period
    await this.delay(100);
    await this.collectSystemMetricsSnapshot(pageSystemMetrics);
    await this.delay(100);
    await this.collectSystemMetricsSnapshot(pageSystemMetrics);

    const navigationEnd = performance.now();
    const loadTime = navigationEnd - navigationStart;

    // Get Web Vitals and other performance metrics
    const navigationEntries = performance.getEntriesByType('navigation');
    const performanceEntries = navigationEntries.length > 0 ? navigationEntries[0] as PerformanceNavigationTiming : null;
    const paintEntries = performance.getEntriesByType('paint');

    let firstPaint: number | undefined;
    let firstContentfulPaint: number | undefined;

    for (const entry of paintEntries) {
      if (entry.name === 'first-paint') {
        firstPaint = entry.startTime;
      } else if (entry.name === 'first-contentful-paint') {
        firstContentfulPaint = entry.startTime;
      }
    }

    // Get memory usage if available
    let memoryUsage: number | undefined;
    if ((performance as any).memory) {
      memoryUsage = (performance as any).memory.usedJSHeapSize;
    }

    // Collect any errors or warnings that occurred during page load
    const currentErrors = [...this.capturedErrors];
    const currentWarnings = [...this.capturedWarnings];
    this.capturedErrors = [];
    this.capturedWarnings = [];

    observer.disconnect();

    const metrics: PerformanceMetrics = {
      pageName,
      path,
      loadTime,
      domContentLoaded: performanceEntries ? performanceEntries.domContentLoadedEventEnd - performanceEntries.domContentLoadedEventStart : loadTime,
      firstPaint,
      firstContentfulPaint,
      memoryUsage,
      errors: [...pageErrors, ...currentErrors],
      warnings: [...pageWarnings, ...currentWarnings],
      networkRequests: resourceLoadTimes.length,
      resourceLoadTimes,
      systemMetrics: pageSystemMetrics.length > 0 ? pageSystemMetrics : undefined
    };

    logger.debug('PerformanceTester', 'testPage', `Metrics for ${pageName}:`, metrics);

    return metrics;
  }

  private async navigateToPage(pageName: string, path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Navigation to ${pageName} (${path}) timed out`));
      }, 30000); // 30 second timeout

      goto(path).then(() => {
        clearTimeout(timeout);
        resolve();
      }).catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async waitForPageLoad(): Promise<void> {
    return new Promise((resolve) => {
      // Check if page is already complete
      if (document.readyState === 'complete') {
        // Wait for any pending async operations and rendering
        this.waitForStableDOM().then(resolve);
        return;
      }

      const cleanup = () => {
        document.removeEventListener('readystatechange', onReadyStateChange);
        window.removeEventListener('load', onLoad);
      };

      const onLoad = () => {
        cleanup();
        this.waitForStableDOM().then(resolve);
      };

      const onReadyStateChange = () => {
        if (document.readyState === 'complete') {
          cleanup();
          this.waitForStableDOM().then(resolve);
        }
      };

      document.addEventListener('readystatechange', onReadyStateChange);
      window.addEventListener('load', onLoad);

      // Fallback timeout to prevent hanging
      setTimeout(() => {
        cleanup();
        this.waitForStableDOM().then(resolve);
      }, 10000); // 10 second max wait
    });
  }

  private async waitForStableDOM(): Promise<void> {
    // Wait for images and other resources to load
    await this.waitForImages();
    
    // Wait for any pending network requests to complete
    await this.waitForNetworkIdle();
    
    // Wait for DOM mutations to settle
    await this.waitForDOMStable();
  }

  private async waitForImages(): Promise<void> {
    const images = Array.from(document.querySelectorAll('img'));
    const imagePromises = images.map(img => {
      if (img.complete) return Promise.resolve();
      
      return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 1000); // 1s timeout per image (faster)
        
        const onLoad = () => {
          clearTimeout(timeout);
          img.removeEventListener('load', onLoad);
          img.removeEventListener('error', onError);
          resolve();
        };
        
        const onError = () => {
          clearTimeout(timeout);
          img.removeEventListener('load', onLoad);
          img.removeEventListener('error', onError);
          resolve(); // Resolve even on error to not block testing
        };
        
        img.addEventListener('load', onLoad);
        img.addEventListener('error', onError);
      });
    });

    await Promise.all(imagePromises);
  }

  private async waitForNetworkIdle(): Promise<void> {
    return new Promise((resolve) => {
      let activeRequests = 0;
      let idleTimer: number;

      const originalFetch = window.fetch;
      const originalXHROpen = XMLHttpRequest.prototype.open;

      const startRequest = () => {
        activeRequests++;
        clearTimeout(idleTimer);
      };

      const endRequest = () => {
        activeRequests--;
        if (activeRequests <= 0) {
          idleTimer = window.setTimeout(() => {
            // Restore original functions
            window.fetch = originalFetch;
            XMLHttpRequest.prototype.open = originalXHROpen;
            resolve();
          }, 200); // 200ms of network idle (faster)
        }
      };

      // Monitor fetch requests
      window.fetch = (...args) => {
        startRequest();
        return originalFetch.apply(window, args).finally(endRequest);
      };

      // Monitor XMLHttpRequest
      XMLHttpRequest.prototype.open = function(method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null) {
        startRequest();
        this.addEventListener('loadend', endRequest);
        this.addEventListener('error', endRequest);
        return originalXHROpen.call(this, method, url, async ?? true, username, password);
      };

      // Start idle timer immediately if no active requests
      if (activeRequests <= 0) {
        idleTimer = window.setTimeout(() => {
          window.fetch = originalFetch;
          XMLHttpRequest.prototype.open = originalXHROpen;
          resolve();
        }, 200);
      }

      // Fallback timeout
      window.setTimeout(() => {
        window.fetch = originalFetch;
        XMLHttpRequest.prototype.open = originalXHROpen;
        resolve();
      }, 5000); // 5 second max wait for network idle
    });
  }

  private async waitForDOMStable(): Promise<void> {
    return new Promise((resolve) => {
      let mutationCount = 0;
      let stableTimer: number;

      const observer = new MutationObserver(() => {
        mutationCount++;
        clearTimeout(stableTimer);
        
        // Wait for DOM to be stable for 100ms (much faster)
        stableTimer = window.setTimeout(() => {
          observer.disconnect();
          resolve();
        }, 100);
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeOldValue: false,
        characterData: true,
        characterDataOldValue: false
      });

      // If no mutations occur within 200ms, consider DOM stable
      stableTimer = window.setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 200);
    });
  }

  private async forceReloadWithCacheClearing(): Promise<void> {
    logger.info('PerformanceTester', 'forceReloadWithCacheClearing', 'Performing hard reload with cache clearing');
    
    try {
      // Try to clear caches if available
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        logger.debug('PerformanceTester', 'forceReloadWithCacheClearing', 'Cleared service worker caches');
      }

      // Clear localStorage and sessionStorage
      localStorage.clear();
      sessionStorage.clear();

      // Simulate Ctrl+Shift+R by reloading with cache bypass
      window.location.reload();
      
      // Wait for reload to complete
      await this.delay(3000);
      
    } catch (error) {
      logger.warn('PerformanceTester', 'forceReloadWithCacheClearing', 'Could not clear all caches:', error as Record<string, any>);
      // Fallback to regular reload
      window.location.reload();
      await this.delay(3000);
    }
  }

  private setupConsoleMonitoring(): void {
    console.error = (...args: any[]) => {
      this.capturedErrors.push(args.join(' '));
      this.originalConsoleError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      this.capturedWarnings.push(args.join(' '));
      this.originalConsoleWarn.apply(console, args);
    };
  }

  private restoreConsoleMonitoring(): void {
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async startSystemMetricsCollection() {
    const { invoke } = await import('@tauri-apps/api/core');
    
    // Collect metrics every 500ms
    this.metricsCollectionInterval = window.setInterval(async () => {
      try {
        const metrics = await invoke<SystemMetrics>('get_system_metrics');
        this.systemMetricsHistory.push(metrics);
      } catch (error) {
        logger.warn('PerformanceTester', 'startSystemMetricsCollection', 'Failed to collect system metrics', { error });
      }
    }, 500);
  }

  private stopSystemMetricsCollection() {
    if (this.metricsCollectionInterval !== null) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }
  }

  private async collectSystemMetricsSnapshot(metricsArray: SystemMetrics[]): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const metrics = await invoke<SystemMetrics>('get_system_metrics');
      metricsArray.push(metrics);
    } catch (error) {
      logger.warn('PerformanceTester', 'collectSystemMetricsSnapshot', 'Failed to collect system metrics snapshot', { error });
    }
  }

  getResults(): TestResults | null {
    return this.results;
  }

  isTestRunning(): boolean {
    return this.isRunning;
  }

}

// Singleton instance
export const performanceTester = new PerformanceTester();
