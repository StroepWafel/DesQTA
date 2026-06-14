<script lang="ts">
  import { Icon, ArrowRightOnRectangle, BookOpen } from 'svelte-hero-icons';
  import { fly } from 'svelte/transition';
  import { invoke } from '@tauri-apps/api/core';
  import { goto } from '$app/navigation';
  import { getRandomDicebearAvatar } from '../../utils/netUtil';
  import { onMount, onDestroy } from 'svelte';
  import ProfileSwitcher from './ProfileSwitcher.svelte';
  import { _ } from '../i18n';
  import T from './T.svelte';
  import { tooltip } from '$lib/actions/tooltip';

  interface UserInfo {
    clientIP: string;
    email: string;
    id: number;
    lastAccessedTime: number;
    meta: {
      code: string;
      governmentID: string;
    };
    personUUID: string;
    saml: [
      {
        autologin: boolean;
        label: string;
        method: string;
        request: string;
        sigalg: URL;
        signature: string;
        slo: boolean;
        url: URL;
      },
    ];
    status: string;
    type: string;
    userCode: string;
    userDesc: string;
    userName: string;
    displayName?: string;
    profilePicture?: string;
  }

  interface Props {
    userInfo: UserInfo | undefined | null;
    showUserDropdown: boolean;
    onToggleUserDropdown: () => void;
    onLogout: () => void;
    onShowAbout: () => void;
    onClickOutside: (event: MouseEvent) => void;
    disableSchoolPicture?: boolean;
  }

  let {
    userInfo,
    showUserDropdown,
    onToggleUserDropdown,
    onLogout,
    onShowAbout,
    onClickOutside,
    disableSchoolPicture = false,
  }: Props = $props();

  let devSensitiveInfoHider = $state(false);
  let randomAvatarUrl = $state('');
  let customProfilePicture = $state<string | null>(null);
  let customProfilePictureError = $state(false);
  let randomAvatarError = $state(false);
  let schoolPictureError = $state(false);

  // Load custom profile picture
  async function loadCustomProfilePicture() {
    try {
      const dataUrl = await invoke<string | null>('get_profile_picture_data_url');
      customProfilePicture = dataUrl;
    } catch (e) {
      customProfilePicture = null;
    }
  }

  let removeProfilePictureListener: (() => void) | null = null;

  onMount(async () => {
    try {
      const subset = await invoke<any>('get_settings_subset', {
        keys: ['dev_sensitive_info_hider'],
      });
      devSensitiveInfoHider = subset?.dev_sensitive_info_hider ?? false;
      if (devSensitiveInfoHider) {
        randomAvatarUrl = getRandomDicebearAvatar();
      }
    } catch (e) {
      devSensitiveInfoHider = false;
    }

    // Load custom profile picture
    await loadCustomProfilePicture();

    const onProfilePictureUpdated = () => loadCustomProfilePicture();
    window.addEventListener('profile-picture-updated', onProfilePictureUpdated);
    removeProfilePictureListener = () =>
      window.removeEventListener('profile-picture-updated', onProfilePictureUpdated);
  });

  onDestroy(() => removeProfilePictureListener?.());

  // Close dropdown when userInfo becomes undefined (except we keep it open for sign-out option)
  // Only close if we had userInfo and now we don't - but we still render the button for sign-out
  const hasValidSession = $derived(!!userInfo);

  // When mock is on, always show fake name - never expose real student name
  const displayName = $derived(
    devSensitiveInfoHider ? 'Demo Student' : (userInfo?.userDesc || userInfo?.userName || '?')
  );
  const displayInitial = $derived(
    devSensitiveInfoHider ? 'D' : (userInfo?.displayName || userInfo?.userName || '?')[0]
  );
  const userMenuTip = $derived({
    text: $_('user.user_menu') || 'User menu — account, profiles, and sign out',
    placement: 'bottom' as const,
    delay: 350,
  });
</script>

<div class="relative user-dropdown-container">
  <button
    data-onboarding="user-dropdown"
    class="flex gap-2.5 items-center pl-1.5 pr-2.5 md:pr-3 h-10 rounded-lg text-foreground hover:bg-surface-muted transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1 md:size-auto size-10 justify-center md:justify-start"
    onclick={onToggleUserDropdown}
    aria-label={$_('user.user_menu') || 'User menu'}
    use:tooltip={userMenuTip}
    tabindex="0">
    {#if userInfo}
      {#if customProfilePicture && !customProfilePictureError}
        <img
          src={customProfilePicture}
          alt=""
          onerror={() => (customProfilePictureError = true)}
          class="object-cover w-7 h-7 rounded-full" />
      {:else if devSensitiveInfoHider && randomAvatarUrl && !randomAvatarError}
        <img
          src={randomAvatarUrl}
          alt=""
          onerror={() => (randomAvatarError = true)}
          class="object-cover w-7 h-7 rounded-full" />
      {:else if !disableSchoolPicture && userInfo.profilePicture && !schoolPictureError}
        <img
          src={userInfo.profilePicture}
          alt=""
          onerror={() => (schoolPictureError = true)}
          class="object-cover w-7 h-7 rounded-full" />
      {:else}
        <div
          class="flex items-center justify-center w-7 h-7 rounded-full bg-surface-3 text-foreground font-semibold text-sm">
          {displayInitial}
        </div>
      {/if}
      <span class="hidden font-medium text-sm text-foreground md:inline">
        {displayName}
      </span>
    {:else}
      <!-- Session invalid: show placeholder so user can still access Sign out -->
      <div
        class="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold text-sm">
        ?
      </div>
      <span class="hidden font-medium text-sm text-amber-700 dark:text-amber-300 md:inline">
        {$_('user.session_expired', { default: 'Session expired' })}
      </span>
    {/if}
  </button>
  {#if showUserDropdown}
    <div
      class="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-popover text-popover-foreground shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18),0_2px_8px_-4px_rgba(0,0,0,0.08)]"
      transition:fly={{ y: -4, duration: 150, opacity: 0, easing: (t) => t * (2 - t) }}>
      <div class="p-1.5">
        {#if userInfo}
        <button
          class="flex gap-3 items-center min-h-[42px] px-3 py-2 w-full text-left rounded-md transition-colors duration-150 text-foreground hover:bg-surface-muted"
          onclick={() => {
            onToggleUserDropdown();
            onShowAbout();
          }}>
          <div class="flex justify-center items-center w-8 h-8 rounded-md bg-surface-muted text-muted-foreground">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium"><T key="user.about" fallback="About" /></div>
            <div class="text-[11px] text-muted-foreground">
              <T key="user.app_information" fallback="App information" />
            </div>
          </div>
        </button>

        <button
          class="flex gap-3 items-center min-h-[42px] px-3 py-2 w-full text-left rounded-md transition-colors duration-150 text-foreground hover:bg-surface-muted"
          onclick={() => {
            onToggleUserDropdown();
            goto('/user-documentation');
          }}>
          <div class="flex justify-center items-center w-8 h-8 rounded-md bg-surface-muted text-muted-foreground">
            <Icon src={BookOpen} class="w-4 h-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium"><T key="user.get_help" fallback="Get Help" /></div>
            <div class="text-[11px] text-muted-foreground">
              <T key="user.user_guide_faq" fallback="User guide & FAQ" />
            </div>
          </div>
        </button>

        <div class="my-1.5 border-t border-border-subtle"></div>

        <div>
          <ProfileSwitcher
            onProfileSwitch={() => {
              onToggleUserDropdown();
              window.location.reload();
            }}
          />
        </div>
        {/if}

        <!-- Sign out: always visible (including when session invalid) -->
        <div class="my-1.5 border-t border-border-subtle"></div>
        <button
          class="flex gap-3 items-center min-h-[42px] px-3 py-2 w-full text-left rounded-md transition-colors duration-150 text-foreground hover:bg-surface-muted"
          onclick={() => {
            onToggleUserDropdown();
            onLogout();
          }}>
          <div class="flex justify-center items-center w-8 h-8 rounded-md bg-surface-muted text-muted-foreground">
            <Icon src={ArrowRightOnRectangle} class="w-4 h-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium"><T key="user.sign_out" fallback="Sign out" /></div>
            <div class="text-[11px] text-muted-foreground">
              <T key="user.end_session" fallback="End your session" />
            </div>
          </div>
        </button>

        <div class="my-1.5 border-t border-border-subtle"></div>

        <button
          class="flex gap-3 items-center min-h-[42px] px-3 py-2 w-full text-left rounded-md transition-colors duration-150 text-destructive hover:bg-destructive/10"
          onclick={() => {
            onToggleUserDropdown();
            invoke('quit');
          }}>
          <div class="flex justify-center items-center w-8 h-8 rounded-md bg-destructive/10 text-destructive">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium"><T key="user.quit_app" fallback="Quit DesQTA" /></div>
            <div class="text-[11px] text-destructive/80">
              <T key="user.close_application" fallback="Close the application" />
            </div>
          </div>
        </button>
      </div>
    </div>
  {/if}
</div>
