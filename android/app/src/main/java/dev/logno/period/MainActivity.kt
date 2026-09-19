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
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit.DAYS

class MainActivity : ComponentActivity() {
    private val model: TrackerViewModel by viewModels()
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            TrackerTheme { TrackerApp(model) }
        }
    }
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
        topBar = { Column {
            TopAppBar(title = { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.size(16.dp).background(TrackerColors.Brand, CircleShape))
                Text("Period Tracker", style = MaterialTheme.typography.titleLarge)
            } }, colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface), actions = {
                if (status.connected) TextButton(onClick = model::refresh, enabled = !status.busy) { Text("Sync") }
            })
            HorizontalDivider()
        } },
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = { if (status.connected && !status.signingIn) Column {
            HorizontalDivider()
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface, tonalElevation = 0.dp) {
                listOf("Calendar", "Stats", "Settings").forEachIndexed { index, label ->
                    NavigationBarItem(selected = tab == index, onClick = { tab = index },
                        icon = { Icon(painterResource(listOf(R.drawable.ic_calendar, R.drawable.ic_history, R.drawable.ic_settings)[index]), contentDescription = null) },
                        label = { Text(label) }, colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MaterialTheme.colorScheme.primary, selectedTextColor = MaterialTheme.colorScheme.primary,
                            indicatorColor = MaterialTheme.colorScheme.primaryContainer,
                            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant, unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant))
                }
            }
        } }
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            if (status.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            if (!status.connected || status.signingIn) {
                ConnectionScreen(model, status.busy)
            } else when (tab) {
                0 -> CalendarScreen(data, today, status.busy, onAdd = { date ->
                    newPeriod = true; editing = Period("new", date, null)
                }, onEdit = { newPeriod = false; editing = it }, onMood = { date, mood ->
                    model.run("Mood added.") { model.repo.addMood(date, mood) }
                }, onDeleteMood = { mood -> model.run("Mood removed.") { model.repo.deleteMood(mood.id) } })
                1 -> StatsScreen(data, status.busy, onEdit = { newPeriod = false; editing = it }, onDelete = { deleting = it })
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
    var email by rememberSaveable { mutableStateOf(model.repo.email) }
    // Keep passwords in memory only, never in saved-instance state or preferences.
    var password by remember { mutableStateOf("") }
    var visible by remember { mutableStateOf(false) }
    val canSubmit = !busy && email.isNotBlank() && password.isNotEmpty()
    val submit = { if (canSubmit) model.signIn(email, password) { password = "" } }
    Column(Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Text("Your cycle, together", style = MaterialTheme.typography.headlineLarge)
        Text("Sign in with your existing Period Tracker account to sync your history and receive native reminders.")
        OutlinedTextField(email, { email = it.take(254) }, label = { Text("Email") }, singleLine = true, enabled = !busy,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(password, { password = it.take(1024) }, label = { Text("Password") }, singleLine = true, enabled = !busy,
            visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
            trailingIcon = { TextButton(onClick = { visible = !visible }) { Text(if (visible) "Hide" else "Show") } },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { submit() }), modifier = Modifier.fillMaxWidth())
        Button(enabled = canSubmit, onClick = submit, shape = RoundedCornerShape(8.dp), colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary), modifier = Modifier.fillMaxWidth()) { Text(if (busy) "Signing in…" else "Sign in") }
        Text("Uses your account at p.logno.app. Your password is not saved on this device.", style = MaterialTheme.typography.bodyMedium)
        if (model.repo.connected) TextButton(enabled = !busy, onClick = { model.showSignIn(false) }) { Text("Back to tracker") }
    }
}

@Composable
private fun CalendarScreen(data: Snapshot, today: LocalDate, busy: Boolean, onAdd: (LocalDate) -> Unit, onEdit: (Period) -> Unit,
                           onMood: (LocalDate, String) -> Unit, onDeleteMood: (Mood) -> Unit) {
    var monthText by rememberSaveable { mutableStateOf(YearMonth.from(today).toString()) }
    var selectedText by rememberSaveable { mutableStateOf(today.toString()) }
    var moodDialog by remember { mutableStateOf(false) }
    var phaseDialog by remember { mutableStateOf<Phase?>(null) }
    val month = YearMonth.parse(monthText)
    val selected = LocalDate.parse(selectedText)
    val active = data.periods.firstOrNull { it.end == null }
    val selectedPeriod = data.periods.firstOrNull { selected >= it.start && selected <= (it.end ?: today) }
    val colors = MaterialTheme.colorScheme
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
    LazyColumn(Modifier.widthIn(max = 560.dp).fillMaxWidth(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { PredictionCard(data, today) }
        item {
            TrackerCalendar(month, data, today, selected, onMonthChange = { monthText = it.toString() }, onSelect = { selectedText = it.toString() })
        }
        item { PhaseLegend() }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val ongoing = selectedPeriod != null && selectedPeriod.end == null
                Button(modifier = Modifier.weight(1f).heightIn(min = 50.dp), shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = if (ongoing) TrackerColors.Error else TrackerColors.Success),
                    enabled = !busy && selected <= today, onClick = {
                        when {
                            ongoing -> onEdit(selectedPeriod!!.copy(end = selected))
                            selectedPeriod != null -> onEdit(selectedPeriod)
                            else -> onAdd(selected)
                        }
                    }) { Text(if (ongoing) "Stop period" else if (selectedPeriod != null) "Edit period" else "Start period", fontWeight = FontWeight.Bold) }
                Button(modifier = Modifier.weight(1f).heightIn(min = 50.dp), shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = colors.secondary),
                    enabled = !busy && selected <= today, onClick = { moodDialog = true }) { Text("Add mood marker", fontWeight = FontWeight.SemiBold) }
            }
        }
        item {
            Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp), border = BorderStroke(1.dp, colors.outline)) {
                Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(selected.format(DateTimeFormatter.ofPattern("EEE, MMM d")), Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
                        TextButton(onClick = { monthText = YearMonth.from(today).toString(); selectedText = today.toString() }) { Text("Today") }
                    }
                    Text(selectedPeriod?.let { "Period: ${it.start} – ${it.end ?: "active"}" }
                        ?: "Estimated phase: ${Cycle.phase(selected, data.periods)?.label ?: "Not enough data"}", color = colors.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                    Cycle.phaseInfo(selected, data.periods)?.let { info ->
                        Text("Cycle day ${info.dayInCycle} · ${info.phase.label}", style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant)
                        TextButton(onClick = { phaseDialog = info.phase }) { Text("Phase info") }
                    }
                    if (selectedPeriod != null) TextButton(onClick = { onEdit(selectedPeriod) }, enabled = !busy) { Text("Edit period dates") }
                    else if (active != null) TextButton(onClick = { onEdit(active) }, enabled = !busy) { Text("Edit / end active period") }
                }
            }
        }
        items(data.moods.filter { it.date == selected }, key = { it.id }) { mood ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(mood.mood, Modifier.weight(1f))
                TextButton(onClick = { onDeleteMood(mood) }, enabled = !busy) { Text("Remove") }
            }
        }
        items(Cycle.reminders(data.periods, today, 1), key = { it.key }) { reminder ->
            Text("${reminder.title}: ${reminder.text}", style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant)
        }
        item { Text("Phase and period predictions are estimates, not confirmation of ovulation or a contraceptive method.", style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant) }
    }
    }
    if (moodDialog) {
        var mood by rememberSaveable { mutableStateOf("") }
        AlertDialog(onDismissRequest = { moodDialog = false }, title = { Text("Mood for $selected") }, text = {
            Column { Text("How are you feeling?"); OutlinedTextField(mood, { mood = it.take(80) }, placeholder = { Text("Happy, tired, anxious…") }) }
        }, confirmButton = { TextButton(enabled = mood.isNotBlank(), onClick = { onMood(selected, mood.trim()); moodDialog = false }) { Text("Save") } },
            dismissButton = { TextButton(onClick = { moodDialog = false }) { Text("Cancel") } })
    }
    phaseDialog?.let { PhaseInfoDialog(it, onDismiss = { phaseDialog = null }) }
}

@Composable
private fun PredictionCard(data: Snapshot, today: LocalDate) {
    val colors = MaterialTheme.colorScheme
    val prediction = Cycle.prediction(data.periods)
    val phase = Cycle.phase(today, data.periods)
    var showPhaseInfo by remember { mutableStateOf(false) }
    Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp), border = BorderStroke(1.dp, colors.outline), shadowElevation = 1.dp) {
        Row(Modifier.height(IntrinsicSize.Min)) {
            Box(Modifier.width(4.dp).fillMaxHeight().background(TrackerColors.Accent))
            Column(Modifier.weight(1f).padding(horizontal = 12.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text("NEXT PERIOD", color = colors.onSurfaceVariant, fontSize = 11.sp, letterSpacing = 0.8.sp)
                        Text(prediction?.date?.format(DateTimeFormatter.ofPattern("MMM d, yyyy")) ?: "Waiting for history",
                            color = colors.primary, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    }
                    if (prediction != null) {
                        val days = DAYS.between(today, prediction.date)
                        Column(horizontalAlignment = Alignment.End) {
                            Text(when { days < 0 -> "${-days} days overdue"; days == 0L -> "Expected today"; else -> "in $days days" },
                                color = colors.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                            Text("${prediction.confidence.lowercase()} confidence", style = MaterialTheme.typography.bodySmall,
                                color = when (prediction.confidence) { "High" -> TrackerColors.Success; "Medium" -> Color(0xFFF59E0B); else -> TrackerColors.Error })
                        }
                    }
                }
                HorizontalDivider()
                FertilityIndex(Cycle.fertility(today, data.periods))
                if (phase != null) {
                    TextButton(onClick = { showPhaseInfo = true }, contentPadding = PaddingValues(0.dp)) {
                        Box(Modifier.size(8.dp).background(phase.color(), CircleShape))
                        Spacer(Modifier.width(8.dp))
                        Text("${phase.label} · phase info", color = colors.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                        Spacer(Modifier.width(8.dp))
                        Icon(painterResource(R.drawable.ic_info), contentDescription = null, tint = colors.onSurfaceVariant)
                    }
                } else {
                    Text("Log two completed periods for predictions.", color = colors.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
    if (showPhaseInfo && phase != null) PhaseInfoDialog(phase, onDismiss = { showPhaseInfo = false })
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
    val status by model.status.collectAsStateWithLifecycle()
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
            TextButton(enabled = !status.busy, onClick = { model.showSignIn(true) }) { Text("Sign in again") }
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
