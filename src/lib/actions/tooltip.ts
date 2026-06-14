/**
 * Lightweight tooltip Svelte action.
 *
 * Usage:
 *   <button use:tooltip={'Settings'}>...</button>
 *   <button use:tooltip={{ text: 'Settings', placement: 'bottom', delay: 300 }}>...</button>
 *   <button aria-label="Close" use:ariaTooltip>...</button>
 *
 * Behavior:
 *   - 300ms hover delay before showing (configurable).
 *   - No delay on keyboard focus (a11y).
 *   - Single document-level container is reused across all tooltips.
 *   - Styled via #desqta-tooltip-root in app.css for reliable contrast.
 */

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipOptions {
  text: string;
  placement?: TooltipPlacement;
  delay?: number;
}

export type TooltipParam = string | TooltipOptions | undefined | null;

const ROOT_ID = 'desqta-tooltip-root';
let rootEl: HTMLDivElement | null = null;
let activeAnchor: HTMLElement | null = null;
let showTimer: ReturnType<typeof setTimeout> | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function getRoot(): HTMLDivElement {
  if (rootEl && document.documentElement.contains(rootEl)) return rootEl;
  rootEl = document.getElementById(ROOT_ID) as HTMLDivElement | null;
  if (rootEl) return rootEl;
  rootEl = document.createElement('div');
  rootEl.id = ROOT_ID;
  rootEl.setAttribute('role', 'tooltip');
  rootEl.setAttribute('aria-hidden', 'true');
  // Append to <html> so theme tokens + dark class always apply.
  document.documentElement.appendChild(rootEl);
  return rootEl;
}

function position(anchor: HTMLElement, placement: TooltipPlacement) {
  const root = getRoot();
  const rect = anchor.getBoundingClientRect();
  const ttRect = root.getBoundingClientRect();
  const gap = 8;
  let x = 0;
  let y = 0;
  switch (placement) {
    case 'top':
      x = rect.left + rect.width / 2 - ttRect.width / 2;
      y = rect.top - ttRect.height - gap;
      break;
    case 'left':
      x = rect.left - ttRect.width - gap;
      y = rect.top + rect.height / 2 - ttRect.height / 2;
      break;
    case 'right':
      x = rect.right + gap;
      y = rect.top + rect.height / 2 - ttRect.height / 2;
      break;
    case 'bottom':
    default:
      x = rect.left + rect.width / 2 - ttRect.width / 2;
      y = rect.bottom + gap;
      break;
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  x = Math.max(8, Math.min(vw - ttRect.width - 8, x));
  y = Math.max(8, Math.min(vh - ttRect.height - 8, y));
  root.style.left = `${Math.round(x)}px`;
  root.style.top = `${Math.round(y)}px`;
}

function show(anchor: HTMLElement, text: string, placement: TooltipPlacement) {
  if (!text.trim()) return;
  const root = getRoot();
  root.textContent = text;
  root.dataset.placement = placement;
  root.style.whiteSpace = text.length > 36 ? 'normal' : 'nowrap';
  root.style.maxWidth = text.length > 36 ? '280px' : '240px';
  activeAnchor = anchor;
  root.setAttribute('data-visible', 'true');
  root.setAttribute('aria-hidden', 'false');
  // Layout once, then show immediately (don't wait for rAF — avoids race with drag-region leave).
  position(anchor, placement);
  requestAnimationFrame(() => {
    if (activeAnchor === anchor) position(anchor, placement);
  });
}

function hide(anchor: HTMLElement) {
  if (activeAnchor !== anchor) return;
  const root = getRoot();
  root.removeAttribute('data-visible');
  root.setAttribute('aria-hidden', 'true');
  activeAnchor = null;
}

function normalise(param: TooltipParam): TooltipOptions | null {
  if (param == null) return null;
  if (typeof param === 'string') {
    if (!param.trim()) return null;
    return { text: param };
  }
  if (!param.text || !param.text.trim()) return null;
  return param;
}

/**
 * Tooltip sourced from an explicit label or the element's aria-label.
 * Pass a reactive string to update when aria-label changes.
 */
export function ariaTooltip(node: HTMLElement, label?: string | null) {
  const read = () => normalise(label ?? node.getAttribute('aria-label'));
  const inner = tooltip(node, read(), read);
  return {
    update(next?: string | null) {
      label = next;
      inner.update(read());
    },
    destroy() {
      inner.destroy();
    },
  };
}

export function tooltip(
  node: HTMLElement,
  param: TooltipParam,
  getParam: () => TooltipOptions | null = () => normalise(param),
) {
  let opts = getParam();

  const refreshOpts = () => {
    opts = getParam();
  };

  const onEnter = () => {
    refreshOpts();
    if (!opts) return;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    const placement = opts.placement ?? 'bottom';
    const delay = opts.delay ?? 300;
    if (showTimer) clearTimeout(showTimer);
    showTimer = setTimeout(() => show(node, opts!.text, placement), delay);
  };

  const onLeave = () => {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => hide(node), 80);
  };

  const onFocus = () => {
    refreshOpts();
    if (!opts) return;
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    show(node, opts.text, opts.placement ?? 'bottom');
  };

  const onBlur = () => hide(node);

  const onScroll = () => {
    if (activeAnchor === node && opts) {
      position(node, opts.placement ?? 'bottom');
    }
  };

  // mouseenter is reliable in Tauri WebView2 on Windows.
  node.addEventListener('mouseenter', onEnter);
  node.addEventListener('mouseleave', onLeave);
  node.addEventListener('focus', onFocus);
  node.addEventListener('blur', onBlur);
  window.addEventListener('scroll', onScroll, true);

  return {
    update(next: TooltipParam) {
      param = next;
      opts = getParam();
      if (!opts) hide(node);
    },
    destroy() {
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
      hide(node);
      node.removeEventListener('mouseenter', onEnter);
      node.removeEventListener('mouseleave', onLeave);
      node.removeEventListener('focus', onFocus);
      node.removeEventListener('blur', onBlur);
      window.removeEventListener('scroll', onScroll, true);
    },
  };
}
