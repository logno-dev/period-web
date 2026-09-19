package dev.logno.period

import java.time.LocalDate
import java.time.temporal.ChronoUnit.DAYS
import kotlin.math.floor
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sqrt

data class Period(val id: String, val start: LocalDate, val end: LocalDate?)
data class Mood(val id: String, val date: LocalDate, val mood: String)
data class Snapshot(val periods: List<Period> = emptyList(), val moods: List<Mood> = emptyList(), val syncedAt: Long = 0)
enum class Phase(val label: String) {
    MENSTRUAL("Menstrual"), FOLLICULAR("Follicular"), OVULATION("Ovulation window"), LUTEAL("Luteal")
}
data class Prediction(val date: LocalDate, val confidence: String)
data class Reminder(val key: String, val date: LocalDate, val title: String, val text: String)

object Cycle {
    fun length(period: Period) = period.end?.let { DAYS.between(period.start, it).toInt() + 1 }
    fun periodLength(periods: List<Period>): Int = periods.mapNotNull(::length).let {
        if (it.isEmpty()) 5 else it.average().roundToInt()
    }
    fun gaps(periods: List<Period>) = periods.filter { it.end != null }.sortedBy { it.start }
        .zipWithNext { a, b -> DAYS.between(a.start, b.start).toInt() }
    fun cycleLength(periods: List<Period>): Double = gaps(periods).let { if (it.isEmpty()) 28.0 else it.average() }
    fun prediction(periods: List<Period>): Prediction? {
        val gaps = gaps(periods)
        if (gaps.isEmpty()) return null
        val mean = gaps.average()
        val deviation = sqrt(gaps.map { (it - mean).pow(2) }.average())
        val confidence = when {
            gaps.size >= 5 && deviation <= 2 -> "High"
            gaps.size >= 3 && deviation <= 4 -> "Medium"
            else -> "Low"
        }
        return Prediction(periods.maxOf { it.start }.plusDays(floor(mean).toLong().coerceAtLeast(1)), confidence)
    }

    // Same adaptive phase boundaries as the web tracker; LocalDate avoids DST day-length errors.
    private fun boundaries(cycleInput: Int, periodInput: Int): IntRange {
        val cycle = cycleInput.coerceAtLeast(8)
        val period = periodInput.coerceIn(1, cycle - 1)
        val available = (cycle - period).coerceAtLeast(1)
        var ovulation = minOf(4, maxOf(2, available - 1))
        var luteal = minOf(12, maxOf(1, available - ovulation - 1))
        var follicular = available - ovulation - luteal
        if (follicular < 3) {
            var deficit = 3 - follicular
            val lutealReduction = minOf(deficit, maxOf(0, luteal - 9))
            luteal -= lutealReduction
            deficit -= lutealReduction
            val ovulationReduction = minOf(deficit, maxOf(0, ovulation - 2))
            ovulation -= ovulationReduction
            follicular = available - ovulation - luteal
            if (follicular < 1) {
                luteal -= minOf(1 - follicular, maxOf(0, luteal - 1))
                follicular = available - ovulation - luteal
            }
        }
        val start = period + 1 + follicular.coerceAtLeast(1)
        return start until start + ovulation
    }

    fun phase(date: LocalDate, periods: List<Period>): Phase? {
        val sorted = periods.sortedBy { it.start }
        val averagePeriod = periodLength(periods)
        if (sorted.any { date >= it.start && date <= (it.end ?: it.start.plusDays(averagePeriod - 1L)) }) return Phase.MENSTRUAL
        val index = sorted.indexOfLast { it.start <= date }
        if (index < 0) return null
        val reference = sorted[index]
        val next = sorted.getOrNull(index + 1)
        val cycle = next?.let { DAYS.between(reference.start, it.start).toInt() } ?: cycleLength(periods).roundToInt()
        val day = DAYS.between(reference.start, date).toInt() + 1
        val window = boundaries(cycle, length(reference) ?: averagePeriod)
        return when {
            day < window.first -> Phase.FOLLICULAR
            day in window -> Phase.OVULATION
            else -> Phase.LUTEAL
        }
    }

    fun reminders(periods: List<Period>, from: LocalDate, days: Int = 90): List<Reminder> {
        if (periods.isEmpty()) return emptyList()
        val prediction = prediction(periods)
        val horizon = prediction?.date?.plusDays(1) ?: periods.maxOf { it.start }.plusDays(cycleLength(periods).toLong())
        return buildList {
            for (offset in 0 until days) {
                val date = from.plusDays(offset.toLong())
                if (date > horizon) break
                val today = phase(date, periods)
                val yesterday = phase(date.minusDays(1), periods)
                if (today != null && yesterday != null && today != yesterday) {
                    add(Reminder("phase:$date", date, "Cycle phase update", "Your estimated ${today.label.lowercase()} phase starts today."))
                }
                if (today != Phase.OVULATION && phase(date.plusDays(1), periods) == Phase.OVULATION) {
                    add(Reminder("ovulation:$date", date, "Ovulation window approaching", "Your estimated ovulation window starts tomorrow."))
                }
                if (prediction?.date == date.plusDays(1)) {
                    add(Reminder("period:$date", date, "Period expected tomorrow", "Based on your history. ${prediction.confidence} confidence."))
                }
                if (prediction?.date == date) {
                    add(Reminder("due:$date", date, "Period expected today", "Open your tracker to update your history."))
                }
            }
        }
    }

    fun validate(period: Period, others: List<Period>, today: LocalDate = LocalDate.now()) {
        require(period.start <= today) { "Start date cannot be in the future." }
        require(period.end == null || period.end in period.start..today) { "End date must be between the start date and today." }
        val rest = others.filter { it.id != period.id }
        require(period.end != null || rest.none { it.end == null }) { "End the active period first." }
        require(rest.none { period.start <= (it.end ?: today) && it.start <= (period.end ?: today) }) { "Period dates overlap an existing period." }
    }
}
