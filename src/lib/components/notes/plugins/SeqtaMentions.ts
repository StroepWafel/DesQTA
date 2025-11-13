import { Node } from '@tiptap/core';
import { PluginKey } from 'prosemirror-state';
import Suggestion from '@tiptap/suggestion';
import {
  SeqtaMentionsServiceRust as SeqtaMentionsService,
  type SeqtaMentionItem,
} from '../../../services/seqtaMentionsServiceRust';

// Helper function to create SVG icon elements
const createIconSVG = (
  iconName: string,
  size: number = 16,
  className: string = 'text-zinc-500 dark:text-zinc-400',
): SVGSVGElement => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', size.toString());
  svg.setAttribute('height', size.toString());
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', className);

  // Heroicons paths (outline versions)
  const iconPaths: Record<string, string> = {
    clock: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    calendar:
      'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
    user: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z',
    mapPin:
      'M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z',
    academicCap:
      'M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.905 59.905 0 0 1 12 3.493a59.902 59.902 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443a55.381 55.381 0 0 1 5.25 2.882v3.675m-5.25 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z',
    documentText:
      'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
    chartBar:
      'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
    clipboard:
      'M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75',
    bookOpen:
      'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25',
    paperClip:
      'M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.12 2.122l7.81-7.81a1.5 1.5 0 0 0-2.122-2.122Z',
    megaphone:
      'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 0 0 0 9h2.25c.723 0 1.402-.03 2.09-.09m0-9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46',
    link: 'M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244',
    chevronDown: 'm19.5 8.25-7.5 7.5-7.5-7.5',
    chevronRight: 'm8.25 4.5 7.5 7.5-7.5 7.5',
  };

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', iconPaths[iconName] || iconPaths.link);
  svg.appendChild(path);

  return svg;
};

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

        console.log('Mention mousedown:', {
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
            // Fetch mention data
            const { SeqtaMentionsServiceRust } = await import(
              '../../../services/seqtaMentionsServiceRust'
            );
            mentionData = await SeqtaMentionsServiceRust.updateMentionData(
              node.attrs.id,
              node.attrs.type,
            );

            const rect = mention.getBoundingClientRect();
            const tooltip = document.createElement('div');
            tooltip.id = `seqta-tooltip-${node.attrs.id}`;
            tooltip.className = 'fixed z-[9999] pointer-events-none';
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
            console.error('Failed to show tooltip:', error);
          }
        }, 300);
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

// Suggestion configuration for SEQTA mentions
export const seqtaMentionSuggestion = {
  items: async ({
    query,
    editor,
  }: {
    query: string;
    editor?: any;
  }): Promise<SeqtaMentionItem[]> => {
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

      return results.slice(0, 100); // Return all results when filtered by category
    } catch (error) {
      console.error('Failed to fetch SEQTA mentions:', error);
      return [];
    }
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

        popup.style.position = 'absolute';
        popup.style.zIndex = '1000';
        popup.style.top = `${props.clientRect().bottom}px`;
        popup.style.left = `${props.clientRect().left}px`;
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

        if (!props.clientRect) {
          return;
        }

        popup.style.top = `${props.clientRect().bottom}px`;
        popup.style.left = `${props.clientRect().left}px`;
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

// Simple DOM-based mention list component
class MentionList {
  private container: HTMLElement;
  private selectedIndex: number = 0;
  private items: SeqtaMentionItem[] = [];
  private command: (item: SeqtaMentionItem, asCard?: boolean) => void = () => {};
  private editor: any = null;
  private collapsedCategories: Set<string> = new Set();

  constructor(options: { target: HTMLElement; props: any }) {
    const { target, props } = options;

    this.container = document.createElement('div');
    this.container.className =
      'mention-list max-w-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-y-auto z-50 max-h-96';

    target.appendChild(this.container);
    this.editor = props.editor;

    this.updateList(props);
  }

  updateList(props: any) {
    const { items = [], command, editor, query = '' } = props;
    this.items = items;
    this.command = command;
    this.editor = editor;
    this.selectedIndex = 0;

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
        'w-full px-3 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer';
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

      // Category items container
      const categoryItemsContainer = document.createElement('div');
      categoryItemsContainer.className = isCollapsed ? 'hidden' : '';
      categoryItemsContainer.setAttribute('data-category', type);

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
        itemEl.className = `w-full p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 flex items-center space-x-3 transition-colors ${globalIndex === this.selectedIndex ? 'bg-zinc-100 dark:bg-zinc-700' : ''}`;
        itemEl.setAttribute('data-index', globalIndex.toString());

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
