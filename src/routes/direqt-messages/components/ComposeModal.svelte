<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { XMark, PaperClip } from 'svelte-hero-icons';
  import Editor from '../../../components/Editor/Editor.svelte';
  import { onMount } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { seqtaFetch, uploadSeqtaFile } from '../../../utils/netUtil';
  import { open } from '@tauri-apps/plugin-dialog';
  import { sanitizeFilename } from '../../../utils/sanitization';
  import Modal from '$lib/components/Modal.svelte';
  import { queueAdd } from '$lib/services/idb';
  import Input from '$lib/components/ui/Input.svelte';
  import { Label } from '$lib/components/ui/label';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../../lib/i18n';
  import { toastStore } from '../../../lib/stores/toast';

  function clickOutside(node: HTMLElement, onOutside: () => void) {
    const handler = (e: MouseEvent) => {
      if (!node.contains(e.target as Node)) onOutside?.();
    };
    document.addEventListener('mousedown', handler, true);
    return {
      destroy() {
        document.removeEventListener('mousedown', handler, true);
      },
    };
  }

  type Student = {
    campus: string;
    firstname: string;
    house: string;
    house_colour: string;
    id: number;
    rollgroup: string;
    'sub-school': string;
    surname: string;
    xx_display: string;
    year: string;
  };

  type Teacher = {
    id: number;
    firstname: string;
    surname: string;
    xx_display: string;
  };

  type Participant = {
    staff: boolean;
    id: number;
    name: string;
    meta?: string; // e.g., Year, class, campus
    color?: string; // e.g., house colour for students
  };

  let { showComposeModal, composeSubject, composeBody, closeModal } = $props<{
    showComposeModal: boolean;
    composeSubject: string;
    composeBody: string;
    closeModal: () => void;
  }>();

  let students = $state<Student[]>([]);
  let staff = $state<Teacher[]>([]);
  let loadingStudents = $state(false);
  let loadingStaff = $state(false);
  let errorMessage = $state('');

  let selectedRecipients = $state<Participant[]>([]);
  let useBCC = $state(false);

  let studentSearchQuery = $state('');
  let staffSearchQuery = $state('');
  let showStudentDropdown = $state(false);
  let showStaffDropdown = $state(false);
  let isSubmitting = $state(false);
  let studentsEnabled = $state(true);

  type AttachedFile = {
    id: number;
    filename: string;
    size?: string;
  };
  let attachedFiles = $state<AttachedFile[]>([]);
  let uploadingFiles = $state(false);

  function studentMatches(s: Student, q: string) {
    const hay =
      `${s.xx_display} ${s.firstname} ${s.surname} ${s.year} ${s.rollgroup} ${s['sub-school']} ${s.house} ${s.campus}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function staffMatches(t: Teacher, q: string) {
    const hay = `${t.xx_display} ${t.firstname} ${t.surname}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  const filteredStudents = $derived(
    students.filter((s) => studentMatches(s, studentSearchQuery)).slice(0, 50),
  );

  const filteredStaff = $derived(
    staff.filter((t) => staffMatches(t, staffSearchQuery)).slice(0, 50),
  );

  async function loadRecipients() {
    try {
      loadingStudents = true;
      loadingStaff = true;

      const studentsRes = await seqtaFetch('/seqta/student/load/message/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'student' },
      });

      const staffRes = await seqtaFetch('/seqta/student/load/message/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'staff' },
      });

      const studentsData = typeof studentsRes === 'string' ? JSON.parse(studentsRes) : studentsRes;
      const staffData = typeof staffRes === 'string' ? JSON.parse(staffRes) : staffRes;

      students = studentsData.payload || [];
      staff = staffData.payload || [];

      console.log('Loaded students:', students.length);
      console.log('Loaded staff:', staff.length);
    } catch (err) {
      console.error('Failed to load recipients:', err);
      errorMessage =
        $_('messages.failed_to_load_recipients') || 'Failed to load recipients. Please try again.';
    } finally {
      loadingStudents = false;
      loadingStaff = false;
    }
  }

  function addRecipient(id: number, name: string, isStaff: boolean, meta?: string, color?: string) {
    if (!selectedRecipients.some((r) => r.id === id && r.staff === isStaff)) {
      selectedRecipients = [...selectedRecipients, { id, staff: isStaff, name, meta, color }];
    }

    if (isStaff) {
      staffSearchQuery = '';
      showStaffDropdown = false;
    } else {
      studentSearchQuery = '';
      showStudentDropdown = false;
    }
  }

  function removeRecipient(index: number) {
    selectedRecipients = selectedRecipients.filter((_, i) => i !== index);
  }

  async function handleAddFiles() {
    try {
      uploadingFiles = true;
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'All Files',
            extensions: ['*'],
          },
        ],
      });

      if (!selected) {
        uploadingFiles = false;
        return;
      }

      const files = Array.isArray(selected) ? selected : [selected];

      for (const filePath of files) {
        let fileName = filePath.split(/[/\\]/).pop() || 'unknown';
        fileName = sanitizeFilename(fileName);

        try {
          const uploadResponse = await uploadSeqtaFile(fileName, filePath);
          const uploadResult = JSON.parse(uploadResponse);

          if (uploadResult.status === '200' && uploadResult.payload) {
            attachedFiles = [
              ...attachedFiles,
              {
                id: uploadResult.payload.id,
                filename: fileName,
                size: uploadResult.payload.size,
              },
            ];
            toastStore.success(`File "${fileName}" added`);
          } else {
            toastStore.error(`Failed to upload "${fileName}"`);
          }
        } catch (e) {
          toastStore.error(`Failed to upload "${fileName}"`);
        }
      }
    } catch (e) {
      toastStore.error('Failed to select files');
    } finally {
      uploadingFiles = false;
    }
  }

  function removeFile(index: number) {
    attachedFiles = attachedFiles.filter((_, i) => i !== index);
  }

  function formatFileSize(bytes: string | undefined): string {
    if (!bytes) return '';
    const numBytes = parseInt(bytes, 10);
    if (isNaN(numBytes)) return bytes;

    if (numBytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(numBytes) / Math.log(k));
    return parseFloat((numBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async function sendMessage() {
    if (!composeSubject.trim() || !composeBody.trim() || selectedRecipients.length === 0) {
      return;
    }

    try {
      isSubmitting = true;
      const participants = selectedRecipients.map(({ staff, id }) =>
        staff ? { staff: true, id } : { student: true, id },
      );

      const fileIds = attachedFiles.map((f) => f.id);

      const response = await seqtaFetch('/seqta/student/save/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          subject: composeSubject,
          contents: composeBody,
          participants: participants,
          blind: useBCC,
          files: fileIds,
        },
      });

      const responseData = typeof response === 'string' ? JSON.parse(response) : response;

      if (responseData && responseData.status === '200') {
        selectedRecipients = [];
        composeSubject = '';
        composeBody = '';
        attachedFiles = [];
        closeModal();
        toastStore.success('Message sent successfully');
      } else {
        errorMessage = $_('messages.failed_to_send') || 'Failed to send message. Please try again.';
        toastStore.error('Failed to send message');
      }
    } catch (err) {
      // Offline or failed: queue draft for later sync
      await queueAdd({
        type: 'message_draft',
        payload: {
          subject: composeSubject,
          contents: composeBody,
          recipients: selectedRecipients,
          blind: useBCC,
          files: attachedFiles.map((f) => f.id),
        },
      });
      closeModal();
      errorMessage = '';
      toastStore.info('Message queued for sending when online');
    } finally {
      isSubmitting = false;
    }
  }

  onMount(() => {
    loadRecipients();

    // Fetch settings to determine if student messaging is enabled
    seqtaFetch('/seqta/student/load/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {},
    })
      .then((res) => {
        const data = typeof res === 'string' ? JSON.parse(res) : res;
        if (data?.payload?.['coneqt-s.messages.students.enabled']?.value === 'disabled') {
          studentsEnabled = false;
        } else {
          studentsEnabled = true;
        }
      })
      .catch(() => {
        studentsEnabled = true; // fallback to enabled if error
      });
    return () => {};
  });
</script>

<Modal
  bind:open={showComposeModal}
  onclose={closeModal}
  maxWidth="w-[95vw] sm:w-[90vw]"
  maxHeight="max-h-[90vh]"
  className="rounded-2xl max-w-none shadow-2xl flex flex-col border border-white/20 dark:border-zinc-700/40 overflow-hidden h-[85vh] sm:h-[88vh] p-0 backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80"
  showCloseButton={false}
  ariaLabel="Compose message">
  <!-- Header -->
  <div
    class="flex justify-between items-center px-5 py-4 border-b sm:rounded-t-2xl border-zinc-200/60 dark:border-zinc-700/60 bg-transparent">
    <h2 class="text-xl font-semibold text-zinc-900 dark:text-white">
      <T key="messages.compose_message" fallback="Compose message" />
    </h2>
    <button
      class="p-2 rounded-lg transition-all duration-200 text-zinc-900 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 dark:text-white"
      onclick={closeModal}
      aria-label={$_('common.close') || 'Close'}>
      <Icon src={XMark} class="w-6 h-6" />
    </button>
  </div>

  <!-- Main content: two columns -->
  <div class="flex overflow-hidden flex-col flex-1 sm:flex-row">
    <!-- Main (left) column -->
    <div class="flex flex-col flex-1 min-w-0">
      {#if errorMessage}
        <div
          class="p-3 m-4 text-white bg-red-500 rounded-lg transition-all duration-200"
          transition:scale={{ duration: 200, easing: cubicInOut }}>
          {errorMessage}
          <button
            class="float-right font-bold transition-transform duration-200 ease-in-out hover:scale-110 active:scale-95"
            onclick={() => (errorMessage = '')}
            aria-label="Dismiss error">×</button>
        </div>
      {/if}

      <!-- Subject -->
      <div
        class="px-5 py-4 border-b space-y-2 border-zinc-200/60 dark:border-zinc-700/60 bg-transparent">
        <Label for="subject"><T key="messages.subject" fallback="Subject" /></Label>
        <Input
          id="subject"
          placeholder={$_('messages.subject_placeholder') || 'Subject...'}
          bind:value={composeSubject}
          size="lg"
          fullWidth />
      </div>

      <!-- Editor -->
      <div class="overflow-y-auto flex-1 p-4">
        <Editor bind:content={composeBody} />
      </div>
    </div>

    <!-- Sidebar (right) column -->
    <div
      class="flex flex-col w-full sm:w-[360px] min-w-0 sm:min-w-[320px] sm:max-w-[400px] border-t sm:border-t-0 sm:border-l border-zinc-200/60 dark:border-zinc-700/60 bg-transparent p-4 gap-4">
      <!-- Student selector (conditionally rendered) -->
      {#if studentsEnabled}
        <div class="relative mb-2 space-y-2" use:clickOutside={() => (showStudentDropdown = false)}>
          <Label for="student-search"
            ><T key="messages.select_student" fallback="Select student" /></Label>
          <Input
            id="student-search"
            type="search"
            placeholder={$_('messages.search_students_placeholder') ||
              'Search students by name, class, house, campus...'}
            bind:value={studentSearchQuery}
            onfocus={() => {
              showStudentDropdown = true;
              showStaffDropdown = false;
            }}
            onkeydown={(e) => {
              if (e.key === 'Escape') showStudentDropdown = false;
            }}
            fullWidth />
          {#if showStudentDropdown}
            <div
              id="student-dropdown"
              class="overflow-y-auto absolute z-10 mt-1 w-full max-h-72 bg-white rounded-lg border shadow-lg border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700"
              transition:fly={{ y: -8, duration: 200, opacity: 0, easing: (t) => t * (2 - t) }}>
              {#if loadingStudents}
                <div class="p-3 text-center text-zinc-600 dark:text-zinc-400">
                  <T key="messages.loading_students" fallback="Loading students..." />
                </div>
              {:else if filteredStudents.length === 0}
                <div class="p-3 text-center text-zinc-600 dark:text-zinc-400">
                  {studentSearchQuery
                    ? $_('messages.no_matching_students') || 'No matching students'
                    : $_('messages.type_to_search_students') || 'Type to search students'}
                </div>
              {:else}
                {#each filteredStudents as student}
                  <button
                    class="flex items-start gap-3 px-4 py-2 w-full text-left text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all duration-200 ease-in-out transform hover:scale-[1.01] active:scale-[0.99]"
                    onclick={() =>
                      addRecipient(
                        student.id,
                        student.xx_display,
                        false,
                        `Year ${student.year}${student.rollgroup ? ` · Class ${student.rollgroup}` : ''}${student['sub-school'] ? ` · ${student['sub-school']}` : ''}${student.campus ? ` · ${student.campus}` : ''}`,
                        student.house_colour,
                      )}>
                    {#if student.house_colour}
                      <span
                        class="mt-1 inline-block w-2.5 h-2.5 rounded-full border border-black/5"
                        style={`background-color: ${student.house_colour}`}></span>
                    {/if}
                    <div class="min-w-0">
                      <div class="truncate font-medium">{student.xx_display}</div>
                      <div class="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400 truncate">
                        Year {student.year}
                        {#if student.rollgroup}
                          · Class {student.rollgroup}
                        {/if}
                        {#if student['sub-school']}
                          · {student['sub-school']}
                        {/if}
                        {#if student.campus}
                          · {student.campus}
                        {/if}
                        {#if student.house}
                          · {student.house}
                        {/if}
                      </div>
                    </div>
                  </button>
                {/each}
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Staff selector -->
      <div class="relative mb-2 space-y-2" use:clickOutside={() => (showStaffDropdown = false)}>
        <Label for="staff-search"><T key="messages.select_staff" fallback="Select staff" /></Label>
        <Input
          id="staff-search"
          type="search"
          placeholder={$_('messages.search_staff_placeholder') || 'Search staff by name...'}
          bind:value={staffSearchQuery}
          onfocus={() => {
            showStaffDropdown = true;
            showStudentDropdown = false;
          }}
          onkeydown={(e) => {
            if (e.key === 'Escape') showStaffDropdown = false;
          }}
          size="md"
          fullWidth />
        {#if showStaffDropdown}
          <div
            id="staff-dropdown"
            class="overflow-y-auto absolute z-10 mt-1 w-full max-h-72 bg-white rounded-lg border shadow-lg border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700"
            transition:fly={{ y: -8, duration: 200, opacity: 0, easing: (t) => t * (2 - t) }}>
            {#if loadingStaff}
              <div class="p-3 text-center text-zinc-600 dark:text-zinc-400">
                <T key="messages.loading_staff" fallback="Loading staff..." />
              </div>
            {:else if filteredStaff.length === 0}
              <div class="p-3 text-center text-zinc-600 dark:text-zinc-400">
                {staffSearchQuery
                  ? $_('messages.no_matching_staff') || 'No matching staff'
                  : $_('messages.type_to_search_staff') || 'Type to search staff'}
              </div>
            {:else}
              {#each filteredStaff as teacher}
                <button
                  class="px-4 py-2 w-full text-left text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all duration-200 ease-in-out transform hover:scale-[1.01] active:scale-[0.99]"
                  onclick={() => addRecipient(teacher.id, teacher.xx_display, true)}>
                  <div class="font-medium truncate">{teacher.xx_display}</div>
                </button>
              {/each}
            {/if}
          </div>
        {/if}
      </div>

      <!-- BCC Option -->
      <div class="flex items-center mb-2">
        <label class="flex items-center space-x-2 text-sm">
          <input
            type="checkbox"
            bind:checked={useBCC}
            class="text-blue-500 bg-white rounded-sm border-zinc-300 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700" />
          <span
            ><T
              key="messages.keep_private_bcc"
              fallback="Keep recipient list private (BCC)" /></span>
        </label>
      </div>

      <!-- Selected recipients -->
      <div
        class="rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-700">
        {#if selectedRecipients.length === 0}
          <div class="px-3 py-2 text-sm text-zinc-600 dark:text-zinc-500">
            <T key="messages.no_recipients_selected" fallback="No recipients selected" />
          </div>
        {:else}
          {#each selectedRecipients as recipient, i (recipient.id + (recipient.staff ? 'staff' : 'student'))}
            <div
              class="flex items-center gap-3 px-3 py-2 transition-all duration-200 ease-in-out"
              in:fly={{ y: -10, duration: 200, easing: cubicInOut }}
              out:fly={{ y: -10, duration: 150, easing: cubicInOut }}>
              {#if !recipient.staff && recipient.color}
                <span
                  class="w-2.5 h-2.5 rounded-full border border-black/5 transition-transform duration-200"
                  style={`background-color: ${recipient.color}`}></span>
              {/if}
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium truncate">{recipient.name}</span>
                  <span class="text-xs text-zinc-600 dark:text-zinc-400"
                    >{recipient.staff
                      ? $_('messages.staff') || 'Staff'
                      : $_('messages.student') || 'Student'}</span>
                </div>
                {#if recipient.meta}
                  <div class="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                    {recipient.meta}
                  </div>
                {/if}
              </div>
              <button
                onclick={() => removeRecipient(i)}
                class="ml-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95"
                aria-label={$_('messages.remove_recipient') || 'Remove recipient'}>×</button>
            </div>
          {/each}
        {/if}
      </div>
      {#if selectedRecipients.length > 0}
        <div class="flex justify-end mt-3">
          <button
            class="px-3 py-1.5 text-xs rounded-md bg-white/70 border border-zinc-300/60 text-zinc-700 hover:bg-white/90 dark:bg-zinc-800/70 dark:text-zinc-200 dark:border-zinc-700/60 dark:hover:bg-zinc-700/80"
            onclick={() => (selectedRecipients = [])}>
            <T key="messages.clear_all" fallback="Clear all" />
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Footer with actions -->
  <div
    class="flex flex-col gap-3 justify-between items-stretch px-5 py-4 border-t sm:flex-row sm:items-center border-zinc-200/60 dark:border-zinc-700/60 bg-transparent">
    <div class="flex flex-col gap-2">
      <button
        class="flex gap-2 items-center px-4 py-2 text-sm rounded-lg text-zinc-900 bg-white/70 border border-zinc-300/60 dark:text-white dark:bg-zinc-800/70 dark:border-zinc-700/60 hover:bg-white/90 dark:hover:bg-zinc-700/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        onclick={handleAddFiles}
        disabled={uploadingFiles}>
        {#if uploadingFiles}
          <div
            class="w-4 h-4 border-2 border-zinc-600 dark:border-zinc-400 border-t-transparent rounded-full animate-spin">
          </div>
          <span><T key="messages.uploading_files" fallback="Uploading..." /></span>
        {:else}
          <Icon src={PaperClip} class="w-4 h-4" />
          <span><T key="messages.add_files" fallback="Add files" /></span>
        {/if}
      </button>
      {#if attachedFiles.length > 0}
        <div class="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
          {#each attachedFiles as file, i (file.id)}
            <div
              class="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-300/50 dark:border-zinc-700/50 transition-all duration-200 ease-in-out"
              in:fly={{ y: -8, duration: 200, easing: cubicInOut }}
              out:fly={{ y: -8, duration: 150, easing: cubicInOut }}>
              <Icon src={PaperClip} class="w-3 h-3 text-zinc-600 dark:text-zinc-400 shrink-0" />
              <span class="flex-1 min-w-0 truncate text-zinc-700 dark:text-zinc-300"
                >{file.filename}</span>
              {#if file.size}
                <span class="text-zinc-500 dark:text-zinc-500 shrink-0"
                  >{formatFileSize(file.size)}</span>
              {/if}
              <button
                onclick={() => removeFile(i)}
                class="ml-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 shrink-0 transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95"
                aria-label="Remove file">×</button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
    <div class="flex flex-col gap-3 w-full sm:flex-row sm:w-auto">
      <button
        class="px-4 py-3 mb-2 w-full rounded-lg transition-colors sm:w-auto sm:mb-0 text-zinc-900 bg-white/70 border border-zinc-300/60 dark:text-white dark:bg-zinc-800/70 dark:border-zinc-700/60 hover:bg-white/90 dark:hover:bg-zinc-700/80 focus:outline-hidden focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
        onclick={closeModal}>
        <T key="common.cancel" fallback="Cancel" />
      </button>
      <button
        class="px-6 py-3 w-full text-white bg-accent-500 rounded-lg transition-all duration-200 sm:w-auto hover:bg-accent-600 focus:ring-2 focus:ring-accent-400 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!composeSubject.trim() ||
          !composeBody.trim() ||
          selectedRecipients.length === 0 ||
          isSubmitting}
        onclick={sendMessage}>
        {isSubmitting ? $_('messages.sending') || 'Sending...' : $_('messages.send') || 'Send'}
      </button>
    </div>
  </div>
</Modal>

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
