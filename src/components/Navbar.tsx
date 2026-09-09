import React, { useState } from 'react';
import { 
  Zap, Building2, ShieldAlert, Bot, Stethoscope, ChevronDown, User, Menu, X, Smartphone, MessageSquare
} from 'lucide-react';
import { User as SystemUser, UserRole } from '../types';
import { VibrationService } from '../services/vibrationService';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  currentUser: SystemUser | null;
  onSelectUser: (user: SystemUser | null) => void;
  phiMasked: boolean;
  onTogglePhiMasked: () => void;
  isOfflineMode: boolean;
  onToggleOfflineMode: () => void;
  activeView: string;
  onSelectView: (view: string) => void;
  pendingEmergencyCount: number;
  onOpenDatabaseCacheModal?: () => void;
  onOpenQuickLogin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onSelectUser,
  phiMasked,
  onTogglePhiMasked,
  isOfflineMode,
  onToggleOfflineMode,
  activeView,
  onSelectView,
  pendingEmergencyCount,
  onOpenDatabaseCacheModal,
  onOpenQuickLogin,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [staffDropdownOpen, setStaffDropdownOpen] = useState<boolean>(false);

  const isStaffView = ['dashboard', 'case_taking', 'registration', 'timeline', 'followup', 'audit', 'users'].includes(activeView);

  const handleSelectNav = (view: string) => {
    VibrationService.triggerQuickTap();
    onSelectView(view);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/90 text-slate-800 shadow-xs">
      <div className="w-full px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Brand Logo & Name - Clean Minimalist Clinical */}
          <div 
            className="flex items-center space-x-2.5 cursor-pointer select-none" 
            onClick={() => handleSelectNav('fast_admit')}
            id="brand-header-logo"
          >
            <div className="w-8 h-8 bg-sky-600 rounded-lg flex items-center justify-center font-bold text-xs text-white shadow-xs">
              108
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                  Arambh Health
                </span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200/80">
                  Fast Admit
                </span>
              </div>
              <p className="text-[10px] text-slate-500 tracking-normal leading-none font-medium">
                Zero-Delay Emergency Care
              </p>
            </div>
          </div>

          {/* MINIMAL & EFFICIENT DESKTOP NAVIGATION */}
          <nav className="hidden lg:flex items-center space-x-1" id="main-desktop-nav">
            {/* 1. FAST ADMIT */}
            <button
              id="nav-btn-fast-admit"
              onClick={() => handleSelectNav('fast_admit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeView === 'fast_admit' 
                  ? 'bg-rose-50 text-rose-800 font-semibold border border-rose-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${activeView === 'fast_admit' ? 'text-rose-600 fill-rose-600' : 'text-rose-500'}`} />
              <span>Emergency Admit</span>
            </button>

            {/* 2. NEAREST HOSPITALS */}
            <button
              id="nav-btn-hospitals"
              onClick={() => handleSelectNav('hospitals')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeView === 'hospitals' 
                  ? 'bg-sky-50 text-sky-900 font-semibold border border-sky-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <Building2 className={`w-3.5 h-3.5 ${activeView === 'hospitals' ? 'text-sky-600' : 'text-slate-400'}`} />
              <span>Hospitals & Beds</span>
            </button>

            {/* 3. FALL & MOTION GUARD */}
            <button
              id="nav-btn-fall-guard"
              onClick={() => handleSelectNav('fall_guard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeView === 'fall_guard' 
                  ? 'bg-sky-50 text-sky-900 font-semibold border border-sky-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <ShieldAlert className={`w-3.5 h-3.5 ${activeView === 'fall_guard' ? 'text-sky-600' : 'text-slate-400'}`} />
              <span>Fall Guard</span>
            </button>

            {/* 4. RECEPTIONIST AGENT */}
            <button
              id="nav-btn-receptionist"
              onClick={() => handleSelectNav('receptionist')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeView === 'receptionist' 
                  ? 'bg-sky-50 text-sky-900 font-semibold border border-sky-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <Bot className={`w-3.5 h-3.5 ${activeView === 'receptionist' ? 'text-sky-600' : 'text-slate-400'}`} />
              <span>Virtual Receptionist</span>
            </button>

            {/* 5. SIH SHOWCASE & OFFLINE SMS PROTOCOL */}
            <button
              id="nav-btn-sih-showcase"
              onClick={() => handleSelectNav('sih_showcase')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeView === 'sih_showcase' 
                  ? 'bg-slate-900 text-white font-semibold' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-slate-200'
              }`}
            >
              <MessageSquare className={`w-3.5 h-3.5 ${activeView === 'sih_showcase' ? 'text-white' : 'text-sky-600'}`} />
              <span>Offline SMS (108)</span>
            </button>

            {/* 6. CLINICAL DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => setStaffDropdownOpen(!staffDropdownOpen)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1 cursor-pointer border ${
                  isStaffView
                    ? 'bg-slate-100 border-slate-300 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border-transparent'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5 text-slate-500" />
                <span>Clinical Staff</span>
                {pendingEmergencyCount > 0 && (
                  <span className="bg-rose-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center ml-0.5">
                    {pendingEmergencyCount}
                  </span>
                )}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {staffDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 space-y-1 z-50">
                  <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider px-2 py-1">
                    Staff Clinical Views
                  </div>
                  <button
                    onClick={() => { handleSelectNav('dashboard'); setStaffDropdownOpen(false); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-between"
                  >
                    <span>ER Triage Board</span>
                    {pendingEmergencyCount > 0 && (
                      <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                        {pendingEmergencyCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => { handleSelectNav('case_taking'); setStaffDropdownOpen(false); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  >
                    Doctor Case Form
                  </button>
                  <button
                    onClick={() => { handleSelectNav('registration'); setStaffDropdownOpen(false); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  >
                    Patient Admission
                  </button>
                  <button
                    onClick={() => { handleSelectNav('timeline'); setStaffDropdownOpen(false); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  >
                    Patient Timeline
                  </button>
                  <button
                    onClick={() => { handleSelectNav('audit'); setStaffDropdownOpen(false); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  >
                    HIPAA Audit Logs
                  </button>
                  <button
                    onClick={() => { handleSelectNav('bluetooth_hopping'); setStaffDropdownOpen(false); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  >
                    BLE Mesh Network
                  </button>
                </div>
              )}
            </div>
          </nav>

          {/* RIGHT UTILITIES */}
          <div className="flex items-center space-x-2">
            <PWAInstallButton 
              variant="compact" 
              onOpenApkGuide={() => handleSelectNav('sih_showcase')} 
            />

            {onOpenQuickLogin && (
              <button
                onClick={() => {
                  VibrationService.triggerQuickTap();
                  onOpenQuickLogin();
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200/80 flex items-center space-x-1.5 cursor-pointer transition-colors"
                title="Login"
              >
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Portal</span>
              </button>
            )}

            {/* Offline Mesh Badge */}
            <button
              onClick={() => {
                VibrationService.triggerQuickTap();
                onToggleOfflineMode();
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 border cursor-pointer transition-colors ${
                isOfflineMode 
                  ? 'bg-amber-50 border-amber-300 text-amber-800' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isOfflineMode ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
              <span className="hidden sm:inline text-[11px]">{isOfflineMode ? 'Offline Mode' : 'Online'}</span>
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* MOBILE MENU */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-slate-200 space-y-1.5 text-xs">
            <button
              onClick={() => handleSelectNav('fast_admit')}
              className={`w-full text-left p-2.5 rounded-lg font-semibold flex items-center space-x-2 ${
                activeView === 'fast_admit' ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-rose-600" />
              <span>Emergency Fast Admit</span>
            </button>

            <button
              onClick={() => handleSelectNav('sih_showcase')}
              className={`w-full text-left p-2.5 rounded-lg flex items-center space-x-2 border border-slate-200 ${
                activeView === 'sih_showcase' ? 'bg-slate-900 text-white font-semibold' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
              <span>Offline SMS (108) & APK</span>
            </button>

            <button
              onClick={() => handleSelectNav('hospitals')}
              className={`w-full text-left p-2.5 rounded-lg flex items-center space-x-2 ${
                activeView === 'hospitals' ? 'bg-sky-50 text-sky-900 font-semibold border border-sky-200' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-sky-600" />
              <span>Nearest Hospitals & Vacancy</span>
            </button>

            <button
              onClick={() => handleSelectNav('fall_guard')}
              className={`w-full text-left p-2.5 rounded-lg flex items-center space-x-2 ${
                activeView === 'fall_guard' ? 'bg-sky-50 text-sky-900 font-semibold border border-sky-200' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-sky-600" />
              <span>Fall Guard & Sensors</span>
            </button>

            <button
              onClick={() => handleSelectNav('receptionist')}
              className={`w-full text-left p-2.5 rounded-lg flex items-center space-x-2 ${
                activeView === 'receptionist' ? 'bg-sky-50 text-sky-900 font-semibold border border-sky-200' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-sky-600" />
              <span>Virtual Receptionist</span>
            </button>

            <div className="pt-2 grid grid-cols-2 gap-1.5 text-xs">
              <button
                onClick={() => handleSelectNav('dashboard')}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-center font-medium"
              >
                ER Board ({pendingEmergencyCount})
              </button>
              <button
                onClick={() => handleSelectNav('case_taking')}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-center font-medium"
              >
                Doctor Case Form
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
