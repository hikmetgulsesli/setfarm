import { useState } from 'react';

interface DayCell {
  date: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: { type: 'primary' | 'tertiary' | 'error' }[];
}

export function CalendarGrid() {
  const [days] = useState<DayCell[]>(() => {
    // Generate calendar days for June 2026
    const daysArray: DayCell[] = [];
    
    // Previous month days (May 2026)
    for (let i = 27; i <= 31; i++) {
      daysArray.push({ date: i, isCurrentMonth: false, isToday: false, events: [] });
    }
    
    // Current month days (June 2026)
    const today = 11; // Assuming today is the 11th
    const eventDays: Record<number, { type: 'primary' | 'tertiary' | 'error' }[]> = {
      1: [{ type: 'primary' }],
      3: [{ type: 'tertiary' }, { type: 'primary' }],
      6: [{ type: 'error' }],
      11: [{ type: 'primary' }, { type: 'primary' }],
      14: [{ type: 'tertiary' }],
      18: [{ type: 'primary' }, { type: 'primary' }, { type: 'primary' }],
      25: [{ type: 'tertiary' }],
      28: [{ type: 'primary' }],
    };
    
    for (let i = 1; i <= 30; i++) {
      daysArray.push({
        date: i,
        isCurrentMonth: true,
        isToday: i === today,
        events: eventDays[i] || [],
      });
    }
    
    return daysArray;
  });

  const weekdays = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

  return (
    <section className="flex-1 px-8 pb-32 md:pb-8 overflow-y-auto">
      {/* Weekdays Header */}
      <div className="grid grid-cols-7 mb-4">
        {weekdays.map((day, index) => (
          <div 
            key={day}
            className={`text-center py-2 text-[10px] uppercase tracking-widest font-medium ${
              index >= 5 ? 'text-tertiary' : 'text-on-surface-variant'
            }`}
          >
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-[2px] bg-outline-variant bg-opacity-10 rounded-2xl overflow-hidden min-h-[600px]">
        {days.map((day, index) => (
          <div
            key={index}
            className={`p-4 min-h-[120px] transition-colors group relative cursor-pointer ${
              day.isCurrentMonth
                ? day.isToday
                  ? 'bg-surface-container-high border-t-2 border-primary'
                  : 'bg-surface-container hover:bg-surface-container-high'
                : 'bg-surface-container-lowest opacity-20'
            }`}
          >
            {day.isToday ? (
              <>
                <div className="absolute top-2 right-2 bg-primary text-on-primary w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold">
                  {day.date}
                </div>
                <span className="text-sm font-body font-bold text-primary">{day.date}</span>
                <p className="mt-4 text-[10px] font-medium text-primary opacity-80 uppercase tracking-tighter">Bugün</p>
              </>
            ) : (
              <span className="text-sm font-body font-medium">{day.date}</span>
            )}
            
            {day.events.length > 0 && (
              <div className="mt-2 flex gap-1 flex-wrap">
                {day.events.map((event, eventIndex) => (
                  <div
                    key={eventIndex}
                    className={`w-1.5 h-1.5 rounded-full ${
                      event.type === 'primary'
                        ? 'bg-primary'
                        : event.type === 'tertiary'
                        ? 'bg-tertiary'
                        : 'bg-error'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
