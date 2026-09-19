package dev.logno.period

import android.Manifest
import android.app.AlarmManager
import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.*
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.concurrent.TimeUnit

class TrackerApplication : Application() {
    val repository by lazy { Repository(this) }
    override fun onCreate() {
        super.onCreate()
        Reminders.channels(this)
        val work = PeriodicWorkRequestBuilder<SyncWorker>(6, TimeUnit.HOURS)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork("account-sync", ExistingPeriodicWorkPolicy.KEEP, work)
    }
}
fun Context.repository() = (applicationContext as TrackerApplication).repository

object Reminders {
    const val CHANNEL = "cycle-reminders"
    private fun alarm(context: Context) = context.getSystemService(AlarmManager::class.java)
    private fun pending(context: Context) = PendingIntent.getBroadcast(context, 1, Intent(context, ReminderReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    fun channels(context: Context) {
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CHANNEL, "Cycle reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Predicted periods, ovulation windows, and cycle phase changes"
                lockscreenVisibility = NotificationCompat.VISIBILITY_PRIVATE
            })
    }
    fun allowed(context: Context): Boolean =
        (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) &&
            NotificationManagerCompat.from(context).areNotificationsEnabled() &&
            context.getSystemService(NotificationManager::class.java).getNotificationChannel(CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE
    fun exact(context: Context) = Build.VERSION.SDK_INT < 31 || alarm(context).canScheduleExactAlarms()
    @Synchronized fun cancel(context: Context) {
        alarm(context).cancel(pending(context))
        NotificationManagerCompat.from(context).cancelAll()
    }
    @Synchronized fun schedule(context: Context) {
        alarm(context).cancel(pending(context))
        val repo = context.repository()
        if (!repo.enabled || !repo.connected || !allowed(context)) return
        val now = ZonedDateTime.now()
        val delivered = repo.prefs.getStringSet("delivered", emptySet())!!
        val event = Cycle.reminders(repo.snapshot.value.periods, now.toLocalDate()).firstOrNull { it.key !in delivered } ?: return
        val at = event.date.atTime(repo.hour, repo.minute).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
            .coerceAtLeast(System.currentTimeMillis() + 5_000)
        if (exact(context)) {
            try { alarm(context).setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(context)); return }
            catch (_: SecurityException) { /* Permission may have been revoked between check and scheduling. */ }
        }
        alarm(context).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(context))
    }
    @Synchronized fun deliver(context: Context) {
        val repo = context.repository()
        if (!repo.enabled || !repo.connected || !allowed(context) || LocalTime.now() < LocalTime.of(repo.hour, repo.minute)) return
        val delivered = repo.prefs.getStringSet("delivered", emptySet())!!.toMutableSet()
        Cycle.reminders(repo.snapshot.value.periods, LocalDate.now(), 1).filter { it.key !in delivered }.forEach { event ->
            if (post(context, event.key.hashCode(), event.title, event.text)) delivered.add(event.key)
        }
        repo.prefs.edit().putStringSet("delivered", delivered.sorted().takeLast(256).toSet()).commit()
    }
    fun post(context: Context, id: Int = 0, title: String = "Test reminder", text: String = "Native Android notifications are working."): Boolean {
        if (!allowed(context)) return false
        val private = context.repository().privateNotifications
        val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_period)
            .setContentTitle(if (private) "Period Tracker" else title)
            .setContentText(if (private) "You have a tracker update. Tap to view." else text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(if (private) "You have a tracker update. Tap to view." else text))
            .setContentIntent(open).setAutoCancel(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setCategory(NotificationCompat.CATEGORY_REMINDER).build()
        return try { NotificationManagerCompat.from(context).notify(id, notification); true } catch (_: SecurityException) { false }
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // Delivery uses cached history, so an unavailable network never blocks reminders.
        Reminders.deliver(context)
        Reminders.schedule(context)
    }
}
class RescheduleReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action in setOf(Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_TIMEZONE_CHANGED,
                Intent.ACTION_TIME_CHANGED, Intent.ACTION_MY_PACKAGE_REPLACED,
                AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED)) Reminders.schedule(context)
    }
}
class SyncWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result {
        val repo = applicationContext.repository()
        if (!repo.connected) return Result.success()
        val result = try { repo.refresh(); Result.success() }
        catch (_: AuthExpired) { Result.success() }
        catch (_: Exception) { Result.retry() }
        Reminders.deliver(applicationContext)
        Reminders.schedule(applicationContext)
        return result
    }
}
