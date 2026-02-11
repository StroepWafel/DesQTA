# DesQTA Strategic Roadmap

> **Last Updated:** February 2026  
> **Document Type:** Technical Audit & Product Roadmap  
> **App Nature:** Education-focused, privacy-sensitive SEQTA student portal client (Tauri + SvelteKit)

---

## Executive Summary: State of the App

DesQTA is a **feature-rich desktop and mobile client** for SEQTA (school management system), built with Svelte 5, Tauri 2, and TypeScript. The app delivers a personalized student experience with a customizable dashboard, assessments, courses, messaging, timetables, notes, and cloud settings sync. The architecture is solid and well-documented, with a clear separation between frontend services, Rust backend, and multi-layer caching.

**Strengths:**
- Broad feature coverage across core SEQTA workflows
- Robust authentication (SSO, direct login, profiles, encrypted session storage)
- Strong caching strategy (memory, IndexedDB, SQLite) for offline resilience
- Rich theming system with 25+ built-in themes and a theme store
- Widget-based customizable dashboard
- Internationalization (11+ locales)

**Key Gaps:**
- Several backend commands use placeholder implementations (window management, zoom, notifications)
- Plugin store is UI-only; installation/uninstallation is non-functional
- Some error paths silently fail or swallow errors
- Window management commands (minimize, maximize, fullscreen, etc.) only `println!` and return `Ok(())` without performing actions

---

## Phase 1: Analysis

### 1.1 Feature Inventory (Fully Functional)

| Category | Features |
|----------|----------|
| **Authentication** | Login (SSO, direct, QR), logout, session persistence, profiles, encrypted session storage |
| **Dashboard** | Customizable widget grid, migrate/edit layouts, 15+ widget types (assessments, schedule, notices, news, messages, todo, focus timer, shortcuts, homework, weather, grade trends, etc.) |
| **Assessments** | List/board/calendar/gantt views, filters, weighted grades, analytics, grade predictions (Gemini/Cerebras) |
| **Courses** | Subject list, course content, modules, lesson content, SEQTA mentions integration |
| **Timetable** | Weekly schedule, subject colors, PDF export |
| **Messaging** | DireQt messages, folders, compose, attachments, star/delete/restore |
| **Study** | Notes (TipTap editor), file tree, folders, todo list, SEQTA mentions in notes |
| **Content** | News (RSS), notices, portals, folios (browse/edit), forums, directory |
| **Reports** | Load reports, open in browser |
| **Settings** | Theme, accent, language, shortcuts, sync, cloud settings, dev options |
| **Theme Store** | Browse themes, install, rate, favorites |
| **Analytics** | Assessment analytics, sync, charts |
| **Goals** | Year-based goals view |
| **Infrastructure** | Logging, notifications, autostart, single instance, deep links, system tray |

### 1.2 Implementation Status: Half-Baked or Placeholder

| Location | Issue | Severity |
|----------|-------|----------|
| `src-tauri/src/global_search.rs` | `toggle_fullscreen`, `minimize_window`, `maximize_window`, `unmaximize_window`, `close_window`, `show_window`, `hide_window` — placeholder implementations that only `println!` and return `Ok(())` | **Medium** |
| `src-tauri/src/global_search.rs` | `zoom_in`, `zoom_out`, `zoom_reset` — no-op; comment says "implement on frontend" | **Low** |
| `src-tauri/src/global_search.rs` | `show_notification` — only `println!`, does not emit actual notification | **Medium** |
| `src/routes/settings/plugins/+page.svelte` | Plugin "install/uninstall" only updates local state; no backend integration; banner says "Coming Soon" | **Medium** |
| `src/lib/components/widgets/WeatherWidget.svelte` | "Forecast coming soon" — no multi-day forecast | **Low** |
| `src/routes/reports/+page.svelte` | `openReportInBrowser` catch block is empty (`// Optionally handle error`) | **Low** |
| `src/lib/components/AssessmentListView.svelte` | Individual assessment parse errors silently swallowed | **Low** |
| `src-tauri/src/services/theme_store.rs` | `TODO: Could read from settings if we want to persist dev URL` | **Low** |

### 1.3 Constraint Check: App Nature

DesQTA is a **privacy-sensitive education app** that:
- Handles student PII (grades, attendance, messages, notices)
- Integrates with SEQTA (school-managed system)
- Stores session/auth data locally
- Should support offline usage and fast loads

**Evaluation:**

| Constraint | Status | Notes |
|------------|--------|-------|
| **Privacy / PII** | ✅ Good | Encrypted session storage, `dev_sensitive_info_hider` for demos, sanitization utilities |
| **Offline Resilience** | ✅ Good | Multi-layer caching (memory, IndexedDB, SQLite), queue for offline actions |
| **Performance** | ⚠️ Partial | Startup service and warmup exist; some heavy routes (analytics, folios) could benefit from lazy loading |
| **Session Integrity** | ✅ Good | Session and profiles correctly drive per-user data flows |
| **Error Visibility** | ⚠️ Partial | Many catch blocks log but do not surface user-facing feedback (e.g., reports, plugins) |
| **Security** | ✅ Good | Session encryption, no secrets in frontend, Tauri capabilities scoped |

---

## Phase 2: The Roadmap

### 2.1 Immediate Fixes (Overhaul Half-Implemented Features)

| Priority | Item | Action | Status |
|----------|------|--------|--------|
| **P1** | Implement window management commands | Use Tauri v2 `Window` API: `minimize()`, `maximize()`, `unmaximize()`, `set_fullscreen()`, etc. Replace `println!` with actual calls | Done |
| **P1** | Implement `show_notification` | Use `tauri_plugin_notification` to emit native notifications instead of `println!` | Done |
| **P2** | Reports `openReportInBrowser` error handling | Add toast or inline error message on failure; optionally retry | Done |
| **P2** | Plugin store backend | Either: (a) add Tauri commands for plugin install/uninstall/verify, or (b) clearly mark as "Coming Soon" and remove install/uninstall UI until ready | Done (b) |
| **P3** | Zoom commands | Implement frontend zoom via CSS transform or `document.body.style.zoom` and wire SearchActions to it; or document that zoom is intentionally frontend-only | Done |

### 2.2 Strategic Overhauls

| Area | Change | Rationale |
|------|--------|-----------|
| **Layout Complexity** | Refactor `+layout.svelte` | **Done.** Extracted into `layoutAuthService`, `layoutCloudService`, `useLayoutListeners`, `useLayoutSettings`. Layout now wires services and keeps UI-focused. |
| **Type-Safe Tauri API** | Create `$lib/api/tauri.ts` wrapper | Centralize `invoke` calls with typed wrappers per domain (auth, settings, database, etc.) to reduce duplication and improve error handling |
| **Mock vs. Real API** | Clarify `dev_sensitive_info_hider` semantics | Currently conflates "PII masking for demos" with "mock API for dev." Consider splitting: `dev_mock_api` (full mock) vs. `dev_sensitive_info_hider` (real API + masked output) |
| **Offline UX** | Add explicit offline indicator | Show banner or subtle UI when offline; surface "queued for sync" state for messages/settings |
| **Error Reporting** | Standardize error handling | Use `toastStore` or `errorService` consistently in catch blocks; avoid silent failures and raw `alert()` |

### 2.3 Feature Backlog (5–10 High-Value Items)

| # | Feature | Alignment |
|---|---------|-----------|
| 1 | **Push notifications for assessments** | DB notification schedule exists; wire to `show_notification` and system notifications |
| 2 | **RSS feed management** | RSS feeds route exists; add add/edit/remove feeds and persistence |
| 3 | **Homework due-date reminders** | Uses existing notification infrastructure; high student value |
| 4 | **Export timetable to calendar (.ics)** | Complements PDF export; common student workflow |
| 5 | **Full plugin system** | Completes plugin store; enables extensions without app updates |
| 6 | **Multi-day weather forecast** | Completes WeatherWidget; already fetches single-day data |
| 7 | **Offline message queue status** | Show "X messages queued" with retry; improves offline trust |
| 8 | **Grade goal tracking** | Goals page exists; link to analytics and target grades |
| 9 | **Quick add assessment from dashboard** | Add assessment from widget without full assessments page |
| 10 | **Accessibility audit** | Align with AGENTS.md focus rings and ARIA; important for education |

### 2.4 Technical Debt Log (Prioritized)

| Priority | Item | Effort |
|----------|------|--------|
| **High** | Implement window management + notification commands | ✅ Done |
| **Medium** | Refactor `+layout.svelte` | ✅ Done |
| **Medium** | Replace `console.log`/`console.error` with `logger` in components | Small |
| **Medium** | Add type-safe Tauri API wrapper | Medium |
| **Low** | Migrate remaining `$:` reactive statements to Svelte 5 runes where applicable | Small |
| **Low** | Theme store dev URL TODO | Trivial |

---

## Phase 3: Verification

### Feasibility

- All suggestions use the existing stack (Svelte 5, Tauri 2, TypeScript, Rust). No new frameworks proposed.
- Window APIs: Tauri v2 `Window` exposes `minimize()`, `maximize()`, `unmaximize()`, `set_fullscreen()`, etc.
- Plugin system: Tauri supports dynamic loading; plugin architecture can be phased in.

### Consistency

- No feature contradicts the app’s nature: all proposals support education workflows, privacy, and offline use.
- Constraint checks align with the roadmap: P1 fixes address UX gaps.

### Tone

- Document is professional, concise, and actionable.
- Items are scoped and prioritized.
- No overlap or contradiction between sections.

---

## Appendix: Quick Reference

| Command | Purpose |
|---------|---------|
| `pnpm tauri dev` | Development |
| `pnpm tauri build` | Production build |
| `pnpm check` | Svelte/TS checks |
| `pnpm format` | Format code |

**Key Paths:**
- Layout: `src/routes/+layout.svelte`
- Layout services: `layoutAuthService.ts`, `layoutCloudService.ts`
- Layout composables: `useLayoutListeners.ts`, `useLayoutSettings.ts`
- Services: `src/lib/services/`
- Backend: `src-tauri/src/`
- Widgets: `src/lib/components/dashboard/`, `src/lib/components/widgets/`
