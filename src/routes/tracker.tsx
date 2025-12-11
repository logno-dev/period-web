import { Title } from "@solidjs/meta";
import { createMemo, createResource, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { A } from "@solidjs/router";
import { useAuth } from "~/components/Context";
import { logout } from "~/auth";
import Calendar from "~/components/Calendar";
import Modal from "~/components/Modal";
import CyclePhaseLegend from "~/components/CyclePhaseLegend";
import { Period, CalendarMarkedDate, ModalConfig } from "~/types/period";
import {
  formatDate,
  isDateInPeriod,
  calculateNextPeriodPrediction,
  getCyclePhaseForDate,
  calculateAverageCycleLength,
  checkIfPeriodIsEarly,
  estimateActivePeriodEndDate,
} from "~/utils/periodUtils";

export default function Tracker() {
  // Use a store for modal configuration
  const [modalConfig, setModalConfig] = createStore<ModalConfig>({
    visible: false,
    title: '',
    message: '',
    buttons: [],
  });

  // State for editing periods
  const [editMode, setEditMode] = createStore<{
    active: boolean;
    periodId: string | null;
    editingField: 'start' | 'end' | null;
  }>({
    active: false,
    periodId: null,
    editingField: null,
  });

  // Create a resource for periods data with automatic loading states
  const [periods, { refetch }] = createResource(
    () => {
      // Only fetch on client side 
      if (typeof window === 'undefined') return null;
      return true; // Simple trigger for client-side fetching
    },
    async () => {
      console.log('Fetching periods...');
      
      const response = await fetch('/api/periods');
      
      if (!response.ok) {
        if (response.status === 401) {
          // Redirect to login
          window.location.href = '/login';
          return [];
        }
        throw new Error(`Failed to fetch periods: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Periods loaded:', data.periods?.length || 0);
      return data.periods || [];
    }
  );

  // Get user email from localStorage or session (simplified approach)
  const userEmail = () => {
    if (typeof window === 'undefined') return 'User';
    // This is a simplified approach - in real app you'd get this from auth context
    return localStorage.getItem('userEmail') || 'User';
  };

  // Computed values using memos
  const currentPeriod = createMemo(() => {
    const periodsData = periods();
    return periodsData?.find((p: Period) => !p.endDate) || null;
  });

  const prediction = createMemo(() => {
    const periodsData = periods();
    if (!periodsData || periodsData.length === 0) {
      return {
        predictedDate: null,
        daysUntil: null,
        confidence: 'insufficient' as const,
      };
    }
    return calculateNextPeriodPrediction(periodsData);
  });

  const earlyPeriodInfo = createMemo(() => {
    const periodsData = periods();
    const current = currentPeriod();
    if (!periodsData || !current) {
      return { isEarly: false, daysEarly: null, predictedDate: null };
    }
    return checkIfPeriodIsEarly(periodsData, current);
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
        refetch();
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
        refetch();
      }
    } catch (error) {
      console.error('Failed to stop period:', error);
    }
  };

  const handleDatePress = async (dateString: string) => {
    const periodsData = periods();
    if (!periodsData) return;

    // PRIORITY: If in edit mode, handle the date selection for editing (before any other checks)
    if (editMode.active && editMode.periodId && editMode.editingField) {
      const periodToEdit = periodsData.find((p: Period) => p.id === editMode.periodId);
      if (!periodToEdit) {
        setEditMode({ active: false, periodId: null, editingField: null });
        return;
      }

      const newDate = new Date(dateString);
      
      if (editMode.editingField === 'start') {
        // Editing start date
        const currentEnd = periodToEdit.endDate ? new Date(periodToEdit.endDate) : null;
        
        if (currentEnd && newDate > currentEnd) {
          setModalConfig({
            visible: true,
            title: 'Invalid Date',
            message: 'Start date cannot be after the end date.',
            buttons: [{ text: 'OK', onPress: () => {}, style: 'default' }],
          });
          return;
        }

        try {
          const response = await fetch('/api/periods', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: periodToEdit.id,
              startDate: dateString,
            }),
          });

          if (response.ok) {
            refetch();
            setEditMode({ active: false, periodId: null, editingField: null });
          }
        } catch (error) {
          console.error('Failed to update period:', error);
        }
      } else if (editMode.editingField === 'end') {
        // Editing end date
        const currentStart = new Date(periodToEdit.startDate);
        
        if (newDate < currentStart) {
          setModalConfig({
            visible: true,
            title: 'Invalid Date',
            message: 'End date cannot be before the start date.',
            buttons: [{ text: 'OK', onPress: () => {}, style: 'default' }],
          });
          return;
        }

        try {
          const response = await fetch('/api/periods', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: periodToEdit.id,
              endDate: dateString,
            }),
          });

          if (response.ok) {
            refetch();
            setEditMode({ active: false, periodId: null, editingField: null });
          }
        } catch (error) {
          console.error('Failed to update period:', error);
        }
      }
      
      return;
    }

    // Check if this date is already part of an existing period
    const periodForDate = periodsData.find((period: Period) =>
      isDateInPeriod(dateString, period),
    );
    
    if (periodForDate) {
      const startDateObj = new Date(periodForDate.startDate);
      const endDateObj = periodForDate.endDate ? new Date(periodForDate.endDate) : null;
      const isOngoing = !periodForDate.endDate;
      
      setModalConfig({
        visible: true,
        title: 'Manage Period',
        message: `Period: ${startDateObj.toLocaleDateString()} to ${endDateObj ? endDateObj.toLocaleDateString() : 'ongoing'}. What would you like to do?`,
        buttons: [
          {
            text: 'Cancel',
            onPress: () => {},
            style: 'cancel',
          },
          {
            text: 'Edit Start Date',
            onPress: () => {
              setEditMode({ active: true, periodId: periodForDate.id, editingField: 'start' });
              setModalConfig({
                visible: true,
                title: 'Edit Start Date',
                message: 'Tap on the calendar to select a new start date.',
                buttons: [
                  {
                    text: 'Cancel',
                    onPress: () => {
                      setEditMode({ active: false, periodId: null, editingField: null });
                    },
                    style: 'cancel',
                  },
                ],
              });
            },
            style: 'default',
          },
          ...(!isOngoing ? [{
            text: 'Edit End Date',
            onPress: () => {
              setEditMode({ active: true, periodId: periodForDate.id, editingField: 'end' });
              setModalConfig({
                visible: true,
                title: 'Edit End Date',
                message: 'Tap on the calendar to select a new end date.',
                buttons: [
                  {
                    text: 'Cancel',
                    onPress: () => {
                      setEditMode({ active: false, periodId: null, editingField: null });
                    },
                    style: 'cancel',
                  },
                ],
              });
            },
            style: 'default',
          }] : []),
          {
            text: 'Delete',
            onPress: async () => {
              try {
                const response = await fetch(`/api/periods?id=${periodForDate.id}`, {
                  method: 'DELETE',
                });

                if (response.ok) {
                  refetch();
                }
              } catch (error) {
                console.error('Failed to delete period:', error);
              }
            },
            style: 'destructive',
          },
        ],
      });
      return;
    }

    // Check if there's an active period
    const activePeriod = currentPeriod();

    if (activePeriod) {
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
                  refetch();
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
                  refetch();
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

  // Helper function to convert hex color to rgba with opacity
  const hexToRgba = (hex: string, opacity: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const getMarkedDates = createMemo(() => {
    const periodsData = periods();
    if (!periodsData) return {};

    const markedDates: Record<string, CalendarMarkedDate> = {};

    // If in edit mode, only show the period being edited with border styling
    if (editMode.active && editMode.periodId) {
      const periodToEdit = periodsData.find((p: Period) => p.id === editMode.periodId);
      if (periodToEdit && periodToEdit.endDate) {
        const startDate = new Date(periodToEdit.startDate);
        const endDate = new Date(periodToEdit.endDate);

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateString = formatDate(d);
          const isStart = formatDate(d) === periodToEdit.startDate;
          const isEnd = formatDate(d) === periodToEdit.endDate;

          markedDates[dateString] = {
            color: '#D53F8C',
            textColor: 'var(--text-primary)',
            startingDay: isStart,
            endingDay: isEnd,
            borderOnly: true,
          };
        }
      } else if (periodToEdit && !periodToEdit.endDate) {
        // Ongoing period - just show start date
        markedDates[periodToEdit.startDate] = {
          color: '#D53F8C',
          textColor: 'var(--text-primary)',
          startingDay: true,
          endingDay: true,
          borderOnly: true,
        };
      }
      return markedDates;
    }

    const averageCycleLength = calculateAverageCycleLength(periodsData);

    // Mark all period days (menstrual phase)
    periodsData.forEach((period: Period) => {
      if (period.endDate) {
        // Completed period
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
        // Active period - estimate end date and mark all days
        const estimatedEndDate = estimateActivePeriodEndDate(period, periodsData);
        const startDate = new Date(period.startDate);
        const endDate = new Date(estimatedEndDate);
        const today = formatDate(new Date());

        console.log('[Active Period Debug]', {
          periodStart: period.startDate,
          estimatedEnd: estimatedEndDate,
          today: today,
        });

        // Mark all days from start to estimated end
        let dayCount = 0;
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateString = formatDate(new Date(d));
          const isStart = dateString === period.startDate;
          const isEnd = dateString === estimatedEndDate;
          const isPastOrToday = dateString <= today;
          const opacity = isPastOrToday ? 1 : 0.5;

          markedDates[dateString] = {
            color: opacity < 1 ? hexToRgba('#D53F8C', opacity) : '#D53F8C',
            textColor: 'white',
            startingDay: isStart,
            endingDay: isEnd,
          };
          dayCount++;
        }
        console.log('[Active Period Debug] Marked', dayCount, 'days');
      }
    });

    // Add cycle phase markings for non-period days (only up to predicted date)
    const pred = prediction();
    if (periodsData.length > 0) {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 60);
      
      // Only mark up to the predicted date (or 60 days forward if no prediction)
      const endDate = new Date(today);
      if (pred.predictedDate && pred.confidence !== 'insufficient') {
        endDate.setTime(new Date(pred.predictedDate).getTime());
      } else {
        endDate.setDate(endDate.getDate() + 60);
      }

      let processedCount = 0;
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateString = formatDate(d);

        if (markedDates[dateString]) continue;

        const phaseInfo = getCyclePhaseForDate(dateString, periodsData, averageCycleLength);
        if (phaseInfo && phaseInfo.phase !== 'menstrual') {
          const textColor = phaseInfo.phase === 'follicular' ? '#333' : 'white';
          const opacity = phaseInfo.isEstimated ? 0.5 : 1;

          if (phaseInfo.isEstimated) {
            console.log('[Tracker] Date:', dateString, 'Phase:', phaseInfo.phase, 'isEstimated:', phaseInfo.isEstimated, 'opacity:', opacity, 'will use color:', opacity < 1 ? 'RGBA' : 'HEX');
          }

          markedDates[dateString] = {
            color: opacity < 1 ? hexToRgba(phaseInfo.color, opacity) : phaseInfo.color,
            textColor: textColor,
            startingDay: true,
            endingDay: true,
          };
          processedCount++;
        }
      }
      console.log('[Tracker] Processed', processedCount, 'phase days');
    }

    // Add next period prediction marking
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

  const renderEarlyWarningCard = () => {
    const earlyInfo = earlyPeriodInfo();
    
    if (!earlyInfo.isEarly || !earlyInfo.daysEarly || !earlyInfo.predictedDate) {
      return null;
    }

    const formatPredictionDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };

    return (
      <div class="bg-orange-50 rounded-lg shadow-md p-4 mx-5 mb-4 border-l-4 border-orange-500">
        <div class="flex justify-between items-center mb-2">
          <h3 class="text-base font-bold text-gray-900">Period Started Early</h3>
          <span class="text-xs font-semibold text-orange-600">
            ⚠️ Early
          </span>
        </div>
        <div class="text-center">
          <div class="text-sm text-gray-700 mb-2">
            Expected: <span class="font-semibold">{formatPredictionDate(earlyInfo.predictedDate)}</span>
          </div>
          <div class="text-lg font-bold text-orange-600">
            Started {earlyInfo.daysEarly} day{earlyInfo.daysEarly !== 1 ? 's' : ''} early
          </div>
        </div>
      </div>
    );
  };

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

    const current = currentPeriod();
    const title = current ? 'Following Period Prediction' : 'Next Period Prediction';

    return (
      <div class="bg-white rounded-lg shadow-md p-4 mx-5 mb-4 border-l-4 border-pink-500">
        <div class="flex justify-between items-center mb-2">
          <h3 class="text-base font-bold text-gray-900">{title}</h3>
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
          <div class="flex items-center gap-4">
            <div class="text-sm">
              Welcome, <span class="font-medium">{userEmail()}</span>
            </div>
            <form action={logout} method="post">
              <button
                type="submit"
                class="px-3 py-1 text-xs bg-pink-600 hover:bg-pink-700 rounded transition-colors"
              >
                Sign Out
              </button>
            </form>
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
        {/* Early Period Warning (if applicable) */}
        {renderEarlyWarningCard()}
        
        {/* Prediction Card */}
        {renderPredictionCard()}

        {/* Calendar */}
        <div class="p-5">
          <Show when={editMode.active}>
            <div 
              class="mb-4 p-4 rounded-lg shadow-md border flex items-center justify-between"
              style={{
                "background-color": "var(--bg-primary)",
                "border-color": "var(--accent-color)",
                "color": "var(--text-primary)"
              }}
            >
              <div class="font-semibold">
                {editMode.editingField === 'start' 
                  ? 'Select New Start Date' 
                  : 'Select New End Date'}
              </div>
              <button
                onClick={() => setEditMode({ active: false, periodId: null, editingField: null })}
                class="px-4 py-2 rounded-md font-medium transition-colors"
                style={{
                  "background-color": "var(--bg-secondary)",
                  "color": "var(--text-primary)",
                  "border": "1px solid var(--border-color)"
                }}
                onmouseover={(e) => e.currentTarget.style.opacity = "0.8"}
                onmouseout={(e) => e.currentTarget.style.opacity = "1"}
              >
                Cancel Edit
              </button>
            </div>
          </Show>
          <Calendar
            markedDates={getMarkedDates()}
            onDayPress={handleDatePress}
            periods={periods()}
            averageCycleLength={calculateAverageCycleLength(periods() || [])}
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