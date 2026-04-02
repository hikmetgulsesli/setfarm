import { useState } from 'react';

interface BottomNavBarProps {
  activeItem?: string;
}

export function BottomNavBar({ activeItem = 'Takvim' }: BottomNavBarProps) {
  const [active, setActive] = useState<string>(activeItem);

  const navItems = [
    { id: 'Takvim', icon: 'calendar_today', label: 'Takvim' },
    { id: 'Görevler', icon: 'format_list_bulleted', label: 'Görevler' },
    { id: 'Ayarlar', icon: 'settings', label: 'Ayarlar' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-6 pb-8 pt-4 bg-surface-container/80 backdrop-blur-xl md:hidden rounded-t-3xl shadow-2xl shadow-black">
      {navItems.slice(0, 1).map((item) => (
        <a
          key={item.id}
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setActive(item.id);
          }}
          className={`flex flex-col items-center transition-opacity ${
            active === item.id
              ? 'text-primary font-bold scale-110'
              : 'text-on-surface opacity-40 hover:opacity-100'
          }`}
        >
          <span className="material-symbols-outlined">{item.icon}</span>
          <span className="text-[10px] uppercase tracking-widest mt-1">{item.label}</span>
        </a>
      ))}
      
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setActive('Görevler');
        }}
        className={`flex flex-col items-center transition-opacity ${
          active === 'Görevler'
            ? 'text-primary font-bold scale-110'
            : 'text-on-surface opacity-40 hover:opacity-100'
        }`}
      >
        <span className="material-symbols-outlined">format_list_bulleted</span>
        <span className="text-[10px] uppercase tracking-widest mt-1">Görevler</span>
      </a>
      
      <button className="bg-primary text-on-primary w-12 h-12 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all">
        <span className="material-symbols-outlined">add</span>
      </button>
      
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setActive('Ayarlar');
        }}
        className={`flex flex-col items-center transition-opacity ${
          active === 'Ayarlar'
            ? 'text-primary font-bold scale-110'
            : 'text-on-surface opacity-40 hover:opacity-100'
        }`}
      >
        <span className="material-symbols-outlined">settings</span>
        <span className="text-[10px] uppercase tracking-widest mt-1">Ayarlar</span>
      </a>
    </nav>
  );
}
