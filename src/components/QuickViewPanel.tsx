interface Event {
  time: string;
  title: string;
  location: string;
  type: 'primary' | 'tertiary';
}

interface QuickViewPanelProps {
  events?: Event[];
}

export function QuickViewPanel({ events }: QuickViewPanelProps) {
  const defaultEvents: Event[] = [
    {
      time: '09:00 - 10:30',
      title: 'Tasarım Gözden Geçirme',
      location: 'Toplantı Odası B',
      type: 'primary',
    },
    {
      time: '13:00 - 14:00',
      title: 'Ekip Öğle Yemeği',
      location: 'Lobi',
      type: 'tertiary',
    },
  ];

  const displayEvents = events || defaultEvents;

  return (
    <div className="hidden xl:block fixed right-8 top-32 w-72 h-auto z-10 pointer-events-none">
      <div className="bg-surface-container/40 backdrop-blur-2xl p-6 rounded-3xl border border-outline-variant/10 shadow-2xl pointer-events-auto">
        <h3 className="font-headline font-bold text-lg mb-4 text-on-surface">Bugün Ne Var?</h3>
        
        <div className="space-y-4">
          {displayEvents.map((event, index) => (
            <div key={index} className="flex gap-4 items-start group cursor-pointer">
              <div className={`w-1 h-12 rounded-full ${
                event.type === 'primary' ? 'bg-primary' : 'bg-tertiary'
              }`} />
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wider ${
                  event.type === 'primary' ? 'text-primary' : 'text-tertiary'
                }`}>
                  {event.time}
                </p>
                <p className="text-sm font-medium text-on-surface">{event.title}</p>
                <p className="text-xs text-on-surface-variant">{event.location}</p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8 rounded-2xl overflow-hidden aspect-video relative group bg-surface-container-high">
          <div className="absolute inset-0 bg-gradient-to-t from-surface-dim to-transparent opacity-60" />
          <div className="absolute bottom-3 left-3">
            <p className="text-[10px] font-bold text-primary tracking-widest uppercase">Konum</p>
            <p className="text-xs text-on-surface">Beşiktaş, İstanbul</p>
          </div>
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">location_on</span>
          </div>
        </div>
      </div>
    </div>
  );
}
