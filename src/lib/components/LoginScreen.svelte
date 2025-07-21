<script lang="ts">
  import { Window } from '@tauri-apps/api/window';
  import { Icon } from 'svelte-hero-icons';
  import { Minus, Square2Stack, XMark } from 'svelte-hero-icons';
  import { authService } from '$lib/services/authService';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { theme } from '$lib/stores/theme';
  import { tick } from 'svelte';

  // Remove jsQR import and add html5-qrcode import
  import { Html5Qrcode } from 'html5-qrcode';
  import { onMount } from 'svelte';

  interface Props {
    seqtaUrl: string;
    onStartLogin: () => void;
    onUrlChange: (url: string) => void;
  }

  let { seqtaUrl, onStartLogin, onUrlChange }: Props = $props();

  const appWindow = Window.getCurrent();
  
  let qrProcessing = $state(false);
  let qrError = $state('');
  let qrSuccess = $state('');
  let jwtExpiredError = $state(false);
  let showLiveScan = $state(false);
  let liveScanError = $state('');
  let html5QrLive: Html5Qrcode | null = null;
  let isMobile = $state(false);

  onMount(() => {
    const checkMobile = () => {
      const tauri_platform = import.meta.env.TAURI_ENV_PLATFORM;
      if (tauri_platform == "ios" || tauri_platform == "android") {
        isMobile = true;
      } else {
        isMobile = false;
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  });

  // Global error handler to catch JWT expiration errors
  function handleGlobalError(event: ErrorEvent) {
    if (event.error && typeof event.error === 'string' && event.error.includes('JWT token has expired')) {
      jwtExpiredError = true;
      qrError = '';
      qrSuccess = '';
      qrProcessing = false;
    }
  }

  // Add global error listener
  if (typeof window !== 'undefined') {
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason && typeof event.reason === 'string' && event.reason.includes('JWT token has expired')) {
        jwtExpiredError = true;
        qrError = '';
        qrSuccess = '';
        qrProcessing = false;
      }
    });
  }

  // Remove old QR file input logic and add new handler using html5-qrcode
  async function handleQrFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    // Always clear error/success/expired state on new file selection
    qrError = '';
    qrSuccess = '';
    jwtExpiredError = false;
    const file = input.files[0];
    console.debug('[QR] File selected:', file.name, 'type:', file.type, 'size:', file.size);
    qrProcessing = true;
    try {
      console.debug('[QR] Starting scan...');
      const html5Qr = new Html5Qrcode('qr-reader-temp');
      const qrCodeData = await html5Qr.scanFile(file, true);
      await html5Qr.clear();
      if (qrCodeData) {
        console.debug('[QR] Scan success:', qrCodeData);
        qrSuccess = 'QR code scanned successfully!';
        onUrlChange(qrCodeData);
      } else {
        console.warn('[QR] No QR code found in the image.');
        qrError = 'No QR code found in the image.';
      }
    } catch (err) {
      console.error('[QR] Failed to scan QR code:', err);
      let errorMsg = 'Failed to scan QR code. Please try a clearer image.';
      if (err && typeof err === 'object' && 'message' in err) {
        errorMsg += ' ' + (err as any).message;
      } else if (typeof err === 'string') {
        errorMsg += ' ' + err;
      }
      qrError = errorMsg;
    } finally {
      // Reset file input value so user can re-select the same file
      if (input) input.value = '';
      console.debug('[QR] Scan finished.');
      qrProcessing = false;
    }
  }

  async function startLiveScan() {
    liveScanError = '';
    jwtExpiredError = false;
    // Check for available cameras before opening modal
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        liveScanError = 'No camera found on this device.';
        showLiveScan = true;
        return;
      }
    } catch (err) {
      liveScanError = 'Unable to access camera. Please check browser permissions.';
      showLiveScan = true;
      return;
    }
    showLiveScan = true;
    await tick(); // Wait for modal DOM
    try {
      html5QrLive = new Html5Qrcode('qr-reader-live');
      await html5QrLive.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 300, height: 300 } },
        (decodedText) => {
          qrSuccess = 'QR code scanned successfully!';
          onUrlChange(decodedText);
          stopLiveScan();
        },
        (err) => {
          // Optionally log scan errors
        }
      );
    } catch (err) {
      liveScanError = 'Failed to start live scan. ' + (err && typeof err === 'object' && 'message' in err ? (err as any).message : err);
      console.error('[QR] Live scan error:', err);
    }
  }

  async function stopLiveScan() {
    if (html5QrLive) {
      await html5QrLive.stop();
      await html5QrLive.clear();
      html5QrLive = null;
    }
    showLiveScan = false;
  }
</script>

<div class="flex flex-col h-full">
  <!-- Window Controls Bar -->
  <div 
    class="flex justify-between items-center px-4 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200/60 dark:border-slate-700/60"
    data-tauri-drag-region>
    <!-- Draggable area with branding -->
    <div class="flex items-center space-x-3" data-tauri-drag-region>
      <img src="/betterseqta-dark-icon.png" alt="DesQTA" class="w-6 h-6 invert dark:invert-0" />
      <h1 class="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300">
        DesQTA
      </h1>
    </div>

    <!-- Window Controls -->
    {#if !isMobile}
      <div class="flex items-center space-x-2" data-tauri-drag-region>
        <button
          class="flex justify-center items-center w-8 h-8 rounded-lg transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
          onclick={() => appWindow.minimize()}
          aria-label="Minimize">
          <Icon src={Minus} class="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </button>
        <button
          class="flex justify-center items-center w-8 h-8 rounded-lg transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
          onclick={() => appWindow.toggleMaximize()}
          aria-label="Maximize">
          <Icon src={Square2Stack} class="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </button>
        <button
          class="flex justify-center items-center w-8 h-8 rounded-lg transition-all duration-200 group hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          onclick={() => appWindow.close()}
          aria-label="Close">
          <Icon src={XMark} class="w-4 h-4 transition duration-200 text-slate-600 dark:text-slate-400 group-hover:text-white" />
        </button>
      </div>
    {/if}
  </div>

  <!-- Login Content -->
  <div class="flex justify-center items-center p-6 flex-1">
    <div
      class="flex overflow-hidden flex-col w-full max-w-6xl rounded-3xl border shadow-2xl backdrop-blur-xl bg-white/80 border-slate-200/60 dark:bg-slate-900/80 dark:border-slate-700/60 md:flex-row animate-fade-in-up"
      style="box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
      <!-- Left side - Image and branding -->
      <div class="hidden relative md:block md:w-2/3">
        <div
          class="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 dark:from-indigo-500/10 dark:to-purple-500/10">
        </div>
        <img
          src="/images/signin.jpg"
          alt="Sign in"
          class="object-cover w-full h-full min-h-[600px]" />
        <div
          class="flex absolute inset-0 flex-col justify-end p-8 bg-gradient-to-t to-transparent from-black/50">
          <h1 class="mb-4 text-4xl font-bold text-white">Welcome to DesQTA</h1>
          <p class="text-lg text-slate-200">
            Experience SEQTA Learn like never before with our powerful desktop application
          </p>
        </div>
      </div>

      <!-- Right side - Login form -->
      <div class="flex flex-col justify-center p-8 w-full md:w-1/3 md:p-12">
        <div class="mb-8 text-center md:hidden">
          <h1 class="mb-2 text-3xl font-bold text-slate-900 dark:text-white">
            Welcome to DesQTA
          </h1>
          <p class="text-slate-600 dark:text-slate-300">
            Experience SEQTA Learn like never before with our powerful desktop application
          </p>
        </div>

        <div class="space-y-6">
          {#if !isMobile}
            <div>
              <label
                for="seqta-url"
                class="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                SEQTA URL
              </label>
              <div class="relative">
                <div
                  class="flex absolute inset-y-0 left-0 items-center pl-3 pointer-events-none">
                  <svg
                    class="w-5 h-5 text-slate-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor">
                    <path
                      fill-rule="evenodd"
                      d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
                      clip-rule="evenodd" />
                  </svg>
                </div>
                <input
                  id="seqta-url"
                  type="text"
                  bind:value={seqtaUrl}
                  oninput={(e) => {
                    const url = (e.target as HTMLInputElement).value;
                    onUrlChange(url);
                    
                    // Enable button if URL is entered and no JWT expiration error
                    const signinButton = document.getElementById('signin-button') as HTMLButtonElement;
                    if (url.trim() && !jwtExpiredError) {
                      signinButton.disabled = false;
                    } else if (!qrSuccess || jwtExpiredError) {
                      // Disable if no QR code was processed or JWT expired
                      signinButton.disabled = true;
                    }
                  }}
                  placeholder="your-school.seqta.com.au"
                  class="py-3 pr-4 pl-10 w-full rounded-lg border transition-colors text-slate-900 bg-slate-50 border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Enter your school's SEQTA URL to get started
              </p>
            </div>
          {/if}

          <div>
            <label
              for="seqta-qrcode"
              class="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              SEQTA QR Code
            </label>
            <div class="relative">
              <div
                class="flex absolute inset-y-0 left-0 items-center pl-3 pointer-events-none">
                <svg
                  class="w-5 h-5 text-slate-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
                    clip-rule="evenodd" />
                </svg>
              </div>
              <input
                id="seqta-qrcode"
                type="file"
                accept="image/*"
                class="py-3 pr-4 pl-10 w-full rounded-lg border transition-colors text-slate-900 bg-slate-50 border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                onchange={handleQrFileInput}
              />
              <div class="flex items-center my-2">
                <div class="flex-grow h-px bg-slate-200 dark:bg-slate-700"></div>
                <span class="mx-2 text-xs text-slate-400 dark:text-slate-500">or</span>
                <div class="flex-grow h-px bg-slate-200 dark:bg-slate-700"></div>
              </div>
              <button
                type="button"
                class="w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 accent-bg accent-ring text-white hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2"
                onclick={startLiveScan}
              >
                Scan QR Code Live
              </button>
            </div>
            <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Upload your SEQTA Login QR Code to get started from your mobile login email
            </p>
            
            {#if showLiveScan}
              <div class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 w-full max-w-md relative">
                  <button
                    class="absolute top-2 right-2 p-2 rounded-lg accent-bg accent-ring text-white hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2"
                    onclick={stopLiveScan}
                    aria-label="Close live scan modal"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                  <h2 class="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Scan QR Code Live</h2>
                  <div id="qr-reader-live" class="w-72 h-72 mx-auto rounded-lg overflow-hidden bg-black"></div>
                  {#if liveScanError}
                    <div class="mt-2 text-red-600 dark:text-red-400">{liveScanError}</div>
                  {/if}
                </div>
              </div>
            {/if}
            
            {#if qrProcessing}
              <div class="mt-2 text-sm text-blue-600 dark:text-blue-400">
                Processing QR code...
              </div>
            {/if}
            
            {#if qrSuccess}
              <div class="mt-2 text-sm text-green-600 dark:text-green-400">
                {qrSuccess}
              </div>
            {/if}
            
            {#if qrError}
              <div class="mt-2 text-sm text-red-600 dark:text-red-400">
                {qrError}
              </div>
            {/if}
            
            {#if jwtExpiredError}
              <div class="mt-2 p-3 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div class="flex items-start space-x-2">
                  <svg class="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  <div>
                    <p class="font-medium text-amber-800 dark:text-amber-200">QR Code Expired</p>
                    <p class="text-amber-700 dark:text-amber-300">The QR code from your mobile login email has expired. Please request a new QR code from your mobile device and try again.</p>
                  </div>
                </div>
              </div>
            {/if}
          </div>

          <button
            id="signin-button"
            class="py-3 w-full text-lg font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-lg transition-all duration-200 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed"
            onclick={() => {
              // Clear JWT expiration error when starting new login
              jwtExpiredError = false;
              onStartLogin();
            }}
            disabled={jwtExpiredError}>
            Sign In
          </button>

          <div class="text-center">
            <p class="text-sm text-slate-600 dark:text-slate-400">
              Need help? <a
                href="https://github.com/betterseqta/desqta"
                target="_blank"
                rel="noopener noreferrer"
                class="text-indigo-600 dark:text-indigo-400 hover:underline">Visit GitHub</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<div id="qr-reader-temp" style="display:none;"></div>