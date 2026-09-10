import React, { useState, useEffect } from 'react';
import { 
  Zap, Building2, Activity, Bot, User, Menu, X, 
  Wifi, WifiOff, ShieldCheck, Shield 
} from 'lucide-react';
import { User as SystemUser } from '../types';
import { VibrationService } from '../services/vibrationService';

interface NavbarProps {
  currentUser: SystemUser | null;
  onSelectUser?: (user: SystemUser | null) => void;
  phiMasked?: boolean;
  onTogglePhiMasked?: () => void;
  isOfflineMode: boolean;
  onToggleOfflineMode: () => void;
  activeView: string;
  onSelectView: (view: string) => void;
  pendingEmergencyCount: number;
  onOpenQuickLogin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  isOfflineMode,
  onToggleOfflineMode,
  activeView,
  onSelectView,
  pendingEmergencyCount,
  onOpenQuickLogin,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNav = (view: string) => {
    VibrationService.triggerQuickTap();
    onSelectView(view);
    setMobileMenuOpen(false);
  };

  const navItems = [
    {
      id: 'fast_admit',
      label: 'Emergency SOS',
      icon: Zap,
      activeColor: 'bg-rose-50 text-rose-700 border-rose-200/80 font-semibold',
      iconColor: 'text-rose-600',
    },
    {
      id: 'hospitals',
      label: 'Hospitals & Beds',
      icon: Building2,
      activeColor: 'bg-sky-50 text-sky-800 border-sky-200/80 font-semibold',
      iconColor: 'text-sky-600',
    },
    {
      id: 'fall_guard',
      label: 'Fall Guard',
      icon: Shield,
      activeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 font-semibold',
      iconColor: 'text-emerald-600',
    },
    {
      id: 'dashboard',
      label: 'ER Triage Board',
      icon: Activity,
      activeColor: 'bg-slate-100 text-slate-900 border-slate-300 font-semibold',
      iconColor: 'text-slate-800',
      badge: pendingEmergencyCount > 0 ? pendingEmergencyCount : undefined,
    },
    {
      id: 'ai_chatbot',
      label: 'AI Assistant',
      icon: Bot,
      activeColor: 'bg-slate-100 text-slate-900 border-slate-300 font-semibold',
      iconColor: 'text-sky-600',
    },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 text-slate-800 shadow-xs" id="app-main-navbar">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          
          {/* Brand Logo & Title */}
          <div 
            onClick={() => handleNav('fast_admit')}
            className="flex items-center space-x-2.5 cursor-pointer select-none group"
            id="navbar-brand"
          >
            <div className="w-7 h-7 bg-rose-600 rounded-lg flex items-center justify-center font-bold text-xs text-white shadow-xs group-hover:bg-rose-700 transition-colors">
              108
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-sm font-bold tracking-tight text-slate-900">
                Arambh Health
              </span>
              <span className="hidden sm:inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200/60">
                SOS
              </span>
            </div>
          </div>

          {/* Desktop Central Tabs - Clean & Sleek */}
          <nav className="hidden md:flex items-center space-x-1" id="navbar-desktop-tabs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => handleNav(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all flex items-center space-x-1.5 border cursor-pointer ${
                    isActive 
                      ? item.activeColor 
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? item.iconColor : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-600 text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Utilities: Offline Status + Staff Portal */}
          <div className="flex items-center space-x-2">
            
            {/* Live / Offline mode pill */}
            <button
              onClick={() => {
                VibrationService.triggerQuickTap();
                onToggleOfflineMode();
              }}
              title={isOfflineMode ? 'Switch to Online mode' : 'Simulate Offline 2G/Mesh mode'}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 border transition-colors cursor-pointer ${
                isOfflineMode 
                  ? 'bg-amber-50 border-amber-300 text-amber-800' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              {isOfflineMode ? (
                <WifiOff className="w-3 h-3 text-amber-600" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              )}
              <span className="hidden sm:inline text-[11px]">
                {isOfflineMode ? 'Offline' : 'Live'}
              </span>
            </button>

            {/* Staff Portal / User Profile */}
            {onOpenQuickLogin && (
              <button
                onClick={() => {
                  VibrationService.triggerQuickTap();
                  onOpenQuickLogin();
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 text-xs font-medium border border-slate-200/80 flex items-center space-x-1.5 cursor-pointer transition-colors"
                title="Staff login / Role switcher"
              >
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">
                  {currentUser ? currentUser.name.split(' ')[0] : 'Portal'}
                </span>
              </button>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-100 space-y-1 text-xs" id="navbar-mobile-menu">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between cursor-pointer ${
                    isActive 
                      ? `${item.activeColor} border` 
                      : 'text-slate-700 hover:bg-slate-100 font-medium'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? item.iconColor : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-600 text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {onOpenQuickLogin && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenQuickLogin();
                }}
                className="w-full text-left px-3 py-2.5 rounded-lg flex items-center space-x-2.5 text-slate-700 hover:bg-slate-100 font-medium border-t border-slate-100 mt-1 pt-2 cursor-pointer"
              >
                <User className="w-4 h-4 text-slate-500" />
                <span>Clinical Staff Portal ({currentUser?.role || 'Guest'})</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
