<script lang="ts">
  import { page } from '$app/stores';
  import { Icon } from 'svelte-hero-icons';
  import { 
    ArrowLeft, 
    Home, 
    ArrowPath, 
    Cog, 
    InformationCircle,
    ComputerDesktop,
    Wifi,
    CircleStack,
    Clock,
    ChartBar,
    DocumentText,
    ExclamationTriangle,
    LightBulb,
    ShieldCheck,
    ExclamationCircle,
    CheckCircle,
    XCircle
  } from 'svelte-hero-icons';
  import { goto } from '$app/navigation';
  import { accentColor } from '../lib/stores/theme';
  import TroubleshootingModal from '../lib/components/TroubleshootingModal.svelte';
  import { logger } from '../utils/logger';
  import { ErrorCategory, ErrorSeverity, errorService } from '../lib/services/errorService';
  import { get } from 'svelte/store';
  import { _ } from '../lib/i18n';

  let { error, status } = $props<{
    error: Error & { status?: number; message?: string };
    status: number;
  }>();

  // Parse error details from URL parameters
  let errorId = $derived($page.url.searchParams.get('errorId') || 'unknown');
  let errorCategory = $derived($page.url.searchParams.get('category') as ErrorCategory || ErrorCategory.UNKNOWN);
  let errorSeverity = $derived($page.url.searchParams.get('severity') as ErrorSeverity || ErrorSeverity.MEDIUM);
  let errorMessage = $derived(decodeURIComponent($page.url.searchParams.get('message') || error?.message || get(_)('error_page.desc_default')));
  let errorReportJson = $derived($page.url.searchParams.get('report'));
  
  // Parse error report if available
  let errorReport = $derived(errorReportJson ? JSON.parse(decodeURIComponent(errorReportJson)) : null);
  
  // Get error details
  let errorStatus = $derived(status || error?.status || 500);
  let isNetworkError = $derived(errorCategory === ErrorCategory.NETWORK || errorMessage.includes('fetch') || errorMessage.includes('network'));
  let isAuthError = $derived(errorCategory === ErrorCategory.AUTHENTICATION || errorStatus === 401 || errorStatus === 403);
  let isNotFoundError = $derived(errorCategory === ErrorCategory.RUNTIME || errorStatus === 404);
  let isServerError = $derived(errorStatus >= 500 || errorCategory === ErrorCategory.RUNTIME);
  let isPerformanceError = $derived(errorCategory === ErrorCategory.RUNTIME);
  let isCriticalError = $derived(errorSeverity === ErrorSeverity.CRITICAL);

  // Error type key for i18n
  let errorTypeKey = $derived(isAuthError ? 'error_page.type_auth' :
                 isNotFoundError ? 'error_page.type_not_found' :
                 isNetworkError ? 'error_page.type_network' :
                 isPerformanceError ? 'error_page.type_performance' :
                 isServerError ? 'error_page.type_server' :
                 isCriticalError ? 'error_page.type_critical' :
                 'error_page.type_app');

  // Error description key for i18n
  let errorDescKey = $derived(isAuthError ? 'error_page.desc_auth' :
                       isNotFoundError ? 'error_page.desc_not_found' :
                       isNetworkError ? 'error_page.desc_network' :
                       isPerformanceError ? 'error_page.desc_performance' :
                       isServerError ? 'error_page.desc_server' :
                       isCriticalError ? 'error_page.desc_critical' :
                       'error_page.desc_default');

  // System health indicators
  let systemHealth = $derived(errorReport?.diagnostics?.systemHealth);
  let networkStatus = $derived(errorReport?.diagnostics?.networkStatus);
  let storageStatus = $derived(errorReport?.diagnostics?.storageStatus);
  let recentErrors = $derived(errorReport?.diagnostics?.recentErrors || []);
  let performanceIssues = $derived(errorReport?.diagnostics?.performanceIssues || []);
  let recommendations = $derived(errorReport?.recommendations || []);

  function goHome() {
    goto('/');
  }

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      goHome();
    }
  }

  function refreshPage() {
    window.location.reload();
  }

  function retryOperation() {
    // Try to retry the specific operation that failed
    if (errorReport?.error?.context?.operation) {
      logger.info('errorPage', 'retryOperation', 'Attempting to retry operation', {
        operation: errorReport.error.context.operation,
        errorId
      });
    }
    refreshPage();
  }

  // Troubleshooting modal state
  let showTroubleshootingModal = $state(false);
  let showDetailedInfo = $state(false);

  function openTroubleshooting() {
    logger.info('errorPage', 'openTroubleshooting', 'Opening troubleshooting modal from comprehensive error page', {
      errorId,
      errorStatus,
      errorTypeKey,
      errorMessage,
      errorCategory,
      errorSeverity,
      stack: error?.stack
    });
    showTroubleshootingModal = true;
  }

  function closeTroubleshooting() {
    logger.debug('errorPage', 'closeTroubleshooting', 'Closing troubleshooting modal');
    showTroubleshootingModal = false;
  }

  function toggleDetailedInfo() {
    showDetailedInfo = !showDetailedInfo;
  }

  function reportError() {
    // You can implement error reporting here
    console.error('Error details:', {
      errorId,
      status: errorStatus,
      message: errorMessage,
      category: errorCategory,
      severity: errorSeverity,
      stack: error?.stack,
      url: $page.url.href,
      report: errorReport
    });
  }

  function markErrorResolved() {
    if (errorId !== 'unknown') {
      errorService.markErrorResolved();
      logger.info('errorPage', 'markErrorResolved', 'Error marked as resolved', { errorId });
    }
  }

  // Get health status color
  function getHealthColor(health: string) {
    switch (health) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-blue-500';
      case 'fair': return 'text-yellow-500';
      case 'poor': return 'text-orange-500';
      case 'critical': return 'text-red-500';
      default: return 'text-zinc-500';
    }
  }

  // Get severity color
  function getSeverityColor(severity: ErrorSeverity) {
    switch (severity) {
      case ErrorSeverity.LOW: return 'text-blue-500';
      case ErrorSeverity.MEDIUM: return 'text-yellow-500';
      case ErrorSeverity.HIGH: return 'text-orange-500';
      case ErrorSeverity.CRITICAL: return 'text-red-500';
      default: return 'text-zinc-500';
    }
  }

  // Get category icon
  function getCategoryIcon(category: ErrorCategory) {
    switch (category) {
      case ErrorCategory.NETWORK: return Wifi;
      case ErrorCategory.AUTHENTICATION: return ShieldCheck;
      case ErrorCategory.RUNTIME: return ChartBar;
      case ErrorCategory.VALIDATION: return CircleStack;
      case ErrorCategory.UI: return Clock;
      default: return ExclamationTriangle;
    }
  }
</script>

<svelte:head>
  <title>{$_('error_page.title', { values: { status: errorStatus } })}</title>
</svelte:head>

<div class="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center p-8">
  <div class="max-w-4xl w-full">
    <div class="bg-white/80 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs p-8">
      <!-- Error Header -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Icon 
                src={getCategoryIcon(errorCategory)} 
                size="32" 
                class="text-red-500 dark:text-red-400"
              />
            </div>
            <div>
              <h1 class="text-4xl font-bold text-red-500 dark:text-red-400 mb-2">{errorStatus}</h1>
              <h2 class="text-xl font-semibold text-zinc-900 dark:text-white">{$_(errorTypeKey)}</h2>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-sm text-zinc-500 dark:text-zinc-400">{$_('error_page.error_id')}: {errorId}</span>
                <span class="text-sm px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  {errorCategory}
                </span>
                <span class="text-sm px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  {errorSeverity}
                </span>
              </div>
            </div>
          </div>
          <button
            onclick={toggleDetailedInfo}
            class="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            <Icon src={InformationCircle} size="16" class="inline mr-1" />
            {showDetailedInfo ? $_('error_page.hide_details') : $_('error_page.show_details')} {$_('error_page.details')}
          </button>
        </div>

        <!-- Error Description -->
        <div class="mb-6">
          <p class="text-zinc-600 dark:text-zinc-300 leading-relaxed text-lg">{$_(errorDescKey)}</p>
          {#if !isAuthError && !isNotFoundError}
            <div class="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <p class="text-sm text-zinc-700 dark:text-zinc-300">
                <span class="font-medium">{$_('error_page.error_message')}:</span> {errorMessage}
              </p>
            </div>
          {/if}
        </div>

        <!-- System Health Overview -->
        {#if systemHealth || networkStatus || storageStatus}
          <div class="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <h3 class="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
              <Icon src={ComputerDesktop} size="16" />
              {$_('error_page.system_health_overview')}
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              {#if systemHealth}
                <div class="flex items-center gap-2">
                  <Icon src={ChartBar} size="16" class="text-zinc-500" />
                  <span class="text-sm text-zinc-600 dark:text-zinc-400">{$_('error_page.overall_health')}:</span>
                  <span class="text-sm font-medium {getHealthColor(systemHealth.overallHealth)}">
                    {systemHealth.overallHealth}
                  </span>
                </div>
              {/if}
              {#if networkStatus}
                <div class="flex items-center gap-2">
                  <Icon src={Wifi} size="16" class="text-zinc-500" />
                  <span class="text-sm text-zinc-600 dark:text-zinc-400">{$_('error_page.network')}:</span>
                  <span class="text-sm font-medium {networkStatus.isOnline ? 'text-green-500' : 'text-red-500'}">
                    {networkStatus.isOnline ? $_('error_page.online') : $_('error_page.offline')}
                  </span>
                </div>
              {/if}
              {#if storageStatus}
                <div class="flex items-center gap-2">
                  <Icon src={CircleStack} size="16" class="text-zinc-500" />
                  <span class="text-sm text-zinc-600 dark:text-zinc-400">{$_('error_page.storage')}:</span>
                  <span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {storageStatus.localStorage} {$_('error_page.items')}
                  </span>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- Action Buttons -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {#if isAuthError}
          <button
            onclick={goHome}
            class="px-4 py-3 bg-accent-500 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 hover:bg-accent-600"
          >
            <Icon src={Home} size="20" class="inline mr-2" />
            {$_('error_page.go_to_login')}
          </button>
        {:else}
          <button
            onclick={goBack}
            class="px-4 py-3 bg-accent-500 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 hover:bg-accent-600"
          >
            <Icon src={ArrowLeft} size="20" class="inline mr-2" />
            {$_('error_page.go_back')}
          </button>
        {/if}

        <button
          onclick={retryOperation}
          class="px-4 py-3 bg-blue-500 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 hover:bg-blue-600"
        >
          <Icon src={ArrowPath} size="20" class="inline mr-2" />
          {$_('error_page.retry_operation')}
        </button>

        <button
          onclick={refreshPage}
          class="px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 hover:bg-zinc-200 dark:hover:bg-zinc-700"
        >
          <Icon src={ArrowPath} size="20" class="inline mr-2" />
          {$_('error_page.refresh_page')}
        </button>

        <button
          onclick={openTroubleshooting}
          class="px-4 py-3 bg-purple-500 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 hover:bg-purple-600"
        >
          <Icon src={Cog} size="20" class="inline mr-2" />
          {$_('error_page.advanced_troubleshooting')}
        </button>

        <button
          onclick={goHome}
          class="px-4 py-3 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Icon src={Home} size="20" class="inline mr-2" />
          {$_('error_page.go_home')}
        </button>

        {#if errorId !== 'unknown'}
          <button
            onclick={markErrorResolved}
            class="px-4 py-3 bg-green-500 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-green-500 focus:ring-offset-2 hover:bg-green-600"
          >
            <Icon src={CheckCircle} size="20" class="inline mr-2" />
            {$_('error_page.mark_as_resolved')}
          </button>
        {/if}
      </div>

      <!-- Recommendations -->
      {#if recommendations.length > 0}
        <div class="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 class="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
            <Icon src={LightBulb} size="16" />
            {$_('error_page.recommended_actions')}
          </h3>
          <ul class="space-y-2">
            {#each recommendations as recommendation}
              <li class="text-sm text-blue-600 dark:text-blue-300 flex items-start gap-2">
                <Icon src={CheckCircle} size="14" class="mt-0.5 text-blue-500" />
                {recommendation}
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      <!-- Performance Issues -->
      {#if performanceIssues.length > 0}
        <div class="mb-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <h3 class="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-3 flex items-center gap-2">
            <Icon src={ExclamationCircle} size="16" />
            {$_('error_page.performance_issues_detected')}
          </h3>
          <ul class="space-y-2">
            {#each performanceIssues as issue}
              <li class="text-sm text-yellow-600 dark:text-yellow-300 flex items-start gap-2">
                <Icon src={XCircle} size="14" class="mt-0.5 text-yellow-500" />
                {issue}
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      <!-- Recent Errors -->
      {#if recentErrors.length > 0}
        <div class="mb-8 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <h3 class="text-sm font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
            <Icon src={ExclamationTriangle} size="16" />
            {$_('error_page.recent_errors')} ({recentErrors.length})
          </h3>
          <div class="space-y-2 max-h-32 overflow-y-auto">
            {#each recentErrors.slice(-5) as recentError}
              <div class="text-sm text-red-600 dark:text-red-300 flex items-start gap-2">
                <Icon src={ExclamationTriangle} size="14" class="mt-0.5 text-red-500" />
                <div>
                  <div class="font-medium">{recentError.message}</div>
                  <div class="text-xs text-red-500 dark:text-red-400">
                    {new Date(recentError.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Detailed Information (Collapsible) -->
      {#if showDetailedInfo}
        <div class="mt-8 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <h3 class="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
            <Icon src={DocumentText} size="16" />
            {$_('error_page.detailed_error_info')}
          </h3>
          
          <!-- Error Context -->
          {#if errorReport?.error?.context}
            <div class="mb-4">
              <h4 class="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">{$_('error_page.error_context')}</h4>
              <pre class="text-xs text-zinc-600 dark:text-zinc-400 overflow-auto bg-white dark:bg-zinc-900 p-3 rounded-sm border border-zinc-200 dark:border-zinc-700">{JSON.stringify(errorReport.error.context, null, 2)}</pre>
            </div>
          {/if}

          <!-- Environment Information -->
          {#if errorReport?.environment}
            <div class="mb-4">
              <h4 class="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">{$_('error_page.environment')}</h4>
              <pre class="text-xs text-zinc-600 dark:text-zinc-400 overflow-auto bg-white dark:bg-zinc-900 p-3 rounded-sm border border-zinc-200 dark:border-zinc-700">{JSON.stringify(errorReport.environment, null, 2)}</pre>
            </div>
          {/if}

          <!-- Stack Trace -->
          {#if error?.stack}
            <div class="mb-4">
              <h4 class="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">{$_('error_page.stack_trace')}</h4>
              <pre class="text-xs text-zinc-600 dark:text-zinc-400 overflow-auto bg-white dark:bg-zinc-900 p-3 rounded-sm border border-zinc-200 dark:border-zinc-700 max-h-48">{error.stack}</pre>
            </div>
          {/if}

          <!-- Full Error Report -->
          {#if errorReport}
            <div>
              <h4 class="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">{$_('error_page.complete_error_report')}</h4>
              <pre class="text-xs text-zinc-600 dark:text-zinc-400 overflow-auto bg-white dark:bg-zinc-900 p-3 rounded-sm border border-zinc-200 dark:border-zinc-700 max-h-64">{JSON.stringify(errorReport, null, 2)}</pre>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Debug Info (only in development) -->
      {#if import.meta.env.DEV}
        <div class="mt-8 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-left border border-zinc-200 dark:border-zinc-700">
          <h3 class="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{$_('error_page.dev_debug_info')}</h3>
          <pre class="text-xs text-zinc-600 dark:text-zinc-400 overflow-auto bg-white dark:bg-zinc-900 p-3 rounded-sm border border-zinc-200 dark:border-zinc-700">{JSON.stringify({
            errorId,
            status: errorStatus,
            message: errorMessage,
            category: errorCategory,
            severity: errorSeverity,
            url: $page.url.href,
            timestamp: new Date().toISOString(),
            hasErrorReport: !!errorReport
          }, null, 2)}</pre>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Troubleshooting Modal -->
<TroubleshootingModal 
  open={showTroubleshootingModal} 
  onclose={closeTroubleshooting}
  errorReport={errorReport}
/> 