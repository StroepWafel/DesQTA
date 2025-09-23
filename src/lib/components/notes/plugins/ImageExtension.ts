import { Node } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export interface ImageOptions {
  inline: boolean;
  allowBase64: boolean;
  HTMLAttributes: Record<string, any>;
  onImageClick?: (element: HTMLElement, img: HTMLImageElement) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageExtension: {
      /**
       * Add an image
       */
      setImage: (options: { src: string; alt?: string; title?: string }) => ReturnType;
      /**
       * Insert image from file input
       */
      insertImageFromFile: () => ReturnType;
    };
  }
}

export const ImageExtension = Node.create<ImageOptions>({
  name: 'imageExtension',

  addOptions() {
    return {
      inline: false,
      allowBase64: true,
      HTMLAttributes: {},
      onImageClick: undefined,
    };
  },

  inline() {
    return this.options.inline;
  },

  group() {
    return this.options.inline ? 'inline' : 'block';
  },

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: null,
      },
      height: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: this.options.allowBase64
          ? 'img[src]'
          : 'img[src]:not([src^="data:"])',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', { ...this.options.HTMLAttributes, ...HTMLAttributes }];
  },

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },

      insertImageFromFile:
        () =>
        ({ commands }) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.multiple = false;

          input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;

            // Check file size (limit to 10MB)
            if (file.size > 10 * 1024 * 1024) {
              alert('Image file is too large. Please choose a file smaller than 10MB.');
              return;
            }

            const reader = new FileReader();
            reader.onload = () => {
              const src = reader.result as string;
              commands.setImage({
                src,
                alt: file.name,
                title: file.name,
              });
            };
            reader.readAsDataURL(file);
          };

          input.click();
          return true;
        },
    };
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const container = document.createElement('div');
      container.className = 'image-node-view relative group';

      const img = document.createElement('img');
      img.className = 'max-w-full h-auto rounded-lg shadow-sm';
      
      // Set attributes
      Object.entries({
        ...this.options.HTMLAttributes,
        ...HTMLAttributes,
        src: node.attrs.src,
        alt: node.attrs.alt,
        title: node.attrs.title,
        width: node.attrs.width,
        height: node.attrs.height,
      }).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          img.setAttribute(key, value);
        }
      });

      // Add loading state
      img.onload = () => {
        container.classList.remove('loading');
      };

      img.onerror = () => {
        container.classList.add('error');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center';
        errorDiv.innerHTML = `
          <div class="text-red-600 dark:text-red-400 text-sm">
            Failed to load image
          </div>
          <div class="text-red-500 dark:text-red-500 text-xs mt-1">
            ${node.attrs.src}
          </div>
        `;
        container.appendChild(errorDiv);
      };

      // Add click handler for image controls
      if (this.options.onImageClick) {
        img.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.options.onImageClick?.(container, img);
        });
        img.style.cursor = 'pointer';
      }

      // Add hover controls
      const controls = document.createElement('div');
      controls.className = 'absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1';
      
      // Resize handle
      const resizeBtn = document.createElement('button');
      resizeBtn.className = 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors';
      resizeBtn.innerHTML = '⤢';
      resizeBtn.title = 'Resize image';
      resizeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        showResizeDialog(node, getPos, editor);
      };

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'bg-red-500 text-white rounded p-1 text-xs hover:bg-red-600 transition-colors';
      deleteBtn.innerHTML = '×';
      deleteBtn.title = 'Remove image';
      deleteBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof getPos === 'function') {
          const pos = getPos();
          editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
        }
      };

      controls.appendChild(resizeBtn);
      controls.appendChild(deleteBtn);

      container.appendChild(img);
      container.appendChild(controls);

      return {
        dom: container,
        contentDOM: null,
        selectNode: () => {
          container.classList.add('ProseMirror-selectednode');
        },
        deselectNode: () => {
          container.classList.remove('ProseMirror-selectednode');
        },
      };
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('imageExtension'),
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = [];
            
            state.doc.descendants((node, pos) => {
              if (node.type.name === this.name) {
                // Add loading decoration for images that haven't loaded yet
                if (node.attrs.src && node.attrs.src.startsWith('data:')) {
                  // Base64 images - show loading state
                  decorations.push(
                    Decoration.node(pos, pos + node.nodeSize, {
                      class: 'image-loading',
                    })
                  );
                }
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },

          // Handle drag and drop
          handleDOMEvents: {
            dragover: (view, event) => {
              event.preventDefault();
              return false;
            },
            
            drop: (view, event) => {
              const files = Array.from(event.dataTransfer?.files || []);
              const imageFiles = files.filter(file => file.type.startsWith('image/'));
              
              if (imageFiles.length === 0) {
                return false;
              }

              event.preventDefault();

              const { schema } = view.state;
              const coordinates = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });

              if (!coordinates) return false;

              imageFiles.forEach((file) => {
                // Check file size
                if (file.size > 10 * 1024 * 1024) {
                  alert(`Image "${file.name}" is too large. Please choose files smaller than 10MB.`);
                  return;
                }

                const reader = new FileReader();
                reader.onload = () => {
                  const node = schema.nodes.imageExtension.create({
                    src: reader.result,
                    alt: file.name,
                    title: file.name,
                  });

                  const transaction = view.state.tr.insert(coordinates.pos, node);
                  view.dispatch(transaction);
                };
                reader.readAsDataURL(file);
              });

              return true;
            },
          },
        },
      }),
    ];
  },

});

// Helper function for resize dialog
function showResizeDialog(node: any, getPos: any, editor: any) {
    const currentWidth = node.attrs.width || 'auto';
    const currentHeight = node.attrs.height || 'auto';
    
    const width = prompt(`Enter image width (current: ${currentWidth}):`, currentWidth === 'auto' ? '' : currentWidth);
    if (width === null) return; // User cancelled
    
    const height = prompt(`Enter image height (current: ${currentHeight}):`, currentHeight === 'auto' ? '' : currentHeight);
    if (height === null) return; // User cancelled

    if (typeof getPos === 'function') {
      const pos = getPos();
      editor
        .chain()
        .focus()
        .setNodeMarkup(pos, undefined, {
          ...node.attrs,
          width: width || null,
          height: height || null,
        })
        .run();
    }
}
