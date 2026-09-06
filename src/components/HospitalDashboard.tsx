import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, Heart, Activity, AlertTriangle, ShieldCheck, 
  UserPlus, Clock, MapPin, CheckCircle2, ChevronRight, Phone, 
  RefreshCw, FileText, Lock, UserCheck, ShieldAlert, ArrowRight,
  Filter, Bell, Sparkles, Send
} from 'lucide-react';
import { EmergencyCase, Patient, User, EmergencyStatus } from '../types';
import { LocalClinicalStorage, INITIAL_USERS, maskPhi } from '../services/storage';
import { secureLocalDB } from '../services/secureLocalDatabase';

interface HospitalDashboardProps {
  emergencyCases: EmergencyCase[];
  patients: Patient[];
  currentUser: User | null;
  phiMasked: boolean;
  isOfflineMode: boolean;
  onPatientConverted: (patient: Patient) => void;
  onOpenConsultation: (patientId: string) => void;
  onOpenTimeline: (patientId: string) => void;
}

export const HospitalDashboard: React.FC<HospitalDashboardProps> = ({
  emergencyCases: initialCases,
  patients,
  currentUser,
  phiMasked,
  isOfflineMode,
  onPatientConverted,
  onOpenConsultation,
  onOpenTimeline,
}) => {
  const [cases, setCases] = useState<EmergencyCase[]>(initialCases);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [staffFilter, setStaffFilter] = useState<'all' | 'assigned_to_me' | 'unassigned'>('all');
  const [selectedCaseForConvert, setSelectedCaseForConvert] = useState<EmergencyCase | null>(null);
  const [selectedCaseForAssign, setSelectedCaseForAssign] = useState<EmergencyCase | null>(null);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [audioAlertEnabled, setAudioAlertEnabled] = useState<boolean>(false);
  const [statusFeedback, setStatusFeedback] = useState<string>('');

  // Conversion Form State
  const [convName, setConvName] = useState('');
  const [convAge, setConvAge] = useState('');
  const [convGender, setConvGender] = useState<'Male' | 'Female' | 'Other' | 'Undisclosed'>('Male');
  const [convPhone, setConvPhone] = useState('');
  const [convEmail, setConvEmail] = useState('');
  const [convAddress, setConvAddress] = useState('');
  const [convEmergencyContact, setConvEmergencyContact] = useState('');
  const [isSubmittingConvert, setIsSubmittingConvert] = useState(false);
  const [convertSuccessMsg, setConvertSuccessMsg] = useState('');

  // Keep cases in sync with props
  useEffect(() => {
    setCases(initialCases);
  }, [initialCases]);

  // Security Check: Verify User is Authorized Personnel (super_admin, admin, doctor, receptionist)
  const isAuthorized = currentUser && ['super_admin', 'admin', 'doctor', 'receptionist'].includes(currentUser.role);

  useEffect(() => {
    if (!isAuthorized) {
      LocalClinicalStorage.logAuditAction(
        currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : { id: 'anonymous', name: 'Unauthorized Visitor', role: 'receptionist' },
        'SECURITY_UNAUTHORIZED_ACCESS_BLOCKED',
        undefined,
        'Access to Emergency Hospital Staff Dashboard blocked: HIPAA Clearance required.'
      );
    }
  }, [isAuthorized, currentUser]);

  // Real-time polling updates
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (!isOfflineMode) {
        const res = await fetch('/api/emergency/cases');
        if (res.ok) {
          const freshCases = await res.json();
          setCases(freshCases);
          LocalClinicalStorage.setEmergencyCases(freshCases);
        }
      } else {
        const local = LocalClinicalStorage.getEmergencyCases();
        setCases(local);
      }
    } catch (e) {
      console.warn('Refresh failed:', e);
    } finally {
      setIsRefreshing(false);
      setLastRefreshed(new Date().toLocaleTimeString());
    }
  };

  // Auto-refresh interval every 6 seconds for live real-time status updates
  useEffect(() => {
    const interval = setInterval(() => {
      handleManualRefresh();
    }, 6000);
    return () => clearInterval(interval);
  }, [isOfflineMode]);

  // Handle Case Assignment to Specific Staff Member
  const handleAssignStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseForAssign || !assigneeId) return;

    setIsAssigning(true);
    const assignedUser = INITIAL_USERS.find(u => u.id === assigneeId);
    const staffName = assignedUser ? `${assignedUser.name} (${assignedUser.role.toUpperCase()})` : 'Assigned Emergency Responder';

    try {
      if (!isOfflineMode) {
        const res = await fetch(`/api/emergency/cases/${selectedCaseForAssign.id}/assign`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assigned_staff_id: assigneeId,
            assigned_staff_name: staffName,
            assigned_by_id: currentUser?.id,
            assigned_by_name: currentUser?.name,
            assigned_by_role: currentUser?.role,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setCases(prev => prev.map(c => c.id === data.emergency_case.id ? data.emergency_case : c));
          LocalClinicalStorage.setEmergencyCases(cases);
        }
      }
    } catch (err) {
      console.warn('Network assignment failed, persisting to secure local DB:', err);
    }

    // Local / Offline assignment persistence
    await secureLocalDB.assignEmergencyCase(selectedCaseForAssign.id, assigneeId, staffName, true);
    const updated = cases.map(c => {
      if (c.id === selectedCaseForAssign.id) {
        return {
          ...c,
          assigned_staff_id: assigneeId,
          assigned_staff_name: staffName,
          assigned_at: new Date().toISOString(),
          status: c.status === 'pending' ? 'assigned' as EmergencyStatus : c.status,
        };
      }
      return c;
    });
    setCases(updated);
    LocalClinicalStorage.setEmergencyCases(updated);

    LocalClinicalStorage.logAuditAction(
      currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : { id: 'staff', name: 'Charge Staff', role: 'doctor' },
      'CASE_ASSIGNED',
      selectedCaseForAssign.patient_profile_id,
      `Case ${selectedCaseForAssign.id} assigned to ${staffName}.`
    );

    setStatusFeedback(`Assigned case ${selectedCaseForAssign.id} to ${staffName}`);
    setTimeout(() => setStatusFeedback(''), 3500);
    setIsAssigning(false);
    setSelectedCaseForAssign(null);
  };

  // Handle Quick Status Change
  const handleUpdateStatus = async (caseId: string, newStatus: EmergencyStatus) => {
    try {
      if (!isOfflineMode) {
        await fetch(`/api/emergency/cases/${caseId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
            user_id: currentUser?.id,
            user_name: currentUser?.name,
            user_role: currentUser?.role,
          }),
        });
      }
    } catch (e) {
      console.warn('Network status update failed, applying local DB update:', e);
    }

    await secureLocalDB.updateEmergencyCaseStatus(caseId, newStatus, true);
    const updated = cases.map(c => c.id === caseId ? { ...c, status: newStatus } : c);
    setCases(updated);
    LocalClinicalStorage.setEmergencyCases(updated);

    LocalClinicalStorage.logAuditAction(
      currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : { id: 'staff', name: 'Staff', role: 'doctor' },
      'EMERGENCY_STATUS_UPDATED',
      cases.find(c => c.id === caseId)?.patient_profile_id,
      `Status updated to ${newStatus}`
    );

    setStatusFeedback(`Case ${caseId} status updated to: ${newStatus.toUpperCase()}`);
    setTimeout(() => setStatusFeedback(''), 3000);
  };

  // Open conversion modal
  const handleOpenConvertModal = (ec: EmergencyCase) => {
    setSelectedCaseForConvert(ec);
    const existingPatient = patients.find(p => p.id === ec.patient_profile_id);
    if (existingPatient) {
      setConvName(existingPatient.name.startsWith('Emergency') ? '' : existingPatient.name);
      setConvAge(existingPatient.age === 'Unknown' ? '' : String(existingPatient.age));
      setConvGender(existingPatient.gender);
      setConvPhone(existingPatient.contact.includes('Hotline') ? '' : existingPatient.contact);
      setConvEmail(existingPatient.email || '');
      setConvAddress(existingPatient.address || '');
      setConvEmergencyContact(existingPatient.emergency_contact || '');
    } else {
      setConvName('');
      setConvAge('');
      setConvGender('Male');
      setConvPhone(ec.contact || '');
      setConvEmail('');
      setConvAddress(`GPS: ${ec.lat}° N, ${ec.long}° E`);
      setConvEmergencyContact('');
    }
    setConvertSuccessMsg('');
  };

  // Submit PUT /patients/:id/convert
  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseForConvert) return;
    setIsSubmittingConvert(true);

    const payload = {
      name: convName.trim() || 'Verified Emergency Admitted Patient',
      age: convAge ? Number(convAge) : '35',
      gender: convGender,
      contact: convPhone.trim() || '+91 90000 00000',
      email: convEmail.trim(),
      address: convAddress.trim() || 'Admitted to Inpatient Ward',
      emergency_contact: convEmergencyContact.trim() || 'Family on record',
      user_id: currentUser?.id || 'staff-1',
      user_name: currentUser?.name || 'Admitting Receptionist',
      user_role: currentUser?.role || 'receptionist',
    };

    const targetPatientId = selectedCaseForConvert.patient_profile_id;

    try {
      if (!isOfflineMode) {
        const res = await fetch(`/patients/${targetPatientId}/convert`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          onPatientConverted(data.patient);
          setConvertSuccessMsg(`Successfully converted shell into verified patient profile ${data.patient.patient_id}!`);
          setIsSubmittingConvert(false);
          setTimeout(() => setSelectedCaseForConvert(null), 1200);
          return;
        }
      }
    } catch (err) {
      console.warn('Network convert failed, applying local conversion:', err);
    }

    // Local / Offline fallback
    const allPatients = LocalClinicalStorage.getPatients();
    const idx = allPatients.findIndex(p => p.id === targetPatientId || p.patient_id === targetPatientId);
    if (idx !== -1) {
      allPatients[idx] = {
        ...allPatients[idx],
        name: payload.name,
        age: payload.age,
        gender: payload.gender,
        contact: payload.contact,
        email: payload.email,
        address: payload.address,
        emergency_contact: payload.emergency_contact,
        is_emergency_shell: false,
        updated_at: new Date().toISOString(),
      };
      LocalClinicalStorage.setPatients(allPatients);
      secureLocalDB.savePatient(allPatients[idx], true);
      onPatientConverted(allPatients[idx]);
    }

    // Update emergency case status locally
    const updated = cases.map(c => c.id === selectedCaseForConvert.id ? { ...c, status: 'converted' as EmergencyStatus } : c);
    setCases(updated);
    LocalClinicalStorage.setEmergencyCases(updated);
    secureLocalDB.updateEmergencyCaseStatus(selectedCaseForConvert.id, 'converted', true);

    LocalClinicalStorage.logAuditAction(
      currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : { id: 'staff', name: 'Hospital Staff', role: 'receptionist' },
      'PATIENT_CONVERTED',
      targetPatientId,
      `Staff converted emergency shell ${selectedCaseForConvert.patient_profile_id} to real patient ${payload.name}`
    );

    setConvertSuccessMsg(`Shell successfully converted to permanent patient profile!`);
    setIsSubmittingConvert(false);
    setTimeout(() => setSelectedCaseForConvert(null), 1200);
  };

  // Filter cases logic
  const filteredCases = cases.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (staffFilter === 'assigned_to_me') {
      return c.assigned_staff_id === currentUser?.id;
    }
    if (staffFilter === 'unassigned') {
      return !c.assigned_staff_id;
    }
    return true;
  });

  // Render Secured Lock Screen if not authorized
  if (!isAuthorized) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-16" id="unauthorized-lock-screen">
        <div className="bg-neutral-950 border border-red-900/60 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 mx-auto bg-neutral-900 border border-red-800 rounded-full flex items-center justify-center text-red-500">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-red-950/50 border border-red-800/80 rounded-full text-red-400 text-xs font-mono uppercase tracking-widest mb-3">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Clearance Restricted • Staff Only</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Hospital Staff Clearance Required
            </h2>
            <p className="text-neutral-400 text-sm max-w-xl mx-auto mt-2 leading-relaxed">
              This dashboard provides real-time access to emergency triage tags and incoming casualty feeds. Current role: <strong className="text-red-400 font-mono">{currentUser?.role.toUpperCase() || 'UNAUTHENTICATED'}</strong>.
            </p>
          </div>

          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl text-xs font-mono text-neutral-300 max-w-md mx-auto text-left space-y-2">
            <div className="text-neutral-400 font-semibold uppercase text-[10px] tracking-wider">Authorized Role Profiles:</div>
            <div className="flex items-center space-x-2 text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Attending Physicians & Emergency Doctors</span>
            </div>
            <div className="flex items-center space-x-2 text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Emergency Triage & Admitting Receptionists</span>
            </div>
            <div className="flex items-center space-x-2 text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Hospital Security & Compliance Administrators</span>
            </div>
          </div>

          <div className="pt-2">
            <p className="text-xs text-neutral-500 font-mono mb-4">
              To proceed, switch your active session role using the role selector in the top-right header navigation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="hospital-dashboard-container">
      {/* Header & Status Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-neutral-950 border border-neutral-900 rounded-xl p-6 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
            <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest flex items-center space-x-1.5 font-bold">
              <span>LIVE EMERGENCY OPERATIONS FEED</span>
              <span className="text-neutral-600">•</span>
              <span className="text-neutral-400">SYNC: {lastRefreshed}</span>
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
            Intake & Dispatch Queue
          </h2>
          <p className="text-xs font-mono text-neutral-400 mt-1">
            Real-time emergency triage feed. Assign staff, update transit statuses, and convert shell intakes.
          </p>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-xs font-mono text-neutral-300 flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Poll server for new emergency cases"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-red-400' : 'text-neutral-400'}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Poll Updates'}</span>
          </button>

          {/* Staff Filter Tabs */}
          <div className="flex items-center space-x-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800 text-xs font-mono">
            <button
              onClick={() => setStaffFilter('all')}
              className={`px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-medium cursor-pointer ${
                staffFilter === 'all' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              All Staff ({cases.length})
            </button>
            <button
              onClick={() => setStaffFilter('assigned_to_me')}
              className={`px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-medium cursor-pointer ${
                staffFilter === 'assigned_to_me' ? 'bg-red-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Assigned To Me ({cases.filter(c => c.assigned_staff_id === currentUser?.id).length})
            </button>
            <button
              onClick={() => setStaffFilter('unassigned')}
              className={`px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-medium cursor-pointer ${
                staffFilter === 'unassigned' ? 'bg-neutral-800 text-red-400 font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Unassigned ({cases.filter(c => !c.assigned_staff_id).length})
            </button>
          </div>
        </div>
      </div>

      {/* Live Feedback Banner */}
      {statusFeedback && (
        <div className="bg-neutral-950 border border-red-800 text-red-300 px-4 py-2 rounded-lg text-xs font-mono flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-red-400" />
          <span>{statusFeedback}</span>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center space-x-1 overflow-x-auto pb-1 border-b border-neutral-900 text-xs font-mono">
        {[
          { id: 'all', label: 'All Cases' },
          { id: 'pending', label: 'Pending Dispatch' },
          { id: 'assigned', label: 'Staff Assigned' },
          { id: 'en_route', label: 'Ambulance En Route' },
          { id: 'arrived', label: 'Arrived at ER' },
          { id: 'converted', label: 'Converted Profile' },
        ].map(tab => {
          const count = tab.id === 'all' ? cases.length : cases.filter(c => c.status === tab.id).length;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-2 border-b-2 font-medium uppercase tracking-wider text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                filterStatus === tab.id 
                  ? 'border-red-600 text-red-400 font-bold' 
                  : 'border-transparent text-neutral-400 hover:text-white'
              }`}
            >
              {tab.label} <span className="text-[10px] opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Emergency Cases Grid */}
      {filteredCases.length === 0 ? (
        <div className="text-center py-16 bg-neutral-950 border border-neutral-900 rounded-xl space-y-3">
          <CheckCircle2 className="w-10 h-10 text-neutral-600 mx-auto" />
          <h3 className="text-base font-semibold text-white">No Emergency Cases in this Category</h3>
          <p className="text-xs text-neutral-400 font-mono">
            There are currently no cases matching the filter criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCases.map(ec => {
            const associatedPatient = patients.find(p => p.id === ec.patient_profile_id);
            const isShell = associatedPatient?.is_emergency_shell ?? true;

            const borderLeftColor = 
              ec.status === 'pending' ? 'border-l-4 border-l-red-600' :
              ec.status === 'assigned' ? 'border-l-4 border-l-red-400' :
              ec.status === 'en_route' ? 'border-l-4 border-l-amber-500' :
              ec.status === 'arrived' ? 'border-l-4 border-l-green-500' :
              ec.status === 'converted' ? 'border-l-4 border-l-neutral-400' :
              'border-l-4 border-l-red-600';

            return (
              <div
                key={ec.id}
                className={`bg-neutral-950 rounded-xl p-5 border border-neutral-900 ${borderLeftColor} flex flex-col justify-between space-y-4 hover:border-neutral-800 transition-colors shadow-sm`}
              >
                {/* Card Top: Triage Tag, Status & Assignment */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase flex items-center space-x-1.5 ${
                      ec.triage_tag === 'cardiac' ? 'bg-red-950/80 text-red-400 border border-red-800/80 font-bold' :
                      ec.triage_tag === 'trauma' ? 'bg-neutral-900 text-amber-400 border border-amber-900/60 font-bold' :
                      ec.triage_tag === 'respiratory' ? 'bg-neutral-900 text-red-300 border border-red-900/60 font-bold' :
                      'bg-neutral-900 text-neutral-400 border border-neutral-800'
                    }`}>
                      {ec.triage_tag === 'cardiac' && <Heart className="w-3 h-3 text-red-500" />}
                      {ec.triage_tag === 'trauma' && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                      {ec.triage_tag === 'respiratory' && <Activity className="w-3 h-3 text-red-400" />}
                      <span>{ec.triage_tag}</span>
                    </span>

                    {/* Status Dropdown */}
                    <div className="relative">
                      <select
                        value={ec.status}
                        onChange={(e) => handleUpdateStatus(ec.id, e.target.value as EmergencyStatus)}
                        className={`text-[9px] font-mono px-2 py-1 rounded uppercase border outline-none cursor-pointer ${
                          ec.status === 'pending' ? 'bg-red-950/80 text-red-300 border-red-800/80 font-bold' :
                          ec.status === 'assigned' ? 'bg-neutral-900 text-red-400 border-neutral-800 font-bold' :
                          ec.status === 'en_route' ? 'bg-neutral-900 text-amber-400 border-neutral-800 font-bold' :
                          ec.status === 'arrived' ? 'bg-neutral-900 text-green-400 border-neutral-800 font-bold' :
                          ec.status === 'converted' ? 'bg-neutral-900 text-neutral-300 border-neutral-800' :
                          'bg-neutral-900 text-neutral-300 border-neutral-800'
                        }`}
                      >
                        <option value="pending" className="bg-neutral-950 text-neutral-100">PENDING</option>
                        <option value="assigned" className="bg-neutral-950 text-neutral-100">ASSIGNED</option>
                        <option value="en_route" className="bg-neutral-950 text-neutral-100">EN ROUTE</option>
                        <option value="arrived" className="bg-neutral-950 text-neutral-100">ARRIVED AT ER</option>
                        <option value="converted" className="bg-neutral-950 text-neutral-100">CONVERTED</option>
                      </select>
                    </div>
                  </div>

                  {/* Case Title & ETA */}
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-bold text-white tracking-tight font-mono">
                      {ec.id}
                    </h3>
                    <span className="text-xs text-red-400 font-mono flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-red-500" />
                      <span>ETA ~{ec.eta_minutes}m ({ec.distance_km}km)</span>
                    </span>
                  </div>

                  {/* Patient Shell Information */}
                  <div className="text-xs text-neutral-400 mt-1 flex items-center space-x-2 font-mono text-[11px]">
                    <span>Shell:</span>
                    <span className="text-red-400 font-semibold">{associatedPatient?.patient_id || ec.patient_profile_id}</span>
                    {isShell ? (
                      <span className="text-[9px] bg-neutral-900 text-amber-400 px-1.5 py-0.5 rounded border border-neutral-800 uppercase">
                        Unverified Shell
                      </span>
                    ) : (
                      <span className="text-[9px] bg-neutral-900 text-green-400 px-1.5 py-0.5 rounded border border-neutral-800 uppercase">
                        Verified Profile
                      </span>
                    )}
                  </div>

                  {/* Staff Assignment Badge */}
                  <div className="mt-3 flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] font-mono">
                    <div className="flex items-center space-x-1.5 truncate">
                      <UserCheck className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      <span className="text-neutral-400">Assigned:</span>
                      <span className={`truncate font-semibold ${ec.assigned_staff_name ? 'text-white' : 'text-neutral-500'}`}>
                        {ec.assigned_staff_name || 'Unassigned'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedCaseForAssign(ec);
                        setAssigneeId(ec.assigned_staff_id || currentUser?.id || 'usr-1');
                      }}
                      className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider flex-shrink-0 ml-2 cursor-pointer"
                    >
                      {ec.assigned_staff_id ? 'Reassign' : 'Assign'}
                    </button>
                  </div>

                  {/* Condition Excerpt (Clear Patient Medical Info) */}
                  <div className="mt-3">
                    <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Initial Condition Report:</span>
                    </div>
                    <p className="text-xs text-neutral-200 p-3 rounded-lg bg-neutral-900 border border-neutral-800 leading-relaxed font-sans italic">
                      "{ec.condition_text}"
                    </p>
                  </div>

                  {/* Receiving Hospital & Contact Info */}
                  <div className="text-xs text-neutral-400 mt-3 space-y-1 font-mono text-[11px]">
                    <div className="flex items-center space-x-1.5 text-neutral-300">
                      <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      <span className="truncate">{ec.assigned_hospital}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-neutral-400">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Caller Contact: {phiMasked ? maskPhi(ec.contact, 'phone') : ec.contact}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-neutral-900 flex items-center gap-2">
                  {isShell ? (
                    <button
                      onClick={() => handleOpenConvertModal(ec)}
                      className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-colors cursor-pointer uppercase tracking-wider font-mono text-[11px]"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Convert Shell</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onOpenConsultation(ec.patient_profile_id)}
                      className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 border border-neutral-800 uppercase tracking-wider font-mono text-[11px] transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-red-400" />
                      <span>Doctor Intake</span>
                    </button>
                  )}

                  <button
                    onClick={() => onOpenTimeline(ec.patient_profile_id)}
                    title="View Longitudinal Timeline"
                    className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 p-2 rounded-lg border border-neutral-800 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ASSIGN STAFF MODAL */}
      {selectedCaseForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-950 border border-neutral-900 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
              <div>
                <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest font-bold">
                  STAFF ROSTER DISPATCH
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Assign Emergency Case
                </h3>
              </div>
              <button
                onClick={() => setSelectedCaseForAssign(null)}
                className="text-neutral-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-neutral-300 bg-neutral-900 p-3 rounded-lg border border-neutral-800 font-mono text-[11px]">
              <span className="text-red-400 font-bold">{selectedCaseForAssign.id}</span> • Triage: <span className="uppercase text-amber-400">{selectedCaseForAssign.triage_tag}</span>
              <p className="mt-1 text-neutral-400 italic truncate">"{selectedCaseForAssign.condition_text}"</p>
            </div>

            <form onSubmit={handleAssignStaffSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-widest mb-1.5">
                  Select Attending Physician / Trauma Staff *
                </label>
                <div className="space-y-2">
                  {INITIAL_USERS.map(u => (
                    <label
                      key={u.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        assigneeId === u.id 
                          ? 'bg-neutral-900 border-red-600 text-white' 
                          : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="staffAssignee"
                          value={u.id}
                          checked={assigneeId === u.id}
                          onChange={(e) => setAssigneeId(e.target.value)}
                          className="text-red-600 focus:ring-0"
                        />
                        <div>
                          <div className="text-xs font-semibold text-white">{u.name}</div>
                          <div className="text-[10px] text-neutral-400 font-mono">{u.department || u.role.toUpperCase()}</div>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded uppercase bg-neutral-950 text-neutral-400 border border-neutral-800">
                        {u.role}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => setSelectedCaseForAssign(null)}
                  className="px-4 py-2 rounded-lg text-xs font-mono text-neutral-400 hover:text-white uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 text-white px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider flex items-center space-x-1.5 transition-colors cursor-pointer font-bold"
                >
                  {isAssigning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                  <span>Confirm Assignment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONVERT SHELL TO REAL PATIENT PROFILE MODAL */}
      {selectedCaseForConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-neutral-950 border border-neutral-900 rounded-xl max-w-lg w-full p-6 space-y-4 my-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
              <div>
                <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest font-bold">
                  STAFF CONVERSION WORKFLOW
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Convert Shell to Permanent Record
                </h3>
              </div>
              <button
                onClick={() => setSelectedCaseForConvert(null)}
                className="text-neutral-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-neutral-300 bg-neutral-900 p-3 rounded-lg border border-neutral-800 font-mono text-[11px]">
              <span className="text-red-400 font-bold">Emergency Ref:</span> {selectedCaseForConvert.id} • Shell ID: <code className="text-red-400">{selectedCaseForConvert.patient_profile_id}</code>
            </div>

            {convertSuccessMsg && (
              <div className="bg-neutral-900 border border-green-800/60 text-green-300 text-xs p-3 rounded-lg flex items-center space-x-2 font-mono">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>{convertSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleConvertSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-widest mb-1">Full Name *</label>
                  <input
                    required
                    type="text"
                    value={convName}
                    onChange={(e) => setConvName(e.target.value)}
                    placeholder="e.g. Ramesh Chandra Verma"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-red-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-widest mb-1">Age *</label>
                  <input
                    required
                    type="text"
                    value={convAge}
                    onChange={(e) => setConvAge(e.target.value)}
                    placeholder="e.g. 52"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-red-600 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-widest mb-1">Gender</label>
                  <select
                    value={convGender}
                    onChange={(e) => setConvGender(e.target.value as any)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-red-600 outline-none"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Undisclosed">Undisclosed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-widest mb-1">Verified Phone *</label>
                  <input
                    required
                    type="tel"
                    value={convPhone}
                    onChange={(e) => setConvPhone(e.target.value)}
                    placeholder="+91 98112 00000"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-red-600 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-widest mb-1">Email Address</label>
                <input
                  type="email"
                  value={convEmail}
                  onChange={(e) => setConvEmail(e.target.value)}
                  placeholder="patient@example.com"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-red-600 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-widest mb-1">Home Residential Address</label>
                <input
                  type="text"
                  value={convAddress}
                  onChange={(e) => setConvAddress(e.target.value)}
                  placeholder="Street, locality, city"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-red-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-widest mb-1">Emergency Contact / Relative</label>
                <input
                  type="text"
                  value={convEmergencyContact}
                  onChange={(e) => setConvEmergencyContact(e.target.value)}
                  placeholder="e.g. +91 98112 11111 (Wife)"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-red-600 outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => setSelectedCaseForConvert(null)}
                  className="px-4 py-2 rounded-lg text-xs font-mono text-neutral-400 hover:text-white uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingConvert}
                  className="bg-red-600 hover:bg-red-500 disabled:bg-neutral-900 text-white px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider flex items-center space-x-1.5 transition-colors cursor-pointer font-bold"
                >
                  {isSubmittingConvert ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>Save & Convert</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
