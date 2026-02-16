import type { WidgetDefinition, WidgetType } from '../types/widgets';
import UpcomingAssessments from '../components/UpcomingAssessments.svelte';
import MessagesPreview from '../components/MessagesPreview.svelte';
import TodaySchedule from '../components/TodaySchedule.svelte';
import NoticesPane from '../components/NoticesPane.svelte';
import RecentNews from '../components/RecentNews.svelte';
import WelcomePortal from '../components/WelcomePortal.svelte';
import Homework from '../components/Homework.svelte';
import TodoList from '../components/TodoList.svelte';
import FocusTimer from '../components/FocusTimer.svelte';
import ShortcutsWidget from '../components/ShortcutsWidget.svelte';
import {
  DocumentText,
  ChatBubbleLeftRight,
  CalendarDays,
  Bell,
  Newspaper,
  GlobeAlt,
  BookOpen,
  CheckCircle,
  Clock,
  Link,
  ChartBar,
  AcademicCap,
  Calendar,
  PencilSquare,
  Cloud,
} from 'svelte-hero-icons';

// Import new widget components
import GradeTrendsWidget from '../components/widgets/GradeTrendsWidget.svelte';
import StudyTimeTrackerWidget from '../components/widgets/StudyTimeTrackerWidget.svelte';
import DeadlinesCalendarWidget from '../components/widgets/DeadlinesCalendarWidget.svelte';
import QuickNotesWidget from '../components/widgets/QuickNotesWidget.svelte';
import WeatherWidget from '../components/widgets/WeatherWidget.svelte';
import TimetableWidget from '../components/widgets/TimetableWidget.svelte';

export const widgetRegistry = new Map<WidgetType, WidgetDefinition>([
  [
    'upcoming_assessments',
    {
      type: 'upcoming_assessments',
      name: 'Upcoming Assessments',
      description: 'View your upcoming assignments and assessments',
      icon: DocumentText,
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      maxSize: { w: 12, h: 6 },
      component: UpcomingAssessments,
      settingsSchema: {
        maxItems: {
          type: 'number',
          label: 'Maximum items to show',
          default: 10,
          min: 3,
          max: 20,
        },
        showFilters: {
          type: 'boolean',
          label: 'Show subject filters',
          default: true,
        },
      },
    },
  ],
  [
    'messages_preview',
    {
      type: 'messages_preview',
      name: 'Messages Preview',
      description: 'Preview your recent messages',
      icon: ChatBubbleLeftRight,
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 4 },
      maxSize: { w: 12, h: 10 },
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
    'today_schedule',
    {
      type: 'today_schedule',
      name: "Today's Schedule",
      description: 'View your schedule for today',
      icon: CalendarDays,
      defaultSize: { w: 12, h: 6 },
      minSize: { w: 6, h: 5 },
      maxSize: { w: 12, h: 10 },
      component: TodaySchedule,
      settingsSchema: {
        defaultView: {
          type: 'select',
          label: 'Default view',
          default: 'today',
          options: [
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'Week' },
          ],
        },
      },
    },
  ],
  [
    'shortcuts',
    {
      type: 'shortcuts',
      name: 'Quick Links',
      description: 'Access your favorite shortcuts',
      icon: Link,
      defaultSize: { w: 12, h: 4 },
      minSize: { w: 4, h: 3 },
      maxSize: { w: 12, h: 6 },
      component: ShortcutsWidget,
    },
  ],
  [
    'notices',
    {
      type: 'notices',
      name: 'Notices',
      description: 'View school notices and announcements',
      icon: Bell,
      defaultSize: { w: 12, h: 5 },
      minSize: { w: 6, h: 4 },
      maxSize: { w: 12, h: 10 },
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
      name: 'Recent News',
      description: 'Latest news and updates',
      icon: Newspaper,
      defaultSize: { w: 12, h: 5 },
      minSize: { w: 6, h: 4 },
      maxSize: { w: 12, h: 10 },
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
    'welcome_portal',
    {
      type: 'welcome_portal',
      name: 'Welcome Portal',
      description: 'Access portal links',
      icon: GlobeAlt,
      defaultSize: { w: 12, h: 5 },
      minSize: { w: 6, h: 4 },
      maxSize: { w: 12, h: 8 },
      component: WelcomePortal,
    },
  ],
  [
    'homework',
    {
      type: 'homework',
      name: 'Homework',
      description: 'View your homework assignments',
      icon: BookOpen,
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 4 },
      maxSize: { w: 6, h: 8 },
      component: Homework,
    },
  ],
  [
    'todo_list',
    {
      type: 'todo_list',
      name: 'Todo List',
      description: 'Manage your tasks',
      icon: CheckCircle,
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 4 },
      maxSize: { w: 6, h: 8 },
      component: TodoList,
    },
  ],
  [
    'focus_timer',
    {
      type: 'focus_timer',
      name: 'Focus Timer',
      description: 'Pomodoro-style focus timer',
      icon: Clock,
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 4 },
      maxSize: { w: 6, h: 8 },
      component: FocusTimer,
    },
  ],
  [
    'grade_trends',
    {
      type: 'grade_trends',
      name: 'Grade Trends',
      description: 'Visualize your grade trends over time',
      icon: ChartBar,
      defaultSize: { w: 6, h: 6 },
      minSize: { w: 4, h: 5 },
      maxSize: { w: 12, h: 10 },
      component: GradeTrendsWidget,
      // Note: Time range is controlled by AnalyticsAreaChart's built-in selector
      // No widget-level settings needed as the chart component handles all filtering
    },
  ],
  [
    'study_time_tracker',
    {
      type: 'study_time_tracker',
      name: 'Study Time Tracker',
      description: 'Track your study time per subject',
      icon: AcademicCap,
      defaultSize: { w: 6, h: 6 },
      minSize: { w: 4, h: 5 },
      maxSize: { w: 12, h: 10 },
      component: StudyTimeTrackerWidget,
      settingsSchema: {
        timePeriod: {
          type: 'select',
          label: 'Time period',
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
    'deadlines_calendar',
    {
      type: 'deadlines_calendar',
      name: 'Deadlines Calendar',
      description: 'View upcoming assessment deadlines',
      icon: Calendar,
      defaultSize: { w: 6, h: 6 },
      minSize: { w: 4, h: 5 },
      maxSize: { w: 12, h: 10 },
      component: DeadlinesCalendarWidget,
      settingsSchema: {
        daysToShow: {
          type: 'select',
          label: 'Days to show',
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
    'quick_notes',
    {
      type: 'quick_notes',
      name: 'Quick Notes',
      description: 'Take quick notes',
      icon: PencilSquare,
      defaultSize: { w: 6, h: 6 },
      minSize: { w: 4, h: 5 },
      maxSize: { w: 12, h: 10 },
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
    'weather',
    {
      type: 'weather',
      name: 'Weather',
      description: 'Current weather and forecast',
      icon: Cloud,
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 4 },
      maxSize: { w: 6, h: 8 },
      component: WeatherWidget,
      settingsSchema: {
        location: {
          type: 'string',
          label: 'Location',
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
    'timetable',
    {
      type: 'timetable',
      name: 'Timetable',
      description: 'View your weekly class schedule with multiple view modes',
      icon: CalendarDays,
      defaultSize: { w: 12, h: 8 },
      minSize: { w: 6, h: 6 },
      maxSize: { w: 12, h: 12 },
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
          label: 'Default view mode',
          default: 'week',
          options: [
            { value: 'week', label: 'Week' },
            { value: 'day', label: 'Day' },
            { value: 'month', label: 'Month' },
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
]);

export function getWidgetDefinition(type: WidgetType): WidgetDefinition | undefined {
  return widgetRegistry.get(type);
}

export function getAllWidgetTypes(): WidgetType[] {
  return Array.from(widgetRegistry.keys());
}
