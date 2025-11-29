<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    Icon,
    BookOpen,
    ChevronDown,
    Home,
    Cog6Tooth,
    CalendarDays,
    ClipboardDocumentList,
    ChatBubbleLeftRight,
    ChartBar,
  } from 'svelte-hero-icons';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../lib/i18n';
  import { fade, fly } from 'svelte/transition';

  interface FAQItem {
    question: string;
    answer: string;
    category: string;
  }

  let selectedFAQ = $state<FAQItem | null>(null);
  let showModal = $state(false);
  let searchQuery = $state('');

  const faqItems: FAQItem[] = [
    // Getting Started
    {
      category: 'Getting Started',
      question: 'How do I log in to DesQTA?',
      answer:
        'When you first open DesQTA, you\'ll see a login screen. Enter your SEQTA URL (usually provided by your school, e.g., "yourschool.seqta.com.au") and click "Start Login". A secure browser window will open for you to authenticate with your school credentials. Once logged in, your session will be automatically saved for future use. You can also use QR code or deep link login if your school supports it.',
    },
    {
      category: 'Getting Started',
      question: 'What is the dashboard and what widgets are available?',
      answer:
        "The dashboard is your home page in DesQTA, providing a comprehensive overview of your academic life. Available widgets include:\n\n• Upcoming Assessments - Shows your next assignments and tests\n• Today's Schedule - Displays your classes for the current day\n• Recent News - Latest school announcements and updates\n• Messages Preview - Quick access to recent DireQt messages\n• Notices - Important school notices and announcements\n• Focus Timer - Pomodoro-style timer for study sessions\n• Todo List - Track your tasks and to-dos\n• Homework - View assigned homework\n• Shortcuts Widget - Quick links to frequently used resources\n• Portals Embed - Access external portals directly\n\nYou can customize which widgets appear on your dashboard in Settings.",
    },
    {
      category: 'Getting Started',
      question: 'How does the global search feature work?',
      answer:
        'DesQTA includes a powerful global search accessible via the search bar in the header (or press Ctrl+K / Cmd+K). The search supports multiple modes:\n\n• Normal Search - Standard text search across pages, actions, and content\n• Command Mode - Type "/" to access quick commands and actions\n• Fuzzy Search - Intelligent matching that finds results even with typos\n\nFeatures include:\n• Search history tracking\n• Recent items display\n• Favorite items for quick access\n• Custom shortcuts\n• Category filtering\n• Usage analytics\n\nSearch results are prioritized by relevance and usage frequency. You can mark frequently used items as favorites for instant access.',
    },
    {
      category: 'Getting Started',
      question: 'What are the main pages and features in DesQTA?',
      answer:
        'DesQTA provides comprehensive student management with these main sections:\n\n• Dashboard - Your home page with customizable widgets\n• Courses - Access course materials, content, and resources\n• Assessments - Manage assignments, tests, and exams with multiple view options\n• Timetable - View your weekly schedule with export capabilities\n• Study - Notes editor with TipTap, todo lists, and study tools\n• DireQt Messages - SEQTA messaging system with folders and attachments\n• Portals - External portal integration\n• Notices - School notices and announcements\n• News - Latest news feed\n• Directory - Student and staff directory\n• Reports - Academic reports and analytics\n• Analytics - Performance insights and data visualization\n• Settings - Customize appearance, shortcuts, sync, and more',
    },
    // Navigation
    {
      category: 'Navigation',
      question: 'How do I navigate between pages?',
      answer:
        'Use the sidebar on the left to navigate between different sections. The sidebar includes:\n\n• Dashboard (Home icon)\n• Courses (Book icon)\n• Assessments (Clipboard icon)\n• Timetable (Calendar icon)\n• Study (Pencil icon)\n• DireQt Messages (Chat icon)\n• Portals (Globe icon)\n• Notices (Document icon)\n• News (Newspaper icon)\n• Directory (User icon)\n• Reports (Chart icon)\n• Analytics (Academic cap icon)\n• Settings (Gear icon)\n\nOn mobile devices, tap the menu icon (hamburger menu) in the header to open the sidebar. You can also use the global search (Ctrl+K / Cmd+K) to quickly jump to any page.',
    },
    {
      category: 'Navigation',
      question: 'Can I customize the sidebar behavior?',
      answer:
        'Yes! In Settings > Interface, you can customize sidebar behavior:\n\n• Auto-collapse sidebar when navigating - Automatically hides the sidebar when you click a navigation link\n• Auto-expand sidebar on hover - Temporarily shows the sidebar when you move your mouse near the left edge\n• Sidebar width - Adjust the width of the sidebar\n• Show icons only - Display only icons without labels for a more compact view\n\nThese settings help optimize your workspace based on your screen size and preferences.',
    },
    // Assessments
    {
      category: 'Assessments',
      question: 'What assessment views are available and how do they work?',
      answer:
        'DesQTA offers four different views for managing assessments:\n\n1. List View - Traditional list format showing all assessments with details like title, subject, due date, and status badges. Great for seeing everything at once.\n\n2. Board View (Kanban) - Organize assessments into columns by status (Not Started, In Progress, Completed) or group by subject/month. Drag and drop to update status. Perfect for visual organization.\n\n3. Calendar View - See assessments on a calendar grid. Click any date to see assessments due on that day. Navigate between months using arrow buttons.\n\n4. Gantt View - Timeline visualization showing assessment durations and overlaps. Color-coded by subject. Excellent for planning and identifying busy periods.\n\nSwitch between views using the dropdown at the top of the Assessments page. Your view preference is saved automatically.',
    },
    {
      category: 'Assessments',
      question: 'How do I filter and organize my assessments?',
      answer:
        'The Assessments page provides powerful filtering options:\n\n• Year Filter - Filter assessments by academic year using the year dropdown\n• Subject Filter - Show/hide assessments by subject (checkboxes for each subject)\n• Status Filter - Filter by assessment status (Not Started, In Progress, Completed, Overdue)\n• Date Range - Filter by due date range\n\nIn Board View, you can also group by:\n• Subject - Group assessments by subject\n• Month - Group by due date month\n• Status - Group by completion status\n\nFiltered results update in real-time. You can combine multiple filters for precise results.',
    },
    {
      category: 'Assessments',
      question: 'How do I submit files for assessments?',
      answer:
        'To submit files for an assessment:\n\n1. Click on the assessment card to open its details page\n2. Navigate to the "Submissions" tab\n3. Click "Upload Files" or drag and drop files into the upload area\n4. Select one or multiple files (supports various formats)\n5. Wait for upload to complete - you\'ll see a progress indicator\n6. Files will appear in your submissions list\n\nYou can also submit links instead of files. Click "Add Link" and paste the URL. Both files and links can be removed before the due date. Submitted files are automatically synced with SEQTA.',
    },
    {
      category: 'Assessments',
      question: 'What information is shown in assessment details?',
      answer:
        'Clicking on any assessment opens a detailed view with multiple tabs:\n\n• Overview - Full assessment description, instructions, resources, and teacher information\n• Details - Due date, subject, status, weight, and metadata\n• Submissions - Upload files or links, view submission history, and check submission status\n• Feedback - Teacher comments, grades, and feedback (when available)\n\nAssessment cards show:\n• Title and subject code\n• Due date with relative time (e.g., "Due in 3 days")\n• Status badge (Not Started, In Progress, Overdue, Completed)\n• Subject color coding\n• Progress indicators\n\nUse the navigation breadcrumbs or back button to return to the assessments list.',
    },
    {
      category: 'Assessments',
      question: 'What is Grade Predictions and how does it work?',
      answer:
        'Grade Predictions is an AI-powered feature that analyzes your assessment history and performance to predict future grades. It appears on the Assessments page when enabled.\n\nThe system:\n• Analyzes your past assessment results\n• Considers subject difficulty and trends\n• Provides grade range predictions\n• Shows confidence levels\n• Updates predictions as you complete more assessments\n\nTo enable/disable Grade Predictions, use the toggle on the Assessments page. Predictions are estimates based on historical data and should be used as guidance, not guarantees.',
    },
    // Timetable
    {
      category: 'Timetable',
      question: 'How does the timetable work?',
      answer:
        'The Timetable page displays your weekly class schedule in a grid format:\n\n• Days of the week as columns\n• Time periods as rows\n• Classes shown as colored blocks with subject names\n• Subject colors match your SEQTA preferences\n• Overlapping classes are handled intelligently\n• Today\'s date is highlighted\n\nNavigation:\n• Use arrow buttons to move between weeks\n• Click "Today" to jump to the current week\n• Use the date picker for specific dates\n\nFeatures:\n• Responsive design adapts to screen size\n• Mobile-friendly touch navigation\n• Export options (ICS for calendar apps, PDF for printing)\n• Today widget on dashboard shows current day\'s schedule',
    },
    {
      category: 'Timetable',
      question: 'How do I export my timetable?',
      answer:
        'To export your timetable:\n\n1. Go to the Timetable page\n2. Navigate to the week you want to export\n3. Click the export button (usually in the top-right)\n4. Choose export format:\n   • ICS File - For importing into Google Calendar, Apple Calendar, Outlook, etc.\n   • PDF - For printing or saving as a document\n\nICS files can be imported into most calendar applications and will sync automatically. PDF exports include all classes with colors and formatting preserved. Exports include all visible classes for the selected week.',
    },
    // Study Tools
    {
      category: 'Study Tools',
      question: 'How does the Notes editor work?',
      answer:
        'DesQTA includes a powerful rich text editor built with TipTap:\n\nFeatures:\n• Rich formatting - Bold, italic, underline, strikethrough, headings\n• Lists - Bullet lists, numbered lists, task lists (checkboxes)\n• Tables - Insert and edit tables with resizable columns\n• Links - Add hyperlinks to external resources\n• Images - Insert images (base64 or file uploads)\n• Code blocks - Syntax highlighting for code\n• Blockquotes - Quote important information\n• SEQTA Mentions - Mention courses, assessments, or other SEQTA items\n\nToolbar:\n• Formatting buttons at the top\n• Bubble menu appears when selecting text\n• Context menu (right-click) for additional options\n• Status bar shows word count and character count\n\nNotes are automatically saved and stored locally. You can create multiple notes, search through them, and organize by tags or folders.',
    },
    {
      category: 'Study Tools',
      question: 'How do I use the Todo List?',
      answer:
        'The Todo List widget on your dashboard helps you track tasks:\n\n• Add new todos - Click the "+" button or press Enter\n• Mark complete - Click the checkbox next to any todo\n• Delete todos - Click the trash icon\n• Reorder - Drag and drop to reorder items\n\nFeatures:\n• Persistent storage - Todos are saved automatically\n• Multiple lists - Create separate lists for different purposes\n• Due dates - Set due dates for todos\n• Priority levels - Mark important todos\n• Filtering - Filter by completed/pending status\n\nAccess the full Todo List from the Study page for advanced features like categories, tags, and detailed task management.',
    },
    {
      category: 'Study Tools',
      question: 'How does the Focus Timer work?',
      answer:
        'The Focus Timer is a Pomodoro-style productivity timer:\n\nBasic Usage:\n• Click "Start" to begin a focus session\n• Default duration is 25 minutes\n• Timer counts down with visual feedback\n• When timer ends, it automatically switches to a 5-minute break\n• Break timer then switches back to focus time\n• Audio notification plays when timer completes\n\nCustomization:\n• Preset durations: 15, 25, 30, 45, or 60 minutes\n• Custom duration: Enter minutes and seconds manually\n• Pause/Resume - Pause anytime and resume later\n• Reset - Reset timer to selected duration\n\nFeatures:\n• Visual indicator changes color during breaks (green) vs focus (accent color)\n• Status text shows "Focus Time" or "Break Time"\n• Encouragement messages\n• Works offline - No internet required\n\nPerfect for maintaining focus during study sessions and taking regular breaks.',
    },
    // Messages
    {
      category: 'Messages',
      question: 'How does DireQt messaging work?',
      answer:
        'DireQt Messages is DesQTA\'s integrated messaging system:\n\nFolders:\n• Inbox - Received messages\n• Sent - Messages you\'ve sent\n• Drafts - Saved drafts\n• Trash - Deleted messages\n\nComposing Messages:\n1. Click "Compose" button\n2. Enter recipient(s) - Search and select from directory\n3. Add subject line\n4. Write message content\n5. Attach files if needed\n6. Click "Send" or "Save Draft"\n\nMessage Features:\n• Rich text formatting\n• File attachments\n• Reply and forward\n• Mark as read/unread\n• Delete messages\n• Search through messages\n• Message caching for offline access\n\nMessages are synced with SEQTA and cached locally for fast access. Content is cached with long TTL for offline viewing.',
    },
    {
      category: 'Messages',
      question: 'How do I manage message folders?',
      answer:
        'Message folders help organize your communications:\n\n• Inbox - All received messages appear here. Unread messages are highlighted.\n• Sent - Messages you\'ve sent are stored here for reference.\n• Drafts - Save incomplete messages here. Click "Save Draft" when composing.\n• Trash - Deleted messages go here. You can restore or permanently delete.\n\nFolder Management:\n• Switch folders using the sidebar on desktop or tabs on mobile\n• Each folder shows message count\n• Unread count badge on Inbox\n• Empty state messages when folders are empty\n• Search works within the current folder\n\nMessages persist across sessions and sync with SEQTA. Use folders to keep your communications organized.',
    },
    // Global Search
    {
      category: 'Global Search',
      question: 'How do I use global search effectively?',
      answer:
        'Global Search (Ctrl+K / Cmd+K) is your quick navigation tool:\n\nSearch Modes:\n• Normal - Type to search pages, actions, and content\n• Command Mode - Type "/" for quick commands (e.g., "/settings", "/logout")\n• Fuzzy Search - Intelligent matching finds results even with typos\n\nFeatures:\n• Search History - Previous searches are saved\n• Recent Items - Frequently accessed items appear first\n• Favorites - Star items for instant access\n• Categories - Filter by Pages, Actions, Shortcuts\n• Custom Shortcuts - Create your own searchable shortcuts\n• Usage Analytics - Tracks what you search for most\n\nTips:\n• Use keywords from page names or descriptions\n• Favorite frequently used pages\n• Create custom shortcuts for external URLs\n• Use command mode for quick actions\n• Search is case-insensitive and supports partial matches',
    },
    {
      category: 'Global Search',
      question: 'How do I create custom shortcuts in search?',
      answer:
        'Custom shortcuts let you quickly access external URLs or frequently used resources:\n\nCreating Shortcuts:\n1. Open Global Search (Ctrl+K / Cmd+K)\n2. Navigate to Shortcuts category\n3. Click "Add Custom Shortcut"\n4. Enter:\n   • Name - Display name\n   • URL - The link to open\n   • Description (optional)\n   • Keywords (optional) - For better search matching\n5. Save the shortcut\n\nUsing Shortcuts:\n• Type the shortcut name in search\n• Shortcuts appear in search results\n• Click to open in default browser\n• Favorite shortcuts for quick access\n\nManaging Shortcuts:\n• Edit or delete shortcuts from Settings > Search\n• Import/export shortcuts for backup\n• Disable shortcuts without deleting\n• Organize with categories or tags',
    },
    // Theme & Appearance
    {
      category: 'Theme & Appearance',
      question: 'How do I customize themes and appearance?',
      answer:
        'DesQTA offers extensive theming options:\n\nTheme Modes:\n• Light Mode - Bright interface\n• Dark Mode - Dark interface (default)\n• System - Follows your operating system preference\n\nAccent Colors:\n• Choose from preset accent colors\n• Custom color picker for personalized accent\n• Accent affects buttons, links, highlights, and interactive elements\n\nTheme Store:\n• Browse community-created themes\n• Install themes with one click\n• Themes include colors, fonts, and styling\n• Preview themes before applying\n• Rate and review themes\n\nTheme Builder:\n• Create custom themes\n• Adjust colors, fonts, spacing\n• Export themes to share\n• Import themes from files\n• Save multiple custom themes\n\nAccess all theme options in Settings > Appearance.',
    },
    {
      category: 'Theme & Appearance',
      question: 'What is the Theme Builder and how do I use it?',
      answer:
        'Theme Builder is a visual tool for creating custom themes:\n\nFeatures:\n• Color Picker - Select colors for backgrounds, text, accents\n• Font Selector - Choose fonts for headings and body text\n• Spacing Controls - Adjust padding and margins\n• Live Preview - See changes instantly\n• Export/Import - Save themes as JSON files\n\nCreating a Theme:\n1. Go to Settings > Theme Builder\n2. Use the sidebar to adjust settings\n3. Preview changes in real-time\n4. Click "Save Theme" when satisfied\n5. Name your theme\n6. Optionally export to share with others\n\nTheme Properties:\n• Background colors (light/dark variants)\n• Text colors\n• Accent color and variants\n• Border colors\n• Shadow styles\n• Font families and sizes\n• Border radius\n• Transition speeds\n\nYour custom themes are saved locally and can be synced via Cloud Sync.',
    },
    // Cloud Sync
    {
      category: 'Cloud Sync',
      question: 'How does cloud sync work with BetterSEQTA Plus?',
      answer:
        'Cloud Sync allows you to sync settings across all your devices:\n\nSetup:\n1. Create a free BetterSEQTA Plus account at accounts.betterseqta.org\n2. Go to Settings > Cloud Sync\n3. Click "Login & Sync Settings"\n4. Enter your BetterSEQTA Plus authentication token\n5. Authenticate to link your account\n\nWhat Syncs:\n• App settings and preferences\n• Dashboard shortcuts\n• Theme preferences and custom themes\n• Search favorites and custom shortcuts\n• Widget configurations\n• Interface preferences\n\nSync Operations:\n• Upload Settings - Save current settings to cloud\n• Download Settings - Load settings from cloud (overwrites local)\n• Auto-sync - Automatically sync on changes (optional)\n\nSecurity:\n• All data is encrypted in transit\n• Authentication tokens are stored securely\n• You can logout to disconnect sync\n• Settings are private to your account',
    },
    {
      category: 'Cloud Sync',
      question: 'How do I upload or download my settings?',
      answer:
        'Manual Sync Operations:\n\nUpload Settings:\n1. Go to Settings > Cloud Sync\n2. Ensure you\'re logged in (green indicator)\n3. Click "Upload Settings"\n4. Wait for confirmation message\n5. Your current settings are now in the cloud\n\nDownload Settings:\n1. Go to Settings > Cloud Sync\n2. Ensure you\'re logged in\n3. Click "Download Settings"\n4. Confirm overwrite (this replaces local settings)\n5. Settings from cloud are applied\n\nImportant Notes:\n• Downloading overwrites local settings - consider backing up first\n• Uploading replaces cloud settings with current local settings\n• Sync includes all preferences, shortcuts, and themes\n• Large custom themes may take longer to sync\n• Check your internet connection before syncing\n\nAuto-sync can be enabled to automatically upload changes, eliminating the need for manual operations.',
    },
    // Settings
    {
      category: 'Settings',
      question: 'What settings are available and how do I configure them?',
      answer:
        'DesQTA provides comprehensive settings organized into sections:\n\nAppearance:\n• Theme mode (Light/Dark/System)\n• Accent color selection\n• Theme Store access\n• Theme Builder\n• Font preferences\n\nDashboard:\n• Widget visibility toggles\n• Widget ordering\n• Dashboard shortcuts management\n• Add/edit/remove shortcuts\n• Shortcut icons and URLs\n\nInterface:\n• Sidebar behavior (auto-collapse, hover expand)\n• Sidebar width\n• Show icons only mode\n• Language selection\n• Date/time formats\n\nCloud Sync:\n• BetterSEQTA Plus authentication\n• Upload/download settings\n• Auto-sync toggle\n• Sync status indicator\n\nCache Management:\n• Clear cache\n• Cache size information\n• Cache settings\n\nTroubleshooting:\n• Export logs\n• System information\n• Performance metrics\n• Reset options\n\nAccess Settings from the sidebar or search for "settings".',
    },
    {
      category: 'Settings',
      question: 'How do I add and manage dashboard shortcuts?',
      answer:
        'Dashboard shortcuts provide quick access to frequently used resources:\n\nAdding Shortcuts:\n1. Go to Settings > Dashboard Shortcuts\n2. Click "Add Dashboard Shortcut"\n3. Enter:\n   • Name - Display name (e.g., "School Portal")\n   • Emoji Icon - Choose an emoji (optional but recommended)\n   • URL - The link to open (e.g., "https://portal.school.edu")\n4. Click "Save"\n\nManaging Shortcuts:\n• Edit - Click the edit icon to modify name, emoji, or URL\n• Delete - Click the trash icon to remove\n• Reorder - Drag and drop to change order\n• Enable/Disable - Toggle visibility without deleting\n\nShortcuts appear on your dashboard in the Shortcuts Widget. They open in your default browser when clicked. Shortcuts sync across devices if Cloud Sync is enabled.',
    },
    {
      category: 'Settings',
      question: 'How do I manage cache and improve performance?',
      answer:
        'Cache Management helps optimize app performance:\n\nViewing Cache:\n• Go to Settings > Cache Management\n• See total cache size\n• View breakdown by category (messages, images, API responses)\n\nClearing Cache:\n• Clear All - Removes all cached data\n• Clear by Category - Remove specific cache types\n• Clear Old Data - Remove expired cache entries\n\nCache Information:\n• Messages - Cached message content (long TTL for offline access)\n• Images - Cached images and media files\n• API Responses - Cached API data (short TTL)\n\nPerformance Tips:\n• Clear cache if app feels slow\n• Cache improves load times for frequently accessed data\n• Clearing cache forces fresh data fetch\n• Large cache may slow initial load\n• Regular cache clearing recommended monthly\n\nPerformance Results page shows detailed metrics including cache hit rates and load times.',
    },
    // Troubleshooting
    {
      category: 'Troubleshooting',
      question: 'The app is running slowly. What can I do?',
      answer:
        'If DesQTA feels slow, try these solutions:\n\nQuick Fixes:\n1. Clear Cache - Settings > Cache Management > Clear All\n2. Restart App - Close and reopen DesQTA\n3. Check Internet - Slow connection affects data loading\n4. Close Other Apps - Free up system resources\n\nPerformance Analysis:\n• Go to Performance Results page (from sidebar or search)\n• View detailed metrics:\n  - Cache hit rates\n  - API response times\n  - Memory usage\n  - Load times by page\n• Identify bottlenecks\n\nAdvanced Troubleshooting:\n• Export logs - Settings > Troubleshooting > Export Logs\n• Check system information\n• Review error logs\n• Clear IndexedDB cache\n• Reset app data (last resort)\n\nIf issues persist:\n• Check for app updates\n• Report issue on GitHub with logs\n• Contact support with system information',
    },
    {
      category: 'Troubleshooting',
      question: "I can't log in. What should I do?",
      answer:
        "Login issues can have several causes:\n\nCheck These First:\n1. SEQTA URL - Verify you're using the correct URL provided by your school\n2. Internet Connection - Ensure you have stable internet\n3. School Server Status - Check if SEQTA is experiencing outages\n4. Credentials - Verify your username and password are correct\n\nTroubleshooting Steps:\n1. Clear Session - Logout and try logging in again\n2. Clear Cache - Settings > Cache Management > Clear All\n3. Check Browser - If using webview login, try a different browser\n4. Check Firewall - Ensure DesQTA isn't blocked\n5. Update App - Make sure you're using the latest version\n\nDeep Link/QR Login:\n• If standard login fails, try QR code login\n• Ensure deep link handler is enabled\n• Check system permissions for URL handling\n\nStill Having Issues:\n• Export logs from Settings > Troubleshooting\n• Contact your school's IT support\n• Check DesQTA GitHub for known issues\n• Report bug with detailed information",
    },
    {
      category: 'Troubleshooting',
      question: 'How do I export logs and report bugs?',
      answer:
        'Reporting bugs with proper information helps developers fix issues quickly:\n\nExporting Logs:\n1. Go to Settings > Troubleshooting\n2. Click "Export Logs"\n3. Choose location to save log file\n4. Logs include:\n   - Error messages\n   - Performance data\n   - System information\n   - Recent actions\n\nSystem Information:\n• Operating System and version\n• DesQTA version\n• Platform (Windows/macOS/Linux)\n• Memory and CPU info\n• Network status\n\nReporting Bugs:\n1. Visit GitHub repository: github.com/BetterSEQTA/DesQTA\n2. Go to Issues section\n3. Click "New Issue"\n4. Include:\n   - Clear description of the problem\n   - Steps to reproduce\n   - Expected vs actual behavior\n   - Screenshots if applicable\n   - Exported logs\n   - System information\n\nBefore Reporting:\n• Check if issue is already reported\n• Try latest app version\n• Clear cache and restart\n• Check GitHub for known issues',
    },
    {
      category: 'Troubleshooting',
      question: "My data isn't syncing or saving properly. What should I do?",
      answer:
        "Data sync and save issues can be resolved with these steps:\n\nLocal Data Issues:\n• Check disk space - Low storage can prevent saves\n• Verify permissions - Ensure DesQTA has write permissions\n• Clear corrupted cache - Settings > Cache Management\n• Restart app - Sometimes fixes temporary issues\n\nCloud Sync Issues:\n• Verify login - Check Cloud Sync status in Settings\n• Check internet - Cloud sync requires connection\n• Manual sync - Try uploading/downloading manually\n• Re-authenticate - Logout and login again\n• Check BetterSEQTA Plus status\n\nData Loss Prevention:\n• Regular backups - Export settings periodically\n• Don't clear cache unnecessarily\n• Keep app updated\n• Don't force quit during saves\n\nRecovery:\n• Download from cloud if synced\n• Check local backups\n• Restore from exported settings\n• Contact support if critical data lost\n\nIf problems persist, export logs and report the issue with detailed steps.",
    },
  ];

  const categories = [
    'All',
    'Getting Started',
    'Navigation',
    'Assessments',
    'Timetable',
    'Study Tools',
    'Messages',
    'Global Search',
    'Theme & Appearance',
    'Cloud Sync',
    'Settings',
    'Troubleshooting',
  ];
  let selectedCategory = $state('All');

  let filteredFAQs = $derived.by(() => {
    let filtered = faqItems;

    if (selectedCategory !== 'All') {
      filtered = filtered.filter((item) => item.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.question.toLowerCase().includes(query) || item.answer.toLowerCase().includes(query),
      );
    }

    return filtered;
  });

  async function openFAQ(item: FAQItem) {
    selectedFAQ = item;
    // Wait for DOM to be ready before showing modal for smooth transition
    await tick();
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    // Delay to allow transition to complete before clearing
    setTimeout(() => {
      selectedFAQ = null;
    }, 300);
  }

  function getCategoryIcon(category: string) {
    const icons: Record<string, any> = {
      'Getting Started': Home,
      Navigation: Cog6Tooth,
      Assessments: ClipboardDocumentList,
      Timetable: CalendarDays,
      'Study Tools': BookOpen,
      Messages: ChatBubbleLeftRight,
      'Global Search': Cog6Tooth,
      'Theme & Appearance': Cog6Tooth,
      'Cloud Sync': Cog6Tooth,
      Settings: Cog6Tooth,
      Troubleshooting: ChartBar,
    };
    return icons[category] || BookOpen;
  }

  onMount(() => {
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
</script>

<div class="min-h-screen p-4 sm:p-6 md:p-8">
  <!-- Header Section -->
  <div class="mb-8 animate-fade-in-up">
    <Card variant="elevated" padding="lg" class="bg-white/80 dark:bg-zinc-900/60 backdrop-blur-sm">
      <div class="flex flex-col gap-4 items-center text-center sm:flex-row sm:text-left">
        <div
          class="flex justify-center items-center w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 sm:w-20 sm:h-20">
          <Icon src={BookOpen} class="w-8 h-8 sm:w-10 sm:h-10" />
        </div>
        <div class="flex-1">
          <h1 class="mb-2 text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl">
            <T key="documentation.title" fallback="User Documentation" />
          </h1>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
            <T
              key="documentation.subtitle"
              fallback="Everything you need to know about using DesQTA" />
          </p>
        </div>
        <Button
          variant="secondary"
          icon={Home}
          onclick={() => goto('/')}
          ariaLabel="Go to dashboard">
          <T key="documentation.back_to_dashboard" fallback="Back to Dashboard" />
        </Button>
      </div>
    </Card>
  </div>

  <!-- Search -->
  <div class="mb-6 animate-fade-in-up" style="animation-delay: 0.1s">
    <Card variant="default" padding="md">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder={$_('documentation.search_placeholder', {
          default: 'Search documentation...',
        })}
        class="w-full px-4 py-2 bg-white rounded-lg border transition-colors duration-200 border-zinc-300/70 dark:border-zinc-700/70 dark:bg-zinc-800/70 text-zinc-800 dark:text-white focus:outline-hidden focus:ring-2 accent-ring" />
    </Card>
  </div>

  <!-- Category Filter -->
  <div class="mb-6 animate-fade-in-up" style="animation-delay: 0.15s">
    <Card variant="ghost" padding="sm">
      <div class="flex flex-wrap gap-2">
        {#each categories as category (category)}
          <button
            onclick={() => (selectedCategory = category)}
            class="px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 border {selectedCategory ===
            category
              ? 'accent-bg text-white border-transparent shadow-sm'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-300'} active:scale-[0.98]">
            {category}
          </button>
        {/each}
      </div>
    </Card>
  </div>

  <!-- FAQ Section -->
  <div class="mb-8">
    {#if filteredFAQs.length === 0}
      <Card variant="default" padding="lg" class="text-center animate-fade-in-up">
        <div class="py-8">
          <Icon src={BookOpen} class="mx-auto mb-4 w-16 h-16 text-zinc-400" />
          <p class="text-lg font-medium text-zinc-600 dark:text-zinc-400">
            <T key="documentation.no_results" fallback="No results found" />
          </p>
          <p class="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
            <T
              key="documentation.try_different_search"
              fallback="Try a different search term or category" />
          </p>
        </div>
      </Card>
    {:else}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each filteredFAQs as item, index (item.question)}
          {@const categoryIcon = getCategoryIcon(item.category)}
          <div in:fly={{ y: 20, duration: 300, delay: index * 0.03 }}>
            <Card
              variant="elevated"
              padding="lg"
              interactive={true}
              onclick={() => openFAQ(item)}
              class="h-full flex flex-col transition-all duration-200 hover:shadow-xl hover:scale-[1.02] cursor-pointer">
              <!-- Icon and Category -->
              <div class="flex gap-3 items-start mb-3">
                <div
                  class="flex justify-center items-center shrink-0 w-12 h-12 rounded-xl bg-accent-100 dark:bg-accent-900/30">
                  <Icon src={categoryIcon} class="w-6 h-6 text-accent-600 dark:text-accent-400" />
                </div>
                <div class="flex-1 min-w-0">
                  <span
                    class="inline-block px-2 py-1 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {item.category}
                  </span>
                </div>
              </div>

              <!-- Question -->
              <h3 class="mb-3 text-base font-semibold text-zinc-900 dark:text-white line-clamp-2">
                {item.question}
              </h3>

              <!-- Click to view hint -->
              <div class="mt-auto pt-2">
                <div class="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-500">
                  <span>Click to view answer</span>
                  <Icon src={ChevronDown} class="w-4 h-4" />
                </div>
              </div>
            </Card>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Footer -->
  <div class="mt-12 mb-8 text-center animate-fade-in-up" style="animation-delay: 0.2s">
    <Card variant="ghost" padding="md">
      <p class="text-sm text-zinc-600 dark:text-zinc-400">
        <T key="documentation.need_more_help" fallback="Need more help?" />
        <a
          href="https://github.com/BetterSEQTA/DesQTA"
          target="_blank"
          rel="noopener noreferrer"
          class="ml-1 font-medium text-accent-600 dark:text-accent-400 hover:underline">
          <T key="documentation.visit_github" fallback="Visit our GitHub repository" />
        </a>
      </p>
    </Card>
  </div>

  <!-- FAQ Modal -->
  {#if selectedFAQ}
    {@const categoryIcon = getCategoryIcon(selectedFAQ.category)}
    <Modal
      open={showModal}
      title={selectedFAQ.question}
      maxWidth="max-w-3xl"
      closeOnBackdrop={true}
      closeOnEscape={true}
      onclose={closeModal}
      ariaLabel="FAQ Answer">
      {#key selectedFAQ.question}
        <div class="px-8 pb-8">
          <!-- Category Badge -->
          <div class="mb-6" in:fade={{ duration: 200, delay: 100 }}>
            <div class="flex gap-3 items-center">
              <div
                class="flex justify-center items-center shrink-0 w-10 h-10 rounded-lg bg-accent-100 dark:bg-accent-900/30">
                <Icon src={categoryIcon} class="w-5 h-5 text-accent-600 dark:text-accent-400" />
              </div>
              <span
                class="px-3 py-1 text-sm font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {selectedFAQ.category}
              </span>
            </div>
          </div>

          <!-- Answer Content -->
          <div
            class="prose prose-zinc dark:prose-invert max-w-none"
            in:fade={{ duration: 300, delay: 150 }}>
            <p
              class="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
              {selectedFAQ.answer}
            </p>
          </div>
        </div>
      {/key}
    </Modal>
  {/if}
</div>

<style>
  @keyframes fade-in-up {
    0% {
      opacity: 0;
      transform: translateY(20px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in-up {
    animation: fade-in-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
