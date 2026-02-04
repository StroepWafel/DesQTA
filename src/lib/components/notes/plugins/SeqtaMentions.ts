import { Node } from '@tiptap/core';
import { PluginKey } from 'prosemirror-state';
import Suggestion from '@tiptap/suggestion';
import {
  SeqtaMentionsServiceRust as SeqtaMentionsService,
  type SeqtaMentionItem,
} from '../../../services/seqtaMentionsServiceRust';
import { createIconSVG } from '../utils/iconUtils';
import { logger } from '../../../../utils/logger';

export interface SeqtaMentionOptions {
  HTMLAttributes: Record<string, any>;
  renderLabel: (props: { options: SeqtaMentionOptions; node: any }) => string;
  suggestion: Omit<any, 'editor'>;
}

export const SeqtaMentions = Node.create<SeqtaMentionOptions>({
  name: 'seqtaMention',

  group: 'inline',

  inline: true,

  selectable: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      renderLabel({ options, node }) {
        return `@${node.attrs.label ?? node.attrs.id}`;
      },
      suggestion: {
        char: '@',
        pluginKey: new PluginKey('seqtaMention'),
        command: ({ editor, range, props }: { editor: any; range: any; props: any }) => {
          // Insert the mention
          const nodeAfter = editor.view.state.selection.$to.nodeAfter;
          const overrideSpace = nodeAfter?.text?.startsWith(' ');

          if (overrideSpace) {
            range.to += 1;
          }

          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: 'seqtaMention',
                attrs: props,
              },
              {
                type: 'text',
                text: ' ',
              },
            ])
            .run();

          window.getSelection()?.collapseToEnd();
        },
        allow: ({ state, range }: { state: any; range: any }) => {
          const $from = state.selection.$from;
          const type = state.schema.nodes[this.name];

          return $from.parent.type.allowsMarkType(type);
        },
      },
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-id'),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return {};
          }
          return {
            'data-id': attributes.id,
          };
        },
      },
      type: {
        default: null,
        parseHTML: (element) => {
          // Try data-mention-type first (explicit), then data-type, then infer from class/id
          return (
            element.getAttribute('data-mention-type') || element.getAttribute('data-type') || null
          );
        },
        renderHTML: (attributes) => {
          if (!attributes.type) {
            return {};
          }
          return {
            'data-type': attributes.type,
            'data-mention-type': attributes.type, // Also set this for explicit parsing
          };
        },
      },
      title: {
        default: null,
        parseHTML: (element) => {
          return element.getAttribute('data-title') || element.getAttribute('title') || null;
        },
        renderHTML: (attributes) => {
          if (!attributes.title) {
            return {};
          }
          return {
            'data-title': attributes.title,
          };
        },
      },
      subtitle: {
        default: null,
        parseHTML: (element) => {
          return element.getAttribute('data-subtitle') || null;
        },
        renderHTML: (attributes) => {
          if (!attributes.subtitle) {
            return {};
          }
          return {
            'data-subtitle': attributes.subtitle,
          };
        },
      },
      label: {
        default: null,
        parseHTML: (element) => {
          // Label can be inferred from text content or data-title
          return element.getAttribute('data-title') || element.textContent || null;
        },
        renderHTML: (attributes) => {
          if (!attributes.label) {
            return {};
          }
          return {
            'data-label': attributes.label,
          };
        },
      },
      data: {
        default: null,
        parseHTML: (element) => {
          const dataAttr = element.getAttribute('data-mention-data');
          return dataAttr ? JSON.parse(dataAttr) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.data) {
            return {};
          }
          return {
            'data-mention-data': JSON.stringify(attributes.data),
          };
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },

  addNodeView() {
    return ({ node, HTMLAttributes }: { node: any; HTMLAttributes: any }) => {
      const mention = document.createElement('span');

      mention.classList.add('seqta-mention');
      mention.setAttribute('data-type', String(node.attrs.type || ''));
      mention.setAttribute('data-id', String(node.attrs.id || ''));
      mention.setAttribute('data-title', String(node.attrs.title || node.attrs.label || ''));
      mention.setAttribute('data-subtitle', String(node.attrs.subtitle || ''));
      mention.setAttribute('title', String(node.attrs.subtitle || node.attrs.title || ''));

      // Add styling based on mention type with enhanced design
      const typeStyles = {
        assignment:
          'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        assessment:
          'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
        subject:
          'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800',
        class:
          'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        teacher:
          'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800',
        timetable:
          'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        timetable_slot:
          'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
        notice:
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
        file: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300 border-slate-200 dark:border-slate-800',
        homework:
          'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300 border-pink-200 dark:border-pink-800',
      };

      // Icons for each type
      const typeIcons: Record<string, string> = {
        assignment: 'documentText',
        assessment: 'chartBar',
        subject: 'bookOpen',
        class: 'academicCap',
        teacher: 'user',
        timetable: 'calendar',
        timetable_slot: 'clock',
        notice: 'megaphone',
        file: 'paperClip',
        homework: 'clipboard',
      };

      const iconName = typeIcons[node.attrs.type] || 'link';
      const iconSVG = createIconSVG(iconName, 14, 'w-3.5 h-3.5 flex-shrink-0');
      const baseStyle =
        typeStyles[node.attrs.type as keyof typeof typeStyles] ||
        'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-800';

      mention.className = `seqta-mention inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer hover:scale-105 hover:shadow-md select-none ${baseStyle}`;
      mention.style.userSelect = 'none';
      mention.style.pointerEvents = 'auto';

      const iconSpan = document.createElement('span');
      iconSpan.className = 'pointer-events-none flex-shrink-0';
      iconSpan.appendChild(iconSVG);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'pointer-events-none';
      labelSpan.textContent = this.options.renderLabel({ options: this.options, node });

      mention.appendChild(iconSpan);
      mention.appendChild(labelSpan);

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        mention.setAttribute(key, String(value || ''));
      });

      // Click handler for detail modal - use mousedown with capture
      const handleMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        hideTooltip();

        logger.debug('SeqtaMentions', 'handleMouseDown', 'Mention mousedown', {
          mentionId: node.attrs.id,
          mentionType: node.attrs.type,
          title: node.attrs.title || node.attrs.label,
          subtitle: node.attrs.subtitle,
        });

        // Dispatch custom event to open detail modal
        const customEvent = new CustomEvent('seqta-mention-click', {
          detail: {
            mentionId: node.attrs.id,
            mentionType: node.attrs.type,
            title: node.attrs.title || node.attrs.label,
            subtitle: node.attrs.subtitle || '',
            data: node.attrs.data || null,
          },
          bubbles: true,
          cancelable: true,
        });

        // Use setTimeout to ensure TipTap doesn't intercept
        setTimeout(() => {
          window.dispatchEvent(customEvent);
        }, 0);
      };

      // Hover tooltip handler - using DOM-based tooltip for TipTap compatibility
      let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;
      let tooltipElement: HTMLElement | null = null;
      let mentionData: any = null;

      const showTooltip = async (e: MouseEvent) => {
        if (tooltipTimeout) clearTimeout(tooltipTimeout);

        tooltipTimeout = setTimeout(async () => {
          try {
            // Check cache first
            const cachedData = getCachedTooltip(node.attrs.id, node.attrs.type);
            if (cachedData !== undefined) {
              mentionData = cachedData;
            } else {
              // Fetch mention data
              const { SeqtaMentionsServiceRust } = await import(
                '../../../services/seqtaMentionsServiceRust'
              );
              const fetchedData = await SeqtaMentionsServiceRust.updateMentionData(
                node.attrs.id,
                node.attrs.type,
              );
              mentionData = fetchedData;
              // Cache the result
              setCachedTooltip(node.attrs.id, node.attrs.type, fetchedData);
            }

            const rect = mention.getBoundingClientRect();
            const tooltip = document.createElement('div');
            tooltip.id = `seqta-tooltip-${node.attrs.id}`;
            tooltip.className = `fixed pointer-events-none`;
            tooltip.style.zIndex = TOOLTIP_Z_INDEX.toString();
            tooltip.style.left = `${rect.left + rect.width / 2}px`;
            tooltip.style.top = `${rect.top - 10}px`;
            tooltip.style.transform = 'translate(-50%, -100%)';

            const tooltipContent = document.createElement('div');
            tooltipContent.className =
              'min-w-[240px] max-w-[320px] p-3 rounded-xl shadow-xl border backdrop-blur-xl bg-white/95 dark:bg-zinc-800/95 border-zinc-200/60 dark:border-zinc-700/60';
            tooltipContent.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.2)';

            const title = node.attrs.title || node.attrs.label || '';
            const subtitle = node.attrs.subtitle || '';

            tooltipContent.innerHTML = `
              <div class="flex items-start justify-between gap-2 mb-2">
                <div class="flex-1 min-w-0">
                  <h3 class="text-sm font-semibold text-zinc-900 dark:text-white truncate">${title}</h3>
                  <p class="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mt-1">${subtitle}</p>
                </div>
              </div>
              ${
                mentionData?.data
                  ? `
                <div class="space-y-1.5 pt-2 border-t border-zinc-200/50 dark:border-zinc-700/50">
                  ${
                    mentionData.data.dueDate || mentionData.data.due
                      ? `
                    <div class="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <div class="shrink-0">${createIconSVG('clock', 14, 'w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400').outerHTML}</div>
                      <span>Due: ${formatTooltipDate(mentionData.data.dueDate || mentionData.data.due)}</span>
                    </div>
                  `
                      : ''
                  }
                  ${
                    mentionData.data.teacher
                      ? `
                    <div class="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <div class="shrink-0">${createIconSVG('user', 14, 'w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400').outerHTML}</div>
                      <span>${mentionData.data.teacher}</span>
                    </div>
                  `
                      : ''
                  }
                  ${
                    mentionData.data.room
                      ? `
                    <div class="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <div class="shrink-0">${createIconSVG('mapPin', 14, 'w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400').outerHTML}</div>
                      <span>Room ${mentionData.data.room}</span>
                    </div>
                  `
                      : ''
                  }
                </div>
              `
                  : ''
              }
              <div class="flex items-center gap-2 pt-2 mt-2 border-t border-zinc-200/50 dark:border-zinc-700/50">
                <button class="text-xs px-2 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 transition-colors pointer-events-auto">
                  View Details
                </button>
              </div>
            `;

            // Add click handler to button
            const button = tooltipContent.querySelector('button');
            if (button) {
              button.addEventListener('click', (e) => {
                e.stopPropagation();
                handleMouseDown(e as any);
              });
            }

            tooltip.appendChild(tooltipContent);
            document.body.appendChild(tooltip);
            tooltipElement = tooltip;

            // Adjust position to avoid viewport edges
            const tooltipRect = tooltip.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            if (tooltipRect.left < 20) {
              tooltip.style.left = '20px';
              tooltip.style.transform = 'translate(0, -100%)';
            } else if (tooltipRect.right > viewportWidth - 20) {
              tooltip.style.left = `${viewportWidth - tooltipRect.width - 20}px`;
              tooltip.style.transform = 'translate(0, -100%)';
            }

            if (tooltipRect.top < 20) {
              tooltip.style.top = `${rect.bottom + 10}px`;
              tooltip.style.transform = 'translate(-50%, 0)';
            }
          } catch (error) {
            logger.error('SeqtaMentions', 'showTooltip', 'Failed to show tooltip', {
              error: error instanceof Error ? error.message : String(error),
              mentionId: node.attrs.id,
            });
          }
        }, TOOLTIP_DELAY_MS);
      };

      const formatTooltipDate = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays === -1) return 'Yesterday';
        if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
        if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;

        return date.toLocaleDateString();
      };

      const hideTooltip = () => {
        if (tooltipTimeout) {
          clearTimeout(tooltipTimeout);
          tooltipTimeout = null;
        }
        if (tooltipElement) {
          tooltipElement.remove();
          tooltipElement = null;
        }
      };

      mention.addEventListener('mouseenter', showTooltip);
      mention.addEventListener('mouseleave', hideTooltip);
      mention.addEventListener('mousedown', handleMouseDown, true); // Use capture phase

      return {
        dom: mention,
        contentDOM: null,
        selectNode: () => {
          mention.classList.add('ProseMirror-selectednode');
        },
        deselectNode: () => {
          mention.classList.remove('ProseMirror-selectednode');
        },
        destroy: () => {
          hideTooltip();
          mention.removeEventListener('mouseenter', showTooltip);
          mention.removeEventListener('mouseleave', hideTooltip);
          mention.removeEventListener('mousedown', handleMouseDown, true);
        },
      };
    };
  },

  parseHTML() {
    return [
      {
        tag: `span[data-type="${this.name}"]`,
      },
      {
        tag: 'span.seqta-mention',
        getAttrs: (element) => {
          // Ensure we match any span with seqta-mention class, regardless of data-type
          if (typeof element === 'string') return false;
          const el = element as HTMLElement;
          return el.classList.contains('seqta-mention') ? {} : false;
        },
      },
      {
        // Also match spans with data-mention-type attribute (for new types)
        tag: 'span',
        getAttrs: (element) => {
          if (typeof element === 'string') return false;
          const el = element as HTMLElement;
          const hasMentionType =
            el.hasAttribute('data-mention-type') ||
            (el.hasAttribute('data-type') && el.classList.contains('seqta-mention'));
          return hasMentionType ? {} : false;
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }: { node: any; HTMLAttributes: any }) {
    return [
      'span',
      {
        ...this.options.HTMLAttributes,
        ...HTMLAttributes,
        class: `seqta-mention ${HTMLAttributes.class || ''}`.trim(), // Ensure class is always present
        'data-type': node.attrs.type || this.name, // Use actual type, fallback to node name
        'data-id': node.attrs.id,
        'data-mention-type': node.attrs.type, // Explicit type attribute
        'data-title': node.attrs.title || node.attrs.label,
        'data-subtitle': node.attrs.subtitle,
      },
      this.options.renderLabel({ options: this.options, node }),
    ];
  },

  renderText({ node }: { node: any }) {
    return this.options.renderLabel({ options: this.options, node });
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        this.editor.commands.command(({ tr, state }) => {
          let isMention = false;
          const { selection } = state;
          const { empty, anchor } = selection;

          if (!empty) {
            return false;
          }

          state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
            if (node.type.name === this.name) {
              isMention = true;
              tr.insertText('', pos, pos + node.nodeSize);

              return false;
            }
          });

          return isMention;
        }),
    };
  },
});

// Tooltip cache
interface TooltipCacheEntry {
  data: SeqtaMentionItem | null;
  timestamp: number;
}

const tooltipCache = new Map<string, TooltipCacheEntry>();
const TOOLTIP_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedTooltip(
  mentionId: string,
  mentionType: string,
): SeqtaMentionItem | null | undefined {
  const cacheKey = `${mentionId}-${mentionType}`;
  const cached = tooltipCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TOOLTIP_CACHE_TTL_MS) {
    return cached.data;
  }
  return undefined;
}

function setCachedTooltip(
  mentionId: string,
  mentionType: string,
  data: SeqtaMentionItem | null,
): void {
  const cacheKey = `${mentionId}-${mentionType}`;
  tooltipCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });
}

// Debounce state for search
let searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSearchAbortController: AbortController | null = null;

// Suggestion configuration for SEQTA mentions
export const seqtaMentionSuggestion = {
  items: async ({
    query,
    editor,
  }: {
    query: string;
    editor?: any;
  }): Promise<SeqtaMentionItem[]> => {
    // Cancel previous debounce and pending request
    if (searchDebounceTimeout) {
      clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = null;
    }
    if (pendingSearchAbortController) {
      pendingSearchAbortController.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    pendingSearchAbortController = abortController;

    return new Promise((resolve) => {
      searchDebounceTimeout = setTimeout(async () => {
        // Check if request was aborted
        if (abortController.signal.aborted) {
          resolve([]);
          return;
        }

        try {
          // Extract category filter from query (e.g., "assessment" or "assessment math")
          // TipTap passes the query without the @ symbol
          const queryParts = query.trim().split(/\s+/);
          const firstPart = queryParts.length > 0 ? queryParts[0].toLowerCase() : '';
          const searchQuery = queryParts.length > 1 ? queryParts.slice(1).join(' ') : '';

          // Valid mention types
          const validTypes = [
            'assessment',
            'assignment',
            'homework',
            'class',
            'subject',
            'teacher',
            'timetable_slot',
            'timetable',
            'notice',
            'file',
          ];

          // Check if first part is a category filter
          const categoryFilter = validTypes.includes(firstPart) ? firstPart : null;
          const actualSearchQuery = categoryFilter ? searchQuery : query.trim();

          // Get note content for context-aware suggestions
          let noteContent = '';
          if (editor) {
            try {
              noteContent = editor.getText();
            } catch (e) {
              // Ignore errors getting content
            }
          }

          // Check if aborted before making request
          if (abortController.signal.aborted) {
            resolve([]);
            return;
          }

          // Use context-aware search if we have note content
          const results = noteContent.trim()
            ? await SeqtaMentionsService.searchMentionsWithContext(
                actualSearchQuery || '',
                noteContent,
                categoryFilter || undefined,
              )
            : await SeqtaMentionsService.searchMentions(
                actualSearchQuery || '',
                categoryFilter || undefined,
              );

          // Check if aborted after request completes
          if (abortController.signal.aborted) {
            resolve([]);
            return;
          }

          const finalResults = results.slice(0, 100);
          resolve(finalResults);
        } catch (error) {
          // Don't log if request was aborted
          if (!abortController.signal.aborted) {
            logger.error('SeqtaMentions', 'searchMentions', 'Failed to fetch SEQTA mentions', {
              error: error instanceof Error ? error.message : String(error),
              query,
            });
          }
          resolve([]);
        } finally {
          if (pendingSearchAbortController === abortController) {
            pendingSearchAbortController = null;
          }
        }
      }, DEBOUNCE_DELAY_MS);
    });
  },

  render: () => {
    let component: any;
    let popup: HTMLElement;

    return {
      onStart: (props: any) => {
        component = new MentionList({
          target: document.body,
          props: {
            ...props,
            query: props.query || '',
            command: (item: SeqtaMentionItem, asCard: boolean = false) => {
              if (asCard && props.editor) {
                // Insert as rich content block
                const { from } = props.range;
                props.editor
                  .chain()
                  .focus()
                  .insertContentAt(from, {
                    type: 'seqtaContentBlock',
                    attrs: {
                      type: item.type,
                      id: item.id,
                      data: item.data,
                    },
                  })
                  .insertContent({ type: 'text', text: ' ' })
                  .run();
              } else {
                // Insert as regular mention
                props.command({
                  id: item.id,
                  type: item.type,
                  title: item.title,
                  subtitle: item.subtitle,
                  label: item.title,
                  data: item.data,
                });
              }
            },
            editor: props.editor,
          },
        } as any);

        if (!props.clientRect) {
          return;
        }

        popup = component.container;

        // Store clientRect function for dynamic positioning
        component.clientRect = props.clientRect || null;

        // Position will be calculated by MentionList using fixed positioning
        component.updatePosition();
      },

      onUpdate(props: any) {
        component.updateList({
          ...props,
          query: props.query || '',
          command: (item: SeqtaMentionItem, asCard: boolean = false) => {
            if (asCard && props.editor) {
              // Insert as rich content block
              const { from } = props.range;
              props.editor
                .chain()
                .focus()
                .insertContentAt(from, {
                  type: 'seqtaContentBlock',
                  attrs: {
                    type: item.type,
                    id: item.id,
                    data: item.data,
                  },
                })
                .insertContent({ type: 'text', text: ' ' })
                .run();
            } else {
              // Insert as regular mention
              props.command({
                id: item.id,
                type: item.type,
                title: item.title,
                subtitle: item.subtitle,
                label: item.title,
                data: item.data,
              });
            }
          },
          editor: props.editor,
        });

        // Update clientRect reference and reposition
        component.clientRect = props.clientRect || null;
        component.updatePosition();
      },

      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          component?.destroy();
          return true;
        }

        return component?.onKeyDown(props) || false;
      },

      onExit() {
        component?.destroy();
      },
    };
  },
};

// Constants for positioning and styling
const DROPDOWN_Z_INDEX = 9998;
const TOOLTIP_Z_INDEX = 9999;
const DEBOUNCE_DELAY_MS = 300;
const TOOLTIP_DELAY_MS = 300;
const VIEWPORT_PADDING = 20;

// Simple DOM-based mention list component
class MentionList {
  private container: HTMLElement;
  private selectedIndex: number = 0;
  private items: SeqtaMentionItem[] = [];
  private command: (item: SeqtaMentionItem, asCard?: boolean) => void = () => {};
  private editor: any = null;
  private collapsedCategories: Set<string> = new Set();
  private clientRect: (() => DOMRect) | null = null;
  private scrollListeners: Array<() => void> = [];
  private resizeListener: (() => void) | null = null;

  constructor(options: { target: HTMLElement; props: any }) {
    const { target, props } = options;

    this.container = document.createElement('div');
    this.container.className =
      'mention-list max-w-sm bg-white/95 dark:bg-zinc-800/95 border border-zinc-200/60 dark:border-zinc-700/60 rounded-xl shadow-2xl backdrop-blur-md overflow-y-auto max-h-96 transition-all duration-200';
    this.container.style.position = 'fixed';
    this.container.style.zIndex = DROPDOWN_Z_INDEX.toString();
    this.container.style.pointerEvents = 'auto';
    this.container.setAttribute('role', 'listbox');
    this.container.setAttribute('aria-label', 'SEQTA mention suggestions');

    // Portal to body to avoid overflow clipping
    if (this.container.parentNode !== document.body) {
      document.body.appendChild(this.container);
    }

    this.editor = props.editor;
    this.clientRect = props.clientRect || null;

    // Set initial position
    this.updatePosition();

    // Add scroll and resize listeners
    this.setupPositionListeners();

    this.updateList(props);
  }

  private calculatePosition(): { top: number; left: number } {
    if (!this.clientRect) {
      return { top: 0, left: 0 };
    }

    const rect = this.clientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // Estimate dropdown dimensions (will be adjusted after render)
    const dropdownWidth = 320; // max-w-sm = 384px, but we'll use 320 as estimate
    const dropdownHeight = Math.min(400, this.items.length * 50 + 100); // Rough estimate

    let top = rect.bottom + 8;
    let left = rect.left;

    // Flip above if not enough space below
    if (top + dropdownHeight > viewport.height - VIEWPORT_PADDING) {
      top = rect.top - dropdownHeight - 8;
      // If still doesn't fit above, position at top of viewport
      if (top < VIEWPORT_PADDING) {
        top = VIEWPORT_PADDING;
      }
    }

    // Adjust horizontal to stay in viewport
    if (left + dropdownWidth > viewport.width - VIEWPORT_PADDING) {
      left = viewport.width - dropdownWidth - VIEWPORT_PADDING;
    }
    if (left < VIEWPORT_PADDING) {
      left = VIEWPORT_PADDING;
    }

    return { top, left };
  }

  private updatePosition() {
    const { top, left } = this.calculatePosition();
    this.container.style.top = `${top}px`;
    this.container.style.left = `${left}px`;
  }

  private setupPositionListeners() {
    // Listen to scroll events on window and editor container
    const handleScroll = () => {
      this.updatePosition();
    };

    window.addEventListener('scroll', handleScroll, true); // Use capture phase
    this.scrollListeners.push(() => {
      window.removeEventListener('scroll', handleScroll, true);
    });

    // Listen to resize events
    const handleResize = () => {
      this.updatePosition();
    };

    window.addEventListener('resize', handleResize);
    this.resizeListener = () => {
      window.removeEventListener('resize', handleResize);
    };
  }

  private cleanupPositionListeners() {
    this.scrollListeners.forEach((cleanup) => cleanup());
    this.scrollListeners = [];
    if (this.resizeListener) {
      this.resizeListener();
      this.resizeListener = null;
    }
  }

  updateList(props: any) {
    const { items = [], command, editor, query = '' } = props;
    this.items = items;
    this.command = command;
    this.editor = editor;
    this.selectedIndex = 0;

    // Update clientRect if provided
    if (props.clientRect) {
      this.clientRect = props.clientRect;
    }

    this.container.innerHTML = '';

    if (items.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'p-3 text-sm text-zinc-500 dark:text-zinc-400';
      emptyState.textContent = 'No SEQTA items found';
      this.container.appendChild(emptyState);
      return;
    }

    // Group items by type
    const groupedItems: Record<string, SeqtaMentionItem[]> = {};
    items.forEach((item: SeqtaMentionItem) => {
      if (!groupedItems[item.type]) {
        groupedItems[item.type] = [];
      }
      groupedItems[item.type].push(item);
    });

    // Type labels and icons
    const typeLabels: Record<string, { label: string; icon: string }> = {
      assessment: { label: 'Assessments', icon: 'chartBar' },
      assignment: { label: 'Assignments', icon: 'documentText' },
      homework: { label: 'Homework', icon: 'clipboard' },
      class: { label: 'Classes', icon: 'academicCap' },
      subject: { label: 'Subjects', icon: 'bookOpen' },
      teacher: { label: 'Teachers', icon: 'user' },
      timetable_slot: { label: 'Timetable Slots', icon: 'clock' },
      timetable: { label: 'Timetable', icon: 'calendar' },
      notice: { label: 'Notices', icon: 'megaphone' },
      file: { label: 'Files', icon: 'paperClip' },
    };

    // Determine if we should expand categories (if user is typing a search query)
    const queryParts = query.trim().split(/\s+/);
    const firstPart = queryParts.length > 0 ? queryParts[0].toLowerCase() : '';
    const hasSearchQuery = query.trim().length > 0;
    const isCategoryFilter = Object.keys(groupedItems).includes(firstPart);
    const shouldExpandAll = hasSearchQuery && !isCategoryFilter; // Expand all if searching, but if filtering by category, only expand that category

    // Initialize all categories as collapsed if no search query
    if (!hasSearchQuery && this.collapsedCategories.size === 0) {
      Object.keys(groupedItems).forEach((type) => {
        this.collapsedCategories.add(type);
      });
    }

    // If filtering by a specific category, ensure that category is expanded
    if (isCategoryFilter && this.collapsedCategories.has(firstPart)) {
      this.collapsedCategories.delete(firstPart);
    }

    let globalIndex = 0;

    // Render grouped items
    Object.entries(groupedItems).forEach(([type, typeItems]) => {
      // Determine if this category should be collapsed
      const isCollapsed = !shouldExpandAll && this.collapsedCategories.has(type);

      // Category header (clickable to toggle)
      const categoryHeader = document.createElement('button');
      categoryHeader.className =
        'w-full px-3 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide backdrop-blur-sm bg-zinc-50/80 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all duration-200 cursor-pointer';
      categoryHeader.style.transition = 'background-color 200ms cubic-bezier(0.4, 0, 0.2, 1)';
      const typeInfo = typeLabels[type] || { label: type, icon: 'link' };

      const chevronSVG = createIconSVG(isCollapsed ? 'chevronRight' : 'chevronDown', 12, 'w-3 h-3');
      const iconSVG = createIconSVG(typeInfo.icon, 14, 'w-3.5 h-3.5');

      const headerContent = document.createElement('div');
      headerContent.className = 'flex items-center gap-2';

      const chevronWrapper = document.createElement('div');
      chevronWrapper.className = 'w-3 flex-shrink-0';
      chevronWrapper.appendChild(chevronSVG);

      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'flex-shrink-0';
      iconWrapper.appendChild(iconSVG);

      const labelSpan = document.createElement('span');
      labelSpan.textContent = typeInfo.label;

      const countSpan = document.createElement('span');
      countSpan.className = 'ml-auto text-zinc-400';
      countSpan.textContent = typeItems.length.toString();

      headerContent.appendChild(chevronWrapper);
      headerContent.appendChild(iconWrapper);
      headerContent.appendChild(labelSpan);
      headerContent.appendChild(countSpan);

      categoryHeader.appendChild(headerContent);
      categoryHeader.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      categoryHeader.setAttribute('aria-label', `Toggle ${typeInfo.label} category`);
      categoryHeader.setAttribute('role', 'button');

      // Category items container
      const categoryItemsContainer = document.createElement('div');
      categoryItemsContainer.className = isCollapsed ? 'hidden' : '';
      categoryItemsContainer.setAttribute('data-category', type);
      categoryItemsContainer.setAttribute('role', 'group');
      categoryItemsContainer.setAttribute('aria-label', `${typeInfo.label} items`);

      // Toggle collapse on header click
      categoryHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.collapsedCategories.has(type)) {
          this.collapsedCategories.delete(type);
        } else {
          this.collapsedCategories.add(type);
        }
        this.updateList(props);
      });

      this.container.appendChild(categoryHeader);
      this.container.appendChild(categoryItemsContainer);

      // Items in this category
      typeItems.forEach((item: SeqtaMentionItem) => {
        const itemWrapper = document.createElement('div');
        itemWrapper.className = 'border-b border-zinc-200 dark:border-zinc-700 last:border-b-0';

        const itemEl = document.createElement('button');
        itemEl.className = `w-full p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 flex items-center space-x-3 transition-all duration-200 hover:scale-[1.01] ${globalIndex === this.selectedIndex ? 'bg-zinc-100 dark:bg-zinc-700' : ''}`;
        itemEl.style.transition = 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)';
        itemEl.setAttribute('data-index', globalIndex.toString());
        itemEl.setAttribute('role', 'option');
        if (globalIndex === this.selectedIndex) {
          itemEl.setAttribute('aria-selected', 'true');
        }

        // Type indicator
        const indicator = document.createElement('div');
        indicator.className = 'w-2 h-2 rounded-full flex-shrink-0';
        const colors = {
          assignment: 'bg-blue-500',
          assessment: 'bg-red-500',
          subject: 'bg-green-500',
          class: 'bg-purple-500',
          teacher: 'bg-orange-500',
          timetable: 'bg-indigo-500',
          timetable_slot: 'bg-cyan-500',
          notice: 'bg-yellow-500',
          file: 'bg-slate-500',
          homework: 'bg-pink-500',
        };
        indicator.className += ` ${colors[item.type as keyof typeof colors] || 'bg-gray-500'}`;

        // Content
        const content = document.createElement('div');
        content.className = 'flex-1 min-w-0';
        content.innerHTML = `
          <div class="text-sm font-medium text-zinc-900 dark:text-white truncate">${item.title}</div>
          <div class="text-xs text-zinc-500 dark:text-zinc-400 truncate">${item.subtitle}</div>
        `;

        itemEl.appendChild(indicator);
        itemEl.appendChild(content);

        itemEl.addEventListener('click', () => command(item, false));

        // Add "Insert as card" button
        const cardButton = document.createElement('button');
        cardButton.className =
          'px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors shrink-0';
        cardButton.textContent = 'Card';
        cardButton.title = 'Insert as rich content card';
        cardButton.addEventListener('click', (e) => {
          e.stopPropagation();
          command(item, true);
        });

        const actionsWrapper = document.createElement('div');
        actionsWrapper.className = 'flex items-center gap-1';
        actionsWrapper.appendChild(itemEl);
        actionsWrapper.appendChild(cardButton);

        itemWrapper.appendChild(actionsWrapper);
        categoryItemsContainer.appendChild(itemWrapper);

        globalIndex++;
      });
    });

    // Update position after rendering to account for actual dropdown size
    requestAnimationFrame(() => {
      this.updatePosition();
    });
  }

  selectItem(index: number) {
    if (index >= 0 && index < this.items.length) {
      this.selectedIndex = index;
      this.updateSelection();
    }
  }

  updateSelection() {
    const buttons = this.container.querySelectorAll('button[data-index]');
    buttons.forEach((button, index) => {
      if (index === this.selectedIndex) {
        button.classList.add('bg-zinc-100', 'dark:bg-zinc-700');
      } else {
        button.classList.remove('bg-zinc-100', 'dark:bg-zinc-700');
      }
    });
  }

  executeSelected() {
    if (this.items[this.selectedIndex]) {
      this.command(this.items[this.selectedIndex]);
    }
  }

  destroy() {
    this.cleanupPositionListeners();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  onKeyDown(props: any) {
    const { event } = props;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectItem((this.selectedIndex + 1) % this.items.length);
      return true;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectItem(this.selectedIndex === 0 ? this.items.length - 1 : this.selectedIndex - 1);
      return true;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      this.executeSelected();
      return true;
    }

    return false;
  }
}
