import { Title } from "@solidjs/meta";
import { createMemo, createResource, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { A } from "@solidjs/router";
import { useAuth } from "~/components/Context";
import Calendar from "~/components/Calendar";
import Modal from "~/components/Modal";
import CyclePhaseLegend from "~/components/CyclePhaseLegend";
import { Period, PeriodPrediction, CalendarMarkedDate, ModalConfig } from "~/types/period";
import {
  formatDate,
  isDateInPeriod,
  calculateNextPeriodPrediction,
  getCyclePhaseForDate,
  calculateAverageCycleLength,
} from "~/utils/periodUtils";

export default function Home() {
  const { session } = useAuth();
  
  // Use a store for modal configuration
  const [modalConfig, setModalConfig] = createStore<ModalConfig>({
    visible: false,
    title: '',
    message: '',
    buttons: [],
  });

  // Create a resource for periods data with automatic loading states
  const [periods, { mutate: mutatePeriods, refetch }] = createResource(
    () => session()?.id, // Only fetch when user is logged in
    async (userId) => {
      if (!userId) return [];
      
      console.log('Fetching periods for user:', userId);
      const response = await fetch('/api/periods');
      
      if (!response.ok) {
        if (response.status === 401) {
          return []; // Let auth handle redirect
        }
        throw new Error(`Failed to fetch periods: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Periods loaded:', data.periods?.length || 0);
      return data.periods || [];
    }
  );

  // Computed values using memos
  const currentPeriod = createMemo(() => {
    const periodsData = periods();
    return periodsData?.find((p: Period) => !p.endDate) || null;
  });

  const prediction = createMemo((): PeriodPrediction => {
    const periodsData = periods();
    if (!periodsData || periodsData.length === 0) {
      return {
        predictedDate: null,
        daysUntil: null,
        confidence: 'insufficient',
      };
    }
    return calculateNextPeriodPrediction(periodsData);
  });

  // Period management functions
  const handleStartPeriod = async () => {
    if (currentPeriod()) {
      setModalConfig({
        visible: true,
        title: 'Period Active',
        message: 'You already have an active period. Please stop it first.',
        buttons: [
          {
            text: 'OK',
            onPress: () => {},
            style: 'default',
          },
        ],
      });
      return;
    }

    try {
      const response = await fetch('/api/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: formatDate(new Date()),
        }),
      });

      if (response.ok) {
        refetch(); // Refetch the resource
      }
    } catch (error) {
      console.error('Failed to start period:', error);
    }
  };

  const handleStopPeriod = async () => {
    const current = currentPeriod();
    if (!current) {
      setModalConfig({
        visible: true,
        title: 'No Active Period',
        message: 'There is no active period to stop.',
        buttons: [
          {
            text: 'OK',
            onPress: () => {},
            style: 'default',
          },
        ],
      });
      return;
    }

    try {
      const response = await fetch('/api/periods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: current.id,
          endDate: formatDate(new Date()),
        }),
      });

      if (response.ok) {
        refetch(); // Refetch the resource
      }
    } catch (error) {
      console.error('Failed to stop period:', error);
    }
  };

  const handleDatePress = async (dateString: string) => {
    const periodsData = periods();
    if (!periodsData) return;

    // Check if this date is already part of an existing period
    const periodForDate = periodsData.find((period: Period) =>
      isDateInPeriod(dateString, period),
    );
    
    if (periodForDate) {
      // Navigate to edit period (for now just show info)
      setModalConfig({
        visible: true,
        title: 'Period Found',
        message: `This date is part of a period from ${periodForDate.startDate} to ${periodForDate.endDate || 'ongoing'}.`,
        buttons: [
          {
            text: 'OK',
            onPress: () => {},
            style: 'default',
          },
        ],
      });
      return;
    }

    // Check if there's an active period
    const activePeriod = currentPeriod();

    if (activePeriod) {
      // There's an active period, ask if they want to end it on this date
      const startDate = new Date(activePeriod.startDate);
      const clickedDate = new Date(dateString);

      if (clickedDate < startDate) {
        setModalConfig({
          visible: true,
          title: 'Invalid End Date',
          message: `End date cannot be before the start date. Please select a date after ${startDate.toLocaleDateString()}.`,
          buttons: [
            {
              text: 'OK',
              onPress: () => {},
              style: 'default',
            },
          ],
        });
        return;
      }

      setModalConfig({
        visible: true,
        title: 'End Period',
        message: `Do you want to end your current period on ${clickedDate.toLocaleDateString()}?`,
        buttons: [
          {
            text: 'Cancel',
            onPress: () => {},
            style: 'cancel',
          },
          {
            text: 'End Period',
            onPress: async () => {
              try {
                const response = await fetch('/api/periods', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    id: activePeriod.id,
                    endDate: dateString,
                  }),
                });

                if (response.ok) {
                  refetch(); // Refetch the resource
                }
              } catch (error) {
                console.error('Failed to end period:', error);
              }
            },
            style: 'destructive',
          },
        ],
      });
    } else {
      // No active period, ask if they want to start one on this date
      const clickedDate = new Date(dateString);
      setModalConfig({
        visible: true,
        title: 'Start Period',
        message: `Do you want to start a new period on ${clickedDate.toLocaleDateString()}?`,
        buttons: [
          {
            text: 'Cancel',
            onPress: () => {},
            style: 'cancel',
          },
          {
            text: 'Start Period',
            onPress: async () => {
              try {
                const response = await fetch('/api/periods', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    startDate: dateString,
                  }),
                });

                if (response.ok) {
                  refetch(); // Refetch the resource
                }
              } catch (error) {
                console.error('Failed to start period:', error);
              }
            },
            style: 'default',
          },
        ],
      });
    }
  };

  const getMarkedDates = createMemo(() => {
    const periodsData = periods();
    if (!periodsData) return {};

    const markedDates: Record<string, CalendarMarkedDate> = {};
    const averageCycleLength = calculateAverageCycleLength(periodsData);

    // Mark all period days (menstrual phase)
    periodsData.forEach((period: Period) => {
      if (period.endDate) {
        const startDate = new Date(period.startDate);
        const endDate = new Date(period.endDate);

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateString = formatDate(d);
          const isStart = formatDate(d) === period.startDate;
          const isEnd = formatDate(d) === period.endDate;

          markedDates[dateString] = {
            color: '#D53F8C',
            textColor: 'white',
            startingDay: isStart,
            endingDay: isEnd,
          };
        }
      } else {
        // Active period (single day)
        markedDates[period.startDate] = {
          color: '#D53F8C',
          textColor: 'white',
          startingDay: true,
          endingDay: true,
        };
      }
    });

    // Add cycle phase markings for non-period days
    if (periodsData.length > 0) {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 60);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 60);

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateString = formatDate(d);

        if (markedDates[dateString]) continue;

        const phaseInfo = getCyclePhaseForDate(dateString, periodsData, averageCycleLength);
        if (phaseInfo && phaseInfo.phase !== 'menstrual') {
          const textColor = phaseInfo.phase === 'follicular' ? '#333' : 'white';

          markedDates[dateString] = {
            color: phaseInfo.color,
            textColor: textColor,
            startingDay: true,
            endingDay: true,
          };
        }
      }
    }

    // Add next period prediction marking
    const pred = prediction();
    if (pred.predictedDate && pred.confidence !== 'insufficient') {
      const existingMarking = markedDates[pred.predictedDate];
      const isActualPeriod = existingMarking && existingMarking.color === '#D53F8C';

      if (!isActualPeriod) {
        markedDates[pred.predictedDate] = {
          color: '#FFE4E1',
          textColor: '#FF6B9D',
          startingDay: true,
          endingDay: true,
        };
      }
    }

    return markedDates;
  });

  const renderPredictionCard = () => {
    const pred = prediction();
    
    if (pred.confidence === 'insufficient') {
      return (
        <div class="bg-white rounded-lg shadow-md p-4 mx-5 mb-4 border-l-4 border-pink-500">
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-base font-bold text-gray-900">Next Period Prediction</h3>
          </div>
          <p class="text-sm text-gray-600 text-center italic">
            Complete at least 2 periods to see predictions
          </p>
        </div>
      );
    }

    const formatPredictionDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };

    const getConfidenceColor = () => {
      switch (pred.confidence) {
        case 'high': return '#4CAF50';
        case 'medium': return '#FF9800';
        case 'low': return '#f44336';
        default: return '#666';
      }
    };

    const getDaysText = () => {
      if (pred.daysUntil === null) return '';
      if (pred.daysUntil < 0) {
        return `${Math.abs(pred.daysUntil)} days overdue`;
      } else if (pred.daysUntil === 0) {
        return 'Expected today';
      } else {
        return `in ${pred.daysUntil} days`;
      }
    };

    return (
      <div class="bg-white rounded-lg shadow-md p-4 mx-5 mb-4 border-l-4 border-pink-500">
        <div class="flex justify-between items-center mb-2">
          <h3 class="text-base font-bold text-gray-900">Next Period Prediction</h3>
          <span class="text-xs font-semibold" style={{ color: getConfidenceColor() }}>
            {pred.confidence} confidence
          </span>
        </div>
        <div class="text-center">
          <div class="text-lg font-bold text-pink-500 mb-1">
            {pred.predictedDate ? formatPredictionDate(pred.predictedDate) : 'Unknown'}
          </div>
          <div class="text-sm text-gray-600">
            {getDaysText()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main class="min-h-screen bg-gray-50">
      <Title>Period Tracker</Title>
      
      {/* Header */}
      <div class="bg-pink-500 text-white p-4">
        <div class="flex justify-between items-center">
          <h1 class="text-xl font-bold">Period Tracker</h1>
          <div class="text-sm">
            Welcome, <span class="font-medium">{session()?.email}</span>
          </div>
        </div>
      </div>

      <Show when={periods.loading}>
        <div class="flex items-center justify-center py-12">
          <div class="text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
            <p class="text-gray-600">Loading...</p>
          </div>
        </div>
      </Show>

      <Show when={periods.error}>
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 mx-5 mt-4">
          <p class="text-red-800 text-center">
            Failed to load periods: {periods.error?.message}
          </p>
        </div>
      </Show>

      <Show when={!periods.loading && !periods.error}>
        {/* Prediction Card */}
        {renderPredictionCard()}

        {/* Calendar */}
        <div class="p-5">
          <Calendar
            markedDates={getMarkedDates()}
            onDayPress={handleDatePress}
          />
        </div>

        {/* Cycle Phase Legend */}
        <CyclePhaseLegend />

        {/* Action Buttons */}
        <div class="p-5 pb-10">
          <div class="flex gap-3">
            <button
              onClick={currentPeriod() ? handleStopPeriod : handleStartPeriod}
              class={`flex-2 px-6 py-4 rounded-lg font-bold text-white text-lg transition-colors ${
                currentPeriod() 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {currentPeriod() ? 'Stop Period' : 'Start Period'}
            </button>
            
            <A
              href="/stats"
              class="flex-1 px-4 py-4 rounded-lg font-semibold text-white bg-blue-500 hover:bg-blue-600 transition-colors text-center"
            >
              Stats
            </A>
          </div>
        </div>
      </Show>

      {/* Modal */}
      <Modal
        visible={modalConfig.visible}
        title={modalConfig.title}
        message={modalConfig.message}
        buttons={modalConfig.buttons}
        onClose={() => setModalConfig('visible', false)}
      />
    </main>
  );
}