---
name: android-widgets
description: Create and modify Android home screen app widgets for Tauri apps. Use when adding widgets, creating widget layouts, AppWidgetProvider classes, or sharing data between the app and widgets. Covers gen/android structure, RemoteViews, and Tauri data bridge.
---

# Android Widgets for Tauri Apps

## Overview

Android app widgets live in `src-tauri/gen/android/app/src/main/`. Each widget needs: provider info XML, layout XML, a Kotlin provider class, and a manifest receiver.

## Required Components

| Component | Location | Purpose |
|-----------|----------|---------|
| AppWidgetProviderInfo | `res/xml/<name>_info.xml` | Size, layout, description |
| Layout | `res/layout/<name>.xml` | RemoteViews-compatible UI |
| Provider class | `java/com/.../app/<Name>WidgetProvider.kt` | Handles updates, reads data |
| Manifest | `AndroidManifest.xml` | Receiver with intent-filter and meta-data |

## Multiple Widgets: Use Separate Provider Classes

**Critical**: The manifest merger treats duplicate receivers (same `android:name`) as errors. Each widget type needs its own Kotlin class.

```
✅ DesqtaQuickLaunchWidgetProvider
✅ DesqtaTodayWidgetProvider
❌ DesqtaAppWidgetProvider (reused for all)
```

## RemoteViews Layout Constraints

Only these views work in widget layouts:
- `FrameLayout`, `LinearLayout`, `RelativeLayout`, `GridLayout`
- `TextView`, `ImageView`, `Button`, `ProgressBar`, `Chronometer`, `ViewStub`
- No `ConstraintLayout`, no custom views

Use `?android:attr/textColorPrimary`, `?android:attr/textColorSecondary`, `?android:attr/colorBackground` for system theming.

## Data Bridge: App → Widget

Widgets run in a separate process. Share data via:

1. **File in app files dir** (recommended for Tauri):
   - Rust writes: `context.filesDir` = `/data/data/<package>/files/`
   - Path for Rust on Android: `get_version_app_data_dir().parent().join("widget_data.json")`
   - Widget reads: `File(context.filesDir, "widget_data.json")`

2. **Tauri command** to write:
   ```rust
   #[tauri::command]
   fn set_widget_data(name: Option<String>, time: Option<String>) -> Result<(), String> {
       let path = widget_data_path();
       let data = serde_json::json!({ "name": name, "time": time });
       fs::write(&path, data.to_string()).map_err(|e| e.to_string())
   }
   ```

3. **Frontend** calls `invoke('set_widget_data', { ... })` when data is available.

## Layout Best Practices

- Use `wrap_content` for height to avoid empty space
- Keep padding tight (8–10dp)
- Use `@android:id/background` on root for smoother launch transitions
- Add `android:id="@+id/widget_container"` on clickable root for `setOnClickPendingIntent`

## Manifest Receiver Template

```xml
<receiver
    android:name=".MyWidgetProvider"
    android:exported="true"
    android:label="@string/my_widget_label">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/my_widget_info" />
</receiver>
```

## AppWidgetProviderInfo Sizing

```xml
<appwidget-provider
    android:minWidth="180dp"
    android:minHeight="56dp"
    android:targetCellWidth="4"
    android:targetCellHeight="1"
    android:updatePeriodMillis="1800000"
    android:description="@string/widget_description"
    android:initialLayout="@layout/my_widget"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:previewLayout="@layout/my_widget" />
```

## Provider Update Pattern

```kotlin
private fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
    val views = RemoteViews(context.packageName, R.layout.my_widget)
    val (name, time) = readData(context)
    views.setTextViewText(R.id.text_name, name)
    views.setTextViewText(R.id.text_time, time)

    val intent = Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    views.setOnClickPendingIntent(R.id.widget_container,
        PendingIntent.getActivity(context, appWidgetId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))

    appWidgetManager.updateAppWidget(appWidgetId, views)
}
```

## Additional Resources

- For Tauri paths, update triggers, and frontend patterns, see [reference.md](reference.md)
- [Create a simple widget](https://developer.android.com/develop/ui/views/appwidgets)
- [Enhance your widget](https://developer.android.com/develop/ui/views/appwidgets/enhance)
- [Advanced widgets](https://developer.android.com/develop/ui/views/appwidgets/advanced)
