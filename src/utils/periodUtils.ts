import { Period, PeriodStats, CyclePhase, CyclePhaseInfo, PeriodPrediction } from '../types/period';

export const generateId = (): string => {
  return Date.now().toString() + Math.random().toString(36).substring(2, 11);
};

export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const parseDate = (dateString: string): Date => {
  return new Date(dateString + 'T00:00:00');
};

export const calculateDaysBetween = (
  startDate: string,
  endDate: string,
): number => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

export const isDateInPeriod = (date: string, period: Period): boolean => {
  if (!period.endDate) return date === period.startDate;

  const checkDate = parseDate(date);
  const startDate = parseDate(period.startDate);
  const endDate = parseDate(period.endDate);

  return checkDate >= startDate && checkDate <= endDate;
};

export const calculateAveragePeriodLength = (periods: Period[]): number => {
  const completedPeriods = periods.filter(p => p.endDate);

  if (completedPeriods.length === 0) return 5; // Default period length

  const periodLengths = completedPeriods.map(period =>
    calculateDaysBetween(period.startDate, period.endDate!),
  );

  return Math.round(
    periodLengths.reduce((sum, length) => sum + length, 0) /
      periodLengths.length,
  );
};

/**
 * Estimate when an active period will end based on average period length
 */
export const estimateActivePeriodEndDate = (
  activePeriod: Period,
  periods: Period[],
): string => {
  const averagePeriodLength = calculateAveragePeriodLength(periods);
  const startDate = parseDate(activePeriod.startDate);
  const estimatedEndDate = new Date(startDate);
  estimatedEndDate.setDate(estimatedEndDate.getDate() + averagePeriodLength - 1);
  return formatDate(estimatedEndDate);
};

export const getCyclePhaseForDate = (
  date: string,
  periods: Period[],
  averageCycleLength: number = 28,
): CyclePhaseInfo | null => {
  const checkDate = parseDate(date);
  
  // Check if there's an active period (for estimation tracking)
  const hasActivePeriod = periods.some(p => !p.endDate);
  
  // Create a working set of periods with estimated end dates for active periods
  const workingPeriods = periods.map(p => {
    if (!p.endDate) {
      // Estimate end date for active period
      const estimatedEndDate = estimateActivePeriodEndDate(p, periods);
      return { ...p, endDate: estimatedEndDate, isEstimated: true };
    }
    return { ...p, isEstimated: false };
  });

  const completedPeriods = workingPeriods
    .filter(p => p.endDate)
    .sort(
      (a, b) =>
        parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime(),
    );

  if (completedPeriods.length === 0) return null;

  // PRIORITY 1: Check if date is during an actual/estimated period (menstrual phase)
  const periodForDate = workingPeriods.find(period => {
    if (!period.endDate) return false;
    const checkDate = parseDate(date);
    const startDate = parseDate(period.startDate);
    const endDate = parseDate(period.endDate);
    return checkDate >= startDate && checkDate <= endDate;
  });
  
  if (periodForDate) {
    const startDate = parseDate(periodForDate.startDate);
    const dayInPeriod =
      Math.ceil(
        (checkDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;
    return {
      phase: 'menstrual',
      dayInCycle: dayInPeriod,
      color: '#D53F8C', // Dark pink - highest priority
      isEstimated: periodForDate.isEstimated,
    };
  }

  // Find the most recent completed/estimated period to calculate cycle position
  let referencePeriod: (Period & { isEstimated?: boolean }) | null = null;
  let nextPeriod: (Period & { isEstimated?: boolean }) | null = null;

  // Find reference period (most recent period before this date)
  for (let i = completedPeriods.length - 1; i >= 0; i--) {
    const period = completedPeriods[i];
    const periodStart = parseDate(period.startDate);
    if (checkDate >= periodStart) {
      referencePeriod = period;
      // Also find the next period if it exists
      if (i < completedPeriods.length - 1) {
        nextPeriod = completedPeriods[i + 1];
      }
      break;
    }
  }

  if (!referencePeriod) return null;
  
  // Track if this calculation is based on an estimated period
  // Only mark as estimated if the REFERENCE period (the one we're calculating FROM) is estimated
  // If we have a next period, we're in a completed cycle, so use actual data
  const isBasedOnEstimation = nextPeriod ? false : (referencePeriod.isEstimated ?? false);

  // Calculate actual cycle length if we have a next period
  let actualCycleLength = averageCycleLength;
  if (nextPeriod) {
    const refStart = parseDate(referencePeriod.startDate);
    const nextStart = parseDate(nextPeriod.startDate);
    actualCycleLength = Math.ceil(
      (nextStart.getTime() - refStart.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  // Calculate days since the start of the reference period
  const referenceStart = parseDate(referencePeriod.startDate);
  const daysSinceStart = Math.ceil(
    (checkDate.getTime() - referenceStart.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Use actual cycle length for this specific cycle, or average if no next period
  const dayInCycle = daysSinceStart + 1; // +1 because day 1 is the start of period

  // Calculate average period length from user's data
  const averagePeriodLength = calculateAveragePeriodLength(periods);

  // Calculate phases based on medical research and user's actual data:

  // Ovulation: Typically occurs 12-16 days before next period
  // More accurate: 14 days before next period (luteal phase is more consistent)
  const ovulationStart = Math.max(1, actualCycleLength - 16);
  const ovulationEnd = Math.max(1, actualCycleLength - 12);

  // Luteal phase: From after ovulation until next period
  // Typically 12-14 days, more consistent than follicular phase
  const lutealStart = ovulationEnd + 1;

  // Determine phase based on day in cycle with medical accuracy
  if (dayInCycle >= ovulationStart && dayInCycle <= ovulationEnd) {
    // Ovulation window: 12-16 days before next period
    return {
      phase: 'ovulation',
      dayInCycle,
      color: '#3182CE', // Blue
      isEstimated: isBasedOnEstimation,
    };
  } else if (dayInCycle > averagePeriodLength && dayInCycle < ovulationStart) {
    // Follicular phase: After menstruation, before ovulation
    return {
      phase: 'follicular',
      dayInCycle,
      color: '#FBB6CE', // Light Pink
      isEstimated: isBasedOnEstimation,
    };
  } else if (dayInCycle >= lutealStart) {
    // Luteal phase: After ovulation, before next period
    return {
      phase: 'luteal',
      dayInCycle,
      color: '#805AD5', // Purple
      isEstimated: isBasedOnEstimation,
    };
  }

  // Default to follicular if we can't determine (early cycle)
  return {
    phase: 'follicular',
    dayInCycle,
    color: '#FBB6CE', // Light Pink
    isEstimated: isBasedOnEstimation,
  };
};

export const calculateAverageCycleLength = (periods: Period[]): number => {
  const completedPeriods = periods
    .filter(p => p.endDate)
    .sort(
      (a, b) =>
        parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime(),
    );

  if (completedPeriods.length < 2) return 28; // Default cycle length

  const cycleLengths: number[] = [];
  for (let i = 1; i < completedPeriods.length; i++) {
    const previousPeriod = completedPeriods[i - 1];
    const currentPeriod = completedPeriods[i];
    const cycleLength = calculateDaysBetween(
      previousPeriod.startDate,
      currentPeriod.startDate,
    );
    cycleLengths.push(cycleLength);
  }

  return (
    cycleLengths.reduce((sum, length) => sum + length, 0) / cycleLengths.length
  );
};

export const calculatePeriodStats = (periods: Period[]): PeriodStats[] => {
  const completedPeriods = periods
    .filter(p => p.endDate)
    .sort(
      (a, b) =>
        parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime(),
    );

  return completedPeriods.map((period, index) => {
    const lengthInDays = calculateDaysBetween(
      period.startDate,
      period.endDate!,
    );

    let daysBetweenPeriods: number | undefined;
    if (index > 0) {
      const previousPeriod = completedPeriods[index - 1];
      const daysBetween =
        calculateDaysBetween(previousPeriod.endDate!, period.startDate) - 1;
      daysBetweenPeriods = daysBetween;
    }

    return {
      startDate: period.startDate,
      endDate: period.endDate!,
      lengthInDays,
      daysBetweenPeriods,
    };
  });
};

export const calculateNextPeriodPrediction = (
  periods: Period[],
): PeriodPrediction => {
  // Sort all periods by start date
  const sortedPeriods = [...periods].sort(
    (a, b) =>
      parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime(),
  );

  // We need at least 2 completed periods to calculate cycle length
  const completedPeriods = sortedPeriods.filter(p => p.endDate);
  
  if (completedPeriods.length < 2) {
    return { predictedDate: null, daysUntil: null, confidence: 'insufficient' };
  }

  // Calculate average cycle length using completed periods
  const cycleLengths: number[] = [];
  for (let i = 1; i < completedPeriods.length; i++) {
    const previousPeriod = completedPeriods[i - 1];
    const currentPeriod = completedPeriods[i];
    const cycleLength = calculateDaysBetween(
      previousPeriod.startDate,
      currentPeriod.startDate,
    );
    cycleLengths.push(cycleLength);
  }

  const averageCycleLength =
    cycleLengths.reduce((sum, length) => sum + length, 0) / cycleLengths.length;

  // Get the most recent period (could be active or completed)
  const mostRecentPeriod = sortedPeriods[sortedPeriods.length - 1];
  const mostRecentStart = parseDate(mostRecentPeriod.startDate);

  // Calculate predicted next period date based on the most recent period
  const predictedDate = new Date(mostRecentStart);
  predictedDate.setDate(
    predictedDate.getDate() + Math.round(averageCycleLength),
  );

  // Calculate days until predicted period
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil(
    (predictedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Determine confidence based on data consistency
  const cycleVariance =
    cycleLengths.reduce(
      (sum, length) => sum + Math.pow(length - averageCycleLength, 2),
      0,
    ) / cycleLengths.length;
  const standardDeviation = Math.sqrt(cycleVariance);

  let confidence: 'high' | 'medium' | 'low' | 'insufficient';
  if (completedPeriods.length >= 6 && standardDeviation <= 2) {
    confidence = 'high';
  } else if (completedPeriods.length >= 4 && standardDeviation <= 4) {
    confidence = 'medium';
  } else if (completedPeriods.length >= 2) {
    confidence = 'low';
  } else {
    confidence = 'insufficient';
  }

  return {
    predictedDate: formatDate(predictedDate),
    daysUntil,
    confidence,
  };
};

/**
 * Check if current period started before the predicted date
 * Returns number of days early, or null if not early or no prediction
 */
export const checkIfPeriodIsEarly = (
  periods: Period[],
  currentPeriod: Period | null,
): { isEarly: boolean; daysEarly: number | null; predictedDate: string | null } => {
  if (!currentPeriod) {
    return { isEarly: false, daysEarly: null, predictedDate: null };
  }

  // Get completed periods (excluding the current one)
  const completedPeriods = periods
    .filter(p => p.endDate && p.id !== currentPeriod.id)
    .sort(
      (a, b) =>
        parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime(),
    );

  if (completedPeriods.length < 2) {
    return { isEarly: false, daysEarly: null, predictedDate: null };
  }

  // Calculate what the prediction would have been before this period started
  const prediction = calculateNextPeriodPrediction(completedPeriods);
  
  if (!prediction.predictedDate || prediction.confidence === 'insufficient') {
    return { isEarly: false, daysEarly: null, predictedDate: null };
  }

  const predictedDate = parseDate(prediction.predictedDate);
  const actualStartDate = parseDate(currentPeriod.startDate);

  // If actual start is before predicted, calculate how many days early
  if (actualStartDate < predictedDate) {
    const daysEarly = Math.ceil(
      (predictedDate.getTime() - actualStartDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    return { 
      isEarly: true, 
      daysEarly, 
      predictedDate: prediction.predictedDate 
    };
  }

  return { isEarly: false, daysEarly: null, predictedDate: prediction.predictedDate };
};