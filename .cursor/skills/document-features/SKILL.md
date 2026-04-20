---
name: document-features
description: Analyze a page or module in its entirety and create a comprehensive FEATURES.md listing every feature in detail. Use when documenting features, creating FEATURES.md, listing page capabilities, or when the user asks to document what a page/module does.
---

# Document Features

Create a detailed FEATURES.md file by systematically analyzing a page or module and documenting every feature.

## Workflow

### 1. Identify Scope

- **Single page**: e.g. `/assessments`, `/courses`, `/timetable`
- **Module**: e.g. "Assessments module" (overview + detail pages)
- **User request**: "document the X page" → analyze that route and all its components

### 2. Explore the Codebase

Follow this exploration order:

1. **Route entry**: `src/routes/{path}/+page.svelte`, `+page.ts`
2. **Child routes**: `[id]`, `[slug]`, etc.
3. **Components**: Grep for imports from the page; read each component
4. **Services**: Grep for service calls (fetch, invoke, cache)
5. **Backend**: Tauri commands, Rust modules
6. **Integrations**: Where does this page link from? (search, timetable, notifications)

**Tools**: `Glob`, `Grep`, `Read`, `SemanticSearch`

### 3. Document Each Feature

For each feature, capture:

- **What it does**: User-visible behavior
- **How it works**: Data source, API, cache, state
- **Conditional logic**: When shown/hidden (settings, flags, permissions)
- **Integrations**: Links to/from other pages, notifications, search

### 4. Write FEATURES.md

Create at project root. Use the structure in [reference.md](reference.md).

**Sections**:

- Module intro (1–2 sentences)
- Main page with numbered subsections (1.1, 1.2, …)
- Child pages / tabs
- Shared components (cards, modals)
- Services (data, calculation, background)
- Integrations (timetable, search, notifications)
- UI/UX details (loading, empty states, i18n)

**Format**:

- Use `###` for major sections, `####` for subsections
- Bullet points for feature lists
- Tables for view modes, status mappings, etc.
- Code references: component names, API paths, Tauri commands

### 5. Verification

Before finishing:

- [ ] Every imported component is documented
- [ ] Every service/API call is mentioned
- [ ] URL params and deep linking covered
- [ ] Empty/loading/error states noted
- [ ] No orphan features (everything traced to UI or flow)

## Output Location

- **Path**: `FEATURES.md` at project root
- **Overwrite**: Replace existing if documenting same scope; append new modules if expanding

## Example Triggers

- "Document the assessments page"
- "Create a FEATURES.md listing every feature"
- "What does the X page do? List everything"
- "Analyze the timetable module and document its features"

## Additional Resources

- Output template and exploration checklist: [reference.md](reference.md)