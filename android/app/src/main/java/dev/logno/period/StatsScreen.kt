package dev.logno.period

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
internal fun StatsScreen(data: Snapshot, busy: Boolean, onEdit: (Period) -> Unit, onDelete: (Period) -> Unit) {
    val summary = remember(data.periods) { Cycle.statistics(data.periods) }
    val patterns = remember(data.periods, data.moods) { Cycle.moodPatterns(data.periods, data.moods) }
    val colors = MaterialTheme.colorScheme
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        LazyColumn(Modifier.widthIn(max = 640.dp).fillMaxWidth(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Text("Period Statistics", style = MaterialTheme.typography.titleLarge)
                Text("${summary.completed.size} completed periods · ${data.moods.size} mood markers", color = colors.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
            item {
                Text("Averages", style = MaterialTheme.typography.titleSmall)
                Spacer(Modifier.height(8.dp))
                AverageCard("Period Length", summary.averagePeriod, TrackerColors.Accent)
                Spacer(Modifier.height(8.dp))
                AverageCard("Cycle Length", summary.averageCycle, TrackerColors.Success)
                Spacer(Modifier.height(8.dp))
                Text("Completed periods only. Cycle length is measured from one period's start to the next completed period's start.", style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant)
            }
            val active = data.periods.filter { it.end == null }.sortedByDescending { it.start }
            if (active.isNotEmpty()) item { Text("Active Period", style = MaterialTheme.typography.titleSmall) }
            items(active, key = { "active:${it.id}" }) { period ->
                PeriodHistoryCard(period, null, null, busy, onEdit, onDelete)
            }
            item { Text("Recent Periods", style = MaterialTheme.typography.titleSmall) }
            if (summary.completed.isEmpty()) item {
                StatsPanel {
                    Text("No Data Available", style = MaterialTheme.typography.titleSmall)
                    Text("Complete a period to see its duration here. Two completed periods are needed for an average cycle length.", style = MaterialTheme.typography.bodyMedium, color = colors.onSurfaceVariant)
                }
            }
            items(summary.completed, key = { "period:${it.period.id}" }) { stat ->
                PeriodHistoryCard(stat.period, stat.length, stat.cycleLength, busy, onEdit, onDelete)
            }
            item {
                HorizontalDivider()
                Spacer(Modifier.height(12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Mood Patterns", Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
                    Text("${data.moods.size} markers", color = colors.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
                Text("Patterns use estimated cycle phases; they describe your logged history, not a diagnosis.", color = colors.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
            if (patterns.isEmpty()) item {
                StatsPanel { Text("No mood markers yet. Use Add mood marker on the calendar to start tracking.", color = colors.onSurfaceVariant) }
            }
            items(patterns, key = { "mood:${it.mood}" }) { pattern ->
                StatsPanel {
                    Text(pattern.mood, style = MaterialTheme.typography.titleSmall)
                    Text(pattern.mostCommonDay?.let { "Most common cycle day: $it (${pattern.mostCommonDayCount}×)" } ?: "Not enough cycle data yet", color = colors.onSurfaceVariant)
                    pattern.mostCommonPhase?.let { Text("Most common phase: ${it.label} (${pattern.mostCommonPhaseCount}×)", color = colors.onSurfaceVariant) }
                    Text("Total: ${pattern.total} ${if (pattern.total == 1) "marker" else "markers"}" +
                        if (pattern.unknownCycleCount > 0) ", ${pattern.unknownCycleCount} outside cycle data" else "",
                        style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun AverageCard(label: String, value: Double?, accent: Color) {
    StatsPanel(accent) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(label, Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
            Text(value?.let { "${String.format(Locale.getDefault(), "%.1f", it)} days" } ?: "No data", color = accent, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun PeriodHistoryCard(period: Period, length: Int?, cycle: Int?, busy: Boolean, onEdit: (Period) -> Unit, onDelete: (Period) -> Unit) {
    val formatter = DateTimeFormatter.ofPattern("MMM d, yyyy")
    StatsPanel(TrackerColors.Accent) {
        Text("${period.start.format(formatter)} – ${period.end?.format(formatter) ?: "Active"}", style = MaterialTheme.typography.titleSmall)
        if (length != null) Text("Period Length: $length days", color = MaterialTheme.colorScheme.primary)
        else Text("Not included in completed-period averages.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        if (period.end != null) Text(cycle?.let { "Cycle Length: $it days" } ?: "Cycle Length: No previous completed period", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        Row {
            TextButton(onClick = { onEdit(period) }, enabled = !busy) { Text(if (period.end == null) "Edit / end period" else "Edit") }
            TextButton(onClick = { onDelete(period) }, enabled = !busy) { Text("Delete") }
        }
    }
}

@Composable
private fun StatsPanel(accent: Color? = null, content: @Composable ColumnScope.() -> Unit) {
    Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
        Row(Modifier.height(IntrinsicSize.Min)) {
            if (accent != null) Box(Modifier.width(4.dp).fillMaxHeight().background(accent))
            Column(Modifier.weight(1f).padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp), content = content)
        }
    }
}
