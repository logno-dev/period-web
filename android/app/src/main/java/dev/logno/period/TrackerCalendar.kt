package dev.logno.period

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter

private data class CalendarMark(val background: Color, val text: Color, val description: String)

private fun calendarMark(date: LocalDate, periods: List<Period>, today: LocalDate, prediction: Prediction?): CalendarMark? {
    val averagePeriod = Cycle.periodLength(periods)
    val period = periods.firstOrNull {
        date >= it.start && date <= (it.end ?: maxOf(today, it.start.plusDays(averagePeriod - 1L)))
    }
    if (period != null) {
        val estimated = period.end == null && date > today
        return CalendarMark(TrackerColors.Menstrual.copy(alpha = if (estimated) 0.5f else 1f), Color.White,
            if (estimated) "estimated period" else "logged period")
    }
    if (date == prediction?.date) return CalendarMark(TrackerColors.Predicted, Color(0xFFAD285C), "predicted period")
    if (date > (prediction?.date ?: today.plusDays(60))) return null
    val phase = Cycle.phase(date, periods) ?: return null
    val reference = periods.filter { it.start <= date }.maxByOrNull { it.start }
    val estimated = reference?.end == null && periods.none { it.start > date }
    return CalendarMark(phase.color().copy(alpha = if (estimated) 0.5f else 1f),
        if (phase == Phase.FOLLICULAR) Color(0xFF333333) else Color.White, "estimated ${phase.label.lowercase()}")
}

@Composable
internal fun TrackerCalendar(
    month: YearMonth, data: Snapshot, today: LocalDate, selectedDate: LocalDate,
    onMonthChange: (YearMonth) -> Unit, onSelect: (LocalDate) -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val marks = remember(month, data.periods, today) {
        val prediction = Cycle.prediction(data.periods)
        (1..month.lengthOfMonth()).associate { day ->
            val date = month.atDay(day)
            date to calendarMark(date, data.periods, today, prediction)
        }
    }
    val moodDates = remember(data.moods) { data.moods.map { it.date }.toSet() }
    val leading = month.atDay(1).dayOfWeek.value % 7 // Sunday first, matching the web app.
    val weeks = (leading + month.lengthOfMonth() + 6) / 7
    Surface(
        modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp),
        color = colors.surface, border = BorderStroke(1.dp, colors.outline), shadowElevation = 2.dp,
    ) {
        Column {
            Row(Modifier.fillMaxWidth().background(TrackerColors.Accent).padding(horizontal = 4.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { onMonthChange(month.minusMonths(1)) }, modifier = Modifier.semantics { contentDescription = "Previous month" }) {
                    Text("←", color = Color.White, fontSize = 22.sp)
                }
                Text(month.format(DateTimeFormatter.ofPattern("MMMM yyyy")), Modifier.weight(1f).wrapContentWidth(),
                    color = Color.White, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                IconButton(onClick = { onMonthChange(month.plusMonths(1)) }, modifier = Modifier.semantics { contentDescription = "Next month" }) {
                    Text("→", color = Color.White, fontSize = 22.sp)
                }
            }
            Row(Modifier.fillMaxWidth().background(colors.surfaceVariant).padding(vertical = 10.dp)) {
                listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat").forEach {
                    Text(it, Modifier.weight(1f).wrapContentWidth(), color = colors.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
            }
            repeat(weeks) { row ->
                Row(Modifier.fillMaxWidth()) {
                    repeat(7) { column ->
                        val day = row * 7 + column - leading + 1
                        if (day !in 1..month.lengthOfMonth()) {
                            Spacer(Modifier.weight(1f).aspectRatio(1f))
                        } else {
                            val date = month.atDay(day)
                            val mark = marks[date]
                            // No horizontal padding: identical neighboring fills meet at the cell boundary.
                            // Cap only the ends of each visible run, including runs wrapping to another week.
                            val joinsPrevious = mark != null && column > 0 && marks[date.minusDays(1)]?.background == mark.background
                            val joinsNext = mark != null && column < 6 && marks[date.plusDays(1)]?.background == mark.background
                            val shape = RoundedCornerShape(
                                topStartPercent = if (joinsPrevious) 0 else 50, bottomStartPercent = if (joinsPrevious) 0 else 50,
                                topEndPercent = if (joinsNext) 0 else 50, bottomEndPercent = if (joinsNext) 0 else 50,
                            )
                            val isSelected = date == selectedDate
                            val isToday = date == today
                            val description = buildString {
                                append(date)
                                if (isToday) append(", today")
                                mark?.let { append(", ${it.description}") }
                                if (date in moodDates) append(", mood recorded")
                            }
                            Box(Modifier.weight(1f).aspectRatio(1f).padding(vertical = 2.dp).clip(shape)
                                .background(mark?.background ?: Color.Transparent)
                                .clickable(role = Role.Button) { onSelect(date) }
                                .semantics { contentDescription = description; selected = isSelected }, contentAlignment = Alignment.Center) {
                                val ringColor = if (mark?.text == Color.White) Color.White else colors.primary
                                Box(Modifier.fillMaxSize(0.78f)
                                    .border(if (isSelected) 2.dp else if (isToday) 1.dp else 0.dp,
                                        if (isSelected || isToday) ringColor else Color.Transparent, CircleShape), contentAlignment = Alignment.Center) {
                                    Text(day.toString(), color = mark?.text ?: if (isToday) colors.primary else colors.onSurface,
                                        fontSize = 14.sp, fontWeight = if (isToday || isSelected) FontWeight.Bold else FontWeight.Medium)
                                    if (date in moodDates) Box(Modifier.align(Alignment.BottomCenter).padding(bottom = 2.dp)
                                        .size(7.dp).background(Color(0xFF4A2D6F), CircleShape).border(1.dp, Color.White, CircleShape))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
internal fun PhaseLegend() {
    var selectedPhase by remember { mutableStateOf<Phase?>(null) }
    Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Cycle Phases", style = MaterialTheme.typography.titleSmall)
            Phase.entries.chunked(2).forEach { phases ->
                Row(Modifier.fillMaxWidth()) {
                    phases.forEach { phase ->
                        Row(Modifier.weight(1f).heightIn(min = 44.dp).clip(RoundedCornerShape(6.dp))
                            .clickable(role = Role.Button) { selectedPhase = phase }
                            .semantics { contentDescription = "${phase.label} phase information" },
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Box(Modifier.size(14.dp).background(phase.color(), CircleShape))
                            Text(if (phase == Phase.OVULATION) "Ovulation" else phase.label, style = MaterialTheme.typography.bodySmall)
                            Icon(painterResource(R.drawable.ic_info), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
                        }
                    }
                }
            }
        }
    }
    selectedPhase?.let { PhaseInfoDialog(it, onDismiss = { selectedPhase = null }) }
}
