package dev.logno.period

import android.Manifest
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

class MainActivity : ComponentActivity() {
    private val model: TrackerViewModel by viewModels()
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (savedInstanceState == null) intent.data?.let(model::completeLogin)
        setContent {
            val colors = if (isSystemInDarkTheme()) darkColorScheme(primary = Color(0xFFFFA6C5))
                else lightColorScheme(primary = Color(0xFFAD285C), secondary = Color(0xFF7953A0))
            MaterialTheme(colorScheme = colors) { TrackerApp(model) }
        }
    }
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.data?.let(model::completeLogin)
    }
}

private fun Phase.color() = when (this) {
    Phase.MENSTRUAL -> Color(0xFFD53F8C)
    Phase.FOLLICULAR -> Color(0xFFFBB6CE)
    Phase.OVULATION -> Color(0xFF3182CE)
    Phase.LUTEAL -> Color(0xFF805AD5)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrackerApp(model: TrackerViewModel) {
    val data by model.snapshot.collectAsStateWithLifecycle()
    val status by model.status.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var editing by remember { mutableStateOf<Period?>(null) }
    var newPeriod by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<Period?>(null) }
    var today by remember { mutableStateOf(LocalDate.now()) }
    var resumed by remember { mutableIntStateOf(0) }
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                today = LocalDate.now()
                resumed++
                model.refresh()
                Reminders.schedule(context)
            }
        }
        lifecycle.lifecycle.addObserver(observer)
        onDispose { lifecycle.lifecycle.removeObserver(observer) }
    }
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(status.message) {
        status.message?.let { snackbar.showSnackbar(it); model.message(null) }
    }
    Scaffold(
        topBar = { TopAppBar(title = { Text("Period Tracker") }, actions = {
            if (status.connected) TextButton(onClick = model::refresh, enabled = !status.busy) { Text("Sync") }
        }) },
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = { if (status.connected) NavigationBar {
            listOf("Calendar", "History", "Settings").forEachIndexed { index, label ->
                NavigationBarItem(selected = tab == index, onClick = { tab = index }, icon = { Text(listOf("▦", "≡", "⚙")[index]) }, label = { Text(label) })
            }
        } }
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            if (status.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            if (!status.connected) {
                ConnectionScreen(model, status.busy)
            } else when (tab) {
                0 -> CalendarScreen(data, today, status.busy, onAdd = { date ->
                    newPeriod = true; editing = Period("new", date, null)
                }, onEdit = { newPeriod = false; editing = it }, onMood = { date, mood ->
                    model.run("Mood added.") { model.repo.addMood(date, mood) }
                }, onDeleteMood = { mood -> model.run("Mood removed.") { model.repo.deleteMood(mood.id) } })
                1 -> HistoryScreen(data, status.busy, onEdit = { newPeriod = false; editing = it }, onDelete = { deleting = it })
                else -> key(resumed, status.revision) { SettingsScreen(model) }
            }
        }
    }
    editing?.let { period -> PeriodEditor(period, newPeriod, status.busy,
        onDismiss = { editing = null }, onSave = { model.save(it, newPeriod) { editing = null } }) }
    deleting?.let { period -> AlertDialog(onDismissRequest = { deleting = null }, title = { Text("Delete period?") },
        text = { Text("The period starting ${period.start} will be removed from your account on all devices.") },
        confirmButton = { TextButton(onClick = { model.delete(period); deleting = null }) { Text("Delete") } },
        dismissButton = { TextButton(onClick = { deleting = null }) { Text("Cancel") } }) }
}

@Composable
private fun ConnectionScreen(model: TrackerViewModel, busy: Boolean) {
    val context = LocalContext.current
    var server by rememberSaveable { mutableStateOf(model.repo.server) }
    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Text("Your cycle, together", style = MaterialTheme.typography.headlineLarge)
        Text("Connect your existing web account to share your tracking history across devices and receive native reminders.")
        OutlinedTextField(server, { server = it }, label = { Text("Web app URL") }, placeholder = { Text("https://tracker.example.com") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Button(enabled = !busy, onClick = {
            runCatching { CustomTabsIntent.Builder().build().launchUrl(context, model.repo.beginLogin(server)) }
                .onFailure { model.message(it.message ?: "Unable to open browser.") }
        }) { Text("Connect in browser") }
        Text("Sign in, approve the connection, then tap Return to Period Tracker. Your password stays in the browser.", style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun CalendarScreen(data: Snapshot, today: LocalDate, busy: Boolean, onAdd: (LocalDate) -> Unit, onEdit: (Period) -> Unit,
                           onMood: (LocalDate, String) -> Unit, onDeleteMood: (Mood) -> Unit) {
    var monthText by rememberSaveable { mutableStateOf(YearMonth.now().toString()) }
    var selectedText by rememberSaveable { mutableStateOf(today.toString()) }
    var moodDialog by remember { mutableStateOf(false) }
    val month = YearMonth.parse(monthText)
    val selected = LocalDate.parse(selectedText)
    val prediction = Cycle.prediction(data.periods)
    val active = data.periods.firstOrNull { it.end == null }
    val selectedPeriod = data.periods.firstOrNull { selected >= it.start && selected <= (it.end ?: today) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(Cycle.phase(today, data.periods)?.label ?: "Welcome to your tracker", style = MaterialTheme.typography.headlineSmall)
                Text(if (prediction != null) "Next period: ${prediction.date} · ${prediction.confidence.lowercase()} confidence" else "Log at least two completed periods for a prediction.")
                if (prediction != null && prediction.date < today) Text("The predicted date has passed. Update your history when your next period starts.")
                if (active != null) Text("Active period since ${active.start}", fontWeight = FontWeight.Bold)
                Cycle.reminders(data.periods, today, 1).forEach { Text("${it.title}: ${it.text}", style = MaterialTheme.typography.bodyMedium) }
            } }
        }
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                TextButton(onClick = { monthText = month.minusMonths(1).toString() }, modifier = Modifier.semantics { contentDescription = "Previous month" }) { Text("‹") }
                Text("${month.month.getDisplayName(TextStyle.FULL, Locale.getDefault())} ${month.year}", style = MaterialTheme.typography.titleLarge)
                TextButton(onClick = { monthText = month.plusMonths(1).toString() }, modifier = Modifier.semantics { contentDescription = "Next month" }) { Text("›") }
            }
            Row { listOf("M", "T", "W", "T", "F", "S", "S").forEach { Text(it, Modifier.weight(1f).wrapContentWidth(Alignment.CenterHorizontally)) } }
            val start = month.atDay(1).minusDays(month.atDay(1).dayOfWeek.value - 1L)
            repeat(6) { row ->
                Row(Modifier.fillMaxWidth()) {
                    repeat(7) { col ->
                        val date = start.plusDays((row * 7 + col).toLong())
                        val phase = Cycle.phase(date, data.periods)
                        val actual = data.periods.any { date >= it.start && date <= (it.end ?: today) }
                        val predicted = prediction?.let { date >= it.date && date < it.date.plusDays(Cycle.periodLength(data.periods).toLong()) } == true
                        val baseColor = if (actual) Phase.MENSTRUAL.color() else if (predicted) Color(0xFFFBB6CE) else phase?.color()
                        val background = baseColor?.copy(alpha = if (actual) 1f else 0.25f) ?: Color.Transparent
                        val label = "$date${if (actual) ", logged period" else if (predicted) ", predicted period" else phase?.let { ", estimated ${it.label}" } ?: ""}"
                        Box(Modifier.weight(1f).aspectRatio(1f).padding(2.dp).clip(CircleShape).background(background)
                            .border(if (date == selected) 2.dp else 0.dp, if (date == selected) MaterialTheme.colorScheme.primary else Color.Transparent, CircleShape)
                            .clickable { selectedText = date.toString() }.semantics { contentDescription = label }, contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(date.dayOfMonth.toString(), color = if (actual) Color.White else MaterialTheme.colorScheme.onSurface.copy(alpha = if (YearMonth.from(date) == month) 1f else 0.4f),
                                    fontWeight = if (date == today) FontWeight.Black else FontWeight.Normal)
                                if (data.moods.any { it.date == date }) Text("•", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
            }
            TextButton(onClick = { monthText = YearMonth.from(today).toString(); selectedText = today.toString() }) { Text("Today") }
            Text("Pink: period · Pale pink: follicular / predicted period\nBlue: ovulation window · Purple: luteal · Dot: mood", style = MaterialTheme.typography.bodySmall)
        }
        item {
            Text(selected.toString(), style = MaterialTheme.typography.titleLarge)
            Text(selectedPeriod?.let { "Logged period: ${it.start} – ${it.end ?: "active"}" }
                ?: "Estimated phase: ${Cycle.phase(selected, data.periods)?.label ?: "Not enough data"}")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(enabled = !busy && selected <= today, onClick = { if (selectedPeriod != null) onEdit(selectedPeriod) else onAdd(selected) }) { Text(if (selectedPeriod != null) "Edit period" else "Log period") }
                OutlinedButton(enabled = !busy && selected <= today, onClick = { moodDialog = true }) { Text("Add mood") }
            }
            if (active != null && selectedPeriod?.id != active.id) TextButton(onClick = { onEdit(active) }, enabled = !busy) { Text("Edit / end active period") }
        }
        items(data.moods.filter { it.date == selected }, key = { it.id }) { mood ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(mood.mood, Modifier.weight(1f))
                TextButton(onClick = { onDeleteMood(mood) }, enabled = !busy) { Text("Remove") }
            }
        }
        item { Text("Phase and period predictions are estimates, not confirmation of ovulation or a contraceptive method.", style = MaterialTheme.typography.bodySmall) }
    }
    if (moodDialog) {
        var mood by rememberSaveable { mutableStateOf("") }
        AlertDialog(onDismissRequest = { moodDialog = false }, title = { Text("Mood for $selected") }, text = {
            Column { Text("How are you feeling?"); OutlinedTextField(mood, { mood = it.take(80) }, placeholder = { Text("Happy, tired, anxious…") }) }
        }, confirmButton = { TextButton(enabled = mood.isNotBlank(), onClick = { onMood(selected, mood.trim()); moodDialog = false }) { Text("Save") } },
            dismissButton = { TextButton(onClick = { moodDialog = false }) { Text("Cancel") } })
    }
}

@Composable
private fun HistoryScreen(data: Snapshot, busy: Boolean, onEdit: (Period) -> Unit, onDelete: (Period) -> Unit) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text("Your history", style = MaterialTheme.typography.headlineMedium)
            Text("${data.periods.size} periods logged")
            Text("Average period: ${Cycle.periodLength(data.periods)} days${if (data.periods.none { it.end != null }) " (default)" else ""}")
            Text("Average cycle: ${String.format(Locale.getDefault(), "%.1f", Cycle.cycleLength(data.periods))} days${if (Cycle.gaps(data.periods).isEmpty()) " (default)" else ""}")
            if (data.periods.isEmpty()) Text("Select a date on the calendar to log your first period.")
        }
        items(data.periods.sortedByDescending { it.start }, key = { it.id }) { period ->
            Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) {
                Text("${period.start} – ${period.end ?: "Active"}", style = MaterialTheme.typography.titleMedium)
                Cycle.length(period)?.let { Text("$it days") }
                Row {
                    TextButton(onClick = { onEdit(period) }, enabled = !busy) { Text("Edit") }
                    TextButton(onClick = { onDelete(period) }, enabled = !busy) { Text("Delete") }
                }
            } }
        }
    }
}

@Composable
private fun PeriodEditor(period: Period, new: Boolean, busy: Boolean, onDismiss: () -> Unit, onSave: (Period) -> Unit) {
    var startText by rememberSaveable(period.id) { mutableStateOf(period.start.toString()) }
    var endText by rememberSaveable(period.id) { mutableStateOf(period.end?.toString()) }
    val context = LocalContext.current
    fun pick(value: LocalDate, selected: (LocalDate) -> Unit) {
        DatePickerDialog(context, { _, y, m, d -> selected(LocalDate.of(y, m + 1, d)) }, value.year, value.monthValue - 1, value.dayOfMonth)
            .apply { datePicker.maxDate = System.currentTimeMillis() }.show()
    }
    AlertDialog(onDismissRequest = { if (!busy) onDismiss() }, title = { Text(if (new) "Log period" else "Edit period") }, text = {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton(onClick = { pick(LocalDate.parse(startText)) { startText = it.toString() } }) { Text("Start: $startText") }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Still ongoing", Modifier.weight(1f))
                Switch(checked = endText == null, onCheckedChange = { endText = if (it) null else LocalDate.now().toString() })
            }
            endText?.let { end -> OutlinedButton(onClick = { pick(LocalDate.parse(end)) { endText = it.toString() } }) { Text("End: $end") } }
        }
    }, confirmButton = { TextButton(enabled = !busy, onClick = { onSave(period.copy(start = LocalDate.parse(startText), end = endText?.let(LocalDate::parse))) }) { Text("Save") } },
        dismissButton = { TextButton(enabled = !busy, onClick = onDismiss) { Text("Cancel") } })
}

@Composable
private fun SettingsScreen(model: TrackerViewModel) {
    val context = LocalContext.current
    val repo = model.repo
    val data by model.snapshot.collectAsStateWithLifecycle()
    var enabled by remember { mutableStateOf(repo.enabled) }
    var private by remember { mutableStateOf(repo.privateNotifications) }
    var hour by remember { mutableIntStateOf(repo.hour) }
    var minute by remember { mutableIntStateOf(repo.minute) }
    var permission by remember { mutableStateOf(Reminders.allowed(context)) }
    var disconnect by remember { mutableStateOf(false) }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        permission = Reminders.allowed(context)
        enabled = permission
        repo.settings(enabled = permission)
        if (!permission) model.message("Notifications are blocked. Allow them in Android notification settings.")
    }
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Text("Account", style = MaterialTheme.typography.headlineSmall)
            Text(repo.email)
            Text(repo.server, style = MaterialTheme.typography.bodySmall)
            val synced = data.syncedAt
            Text(if (synced == 0L) "Not synced yet" else "Last synced: ${Instant.ofEpochMilli(synced).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("MMM d, HH:mm"))}")
            Text("History is cached for offline viewing. Edits require a connection. Background sync runs approximately every 6 hours.", style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = {
                runCatching { CustomTabsIntent.Builder().build().launchUrl(context, repo.beginLogin(repo.server)) }.onFailure { model.message(it.message) }
            }) { Text("Reconnect account") }
        }
        item {
            HorizontalDivider()
            Text("Native reminders", style = MaterialTheme.typography.headlineSmall)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Cycle notifications", Modifier.weight(1f))
                Switch(checked = enabled, onCheckedChange = { checked ->
                    if (checked && Build.VERSION.SDK_INT >= 33 && !permission) permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    else { enabled = checked; repo.settings(enabled = checked) }
                })
            }
            Text("Period predictions, ovulation windows, and phase changes. Delivered locally even without internet.")
            Text(if (permission) "Android notifications: allowed" else "Android notifications: blocked", style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = { context.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)) }) { Text("Android notification settings") }
            OutlinedButton(onClick = { TimePickerDialog(context, { _, h, m -> hour = h; minute = m; repo.settings(hour = h, minute = m) }, hour, minute, true).show() }) {
                Text("Reminder time: %02d:%02d".format(hour, minute))
            }
            Text("Timezone: ${ZoneId.systemDefault().id} (follows this device)", style = MaterialTheme.typography.bodySmall)
        }
        item {
            Text(if (Reminders.exact(context)) "Precise reminder timing is enabled." else "Reminders may be delayed by Android. Enable precise timing for delivery at your chosen time.")
            if (Build.VERSION.SDK_INT >= 31 && !Reminders.exact(context)) TextButton(onClick = {
                context.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}")))
            }) { Text("Enable precise timing") }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Hide notification details", Modifier.weight(1f))
                Switch(checked = private, onCheckedChange = { private = it; repo.settings(private = it) })
            }
            OutlinedButton(onClick = { if (!Reminders.post(context)) model.message("Allow notifications in Android settings first.") }) { Text("Send test notification") }
            Text("After force-stopping the app in Android settings, open it again to resume reminders.", style = MaterialTheme.typography.bodySmall)
        }
        item {
            HorizontalDivider()
            Text("Period Tracker ${BuildConfig.VERSION_NAME}")
            TextButton(onClick = { disconnect = true }) { Text("Disconnect and clear this device") }
        }
    }
    if (disconnect) AlertDialog(onDismissRequest = { disconnect = false }, title = { Text("Disconnect this device?") },
        text = { Text("Cached history, account credentials, and local reminders will be removed. Your cloud history remains in your account.") },
        confirmButton = { TextButton(onClick = { disconnect = false; model.logout() }) { Text("Disconnect") } },
        dismissButton = { TextButton(onClick = { disconnect = false }) { Text("Cancel") } })
}
