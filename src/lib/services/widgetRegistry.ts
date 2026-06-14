import type { WidgetDefinition, WidgetType } from '../types/widgets';
import MessagesPreview from '../components/MessagesPreview.svelte';
import NoticesPane from '../components/NoticesPane.svelte';
import RecentNews from '../components/RecentNews.svelte';
import WelcomePortal from '../components/WelcomePortal.svelte';
import ShortcutsWidget from '../components/ShortcutsWidget.svelte';
import {
  ChatBubbleLeftRight,
  CalendarDays,
  Bell,
  Newspaper,
  GlobeAlt,
  Link,
  ChartBar,
  AcademicCap,
  Calendar,
  PencilSquare,
  Cloud,
} from 'svelte-hero-icons';

// Consolidated widget components
import GradeTrendsWidget from '../components/widgets/GradeTrendsWidget.svelte';
import StudyTimeTrackerWidget from '../components/widgets/StudyTimeTrackerWidget.svelte';
import DeadlinesCalendarWidget from '../components/widgets/DeadlinesCalendarWidget.svelte';
import QuickNotesWidget from '../components/widgets/QuickNotesWidget.svelte';
import WeatherWidget from '../components/widgets/WeatherWidget.svelte';
import TimetableWidget from '../components/widgets/TimetableWidget.svelte';

/**
 * Single source of truth for what widgets exist on the dashboard. To
 * register a widget:
 * 1. Add its type to `WidgetType` in `src/lib/types/widgets.ts`.
 * 2. Add an entry below with category, sizes, mobile config and (optional)
 *    settings schema.
 *
 * `resizable: false` opts a widget out of being resized on the grid (useful
 * for fixed-aspect widgets). `category` powers the grouping in the Add
 * Widget dialog. `mobileSize`/`mobileOrder` drive the dedicated mobile
 * vertical-stack layout.
 */
export const widgetRegistry = new Map<WidgetType, WidgetDefinition>([
  [
    'timetable',
    {
      type: 'timetable',
      name: 'Timetable',
      description: 'Day / week / list view of your timetable, including a built-in Today mode.',
      category: 'schedule',
      icon: CalendarDays,
      defaultSize: { w: 8, h: 6 },
      minSize: { w: 4, h: 5 },
      maxSize: { w: 12, h: 12 },
      mobileSize: { w: 12, h: 7 },
      mobileOrder: 1,
      resizable: true,
      component: TimetableWidget,
      defaultSettings: {
        viewMode: 'week',
        timeRange: { start: '08:00', end: '16:00' },
        showTeacher: true,
        showRoom: true,
        showAttendance: true,
        showEmptyPeriods: false,
        density: 'normal',
        defaultView: 'week',
      },
      settingsSchema: {
        viewMode: {
          type: 'select',
          label: 'Default view',
          description: 'Choose what the timetable shows when the dashboard opens.',
          default: 'week',
          options: [
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'Week' },
            { value: 'day', label: 'Day' },
            { value: 'list', label: 'List' },
          ],
        },
        showTeacher: {
          type: 'boolean',
          label: 'Show teacher names',
          default: true,
        },
        showRoom: {
          type: 'boolean',
          label: 'Show room numbers',
          default: true,
        },
        showAttendance: {
          type: 'boolean',
          label: 'Show attendance status',
          default: true,
        },
        density: {
          type: 'select',
          label: 'Display density',
          default: 'normal',
          options: [
            { value: 'compact', label: 'Compact' },
            { value: 'normal', label: 'Normal' },
            { value: 'comfortable', label: 'Comfortable' },
          ],
        },
      },
    },
  ],
  [
    'deadlines',
    {
      type: 'deadlines',
      name: 'Deadlines',
      description: 'Upcoming assessments and homework, as a list or compact calendar.',
      category: 'academic',
      icon: Calendar,
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 4, h: 5 },
      maxSize: { w: 12, h: 12 },
      mobileSize: { w: 12, h: 6 },
      mobileOrder: 2,
      resizable: true,
      component: DeadlinesCalendarWidget,
      defaultSettings: {
        view: 'list',
        daysToShow: '14',
        showCompleted: false,
      },
      settingsSchema: {
        view: {
          type: 'select',
          label: 'Default view',
          description: 'List is best for scanning, calendar gives you a month-at-a-glance.',
          default: 'list',
          options: [
            { value: 'list', label: 'List' },
            { value: 'calendar', label: 'Calendar' },
          ],
        },
        daysToShow: {
          type: 'select',
          label: 'Days to show (list view)',
          default: '14',
          options: [
            { value: '7', label: '7 days' },
            { value: '14', label: '14 days' },
            { value: '30', label: '30 days' },
          ],
        },
        showCompleted: {
          type: 'boolean',
          label: 'Show completed assessments',
          default: false,
        },
      },
    },
  ],
  [
    'grade_trends',
    {
      type: 'grade_trends',
      name: 'Grade Trends',
      description: 'Visualise your assessment results over time.',
      category: 'academic',
      icon: ChartBar,
      defaultSize: { w: 6, h: 5 },
      minSize: { w: 4, h: 5 },
      maxSize: { w: 12, h: 10 },
      mobileSize: { w: 12, h: 5 },
      mobileOrder: 7,
      resizable: true,
      component: GradeTrendsWidget,
    },
  ],
  [
    'messages_preview',
    {
      type: 'messages_preview',
      name: 'Messages',
      description: 'Your most recent DesQTA direct messages.',
      category: 'communication',
      icon: ChatBubbleLeftRight,
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 4 },
      maxSize: { w: 8, h: 10 },
      mobileSize: { w: 12, h: 5 },
      mobileOrder: 3,
      resizable: true,
      component: MessagesPreview,
      settingsSchema: {
        maxItems: {
          type: 'number',
          label: 'Maximum messages to show',
          default: 5,
          min: 3,
          max: 10,
        },
      },
    },
  ],
  [
    'notices',
    {
      type: 'notices',
      name: 'Notices',
      description: "Today's school notices and announcements.",
      category: 'communication',
      icon: Bell,
      defaultSize: { w: 8, h: 4 },
      minSize: { w: 4, h: 4 },
      maxSize: { w: 12, h: 10 },
      mobileSize: { w: 12, h: 5 },
      mobileOrder: 4,
      resizable: true,
      component: NoticesPane,
      settingsSchema: {
        maxItems: {
          type: 'number',
          label: 'Maximum notices to show',
          default: 5,
          min: 3,
          max: 10,
        },
      },
    },
  ],
  [
    'news',
    {
      type: 'news',
      name: 'News',
      description: 'Latest news from your selected RSS feeds.',
      category: 'reading',
      icon: Newspaper,
      defaultSize: { w: 12, h: 4 },
      minSize: { w: 4, h: 4 },
      maxSize: { w: 12, h: 10 },
      mobileSize: { w: 12, h: 5 },
      mobileOrder: 9,
      resizable: true,
      component: RecentNews,
      settingsSchema: {
        maxItems: {
          type: 'number',
          label: 'Maximum news items to show',
          default: 5,
          min: 3,
          max: 10,
        },
      },
    },
  ],
  [
    'shortcuts',
    {
      type: 'shortcuts',
      name: 'Shortcuts',
      description: 'Pinned links to anywhere you want to go.',
      category: 'tools',
      icon: Link,
      defaultSize: { w: 8, h: 3 },
      minSize: { w: 4, h: 3 },
      maxSize: { w: 12, h: 6 },
      mobileSize: { w: 12, h: 3 },
      mobileOrder: 5,
      resizable: true,
      component: ShortcutsWidget,
    },
  ],
  [
    'quick_notes',
    {
      type: 'quick_notes',
      name: 'Quick Notes',
      description: 'A single auto-saved scratch pad.',
      category: 'tools',
      icon: PencilSquare,
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 4 },
      maxSize: { w: 8, h: 10 },
      mobileSize: { w: 12, h: 5 },
      mobileOrder: 8,
      resizable: false,
      component: QuickNotesWidget,
      settingsSchema: {
        fontSize: {
          type: 'number',
          label: 'Font size',
          default: 14,
          min: 10,
          max: 24,
        },
        autoSave: {
          type: 'boolean',
          label: 'Auto-save',
          default: true,
        },
      },
    },
  ],
  [
    'study_timer',
    {
      type: 'study_timer',
      name: 'Study Timer',
      description: 'Pomodoro timer and lightweight session tracker.',
      category: 'tools',
      icon: AcademicCap,
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 4 },
      maxSize: { w: 8, h: 10 },
      mobileSize: { w: 12, h: 5 },
      mobileOrder: 10,
      resizable: true,
      component: StudyTimeTrackerWidget,
      settingsSchema: {
        timePeriod: {
          type: 'select',
          label: 'Summary period',
          default: 'week',
          options: [
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ],
        },
        goalHours: {
          type: 'number',
          label: 'Goal hours per week',
          default: 20,
          min: 1,
          max: 100,
        },
      },
    },
  ],
  [
    'weather',
    {
      type: 'weather',
      name: 'Weather',
      description: 'Current weather and short forecast.',
      category: 'tools',
      icon: Cloud,
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 3 },
      maxSize: { w: 8, h: 8 },
      mobileSize: { w: 12, h: 3 },
      mobileOrder: 6,
      resizable: true,
      component: WeatherWidget,
      settingsSchema: {
        location: {
          type: 'string',
          label: 'Location',
          description: 'Leave blank to use your current location.',
          default: '',
        },
        units: {
          type: 'select',
          label: 'Temperature units',
          default: 'celsius',
          options: [
            { value: 'celsius', label: 'Celsius' },
            { value: 'fahrenheit', label: 'Fahrenheit' },
          ],
        },
        showForecast: {
          type: 'boolean',
          label: 'Show forecast',
          default: true,
        },
      },
    },
  ],
  [
    'welcome_portal',
    {
      type: 'welcome_portal',
      name: 'Welcome Portal',
      description: 'Your school welcome / homepage portal.',
      category: 'reading',
      icon: GlobeAlt,
      defaultSize: { w: 12, h: 5 },
      minSize: { w: 6, h: 4 },
      maxSize: { w: 12, h: 8 },
      mobileSize: { w: 12, h: 6 },
      mobileOrder: 11,
      resizable: true,
      component: WelcomePortal,
    },
  ],
]);

export function getWidgetDefinition(type: WidgetType): WidgetDefinition | undefined {
  return widgetRegistry.get(type);
}

export function getAllWidgetTypes(): WidgetType[] {
  return Array.from(widgetRegistry.keys());
}

/** Friendly labels for each category. Order = displayed order in the Add Widget dialog. */
export const WIDGET_CATEGORY_LABELS: { id: 'schedule' | 'academic' | 'communication' | 'tools' | 'reading'; label: string }[] = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'academic', label: 'Academic' },
  { id: 'communication', label: 'Communication' },
  { id: 'reading', label: 'Reading' },
  { id: 'tools', label: 'Tools' },
];
