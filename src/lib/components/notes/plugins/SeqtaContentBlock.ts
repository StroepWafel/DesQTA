import { Node } from '@tiptap/core';
import { createIconSVG } from '../utils/iconUtils';
import { logger } from '../../../../utils/logger';
import {
  SeqtaMentionsServiceRust as SeqtaMentionsService,
  type SeqtaMentionItem,
} from '../../../services/seqtaMentionsServiceRust';

export interface SeqtaContentBlockOptions {
  HTMLAttributes: Record<string, any>;
}

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
      icon.className =
        'w-5 h-5 flex items-center justify-center flex-shrink-0 text-zinc-600 dark:text-zinc-400';
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
      const iconSVG = createIconSVG(
        typeIcons[blockType] || 'link',
        20,
        'w-5 h-5 text-zinc-600 dark:text-zinc-400',
      );
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
        'p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed';
      refreshBtn.appendChild(createIconSVG('arrowPath', 16, 'w-4 h-4'));
      refreshBtn.title = 'Refresh';
      let isRefreshing = false;
      refreshBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isRefreshing || !editor || typeof getPos !== 'function') return;

        isRefreshing = true;
        refreshBtn.disabled = true;
        const icon = refreshBtn.querySelector('svg');
        if (icon) {
          icon.classList.add('animate-spin');
        }

        try {
          logger.debug('SeqtaContentBlock', 'refresh', 'Refreshing content block', {
            blockId,
            blockType,
          });

          const updatedData = await SeqtaMentionsService.updateMentionData(blockId, blockType, {
            data: blockData,
          });

          if (updatedData && editor) {
            const pos = getPos();
            if (pos !== undefined && pos >= 0) {
              editor
                .chain()
                .focus()
                .updateAttributes('seqtaContentBlock', {
                  data: updatedData.data,
                  id: updatedData.id,
                  type: updatedData.type,
                })
                .run();

              logger.info('SeqtaContentBlock', 'refresh', 'Content block refreshed successfully', {
                blockId,
                blockType,
              });
            }
          }
        } catch (error) {
          logger.error('SeqtaContentBlock', 'refresh', 'Failed to refresh content block', {
            error: error instanceof Error ? error.message : String(error),
            blockId,
            blockType,
          });
        } finally {
          isRefreshing = false;
          refreshBtn.disabled = false;
          if (icon) {
            icon.classList.remove('animate-spin');
          }
        }
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

        try {
          logger.debug('SeqtaContentBlock', 'openInApp', 'Opening content block in app', {
            blockId,
            blockType,
          });

          // Build URL based on mention type (similar to SeqtaMentionDetailModal)
          let url = '/';

          if (blockType === 'assessment' || blockType === 'assignment') {
            const assessmentID = blockData.assessmentID || blockData.id;
            const metaclassID = blockData.metaclassID || blockData.metaclass || 0;
            const code = blockData.code || blockData.subjectCode;
            const dueDate = blockData.dueDate || blockData.due;

            // Try to get year from data, fallback to due date year, then current year
            let year: number;
            if (blockData.year) {
              year = blockData.year;
            } else if (dueDate) {
              try {
                const date = new Date(dueDate);
                if (!isNaN(date.getTime())) {
                  year = date.getFullYear();
                } else {
                  year = new Date().getFullYear();
                }
              } catch {
                year = new Date().getFullYear();
              }
            } else {
              year = new Date().getFullYear();
            }

            if (assessmentID) {
              url = `/assessments/${assessmentID}/${metaclassID}?year=${year}`;
            } else if (code && dueDate) {
              const dateStr = new Date(dueDate).toISOString().split('T')[0];
              url = `/assessments?code=${code}&date=${dateStr}&year=${year}`;
            } else {
              url = '/assessments';
            }
          } else if (blockType === 'class' || blockType === 'subject') {
            const code = blockData.code;
            const programme = blockData.programme;
            const metaclass = blockData.metaclass;
            const date = blockData.date || blockData.lessonDate;

            if (programme && metaclass) {
              url = `/courses?code=${code}&programme=${programme}&metaclass=${metaclass}`;
              if (date) {
                const dateStr = new Date(date).toISOString().split('T')[0];
                url += `&date=${dateStr}`;
              }
            } else if (code) {
              url = `/courses?code=${code}`;
            } else {
              url = '/courses';
            }
          } else if (blockType === 'timetable' || blockType === 'timetable_slot') {
            const date = blockData.date;
            if (date) {
              const dateStr = new Date(date).toISOString().split('T')[0];
              url = `/timetable?date=${dateStr}`;
            } else {
              url = '/timetable';
            }
          } else if (blockType === 'notice') {
            const noticeId = blockData.id || blockData.noticeId;
            const labelId = blockData.labelId || blockData.label;
            const date = blockData.date;

            url = '/notices';
            const params: string[] = [];
            if (noticeId) params.push(`item=${noticeId}`);
            if (labelId) params.push(`category=${labelId}`);
            if (date) {
              const dateStr = new Date(date).toISOString().split('T')[0];
              params.push(`date=${dateStr}`);
            }
            if (params.length > 0) {
              url += `?${params.join('&')}`;
            }
          }

          window.location.href = url;
          logger.info('SeqtaContentBlock', 'openInApp', 'Navigated to content block', {
            blockId,
            blockType,
            url,
          });
        } catch (error) {
          logger.error('SeqtaContentBlock', 'openInApp', 'Failed to open content block in app', {
            error: error instanceof Error ? error.message : String(error),
            blockId,
            blockType,
          });
        }
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
          iconWrapper.appendChild(
            createIconSVG(iconName, 16, 'w-4 h-4 text-zinc-500 dark:text-zinc-400'),
          );

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
              createInfoRow(
                'bookOpen',
                'Subject',
                blockData.subjectName || blockData.subject || 'N/A',
              ),
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
            statusDiv.textContent =
              blockData.status.charAt(0).toUpperCase() + blockData.status.slice(1);
            const row = document.createElement('div');
            row.className = 'flex items-center gap-2';
            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'flex-shrink-0';
            iconWrapper.appendChild(
              createIconSVG('link', 16, 'w-4 h-4 text-zinc-500 dark:text-zinc-400'),
            );
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
              createInfoRow(
                'bookOpen',
                'Subject',
                blockData.subjectName || blockData.subject || 'N/A',
              ),
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
              createInfoRow(
                'bookOpen',
                'Subject',
                blockData.subjectName || blockData.code || 'N/A',
              ),
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
              lessonTitle.className =
                'text-sm font-semibold text-zinc-900 dark:text-white truncate';
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
              lessonMeta.className =
                'flex items-center gap-3 mt-1.5 text-xs text-zinc-500 dark:text-zinc-400';

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
            content.appendChild(
              createInfoRow('arrowRight', 'Next Class', formatDate(blockData.nextClass)),
            );
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
            content.appendChild(
              createInfoRow('buildingOffice', 'Department', blockData.department),
            );
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
