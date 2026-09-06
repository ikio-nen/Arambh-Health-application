import React, { useState } from 'react';
import { 
  ShieldAlert, PhoneCall, Zap, UserCheck, Stethoscope, 
  ArrowRight, ShieldCheck, HeartPulse, User, Lock, CheckCircle2 
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
    ? "fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md" 
    : "min-h-[85vh] flex items-center justify-center p-4";

  return (
    <div className={containerClasses} id="quick-login-container">
      <div className="w-full max-w-lg bg-[#111317] border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            <span className="font-mono text-xs uppercase tracking-wider text-slate-300">
              Arambh Health Gateway
            </span>
          </div>
          {isModal && onClose && (
            <button 
              onClick={() => {
                VibrationService.triggerQuickTap();
                onClose();
              }}
              className="text-slate-400 hover:text-white text-xs font-mono px-2 py-1 rounded hover:bg-[#181b22] cursor-pointer"
            >
              Skip
            </button>
          )}
        </div>

        {/* Top Emergency Action */}
        <div className="p-5 border-b border-white/5">
          <button
            id="btn-instant-emergency-sos"
            onClick={() => {
              VibrationService.triggerDispatchSuccess();
              onBypassToEmergency();
            }}
            className="w-full py-4 px-5 rounded-xl bg-white text-black hover:bg-slate-200 transition-all cursor-pointer shadow-lg flex items-center space-x-3 active:scale-98"
          >
            <Zap className="w-6 h-6 text-red-600 fill-red-600 shrink-0" />
            <div className="text-left">
              <div className="font-bold text-sm sm:text-base leading-tight">
                One-Tap Fast Admit SOS
              </div>
              <p className="text-xs text-slate-600 font-normal">
                No login required. Instantly reserve trauma bed & call nearest ambulance.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 ml-auto text-black shrink-0" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-white/5 bg-[#0e1014] font-mono text-xs">
          <button
            onClick={() => {
              VibrationService.triggerQuickTap();
              setTab('emergency');
            }}
            className={`flex-1 py-2.5 px-2 text-center uppercase tracking-wider transition-colors cursor-pointer ${
              tab === 'emergency'
                ? 'bg-[#14161a] text-white font-semibold border-b-2 border-red-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Emergency Overview
          </button>
          <button
            onClick={() => {
              VibrationService.triggerQuickTap();
              setTab('patient');
            }}
            className={`flex-1 py-2.5 px-2 text-center uppercase tracking-wider transition-colors cursor-pointer ${
              tab === 'patient'
                ? 'bg-[#14161a] text-white font-semibold border-b-2 border-red-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Patient Sign-In
          </button>
          <button
            onClick={() => {
              VibrationService.triggerQuickTap();
              setTab('staff');
            }}
            className={`flex-1 py-2.5 px-2 text-center uppercase tracking-wider transition-colors cursor-pointer ${
              tab === 'staff'
                ? 'bg-[#14161a] text-white font-semibold border-b-2 border-red-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Hospital Staff
          </button>
        </div>

        {/* Tab 1: Emergency Details */}
        {tab === 'emergency' && (
          <div className="p-5 space-y-4">
            <div className="p-4 bg-[#14161a] rounded-xl border border-white/5 space-y-2">
              <h3 className="font-semibold text-sm text-white">Zero Paperwork Fast Admission</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Hospital admissions typically take 20–40 minutes of bureaucratic intake. Arambh Health pre-allocates an ER trauma bed, parses symptoms via voice recognition, and alerts the receiving emergency physician before you reach the gate.
              </p>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-xs font-mono text-slate-300">
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Voice Triage</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>GPS Bed Routing</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>AI Receptionist</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Fall Motion Sensor</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                VibrationService.triggerDispatchSuccess();
                onBypassToEmergency();
              }}
              className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-mono text-xs font-bold uppercase transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <HeartPulse className="w-4 h-4" />
              <span>Enter Emergency Mode</span>
            </button>
          </div>
        )}

        {/* Tab 2: Patient Sign-In */}
        {tab === 'patient' && (
          <form onSubmit={handlePatientSubmit} className="p-5 space-y-3.5">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-400">Patient Full Name</label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. Anand Varma"
                className="w-full bg-[#14161a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-400">Mobile Phone Number</label>
              <input
                type="tel"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="+91 98201 11223"
                className="w-full bg-[#14161a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-400">Emergency Contact Number</label>
              <input
                type="tel"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="+91 98201 44521 (Next of Kin)"
                className="w-full bg-[#14161a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-white text-black hover:bg-slate-200 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Sign In to Patient Portal
            </button>
          </form>
        )}

        {/* Tab 3: Hospital Staff */}
        {tab === 'staff' && (
          <form onSubmit={handleStaffSubmit} className="p-5 space-y-3.5">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-400">Select Clinical Credential</label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full bg-[#14161a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              >
                {INITIAL_USERS.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.role.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-slate-400">
              Authorized credentials grant instant access to the Emergency Room Triage Board, Clinical Doctor Case Sheets, and cryptographic audit logs.
            </p>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-white text-black hover:bg-slate-200 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Sign In as Clinical Staff
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
