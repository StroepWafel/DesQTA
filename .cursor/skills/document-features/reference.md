# Document Features — Reference

## Output Template

```markdown
# [App Name] Features

This document provides a detailed inventory of features in the [App Name] application, with emphasis on the **[Module Name]** module.

---

## [Module Name] Module

[1–2 sentence intro describing the module's purpose.]

### 1. [Main Page Name] (`/route-path`)

#### 1.1 [Subsection: Data Loading & Caching]

- **Source**: API/Tauri command, cache strategy
- **Deduplication / merging**: If applicable
- **Background sync**: If applicable

#### 1.2 [Subsection: Filters / Controls]

- **Dropdown/control**: What it does, URL persistence
- **Empty state**: Message and behavior

#### 1.3 [Subsection: View Modes]

| View | Component | Description |
|------|------------|-------------|
| **Name** | `ComponentName` | Brief description |

#### 1.4 [Subsection: URL Params & Deep Linking]

- **`?param=`**: Purpose, source (e.g. timetable link)
- **Highlight / scroll**: If applicable

---

### 2. [Child View / Tab] (`ComponentName`)

[Same structure: subsections for each feature area]

---

### 3. [Detail Page] (`/route/[id]`)

#### 3.1 [Tab 1]

- Feature bullets

#### 3.2 [Tab 2]

- Feature bullets

---

### 4. [Shared Components]

- **ComponentName**: What it displays, props, behavior

---

### 5. [Services]

- **serviceName**: Purpose, inputs, outputs, caching

---

### 6. Integrations

- **Source**: Where this page is linked from
- **Target**: Where this page links to
- **Notifications**: If applicable

---

### 7. UI/UX Details

- Loading, empty states, i18n, transitions, responsive behavior

---

## Other Modules (Summary)

[Brief list if documenting only one module]
```

## Exploration Checklist

Use when analyzing a page. Check off as you document.

### Routes
- [ ] Main `+page.svelte`
- [ ] `+page.ts` (prerender, load)
- [ ] Dynamic routes `[id]`, `[slug]`, etc.

### Components
- [ ] All components imported by the page
- [ ] Components imported by those components (one level)
- [ ] Shared UI (cards, modals, buttons)

### Data
- [ ] `seqtaFetch` / API calls
- [ ] `invoke` / Tauri commands
- [ ] Cache keys and TTL
- [ ] IndexedDB usage

### State & Params
- [ ] URL query params
- [ ] Route params
- [ ] Settings read (e.g. `get_settings_subset`)

### Integrations
- [ ] `goto()` calls to this page (from timetable, search, etc.)
- [ ] Links from this page to others
- [ ] Notification types that navigate here

### Backend
- [ ] Rust commands used
- [ ] API endpoints called