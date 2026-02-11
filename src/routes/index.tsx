import { Title } from "@solidjs/meta";
import { createMemo, createResource, Show, createSignal, createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import { useAuth } from "~/components/Context";
import Calendar from "~/components/Calendar";
import Modal from "~/components/Modal";
import CyclePhaseLegend from "~/components/CyclePhaseLegend";
import Header from "~/components/Header";
import StatsWidget from "~/components/StatsWidget";
import { Period, CalendarMarkedDate, ModalConfig, MoodMarker } from "~/types/period";
import {
  formatDate,
  isDateInPeriod,
  calculateNextPeriodPrediction,
  getCyclePhaseForDate,
  calculateAverageCycleLength,
  checkIfPeriodIsEarly,
  estimateActivePeriodEndDate,
  parseDate,
} from "~/utils/periodUtils";

export default function Home() {
  const { session } = useAuth();

  // Track if we're on the client to prevent hydration mismatch
  const [isClient, setIsClient] = createSignal(false);
  
  createEffect(() => {
    setIsClient(true);
  });
  
  // Use signals for modal configuration (simple state)
  const [modalVisible, setModalVisible] = createSignal(false);
  const [modalTitle, setModalTitle] = createSignal('');
  const [modalMessage, setModalMessage] = createSignal('');
  const [modalButtons, setModalButtons] = createSignal<ModalConfig['buttons']>([]);
  const [modalSections, setModalSections] = createSignal<ModalConfig['sections']>(undefined);
  const [modalListTitle, setModalListTitle] = createSignal<string | undefined>(undefined);
  const [modalListItems, setModalListItems] = createSignal<Array<{ id: string; label: string }> | undefined>(undefined);
  const [modalListEmptyText, setModalListEmptyText] = createSignal<string | undefined>(undefined);
  const [modalListRemoveHandler, setModalListRemoveHandler] = createSignal<((id: string) => void) | undefined>(undefined);

  const [moodMode, setMoodMode] = createSignal(false);

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

  // Helper function to show modal
  const showModal = (
    title: string,
    message: string,
    buttons: ModalConfig['buttons'],
    sections?: ModalConfig['sections']
  ) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalButtons(buttons);
    setModalSections(sections);
    setModalListTitle(undefined);
    setModalListItems(undefined);
    setModalListEmptyText(undefined);
    setModalListRemoveHandler(undefined);
    setModalVisible(true);
  };

  // Create a resource for periods data with automatic loading states
  const [periods, { refetch }] = createResource(
    () => {
      // Only fetch on client side and when user is logged in
      if (typeof window === 'undefined') return null;
      return session()?.id;
    },
    async (userId) => {
      if (!userId) return [];
      
      console.log('Fetching periods for user:', userId);
      
      // Simple relative URL works fine on client side
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

  const [moodMarkers, { refetch: refetchMoodMarkers }] = createResource(
    () => {
      if (typeof window === 'undefined') return null;
      return session()?.id;
    },
    async (userId) => {
      if (!userId) return [];

      const response = await fetch('/api/mood-markers');

      if (!response.ok) {
        if (response.status === 401) {
          return [];
        }
        throw new Error(`Failed to fetch mood markers: ${response.status}`);
      }

      const data = await response.json();
      return data.markers || [];
    }
  );

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

  const moodMarkersByDate = createMemo(() => {
    const markers = moodMarkers();
    if (!markers) return {};

    const grouped: Record<string, string[]> = {};
    markers.forEach((marker: MoodMarker) => {
      if (!grouped[marker.date]) grouped[marker.date] = [];
      grouped[marker.date].push(marker.mood);
    });
    return grouped;
  });

  const moodMarkersByDateWithIds = createMemo(() => {
    const markers = moodMarkers();
    if (!markers) return {};

    const grouped: Record<string, MoodMarker[]> = {};
    markers.forEach((marker: MoodMarker) => {
      if (!grouped[marker.date]) grouped[marker.date] = [];
      grouped[marker.date].push(marker);
    });
    return grouped;
  });

  const openMoodPicker = (dateString: string) => {
    const dateLabel = parseDate(dateString).toLocaleDateString();

    const buildMoodItems = (moods: string[], textColor: string) =>
      moods.map((mood) => ({
        text: mood,
        onPress: async () => {
          try {
            const response = await fetch('/api/mood-markers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: dateString, mood }),
            });

            if (response.ok) {
              refetchMoodMarkers();
            }
          } catch (error) {
            console.error('Failed to add mood marker:', error);
          }
        },
        style: 'ghost' as const,
        textColor,
      }));

    const moodSections: ModalConfig['sections'] = [
      {
        title: 'Positive',
        items: buildMoodItems([
          'Happy',
          'High energy',
          'Aroused',
        ], '#15803d')
      },
      {
        title: 'Neutral',
        items: buildMoodItems([
          'Tender breasts',
          'Full breasts',
          'Deflated breasts',
          'Spacey',
        ], '#64748b')
      },
      {
        title: 'Negative',
        items: buildMoodItems([
          'Low mood',
          'Anxious',
          'Irritable',
          'Low energy',
          'Bloating',
          'Cramps',
          'Constipation',
          'Diarrhea',
          'Headache',
        ], '#b91c1c')
      },
    ];

    showModal(
      'Add Mood Marker',
      `Select a mood for ${dateLabel}.`,
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel' as const,
        },
      ],
      moodSections
    );
  };

  const setMoodListForDate = (dateString: string) => {
    const markers = moodMarkersByDateWithIds()[dateString] || [];
    setModalListTitle("Mood Markers");
    setModalListEmptyText("None yet for this day.");
    setModalListItems(markers.map((marker: MoodMarker) => ({
      id: marker.id,
      label: marker.mood,
    })));
    setModalListRemoveHandler(() => async (id: string) => {
      try {
        const response = await fetch(`/api/mood-markers?id=${id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          refetchMoodMarkers();
          setMoodListForDate(dateString);
        }
      } catch (error) {
        console.error('Failed to delete mood marker:', error);
      }
    });
  };

  const openManagePeriodModal = (periodForDate: Period, isOngoing: boolean) => {
    const startDateObj = parseDate(periodForDate.startDate);
    const endDateObj = periodForDate.endDate ? parseDate(periodForDate.endDate) : null;

    const manageButtons: ModalConfig['buttons'] = [
      {
        text: 'Cancel',
        onPress: () => {},
        style: 'cancel' as const,
      },
        {
          text: 'Edit Start Date',
          onPress: () => {
            setEditMode({ active: true, periodId: periodForDate.id, editingField: 'start' });
            showModal('Edit Start Date', 'Tap on the calendar to select a new start date.', [
              {
                text: 'Cancel',
                onPress: () => {
                  setEditMode({ active: false, periodId: null, editingField: null });
                },
                style: 'cancel' as const,
              },
            ]);
          },
          style: 'default' as const,
          closeOnPress: false,
        },
      ...(!isOngoing ? [{
        text: 'Edit End Date',
        onPress: () => {
          setEditMode({ active: true, periodId: periodForDate.id, editingField: 'end' });
          showModal('Edit End Date', 'Tap on the calendar to select a new end date.', [
            {
              text: 'Cancel',
              onPress: () => {
                setEditMode({ active: false, periodId: null, editingField: null });
              },
              style: 'cancel' as const,
            },
          ]);
        },
        style: 'default' as const,
        closeOnPress: false,
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
        style: 'destructive' as const,
      },
    ];

    showModal(
      'Manage Period',
      `Period: ${startDateObj.toLocaleDateString()} to ${endDateObj ? endDateObj.toLocaleDateString() : 'ongoing'}.`,
      manageButtons
    );
  };


  // Period management functions
  const handleStartPeriod = async () => {
    if (currentPeriod()) {
      showModal(
        'Period Active',
        'You already have an active period. Please stop it first.',
        [
          {
            text: 'OK',
            onPress: () => {},
            style: 'default' as const,
          },
        ]
      );
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
      showModal(
        'No Active Period',
        'There is no active period to stop.',
        [
          {
            text: 'OK',
            onPress: () => {},
            style: 'default',
          },
        ]
      );
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
        const currentEnd = periodToEdit.endDate ? parseDate(periodToEdit.endDate) : null;
        
        if (currentEnd && newDate > currentEnd) {
          showModal('Invalid Date', 'Start date cannot be after the end date.', [
            { text: 'OK', onPress: () => {}, style: 'default' }
          ]);
          return;
        }

        try {
          const response = await fetch('/api/periods', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: periodToEdit.id, startDate: dateString }),
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
        const currentStart = parseDate(periodToEdit.startDate);
        
        if (newDate < currentStart) {
          showModal('Invalid Date', 'End date cannot be before the start date.', [
            { text: 'OK', onPress: () => {}, style: 'default' }
          ]);
          return;
        }

        try {
          const response = await fetch('/api/periods', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: periodToEdit.id, endDate: dateString }),
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

    if (moodMode()) {
      setMoodMode(false);
      openMoodPicker(dateString);
      return;
    }

    // Check if this date is already part of an existing period
    const periodForDate = periodsData.find((period: Period) =>
      isDateInPeriod(dateString, period),
    );
    
    if (periodForDate) {
      const isOngoing = !periodForDate.endDate;

      const manageButtons: ModalConfig['buttons'] = [
        {
          text: 'Manage Period',
          onPress: () => openManagePeriodModal(periodForDate, isOngoing),
          style: 'default' as const,
          closeOnPress: false,
        },
        {
          text: 'Add Mood Marker',
          onPress: () => openMoodPicker(dateString),
          style: 'default' as const,
          closeOnPress: false,
        },
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel' as const,
        },
      ];

      showModal('Manage Day', 'Period day selected.', manageButtons);
      setMoodListForDate(dateString);
      return;
    }

    // Check if there's an active period
    const activePeriod = currentPeriod();

    if (activePeriod) {
      const startDate = parseDate(activePeriod.startDate);
      const clickedDate = parseDate(dateString);

      if (clickedDate < startDate) {
        showModal(
          'Manage Day',
          `Selected ${clickedDate.toLocaleDateString()}.`,
          [
            {
              text: 'Add Mood Marker',
              onPress: () => openMoodPicker(dateString),
              style: 'default' as const,
              closeOnPress: false,
            },
            {
              text: 'Cancel',
              onPress: () => {},
              style: 'cancel' as const,
            },
          ]
        );
        setMoodListForDate(dateString);
        return;
      }

      showModal(
        'Manage Day',
        `Selected ${clickedDate.toLocaleDateString()}.`,
        [
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
            style: 'destructive' as const,
          },
          {
            text: 'Add Mood Marker',
            onPress: () => openMoodPicker(dateString),
            style: 'default' as const,
            closeOnPress: false,
          },
          {
            text: 'Cancel',
            onPress: () => {},
            style: 'cancel' as const,
          },
        ]
      );
      setMoodListForDate(dateString);
    } else {
      // No active period, ask if they want to start one on this date
      const clickedDate = parseDate(dateString);
      showModal(
        'Manage Day',
        `Selected ${clickedDate.toLocaleDateString()}.`,
        [
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
            style: 'default' as const,
          },
          {
            text: 'Add Mood Marker',
            onPress: () => openMoodPicker(dateString),
            style: 'default' as const,
            closeOnPress: false,
          },
          {
            text: 'Cancel',
            onPress: () => {},
            style: 'cancel' as const,
          },
        ]
      );
      setMoodListForDate(dateString);
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
        const startDate = parseDate(periodToEdit.startDate);
        const endDate = parseDate(periodToEdit.endDate);

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
        const startDate = parseDate(period.startDate);
        const endDate = parseDate(period.endDate);

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
        const startDate = parseDate(period.startDate);
        const endDate = parseDate(estimatedEndDate);
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const today = formatDate(todayDate);

        // Mark all days from start to estimated end
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
        }
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
        endDate.setTime(parseDate(pred.predictedDate).getTime());
      } else {
        endDate.setDate(endDate.getDate() + 60);
      }

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateString = formatDate(d);

        if (markedDates[dateString]) continue;

        const phaseInfo = getCyclePhaseForDate(dateString, periodsData, averageCycleLength);
        if (phaseInfo && phaseInfo.phase !== 'menstrual') {
          const textColor = phaseInfo.phase === 'follicular' ? '#333' : 'white';
          const opacity = phaseInfo.isEstimated ? 0.5 : 1;

          markedDates[dateString] = {
            color: opacity < 1 ? hexToRgba(phaseInfo.color, opacity) : phaseInfo.color,
            textColor: textColor,
            startingDay: true,
            endingDay: true,
          };
        }
      }
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

  const renderPredictionCard = () => {
    const pred = prediction();
    
    if (pred.confidence === 'insufficient') {
      return (
        <div 
          class="rounded-lg shadow-md px-4 py-3 mx-5 mb-3 border-l-4"
          style={{
            "background-color": "var(--bg-primary)",
            "border": "1px solid var(--border-color)",
            "border-left-color": "var(--accent-color)"
          }}
        >
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold" style={{"color": "var(--text-primary)"}}>
              Next period
            </h3>
            <span class="text-xs italic" style={{"color": "var(--text-secondary)"}}>
              Add 2+ periods for predictions
            </span>
          </div>
        </div>
      );
    }

    const formatPredictionDate = (dateString: string) => {
      const date = parseDate(dateString);
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
      <div 
        class="rounded-lg shadow-md px-4 py-3 mx-5 mb-3 border-l-4"
        style={{
          "background-color": "var(--bg-primary)",
          "border": "1px solid var(--border-color)",
          "border-left-color": "var(--accent-color)"
        }}
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-xs uppercase tracking-wide" style={{"color": "var(--text-secondary)"}}>
              Next period
            </div>
            <div class="text-base font-bold" style={{"color": "var(--accent-color)"}}>
              {pred.predictedDate ? formatPredictionDate(pred.predictedDate) : 'Unknown'}
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm" style={{"color": "var(--text-secondary)"}}>
              {getDaysText()}
            </div>
            <div class="text-xs font-semibold" style={{ color: getConfidenceColor() }}>
              {pred.confidence}
            </div>
          </div>
        </div>
      </div>
    );
  };


  return (
    <main class="min-h-screen" style={{"background-color": "var(--bg-primary)"}}>
      <Title>Period Tracker</Title>
      
      <Header />

      <Show when={isClient() && periods.loading}>
        <div class="flex items-center justify-center py-8">
          <div class="text-center">
            <div 
              class="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-3"
              style={{"border-color": "var(--accent-color)"}}
            ></div>
            <p style={{"color": "var(--text-secondary)"}}>Loading...</p>
          </div>
        </div>
      </Show>

      <Show when={isClient() && periods.error}>
        <div 
          class="border rounded-lg p-3 mx-5 mt-3"
          style={{
            "background-color": "var(--bg-secondary)",
            "border-color": "var(--error-color)"
          }}
        >
          <p class="text-center" style={{"color": "var(--error-color)"}}>
            Failed to load periods: {periods.error?.message}
          </p>
        </div>
      </Show>

      <Show when={isClient() && !periods.loading && !periods.error}>
        {/* Responsive Layout Container */}
        <div class="lg:flex lg:gap-4 lg:max-w-7xl lg:mx-auto lg:px-6">
          {/* Main Content - Left Column on Desktop */}
          <div class="lg:flex-1 lg:max-w-2xl">
            {/* Prediction Card */}
            {renderPredictionCard()}

            {/* Calendar */}
            <div class="p-4">
              <Show when={editMode.active}>
                <div 
                  class="mb-3 p-3 rounded-lg shadow-md border flex items-center justify-between"
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
                    class="px-3 py-1.5 rounded-md font-medium transition-colors"
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
              <Show when={moodMode()}>
                <div
                  class="mb-3 p-3 rounded-lg shadow-md border flex items-center justify-between"
                  style={{
                    "background-color": "var(--bg-primary)",
                    "border-color": "var(--accent-color)",
                    "color": "var(--text-primary)"
                  }}
                >
                  <div class="font-semibold">
                    Select a day to add a mood marker
                  </div>
                  <button
                    onClick={() => setMoodMode(false)}
                    class="px-3 py-1.5 rounded-md font-medium transition-colors"
                    style={{
                      "background-color": "var(--bg-secondary)",
                      "color": "var(--text-primary)",
                      "border": "1px solid var(--border-color)"
                    }}
                    onmouseover={(e) => e.currentTarget.style.opacity = "0.8"}
                    onmouseout={(e) => e.currentTarget.style.opacity = "1"}
                  >
                    Cancel
                  </button>
                </div>
              </Show>
              <div class="calendar-container">
                <Calendar
                  markedDates={getMarkedDates()}
                  onDayPress={handleDatePress}
                  periods={periods()}
                  averageCycleLength={calculateAverageCycleLength(periods() || [])}
                  moodMarkers={moodMarkersByDate()}
                />
              </div>
            </div>

            {/* Cycle Phase Legend */}
            <CyclePhaseLegend />

            {/* Action Buttons */}
            <div class="p-4 pb-6">
              <div class="flex gap-2">
                <button
                  onClick={currentPeriod() ? handleStopPeriod : handleStartPeriod}
                  class="flex-1 px-5 py-3.5 rounded-lg font-bold text-base transition-colors"
                  style={{
                    "background-color": currentPeriod() ? "var(--error-color)" : "var(--success-color)",
                    "color": "white"
                  }}
                  onmouseover={(e) => {
                    const bgColor = currentPeriod() ? "#dc2626" : "#059669";
                    e.currentTarget.style.backgroundColor = bgColor;
                  }}
                  onmouseout={(e) => {
                    e.currentTarget.style.backgroundColor = currentPeriod() ? "var(--error-color)" : "var(--success-color)";
                  }}
                >
                  {currentPeriod() ? 'Stop Period' : 'Start Period'}
                </button>
                <button
                  onClick={() => setMoodMode((prev) => !prev)}
                  class="flex-1 px-4 py-3.5 rounded-lg font-semibold transition-colors"
                  style={{
                    "background-color": moodMode() ? "var(--error-color)" : "var(--button-bg)",
                    "color": moodMode() ? "white" : "var(--button-text)"
                  }}
                  onmouseover={(e) => e.currentTarget.style.opacity = "0.85"}
                  onmouseout={(e) => e.currentTarget.style.opacity = "1"}
                >
                  {moodMode() ? 'Cancel Mood Marker' : 'Add Mood Marker'}
                </button>
              </div>
            </div>
          </div>

          {/* Desktop Stats Sidebar - Right Column */}
          <div class="hidden lg:block lg:w-80 lg:flex-shrink-0">
            <div class="sticky top-24 p-4">
              <div 
                class="rounded-lg border p-4"
                style={{
                  "background-color": "var(--bg-primary)",
                  "border-color": "var(--border-color)"
                }}
              >
                <StatsWidget 
                  periods={periods() || []} 
                  compact={true}
                  showViewAllLink={true}
                />
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Modal */}
      <Modal
        visible={modalVisible()}
        title={modalTitle()}
        message={modalMessage()}
        buttons={modalButtons()}
        sections={modalSections()}
        listTitle={modalListTitle()}
        listItems={modalListItems()}
        listEmptyText={modalListEmptyText()}
        onListItemRemove={modalListRemoveHandler()}
        onClose={() => setModalVisible(false)}
      />
    </main>
  );
}
