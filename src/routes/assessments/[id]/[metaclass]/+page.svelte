<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { page } from '$app/stores';
  import { seqtaFetch } from '../../../../utils/netUtil';
  import AssessmentHeader from '../../../../lib/components/AssessmentHeader.svelte';
  import AssessmentTabs from '../../../../lib/components/AssessmentTabs.svelte';
  import AssessmentOverview from '../../../../lib/components/AssessmentOverview.svelte';
  import AssessmentDetails from '../../../../lib/components/AssessmentDetails.svelte';
  import AssessmentSubmissions from '../../../../lib/components/AssessmentSubmissions.svelte';
  import { ClipboardDocumentList, ChartBar, FolderArrowDown } from 'svelte-hero-icons';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../../../lib/i18n';

  let assessmentData: any = $state(null);
  let loading = $state(true);
  let error = $state('');
  let tab = $state('overview'); // default tab
  let allSubmissions: any[] = $state([]);

  // Define available tabs based on assessment data
  const availableTabs = $derived((() => {
    const tabs = [
      { id: 'overview', label: $_('assessments.overview') || 'Overview', icon: ClipboardDocumentList },
      { id: 'details', label: $_('assessments.details') || 'Details', icon: ChartBar },
    ];
    
    // Only show submissions tab if file submission is enabled
    if (assessmentData?.submissionSettings?.fileSubmissionEnabled) {
      tabs.push({ id: 'submissions', label: $_('assessments.submissions') || 'Submissions', icon: FolderArrowDown });
    }
    
    return tabs;
  })());

  async function loadAssessmentDetails() {
    try {
      const res = await seqtaFetch('/seqta/student/assessment/get?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {
          assessment: parseInt($page.params.id!),
          student: 69,
          metaclass: parseInt($page.params.metaclass!),
        },
      });
      assessmentData = JSON.parse(res).payload;

      // Only fetch submissions if file submission is enabled
      if (assessmentData?.submissionSettings?.fileSubmissionEnabled) {
        const subRes = await seqtaFetch('/seqta/student/assessment/submissions/get?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: {
            assessment: parseInt($page.params.id!),
            student: 69,
            metaclass: parseInt($page.params.metaclass!),
          },
        });
        const submissions = JSON.parse(subRes).payload;
        allSubmissions = submissions;
      } else {
        allSubmissions = [];
      }
    } catch (e) {
      console.error('Failed to load assessment details:', e);
      error = $_('assessments.failed_to_load') || 'Failed to load assessment details';
    } finally {
      loading = false;
    }
  }

  function handleTabChange(tabId: string) {
    // Prevent switching to submissions if it's not enabled
    if (tabId === 'submissions' && !assessmentData?.submissionSettings?.fileSubmissionEnabled) {
      return;
    }
    tab = tabId;
  }

  // Redirect away from submissions tab if it becomes unavailable
  $effect(() => {
    if (tab === 'submissions' && !assessmentData?.submissionSettings?.fileSubmissionEnabled) {
      tab = 'overview';
    }
  });

  onMount(async () => {
    await loadAssessmentDetails();
    
    // Pick tab based on query param, but validate it's available
    const url = new URL(window.location.href);
    const tabParam = url.searchParams.get('tab');
    
    if (tabParam === 'details' || tabParam === 'overview') {
      tab = tabParam;
    } else if (tabParam === 'submissions') {
      // Only allow submissions tab if file submission is enabled
      if (assessmentData?.submissionSettings?.fileSubmissionEnabled) {
        tab = tabParam;
      } else {
        tab = 'overview'; // Fallback to overview if submissions disabled
      }
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
</script>

<div class="min-h-screen" style="background: var(--background-color);">
  <!-- Header -->
  <AssessmentHeader />

  <!-- Tabs -->
  <AssessmentTabs 
    tabs={availableTabs}
    activeTab={tab}
    onTabChange={handleTabChange}
  />

  <!-- Content -->
  <div class="container px-6 py-8 mx-auto">
    {#if loading}
      <div class="flex justify-center items-center h-64" in:fade={{ duration: 200, easing: cubicOut }}>
        <div class="w-12 h-12 rounded-full border-t-2 border-b-2 border-accent-500 animate-spin">
        </div>
      </div>
    {:else if error}
      <div 
        class="flex justify-center items-center h-64" 
        in:fly={{ y: 20, duration: 300, easing: cubicOut }}>
        <div class="text-red-500 animate-pulse">{error}</div>
      </div>
    {:else if assessmentData}
      {#if tab === 'overview'}
        <div in:fly={{ y: 20, duration: 400, easing: cubicOut }}>
          <AssessmentOverview 
            {assessmentData} 
            assessmentId={parseInt($page.params.id!)}
            onRatingUpdate={loadAssessmentDetails}
          />
        </div>
      {:else if tab === 'details'}
        <div in:fly={{ y: 20, duration: 400, easing: cubicOut }}>
          <AssessmentDetails {assessmentData} />
        </div>
      {:else if tab === 'submissions'}
        <div in:fly={{ y: 20, duration: 400, easing: cubicOut }}>
          <AssessmentSubmissions 
            submissions={allSubmissions}
            assessmentId={parseInt($page.params.id!)}
            metaclassId={parseInt($page.params.metaclass!)}
            onUploadComplete={loadAssessmentDetails}
          />
        </div>
      {/if}
    {/if}
  </div>
</div>


