package dev.logno.period

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

class CycleTest {
    private fun period(start: String, end: String? = null) = Period(start, LocalDate.parse(start), end?.let(LocalDate::parse))
    private val regular = listOf(period("2026-01-01", "2026-01-05"), period("2026-01-29", "2026-02-02"))

    @Test fun predictionUsesStartToStartGapAndLatestActivePeriod() {
        assertNull(Cycle.prediction(regular.take(1)))
        assertEquals(LocalDate.parse("2026-02-26"), Cycle.prediction(regular)?.date)
        assertEquals(LocalDate.parse("2026-03-26"), Cycle.prediction(regular + period("2026-02-26"))?.date)
        assertEquals("Low", Cycle.prediction(regular)?.confidence)
    }

    @Test fun inclusiveLengthIsUnaffectedByDstOrLeapDay() {
        assertEquals(5, Cycle.length(period("2026-03-06", "2026-03-10")))
        assertEquals(3, Cycle.length(period("2024-02-28", "2024-03-01")))
        assertEquals(28.0, Cycle.cycleLength(regular), 0.001)
    }

    @Test fun webPhaseBoundariesAndRemindersAgree() {
        assertEquals(Phase.MENSTRUAL, Cycle.phase(LocalDate.parse("2026-01-05"), regular))
        assertEquals(Phase.FOLLICULAR, Cycle.phase(LocalDate.parse("2026-01-06"), regular))
        assertEquals(Phase.OVULATION, Cycle.phase(LocalDate.parse("2026-01-13"), regular))
        assertEquals(Phase.LUTEAL, Cycle.phase(LocalDate.parse("2026-01-17"), regular))
        val reminders = Cycle.reminders(regular, LocalDate.parse("2026-02-01"))
        assertTrue(reminders.any { it.key == "ovulation:2026-02-09" })
        assertTrue(reminders.any { it.key == "period:2026-02-25" })
        assertTrue(reminders.any { it.key == "due:2026-02-26" })
        assertTrue(reminders.none { it.date > LocalDate.parse("2026-02-27") })
        assertTrue(Cycle.reminders(regular, LocalDate.parse("2026-06-01")).isEmpty())
    }

    @Test fun validationRejectsOverlapFutureAndMultipleActivePeriods() {
        val today = LocalDate.parse("2026-03-01")
        fun invalid(candidate: Period, existing: List<Period>) {
            assertThrows(IllegalArgumentException::class.java) { Cycle.validate(candidate, existing, today) }
        }
        invalid(period("2026-01-04", "2026-01-06"), regular)
        invalid(period("2026-03-02"), regular)
        invalid(period("2026-02-25", "2026-02-24"), regular)
        invalid(period("2026-02-26"), regular + period("2026-02-20"))
        Cycle.validate(regular.first().copy(end = LocalDate.parse("2026-01-06")), regular, today)
    }
}
