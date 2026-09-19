package dev.logno.period

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun FertilityIndex(estimate: FertilityEstimate?) {
    var showInfo by remember { mutableStateOf(false) }
    Column {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("FERTILITY INDEX", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, letterSpacing = 0.8.sp)
            Text(estimate?.let { "${it.percentage}%" } ?: "Unavailable", style = MaterialTheme.typography.titleSmall,
                color = if (MaterialTheme.colorScheme.background == Color.White) Color(0xFF0369A1) else Color(0xFF7DD3FC))
            IconButton(onClick = { showInfo = true }, modifier = Modifier.size(40.dp)) {
                Icon(painterResource(R.drawable.ic_info), contentDescription = "About the fertility index", tint = MaterialTheme.colorScheme.primary)
            }
        }
        Text("Cycle-timing estimate, not pregnancy probability.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if (showInfo) AlertDialog(onDismissRequest = { showInfo = false }, title = { Text("Fertility index") }, text = {
        Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("This is the same relative cycle-timing index shown in the web app. It rises around the estimated ovulation window and falls afterward.")
            Text("The percentage is an index score, not your probability of becoming pregnant. A score of 100% does not mean pregnancy is certain, and a low score does not mean a day is safe for unprotected sex.")
            Text("The calculation uses logged period dates and cycle averages. It does not measure or confirm ovulation and can be wrong, especially when cycles vary or history is incomplete.")
            Text("It is not medical advice or a contraceptive method and should not be the sole basis for pregnancy decisions.")
            if (estimate == null) Text("Log a period to start seeing estimates. Dates before your first logged period have no index.")
        }
    }, confirmButton = { TextButton(onClick = { showInfo = false }) { Text("Got it") } })
}

private data class PhaseContent(val description: String, val characteristics: List<String>, val tips: List<String>)

private fun phaseContent(phase: Phase) = when (phase) {
    Phase.MENSTRUAL -> PhaseContent(
        "During menstruation, the lining of the uterus sheds. This marks the start of a new cycle.",
        listOf("Bleeding often lasts 3–7 days", "Estrogen and progesterone levels are low", "Cramps, fatigue, or mood changes can occur", "Symptoms and duration vary between people and cycles"),
        listOf("Stay hydrated and include iron-rich foods", "Try gentle heat for cramps", "Allow time for rest and self-care", "Track symptoms to notice your own patterns"),
    )
    Phase.FOLLICULAR -> PhaseContent(
        "Your body is preparing for ovulation. The calendar highlights the portion of this phase after your period ends; biologically, the follicular phase begins on the first day of menstruation.",
        listOf("Estrogen levels generally rise", "Follicles in the ovaries develop", "The uterine lining begins to thicken", "Some people notice increasing energy or a brighter mood"),
        listOf("Adjust activities to how you feel", "Choose exercise that feels comfortable", "Use higher-energy days for projects if it suits you", "Continue tracking symptoms and energy"),
    )
    Phase.OVULATION -> PhaseContent(
        "Ovulation is the release of an egg from an ovary. The blue calendar band is an estimated window, not confirmation that ovulation has occurred.",
        listOf("Timing varies; it is not always cycle day 14", "Estrogen peaks before ovulation", "Basal body temperature may rise afterward", "Cervical mucus may become clearer and more slippery"),
        listOf("Calendar estimates alone cannot identify safe days", "Notice changes in your body's signals", "Keep tracking patterns across cycles", "For pregnancy planning, consider discussing tracking methods with a clinician"),
    )
    Phase.LUTEAL -> PhaseContent(
        "After ovulation, the body supports the uterine lining in preparation for a possible pregnancy or the next period.",
        listOf("Progesterone rises after ovulation", "Hormone levels fall before a period if pregnancy does not occur", "PMS symptoms, bloating, or breast tenderness may appear", "Energy and mood may change"),
        listOf("Make time for self-care and stress management", "Choose balanced meals, including magnesium-rich foods", "Try gentle movement such as walking or yoga", "Track mood changes and be patient with yourself"),
    )
}

@Composable
internal fun PhaseInfoDialog(phase: Phase, onDismiss: () -> Unit) {
    val info = phaseContent(phase)
    AlertDialog(onDismissRequest = onDismiss, title = {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.size(16.dp).background(phase.color(), CircleShape))
            Text(if (phase == Phase.OVULATION) "Ovulation phase" else "${phase.label} phase")
        }
    }, text = {
        Column(Modifier.heightIn(max = 460.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(info.description)
            Text("What's happening", style = MaterialTheme.typography.titleSmall)
            info.characteristics.forEach { Text("• $it") }
            Text("Tips", style = MaterialTheme.typography.titleSmall)
            info.tips.forEach { Text("• $it") }
            Text("Phase dates are estimates based on your history. Individual experiences vary.", style = MaterialTheme.typography.bodySmall)
        }
    }, confirmButton = { TextButton(onClick = onDismiss) { Text("Got it") } })
}
