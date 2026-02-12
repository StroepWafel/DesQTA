---
name: i18n-component-review
description: Review Svelte components and pages for i18n compliance. Ensures user-facing strings use translation keys via $_() or T component, keys exist in en.json, and keys are translated in all 15 locale files. Use when reviewing components for i18n, adding new UI strings, or when the user asks to check or fix i18n.
---

# i18n Component Review

## Purpose

Ensure every user-facing string in a component or page uses svelte-i18n and that all translation keys exist in every locale file.

## Quick Checklist

When reviewing a component or page:

- [ ] No hardcoded user-facing strings (labels, buttons, messages, placeholders, titles)
- [ ] All strings use `$_()` or `<T />` with valid keys
- [ ] Keys exist in `src/lib/i18n/locales/en.json` (source of truth)
- [ ] Keys are translated in all 15 locale files

## Locale Files (All Must Have the Key)

```
src/lib/i18n/locales/
  en.json, es.json, fr.json, de.json, zh.json, ja.json,
  en-pirate.json, pt.json, ru.json, it.json, ko.json,
  ar.json, nl.json, pl.json, tr.json
```

## Translation Patterns

**Inline (script or expression):**
```svelte
{$_('section.key', { default: 'Fallback text', values: { count: 5 } })}
```

**Component:**
```svelte
<T key="section.key" fallback="Fallback text" values={{ count: 5 }} />
```

**Interpolation:** Use `{{count}}` in the JSON value; pass `values: { count: n }` to `$_()` or T.

## Review Workflow

1. **Identify hardcoded strings**
   - Scan for raw text in template: `{content}`, `>Label</`, `placeholder="..."`, `"Text"`
   - Skip: technical strings, URLs, CSS classes, ARIA labels that are dynamic

2. **Add keys to en.json**
   - Use nested structure: `"section": { "key": "English text" }`
   - Group by feature (e.g. `connectivity`, `notices`, `messages`)

3. **Add to all locales**
   - Add the same key path to every locale file
   - Translate the value; use English as fallback for unknown locales if needed

4. **Replace in component**
   - Use `$_('section.key', { default: 'Fallback' })` or `<T key="section.key" fallback="Fallback" />`

## Verification Commands

**Find keys missing from a locale:**
```bash
# Compare keys in en.json vs another locale (e.g. de.json)
# Requires jq or similar - manually check key paths exist in all 15 files
```

**Find hardcoded strings:**
```bash
rg -n '>\s*[A-Z][a-z]+' --glob '*.svelte' | head -50
```

## Common Mistakes

- Adding key to `en.json` only
- Adding key to some locales but not all 15
- Forgetting `values` for interpolation (e.g. `{{count}}`)
- Using `placeholder="Search"` instead of `placeholder={$_('search.placeholder')}`

## Key Naming Convention

- Use existing section names when adding to an existing feature
- New features: use `featurename.subkey` (e.g. `connectivity.offline`)
- Reuse: `common.retry`, `common.loading`, `common.cancel` for shared strings

## Additional Resources

- For full locale list and JSON structure, see [reference.md](reference.md)
