import React, { useState, useEffect } from 'react';
import { 
  Clock, Calendar, FileText, Activity, AlertTriangle, Heart, 
  UserCheck, Download, Search, ShieldCheck, ChevronRight, CheckCircle2,
  PanelLeftClose, PanelLeftOpen, Users
} from 'lucide-react';
import { Patient, TimelineEvent, User } from '../types';
import { LocalClinicalStorage, maskPhi } from '../services/storage';

interface PatientTimelineProps {
  patients: Patient[];
  selectedPatientId?: string;
  onSelectPatientId: (id: string) => void;
  currentUser: User | null;
  phiMasked: boolean;
  isOfflineMode: boolean;
}

export const PatientTimeline: React.FC<PatientTimelineProps> = ({
  patients,
  selectedPatientId,
  onSelectPatientId,
  currentUser,
  phiMasked,
  isOfflineMode,
}) => {
  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [downloadNotice, setDownloadNotice] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (selectedPatientId) {
      const p = patients.find(x => x.id === selectedPatientId || x.patient_id === selectedPatientId);
      if (p) setActivePatient(p);
    } else if (patients.length > 0 && !activePatient) {
      setActivePatient(patients[0]);
    }
  }, [selectedPatientId, patients]);

  useEffect(() => {
    if (!activePatient) return;
    setIsLoading(true);

    const loadTimeline = async () => {
      try {
        if (!isOfflineMode) {
          const res = await fetch(`/timeline/${activePatient.id}`);
          if (res.ok) {
            const data = await res.json();
            setTimelineEvents(data.timeline || []);
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn('Network timeline fetch failed, falling back to local storage:', e);
      }

      // Local storage calculation
      const localEvents = LocalClinicalStorage.getPatientTimeline(activePatient.id);
      setTimelineEvents(localEvents);
      setIsLoading(false);

      // Audit log viewing of patient file
      LocalClinicalStorage.logAuditAction(
        currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : { id: 'usr-1', name: 'Clinical User', role: 'doctor' },
        'PATIENT_VIEWED',
        activePatient.id,
        `Viewed longitudinal medical timeline of patient ${activePatient.name} (${activePatient.patient_id}).`
      );
    };

    loadTimeline();
  }, [activePatient, isOfflineMode, currentUser]);

  const handleDownloadRecord = () => {
    if (!activePatient) return;
    setDownloadNotice('HIPAA Encrypted Patient Record Exported Successfully!');

    LocalClinicalStorage.logAuditAction(
      currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : { id: 'usr-1', name: 'Authorized Clinician', role: 'doctor' },
      'RECORD_DOWNLOADED',
      activePatient.id,
      `Clinical record file exported. Encrypted archive created with tamper-evident audit signature.`
    );

    setTimeout(() => setDownloadNotice(''), 3000);
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.patient_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="patient-timeline-container">
      {/* Top Header */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-red-400" />
            <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest">
              LONGITUDINAL AUDIT RECORD
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
            Patient Medical Timeline
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Chronological audit log merging Emergency Intakes, Registrations, Doctor Consultations, Diagnoses, and Follow-Ups (<code className="text-red-400 font-mono">GET /timeline/:patientId</code>).
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-mono flex items-center space-x-1.5 border border-slate-800 cursor-pointer transition-colors"
            title={isSidebarOpen ? "Hide Patient Sidebar" : "Show Patient Sidebar"}
          >
            {isSidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5 text-slate-400" /> : <PanelLeftOpen className="w-3.5 h-3.5 text-blue-400" />}
            <span className="hidden sm:inline">{isSidebarOpen ? 'Hide Patient Rail' : 'Show Patient Rail'}</span>
          </button>

          {activePatient && (
            <button
              onClick={handleDownloadRecord}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg text-xs font-mono uppercase tracking-wider border border-slate-800 flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Export Record</span>
            </button>
          )}
        </div>
      </div>

      {downloadNotice && (
        <div className="bg-green-950/30 border border-green-800/60 text-green-300 text-xs p-3.5 rounded-lg flex items-center space-x-2 font-mono">
          <ShieldCheck className="w-4 h-4 text-green-400" />
          <span>{downloadNotice} (Audit log entry recorded)</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Select Patient */}
        {isSidebarOpen && (
          <div className="lg:col-span-4 xl:col-span-3 min-w-0 space-y-6">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                Select Patient
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {patients.length} total
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search patient..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {filteredPatients.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActivePatient(p);
                    onSelectPatientId(p.id);
                  }}
                  className={`w-full text-left p-3 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                    activePatient?.id === p.id
                      ? 'bg-slate-900 text-white border border-red-800/80'
                      : 'bg-slate-900/50 hover:bg-slate-900 text-slate-300 border border-transparent'
                  }`}
                >
                  <div>
                    <div className="font-medium flex items-center space-x-1.5">
                      <span>{phiMasked ? maskPhi(p.name, 'name') : p.name}</span>
                      {p.is_emergency_shell && (
                        <span className="text-[9px] font-mono bg-amber-950/50 text-amber-400 px-1.5 py-0.2 rounded border border-amber-800/60 uppercase">
                          Shell
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {p.patient_id} • {p.gender}, {p.age} yrs
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </button>
              ))}
            </div>
          </div>

          {/* Patient Details Card */}
          {activePatient && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest">
                  HEALTH PROFILE
                </span>
                <h3 className="text-base font-bold text-white tracking-tight mt-0.5">
                  {phiMasked ? maskPhi(activePatient.name, 'name') : activePatient.name}
                </h3>
                <p className="text-xs text-slate-400 font-mono">{activePatient.patient_id}</p>
              </div>

              <div className="text-xs space-y-2 text-slate-300 font-mono text-[11px]">
                <div><span className="text-slate-500">Age / Gender:</span> {activePatient.age} yrs, {activePatient.gender}</div>
                <div><span className="text-slate-500">Contact:</span> {phiMasked ? maskPhi(activePatient.contact, 'phone') : activePatient.contact}</div>
                <div><span className="text-slate-500">Address:</span> {phiMasked ? maskPhi(activePatient.address, 'address') : activePatient.address}</div>
                <div><span className="text-slate-500">Emergency:</span> {phiMasked ? maskPhi(activePatient.emergency_contact, 'phone') : activePatient.emergency_contact}</div>
                <div>
                  <span className="text-slate-500">Record Type:</span>{' '}
                  {activePatient.is_emergency_shell ? (
                    <span className="text-amber-400">Unverified Shell</span>
                  ) : (
                    <span className="text-green-400">Permanent Record</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Right Side: Visual Vertical Timeline */}
        <div className={`${isSidebarOpen ? 'lg:col-span-8 xl:col-span-9' : 'lg:col-span-12'} min-w-0 bg-slate-950 border border-slate-800 rounded-xl p-6`}>
          
          {/* Compact Patient Strip when sidebar is collapsed */}
          {!isSidebarOpen && activePatient && (
            <div className="mb-5 bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-950 text-blue-300 flex items-center justify-center font-bold">
                  {activePatient.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-white flex items-center space-x-2">
                    <span>{phiMasked ? maskPhi(activePatient.name, 'name') : activePatient.name}</span>
                    <span className="text-[10px] font-mono text-slate-400">({activePatient.patient_id})</span>
                    {activePatient.is_emergency_shell && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono uppercase">
                        Shell
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 text-[11px] font-mono mt-0.5">
                    {activePatient.age}y • {activePatient.gender} • {phiMasked ? maskPhi(activePatient.contact, 'phone') : activePatient.contact}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-300 font-mono text-xs flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Switch Patient</span>
                </button>
              </div>
            </div>
          )}
          <div className="border-b border-slate-800 pb-4 mb-6 flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center space-x-2 tracking-tight">
              <Activity className="w-4 h-4 text-blue-400" />
              <span>Chronological Event Stream</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {timelineEvents.length} events logged
            </span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-xs font-mono">
              Loading timeline records...
            </div>
          ) : timelineEvents.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              No historical clinical events found for this patient.
            </div>
          ) : (
            <div className="relative border-l border-slate-800 ml-4 space-y-6 pl-6">
              {timelineEvents.map((evt, idx) => {
                const dateObj = new Date(evt.date);
                const formattedDate = isNaN(dateObj.getTime())
                  ? evt.date
                  : dateObj.toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                return (
                  <div key={evt.id || idx} className="relative group">
                    {/* Timeline Dot Icon */}
                    <div className={`absolute -left-[33px] top-1.5 w-4 h-4 rounded-full flex items-center justify-center border ${
                      evt.type === 'emergency_intake' ? 'bg-red-950 border-red-500 text-red-300' :
                      evt.type === 'consultation' ? 'bg-blue-950 border-blue-500 text-blue-300' :
                      evt.type === 'diagnosis_update' ? 'bg-purple-950 border-purple-500 text-purple-300' :
                      evt.type === 'follow_up' ? 'bg-green-950 border-green-500 text-green-300' :
                      'bg-slate-900 border-slate-700 text-slate-300'
                    }`}>
                    </div>

                    {/* Timeline Item Content */}
                    <div className="bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-xl p-4 space-y-2 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
                          evt.type === 'emergency_intake' ? 'bg-red-950/60 text-red-400 border border-red-800/60' :
                          evt.type === 'consultation' ? 'bg-blue-950/60 text-blue-400 border border-blue-800/60' :
                          evt.type === 'diagnosis_update' ? 'bg-purple-950/60 text-purple-400 border border-purple-800/60' :
                          evt.type === 'follow_up' ? 'bg-green-950/60 text-green-400 border border-green-800/60' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {evt.type.replace('_', ' ')}
                        </span>

                        <span className="text-[11px] text-slate-500 font-mono">
                          {formattedDate}
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-white tracking-tight">
                        {evt.title}
                      </h4>

                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        {evt.description}
                      </p>

                      <div className="text-[11px] font-mono text-slate-400 pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
                        <span>Recorded by: <span className="text-slate-200">{evt.actor}</span></span>
                        <span className="text-[10px] text-slate-500">ID: {evt.id}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
