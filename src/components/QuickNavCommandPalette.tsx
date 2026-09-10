import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Zap, Building2, ShieldAlert, Bot, 
  Stethoscope, FileText, Activity, History, Users, 
  ShieldCheck, ArrowRight, CornerDownLeft, X, Database
} from 'lucide-react';
import { VibrationService } from '../services/vibrationService';

interface QuickNavCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: string;
  onSelectView: (view: string) => void;
  onOpenDatabaseCacheModal?: () => void;
  onOpenQuickLogin?: () => void;
  pendingEmergencyCount?: number;
}

interface PaletteItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
  action?: () => void;
}

export const QuickNavCommandPalette: React.FC<QuickNavCommandPaletteProps> = ({
  isOpen,
  onClose,
  activeView,
  onSelectView,
  onOpenDatabaseCacheModal,
  onOpenQuickLogin,
  pendingEmergencyCount = 0,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const navigationItems: PaletteItem[] = [
    // Emergency & Core
    {
      id: 'fast_admit',
      title: 'Emergency Fast Admit',
      subtitle: 'Zero-delay voice-to-fill 108 emergency intake & triage',
      category: '🚨 Emergency Response',
      icon: Zap,
      badge: 'Core USP',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    },
    {
      id: 'hospitals',
      title: 'Nearest Hospitals & Vacancies',
      subtitle: 'Real-time bed counts, distance evaluation, and routing',
      category: '🚨 Emergency Response',
      icon: Building2,
      badge: 'Live Map',
      badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
    },
    {
      id: 'fall_guard',
      title: 'Fall & Motion Guard',
      subtitle: 'Accelerometer impact shock detection and inactivity voice-guard',
      category: '🚨 Emergency Response',
      icon: ShieldAlert,
      badge: 'Sensors',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      id: 'receptionist',
      title: 'Virtual Hospital Receptionist',
      subtitle: 'AI emergency call agent and nearest hospital phone operator',
      category: '🚨 Emergency Response',
      icon: Bot,
      badge: 'AI Voice',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
    {
      id: 'ai_chatbot',
      title: 'AI Clinical Assistant',
      subtitle: 'Emergency triage guidance and clinical knowledge lookup',
      category: '🚨 Emergency Response',
      icon: Bot,
    },
    // Clinical Operations
    {
      id: 'dashboard',
      title: 'ER Triage Board',
      subtitle: 'Live emergency patient queue, bed management, and clinical handover',
      category: '🩺 Clinical ER Operations',
      icon: Stethoscope,
      badge: pendingEmergencyCount > 0 ? `${pendingEmergencyCount} Pending` : undefined,
      badgeColor: 'bg-rose-600 text-white',
    },
    {
      id: 'registration',
      title: 'Patient Admission Registry',
      subtitle: 'Comprehensive patient intake and medical identity records',
      category: '🩺 Clinical ER Operations',
      icon: FileText,
    },
    {
      id: 'case_taking',
      title: 'Doctor Clinical Case Form',
      subtitle: 'SOAP clinical notes, differential diagnosis, and prescriptions',
      category: '🩺 Clinical ER Operations',
      icon: Activity,
      badge: 'Physician',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    {
      id: 'timeline',
      title: 'Patient Medical Timeline',
      subtitle: 'Longitudinal EHR records and emergency encounter history',
      category: '🩺 Clinical ER Operations',
      icon: History,
    },
    {
      id: 'followup',
      title: 'Follow-Up Workflow',
      subtitle: 'Post-emergency discharge care coordination and tracking',
      category: '🩺 Clinical ER Operations',
      icon: Users,
    },
    {
      id: 'audit',
      title: 'HIPAA Audit Logs',
      subtitle: 'Immutable access trails, security compliance, and activity log',
      category: '⚙️ Security & System',
      icon: ShieldCheck,
      badge: 'HIPAA',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
    {
      id: 'users',
      title: 'Admin User & Staff Management',
      subtitle: 'Manage doctors, triage nurses, admins, and role permissions',
      category: '⚙️ Security & System',
      icon: Users,
    },
  ];

  // Optional tool actions
  const actionItems: PaletteItem[] = [];
  if (onOpenDatabaseCacheModal) {
    actionItems.push({
      id: 'action_db_cache',
      title: 'Local Database & AI Cache Diagnostics',
      subtitle: 'Inspect IndexedDB sync queue, AES encryption, and offline L1 protocols',
      category: '⚙️ Security & System',
      icon: Database,
      action: () => {
        onOpenDatabaseCacheModal();
        onClose();
      },
    });
  }
  if (onOpenQuickLogin) {
    actionItems.push({
      id: 'action_login',
      title: 'Staff Login & Patient Portal',
      subtitle: 'Authenticate as Doctor, Nurse, Admin, or enter emergency profile',
      category: '⚙️ Security & System',
      icon: Users,
      action: () => {
        onOpenQuickLogin();
        onClose();
      },
    });
  }

  const allItems = [...navigationItems, ...actionItems];

  const filteredItems = allItems.filter(item => {
    if (!searchTerm.trim()) return true;
    const query = searchTerm.toLowerCase();
    return (
      item.title.toLowerCase().includes(query) ||
      item.subtitle.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  });

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Keyboard navigation inside palette
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleExecuteItem(filteredItems[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);

  const handleExecuteItem = (item: PaletteItem) => {
    VibrationService.triggerQuickTap();
    if (item.action) {
      item.action();
    } else {
      onSelectView(item.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[110] flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/50 backdrop-blur-xs select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      id="quick-nav-command-palette-backdrop"
    >
      <div 
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        id="quick-nav-command-palette-card"
      >
        {/* Search Bar Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200/80 bg-slate-50/50">
          <Search className="w-5 h-5 text-sky-600 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type a screen name or action (e.g. 'ER board', 'hospitals', 'SMS', 'audit')..."
            className="w-full bg-transparent border-none outline-none text-slate-900 placeholder:text-slate-400 text-sm sm:text-base font-medium"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer mr-2"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-[11px] font-mono font-medium text-slate-700 cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div 
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto p-2 space-y-1 divide-y divide-slate-100"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No matching modules found for "{searchTerm}".
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              const isCurrent = activeView === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => handleExecuteItem(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-between group ${
                    isSelected 
                      ? 'bg-sky-50 text-slate-900' 
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                      isCurrent 
                        ? 'bg-sky-600 text-white border-sky-600' 
                        : isSelected 
                          ? 'bg-sky-100 text-sky-700 border-sky-200' 
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs sm:text-sm font-semibold truncate ${
                          isSelected ? 'text-sky-950' : 'text-slate-900'
                        }`}>
                          {item.title}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 border border-sky-200">
                            Current
                          </span>
                        )}
                        {item.badge && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded border ${item.badgeColor || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 ml-2">
                    <span className="text-[10px] text-slate-400 font-medium hidden md:inline">
                      {item.category.replace(/^[^\s]+\s*/, '')}
                    </span>
                    {isSelected ? (
                      <CornerDownLeft className="w-3.5 h-3.5 text-sky-600" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center space-x-3">
            <span><kbd className="font-mono bg-white px-1 py-0.5 rounded border border-slate-300 text-[10px]">↑</kbd> <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-slate-300 text-[10px]">↓</kbd> to navigate</span>
            <span><kbd className="font-mono bg-white px-1 py-0.5 rounded border border-slate-300 text-[10px]">↵</kbd> to select</span>
          </div>
          <span className="text-slate-400">Press <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-slate-300 text-[10px]">ESC</kbd> to exit</span>
        </div>
      </div>
    </div>
  );
};
