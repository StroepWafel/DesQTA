import { saveAs } from 'file-saver';
import { createEvents } from 'ics';
import jsPDF from 'jspdf';
import type { TimetableLesson } from '../types/timetable';
import { formatDate, parseDate } from './timetableUtils';

/**
 * Export lessons to CSV format. Returns true if export succeeded.
 */
export function exportToCSV(lessons: TimetableLesson[], weekStart: Date): boolean {
  const headers = ['Date', 'Day', 'Subject', 'Code', 'Time', 'Teacher', 'Room'];
  const rows = lessons.map((lesson) => {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const dayName = dayNames[lesson.dayIdx] || '';

    return [
      lesson.date,
      dayName,
      lesson.description,
      lesson.code,
      `${lesson.from} - ${lesson.until}`,
      lesson.staff || '',
      lesson.room || '',
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const fileName = `timetable_${formatDate(weekStart)}.csv`;
  saveAs(blob, fileName);
  return true;
}

// ---------- PDF grid helpers ----------

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => Number(n));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad(h)}:${pad(m)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  let h = (hex || '').trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(h, 16);
  if (Number.isNaN(num)) return [180, 180, 180];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** Mix a colour toward white by `amount` (0..1). 0 = original, 1 = white. */
function tint(rgb: [number, number, number], amount: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, amount));
  return [
    Math.round(rgb[0] + (255 - rgb[0]) * t),
    Math.round(rgb[1] + (255 - rgb[1]) * t),
    Math.round(rgb[2] + (255 - rgb[2]) * t),
  ];
}

/** Pick black or white for legible text on top of a colored block. */
function readableTextOn(rgb: [number, number, number]): [number, number, number] {
  // Luminance approximation per WCAG.
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return lum > 0.6 ? [30, 30, 30] : [255, 255, 255];
}

function getDateForDay(weekStart: Date, dayIdx: number): Date {
  const d = new Date(weekStart);
  d.setDate(weekStart.getDate() + dayIdx);
  return d;
}

/**
 * Compute the inclusive time range used by the lessons, rounded out to nearest
 * hour. Returns `{ startMin, endMin }` in minutes-from-midnight.
 */
function getTimeRange(lessons: TimetableLesson[]): { startMin: number; endMin: number } {
  if (lessons.length === 0) {
    return { startMin: 8 * 60, endMin: 16 * 60 };
  }
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;
  for (const l of lessons) {
    const s = timeToMinutes(l.from);
    const e = timeToMinutes(l.until);
    if (s < minStart) minStart = s;
    if (e > maxEnd) maxEnd = e;
  }
  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) {
    return { startMin: 8 * 60, endMin: 16 * 60 };
  }
  // Round down to hour for start, up to hour for end.
  minStart = Math.floor(minStart / 60) * 60;
  maxEnd = Math.ceil(maxEnd / 60) * 60;
  // Always show at least an 8-hour window.
  if (maxEnd - minStart < 8 * 60) maxEnd = minStart + 8 * 60;
  return { startMin: minStart, endMin: maxEnd };
}

/**
 * Export lessons to a SEQTA-style PDF grid (landscape A4).
 * Day columns (Mon-Fri) along the top, time rows down the left.
 * Lessons are drawn as coloured rectangles spanning their time span, with
 * a strong left accent bar matching the lesson colour. Designed to read
 * naturally at a glance the way the SEQTA web export does.
 */
export function exportToPDF(lessons: TimetableLesson[], weekStart: Date): boolean {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth(); // ~297
  const pageH = doc.internal.pageSize.getHeight(); // ~210

  // Layout constants (mm)
  const margin = 8;
  const headerH = 16;
  const dayHeaderH = 10;
  const gutterW = 18; // time labels on the left
  const gridTop = margin + headerH + dayHeaderH;
  const gridBottom = pageH - margin;
  const gridLeft = margin + gutterW;
  const gridRight = pageW - margin;
  const gridW = gridRight - gridLeft;
  const gridH = gridBottom - gridTop;
  const dayCount = 5;
  const colW = gridW / dayCount;

  // Time axis
  const { startMin, endMin } = getTimeRange(lessons);
  const totalMin = endMin - startMin;
  const pxPerMin = gridH / totalMin;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text('Weekly Timetable', margin, margin + 6);

  const endDate = getDateForDay(weekStart, dayCount - 1);
  const rangeLabel = `${weekStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${endDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(rangeLabel, margin, margin + 12);

  // Day header row
  const dayNamesShort = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  for (let i = 0; i < dayCount; i++) {
    const x = gridLeft + i * colW;
    const date = getDateForDay(weekStart, i);
    const label = `${dayNamesShort[i]} ${date.getDate()}`;
    doc.text(label, x + colW / 2, margin + headerH + 6, { align: 'center' });
  }

  // Time gutter labels (every full hour)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  for (let m = startMin; m <= endMin; m += 60) {
    const y = gridTop + (m - startMin) * pxPerMin;
    doc.text(minutesToHHMM(m), gridLeft - 1.5, y + 1.5, { align: 'right' });
  }

  // Grid lines: faint horizontals every 30 min, full hours slightly darker.
  doc.setLineWidth(0.1);
  for (let m = startMin; m <= endMin; m += 30) {
    const y = gridTop + (m - startMin) * pxPerMin;
    const isHour = m % 60 === 0;
    doc.setDrawColor(isHour ? 200 : 230, isHour ? 200 : 230, isHour ? 200 : 230);
    doc.line(gridLeft, y, gridRight, y);
  }
  // Vertical column dividers
  doc.setDrawColor(200, 200, 200);
  for (let i = 0; i <= dayCount; i++) {
    const x = gridLeft + i * colW;
    doc.line(x, gridTop, x, gridBottom);
  }
  // Top and bottom of grid
  doc.line(gridLeft, gridTop, gridRight, gridTop);

  // Lesson blocks
  for (const l of lessons) {
    if (l.dayIdx < 0 || l.dayIdx >= dayCount) continue;
    const startM = timeToMinutes(l.from);
    const endM = timeToMinutes(l.until);
    if (endM <= startMin || startM >= endMin) continue;

    const clampStart = Math.max(startM, startMin);
    const clampEnd = Math.min(endM, endMin);
    const x = gridLeft + l.dayIdx * colW + 0.6;
    const y = gridTop + (clampStart - startMin) * pxPerMin + 0.3;
    const w = colW - 1.2;
    const h = (clampEnd - clampStart) * pxPerMin - 0.6;
    if (h <= 1) continue;

    const baseRgb = hexToRgb(l.colour || '#8e8e8e');
    const fillRgb = tint(baseRgb, 0.82); // soft fill (~18% saturation)
    const textRgb = readableTextOn(fillRgb);

    // Soft body fill
    doc.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
    doc.setDrawColor(baseRgb[0], baseRgb[1], baseRgb[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, h, 1, 1, 'FD');

    // Strong left accent bar
    doc.setFillColor(baseRgb[0], baseRgb[1], baseRgb[2]);
    doc.rect(x, y, 1.6, h, 'F');

    // Text content: code (bold), time, teacher, room
    const padX = 3.5;
    let cursorY = y + 4;
    doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);

    // Subject code (or first 8 chars of description) bold
    const codeLabel = l.code || l.description.slice(0, 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(codeLabel, x + padX, cursorY);
    cursorY += 3.5;

    if (h > 8) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`${l.from}-${l.until}`, x + padX, cursorY);
      cursorY += 3;
    }
    if (h > 14 && l.staff) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      const teacher = l.staff.length > 18 ? l.staff.slice(0, 17) + '\u2026' : l.staff;
      doc.text(teacher, x + padX, cursorY);
      cursorY += 3;
    }
    if (h > 20 && l.room) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      const room = l.room.startsWith('Room') ? l.room : `Room ${l.room}`;
      doc.text(room.length > 18 ? room.slice(0, 17) + '\u2026' : room, x + padX, cursorY);
    }
  }

  // Footer credit
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Generated by DesQTA', margin, pageH - 3);

  const fileName = `timetable_${formatDate(weekStart)}.pdf`;
  doc.save(fileName);
  return true;
}

/**
 * Export lessons to iCal format. Returns true if export succeeded.
 */
export function exportToiCal(lessons: TimetableLesson[], weekStart: Date): boolean {
  const events = lessons.map((lesson) => {
    const date = parseDate(lesson.date);
    const [startHour, startMinute] = lesson.from.split(':').map(Number);
    const [endHour, endMinute] = lesson.until.split(':').map(Number);

    const start = [
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      startHour,
      startMinute,
    ] as [number, number, number, number, number];

    const end = [
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      endHour,
      endMinute,
    ] as [number, number, number, number, number];

    const description = [
      lesson.staff ? `Teacher: ${lesson.staff}` : '',
      lesson.room ? `Room: ${lesson.room}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      title: lesson.description,
      description: description || undefined,
      location: lesson.room || undefined,
      start,
      end,
      calName: 'DesQTA Timetable',
    };
  });

  const { error, value } = createEvents(events);

  if (error) {
    console.error('Error creating iCal events:', error);
    return false;
  }

  if (value) {
    const blob = new Blob([value], { type: 'text/calendar;charset=utf-8;' });
    const fileName = `timetable_${formatDate(weekStart)}.ics`;
    saveAs(blob, fileName);
    return true;
  }
  return false;
}
