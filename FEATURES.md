# DesQTA Features

This document provides a detailed inventory of features in the DesQTA application, with emphasis on the **Assessments** module.

---

## Assessments Module

The Assessments module is the core feature for tracking, viewing, and managing student assessments (assignments, tests, tasks) synced from SEQTA.

### 1. Assessments Overview Page (`/assessments`)

#### 1.1 Data Loading & Caching

- **Processed assessments via Rust backend**: Uses `get_processed_assessments` Tauri command to fetch and merge:
  - Upcoming assessments from SEQTA API (`/seqta/student/assessment/list/upcoming`)
  - Past assessments per subject (`/seqta/student/assessment/list/past`)
  - Subjects and folders from SEQTA (`/seqta/student/load/subjects`)
  - Lesson colours from user prefs (`/seqta/student/load/prefs`)
- **Deduplication**: Merges upcoming and past assessments, removes duplicates by ID
- **Subject metadata**: Active vs. all subjects, subject filters, programme/metaclass mapping
- **Caching**: 10-minute TTL in-memory cache + IndexedDB for offline/instant load
- **Background sync**: `useDataLoader` with `shouldSyncInBackground` and `updateOnBackgroundSync` for fresh data while keeping UI responsive

#### 1.2 Year Filtering

- **Year dropdown**: Filter assessments by academic year
- **Available years**: Derived from assessment due dates
- **URL persistence**: Year stored in `?year=` query param via `updateUrlParam`
- **Mouse wheel support**: Scroll through year options with mouse wheel on dropdown
- **Empty state**: "No assessments for {year}" with suggestion to try a different year

#### 1.3 View Modes

Four distinct view types selectable via dropdown:

| View              | Component                | Description                                     |
| ----------------- | ------------------------ | ----------------------------------------------- |
| **List View**     | `AssessmentListView`     | Grouped by subject with sidebar navigation      |
| **Board View**    | `AssessmentBoardView`    | Kanban-style columns, horizontal scroll         |
| **Calendar View** | `AssessmentCalendarView` | Month grid with assessments on due dates        |
| **Gantt View**    | `AssessmentGanttView`    | Timeline chart with subject groups and progress |

#### 1.4 Board View Options

- **Group by**: Subject | Month | Status
- **Status columns**: Marked, Overdue, Due Soon, Upcoming
- **Month columns**: Assessments grouped by month (e.g. "February 2025")
- **Subject columns**: Same as list view grouping
- **Horizontal scroll**: Thin scrollbar with accent styling

#### 1.5 URL Query Parameters & Deep Linking

- **`?code=` & `?date=`**: From timetable/lesson modal — navigates to assessments and highlights the matching assessment
- **`?year=`**: Persists selected year
- **Highlight animation**: Scrolls to matching assessment, applies `highlight-subject` CSS animation (scale + box-shadow pulse) for 1.5s

#### 1.6 Settings Integration

- Reads `ai_integrations_enabled` and `grade_analyser_enabled` from settings on mount
- Used for conditional display of AI/grade features (e.g. weighted predictions)

---

### 2. List View (`AssessmentListView`)

#### 2.1 Quick Navigation Sidebar

- **Sticky sidebar**: "Quick Jump" with subject links
- **Subject list**: Only subjects that have assessments in the current year
- **Colour dots**: Subject colour indicator
- **Active badge**: "(Active)" for subjects in the active folder
- **Smooth scroll**: Click scrolls to subject section and triggers highlight animation

#### 2.2 Subject Cards

- **Grouped by subject**: Each subject has a card with header and assessment list
- **Subject header**: Colour dot, title, code, Active badge
- **Staggered animations**: `subject-group-animate` and `assessment-card-animate` with `fadeInUp` keyframes

#### 2.3 Weighted Grade Prediction (List View Only)

- **Calculate Grade button**: Per-subject button to trigger weighted grade calculation
- **Loading state**: Spinner while calculating
- **Prediction bar**: Visual progress bar showing predicted grade % and letter grade (A+ to E)
- **Expandable breakdown**: Click to expand and see:
  - Per-assessment grade and weighting
  - Total weight percentage
- **Disclaimer modal**: "Grade Prediction Disclaimer" explaining estimates are based on released marks and PDF-extracted weightings
- **Caching**: Predictions saved via `weightedGradeCacheService` (load/save)
- **Auto-calculation**: `checkAndCalculateNewGrades` runs on page load when new marked assessments are detected

#### 2.4 Change to Latest Year Banner

- Shown when: No assessments for current year, other years exist, current year ≠ latest year
- **Button**: "Change to Latest Year" switches to the most recent year with data

---

### 3. Board View (`AssessmentBoardView`)

- **Kanban layout**: Horizontal columns, each column is a group (subject/month/status)
- **Column headers**: Subject title + code, or month name, or status label
- **Status colours**: Green (Marked), Red (Overdue), Yellow (Due Soon), Blue (Upcoming)
- **Assessment count**: Shown in column header
- **`showSubject` prop**: When grouped by month/status, shows subject code on each card

---

### 4. Calendar View (`AssessmentCalendarView`)

- **Month grid**: 7-column week layout (Sun–Sat)
- **Month navigation**: Prev/Next month buttons
- **Today highlight**: Today's cell has `border-indigo-500 ring-4` and `animate-pulse-today`
- **Assessments per day**: Up to 2 shown, "+N more" if more exist
- **Subject colour**: Background tint on cells with assessments
- **Text contrast**: `isColorLight()` checks colour for light/dark text
- **Date click**: Navigates to `/assessments?year={year}&date={dateStr}` for filtering

---

### 5. Gantt View (`AssessmentGanttView`)

- **Library**: `wx-svelte-gantt` with Willow/WillowDark themes
- **Theme-aware**: Uses `theme` store for light/dark mode
- **Subject groups**: Summary tasks (collapsed by default) with colour
- **Individual tasks**: Each assessment as a task bar under its subject
- **Duration**: 2 weeks before due date, progress based on status
- **Progress bar**: 0% (upcoming), 50% (in progress), 75% (overdue), 100% (marked)
- **Columns**: Assessment name, Count (per subject)
- **Scales**: Month, week, day
- **Legend**: Individual tasks, subject groups, progress bar, overdue items

---

### 6. Assessment Card (`AssessmentCard`)

- **Link**: Navigates to `/assessments/{id}/{metaclass}?tab={overview|details}&year={year}#top`
- **Tab logic**: If marked → `details`, else `overview`
- **Display**: Due date (locale `en-AU`), status badge, title
- **Optional subject**: `showSubject` shows subject code when used in board view
- **Status badges**: Marked (success), Overdue (danger), Due Soon (warning), Upcoming (info)
- **Hover**: `hover:scale-[1.02]` and accent shadow

---

### 7. Assessment Detail Page (`/assessments/[id]/[metaclass]`)

#### 7.1 Header

- **Back link**: "Back to Assessments" → `/assessments`
- **Sticky**: `sticky top-0 z-10` with backdrop blur

#### 7.2 Tabs

- **Overview**: Description, resources, expected rating
- **Details**: Grades, teacher feedback (when marked)
- **Submissions**: Only shown if `fileSubmissionEnabled` in assessment settings

#### 7.3 Tab Selection Logic

- **URL `?tab=`**: Supports `overview`, `details`, `submissions`
- **Default**: If marked with grade → `details`, else `overview`
- **Submissions**: Only available when file submission is enabled

---

### 8. Overview Tab (`AssessmentOverview`)

#### 8.1 Expected Rating (Engagement)

- **Conditional**: Shown when `engagementSettings.enabledOptions` includes `EXPECTED_RATING`
- **Star rating**: 1–5 stars via `StarRating` component
- **Save**: POST to `/seqta/student/assessment/engagement/save` with `mode: 'expectedRating'`
- **Toast**: Success/error feedback via `toastStore`
- **Callback**: `onRatingUpdate` triggers parent reload

#### 8.2 Description

- **HTML sanitization**: `sanitizeHtml()` for safe rendering
- **Whitespace**: `whitespace-pre-line` for line breaks

#### 8.3 Resources

- **Downloadable files**: `FileCard` with `variant="resource"`, `get_seqta_file` Tauri command to open/download
- **File icons**: Video, presentation, image, or document based on mimetype
- **Metadata**: File size, creator (Teacher/Student), created date
- **Resources without file**: Shown as "Resource (no file attached)" with placeholder

---

### 9. Details Tab (`AssessmentDetails`)

#### 9.1 Grade Display

- **Grade bar**: Full-width progress bar with percentage
- **Display**: Letter grade or percentage from `criteria[0].results`
- **Fallback**: "Grade not yet available" if marked but no grade
- **Unmarked state**: "Assessment Not Yet Marked" message

#### 9.2 Teacher Feedback

- **Feedback comment**: From `engagement.feedbackComment`
- **Empty state**: "No Feedback Available" when marked but no feedback

---

### 10. Submissions Tab (`AssessmentSubmissions`)

- **Conditional**: Only visible when `submissionSettings.fileSubmissionEnabled`
- **Upload**: `FileUploadButton` opens native file dialog

#### 10.1 File Upload (`FileUploadButton`)

- **Multiple files**: Supports selecting multiple files
- **Flow**: Upload via `uploadSeqtaFile` → link via `/seqta/student/assessment/submissions/save` with `action: 'link'`
- **Filename sanitization**: `sanitizeFilename()` before upload
- **Success/error**: Toast + inline message with dismiss
- **File size tip**: Special message when error exceeds limit

#### 10.2 Submission List

- **Student-only**: Filters out `staff` submissions
- **FileCard**: Shows filename, size, metadata, no download button for submissions

---

### 11. Grade & Prediction Services

#### 11.1 Weighted Grade Calculation (`gradeCalculationService`)

- **Input**: Assessments with `finalGrade` and `status === 'MARKS_RELEASED'`
- **Weighting**: From `weightingService` (cache or PDF extraction)
- **Fallback**: Equal weight (1) if extraction fails
- **Output**: `WeightedGradePrediction` with predicted grade, assessment count, total weight, per-assessment breakdown

#### 11.2 Weighting Extraction (`weightingService`)

- **Source**: PDF assessment documents via `get_assessment_weighting` Tauri command
- **Cache**: 30-day TTL in memory + IndexedDB

#### 11.3 Background Grade Service (`backgroundGradeService`)

- **Trigger**: On assessments page load
- **Logic**: Detects new released assessments per subject; only processes subjects where count changed
- **Actions**: Extracts weightings for new assessments, recalculates weighted grade, saves to cache

---

### 12. Integrations

#### 12.1 Timetable

- **Lesson modal/popout**: "View assessments" link → `/assessments?code={code}&date={date}&year={year}`
- **Context**: Passes subject code and date for highlighting

#### 12.2 Global Search

- **Assessment results**: Search by title or description
- **Database search**: `db_search_assessments` for fast queries
- **Fallback**: Full `get_processed_assessments` if no DB results
- **Navigation**: Links to `/assessments/{id}/{metaclass}`
- **Homepage**: Shows assessments in search results

#### 12.3 Notifications

- **Types**: `reminder_3days`, `reminder_1day`, `due_date`, `overdue`
- **Scheduling**: Via `notificationService.scheduleNotifications()` on warmup
- **Coneqt assessments**: Notification type `coneqtassessments` → click navigates to `/assessments/{assessmentID}/{metaclassID}?year={year}`

---

### 13. UI/UX Details

- **Loading**: `LoadingSpinner` with "Loading assessments..." message
- **Empty state**: `EmptyState` with clipboard icon and contextual message
- **i18n**: All strings use `$_()` or `<T>` component with translation keys
- **Transitions**: `fly`, `fade` with `cubicOut` easing
- **Responsive**: Mobile-first layout, flex/grid breakpoints
- **Accessibility**: Focus rings, keyboard navigation

---

## Dashboard Module (`/`)

The Dashboard is the home page displaying a customizable grid of widgets.

### 1. Widget Grid

- **Library**: GridStack.js for drag-and-drop layout
- **Persistence**: Layout saved via `db_widget_layout_save` Tauri command, loaded via `db_widget_layout_load`
- **Debounced save**: 500ms delay after drag/resize to avoid excessive writes
- **Preset sizes**: Widths [3, 4, 6, 8, 12], heights [4, 5, 6, 8, 10] — widgets snap to nearest preset
- **Widget registry**: 16 widget types from `widgetRegistry.ts`
- **Migration**: `migrateToWidgetSystem` and `validateAndFixLayout` run on mount

### 2. Edit Mode Toggle

- **Edit Layout**: Enables drag, resize, add, remove
- **Done Editing**: Exits edit mode, saves layout
- **Add Widget**: Opens `AddWidgetDialog` — pick from available widget types
- **Templates**: Opens `WidgetTemplates` — apply preset layouts (e.g. "Focus", "Overview")
- **Reset Layout**: Confirms then calls `widgetService.resetLayout()` — restores default widgets

### 3. Widget Settings Modal

- **Trigger**: Click widget settings icon when editing
- **Per-widget config**: Each widget type has `settingsSchema` (maxItems, showFilters, etc.)
- **Save**: Updates widget config, triggers layout reload

### 4. Default Layout

- Upcoming Assessments, Messages Preview, Today Schedule (6×4 each)
- Additional widgets from `widgetService.getDefaultLayout()`

---

## Courses Module (`/courses`)

Subject folders and course content from SEQTA.

### 1. Data Loading

- **Subjects**: `courseService.loadSubjects()` — `/seqta/student/load/subjects`
- **Cache**: 60-min TTL, `courses_subjects_folders` key
- **Folders**: Active vs. other folders; subjects from active folder
- **Background sync**: `shouldSyncInBackground: true`, `updateOnBackgroundSync: true`

### 2. Course Content

- **Selection**: Click subject → `loadCourseContent(subject)`
- **Cache key**: `course_{programme}_{metaclass}`
- **Parse**: `courseService.parseDocument()` — DraftJS/HTML parsing
- **URL params**: `?code=`, `?programme=`, `?metaclass=` for deep linking

### 3. Schedule & Lessons

- **Term schedule**: Lesson list with dates
- **Lesson content**: Weekly lesson content, standalone content
- **Overview mode**: Toggle between overview and lesson detail
- **Mobile**: Sidebar collapse, lesson list scroll

### 4. Components

- **CourseContent**: Renders modules, resources, links
- **ModuleRenderer**: LinkPreview, document types from `MODULE_TYPE_UUIDS`

---

## Timetable Module (`/timetable`)

Week/day/month/list view of the school timetable.

### 1. View Modes

- **Default**: Week on desktop, Day on mobile
- **Modes**: week | day | month | list
- **Widget**: Reuses `TimetableWidget` with full-page config

### 2. URL & Date

- **`?date=`**: YYYY-MM-DD format, persists selected date
- **Week start**: Monday-based week calculation via `getMonday()`
- **Back/forward**: `$effect` watches URL, updates `weekStart`, `reloadKey`

### 3. Settings (from widget config)

- **timeRange**: start/end (e.g. 08:00–16:00)
- **showTeacher**, **showRoom**, **showAttendance**, **showEmptyPeriods**
- **density**: compact | normal | comfortable

### 4. Integrations

- **Lesson click**: Navigate to `/courses` or `/assessments` with code, date, year
- **TimetableLessonModal**, **TimetableLessonPopout**: "View assessments" link

---

## Study Module (`/study`)

AI study tools, task management, and notes.

### 1. Tabs

- **Quizzes**: AI-generated quizzes from assessments
- **Tasks**: Todo list with filters (all, today, week, completed), sort (due, priority, updated)
- **Notes**: NotesContainer with Tiptap editor

### 2. Tasks

- **TodoItem**: title, description, related_subject, related_assessment, due_date, subtasks, priority
- **Typeahead**: Subject and assessment autocomplete from SEQTA data
- **Filters**: all | today | week | completed
- **Sort**: due | priority | updated
- **Animations**: `deletingTasks`, `completingTasks` sets for transition states

### 3. Study Tools (StudyToolsContainer)

- **Quiz generator**: From assessments (AI, when enabled)
- **Flashcards**: AI-generated
- **Notes**: Linked to lessons/assessments

### 4. Upcoming Assessments

- **Real data**: From `upcoming_assessments_data` cache
- **Study tip**: Random tip from `studytips.ts`
- **Links**: To assessment detail pages

### 5. Data Sources

- **Subjects**: `seqtaFetch` load/subjects, load/prefs for colours
- **Assessments**: `seqta_all_assessments_flat` cache, upcoming from API

---

## Goals Module (`/goals`, `/goals/[year]`)

Student goals from Coneqt/SEQTA.

### 1. Feature Gate

- **Setting**: `coneqt-s.page.goals` from `/seqta/student/load/settings`
- **Cache**: `goals_settings_enabled`, 60-min TTL
- **Offline**: Uses cache; defaults to disabled if no cache

### 2. Years List

- **API**: `/seqta/student/load/goals` with `mode: 'years'`
- **Cache**: `goals_years` in memory + IndexedDB
- **Navigation**: Click year → `/goals/[year]`

### 3. Goals by Year (`/goals/[year]`)

- **Content**: Goals for selected year
- **Back**: Link to `/goals`

---

## Forums Module (`/forums`, `/forums/[id]`)

Discussion forums from SEQTA.

### 1. Feature Gate

- **Settings**: `coneqt-s.page.forums` or `coneqt-s.forum.greeting` from load/settings
- **Cache**: `forums_settings_enabled`

### 2. Forums List (`/forums`)

- **API**: Fetches forums list
- **Open vs. closed**: Separate sections, closed expandable
- **Sort**: title | owner | opened | participants | unread (asc/desc)
- **Filter**: Unread only toggle
- **Search**: `searchQuery` filters by title/owner
- **Card**: Owner, read/unread counts, participants, opened date
- **Click**: Navigate to `/forums/[id]`

### 3. Forum Thread (`/forums/[id]`)

- **Thread view**: Posts, replies
- **Back**: Link to `/forums`

---

## Folios Module (`/folios`, `/folios/browse`, `/folios/edit`, `/folios/edit/[id]`)

Student portfolios (Coneqt).

### 1. Feature Gate

- **Setting**: `coneqt-s.page.folios` from load/settings
- **Cache**: `folios_settings_enabled`
- **Empty state**: "Folios Not Enabled" when disabled

### 2. Landing Page (`/folios`)

- **Edit My Folios**: → `/folios/edit` — create and manage personal folios
- **Browse Folios**: → `/folios/browse` — explore available folios
- **Cards**: Hover scale, accent border

### 3. Browse (`/folios/browse`)

- **API**: `/seqta/student/folio` with `mode: 'list'`
- **List**: FolioItem (student, photo, id, published, title)
- **Click**: → `/folios/browse/[id]` for folio detail
- **Back**: → `/folios`

### 4. Edit (`/folios/edit`)

- **Create**: New folio → redirect to `/folios/edit/[id]`
- **List**: Existing folios, click to edit
- **Back**: → `/folios`

### 5. Edit by ID (`/folios/edit/[id]`)

- **Editor**: Edit folio content
- **Back**: → `/folios/edit`

---

## Direqt Messages Module (`/direqt-messages`)

Inbox and messaging from SEQTA.

### 1. Data Loading

- **Tauri**: `fetch_messages` command for inbox (folder, rssUrl)
- **Cache**: `messages_{folder}` key, 10-min TTL
- **Fallback**: Cache when API fails (offline or error)
- **RSS**: Folder label `rss-*` for RSS feeds

### 2. Layout

- **Sidebar**: Folder list (Inbox, Sent, etc.)
- **MessageList**: List of messages in selected folder
- **MessageDetail**: Selected message content
- **Mobile**: `MobileFolderTabs`, modal for message detail

### 3. Deep Linking

- **`?messageID=`**: From notifications — selects message when loaded
- **`$effect`**: Watches `pendingMessageId`, selects message when messages load

### 4. Actions

- **Compose**: `ComposeModal` — subject, body
- **Star**: Toggle starred
- **Delete/Restore**: Move to trash or restore

### 5. State

- **selectedFolder**: Inbox default
- **selectedMessage**: Currently viewed message
- **starring**, **deleting**, **restoring**: Loading states for actions

---

## RSS Feeds Module (`/rss-feeds`)

RSS feed reader using feeds configured in Settings.

### 1. Data Loading

- **Feeds source**: `get_settings_subset` with key `feeds` — URLs from Settings
- **Feed metadata**: `getRSS()` fetches each feed, extracts `channel.title` or hostname
- **Messages**: `fetch_messages` Tauri command with `folder: rss-{url}`, `rssUrl: feedName`
- **Cache**: `skipCache: true` for RSS — always fresh content
- **useDataLoader**: 10-min TTL, `shouldSyncInBackground` when data exists

### 2. Layout

- **Sidebar**: Feed list (left), mobile hamburger toggle
- **MessageList**: Reuses `direqt-messages` MessageList component
- **MessageDetail**: Reuses Message component for article display
- **Mobile**: `showMobileModal` when message selected — full-screen modal

### 3. Interactions

- **Select feed**: `openFeed()` — fetches messages, closes sidebar on mobile
- **Select message**: `openMessage()` — marks unread false, shows detail
- **Open in browser**: Link to article URL

---

## Portals Module (`/portals`)

External portals configured by school in SEQTA.

### 1. Data Loading

- **API**: `/seqta/student/load/portals` POST
- **Cache**: `portals` key, 10-min TTL
- **Sort**: By `priority` ascending
- **Background sync**: `updateOnBackgroundSync: true`

### 2. Portal List

- **Portal**: id, label, url, icon, priority, uuid, is_power_portal, inherit_styles
- **Icon colours**: Maps SEQTA `colour-*` classes to hex (turquoise, blue, green, etc.)
- **Click**: Opens modal with portal content

### 3. Portal Content Modal

- **Load**: Fetches portal content when clicked
- **Parse**: Uses `courseService.parseDocument` / `ParsedDocument` type
- **ModuleList**: Renders modules, resources, links
- **sanitizeHtml**: For safe content display

---

## Notices Module (`/notices`)

School notices by date.

### 1. Data Loading

- **Labels**: `/seqta/student/load/notices` with `mode: 'labels'` — `notices_labels` cache, 60 min
- **Notices**: Same API with `date: YYYY-MM-DD` — `notices_{date}` cache, 30 min
- **Offline**: `isOfflineMode` check, `reportSyncState` for failed sync

### 2. Filters

- **Date picker**: `selectedDate` — fetches notices for that date
- **Label filter**: `selectedLabel` — filter by label (dropdown)
- **URL params**: `getUrlParam`, `updateUrlParams` for date/label persistence

### 3. Notice Display

- **Notice**: id, title, subtitle, author, color, labelId, content
- **Virtual scrolling**: `NOTICE_ROW_HEIGHT = 420` for estimated row height
- **sanitizeHtml**: Content rendering

---

## News Module (`/news`)

News articles from RSS feeds or Australian news API.

### 1. Data Sources

- **Australia**: `get_news_australia` Tauri command — `from` date, `domains` (e.g. abc.net.au)
- **Other countries**: `rssFeedsByCountry` — USA, UK, Taiwan, Hong Kong, Panama, Canada, Singapore, Japan, Netherlands
- **Custom URL**: Source can be full RSS URL
- **Cache**: `news_{source}` key

### 2. Source Selector

- **Dropdown**: Country/source selection
- **showSourceSelector**: Toggle for source picker
- **selectedSource**: Default `australia`

### 3. Article Display

- **NewsArticle**: title, description, url, urlToImage
- **Click**: `goto('/news?item={encodedUrl}&source={selectedSource}')` — opens in modal or external
- **getRSS**: For non-Australia sources — maps items to NewsArticle format

---

## Directory Module (`/directory`)

Student directory with search and filters.

### 1. Data Loading

- **API**: `/seqta/student/load/message/people` with `mode: 'student'`
- **Cache**: `directory_students_all`, 60-min TTL
- **useDataLoader**: Background sync, update on sync

### 2. Student Model

- **Fields**: id, firstname, surname, xx_display, year, sub_school, house, house_colour, campus, rollgroup, personUUID
- **Photos**: `forumPhotoService` — student photos, `studentPhotos` Map, `studentsWithPhotos` Set
- **devSensitiveInfoHider**: Dicebear avatars when enabled — mask real photos

### 3. Filters

- **search**: Text search
- **selectedYear**, **selectedSubSchool**, **selectedHouse**, **selectedCampus**: Dropdowns
- **filterHasPhoto**: Toggle for students with photos only
- **showFiltersModal**: Mobile filters modal
- **hydrateFilters**: Derived from `studentsData` — unique values

### 4. Pagination

- **currentPage**, **itemsPerPage** (24 default)
- **Pagination** component from UI library

### 5. Image Viewer

- **showImageModal**: Full-size photo modal
- **selectedImageUrl**, **selectedStudentName**: For modal display

---

## Documents Module (`/documents`)

Document library from SEQTA, grouped by category.

### 1. Data Loading

- **API**: `/seqta/student/load/documents` POST
- **Cache**: `documents` key, 10-min TTL
- **updateOnBackgroundSync**: true

### 2. Structure

- **DocCategory**: colour, docs, id, category
- **DocItem**: file, filename, size, context_uuid, mimetype, created_date, title, uuid, created_by

### 3. Display

- **Categories**: Grouped by category, colour-coded
- **File icons**: `getFileIcon` from courses utils
- **formatFileSize**: Human-readable size
- **formatDate**: en-AU locale

### 4. Open Document

- **get_seqta_file**: Tauri command, `fileType: 'resource'`, `uuid`
- **openUrl**: Opens in default app/browser

---

## Reports Module (`/reports`)

Student reports (e.g. report cards) from SEQTA.

### 1. Data Loading

- **API**: `/seqta/student/load/reports` POST
- **Cache**: `reports` key, 5-min TTL
- **updateOnBackgroundSync**: true

### 2. Report Display

- **Card**: Report metadata (title, date, etc.)
- **formatDate**: Weekday, day, month, year (uppercase)

### 3. Open Report

- **get_seqta_file**: `fileType: 'report'`, `uuid`
- **openUrl**: Opens in browser
- **toastStore.error**: On failure

### 4. Deep Linking

- **`?report=`**: URL param — scroll to report, `data-report-id` attribute
- **Highlight**: `scrollIntoView` on mount when report param matches

---

## Analytics Module (`/analytics`)

Grade analytics and performance trends from synced assessment data.

### 1. Data Loading

- **Source**: `load_analytics` Tauri command — returns JSON from local sync
- **Parse**: `parseAssessment()` — extracts finalGrade, letterGrade from criteria/results
- **Validation**: `isValidDate`, requires id, title, subject, due
- **lastUpdated**: Timestamp, refresh display every minute

### 2. Filters

- **filterSubjects**: Multi-select
- **filterMinGrade**, **filterMaxGrade**: Grade range
- **filterSearch**: Text search
- **gradeRange**: Slider [0, 100]
- **AssessmentFilters** component

### 3. Charts

- **AnalyticsAreaChart**: Grade trend over time
- **AnalyticsBarChart**: Grade distribution (count per grade range)
- **RawDataTable**: Tabular assessment data

### 4. Timeframe

- **Select**: Time period for charts (e.g. term, semester)
- **Data points**: Count for selected timeframe

### 5. Empty State

- **No graded assessments**: "Complete some assessments to see your trends!"
- **Trending up**: Percentage improvement display

---

## Settings Module (`/settings`)

Application settings with multiple sections.

### 1. Structure

- **Sections**: Cloud Sync, Personal Settings, Homepage, Notifications, AI Integrations, Weather, RSS Feeds, Shortcuts, Display, Sidebar, Plugins, Updates, Performance, Dev Settings
- **Load**: `get_settings_subset` with all keys
- **Save**: `saveSettingsWithQueue`, `flushSettingsQueue` on navigation
- **Unsaved changes**: `initialSettings` comparison, `showUnsavedChangesModal`, `beforeNavigate` guard

### 2. Cloud Sync Section

- **EULA gate**: `acceptedCloudEula` — must accept before using
- **showEulaModal**: Full EULA text, Read & Accept
- **Logged in**: Profile picture, display name, username, "Manage" → CloudSyncModal
- **Logged out**: "Login & Sync" button, "Create a free account" link
- **cloudAuthService**: init, getProfile, logout
- **cloudUserLoading**: Loading state
- **CloudSyncModal**: Upload/download, sync management

### 3. Personal Settings Section

- **Custom Profile Picture**: Upload (file input), Remove button — appears in app header
- **handleProfilePictureUpload**: Crop via ProfilePictureCropModal
- **Language**: LanguageSelector — compact=false, showFlags=true — preferred interface language
- **Settings keys**: `custom_profile_picture`, `language`

### 4. Homepage Section

- **Widget Settings**: Configure dashboard widgets
- **Show Weather Widget**: weatherEnabled toggle
- **Force Fallback Location**: forceUseLocation — when true, use weatherCity/weatherCountry instead of GPS
- **Fallback City/Country**: weatherCity, weatherCountry inputs — countrycode.org link for reference
- **Settings keys**: `weather_enabled`, `force_use_location`, `weather_city`, `weather_country`

### 5. Notifications Section

- **remindersEnabled**: Enable assessment reminder notifications (3-day, 1-day, due, overdue)
- **autoDismissMessageNotifications**: Auto-dismiss message notifications when clicked
- **Send Test Notification**: sendTestNotification — triggers OS notification
- **Settings keys**: `reminders_enabled`, `auto_dismiss_message_notifications`

### 6. AI Integrations Section

- **aiIntegrationsEnabled**: Master toggle for AI features
- **When enabled**: API key inputs, provider toggle
- **aiProvider**: gemini | cerebras
- **geminiApiKey**, **cerebrasApiKey**: API keys (password inputs)
- **lessonSummaryAnalyserEnabled**: Lesson summary AI
- **quizGeneratorEnabled**: Quiz generation from assessments
- **Settings keys**: `ai_integrations_enabled`, `gemini_api_key`, `cerebras_api_key`, `ai_provider`, `lesson_summary_analyser_enabled`, `quiz_generator_enabled`

### 7. Weather Section (in Homepage)

- **weatherEnabled**: Show weather widget on dashboard
- **forceUseLocation**: Use fallback city/country instead of GPS
- **weatherCity**, **weatherCountry**: Fallback location

### 8. RSS Feeds Section

- **separateRssFeed**: Toggle — separate RSS in Messages vs. combined
- **feeds**: Array of { url } — add/remove RSS feed URLs
- **Settings keys**: `feeds`, `separate_rss_feed`
- **Used by**: RSS Feeds page (/rss-feeds), Messages for RSS folders

### 9. Shortcuts Section (Dashboard Shortcuts)

- **shortcuts**: Array of { name, icon, url }
- **addShortcut**: Add new shortcut
- **removeShortcut(idx)**: Remove by index
- **Each shortcut**: Name input, Icon (emoji placeholder), URL input
- **Settings keys**: `shortcuts`
- **Used by**: ShortcutsWidget on dashboard

### 10. Display (Appearance) Section

- **Accent Color**: Color picker + hex input, Reset to #3b82f6
- **updateAccentColor**: Applied via theme store
- **Theme**: Light | Dark | System — updateTheme()
- **Open Theme Store**: Link to /settings/theme-store
- **Layout**: autoCollapseSidebar, autoExpandSidebarHover
- **Customize Sidebar**: Button → SidebarSettingsDialog
- **globalSearchEnabled**: Enable Ctrl+K global search
- **disableSchoolPicture**: Hide school picture in user info
- **enhancedAnimations**: Toggle animations
- **Settings keys**: `accent_color`, `theme`, `auto_collapse_sidebar`, `auto_expand_sidebar_hover`, `global_search_enabled`, `disable_school_picture`, `enhanced_animations`

### 11. Zoom Section

- **zoomLevel**: 0.5–2.0 (50%–200%)
- **+/- buttons**: Step 0.1
- **Reset**: Back to 100%
- **setZoom()**: Applies CSS zoom/transform
- **Settings key**: `zoom_level`

### 12. Sidebar Customization (SidebarSettingsDialog)

- **Reorder**: Drag to reorder menu items
- **Folders**: Create folders, add items to folders
- **Favorites**: Star items for quick access
- **combinedOrder**: Paths + folder IDs
- **SidebarFolder**: id, name, icon, items (paths)
- **Save**: saveSettingsWithQueue, flushSettingsQueue

### 13. Plugins Section

- **Link**: "Open Plugin Store" → /settings/plugins
- **Description**: Install additional features from plugin store

### 14. Settings Plugins Page (`/settings/plugins`)

- **Source**: plugins.json from GitHub (desqta-plugins repo)
- **Plugin interface**: id, name, description, version, author, installed, icon, longDescription, requirements, features, repository, banner, readme, screenshots, downloads, rating, tags, license, minVersion, dependencies, changelog
- **Status**: "Coming Soon" banner — installation not yet functional
- **Back**: Link to /settings
- **Plugin card**: Click to open details (openPluginDetails)
- **Plugin detail**: marked() for README, long description, screenshots

### 15. Other Settings Sections

- **Updates** (desktop only): Check for app updates via `@tauri-apps/plugin-updater`, Install Update button
- **Redo Onboarding**: Restart walkthrough
- **Troubleshooting**: Opens TroubleshootingModal — diagnostics
- **Cache Management**: clearCache — fixes navigation issues
- **Dev Settings** (showDevSettings): Sensitive Info Hider, Force Offline Mode, Performance Testing

---

## Settings Theme Store (`/settings/theme-store`)

Theme marketplace for browsing and installing custom themes.

### 1. Data Sources

- **Cloud themes**: `themeStoreService` — listThemes, getTheme, getSpotlight, getCollections
- **Built-in themes**: `themeService.getAvailableThemes()`, `getThemeManifest()`
- **Fallback**: When store unavailable, uses builtInThemes
- **Collections**: Curated theme collections

### 2. Display & Filtering

- **sortBy**: popular | newest | rating | downloads | name
- **searchQuery**: Text search
- **selectedCategory**: Category filter (all or specific)
- **Pagination**: currentPage, themesPerPage (20), totalPages
- **ThemeFilters**: Category, sort, search
- **SpotlightCarousel**: Featured themes
- **CollectionsView**: Collection cards
- **ThemeCard**: Per-theme display

### 3. Theme Actions

- **Preview**: startThemePreview, applyPreviewTheme — temp preview, cancelThemePreview on leave
- **Download**: Download theme from store
- **Install**: Apply to profile directory
- **Favorite**: is_favorited from API
- **Rate**: User rating with comment
- **themeUpdates**: Map of theme ID to hasUpdate, currentVersion, latestVersion

### 4. State

- **downloadedThemeIds**: From settings
- **installedThemeSlugs**: From themeService.getCustomThemes() (filesystem)
- **tempPreviewThemeSlug**: Cleanup on destroy
- **collectionModalOpen**: Collection detail modal

---

## Performance Results (`/performance-results`)

Displays results from automated performance testing.

### 1. Data Source

- **URL param**: `?results=` — JSON-encoded TestResults
- **Fallback**: sessionStorage `performance-test-results`
- **Navigate**: From Settings → Run Performance Test → goto with results in URL

### 2. Display

- **TestResults**: pages (PerformanceMetrics[]), systemMetrics
- **PerformanceMetrics**: pageName, path, loadTime, memoryUsage, errors
- **sortedPages**: By loadTime descending
- **PerformanceLineChart**: Load time per page
- **PerformanceGraph**: Memory usage
- **formatTime**: ms or seconds
- **formatMemory**: MB
- **Color coding**: Green (<1s), Yellow (<3s), Red (≥3s)

### 3. Actions

- **goBack**: → /settings

---

## User Documentation (`/user-documentation`)

In-app FAQ and help.

### 1. Structure

- **FAQ items**: question, answer, category
- **Categories**: Getting Started, Navigation, Assessments, Timetable, Study Tools, Messages, Global Search, etc.
- **searchQuery**: Filter FAQs by text

### 2. Display

- **Accordion/collapsible**: FAQ items by category
- **Modal**: selectedFAQ — full answer in modal
- **Back**: Link to /

### 3. Content

- Login, dashboard widgets, global search, main pages
- Navigation, sidebar customization
- Assessment views, filters, submissions, grade predictions
- Timetable, export
- Notes editor, Todo List, Focus Timer
- DireQt messaging, folders
- Search tips

---

## Dashboard Widgets

Widgets rendered in the dashboard grid. Each has settingsSchema in widgetRegistry.

### 1. Upcoming Assessments (`upcoming_assessments`)

- **Data**: `upcoming_assessments_data` cache — assessments, subjects, filters
- **API**: `/seqta/student/assessment/list/upcoming`, `/seqta/student/load/subjects`, load/prefs for colours
- **Filter**: Active subjects only, due >= today, subjectFilters checkboxes
- **Display**: Cards with due date, status badge, title, subject colour
- **Link**: → `/assessments?code={code}&date={date}&year={year}`
- **Settings**: maxItems (3–20), showFilters (boolean)
- **Default size**: 6×4

### 2. Messages Preview (`messages_preview`)

- **API**: `/seqta/student/load/message` — action: list, label: inbox
- **Display**: MessagePreview — subject, from, snippet, timestamp, unread, attachments
- **Avatars**: get_seqta_file (fileType: photo) for sender photos
- **Click**: goto(`/direqt-messages?messageID=${id}`)
- **Compose**: goto('/direqt-messages')
- **Settings**: maxItems (3–20)
- **Default size**: 6×4

### 3. Today Schedule (`today_schedule`)

- **API**: `/seqta/student/load/timetable` — from/until same date
- **Date**: currentSelectedDate — prev/next day, date picker, "Today" button
- **Lessons**: Sorted by time, subject colours from prefs
- **Active lesson**: checkCurrentLessons every 60s — highlights current lesson
- **Click**: goto courses or assessments or timetable with code/date
- **Settings**: viewMode (today | week)
- **Default size**: 6×4

### 4. Shortcuts (`shortcuts`)

- **Data**: get_settings_subset(['shortcuts'])
- **Display**: Grid of shortcut buttons — name, icon (emoji), url
- **Click**: openUrl(url) — opens in default browser
- **Empty**: "No shortcuts configured. Add them in Settings."
- **Default size**: 4×2

### 5. Notices (`notices`)

- **Labels**: notices_labels cache — /seqta/student/load/notices mode: labels
- **Notices**: notices\_{date} — mode: date, today's date
- **Cache**: Memory + IndexedDB, offline fallback
- **Display**: Notice cards — title, subtitle, author, content
- **Link**: "View all" → /notices
- **Settings**: maxItems (3–10)
- **Default size**: 6×4

### 6. News (`news`)

- **Sources**: Australia (get_news_australia), or rssFeedsByCountry (USA, UK, Taiwan, etc.)
- **selectedSource**: Dropdown, default australia
- **Display**: NewsItem — title, link, published_at, source, image
- **Click**: goto(`/news?item={url}&source={source}`)
- **Settings**: maxItems (3–10)
- **Default size**: 6×4

### 7. Welcome Portal (`welcome_portal`)

- **API**: `/seqta/student/load/portals` with splash: true
- **Payload**: url, contents, is_power_portal
- **Power portal**: Draft.js content → ParsedDocument, ModuleList
- **URL portal**: portalUrl for iframe
- **extract_iframe_src_command**: Rust — extract iframe src from HTML
- **showDefaultContent**: When payload empty or parse fails
- **Modal**: showPortalModal for full view
- **Default size**: 12×6

---

## Dashboard Widgets (continued)

### 8. Homework (`homework`)

- **Component**: `Homework.svelte`
- **API**: `/seqta/student/dashlet/summary/homework` (POST, body: `{}`, params: `majhvjju`)
- **Data**: `HomeworkItem[]` — meta, id, title, items (string[])
- **Display**: Cards per homework — title, bullet list of items
- **Empty**: "No homework found" / "You're all caught up!"
- **Default size**: 4×5

### 9. Todo List (`todo_list`)

- **Component**: `TodoList.svelte`
- **Storage**: Tauri `load_todos` / `save_todos` — local persistence
- **Data**: `TodoItem` — id, title, description, related_subject, related_assessment, due_date, due_time, tags, subtasks, completed, priority (low|medium|high)
- **Features**: Add task (title, due date, priority, tags), toggle complete, delete, subtasks
- **Display**: Shows up to 5 active tasks; priority badges (high=red, medium=yellow, low=green)
- **Animations**: completion pulse, fly in/out
- **Default size**: 4×5

### 10. Focus Timer (`focus_timer`)

- **Component**: `FocusTimer.svelte`
- **Type**: Pomodoro-style timer — work/break cycles
- **Durations**: 25, 45, 60 min presets; custom min:sec entry
- **Controls**: Start, Pause, Reset
- **Break**: 5 min break after work; notification sound (`/notification.mp3`) on completion
- **Display**: Circular timer (accent border = work, green = break)
- **i18n**: `focus_timer.*` keys
- **Default size**: 4×5

### 11. Grade Trends (`grade_trends`)

- **Component**: `GradeTrendsWidget.svelte` + `AnalyticsAreaChart.svelte`
- **Data**: `load_analytics` Tauri command — assessment grades over time
- **Display**: Area chart of grades by date; built-in time range selector in chart
- **Default size**: 6×6

### 12. Study Time Tracker (`study_time_tracker`)

- **Component**: `StudyTimeTrackerWidget.svelte`
- **Storage**: `db_cache_get/set` — key `study_sessions`
- **Data**: `StudySession` — id, subject, startTime, endTime, duration (minutes)
- **Features**: Start session (subject), Stop session; progress bar vs goal; time by subject
- **Settings**: timePeriod (day|week|month), goalHours (1–100)
- **Display**: Current session card, total vs goal, per-subject breakdown
- **Default size**: 6×6

### 13. Deadlines Calendar (`deadlines_calendar`)

- **Component**: `DeadlinesCalendarWidget.svelte`
- **Data**: `upcoming_assessments_data` cache or `/seqta/student/assessment/list/upcoming`
- **Display**: Month calendar grid; assessments on due date; prev/next month, Today button
- **Click**: goto `/assessments?code={code}&date={date}&year={year}`
- **Settings**: daysToShow (7|14|30), showCompleted (boolean)
- **Default size**: 6×6

### 14. Quick Notes (`quick_notes`)

- **Component**: `QuickNotesWidget.svelte`
- **Storage**: `db_cache_get/set` — key `quick_note_{widgetId}`
- **Features**: Textarea; auto-save (debounced 1s); per-widget note
- **Settings**: fontSize (10–24), autoSave (boolean)
- **Display**: "Saving..." indicator when saving
- **Default size**: 6×6

### 15. Weather (`weather`)

- **Component**: `WeatherWidget.svelte`
- **Service**: `weatherService` — `fetchWeather(city, country)` or `fetchWeatherWithIP()`
- **Display**: Current temp, location, emoji icon (WMO codes); 7-day forecast grid
- **Settings**: location (city,country), units (celsius|fahrenheit), showForecast (boolean)
- **Default size**: 4×5

### 16. Timetable (`timetable`)

- **Component**: `TimetableWidget.svelte` + subviews
- **API**: `/seqta/student/load/timetable`, `/seqta/student/load/prefs` (lesson colours)
- **Views**: week, day, month, list
- **Subcomponents**: TimetableHeader, TimetableWeekView, TimetableDayView, TimetableMonthView, TimetableListView, TimetableLessonPopout
- **Export**: CSV, PDF, iCal via `timetableExport`
- **Settings**: viewMode, timeRange, showTeacher, showRoom, showAttendance, showEmptyPeriods, density (compact|normal|comfortable)
- **Default size**: 12×8

---

## App Sidebar

- **Component**: `AppSidebar.svelte`
- **Location**: Left side of layout; controlled by `sidebarOpen` from `+layout.svelte`
- **Props**: `sidebarOpen`, `menu` (MenuItem[]), `onMenuItemClick`
- **Settings**: `get_settings_subset(['sidebar_folders','sidebar_favorites','menu_order'])`

### Menu Structure

- **MenuItem**: labelKey, icon, path, folderId?, isFavorite?, isRecent?
- **Order**: `combinedOrder` — mix of path strings and `{ type: 'folder', id }`
- **Favorites**: Shown first; `sidebar_favorites` array of paths
- **Folders**: `SidebarFolder` — id, name, items (paths), order, collapsed

### Features

- **Favorites section**: Star icon; items from `sidebar_favorites`
- **Folders**: Collapsible; ChevronRight rotates on expand; `toggleFolder` saves via `saveSettingsWithQueue`
- **Ctrl/Cmd + scroll**: Navigate between pages (next/prev in menu)
- **Mobile**: Full-screen overlay; close button (XMark); "Menu" header
- **Active state**: `bg-accent text-white` for current path
- **Animations**: slide for folder expand, fade for items

### Layout

- **Desktop**: `sm:w-64` when open; `sm:w-0` when collapsed
- **Mobile**: `fixed`, full width, `z-30`

---

## App Header

- **Component**: `AppHeader.svelte`
- **Location**: Top bar; shown when `!$needsSetup`
- **Props**: sidebarOpen, weatherEnabled, weatherData, userInfo, showUserDropdown, onToggleSidebar, onToggleUserDropdown, onLogout, onShowAbout, onClickOutside

### Left Section

- **Sidebar toggle**: Bars3 icon; `onToggleSidebar`
- **Logo**: DesQTA branding (`betterseqta-dark-icon.png`)
- **Weather**: Compact `WeatherWidget` when enabled
- **QuestionnaireWidget**: In-app surveys

### Center Section

- **Global Search**: `GlobalSearchOptimized.svelte` when `global_search_enabled` (Settings)
- **Shortcut**: `toggle-global-search` in SearchActions

### Right Section

- **UserDropdown**: Profile, About, Get Help, ProfileSwitcher, Sign out, Quit
- **Cloud status**: `cloudUserStore` — signed in (emerald) vs not (NoSymbol overlay); "Go to Settings" link
- **Notifications**: Bell icon; unread badge; `/seqta/student/heartbeat` for notifications
- **Window controls** (desktop): Minimize, Maximize, Close

### Notifications

- **API**: `/seqta/student/heartbeat` — payload.notifications
- **Types**: message, coneqtassessments, report
- **Click**: goto assessment detail, reports, or direqt-messages
- **auto_dismiss_message_notifications**: Dismiss on click; POST `/seqta/student/notification/dismiss`
- **Mobile**: Full-screen modal instead of dropdown

---

## Global Search

- **Component**: `GlobalSearchOptimized.svelte` + `SearchModal.svelte`
- **Data**: `SearchData.ts` — PAGES, actions, settings; `SearchActions.ts` handleAction
- **Modes**: normal, command, fuzzy
- **Shortcut**: `toggle-global-search` (Ctrl/Cmd+K)
- **URL sync**: `?search=` and `?go=` params for deep linking

### Search Items

- **Categories**: page, action, setting, recent, favorite
- **Sources**: Static pages (Home, Analytics, Assessments, etc.); dynamic assessments/courses from IndexedDB
- **Keywords**: Fuzzy search; `fuzzyScore`; sanitized input

### Actions

- **handleAction**: Navigate (goto), toggle theme, toggle global search, etc.
- **Recent/favorites**: `searchHistory`, `favoriteItems` stores

---

## Layout

- **File**: `src/routes/+layout.svelte`
- **Flow**: shellReady → LoadingScreen; else main shell

### Shell Structure

- **AppHeader**: When `!$needsSetup`
- **AppSidebar**: When `!$needsSetup && !menuLoading`
- **Main**: `children()` or SetupAssistant / LoginScreen
- **ThemeBuilder**: Fixed right sidebar when `$themeBuilderSidebarOpen`
- **OfflineBanner**: When `!$needsSetup`
- **Toaster**: svelte-sonner, bottom-right
- **AboutModal**, **Onboarding**: Conditionally rendered

### Auth Flow

- **needsSetup**: From `checkSession`; `layoutAuthService`
- **SetupAssistant**: When `!hasCompletedSetupAssistant`; 4 steps (Welcome, Language, How to Log In, Ready)
- **LoginScreen**: When `hasCompletedSetupAssistant`; `startLogin` → `checkSession`
- **contentLoading**: Blocks main content until init complete

### Theme & Settings

- **accentColor**, **theme**: Applied to `document.documentElement`
- **enhancedAnimations**: `document.body.classList`
- **initConnectivity**, **initQueueService**: When logged in
- **healthCheck**: Heartbeat; logout on 401

### Offline Banner

- **Component**: `OfflineBanner.svelte`
- **Store**: `connectivity` — status: offline | degraded | queued | syncing
- **Display**: Amber (offline/degraded/queued), emerald (syncing); Retry button when queued

---

## Theme Builder Sidebar

- **Component**: `ThemeBuilder.svelte`
- **Store**: `themeBuilderSidebarOpen`
- **Location**: Fixed right, 384px width when open
- **Features**: Create/edit themes; preview; export/import; load from theme store; advanced options
- **Config**: ExtendedThemeManifest — name, displayName, description, version, author, category, tags, settings, fonts, animations, colorSchemes, accessibility, responsive

---

## Login Screen

- **Component**: `LoginScreen.svelte`
- **Props**: seqtaUrl, onStartLogin, onUrlChange
- **Methods**: URL entry, QR scan (Html5Qrcode), direct username/password
- **Mobile**: QR or manual SSO URL; `showMobileSsoInput`
- **Profiles**: `list_profiles`; ProfileSwitcher; `loadProfiles`
- **Dev**: `devSensitiveInfoHider` (key buffer); `getRandomDicebearAvatar` for avatars

---

## Setup Assistant

- **Component**: `SetupAssistant.svelte`
- **Steps**: 4 — Welcome, Language, How to Log In, Ready
- **Settings**: `has_completed_setup_assistant: true` on complete
- **Skip**: `skipSetup`; Escape key
- **Progress**: Dots; Back/Continue; Next/Get Started
- **Language**: Step 2 — `LanguageSelector` with flags
- **Login info**: Step 3 — QR, URL, direct options

---

## Onboarding

- **Component**: `Onboarding.svelte`
- **Trigger**: `has_been_through_onboarding` false; `redo-onboarding` event
- **Steps**: 6 — Dashboard, Study, Analytics, Timetable, Theme Store, Cloud Sync
- **Targets**: `data-onboarding` selectors; `highlightElement`; overlay
- **Navigation**: goto each step's page; `scrollTo`; timetableViewCycleInterval
- **Complete**: `saveSettingsWithQueue({ has_been_through_onboarding: true })`

---

## Notification System

- **Source**: `/seqta/student/heartbeat` — payload.notifications
- **Types**: message (ChatBubbleLeftRight), coneqtassessments (ClipboardDocumentList), report (DocumentText)
- **UI**: AppHeader dropdown; mobile modal
- **Dismiss**: `auto_dismiss_message_notifications` — POST `/seqta/student/notification/dismiss`
- **Click**: goto assessment, reports, or direqt-messages

---

## Pages Menu

- **Component**: `PagesMenu.svelte`
- **Trigger**: `showPagesMenu` (not currently used in header; legacy)
- **Display**: Modal overlay; search input; filtered page list
- **Pages**: Dashboard, Analytics, Assessments, Courses, Directory, Messages, News, Notices, QR Sign-in, Reports, Settings, Timetable, Welcome
- **Keyboard**: ArrowUp/Down, Enter; Escape to close
- **Click outside**: close

---

## User Dropdown

- **Component**: `UserDropdown.svelte`
- **Props**: userInfo, showUserDropdown, onToggleUserDropdown, onLogout, onShowAbout, onClickOutside
- **Avatar**: custom profile (`get_profile_picture_data_url`), school picture, or initial
- **Items**: About (onShowAbout), Get Help (goto /user-documentation), ProfileSwitcher, Sign out (onLogout), Quit (invoke('quit'))
- **dev_sensitive_info_hider**: Dicebear avatar

---

## Rust Backend

- **Entry**: `src-tauri/src/lib.rs`; `main.rs` for binary
- **Modules**: auth/login, utils (analytics, assessments, courses, database, logger, messages, netgrab, news, notes_filesystem, profiles, settings, theme_manager, todolist, etc.), services (seqta_mentions, theme_store)

### Key Tauri Commands (by module)

| Module               | Commands                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **lib**              | greet, quit, enable/disable/is_autostart_enabled, get_seqta_base_url                                                                |
| **login**            | check_session_exists, save_session, create_login_window, logout, force_reload, direct_login, reauthenticate, etc.                   |
| **settings**         | get_settings, save_settings, get_settings_subset, save_settings_merge, upload_settings_to_cloud, download_settings_from_cloud, etc. |
| **database**         | db*cache_get/set/delete/clear, db_queue*_, db*widget_layout_save/load, db_search*_, db*notification*\*                              |
| **netgrab**          | get_api_data, post_api_data, proxy_request, get_seqta_file, upload_seqta_file                                                       |
| **analytics**        | save_analytics, load_analytics, sync_analytics_data                                                                                 |
| **theme_manager**    | get_available_themes, load_theme_manifest, save_custom_theme, import/export_theme                                                   |
| **theme_store**      | theme_store_list_themes, theme_store_download_theme, theme_store_favorite_theme, etc.                                               |
| **notes_filesystem** | load/save/delete notes, folders, search, backup, restore                                                                            |
| **todolist**         | load_todos, save_todos                                                                                                              |
| **profiles**         | list_profiles, switch_profile, delete_profile                                                                                       |

### Database

- **SQLite**: `database::init_database`; rusqlite
- **Cache**: db*cache*_ for key-value; db*queue*_ for offline sync queue
- **Widget layout**: db_widget_layout_save/load

### Plugins

- tauri_plugin_notification, opener, deep_link, dialog
- Desktop: updater, autostart, single_instance
- Deep link: `desqta://auth/callback` (Discord OAuth), `desqta://auth` (SEQTA cookie), `seqtalearn://` (SSO)

---

## Error Page

- **File**: `src/routes/+error.svelte`
- **Props**: error, status

### URL Params

- `errorId`, `category`, `severity`, `message`, `report` (JSON)

### Error Types

- **Auth** (401/403): "Go to Login" → goHome
- **Network**: Wifi icon; retry
- **NotFound** (404): goBack
- **Server** (5xx): retry
- **Categories**: NETWORK, AUTHENTICATION, RUNTIME, VALIDATION, UI

### Actions

- Go Back, Retry, Refresh, Advanced Troubleshooting (TroubleshootingModal), Go Home, Mark as Resolved
- **TroubleshootingModal**: diagnostics, logs, API test, system info

### Display

- System health (systemHealth, networkStatus, storageStatus)
- Recommendations, performance issues, recent errors
- Collapsible detailed info (context, environment, stack trace)
- Dev debug info when `import.meta.env.DEV`

---

## Modals

### About Modal

- **Component**: `AboutModal.svelte`
- **Content**: App version, links (Docs, GitHub, Discord, etc.), EULA section
- **Easter egg**: Konami code → audio + konami-mode class

### Cloud Sync Modal

- **Component**: `CloudSyncModal.svelte`
- **Auth**: Email/password; Discord OAuth callback
- **Actions**: Sign in, upload, download settings
- **Events**: `discord-oauth-callback`

### Troubleshooting Modal

- **Component**: `TroubleshootingModal.svelte`
- **Tabs**: Diagnostics, Logs, API Test, System Info
- **Data**: get_logs_for_troubleshooting, seqtaFetch heartbeat, get_system_metrics
- **Copy**: Export logs to clipboard

### Base Modal

- **Component**: `Modal.svelte` — backdrop, fly transition, aria-label, close on Escape

---

## Offline Mode

- **Store**: `connectivity` — status: online | offline | syncing | degraded | queued
- **Init**: `initConnectivity(getQueueCount)` from layout
- **Triggers**: `navigator.onLine`, `dev_force_offline_mode`, `checkSeqtaConnectivity`
- **Heartbeat**: 60s interval; `/seqta/student/heartbeat`

### Banner

- **Component**: `OfflineBanner.svelte`
- **Shown**: status in offline | degraded | queued | syncing
- **Styles**: Amber (offline/degraded/queued), emerald (syncing)
- **Retry**: flushQueue when queued

### Queue

- **queueService**: Offline changes queued; sync when online
- **setQueuedCount**: From queueService; updates connectivity status

---

## Dashboard Edit Mode

- **Component**: `EditModeToggle.svelte` + `WidgetGrid.svelte`
- **Toggle**: "Edit Layout" ↔ "Done Editing"

### Edit Mode Actions

- **Add Widget**: AddWidgetDialog — pick from registry
- **Templates**: WidgetTemplates — apply preset layouts; widgetTemplatesService
- **Reset Layout**: widgetService.resetLayout; confirm

### Widget Grid

- **Library**: GridStack

### Drag & Resize

- **Preset sizes**: w: [3,4,6,8,12], h: [4,5,6,8,10]
- **snapToPreset**: Snaps to nearest preset on change
- **Save**: debouncedSave (500ms) → widgetService.saveLayout

### Layout Templates

- **Service**: widgetTemplatesService — loadTemplates, applyTemplate
- **WidgetTemplates**: Search, preview, apply, save custom, delete

---

_Last updated 25/03/2026_
