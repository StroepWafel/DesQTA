import { Node } from '@tiptap/core';

export interface SeqtaContentBlockOptions {
  HTMLAttributes: Record<string, any>;
}

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
    calendar: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
    user: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z',
    mapPin: 'M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z',
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
    scale:
      'M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.224 48.224 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.589-1.202L18.75 4.971Zm-16.5.52c1.01-.203 2.01-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.589-1.202L5.25 4.971Z',
    arrowPath:
      'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99',
    arrowTopRightOnSquare:
      'M13.5 6.75a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0V8.25h-4.5a.75.75 0 0 1-.75-.75ZM4.5 4.5a.75.75 0 0 0-.75.75v13.5c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75V9a.75.75 0 0 0-1.5 0v9.75H5.25V5.25H15a.75.75 0 0 0 0-1.5H4.5Z',
    envelope:
      'M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75',
    buildingOffice:
      'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z',
    arrowRight:
      'M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3',
    megaphone:
      'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 0 0 0 9h2.25c.723 0 1.402-.03 2.09-.09m0-9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46',
    link:
      'M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244',
  };

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', iconPaths[iconName] || iconPaths.link);
  svg.appendChild(path);

  return svg;
};

export const SeqtaContentBlock = Node.create<SeqtaContentBlockOptions>({
  name: 'seqtaContentBlock',

  group: 'block',

  content: '',

  atom: true,

  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      type: {
        default: 'assessment',
        parseHTML: (element) => element.getAttribute('data-block-type'),
        renderHTML: (attributes) => {
          if (!attributes.type) {
            return {};
          }
          return {
            'data-block-type': attributes.type,
          };
        },
      },
      data: {
        default: null,
        parseHTML: (element) => {
          const dataAttr = element.getAttribute('data-block-data');
          return dataAttr ? JSON.parse(dataAttr) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.data) {
            return {};
          }
          return {
            'data-block-data': JSON.stringify(attributes.data),
          };
        },
      },
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-block-id'),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return {};
          }
          return {
            'data-block-id': attributes.id,
          };
        },
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const width = element.getAttribute('data-width');
          return width ? parseInt(width, 10) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) {
            return {};
          }
          return {
            'data-width': attributes.width.toString(),
            style: `width: ${attributes.width}px;`,
          };
        },
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const height = element.getAttribute('data-height');
          return height ? parseInt(height, 10) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.height) {
            return {};
          }
          return {
            'data-height': attributes.height.toString(),
            style: attributes.width
              ? `width: ${attributes.width}px; height: ${attributes.height}px;`
              : `height: ${attributes.height}px;`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-block-type]',
        getAttrs: (element) => {
          if (typeof element === 'string') return false;
          const el = element as HTMLElement;
          return el.hasAttribute('data-block-type') ? {} : false;
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const styles: string[] = [];
    if (node.attrs.width) {
      styles.push(`width: ${node.attrs.width}px`);
    }
    if (node.attrs.height) {
      styles.push(`height: ${node.attrs.height}px`);
    }

    return [
      'div',
      {
        ...this.options.HTMLAttributes,
        ...HTMLAttributes,
        class: 'seqta-content-block',
        'data-block-type': node.attrs.type,
        'data-block-id': node.attrs.id,
        'data-block-data': node.attrs.data ? JSON.stringify(node.attrs.data) : undefined,
        'data-width': node.attrs.width || undefined,
        'data-height': node.attrs.height || undefined,
        style: styles.length > 0 ? styles.join('; ') : undefined,
      },
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }: { node: any; getPos?: () => number; editor?: any }) => {
      const container = document.createElement('div');
      container.className =
        'seqta-content-block-card relative group p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-800/50 dark:to-zinc-900/50 shadow-md hover:shadow-lg transition-all duration-200 my-4';
      container.style.position = 'relative';
      container.style.minWidth = '200px';
      container.style.minHeight = '120px';

      // Apply width/height if set
      if (node.attrs.width) {
        container.style.width = `${node.attrs.width}px`;
      }
      if (node.attrs.height) {
        container.style.height = `${node.attrs.height}px`;
      }

      const blockData = node.attrs.data || {};
      const blockType = node.attrs.type || 'assessment';
      const blockId = node.attrs.id || '';

      // Drag handle
      const dragHandle = document.createElement('div');
      dragHandle.className =
        'absolute top-2 left-2 w-6 h-6 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-100 dark:bg-zinc-700 rounded text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600';
      // Create drag handle icon (three horizontal lines)
      const dragIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      dragIcon.setAttribute('width', '16');
      dragIcon.setAttribute('height', '16');
      dragIcon.setAttribute('viewBox', '0 0 24 24');
      dragIcon.setAttribute('fill', 'none');
      dragIcon.setAttribute('stroke', 'currentColor');
      dragIcon.setAttribute('stroke-width', '2');
      dragIcon.setAttribute('stroke-linecap', 'round');
      dragIcon.setAttribute('stroke-linejoin', 'round');
      dragIcon.setAttribute('class', 'w-4 h-4');
      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.setAttribute('x1', '5');
      line1.setAttribute('y1', '7');
      line1.setAttribute('x2', '19');
      line1.setAttribute('y2', '7');
      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.setAttribute('x1', '5');
      line2.setAttribute('y1', '12');
      line2.setAttribute('x2', '19');
      line2.setAttribute('y2', '12');
      const line3 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line3.setAttribute('x1', '5');
      line3.setAttribute('y1', '17');
      line3.setAttribute('x2', '19');
      line3.setAttribute('y2', '17');
      dragIcon.appendChild(line1);
      dragIcon.appendChild(line2);
      dragIcon.appendChild(line3);
      dragHandle.appendChild(dragIcon);
      dragHandle.setAttribute('data-drag-handle', 'true');
      dragHandle.title = 'Drag to move';

      // Resize handle (bottom-right corner)
      const resizeHandle = document.createElement('div');
      resizeHandle.className =
        'absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-200 dark:bg-zinc-600 border-t border-l border-zinc-300 dark:border-zinc-500 rounded-tl';
      resizeHandle.setAttribute('data-resize-handle', 'true');
      resizeHandle.title = 'Drag to resize';

      // Resize functionality
      let isResizing = false;
      let startX = 0;
      let startY = 0;
      let startWidth = 0;
      let startHeight = 0;

      resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = container.offsetWidth;
        startHeight = container.offsetHeight;

        const handleMouseMove = (e: MouseEvent) => {
          if (!isResizing) return;
          const deltaX = e.clientX - startX;
          const deltaY = e.clientY - startY;
          const newWidth = Math.max(200, startWidth + deltaX);
          const newHeight = Math.max(120, startHeight + deltaY);

          container.style.width = `${newWidth}px`;
          container.style.height = `${newHeight}px`;
        };

        const handleMouseUp = () => {
          isResizing = false;
          if (editor && typeof getPos === 'function') {
            const pos = getPos();
            if (pos !== undefined && pos >= 0) {
              const currentWidth = container.offsetWidth;
              const currentHeight = container.offsetHeight;
              editor
                .chain()
                .focus()
                .updateAttributes('seqtaContentBlock', {
                  width: currentWidth,
                  height: currentHeight,
                })
                .run();
            }
          }
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      });

      // Header
      const header = document.createElement('div');
      header.className = 'flex items-start justify-between mb-3 pr-8';

      const headerLeft = document.createElement('div');
      headerLeft.className = 'flex items-center gap-2 flex-1';

      // Icon based on type
      const icon = document.createElement('div');
      icon.className = 'w-5 h-5 flex items-center justify-center flex-shrink-0 text-zinc-600 dark:text-zinc-400';
      const typeIcons: Record<string, string> = {
        assessment: 'chartBar',
        assignment: 'documentText',
        homework: 'clipboard',
        class: 'academicCap',
        subject: 'bookOpen',
        timetable: 'calendar',
        timetable_slot: 'clock',
        notice: 'megaphone',
        teacher: 'user',
        lesson_content: 'bookOpen',
      };
      const iconSVG = createIconSVG(typeIcons[blockType] || 'link', 20, 'w-5 h-5 text-zinc-600 dark:text-zinc-400');
      icon.appendChild(iconSVG);

      const titleWrapper = document.createElement('div');
      titleWrapper.className = 'flex-1 min-w-0';
      const title = document.createElement('div');
      title.className = 'text-sm font-semibold text-zinc-900 dark:text-white truncate';
      title.textContent = blockData.title || blockData.name || 'Content Block';

      const subtitle = document.createElement('div');
      subtitle.className = 'text-xs text-zinc-500 dark:text-zinc-400 truncate';
      if (blockData.subtitle) {
        subtitle.textContent = blockData.subtitle;
      }

      titleWrapper.appendChild(title);
      if (blockData.subtitle) {
        titleWrapper.appendChild(subtitle);
      }

      headerLeft.appendChild(icon);
      headerLeft.appendChild(titleWrapper);

      const headerRight = document.createElement('div');
      headerRight.className = 'flex items-center gap-1 flex-shrink-0';

      // Refresh button
      const refreshBtn = document.createElement('button');
      refreshBtn.className =
        'p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors flex items-center justify-center';
      refreshBtn.appendChild(createIconSVG('arrowPath', 16, 'w-4 h-4'));
      refreshBtn.title = 'Refresh';
      refreshBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Refresh clicked for block:', blockId);
      };

      // External link button
      const linkBtn = document.createElement('button');
      linkBtn.className =
        'p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors flex items-center justify-center';
      linkBtn.appendChild(createIconSVG('arrowTopRightOnSquare', 16, 'w-4 h-4'));
      linkBtn.title = 'Open in app';
      linkBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Open in app clicked for block:', blockId);
      };

      headerRight.appendChild(refreshBtn);
      headerRight.appendChild(linkBtn);

      header.appendChild(headerLeft);
      header.appendChild(headerRight);

      // Content
      const content = document.createElement('div');
      content.className = 'space-y-2';

      // Type-specific content rendering
      const renderContent = () => {
        content.innerHTML = '';

        // Helper function to create info row
        const createInfoRow = (iconName: string, label: string, value: string) => {
          const row = document.createElement('div');
          row.className = 'flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300';
          
          const iconWrapper = document.createElement('div');
          iconWrapper.className = 'flex-shrink-0';
          iconWrapper.appendChild(createIconSVG(iconName, 16, 'w-4 h-4 text-zinc-500 dark:text-zinc-400'));
          
          const labelSpan = document.createElement('span');
          labelSpan.className = 'font-medium';
          labelSpan.textContent = `${label}:`;
          
          const valueSpan = document.createElement('span');
          valueSpan.textContent = value;
          
          row.appendChild(iconWrapper);
          row.appendChild(labelSpan);
          row.appendChild(valueSpan);
          
          return row;
        };

        // Helper function to format date
        const formatDate = (dateStr: string) => {
          try {
            return new Date(dateStr).toLocaleDateString('en-AU', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
          } catch {
            return dateStr;
          }
        };

        // Helper function to format time (12-hour)
        const formatTime = (timeStr: string) => {
          if (!timeStr || !timeStr.includes(':')) return timeStr;
          const [hours, minutes] = timeStr.split(':').map(Number);
          const period = hours >= 12 ? 'PM' : 'AM';
          const hours12 = hours % 12 || 12;
          return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
        };

        // Assessment/Assignment
        if (blockType === 'assessment' || blockType === 'assignment') {
          if (blockData.dueDate || blockData.due) {
            content.appendChild(
              createInfoRow('clock', 'Due', formatDate(blockData.dueDate || blockData.due)),
            );
          }
          if (blockData.subject || blockData.subjectName) {
            content.appendChild(
              createInfoRow('bookOpen', 'Subject', blockData.subjectName || blockData.subject || 'N/A'),
            );
          }
          if (blockData.weight) {
            content.appendChild(createInfoRow('scale', 'Weight', `${blockData.weight}%`));
          }
          if (blockData.status) {
            const statusColors: Record<string, string> = {
              overdue: 'text-red-600 dark:text-red-400',
              pending: 'text-yellow-600 dark:text-yellow-400',
              submitted: 'text-green-600 dark:text-green-400',
            };
            const statusDiv = document.createElement('div');
            statusDiv.className = `inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
              statusColors[blockData.status] || 'text-zinc-600 dark:text-zinc-400'
            }`;
            statusDiv.textContent = blockData.status.charAt(0).toUpperCase() + blockData.status.slice(1);
            const row = document.createElement('div');
            row.className = 'flex items-center gap-2';
            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'flex-shrink-0';
            iconWrapper.appendChild(createIconSVG('link', 16, 'w-4 h-4 text-zinc-500 dark:text-zinc-400'));
            const labelText = document.createTextNode('Status: ');
            row.appendChild(iconWrapper);
            row.appendChild(labelText);
            row.appendChild(statusDiv);
            content.appendChild(row);
          }
        }

        // Homework
        if (blockType === 'homework') {
          if (blockData.dueDate || blockData.due) {
            content.appendChild(
              createInfoRow('clock', 'Due', formatDate(blockData.dueDate || blockData.due)),
            );
          }
          if (blockData.subject || blockData.subjectName) {
            content.appendChild(
              createInfoRow('bookOpen', 'Subject', blockData.subjectName || blockData.subject || 'N/A'),
            );
          }
          if (blockData.teacher) {
            content.appendChild(createInfoRow('user', 'Teacher', blockData.teacher));
          }
        }

        // Timetable Slot
        if (blockType === 'timetable_slot') {
          if (blockData.date) {
            content.appendChild(createInfoRow('calendar', 'Date', formatDate(blockData.date)));
          }
          if (blockData.from12 || blockData.from) {
            const timeStr = blockData.from12
              ? `${blockData.from12} - ${blockData.until12 || blockData.until || ''}`
              : `${formatTime(blockData.from)} - ${formatTime(blockData.until || '')}`;
            content.appendChild(createInfoRow('clock', 'Time', timeStr));
          }
          if (blockData.subjectName || blockData.code) {
            content.appendChild(
              createInfoRow('bookOpen', 'Subject', blockData.subjectName || blockData.code || 'N/A'),
            );
          }
          if (blockData.room) {
            content.appendChild(createInfoRow('mapPin', 'Room', blockData.room));
          }
          if (blockData.teacher) {
            content.appendChild(createInfoRow('user', 'Teacher', blockData.teacher));
          }
        }

        // Timetable (full day)
        if (blockType === 'timetable') {
          if (blockData.date) {
            content.appendChild(createInfoRow('calendar', 'Date', formatDate(blockData.date)));
          }
          if (blockData.classCount || blockData.lessons?.length) {
            const count = blockData.classCount || blockData.lessons?.length || 0;
            content.appendChild(createInfoRow('bookOpen', 'Classes', `${count} scheduled`));
          }
          if (blockData.lessons && blockData.lessons.length > 0) {
            // Sort lessons by time
            const sortedLessons = [...blockData.lessons].sort((a: any, b: any) => {
              const timeA = a.from || a.from12 || '';
              const timeB = b.from || b.from12 || '';
              return timeA.localeCompare(timeB);
            });

            const lessonsList = document.createElement('div');
            lessonsList.className = 'mt-3 space-y-2';

            sortedLessons.forEach((lesson: any) => {
              const lessonCard = document.createElement('div');
              lessonCard.className =
                'p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700';

              const lessonHeader = document.createElement('div');
              lessonHeader.className = 'flex items-start justify-between gap-2 mb-1';

              const lessonLeft = document.createElement('div');
              lessonLeft.className = 'flex-1 min-w-0';

              const lessonTitle = document.createElement('div');
              lessonTitle.className = 'text-sm font-semibold text-zinc-900 dark:text-white truncate';
              lessonTitle.textContent =
                lesson.subjectName || lesson.code || lesson.title || 'Lesson';

              const lessonTime = document.createElement('div');
              lessonTime.className = 'text-xs text-zinc-500 dark:text-zinc-400';
              const timeStr = lesson.from12
                ? `${lesson.from12} - ${lesson.until12 || lesson.until || ''}`
                : lesson.from
                  ? `${formatTime(lesson.from)} - ${formatTime(lesson.until || '')}`
                  : '';
              lessonTime.textContent = timeStr;

              lessonLeft.appendChild(lessonTitle);
              lessonLeft.appendChild(lessonTime);

              const lessonRight = document.createElement('div');
              lessonRight.className = 'flex flex-col items-end gap-1 flex-shrink-0';

              if (lesson.room) {
                const roomBadge = document.createElement('div');
                roomBadge.className =
                  'text-xs px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300';
                roomBadge.textContent = lesson.room;
                lessonRight.appendChild(roomBadge);
              }

              lessonHeader.appendChild(lessonLeft);
              lessonHeader.appendChild(lessonRight);

              const lessonMeta = document.createElement('div');
              lessonMeta.className = 'flex items-center gap-3 mt-1.5 text-xs text-zinc-500 dark:text-zinc-400';

              if (lesson.teacher) {
                const teacherSpan = document.createElement('span');
                teacherSpan.className = 'flex items-center gap-1';
                const teacherIcon = createIconSVG('user', 14, 'w-3.5 h-3.5');
                teacherSpan.appendChild(teacherIcon);
                teacherSpan.appendChild(document.createTextNode(lesson.teacher));
                lessonMeta.appendChild(teacherSpan);
              }

              lessonCard.appendChild(lessonHeader);
              if (lesson.teacher) {
                lessonCard.appendChild(lessonMeta);
              }

              lessonsList.appendChild(lessonCard);
            });

            content.appendChild(lessonsList);
          } else {
            // No lessons message
            const noLessons = document.createElement('div');
            noLessons.className =
              'mt-2 text-sm text-zinc-500 dark:text-zinc-400 italic text-center py-2';
            noLessons.textContent = 'No classes scheduled for this day';
            content.appendChild(noLessons);
          }
        }

        // Class/Subject
        if (blockType === 'class' || blockType === 'subject') {
          if (blockData.code) {
            content.appendChild(createInfoRow('documentText', 'Code', blockData.code));
          }
          if (blockData.teacher) {
            content.appendChild(createInfoRow('user', 'Teacher', blockData.teacher));
          }
          if (blockData.year) {
            content.appendChild(createInfoRow('calendar', 'Year', blockData.year.toString()));
          }
          if (blockData.nextClass) {
            content.appendChild(createInfoRow('arrowRight', 'Next Class', formatDate(blockData.nextClass)));
          }
          if (blockData.room) {
            content.appendChild(createInfoRow('mapPin', 'Room', blockData.room));
          }
        }

        // Notice
        if (blockType === 'notice') {
          if (blockData.author) {
            content.appendChild(createInfoRow('user', 'Author', blockData.author));
          }
          if (blockData.date) {
            content.appendChild(createInfoRow('calendar', 'Date', formatDate(blockData.date)));
          }
          if (blockData.content) {
            const contentDiv = document.createElement('div');
            contentDiv.className =
              'pt-2 border-t border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3';
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = blockData.content;
            contentDiv.textContent = tempDiv.textContent || '';
            content.appendChild(contentDiv);
          }
        }

        // Teacher
        if (blockType === 'teacher') {
          if (blockData.email) {
            content.appendChild(createInfoRow('envelope', 'Email', blockData.email));
          }
          if (blockData.department) {
            content.appendChild(createInfoRow('buildingOffice', 'Department', blockData.department));
          }
        }

        // Lesson Content
        if (blockType === 'lesson_content') {
          if (blockData.date) {
            content.appendChild(createInfoRow('calendar', 'Date', formatDate(blockData.date)));
          }
          if (blockData.subject || blockData.code) {
            content.appendChild(
              createInfoRow('bookOpen', 'Subject', blockData.subject || blockData.code || 'N/A'),
            );
          }
          if (blockData.attachments && blockData.attachments.length > 0) {
            content.appendChild(
              createInfoRow('paperClip', 'Attachments', `${blockData.attachments.length} file(s)`),
            );
          }
        }

        // Description (fallback for any type)
        if (blockData.description && !['notice', 'lesson_content'].includes(blockType)) {
          const descDiv = document.createElement('div');
          descDiv.className = 'pt-2 border-t border-zinc-200 dark:border-zinc-700';
          const descText = document.createElement('div');
          descText.className = 'text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3';
          descText.textContent = blockData.description;
          descDiv.appendChild(descText);
          content.appendChild(descDiv);
        }
      };

      renderContent();

      container.appendChild(dragHandle);
      container.appendChild(resizeHandle);
      container.appendChild(header);
      container.appendChild(content);

      return {
        dom: container,
        contentDOM: null,
        selectNode: () => {
          container.classList.add('ProseMirror-selectednode');
        },
        deselectNode: () => {
          container.classList.remove('ProseMirror-selectednode');
        },
        destroy: () => {
          // Cleanup if needed
        },
      };
    };
  },
});
