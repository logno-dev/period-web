import { createSignal, createMemo, For } from "solid-js";
import { formatDate } from "../utils/periodUtils";

interface CalendarMarkedDate {
  color: string;
  textColor: string;
  startingDay: boolean;
  endingDay: boolean;
}

interface CalendarProps {
  markedDates?: Record<string, CalendarMarkedDate>;
  onDayPress?: (dateString: string) => void;
}

export default function Calendar(props: CalendarProps) {
  const [currentDate, setCurrentDate] = createSignal(new Date());

  const monthData = createMemo(() => {
    const date = currentDate();
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // Get first day of the month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get the day of the week for the first day (0 = Sunday, 1 = Monday, etc.)
    // We want Monday to be first, so adjust
    const startDay = (firstDay.getDay() + 6) % 7; // Monday = 0
    
    // Create array of days
    const days: (Date | null)[] = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }
    
    return {
      year,
      month,
      days,
      monthName: firstDay.toLocaleDateString('en-US', { month: 'long' })
    };
  });

  const navigateMonth = (direction: 'prev' | 'next') => {
    const current = currentDate();
    const newDate = new Date(current);
    if (direction === 'prev') {
      newDate.setMonth(current.getMonth() - 1);
    } else {
      newDate.setMonth(current.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const getDayStyle = (date: Date | null) => {
    if (!date) return {};
    
    const dateString = formatDate(date);
    const marking = props.markedDates?.[dateString];
    
    if (!marking) return {};
    
    let borderRadius = '0';
    if (marking.startingDay && marking.endingDay) {
      borderRadius = '50%';
    } else if (marking.startingDay) {
      borderRadius = '20px 0 0 20px';
    } else if (marking.endingDay) {
      borderRadius = '0 20px 20px 0';
    }
    
    return {
      'background-color': marking.color,
      'color': marking.textColor,
      'border-radius': borderRadius,
    };
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div 
      class="rounded-lg shadow-md overflow-hidden border"
      style={{
        "background-color": "var(--bg-primary)",
        "border-color": "var(--border-color)"
      }}
    >
      {/* Header */}
      <div 
        class="flex items-center justify-between p-4"
        style={{
          "background-color": "var(--accent-color)",
          "color": "white"
        }}
      >
        <button
          onClick={() => navigateMonth('prev')}
          class="p-2 rounded transition-colors"
          style={{"background-color": "transparent"}}
          onmouseover={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)"}
          onmouseout={(e) => e.currentTarget.style.backgroundColor = "transparent"}
        >
          ←
        </button>
        <h2 class="text-lg font-bold">
          {monthData().monthName} {monthData().year}
        </h2>
        <button
          onClick={() => navigateMonth('next')}
          class="p-2 rounded transition-colors"
          style={{"background-color": "transparent"}}
          onmouseover={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)"}
          onmouseout={(e) => e.currentTarget.style.backgroundColor = "transparent"}
        >
          →
        </button>
      </div>

      {/* Day headers */}
      <div 
        class="grid grid-cols-7"
        style={{"background-color": "var(--bg-secondary)"}}
      >
        <For each={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}>
          {(day) => (
            <div 
              class="p-2 text-center text-sm font-medium"
              style={{"color": "var(--text-secondary)"}}
            >
              {day}
            </div>
          )}
        </For>
      </div>

      {/* Calendar grid */}
      <div class="grid grid-cols-7">
        <For each={monthData().days}>
          {(date) => (
            <div class="aspect-square p-1">
              {date ? (
                <button
                  onClick={() => props.onDayPress?.(formatDate(date))}
                  class="w-full h-full flex items-center justify-center text-sm font-medium transition-colors"
                  style={{
                    ...getDayStyle(date),
                    "color": (() => {
                      const dayStyle = getDayStyle(date);
                      // If this date has a colored background (highlighted), keep text white for contrast
                      if (dayStyle['background-color'] && dayStyle['background-color'] !== 'transparent') {
                        return 'white';
                      }
                      // Otherwise use theme colors
                      return isToday(date) ? "var(--accent-color)" : "var(--text-primary)";
                    })(),
                    "font-weight": isToday(date) ? "bold" : "500"
                  }}
                  onmouseover={(e) => {
                    const dayStyle = getDayStyle(date);
                    if (!dayStyle['background-color'] || dayStyle['background-color'] === 'transparent') {
                      e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                    }
                  }}
                  onmouseout={(e) => {
                    const dayStyle = getDayStyle(date);
                    if (!dayStyle['background-color'] || dayStyle['background-color'] === 'transparent') {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  {date.getDate()}
                </button>
              ) : (
                <div class="w-full h-full"></div>
              )}
            </div>
          )}
        </For>
      </div>
    </div>
  );
}