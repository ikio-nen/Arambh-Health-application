import React, { useState } from 'react';
import { 
  Zap, Building2, ShieldAlert, Bot, Stethoscope, ChevronDown, User, Menu, X, Smartphone
} from 'lucide-react';
import { User as SystemUser, UserRole } from '../types';
import { VibrationService } from '../services/vibrationService';

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
    <header className="sticky top-0 z-50 bg-[#090a0c] border-b border-white/5 text-slate-100 shadow-lg">
      <div className="w-full px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Brand Logo & Name - Clean Minimalist */}
          <div 
            className="flex items-center space-x-2.5 cursor-pointer select-none" 
            onClick={() => handleSelectNav('fast_admit')}
            id="brand-header-logo"
          >
            <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center font-mono font-bold text-xs text-white">
              108
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-sm sm:text-base font-bold tracking-tight text-white">
                  Arambh
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 font-semibold">
                  FAST ADMIT
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider leading-none">
                Emergency Hotline & Triage
              </p>
            </div>
          </div>

          {/* MINIMAL & EFFICIENT DESKTOP NAVIGATION */}
          <nav className="hidden lg:flex items-center space-x-1" id="main-desktop-nav">
            {/* 1. FAST ADMIT */}
            <button
              id="nav-btn-fast-admit"
              onClick={() => handleSelectNav('fast_admit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeView === 'fast_admit' 
                  ? 'bg-white text-black font-semibold' 
                  : 'text-slate-300 hover:text-white hover:bg-[#14161a]'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${activeView === 'fast_admit' ? 'text-red-600 fill-red-600' : 'text-slate-400'}`} />
              <span>Fast Admit SOS</span>
            </button>

            {/* 2. NEAREST HOSPITALS */}
            <button
              id="nav-btn-hospitals"
              onClick={() => handleSelectNav('hospitals')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeView === 'hospitals' 
                  ? 'bg-white text-black font-semibold' 
                  : 'text-slate-300 hover:text-white hover:bg-[#14161a]'
              }`}
            >
              <Building2 className={`w-3.5 h-3.5 ${activeView === 'hospitals' ? 'text-black' : 'text-slate-400'}`} />
              <span>Hospitals & Beds</span>
            </button>

            {/* 3. FALL & MOTION GUARD */}
            <button
              id="nav-btn-fall-guard"
              onClick={() => handleSelectNav('fall_guard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeView === 'fall_guard' 
                  ? 'bg-white text-black font-semibold' 
                  : 'text-slate-300 hover:text-white hover:bg-[#14161a]'
              }`}
            >
              <ShieldAlert className={`w-3.5 h-3.5 ${activeView === 'fall_guard' ? 'text-black' : 'text-slate-400'}`} />
              <span>Fall Guard</span>
            </button>

            {/* 4. RECEPTIONIST AGENT */}
            <button
              id="nav-btn-receptionist"
              onClick={() => handleSelectNav('receptionist')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeView === 'receptionist' 
                  ? 'bg-white text-black font-semibold' 
                  : 'text-slate-300 hover:text-white hover:bg-[#14161a]'
              }`}
            >
              <Bot className={`w-3.5 h-3.5 ${activeView === 'receptionist' ? 'text-black' : 'text-slate-400'}`} />
              <span>Receptionist Desk</span>
            </button>

            {/* 5. CLINICAL DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => setStaffDropdownOpen(!staffDropdownOpen)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center space-x-1 cursor-pointer border ${
                  isStaffView
                    ? 'bg-[#181b22] border-white/20 text-white font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-[#14161a] border-transparent'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                <span>Clinical</span>
                {pendingEmergencyCount > 0 && (
                  <span className="bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center ml-0.5">
                    {pendingEmergencyCount}
                  </span>
                )}
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>

              {staffDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-[#14161a] border border-white/10 rounded-xl shadow-2xl p-1.5 space-y-1 z-50">
                  <div className="text-[10px] font-mono text-slate-500 uppercase px-2 py-1">
                    Staff Clinical Views
                  </div>
                  <button
                    onClick={() => { handleSelectNav('dashboard'); setStaffDropdownOpen(false); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-300 hover:bg-[#1c1f26] hover:text-white flex items-center justify-between"
                  >
                    <span>ER Triage Board</span>
                    {pendingEmergencyCount > 0 && (
                      <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.2 rounded-full">
                        {pendingEmergencyCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => { handleSelectNav('case_taking'); setStaffDropdownOpen(false); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-300 hover:bg-[#1c1f26] hover:text-white"
                  >
                    Doctor Case Form
                  </button>
                  <button
                    onClick={() => { handleSelectNav('registration'); setStaffDropdownOpen(false); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-300 hover:bg-[#1c1f26] hover:text-white"
                  >
                    Patient Admission
                  </button>
                  <button
                    onClick={() => { handleSelectNav('timeline'); setStaffDropdownOpen(false); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-300 hover:bg-[#1c1f26] hover:text-white"
                  >
                    Patient Timeline
                  </button>
                  <button
                    onClick={() => { handleSelectNav('audit'); setStaffDropdownOpen(false); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-300 hover:bg-[#1c1f26] hover:text-white"
                  >
                    HIPAA Audit Logs
                  </button>
                  <button
                    onClick={() => { handleSelectNav('bluetooth_hopping'); setStaffDropdownOpen(false); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-300 hover:bg-[#1c1f26] hover:text-white"
                  >
                    BLE FHSS Mesh
                  </button>
                </div>
              )}
            </div>
          </nav>

          {/* RIGHT UTILITIES */}
          <div className="flex items-center space-x-2">
            {onOpenQuickLogin && (
              <button
                onClick={() => {
                  VibrationService.triggerQuickTap();
                  onOpenQuickLogin();
                }}
                className="px-2.5 py-1 rounded-lg bg-[#14161a] hover:bg-[#1c1f26] text-xs font-mono text-slate-300 hover:text-white border border-white/5 flex items-center space-x-1.5 cursor-pointer"
                title="Login"
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Portal</span>
              </button>
            )}

            {/* Offline Mesh Badge */}
            <button
              onClick={() => {
                VibrationService.triggerQuickTap();
                onToggleOfflineMode();
              }}
              className={`px-2 py-1 rounded-lg font-mono text-[10px] uppercase flex items-center space-x-1.5 border cursor-pointer ${
                isOfflineMode 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                  : 'bg-[#14161a] border-white/5 text-slate-400'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isOfflineMode ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
              <span className="hidden sm:inline">{isOfflineMode ? 'OFF-GRID' : 'ONLINE'}</span>
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-lg bg-[#14161a] text-slate-300 hover:text-white border border-white/5 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* MOBILE MENU */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-white/5 space-y-1 font-mono text-xs">
            <button
              onClick={() => handleSelectNav('fast_admit')}
              className={`w-full text-left p-2.5 rounded-lg font-semibold flex items-center space-x-2 ${
                activeView === 'fast_admit' ? 'bg-white text-black' : 'bg-[#111317] text-slate-300'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-red-500" />
              <span>Fast Admit SOS (USP)</span>
            </button>

            <button
              onClick={() => handleSelectNav('hospitals')}
              className={`w-full text-left p-2.5 rounded-lg flex items-center space-x-2 ${
                activeView === 'hospitals' ? 'bg-white text-black font-semibold' : 'bg-[#111317] text-slate-300'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Nearest Hospitals & Vacancy</span>
            </button>

            <button
              onClick={() => handleSelectNav('fall_guard')}
              className={`w-full text-left p-2.5 rounded-lg flex items-center space-x-2 ${
                activeView === 'fall_guard' ? 'bg-white text-black font-semibold' : 'bg-[#111317] text-slate-300'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Fall Guard & Vibration</span>
            </button>

            <button
              onClick={() => handleSelectNav('receptionist')}
              className={`w-full text-left p-2.5 rounded-lg flex items-center space-x-2 ${
                activeView === 'receptionist' ? 'bg-white text-black font-semibold' : 'bg-[#111317] text-slate-300'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Hospital Receptionist Agent</span>
            </button>

            <div className="pt-2 grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                onClick={() => handleSelectNav('dashboard')}
                className="p-2 rounded-lg bg-[#14161a] text-slate-300 text-center"
              >
                ER Board ({pendingEmergencyCount})
              </button>
              <button
                onClick={() => handleSelectNav('case_taking')}
                className="p-2 rounded-lg bg-[#14161a] text-slate-300 text-center"
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
