// Core Period types matching the React Native app
export interface Period {
  id: string;
  userId: number;
  startDate: string; // YYYY-MM-DD format
  endDate: string | null; // null for active periods
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PeriodStats {
  startDate: string;
  endDate: string;
  lengthInDays: number;
  daysBetweenPeriods?: number;
}

// Cycle phase types
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

export interface CyclePhaseInfo {
  phase: CyclePhase;
  dayInCycle: number;
  color: string;
}

// Prediction types
export interface PeriodPrediction {
  predictedDate: string | null;
  daysUntil: number | null;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
}

// Calendar marking types
export interface CalendarMarkedDate {
  color: string;
  textColor: string;
  startingDay: boolean;
  endingDay: boolean;
  borderOnly?: boolean; // Show border instead of fill
}

// Modal types
export interface ModalConfig {
  visible: boolean;
  title: string;
  message: string;
  buttons: Array<{
    text: string;
    onPress: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
}