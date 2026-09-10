import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, PhoneCall, Zap, UserCheck, Stethoscope, 
  ArrowRight, ShieldCheck, HeartPulse, User, Lock, CheckCircle2, X 
} from 'lucide-react';
import { User as SystemUser } from '../types';
import { INITIAL_USERS } from '../services/storage';
import { VibrationService } from '../services/vibrationService';

interface EmergencyQuickLoginProps {
  onBypassToEmergency: () => void;
  onPatientLogin: (patientData: { name: string; phone: string; emergencyContact?: string }) => void;
  onStaffLogin: (user: SystemUser) => void;
  onClose?: () => void;
  isModal?: boolean;
}

export const EmergencyQuickLogin: React.FC<EmergencyQuickLoginProps> = ({
  onBypassToEmergency,
  onPatientLogin,
  onStaffLogin,
  onClose,
  isModal = false,
}) => {
  const [tab, setTab] = useState<'emergency' | 'patient' | 'staff'>('emergency');
  const [patientName, setPatientName] = useState<string>('');
  const [patientPhone, setPatientPhone] = useState<string>('');
  const [emergencyContact, setEmergencyContact] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('usr-1');

  // Handle ESC key to dismiss modal
  useEffect(() => {
    if (!isModal || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModal, onClose]);

  const handlePatientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    VibrationService.triggerQuickTap();
    onPatientLogin({
      name: patientName.trim() || 'Emergency Patient',
      phone: patientPhone.trim() || '+91 99999 00000',
      emergencyContact: emergencyContact.trim(),
    });
  };

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    VibrationService.triggerQuickTap();
    const staff = INITIAL_USERS.find(u => u.id === selectedStaffId) || INITIAL_USERS[0];
    onStaffLogin(staff);
  };

  const containerClasses = isModal 
    ? "fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" 
    : "min-h-[85vh] flex items-center justify-center p-4";

  return (
    <div 
      className={containerClasses} 
      id="quick-login-container"
      onClick={(e) => {
        if (isModal && onClose && e.target === e.currentTarget) {
          VibrationService.triggerQuickTap();
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-sky-500"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Arambh Health Portal
            </span>
          </div>
          {isModal && onClose && (
            <button 
              type="button"
              onClick={() => {
                VibrationService.triggerQuickTap();
                onClose();
              }}
              className="text-slate-400 hover:text-slate-700 text-xs font-medium px-2.5 py-1 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors flex items-center space-x-1"
            >
              <span>Close</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Top Emergency Action - Reassuring & Clear */}
        <div className="p-5 border-b border-slate-100 bg-rose-50/40">
          <button
            id="btn-instant-emergency-sos"
            onClick={() => {
              VibrationService.triggerDispatchSuccess();
              onBypassToEmergency();
            }}
            className="w-full py-3.5 px-4 rounded-xl bg-white border border-rose-200/80 text-slate-900 hover:bg-rose-50 transition-all cursor-pointer shadow-xs flex items-center space-x-3 active:scale-[0.99]"
          >
            <div className="w-10 h-10 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                <span>Immediate Emergency Admission</span>
                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-rose-100 text-rose-700">Priority</span>
              </div>
              <p className="text-xs text-slate-500">
                No sign-in required. Instant ER bed triage & nearest hospital dispatch.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-5 pt-4">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => {
                VibrationService.triggerQuickTap();
                setTab('emergency');
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                tab === 'emergency'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => {
                VibrationService.triggerQuickTap();
                setTab('patient');
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                tab === 'patient'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Patient Sign-In
            </button>
            <button
              onClick={() => {
                VibrationService.triggerQuickTap();
                setTab('staff');
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                tab === 'staff'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Hospital Staff
            </button>
          </div>
        </div>

        {/* Tab 1: Emergency Details */}
        {tab === 'emergency' && (
          <div className="p-5 space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <h3 className="font-semibold text-sm text-slate-900">Zero Paperwork Fast Admission</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Hospital admissions typically consume critical minutes with paperwork. Arambh Health pre-allocates an emergency trauma bed, parses symptoms via natural voice recognition, and alerts receiving clinicians before arrival.
              </p>

              <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-200/60 text-xs text-slate-700">
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Voice Triage Assistant</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Real-time Bed Routing</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>AI Virtual Receptionist</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Offline SMS Emergency Protocol</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                VibrationService.triggerDispatchSuccess();
                onBypassToEmergency();
              }}
              className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
            >
              <HeartPulse className="w-4 h-4" />
              <span>Go to Emergency Fast Admit</span>
            </button>
          </div>
        )}

        {/* Tab 2: Patient Sign-In */}
        {tab === 'patient' && (
          <form onSubmit={handlePatientSubmit} className="p-5 space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Patient Full Name</label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. Anand Varma"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Mobile Phone Number</label>
              <input
                type="tel"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="+91 98201 11223"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Emergency Contact (Next of Kin)</label>
              <input
                type="tel"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="+91 98201 44521"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
            >
              Sign In to Patient Portal
            </button>
          </form>
        )}

        {/* Tab 3: Hospital Staff */}
        {tab === 'staff' && (
          <form onSubmit={handleStaffSubmit} className="p-5 space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Select Clinical Credential</label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              >
                {INITIAL_USERS.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.role.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Clinical credentials grant direct access to the Emergency Room Triage Board, Doctor Case Sheets, and HIPAA-compliant audit logs.
            </p>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
            >
              Sign In as Clinical Staff
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
