import { useState } from 'react';

interface SideNavBarProps {
  activeItem?: string;
}

export function SideNavBar({ activeItem = 'Takvim' }: SideNavBarProps) {
  const [active, setActive] = useState<string>(activeItem);

  const navItems = [
    { id: 'Takvim', icon: 'calendar_month', label: 'Takvim' },
    { id: 'Görevler', icon: 'check_circle', label: 'Görevler' },
    { id: 'İstatistikler', icon: 'leaderboard', label: 'İstatistikler' },
    { id: 'Ayarlar', icon: 'settings', label: 'Ayarlar' },
  ];

  return (
    <aside className="hidden md:flex flex-col h-full py-8 px-4 gap-4 bg-surface-container-low fixed left-0 top-0 w-64 z-20 transition-all duration-300 ease-in-out">
      <div className="flex items-center gap-3 px-2 mb-8">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-highest flex items-center justify-center">
          <span className="material-symbols-outlined text-on-surface">person</span>
        </div>
        <div>
          <p className="text-sm font-semibold tracking-wide text-on-surface">Kullanıcı</p>
          <p className="text-xs text-on-surface-variant opacity-60">Premium Plan</p>
        </div>
      </div>
      
      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map((item) => (
          <a
            key={item.id}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setActive(item.id);
            }}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              active === item.id
                ? 'bg-surface-container-highest text-primary'
                : 'text-on-surface opacity-50 hover:bg-surface-container hover:opacity-100'
            }`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="text-sm font-semibold tracking-wide">{item.label}</span>
          </a>
        ))}
      </nav>
      
      <button className="mt-auto w-full py-3 px-4 rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2">
        <span className="material-symbols-outlined text-sm">add</span>
        Etkinlik Ekle
      </button>
    </aside>
  );
}
