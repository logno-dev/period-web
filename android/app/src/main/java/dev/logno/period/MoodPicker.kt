package dev.logno.period

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import java.time.format.DateTimeFormatter

private data class MoodGroup(val title: String, val lightColor: Color, val darkColor: Color, val options: List<String>)

// Labels and group ordering match openMoodPicker in src/routes/index.tsx.
private val MoodGroups = listOf(
    MoodGroup("Positive", Color(0xFF15803D), Color(0xFF86EFAC), listOf("Happy", "High energy", "Aroused")),
    MoodGroup("Neutral", Color(0xFF64748B), Color(0xFFCBD5E1), listOf("Tender breasts", "Full breasts", "Deflated breasts", "Spacey")),
    MoodGroup("Negative", Color(0xFFB91C1C), Color(0xFFFCA5A5), listOf(
        "Low mood", "Anxious", "Irritable", "Low energy", "Bloating", "Cramps", "Constipation", "Diarrhea", "Headache",
    )),
)

@Composable
internal fun MoodPicker(date: LocalDate, busy: Boolean, onSelect: (String) -> Unit, onDismiss: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val dark = colors.surface.luminance() < 0.5f
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add mood marker") },
        text = {
            Column(Modifier.heightIn(max = 440.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("Select a mood for ${date.format(DateTimeFormatter.ofPattern("MMM d, yyyy"))}.", color = colors.onSurfaceVariant)
                MoodGroups.forEach { group ->
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(group.title, style = MaterialTheme.typography.titleSmall, color = colors.onSurfaceVariant)
                        group.options.forEach { mood ->
                            OutlinedButton(
                                onClick = { onSelect(mood) }, enabled = !busy,
                                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                                shape = RoundedCornerShape(6.dp),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = if (dark) group.darkColor else group.lightColor),
                            ) { Text(mood, Modifier.fillMaxWidth()) }
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
