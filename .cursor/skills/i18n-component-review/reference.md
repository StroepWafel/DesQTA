# i18n Reference

## All Locale Files (15)

| Code | File | Language |
|------|------|----------|
| en | en.json | English |
| es | es.json | Spanish |
| fr | fr.json | French |
| de | de.json | German |
| zh | zh.json | Chinese |
| ja | ja.json | Japanese |
| en-pirate | en-pirate.json | English (Pirate) |
| pt | pt.json | Portuguese |
| ru | ru.json | Russian |
| it | it.json | Italian |
| ko | ko.json | Korean |
| ar | ar.json | Arabic |
| nl | nl.json | Dutch |
| pl | pl.json | Polish |
| tr | tr.json | Turkish |

## JSON Structure

Keys use dot notation. Example en.json:

```json
{
  "common": {
    "retry": "Retry",
    "loading": "Loading..."
  },
  "connectivity": {
    "offline": "You're offline",
    "queued": "{{count}} item(s) queued for sync"
  }
}
```

Access: `$_('connectivity.offline')` or `$_('connectivity.queued', { values: { count: 3 } })`

## When to Skip i18n

- `aria-label` for dynamic/icon-only buttons (use `aria-label={$_('key')}` if static)
- Console.log, logger messages
- URLs and paths
- CSS class names
- Technical identifiers
