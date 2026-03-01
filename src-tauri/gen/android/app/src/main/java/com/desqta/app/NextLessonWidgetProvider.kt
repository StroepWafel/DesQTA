package com.desqta.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File

/**
 * DesQTA Next Lesson widget.
 * Displays the next lesson from schedule data written by the app.
 *
 * @see <a href="https://developer.android.com/develop/ui/views/appwidgets">Android App Widgets</a>
 */
class NextLessonWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    private fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.desqta_next_lesson)

        val (name, time, room) = readNextLesson(context)
        views.setTextViewText(R.id.lesson_name, name.ifEmpty { "—" })
        views.setTextViewText(R.id.lesson_time, time)
        if (room.isNotEmpty()) {
            views.setTextViewText(R.id.lesson_room, "• $room")
            views.setViewVisibility(R.id.lesson_room, View.VISIBLE)
        } else {
            views.setViewVisibility(R.id.lesson_room, View.GONE)
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            appWidgetId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_container, pendingIntent)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun readNextLesson(context: Context): Triple<String, String, String> {
        return try {
            val file = File(context.filesDir, "next_lesson.json")
            if (!file.exists()) return Triple("", "", "")
            val json = JSONObject(file.readText())
            val name = json.optString("name", "").trim()
            val time = json.optString("time", "").trim()
            val room = json.optString("room", "").trim()
            Triple(name, time, room)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to read next lesson", e)
            Triple("", "", "")
        }
    }

    companion object {
        private const val TAG = "NextLessonWidget"
    }
}
