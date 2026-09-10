import React from 'react';
import { Zap, Building2, Activity, Bot, Shield } from 'lucide-react';
import { VibrationService } from '../services/vibrationService';

interface MobileBottomNavProps {
  activeView: string;
  onSelectView: (view: string) => void;
  pendingEmergencyCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onSelectView,
  pendingEmergencyCount = 0,
}) => {
  const handleNav = (view: string) => {
    VibrationService.triggerQuickTap();
    onSelectView(view);
  };

  const navItems = [
    {
      id: 'fast_admit',
      label: 'SOS 108',
      icon: Zap,
      activeColor: 'text-rose-600 font-bold',
      iconClass: 'fill-rose-600 text-rose-600',
    },
    {
      id: 'hospitals',
      label: 'Hospitals',
      icon: Building2,
      activeColor: 'text-sky-700 font-bold',
      iconClass: 'text-sky-600',
    },
    {
      id: 'fall_guard',
      label: 'Fall Guard',
      icon: Shield,
      activeColor: 'text-emerald-700 font-bold',
      iconClass: 'text-emerald-600',
    },
    {
      id: 'dashboard',
      label: 'ER Board',
      icon: Activity,
      activeColor: 'text-slate-900 font-bold',
      iconClass: 'text-slate-900',
      badge: pendingEmergencyCount > 0 ? pendingEmergencyCount : undefined,
    },
    {
      id: 'ai_chatbot',
      label: 'AI Helper',
      icon: Bot,
      activeColor: 'text-sky-600 font-bold',
      iconClass: 'text-sky-600',
    },
  ];

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 select-none pb-safe"
      id="mobile-bottom-navigation"
    >
      <div className="grid grid-cols-5 h-14 items-center px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              className={`flex flex-col items-center justify-center h-full w-full relative transition-colors cursor-pointer ${
                isActive ? item.activeColor : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-4 h-4 ${isActive ? item.iconClass : ''}`} />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white text-[8px] font-bold px-1 rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
