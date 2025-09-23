import { Extension } from '@tiptap/core';
import { PluginKey } from 'prosemirror-state';
import Suggestion from '@tiptap/suggestion';
import { SeqtaMentionsService, type SeqtaMentionItem } from '../../../services/seqtaMentionsService';

export interface SeqtaMentionOptions {
  HTMLAttributes: Record<string, any>;
  renderLabel: (props: { options: SeqtaMentionOptions; node: any }) => string;
  suggestion: Omit<any, 'editor'>;
}

export const SeqtaMentions = Extension.create<SeqtaMentionOptions>({
  name: 'seqtaMentions',

  addOptions() {
    return {
      HTMLAttributes: {},
      renderLabel({ options, node }) {
        return `@${node.attrs.label ?? node.attrs.id}`;
      },
      suggestion: {
        char: '@',
        pluginKey: new PluginKey('seqtaMentions'),
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
      mention.setAttribute('title', String(node.attrs.subtitle || node.attrs.title || ''));
      
      // Add styling based on mention type
      const typeStyles = {
        assignment: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        assessment: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        subject: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        class: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
        teacher: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
        timetable: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
      };
      
      mention.className = `seqta-mention inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${typeStyles[node.attrs.type as keyof typeof typeStyles] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'}`;
      
      mention.innerHTML = `
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-60 mr-1.5"></span>
        ${this.options.renderLabel({ options: this.options, node })}
      `;

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        mention.setAttribute(key, String(value || ''));
      });

      return {
        dom: mention,
        contentDOM: null,
        selectNode: () => {
          mention.classList.add('ProseMirror-selectednode');
        },
        deselectNode: () => {
          mention.classList.remove('ProseMirror-selectednode');
        },
      };
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: [this.name],
        attributes: {
          id: {
            default: null,
            parseHTML: element => element.getAttribute('data-id'),
            renderHTML: attributes => {
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
            parseHTML: element => element.getAttribute('data-type'),
            renderHTML: attributes => {
              if (!attributes.type) {
                return {};
              }

              return {
                'data-type': attributes.type,
              };
            },
          },
          title: {
            default: null,
          },
          subtitle: {
            default: null,
          },
          label: {
            default: null,
          },
        },
      },
    ];
  },

  parseHTML() {
    return [
      {
        tag: `span[data-type="${this.name}"]`,
      },
      {
        tag: 'span.seqta-mention',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }: { node: any; HTMLAttributes: any }) {
    return [
      'span',
      {
        ...this.options.HTMLAttributes,
        ...HTMLAttributes,
        'data-type': this.name,
        'data-id': node.attrs.id,
        'data-mention-type': node.attrs.type,
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
  items: async ({ query }: { query: string }): Promise<SeqtaMentionItem[]> => {
    console.log('SEQTA mentions search called with query:', query);
    
    try {
      const results = await SeqtaMentionsService.searchMentions(query || '');
      console.log('SEQTA mentions results:', results);
      return results.slice(0, 10); // Limit to 10 results
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
            command: (item: SeqtaMentionItem) => {
              props.command({
                id: item.id,
                type: item.type,
                title: item.title,
                subtitle: item.subtitle,
                label: item.title,
              });
            },
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
          command: (item: SeqtaMentionItem) => {
            props.command({
              id: item.id,
              type: item.type,
              title: item.title,
              subtitle: item.subtitle,
              label: item.title,
            });
          },
        });

        if (!props.clientRect) {
          return;
        }

        popup.style.top = `${props.clientRect().bottom}px`;
        popup.style.left = `${props.clientRect().left}px`;
      },

      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          component.destroy();
          return true;
        }

        return component.onKeyDown(props);
      },

      onExit() {
        component.destroy();
      },
    };
  },
};

// Simple DOM-based mention list component
class MentionList {
  private container: HTMLElement;
  private selectedIndex: number = 0;
  private items: SeqtaMentionItem[] = [];
  private command: (item: SeqtaMentionItem) => void = () => {};

  constructor(options: { target: HTMLElement; props: any }) {
    const { target, props } = options;
    
    this.container = document.createElement('div');
    this.container.className = 'mention-list max-w-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden z-50';
    
    target.appendChild(this.container);
    
    this.updateList(props);
  }

  updateList(props: any) {
    const { items = [], command } = props;
    this.items = items;
    this.command = command;
    this.selectedIndex = 0;
    
    this.container.innerHTML = '';
    
    if (items.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'p-3 text-sm text-zinc-500 dark:text-zinc-400';
      emptyState.textContent = 'No SEQTA items found';
      this.container.appendChild(emptyState);
      return;
    }

    items.forEach((item: SeqtaMentionItem, index: number) => {
      const itemEl = document.createElement('button');
      itemEl.className = `w-full p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 flex items-center space-x-3 transition-colors ${index === this.selectedIndex ? 'bg-zinc-100 dark:bg-zinc-700' : ''}`;
      itemEl.setAttribute('data-index', index.toString());
      
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
      
      itemEl.addEventListener('click', () => command(item));
      
      this.container.appendChild(itemEl);
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
