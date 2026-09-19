package dev.logno.period

import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Surface
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import java.time.LocalDate

class InsightsUiTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Test fun fertilityExplanationAndEachPhaseCanBeOpenedAndDismissed() {
        compose.runOnUiThread {
            compose.activity.setContent {
                TrackerTheme { Surface { Column {
                    FertilityIndex(FertilityEstimate(100, 0, Phase.OVULATION, false))
                    PhaseLegend()
                } } }
            }
        }
        compose.onNodeWithText("100%").assertIsDisplayed()
        compose.onNodeWithContentDescription("About the fertility index").performClick()
        compose.onNodeWithText("Fertility index", useUnmergedTree = true).assertIsDisplayed()
        compose.onNodeWithText("Got it").performClick()
        Phase.entries.forEach { phase ->
            compose.onNodeWithContentDescription("${phase.label} phase information").performClick()
            compose.onNodeWithText("What's happening").assertIsDisplayed()
            compose.onNodeWithText("Tips").performScrollTo().assertIsDisplayed()
            compose.onNodeWithText("Got it").performClick()
        }
    }

    @Test fun statsShowsAveragesCyclesAndMoodPatternsAndKeepsEditing() {
        val first = Period("first", LocalDate.parse("2026-01-01"), LocalDate.parse("2026-01-05"))
        val second = Period("second", LocalDate.parse("2026-01-29"), LocalDate.parse("2026-02-01"))
        var edited: Period? = null
        var deleted: Period? = null
        val data = Snapshot(listOf(first, second), listOf(Mood("m", first.start, "Tired")))
        compose.runOnUiThread {
            compose.activity.setContent { TrackerTheme { Surface { StatsScreen(data, false, { edited = it }, { deleted = it }) } } }
        }
        compose.onNodeWithText("4.5 days").assertIsDisplayed()
        compose.onNodeWithText("28.0 days").assertIsDisplayed()
        compose.onNodeWithText("Cycle Length: 28 days").assertIsDisplayed()
        compose.onAllNodesWithText("Edit").onFirst().performClick()
        compose.runOnIdle { assertEquals(second, edited) }
        compose.onAllNodesWithText("Delete").onFirst().performClick()
        compose.runOnIdle { assertEquals(second, deleted) }
        compose.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("Mood Patterns"))
        compose.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("Tired"))
        compose.onNodeWithText("Most common cycle day: 1 (1×)").assertIsDisplayed()
        compose.onNodeWithText("Most common phase: Menstrual (1×)").assertIsDisplayed()
    }
}
