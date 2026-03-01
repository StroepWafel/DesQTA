import { get } from 'svelte/store';
import { locale } from '$lib/i18n';
import { sanitizeHtml } from '../../utils/sanitization';
import type { DraftJSContent, LinkPreview, Lesson } from './types';

/** Get current locale for date formatting (e.g. 'en', 'de', 'fr') */
function getLocale(): string {
  const l = get(locale);
  return l || 'en';
}

// Re-export sanitizeHtml for backwards compatibility
export { sanitizeHtml };

function applyInlineStyles(
  text: string,
  block: { inlineStyleRanges?: any[]; entityRanges?: any[] },
  entityMap: DraftJSContent['entityMap'],
): string {
  const styleRanges: Array<{
    offset: number;
    length: number;
    type: 'style' | 'entity';
    style?: string;
    entityKey?: number;
  }> = [];

  if (block.inlineStyleRanges?.length) {
    block.inlineStyleRanges.forEach((range: { offset: number; length: number; style: string }) => {
      styleRanges.push({ offset: range.offset, length: range.length, type: 'style', style: range.style });
    });
  }
  if (block.entityRanges?.length) {
    block.entityRanges.forEach((range: { offset: number; length: number; key: number }) => {
      styleRanges.push({ offset: range.offset, length: range.length, type: 'entity', entityKey: range.key });
    });
  }

  if (styleRanges.length === 0) return text;

  const rangeMap = new Map<string, (typeof styleRanges)[0][]>();
  styleRanges.forEach((range) => {
    const key = `${range.offset}-${range.length}`;
    if (!rangeMap.has(key)) rangeMap.set(key, []);
    rangeMap.get(key)!.push(range);
  });

  const sortedKeys = Array.from(rangeMap.keys()).sort((a, b) => {
    return Number(b.split('-')[0]) - Number(a.split('-')[0]);
  });

  for (const key of sortedKeys) {
    const ranges = rangeMap.get(key)!;
    const [offset, length] = key.split('-').map(Number);
    const before = text.substring(0, offset);
    let wrappedText = text.substring(offset, offset + length);
    const after = text.substring(offset + length);

    for (const range of ranges) {
      if (range.type === 'entity') {
        const entity = entityMap[String(range.entityKey)];
        if (entity?.type === 'LINK') {
          wrappedText = `<a href="${entity.data?.href || entity.data?.url}" class="text-indigo-400 underline transition-colors hover:text-purple-300" target="_blank" rel="noopener noreferrer">${wrappedText}</a>`;
        }
      } else if (range.type === 'style' && range.style) {
        switch (range.style) {
          case 'BOLD':
            wrappedText = `<strong>${wrappedText}</strong>`;
            break;
          case 'ITALIC':
            wrappedText = `<em>${wrappedText}</em>`;
            break;
          case 'UNDERLINE':
            wrappedText = `<u>${wrappedText}</u>`;
            break;
          case 'STRIKETHROUGH':
            wrappedText = `<s>${wrappedText}</s>`;
            break;
          case 'CODE':
            wrappedText = `<code class="px-1 py-0.5 rounded bg-zinc-700 text-sm font-mono">${wrappedText}</code>`;
            break;
        }
      }
    }
    text = `${before}${wrappedText}${after}`;
  }
  return text;
}

const HEADING_CLASS = 'font-bold text-zinc-900 dark:text-white';
const PROSE_CLASS = 'text-zinc-700 dark:text-zinc-300';

export function renderDraftJSText(content: DraftJSContent): string {
  const entityMap = content.entityMap || {};
  let html = '';
  let listStack: { type: 'ul' | 'ol'; depth: number }[] = [];

  function closeListsToDepth(targetDepth: number) {
    while (listStack.length > 0 && listStack[listStack.length - 1].depth > targetDepth) {
      const { type } = listStack.pop()!;
      html += type === 'ul' ? '</li></ul>' : '</li></ol>';
    }
  }

  function closeAllLists() {
    while (listStack.length > 0) {
      const { type } = listStack.pop()!;
      html += type === 'ul' ? '</li></ul>' : '</li></ol>';
    }
  }

  for (let i = 0; i < content.blocks.length; i++) {
    const block = content.blocks[i];
    const text = applyInlineStyles(block.text, block, entityMap);
    const depth = block.depth ?? 0;

    if (block.type === 'unordered-list-item') {
      closeListsToDepth(depth);
      const top = listStack[listStack.length - 1];
      const needNewList = !top || top.type !== 'ul' || top.depth !== depth;
      if (needNewList) {
        closeListsToDepth(depth - 1);
        if (listStack.length > 0 && listStack[listStack.length - 1].depth >= depth) {
          html += '</li>';
        }
        html += '<ul class="list-disc pl-5 my-1 space-y-0.5">';
        listStack.push({ type: 'ul', depth });
      } else {
        html += '</li>';
      }
      html += `<li class="${PROSE_CLASS}">${text || '&nbsp;'}`;
      continue;
    }

    if (block.type === 'ordered-list-item') {
      closeListsToDepth(depth);
      const top = listStack[listStack.length - 1];
      const needNewList = !top || top.type !== 'ol' || top.depth !== depth;
      if (needNewList) {
        closeListsToDepth(depth - 1);
        if (listStack.length > 0 && listStack[listStack.length - 1].depth >= depth) {
          html += '</li>';
        }
        html += '<ol class="list-decimal pl-5 my-1 space-y-0.5">';
        listStack.push({ type: 'ol', depth });
      } else {
        html += '</li>';
      }
      html += `<li class="${PROSE_CLASS}">${text || '&nbsp;'}`;
      continue;
    }

    closeAllLists();

    switch (block.type) {
      case 'header-one':
        html += `<h1 class="text-2xl ${HEADING_CLASS} mt-4 mb-2 first:mt-0">${text}</h1>`;
        break;
      case 'header-two':
        html += `<h2 class="text-xl ${HEADING_CLASS} mt-4 mb-2 first:mt-0">${text}</h2>`;
        break;
      case 'header-three':
        html += `<h3 class="text-lg ${HEADING_CLASS} mt-3 mb-1.5 first:mt-0">${text}</h3>`;
        break;
      case 'unstyled':
      default:
        if (text.trim()) {
          html += `<p class="${PROSE_CLASS} mb-1.5 leading-relaxed">${text}</p>`;
        }
        break;
    }
  }

  closeAllLists();
  return html;
}

export function getFileIcon(mimetype: string): string {
  if (mimetype.includes('pdf')) return '📄';
  if (mimetype.includes('image')) return '🖼️';
  if (mimetype.includes('video')) return '🎥';
  if (mimetype.includes('audio')) return '🎵';
  if (mimetype.includes('text')) return '📝';
  if (mimetype.includes('word')) return '📝';
  if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return '📊';
  if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return '📽️';
  return '📎';
}

export function getFileColor(mimetype: string): string {
  if (mimetype.includes('pdf')) return 'border-red-500 bg-red-900/20 hover:bg-red-900/40';
  if (mimetype.includes('image')) return 'border-green-500 bg-green-900/20 hover:bg-green-900/40';
  if (mimetype.includes('video'))
    return 'border-purple-500 bg-purple-900/20 hover:bg-purple-900/40';
  if (mimetype.includes('audio'))
    return 'border-yellow-500 bg-yellow-900/20 hover:bg-yellow-900/40';
  if (mimetype.includes('word')) return 'border-blue-500 bg-blue-900/20 hover:bg-blue-900/40';
  if (mimetype.includes('excel') || mimetype.includes('spreadsheet'))
    return 'border-emerald-500 bg-emerald-900/20 hover:bg-emerald-900/40';
  if (mimetype.includes('powerpoint') || mimetype.includes('presentation'))
    return 'border-orange-500 bg-orange-900/20 hover:bg-orange-900/40';
  return 'border-indigo-500 bg-indigo-900/20 hover:bg-indigo-900/40';
}

export function formatFileSize(size: string): string {
  const bytes = parseInt(size);
  if (isNaN(bytes)) return size;

  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let fileSize = bytes;

  while (fileSize >= 1024 && unitIndex < units.length - 1) {
    fileSize /= 1024;
    unitIndex++;
  }

  return `${fileSize.toFixed(1)} ${units[unitIndex]}`;
}

// Link preview cache (in-memory, 24h TTL)
const linkPreviewCache = new Map<
  string,
  { value: LinkPreview; timestamp: number }
>();
const LINK_PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

function getCachedLinkPreview(url: string): LinkPreview | null {
  const entry = linkPreviewCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > LINK_PREVIEW_TTL_MS) {
    linkPreviewCache.delete(url);
    return null;
  }
  return entry.value;
}

function setCachedLinkPreview(url: string, preview: LinkPreview): void {
  linkPreviewCache.set(url, { value: preview, timestamp: Date.now() });
}

// Link preview functionality
export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  const cached = getCachedLinkPreview(url);
  if (cached) return cached;

  try {
    const embedlyUrl = `https://api.embed.ly/1/oembed?url=${encodeURIComponent(url)}&key=fef2d3229afa11e0bcfe4040d3dc5c07&format=json&maxWidth=600&maxHeight=400&secure=true&luxe=1`;

    const response = await fetch(embedlyUrl);
    const data = await response.json();

    if (data.error_code) {
      return null;
    }

    const preview: LinkPreview = {
      title: data.title || `Preview of ${getDomainName(url)}`,
      description: data.description || '',
      image: data.thumbnail_url || '',
      url: url,
      imageWidth: data.thumbnail_width || 0,
      imageHeight: data.thumbnail_height || 0,
    };
    setCachedLinkPreview(url, preview);
    return preview;
  } catch {
    return null;
  }
}

export function isFaviconImage(preview: LinkPreview | null): boolean {
  if (!preview || !preview.image) return false;

  const width = preview.imageWidth || 0;
  const height = preview.imageHeight || 0;

  // Consider it a favicon if it's small (typically <= 64px) or square and small
  if (width <= 64 && height <= 64) return true;

  // Also check for common favicon patterns in URL
  const imageUrl = preview.image.toLowerCase();
  if (
    imageUrl.includes('favicon') ||
    imageUrl.includes('/icon') ||
    imageUrl.endsWith('.ico') ||
    imageUrl.includes('apple-touch-icon')
  ) {
    return true;
  }

  return false;
}

function getDomainName(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'External Link';
  }
}

export function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

export function formatDate(dateString: string, localeOverride?: string): string {
  try {
    const date = new Date(dateString);
    const loc = localeOverride ?? getLocale();
    return date.toLocaleDateString(loc, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    return dateString;
  }
}

export function formatTime(timeString: string, localeOverride?: string): string {
  try {
    const time = new Date(`2000-01-01T${timeString}`);
    const loc = localeOverride ?? getLocale();
    return time.toLocaleTimeString(loc, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch (error) {
    return timeString;
  }
}

export function isLessonReleased(lesson: Lesson): boolean {
  try {
    // Parse the lesson date and time
    const lessonDateTime = new Date(`${lesson.d}T${lesson.s}`);
    const now = new Date();

    // Return true if the lesson time has passed
    return lessonDateTime <= now;
  } catch (error) {
    // If we can't parse the date, assume it's released to be safe
    return true;
  }
}

export type FormatLessonDateLabels = {
  today: string;
  tomorrow: string;
  yesterday: string;
};

export function formatLessonDate(
  dateString: string,
  labels?: FormatLessonDateLabels,
): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lessonDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffTime = lessonDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const loc = getLocale();
    const t = labels?.today ?? 'Today';
    const tm = labels?.tomorrow ?? 'Tomorrow';
    const y = labels?.yesterday ?? 'Yesterday';

    if (diffDays === 0) {
      return t;
    } else if (diffDays === 1) {
      return tm;
    } else if (diffDays === -1) {
      return y;
    } else if (diffDays > 1 && diffDays <= 7) {
      return date.toLocaleDateString(loc, { weekday: 'long' });
    } else {
      return date.toLocaleDateString(loc, {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  } catch (error) {
    return dateString;
  }
}

export function isEmbeddableUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return true;

    return false;
  } catch (error) {
    return false;
  }
}

export function getEmbedUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes('youtube.com')) {
      const videoId = urlObj.searchParams.get('v');
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    } else if (hostname.includes('youtu.be')) {
      const videoId = urlObj.pathname.slice(1);
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

export function getEmbedType(url: string): 'video' | 'document' | 'interactive' | 'webpage' {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      return 'video';
    }

    return 'webpage';
  } catch (error) {
    return 'webpage';
  }
}
