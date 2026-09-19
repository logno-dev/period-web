package dev.logno.period

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

class InsightsTest {
    private fun date(value: String) = LocalDate.parse(value)
    private fun period(start: String, end: String? = null) = Period(start, date(start), end?.let(::date))
    private val regular = listOf(period("2026-01-01", "2026-01-05"), period("2026-01-29", "2026-02-02"))

    @Test fun fertilityMatchesWebTimingIndexAcrossOvulationWindow() {
        assertNull(Cycle.fertility(date("2025-12-31"), regular))
        assertNull(Cycle.fertility(date("2026-01-01"), emptyList()))
        assertEquals(2, Cycle.fertility(date("2026-01-01"), regular)?.percentage)
        assertNull(Cycle.fertility(date("2026-01-01"), regular)?.dayFromOvulation)
        assertEquals(8, Cycle.fertility(date("2026-01-06"), regular)?.percentage)
        val expected = listOf(25, 35, 50, 70, 90, 100, 12, 5, 2)
        expected.forEachIndexed { offset, value ->
            val estimate = Cycle.fertility(date("2026-01-11").plusDays(offset.toLong()), regular)!!
            assertEquals(value, estimate.percentage)
            assertEquals(offset - 5, estimate.dayFromOvulation)
        }
        assertEquals(Phase.FOLLICULAR, Cycle.fertility(date("2026-01-11"), regular)?.phase)
        assertEquals(Phase.OVULATION, Cycle.fertility(date("2026-01-16"), regular)?.phase)
        assertEquals(Phase.LUTEAL, Cycle.fertility(date("2026-01-17"), regular)?.phase)
    }

    @Test fun fertilityUsesHistoricalCycleLengthAndActivePeriodEstimates() {
        val irregular = listOf(period("2026-01-01", "2026-01-05"), period("2026-02-05", "2026-02-09"), period("2026-03-01", "2026-03-05"))
        assertEquals(100, Cycle.fertility(date("2026-01-23"), irregular)?.percentage) // 35-day historical cycle
        assertEquals(100, Cycle.fertility(date("2026-02-16"), irregular)?.percentage) // 24-day historical cycle
        val active = listOf(period("2026-01-01"))
        assertTrue(Cycle.fertility(date("2026-01-03"), active)!!.isEstimated)
        assertTrue(Cycle.fertility(date("2026-01-16"), active)!!.isEstimated)
        assertEquals(100, Cycle.fertility(date("2026-01-16"), active)?.percentage)
        assertEquals(16, Cycle.phaseInfo(date("2026-01-16"), active)?.dayInCycle)
    }

    @Test fun statisticsExcludeActivePeriodsAndKeepUnroundedAverages() {
        val periods = listOf(period("2026-03-01"), period("2026-01-29", "2026-02-01"), period("2026-01-01", "2026-01-05"))
        val summary = Cycle.statistics(periods)
        assertEquals(2, summary.completed.size)
        assertEquals(4.5, summary.averagePeriod!!, 0.001)
        assertEquals(28.0, summary.averageCycle!!, 0.001)
        assertEquals(date("2026-01-29"), summary.completed.first().period.start)
        assertEquals(28, summary.completed.first().cycleLength)
        assertNull(summary.completed.last().cycleLength)
        assertNull(Cycle.statistics(periods.take(1)).averagePeriod)
        assertNull(Cycle.statistics(periods.take(1)).averageCycle)
        assertNull(Cycle.statistics(regular.take(1)).averageCycle)
    }

    @Test fun moodPatternsCountUnknownDatesAndBreakDayTiesByEarliestDay() {
        val moods = listOf(
            Mood("1", date("2026-01-30"), "Tired"), // cycle day 2
            Mood("2", date("2026-01-01"), "Tired"), // cycle day 1 wins the tie
            Mood("3", date("2025-12-31"), "Tired"), // no cycle reference
            Mood("4", date("2026-01-13"), "Happy"),
        )
        val patterns = Cycle.moodPatterns(regular, moods)
        assertEquals("Tired", patterns.first().mood)
        assertEquals(3, patterns.first().total)
        assertEquals(1, patterns.first().mostCommonDay)
        assertEquals(1, patterns.first().mostCommonDayCount)
        assertEquals(Phase.MENSTRUAL, patterns.first().mostCommonPhase)
        assertEquals(2, patterns.first().mostCommonPhaseCount)
        assertEquals(1, patterns.first().unknownCycleCount)
        assertEquals(Phase.OVULATION, patterns.last().mostCommonPhase)
        val unknown = Cycle.moodPatterns(emptyList(), moods).first()
        assertEquals(3, unknown.unknownCycleCount)
        assertNull(unknown.mostCommonDay)
        assertNull(unknown.mostCommonPhase)
    }
}
