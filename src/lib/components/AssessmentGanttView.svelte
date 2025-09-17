<script lang="ts">
  import { Gantt, Willow, WillowDark } from "wx-svelte-gantt";
  import { theme } from '$lib/stores/theme';
  
  interface Props {
    assessments: any[];
    subjects?: any[];
    activeSubjects?: any[];
  }

  let { assessments, subjects = [], activeSubjects = [] }: Props = $props();

  // Convert assessments to Gantt format
  let tasks = $state<any[]>([]);
  let links = $state<any[]>([]);

  // Gantt columns configuration with assessment count column
  const columns = [
    { id: "text", header: "Assessment", flexgrow: 1 },
    { id: "count", header: "Count", width: 80, align: "center" }
  ];

  // Enhanced scales configuration with proper formatting
  const scales = [
    { unit: "month", step: 1, format: "MMMM yyyy" },
    { unit: "week", step: 1, format: "MMM d" },
    { unit: "day", step: 1, format: "d" }
  ];

  // Process assessments into Gantt tasks format with better structure
  function processAssessments() {
    if (!assessments || assessments.length === 0) {
      tasks = [];
      return;
    }

    const now = new Date();
    
    // Group assessments by subject for better organization
    const subjectGroups = new Map();
    assessments.forEach((assessment) => {
      const subject = assessment.subject || assessment.code || 'Other';
      if (!subjectGroups.has(subject)) {
        subjectGroups.set(subject, []);
      }
      subjectGroups.get(subject).push(assessment);
    });

    const processed: any[] = [];
    let currentId = 1;

    // Create subject groups as summary tasks
    subjectGroups.forEach((subjectAssessments, subject) => {
      const subjectColor = subjectAssessments[0]?.colour || '#8e8e8e';
      
      // Calculate subject date range
      const subjectDates = subjectAssessments.map((a: any) => new Date(a.due));
      const earliestDue = new Date(Math.min(...subjectDates.map((d: Date) => d.getTime())));
      const latestDue = new Date(Math.max(...subjectDates.map((d: Date) => d.getTime())));
      const subjectStart = new Date(earliestDue.getTime() - (14 * 24 * 60 * 60 * 1000));

      // Add subject summary task
      const subjectId = currentId++;
      const subjectDuration = Math.ceil((latestDue.getTime() - subjectStart.getTime()) / (24 * 60 * 60 * 1000));
      
      // Calculate average progress for the subject
      const completedAssessments = subjectAssessments.filter((a: any) => 
        a.status === 'MARKS_RELEASED' || a.status === 'completed'
      ).length;
      const subjectProgress = Math.round((completedAssessments / subjectAssessments.length) * 100);
      
      processed.push({
        id: subjectId,
        start: subjectStart,
        duration: subjectDuration,
        text: subject,
        count: subjectAssessments.length,
        progress: subjectProgress,
        parent: 0,
        type: "summary",
        open: false, // Start collapsed
        color: subjectColor
      });

      // Add individual assessments under subject
      subjectAssessments.forEach((assessment: any) => {
        const dueDate = new Date(assessment.due);
        const defaultDuration = 14; // 2 weeks default in days
        
        // Calculate start date (always 2 weeks before due date, regardless of current date)
        const startDate = new Date(dueDate.getTime() - (defaultDuration * 24 * 60 * 60 * 1000));
        
        // Calculate progress based on status
        let progress = 0;
        if (assessment.status === 'MARKS_RELEASED' || assessment.status === 'completed') {
          progress = 100;
        } else if (dueDate < now) {
          progress = 75; // High progress for overdue items
        } else {
          // Calculate progress based on how much time has passed
          const totalTime = dueDate.getTime() - startDate.getTime();
          const elapsedTime = now.getTime() - startDate.getTime();
          progress = Math.max(0, Math.min(50, (elapsedTime / totalTime) * 100)); // Cap at 50% for ongoing work
        }

        processed.push({
          id: currentId++,
          start: startDate,
          duration: defaultDuration, // Use duration instead of end date
          text: assessment.title || 'Untitled Assessment',
          count: '', // Empty for individual assessments
          progress: progress,
          parent: subjectId,
          type: "task",
          details: `Due: ${dueDate.toLocaleDateString()}\nStatus: ${assessment.status || 'Pending'}\nSubject: ${assessment.subject || assessment.code}`,
          color: assessment.colour || subjectColor // Use individual assessment color first, fallback to subject color
        });
      });
    });

    tasks = processed;
  }

  // Initialize Gantt with better configuration
  function initGantt(api: any) {
    // Basic API configuration - some methods might not be available
    console.log('Gantt API initialized', api);
    
    // Try to configure if methods are available
    try {
      if (api.setConfig) {
        api.setConfig({
          readonly: false,
          taskHeight: 32,
          scaleHeight: 50,
          columnWidth: 70,
          autoSchedule: false
        });
      }
    } catch (e) {
      console.warn('Gantt configuration not available:', e);
    }
  }

  // Process assessments when they change
  $effect(() => {
    if (assessments.length > 0) {
      processAssessments();
    }
  });
</script>

<div class="space-y-4">
  <!-- Header -->
  <div class="flex items-center justify-between p-4 rounded-xl border backdrop-blur-xs bg-zinc-100/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50">
    <h2 class="text-lg font-semibold text-zinc-900 dark:text-white">Assignment Timeline</h2>
    <div class="text-sm text-zinc-600 dark:text-zinc-400">
      {tasks.filter(t => t.type === 'task').length} assignment{tasks.filter(t => t.type === 'task').length !== 1 ? 's' : ''}
    </div>
  </div>

  {#if tasks.length === 0}
    <div class="text-center py-12 text-zinc-500 dark:text-zinc-400">
      <div class="text-4xl mb-4">📊</div>
      <h3 class="text-lg font-medium mb-2">No assessments to display</h3>
      <p class="text-sm">Assessments will appear here once loaded.</p>
    </div>
  {:else}
    <!-- SVAR Gantt Chart with Theme -->
    <div class="gantt-container rounded-xl border border-zinc-300/50 dark:border-zinc-700/50 overflow-hidden">
      {#if $theme === 'dark'}
        <WillowDark>
          <Gantt 
            {tasks} 
            {links} 
            {scales} 
            {columns}
            init={initGantt}
          />
        </WillowDark>
      {:else}
        <Willow>
          <Gantt 
            {tasks} 
            {links} 
            {scales} 
            {columns}
            init={initGantt}
          />
        </Willow>
      {/if}
    </div>

    <!-- Legend -->
    <div class="flex items-center justify-center gap-6 p-4 rounded-xl border border-zinc-300/50 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-900/50">
      <div class="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <div class="w-4 h-3 rounded bg-blue-500"></div>
        <span>Individual Tasks</span>
      </div>
      <div class="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <div class="w-4 h-3 rounded bg-green-500"></div>
        <span>Subject Groups</span>
      </div>
      <div class="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <div class="w-3 h-1 rounded-full bg-orange-400"></div>
        <span>Progress Bar</span>
      </div>
      <div class="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <div class="w-2 h-2 rounded-full bg-red-500"></div>
        <span>Overdue Items</span>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.gantt-container) {
    min-height: 500px;
  }
  
  /* Custom theme overrides to match our app */
  :global(.gantt-container .wx-willow-theme) {
    --wx-gantt-task-color: rgb(var(--accent));
    --wx-gantt-project-color: #00ba94;
    --wx-gantt-border: 1px solid rgb(212 212 216 / 0.5);
    --wx-grid-header-font-color: rgb(39 39 42);
    --wx-grid-body-font-color: rgb(39 39 42);
    --wx-timescale-font-color: rgb(82 82 91);
  }
  
  :global(.gantt-container .wx-willow-dark-theme) {
    --wx-gantt-task-color: rgb(var(--accent));
    --wx-gantt-project-color: #00ba94;
    --wx-gantt-border: 1px solid rgb(63 63 70 / 0.5);
    --wx-grid-header-font-color: rgb(244 244 245);
    --wx-grid-body-font-color: rgb(244 244 245);
    --wx-timescale-font-color: rgb(161 161 170);
    --wx-gantt-holiday-background: rgb(39 39 42);
  }
</style>
