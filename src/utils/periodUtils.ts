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

export const getCyclePhaseForDate = (
  date: string,
  periods: Period[],
  averageCycleLength: number = 28,
): CyclePhaseInfo | null => {
  const completedPeriods = periods
    .filter(p => p.endDate)
    .sort(
      (a, b) =>
        parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime(),
    );

  if (completedPeriods.length === 0) return null;

  const checkDate = parseDate(date);

  // PRIORITY 1: Check if date is during an actual period (menstrual phase)
  // This takes absolute priority over all other phases
  const periodForDate = periods.find(period => isDateInPeriod(date, period));
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
    };
  }

  // Find the most recent completed period to calculate cycle position
  let referencePeriod: Period | null = null;
  let nextPeriod: Period | null = null;

  // Find reference period (most recent completed period before this date)
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
    };
  } else if (dayInCycle > averagePeriodLength && dayInCycle < ovulationStart) {
    // Follicular phase: After menstruation, before ovulation
    return {
      phase: 'follicular',
      dayInCycle,
      color: '#FBB6CE', // Light Pink
    };
  } else if (dayInCycle >= lutealStart) {
    // Luteal phase: After ovulation, before next period
    return {
      phase: 'luteal',
      dayInCycle,
      color: '#805AD5', // Purple
    };
  }

  // Default to follicular if we can't determine (early cycle)
  return {
    phase: 'follicular',
    dayInCycle,
    color: '#FBB6CE', // Light Pink
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
  const completedPeriods = periods
    .filter(p => p.endDate)
    .sort(
      (a, b) =>
        parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime(),
    );

  if (completedPeriods.length < 2) {
    return { predictedDate: null, daysUntil: null, confidence: 'insufficient' };
  }

  // Calculate average cycle length
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

  // Get the last period start date
  const lastPeriod = completedPeriods[completedPeriods.length - 1];
  const lastPeriodStart = parseDate(lastPeriod.startDate);

  // Calculate predicted next period date
  const predictedDate = new Date(lastPeriodStart);
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