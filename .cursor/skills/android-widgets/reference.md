# Android Widgets Reference

## Tauri Android Paths

On Android, the app data dir is `/data/data/com.<package>/files/`. For DesQTA: `com.desqta.app`.

Rust `get_version_app_data_dir()` returns `.../files/DesQTA`. Widget data file at parent:
```rust
app_data.parent().unwrap().join("widget_data.json")
// = /data/data/com.desqta.app/files/widget_data.json
```

Widget reads via `context.filesDir` which is the same path.

## When to Update Widget Data

1. **App startup**: Call from `warmUpCommonData()` in warmupService
2. **When relevant data loads**: e.g. TodaySchedule, timetable page
3. **updatePeriodMillis**: Widget re-reads the file on each system-triggered update (min 30 min)

## Conditional Visibility

Use `setViewVisibility` for optional content:
```kotlin
if (room.isNotEmpty()) {
    views.setTextViewText(R.id.lesson_room, "• $room")
    views.setViewVisibility(R.id.lesson_room, View.VISIBLE)
} else {
    views.setViewVisibility(R.id.lesson_room, View.GONE)
}
```

## Invoke from Frontend

```typescript
try {
  await invoke('set_next_lesson_for_widget', {
    name: lesson.description,
    time: timeStr,
    room: lesson.room || null,
  });
} catch {
  // Ignore on desktop or if command unavailable
}
```

## Widget Info Sizing Reference

| targetCellHeight | Typical use |
|------------------|-------------|
| 1 | Compact (56–72dp) |
| 2 | Medium (110dp+) |
| 3+ | Large |

`minResizeWidth`/`minResizeHeight` set the smallest allowed size when user resizes.
