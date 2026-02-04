<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import {
    SeqtaMentionsServiceRust as SeqtaMentionsService,
    type SeqtaMentionItem,
  } from '../../../services/seqtaMentionsServiceRust';
  import {
    Icon,
    Clock,
    MapPin,
    User,
    Calendar,
    AcademicCap,
    DocumentText,
    Link,
    XMark,
  } from 'svelte-hero-icons';
  import { goto } from '$app/navigation';
  import WeeklyScheduleEmbed from './WeeklyScheduleEmbed.svelte';
  import LessonContentEmbed from './LessonContentEmbed.svelte';
  import { logger } from '../../../../utils/logger';

  interface Props {
    open: boolean;
    mentionId: string;
    mentionType: string;
    title: string;
    subtitle: string;
    data?: any;
    onclose?: () => void;
  }

  let {
    open = $bindable(false),
    mentionId,
    mentionType,
    title,
    subtitle,
    data: storedData,
    onclose,
  }: Props = $props();

  let mentionData: SeqtaMentionItem | null = $state(null);
  let loading = $state(true);
  let relatedItems: SeqtaMentionItem[] = $state([]);

  $effect(() => {
    if (open) {
      loadMentionData();
    }
  });

  async function loadMentionData() {
    loading = true;
    try {
      // Normalize mention type - if it's 'seqtaMention', try to infer from ID
      let normalizedType = mentionType;
      if (mentionType === 'seqtaMention' || !mentionType) {
        if (mentionId.startsWith('assessment-')) {
          normalizedType = 'assessment';
        } else if (mentionId.startsWith('assignment-')) {
          normalizedType = 'assignment';
        } else if (mentionId.startsWith('timetable-slot-')) {
          normalizedType = 'timetable_slot';
        } else if (mentionId.startsWith('timetable-')) {
          normalizedType = 'timetable';
        } else if (mentionId.startsWith('subject-')) {
          normalizedType = 'subject';
        } else if (mentionId.startsWith('notice-')) {
          normalizedType = 'notice';
        } else if (mentionId.startsWith('homework-')) {
          normalizedType = 'homework';
        } else if (mentionId.startsWith('teacher-')) {
          normalizedType = 'teacher';
        } else if (
          mentionId.includes('-') &&
          !mentionId.startsWith('assessment-') &&
          !mentionId.startsWith('assignment-')
        ) {
          // Likely a class (programme-metaclass format)
          normalizedType = 'class';
        }
      }

      logger.debug('SeqtaMentionDetailModal', 'loadMentionData', 'Loading mention data', {
        mentionId,
        originalType: mentionType,
        normalizedType,
      });

      const data = await SeqtaMentionsService.updateMentionData(mentionId, normalizedType, {
        data: storedData,
      });
      mentionData = data;

      // Load related items based on type
      if (data?.data) {
        await loadRelatedItems(data);
      }
    } catch (e) {
      logger.error('SeqtaMentionDetailModal', 'loadMentionData', 'Failed to load mention details', {
        error: e instanceof Error ? e.message : String(e),
        mentionId,
        mentionType,
      });
    } finally {
      loading = false;
    }
  }

  async function loadRelatedItems(data: SeqtaMentionItem) {
    try {
      const normalizedType =
        mentionType === 'seqtaMention' ? data.type || mentionType : mentionType;
      if (normalizedType === 'class' || normalizedType === 'subject') {
        // Load assessments for this subject
        const assessments = await SeqtaMentionsService.searchMentions(data.data?.code || '');
        relatedItems = assessments.filter(
          (item) => item.type === 'assessment' || item.type === 'assignment',
        );
      }
    } catch (e) {
      logger.error('SeqtaMentionDetailModal', 'loadRelatedItems', 'Failed to load related items', {
        error: e instanceof Error ? e.message : String(e),
        mentionId,
        mentionType,
      });
    }
  }

  function formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function formatTime(timeString: string | undefined): string {
    if (!timeString) return '';
    // Handle both "HH:MM" and "YYYY-MM-DDTHH:MM:SS" formats
    let time = timeString;
    if (timeString.includes('T')) {
      time = new Date(timeString).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (timeString.length === 5 && timeString.includes(':')) {
      // Already in HH:MM format, convert to 12-hour
      const [hours, minutes] = timeString.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12;
      time = `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
    }
    return time;
  }

  function getStatusBadge(data: any): { text: string; color: string; bgColor: string } | null {
    if (!data) return null;

    if (data.dueDate || data.due) {
      const dueDate = new Date(data.dueDate || data.due);
      const now = new Date();
      const diffMs = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        return {
          text: 'Overdue',
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
        };
      } else if (diffDays <= 1) {
        return {
          text: 'Due Soon',
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        };
      } else if (diffDays <= 7) {
        return {
          text: 'Upcoming',
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        };
      }
    }

    if (data.status === 'overdue') {
      return {
        text: 'Overdue',
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
      };
    }

    return null;
  }

  function openInApp() {
    if (!mentionData?.data) return;

    if (mentionType === 'assessment' || mentionType === 'assignment') {
      const assessmentID = mentionData.data.assessmentID || mentionData.data.id;
      const metaclassID = mentionData.data.metaclassID || mentionData.data.metaclass || 0;
      const code = mentionData.data.code || mentionData.data.subjectCode;
      const dueDate = mentionData.data.dueDate || mentionData.data.due;

      // Try to get year from data, fallback to due date year, then current year
      let year: number;
      if (mentionData.data.year) {
        year = mentionData.data.year;
      } else if (dueDate) {
        try {
          const date = new Date(dueDate);
          if (!isNaN(date.getTime())) {
            year = date.getFullYear();
          } else {
            year = new Date().getFullYear();
          }
        } catch {
          year = new Date().getFullYear();
        }
      } else {
        year = new Date().getFullYear();
      }

      if (assessmentID) {
        // Navigate to assessment detail page with year parameter
        goto(`/assessments/${assessmentID}/${metaclassID}?year=${year}`);
      } else if (code && dueDate) {
        const dateStr = new Date(dueDate).toISOString().split('T')[0];
        goto(`/assessments?code=${code}&date=${dateStr}&year=${year}`);
      } else {
        goto('/assessments');
      }
    } else if (mentionType === 'class' || mentionType === 'subject') {
      const code = mentionData.data.code;
      const programme = mentionData.data.programme;
      const metaclass = mentionData.data.metaclass;
      const date = mentionData.data.date || mentionData.data.lessonDate;

      if (programme && metaclass) {
        let url = `/courses?code=${code}&programme=${programme}&metaclass=${metaclass}`;
        if (date) {
          const dateStr = new Date(date).toISOString().split('T')[0];
          url += `&date=${dateStr}`;
        }
        goto(url);
      } else if (code) {
        goto(`/courses?code=${code}`);
      } else {
        goto('/courses');
      }
    } else if (mentionType === 'timetable' || mentionType === 'timetable_slot') {
      const date = mentionData.data.date;
      if (date) {
        const dateStr = new Date(date).toISOString().split('T')[0];
        goto(`/timetable?date=${dateStr}`);
      } else {
        goto('/timetable');
      }
    } else if (mentionType === 'notice') {
      const noticeId = mentionData.data.id || mentionData.data.noticeId;
      const labelId = mentionData.data.labelId || mentionData.data.label;
      const date = mentionData.data.date;

      let url = '/notices';
      const params: string[] = [];
      if (noticeId) params.push(`item=${noticeId}`);
      if (labelId) params.push(`category=${labelId}`);
      if (date) {
        const dateStr = new Date(date).toISOString().split('T')[0];
        params.push(`date=${dateStr}`);
      }
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      goto(url);
    }
    closeModal();
  }

  function closeModal() {
    open = false;
    onclose?.();
  }
</script>

<Modal bind:open onclose={closeModal} maxWidth="max-w-2xl" ariaLabel="SEQTA Mention Details">
  <div class="p-6 max-h-[85vh] overflow-y-auto">
    {#if loading}
      <div class="flex items-center justify-center py-12">
        <div class="w-8 h-8 rounded-full border-2 border-zinc-300 border-t-blue-600 animate-spin">
        </div>
      </div>
    {:else if mentionData}
      {@const badge = getStatusBadge(mentionData.data)}
      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-start justify-between gap-4 mb-3">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <h2 class="text-2xl font-bold text-zinc-900 dark:text-white">{title}</h2>
              {#if badge}
                <span
                  class="px-2.5 py-1 rounded-lg text-xs font-medium {badge.color} {badge.bgColor}">
                  {badge.text}
                </span>
              {/if}
            </div>
            <p class="text-lg text-zinc-600 dark:text-zinc-400">{subtitle}</p>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            onclick={openInApp}>
            <Icon src={Link} class="w-4 h-4" />
            Open in App
          </button>
        </div>
      </div>

      <!-- Details Section -->
      <div class="space-y-4 mb-6">
        <h3 class="text-lg font-semibold text-zinc-900 dark:text-white">Details</h3>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {#if mentionData.data.dueDate || mentionData.data.due}
            <div
              class="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
              <Icon
                src={Clock}
                class="w-5 h-5 text-zinc-500 dark:text-zinc-400 mt-0.5 flex-shrink-0" />
              <div>
                <div class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">
                  Due Date
                </div>
                <div class="text-sm font-medium text-zinc-900 dark:text-white">
                  {formatDate(mentionData.data.dueDate || mentionData.data.due)}
                </div>
                {#if mentionData.data.dueDate || mentionData.data.due}
                  <div class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {formatTime(mentionData.data.dueDate || mentionData.data.due)}
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          {#if mentionData.data.teacher}
            <div
              class="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
              <Icon
                src={User}
                class="w-5 h-5 text-zinc-500 dark:text-zinc-400 mt-0.5 flex-shrink-0" />
              <div>
                <div class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">
                  Teacher
                </div>
                <div class="text-sm font-medium text-zinc-900 dark:text-white">
                  {mentionData.data.teacher}
                </div>
              </div>
            </div>
          {/if}

          {#if mentionData.data.room}
            <div
              class="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
              <Icon
                src={MapPin}
                class="w-5 h-5 text-zinc-500 dark:text-zinc-400 mt-0.5 flex-shrink-0" />
              <div>
                <div class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">Room</div>
                <div class="text-sm font-medium text-zinc-900 dark:text-white">
                  {mentionData.data.room}
                </div>
              </div>
            </div>
          {/if}

          {#if mentionData.data.subject || mentionData.data.code || mentionData.data.subjectName}
            <div
              class="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
              <Icon
                src={AcademicCap}
                class="w-5 h-5 text-zinc-500 dark:text-zinc-400 mt-0.5 shrink-0" />
              <div>
                <div class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">
                  Subject
                </div>
                <div class="text-sm font-medium text-zinc-900 dark:text-white">
                  {mentionData.data.subjectName ||
                    mentionData.data.subject ||
                    mentionData.data.code}
                </div>
              </div>
            </div>
          {/if}

          {#if mentionData.data.from || mentionData.data.from12}
            <div
              class="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
              <Icon src={Clock} class="w-5 h-5 text-zinc-500 dark:text-zinc-400 mt-0.5 shrink-0" />
              <div>
                <div class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">Time</div>
                <div class="text-sm font-medium text-zinc-900 dark:text-white">
                  {mentionData.data.from12 || formatTime(mentionData.data.from)} - {mentionData.data
                    .until12 || formatTime(mentionData.data.until)}
                </div>
              </div>
            </div>
          {/if}

          {#if mentionData.data.date}
            <div
              class="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
              <Icon
                src={Calendar}
                class="w-5 h-5 text-zinc-500 dark:text-zinc-400 mt-0.5 shrink-0" />
              <div>
                <div class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">Date</div>
                <div class="text-sm font-medium text-zinc-900 dark:text-white">
                  {formatDate(mentionData.data.date)}
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Description -->
        {#if mentionData.data.description || mentionData.data.content}
          <div
            class="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <div class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
              {mentionType === 'notice' ? 'Content' : 'Description'}
            </div>
            <div
              class="text-sm text-zinc-900 dark:text-white whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
              {#if mentionType === 'notice' && mentionData.data.content}
                {@html mentionData.data.content}
              {:else}
                {mentionData.data.description || mentionData.data.content}
              {/if}
            </div>
          </div>
        {/if}

        <!-- Notice Author -->
        {#if mentionData.data.author && mentionType === 'notice'}
          <div
            class="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <Icon src={User} class="w-5 h-5 text-zinc-500 dark:text-zinc-400 mt-0.5 shrink-0" />
            <div>
              <div class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">Author</div>
              <div class="text-sm font-medium text-zinc-900 dark:text-white">
                {mentionData.data.author}
              </div>
            </div>
          </div>
        {/if}

        <!-- Timetable Lessons -->
        {#if mentionData.data.lessons && mentionData.data.lessons.length > 0}
          <div>
            <div class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
              Upcoming Lessons
            </div>
            <div class="space-y-2">
              {#each mentionData.data.lessons.slice(0, 5) as lesson}
                <div
                  class="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                  <div class="flex items-center gap-3">
                    <Icon src={Calendar} class="w-4 h-4 text-zinc-400" />
                    <div>
                      <div class="text-sm font-medium text-zinc-900 dark:text-white">
                        {formatDate(lesson.date)}
                      </div>
                      <div class="text-xs text-zinc-500 dark:text-zinc-400">
                        {lesson.from} - {lesson.until}
                        {#if lesson.room}
                          • Room {lesson.room}
                        {/if}
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Weekly Schedule Embed (for classes/subjects) -->
        {#if (mentionType === 'class' || mentionType === 'subject') && mentionData.data.programme && mentionData.data.metaclass}
          <div class="mt-4">
            <WeeklyScheduleEmbed
              programme={mentionData.data.programme}
              metaclass={mentionData.data.metaclass}
              code={mentionData.data.code}
              {title} />
          </div>
        {/if}

        <!-- Lesson Content Embed (for classes/subjects with lesson data) -->
        {#if (mentionType === 'class' || mentionType === 'subject') && mentionData.data.programme && mentionData.data.metaclass && mentionData.data.lessons && mentionData.data.lessons.length > 0}
          <div class="mt-4">
            <LessonContentEmbed
              programme={mentionData.data.programme}
              metaclass={mentionData.data.metaclass}
              title={mentionData.data.code || title} />
          </div>
        {/if}
      </div>

      <!-- Related Items -->
      {#if relatedItems.length > 0}
        <div class="pt-6 border-t border-zinc-200 dark:border-zinc-700">
          <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Related Items</h3>
          <div class="space-y-2">
            {#each relatedItems.slice(0, 5) as item}
              <div
                role="button"
                tabindex="0"
                class="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                onclick={() => {
                  mentionId = item.id;
                  mentionType = item.type;
                  title = item.title;
                  subtitle = item.subtitle;
                  loadMentionData();
                }}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    mentionId = item.id;
                    mentionType = item.type;
                    title = item.title;
                    subtitle = item.subtitle;
                    loadMentionData();
                  }
                }}>
                <div>
                  <div class="text-sm font-medium text-zinc-900 dark:text-white">{item.title}</div>
                  <div class="text-xs text-zinc-500 dark:text-zinc-400">{item.subtitle}</div>
                </div>
                <Icon src={Link} class="w-4 h-4 text-zinc-400" />
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {:else}
      <div class="text-center py-12">
        <p class="text-zinc-500 dark:text-zinc-400">Failed to load mention details</p>
      </div>
    {/if}
  </div>
</Modal>
