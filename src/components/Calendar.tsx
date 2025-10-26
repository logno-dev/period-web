import { createSignal, createMemo, For } from "solid-js";
import { formatDate } from "../utils/periodUtils";

interface CalendarMarkedDate {
  color: string;
  textColor: string;
  startingDay: boolean;
  endingDay: boolean;
}

interface DayInfo {
  date: Date | null;
  marking?: CalendarMarkedDate;
  pillStart?: boolean;
  pillEnd?: boolean;
  pillMiddle?: boolean;
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

  // Function to identify consecutive groups and assign pill positions
  const processedDays = createMemo(() => {
    const { days } = monthData();
    const processed: DayInfo[] = [];
    
    // Convert days to DayInfo objects with markings
    days.forEach((date) => {
      const marking = date ? props.markedDates?.[formatDate(date)] : undefined;
      processed.push({
        date,
        marking,
        pillStart: false,
        pillEnd: false,
        pillMiddle: false
      });
    });
    
    // Group consecutive marked days by color
    const groups: { [color: string]: number[][] } = {};
    
    processed.forEach((dayInfo, index) => {
      if (dayInfo.marking) {
        const color = dayInfo.marking.color;
        if (!groups[color]) groups[color] = [];
        
        // Check if this continues the last group
        const lastGroup = groups[color][groups[color].length - 1];
        if (lastGroup && lastGroup[lastGroup.length - 1] === index - 1) {
          lastGroup.push(index);
        } else {
          groups[color].push([index]);
        }
      }
    });
    
    // Apply pill styling based on groups
    Object.values(groups).forEach((colorGroups) => {
      colorGroups.forEach((group) => {
        if (group.length === 1) {
          // Single day - full rounded
          processed[group[0]].pillStart = true;
          processed[group[0]].pillEnd = true;
        } else {
          // Multi-day group
          processed[group[0]].pillStart = true;
          processed[group[group.length - 1]].pillEnd = true;
          for (let i = 1; i < group.length - 1; i++) {
            processed[group[i]].pillMiddle = true;
          }
        }
      });
    });
    
    return processed;
  });

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
        <For each={processedDays()}>
          {(dayInfo) => {
            const { date, marking, pillStart, pillEnd, pillMiddle } = dayInfo;
            
            return (
              <div class="aspect-square relative">
                {date ? (
                  <button
                    onClick={() => props.onDayPress?.(formatDate(date))}
                    class="absolute inset-0 flex items-center justify-center text-sm font-medium transition-colors"
                    style={{
                      'background-color': marking ? marking.color : 'transparent',
                      'color': (() => {
                        if (marking) {
                          return marking.textColor;
                        }
                        return isToday(date) ? "var(--accent-color)" : "var(--text-primary)";
                      })(),
                      'border-radius': (() => {
                        if (!marking) return '0';
                        if (pillStart && pillEnd) {
                          return '50%'; // Single day
                        } else if (pillStart) {
                          return '50% 0 0 50%'; // Start of group
                        } else if (pillEnd) {
                          return '0 50% 50% 0'; // End of group
                        }
                        return '0'; // Middle of group
                      })(),
                      "font-weight": isToday(date) ? "bold" : "500"
                    }}
                    onmouseover={(e) => {
                      if (!marking) {
                        e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                      }
                    }}
                    onmouseout={(e) => {
                      if (!marking) {
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
            );
          }}
        </For>
      </div>
    </div>
  );
}