import { useState } from 'react';
import { SideNavBar } from './components/SideNavBar';
import { TopAppBar } from './components/TopAppBar';
import { CalendarGrid } from './components/CalendarGrid';
import { BottomNavBar } from './components/BottomNavBar';
import { QuickViewPanel } from './components/QuickViewPanel';

function App() {
  const [currentMonth, setCurrentMonth] = useState<string>('Haziran');
  const [currentYear, setCurrentYear] = useState<number>(2026);

  const handlePrevMonth = () => {
    // Simple month navigation logic
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const currentIndex = months.indexOf(currentMonth);
    if (currentIndex > 0) {
      setCurrentMonth(months[currentIndex - 1]);
    } else {
      setCurrentMonth('Aralık');
      setCurrentYear(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const currentIndex = months.indexOf(currentMonth);
    if (currentIndex < 11) {
      setCurrentMonth(months[currentIndex + 1]);
    } else {
      setCurrentMonth('Ocak');
      setCurrentYear(prev => prev + 1);
    }
  };

  const handleToday = () => {
    setCurrentMonth('Haziran');
    setCurrentYear(2026);
  };

  return (
    <div className="bg-surface-dim overflow-hidden h-screen flex">
      <SideNavBar />
      <main className="flex-1 md:ml-64 flex flex-col h-full bg-surface-dim relative">
        <TopAppBar 
          month={currentMonth}
          year={currentYear}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onToday={handleToday}
        />
        <CalendarGrid />
        <BottomNavBar />
      </main>
      <QuickViewPanel />
    </div>
  );
}

export default App;
