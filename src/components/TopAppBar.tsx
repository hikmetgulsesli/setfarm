interface TopAppBarProps {
  month: string;
  year: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

export function TopAppBar({ month, year, onPrevMonth, onNextMonth, onToday }: TopAppBarProps) {
  return (
    <header className="flex justify-between items-center w-full px-8 py-6 bg-surface z-10 sticky top-0">
      <div className="flex items-center gap-8">
        <h1 className="text-4xl font-bold tracking-tight font-headline text-primary">{month}</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={onPrevMonth}
            className="p-2 hover:bg-surface-container text-on-surface-variant transition-colors duration-200 active:scale-95 rounded-full"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <button 
            onClick={onNextMonth}
            className="p-2 hover:bg-surface-container text-on-surface-variant transition-colors duration-200 active:scale-95 rounded-full"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={onToday}
          className="px-5 py-2 text-sm font-medium font-body text-primary hover:bg-surface-container transition-all rounded-lg active:scale-95"
        >
          Bugün
        </button>
        <button className="md:hidden p-3 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full shadow-lg">
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>
    </header>
  );
}
