import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, Heart, Activity, AlertTriangle, ShieldCheck, 
  Clock, MapPin, CheckCircle2, ChevronRight, Phone, 
  RefreshCw, FileText, UserCheck, ShieldAlert, ArrowRight,
  Filter, Bell, Sparkles, Search, Stethoscope, Plus, Trash2,
  X, Check, BedDouble, Ambulance
} from 'lucide-react';
import { EmergencyCase, Patient, User, EmergencyStatus, Consultation } from '../types';
import { LocalClinicalStorage, INITIAL_USERS, maskPhi, generateId } from '../services/storage';
import { secureLocalDB } from '../services/secureLocalDatabase';
import { VibrationService } from '../services/vibrationService';

interface HospitalDashboardProps {
  emergencyCases: EmergencyCase[];
  patients: Patient[];
  currentUser: User | null;
  phiMasked: boolean;
  isOfflineMode: boolean;
  onPatientConverted: (patient: Patient) => void;
  onCaseUpdated?: (updatedCase: EmergencyCase) => void;
}

export const HospitalDashboard: React.FC<HospitalDashboardProps> = ({
  emergencyCases: initialCases,
  patients,
  currentUser,
  phiMasked,
  isOfflineMode,
  onPatientConverted,
  onCaseUpdated,
}) => {
  const [cases, setCases] = useState<EmergencyCase[]>(initialCases);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeStaffUser, setActiveStaffUser] = useState<User>(
    currentUser || INITIAL_USERS[0]
  );
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [statusFeedback, setStatusFeedback] = useState<string>('');

  // Selected Case for Clinical Examination Drawer / Modal
  const [examiningCase, setExaminingCase] = useState<EmergencyCase | null>(null);
  const [bpValue, setBpValue] = useState<string>('120/80');
  const [hrValue, setHrValue] = useState<string>('88');
  const [spo2Value, setSpo2Value] = useState<string>('98');
  const [tempValue, setTempValue] = useState<string>('98.6');
  const [clinicalNotes, setClinicalNotes] = useState<string>('');
  const [diagnosisText, setDiagnosisText] = useState<string>('');
  const [prescriptions, setPrescriptions] = useState<string[]>([
    'IV Normal Saline 500ml stat',
    'Continuous Cardiac Monitoring',
  ]);
  const [newPrescriptionInput, setNewPrescriptionInput] = useState<string>('');
  const [isSavingExam, setIsSavingExam] = useState<boolean>(false);

  // Sync cases with props
  useEffect(() => {
    setCases(initialCases);
  }, [initialCases]);

  useEffect(() => {
    if (currentUser) {
      setActiveStaffUser(currentUser);
    }
  }, [currentUser]);

  // Refresh cases
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    VibrationService.triggerQuickTap();
    try {
      if (!isOfflineMode) {
        const res = await fetch('/api/emergency/cases');
        if (res.ok) {
          const freshCases = await res.json();
          setCases(freshCases);
          LocalClinicalStorage.setEmergencyCases(freshCases);
        } else {
          setCases(LocalClinicalStorage.getEmergencyCases());
        }
      } else {
        setCases(LocalClinicalStorage.getEmergencyCases());
      }
    } catch {
      setCases(LocalClinicalStorage.getEmergencyCases());
    } finally {
      setIsRefreshing(false);
      setLastRefreshed(new Date().toLocaleTimeString());
    }
  };

  // Instant 1-Click Operational Status Transition
  const handleUpdateStatus = (caseId: string, newStatus: EmergencyStatus) => {
    VibrationService.triggerQuickTap();
    const updated = cases.map(c => {
      if (c.id === caseId) {
        const updatedCase: EmergencyCase = {
          ...c,
          status: newStatus,
          updated_at: new Date().toISOString(),
        };
        if (onCaseUpdated) onCaseUpdated(updatedCase);
        return updatedCase;
      }
      return c;
    });

    setCases(updated);
    LocalClinicalStorage.setEmergencyCases(updated);
    secureLocalDB.updateEmergencyCaseStatus(caseId, newStatus, true);

    const targetCase = updated.find(c => c.id === caseId);
    setStatusFeedback(`Case #${caseId} updated to "${newStatus.toUpperCase()}"`);
    setTimeout(() => setStatusFeedback(''), 3500);

    LocalClinicalStorage.logAuditAction(
      { id: activeStaffUser.id, name: activeStaffUser.name, role: activeStaffUser.role },
      'EMERGENCY_STATUS_UPDATED',
      caseId,
      `Status changed to ${newStatus} by ${activeStaffUser.name}`
    );
  };

  // Open Clinical Examination Modal
  const handleOpenExamination = (ec: EmergencyCase) => {
    VibrationService.triggerQuickTap();
    setExaminingCase(ec);
    setClinicalNotes(`Initial ER assessment: Patient presented with ${ec.condition_text}.`);
    setDiagnosisText(`Acute ${ec.triage_tag.toUpperCase()} Condition (Under Evaluation)`);
    setBpValue('122/82');
    setHrValue('92');
    setSpo2Value('97');
    setTempValue('98.6');
  };

  // Save Clinical Examination
  const handleSaveExamination = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examiningCase) return;

    setIsSavingExam(true);
    VibrationService.triggerQuickTap();

    const now = new Date().toISOString();
    const consultation: Consultation = {
      id: generateId('cons'),
      patient_id: examiningCase.patient_profile_id,
      doctor_id: activeStaffUser.id,
      doctor_name: activeStaffUser.name,
      date: now,
      chief_complaint: examiningCase.condition_text,
      present_illness: `Emergency triage acuity: ${examiningCase.triage_tag.toUpperCase()}`,
      medical_history: 'Documented via Emergency Fast Admit intake',
      family_history: 'Non-contributory (Emergency intake)',
      lifestyle_history: 'Unspecified',
      physical_examination: `Vitals: BP ${bpValue} mmHg, HR ${hrValue} bpm, SpO2 ${spo2Value}%, Temp ${tempValue}°F`,
      observations: `Bed Reserved: ${examiningCase.assigned_hospital} Emergency Bay`,
      clinical_notes: clinicalNotes,
      symptoms: [
        {
          id: generateId('sym'),
          symptom_name: examiningCase.condition_text,
          duration: 'Acute onset',
          severity: 'Critical',
        }
      ],
      doctor_approved: true,
      diagnosis: diagnosisText || 'Clinical assessment documented',
      prescriptions: prescriptions,
      created_at: now,
    };

    const existingConsultations = LocalClinicalStorage.getConsultations();
    LocalClinicalStorage.setConsultations([consultation, ...existingConsultations]);

    // Also transition status to admitted if it was arrived
    if (examiningCase.status === 'arrived' || examiningCase.status === 'en_route') {
      handleUpdateStatus(examiningCase.id, 'admitted');
    }

    setStatusFeedback(`Clinical examination & orders recorded for Case #${examiningCase.id}`);
    setIsSavingExam(false);
    setExaminingCase(null);
  };

  const handleAddPrescription = (med: string) => {
    if (!med.trim()) return;
    setPrescriptions(prev => [...prev, med.trim()]);
    setNewPrescriptionInput('');
  };

  const handleRemovePrescription = (index: number) => {
    setPrescriptions(prev => prev.filter((_, i) => i !== index));
  };

  // Filtered cases
  const filteredCases = cases.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const patient = patients.find(p => p.id === c.patient_profile_id);
      const matchName = patient?.name.toLowerCase().includes(q);
      const matchId = c.id.toLowerCase().includes(q);
      const matchCond = c.condition_text.toLowerCase().includes(q);
      const matchHosp = c.assigned_hospital?.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchCond && !matchHosp) return false;
    }
    return true;
  });

  const getTriageBadge = (tag: string) => {
    switch (tag) {
      case 'cardiac':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          label: 'Code Red • Cardiac',
          dot: 'bg-rose-600',
        };
      case 'trauma':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          label: 'Immediate • Trauma',
          dot: 'bg-amber-600',
        };
      case 'respiratory':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          label: 'Code Red • Respiratory',
          dot: 'bg-rose-600',
        };
      case 'stroke':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          label: 'Critical • Stroke',
          dot: 'bg-purple-600',
        };
      default:
        return {
          bg: 'bg-sky-50 text-sky-700 border-sky-200',
          label: 'Urgent Triage',
          dot: 'bg-sky-600',
        };
    }
  };

  const getStatusBadge = (status: EmergencyStatus) => {
    switch (status) {
      case 'pending':
        return { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Pending Dispatch' };
      case 'en_route':
        return { bg: 'bg-sky-50 text-sky-700 border-sky-200', label: 'Ambulance En Route' };
      case 'arrived':
        return { bg: 'bg-amber-50 text-amber-800 border-amber-200', label: 'Arrived at ER Bay' };
      case 'admitted':
        return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Admitted to Bed' };
      case 'converted':
        return { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Profile Registered' };
      default:
        return { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: status };
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 text-slate-800" id="hospital-dashboard">
      
      {/* HEADER SECTION: Clean, High-Contrast Healthcare Top Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
            </span>
            <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
              Live ER Operations • Sync: {lastRefreshed}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Emergency Triage & Casualty Intake Board
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor incoming ambulances, manage ER bed reservations, and record rapid clinical exams.
          </p>
        </div>

        {/* Action Controls & Active Staff Selector */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Active Persona Pill */}
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700">
            <UserCheck className="w-3.5 h-3.5 text-sky-600" />
            <span className="font-semibold text-slate-900">{activeStaffUser.name}</span>
            <span className="text-[10px] uppercase font-bold text-slate-400">({activeStaffUser.role})</span>
          </div>

          {/* Quick Persona Switcher */}
          <select 
            value={activeStaffUser.id}
            onChange={(e) => {
              const selected = INITIAL_USERS.find(u => u.id === e.target.value);
              if (selected) setActiveStaffUser(selected);
            }}
            className="bg-white border border-slate-200 text-xs rounded-xl px-2.5 py-1.5 text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors focus:ring-2 focus:ring-sky-500 focus:outline-none"
            aria-label="Switch staff role"
          >
            {INITIAL_USERS.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
            title="Poll server for live updates"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-600' : 'text-slate-500'}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {statusFeedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusFeedback}</span>
        </div>
      )}

      {/* SEARCH & STATUS FILTER TABS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {[
            { id: 'all', label: 'All Cases' },
            { id: 'pending', label: 'Pending' },
            { id: 'en_route', label: 'En Route' },
            { id: 'arrived', label: 'Arrived at ER' },
            { id: 'admitted', label: 'Admitted' },
          ].map(tab => {
            const count = tab.id === 'all' ? cases.length : cases.filter(c => c.status === tab.id).length;
            const isActive = filterStatus === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  VibrationService.triggerQuickTap();
                  setFilterStatus(tab.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80'
                }`}
              >
                {tab.label} <span className="text-[10px] opacity-75 font-normal ml-1">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search patient, ID, or condition..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* EMERGENCY CASES GRID */}
      {filteredCases.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl p-8 space-y-3 shadow-xs">
          <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">No Emergency Cases in this Category</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            There are currently no cases matching your filters. You can dispatch a simulated emergency anytime from the Emergency SOS tab.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCases.map(ec => {
            const triageInfo = getTriageBadge(ec.triage_tag);
            const statusInfo = getStatusBadge(ec.status);
            const associatedPatient = patients.find(p => p.id === ec.patient_profile_id);

            return (
              <div
                key={ec.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Top Bar: Triage Acuity Tag & Status Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border flex items-center space-x-1.5 ${triageInfo.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${triageInfo.dot}`}></span>
                      <span>{triageInfo.label}</span>
                    </span>

                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${statusInfo.bg}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Patient Name & Condition */}
                  <div>
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-base font-bold text-slate-900 tracking-tight">
                        {phiMasked ? maskPhi(associatedPatient?.name || 'Emergency Intake', 'name') : (associatedPatient?.name || 'Emergency Intake')}
                      </h3>
                      <span className="text-[11px] font-mono text-slate-400">#{ec.id}</span>
                    </div>

                    <p className="text-xs font-medium text-slate-700 mt-1 line-clamp-2">
                      {ec.condition_text}
                    </p>
                  </div>

                  {/* Metadata Chips: Location, Hospital, ETA */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center space-x-1 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate max-w-[180px]">{ec.assigned_hospital}</span>
                      </span>
                      <span className="font-semibold text-rose-600">
                        ~{ec.eta_minutes} mins
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Contact / Phone:</span>
                      <span className="font-mono text-slate-700">{ec.contact || '+91 90000 00000'}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions: 1-Click Status Progression + Clinical Examination */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  
                  {/* Status Progression Quick Buttons */}
                  <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-xl border border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(ec.id, 'en_route')}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                        ec.status === 'en_route' 
                          ? 'bg-sky-600 text-white shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Mark ambulance as en route"
                    >
                      En Route
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(ec.id, 'arrived')}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                        ec.status === 'arrived' 
                          ? 'bg-amber-600 text-white shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Mark patient as arrived at emergency bay"
                    >
                      Arrived ER
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(ec.id, 'admitted')}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                        ec.status === 'admitted' 
                          ? 'bg-emerald-600 text-white shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Admit patient to hospital bed"
                    >
                      Admitted
                    </button>
                  </div>

                  {/* Primary Doctor Examination Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenExamination(ec)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Stethoscope className="w-3.5 h-3.5 text-sky-400" />
                    <span>Doctor Exam & Vitals</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DOCTOR CLINICAL EXAMINATION & VITALS MODAL */}
      {examiningCase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-sky-100 border border-sky-200 text-sky-700 flex items-center justify-center">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">
                    Rapid Clinical Examination • Case #{examiningCase.id}
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    {examiningCase.patient_name || 'Emergency Intake Patient'}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExaminingCase(null)}
                className="w-8 h-8 rounded-xl bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveExamination} className="p-5 space-y-5">
              
              {/* Emergency Overview Box */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Chief Emergency Complaint:</span>
                  <span className="font-semibold text-slate-900">{examiningCase.condition}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Assigned Facility:</span>
                  <span className="font-semibold text-sky-700">{examiningCase.assigned_hospital}</span>
                </div>
              </div>

              {/* Vitals Input Grid */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Emergency Bedside Vitals
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-medium text-slate-400 block">BP (mmHg)</span>
                    <input
                      type="text"
                      value={bpValue}
                      onChange={(e) => setBpValue(e.target.value)}
                      className="w-full text-xs font-bold text-slate-900 border-none p-0 focus:outline-none mt-1"
                      placeholder="120/80"
                    />
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-medium text-slate-400 block">Heart Rate (bpm)</span>
                    <input
                      type="text"
                      value={hrValue}
                      onChange={(e) => setHrValue(e.target.value)}
                      className="w-full text-xs font-bold text-slate-900 border-none p-0 focus:outline-none mt-1"
                      placeholder="88"
                    />
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-medium text-slate-400 block">SpO2 (%)</span>
                    <input
                      type="text"
                      value={spo2Value}
                      onChange={(e) => setSpo2Value(e.target.value)}
                      className="w-full text-xs font-bold text-slate-900 border-none p-0 focus:outline-none mt-1"
                      placeholder="98"
                    />
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-medium text-slate-400 block">Temp (°F)</span>
                    <input
                      type="text"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      className="w-full text-xs font-bold text-slate-900 border-none p-0 focus:outline-none mt-1"
                      placeholder="98.6"
                    />
                  </div>
                </div>
              </div>

              {/* Working Clinical Diagnosis */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Clinical Working Diagnosis
                </label>
                <input
                  type="text"
                  value={diagnosisText}
                  onChange={(e) => setDiagnosisText(e.target.value)}
                  placeholder="e.g. Acute Coronary Syndrome / NSTEMI"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Physician Assessment Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Attending Physician Notes
                </label>
                <textarea
                  rows={2}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Enter clinical examination findings..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Prescriptions & Emergency Orders */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Emergency Orders & Prescriptions
                </label>
                
                {/* List of orders */}
                <div className="space-y-1.5 mb-2 max-h-28 overflow-y-auto">
                  {prescriptions.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <span className="text-slate-800 font-medium">{p}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePrescription(idx)}
                        className="text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Quick Add Prescriptions */}
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Add medication or emergency order..."
                    value={newPrescriptionInput}
                    onChange={(e) => setNewPrescriptionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPrescription(newPrescriptionInput);
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddPrescription(newPrescriptionInput)}
                    className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {/* Preset Suggestions */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['Aspirin 325mg chewable', 'Nitroglycerin 0.4mg SL', 'Oxygen 4L/min', 'Stat ECG 12-lead'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddPrescription(preset)}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-600 cursor-pointer transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setExaminingCase(null)}
                  className="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingExam}
                  className="py-2 px-5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSavingExam ? 'Saving...' : 'Save & Sign Exam'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
