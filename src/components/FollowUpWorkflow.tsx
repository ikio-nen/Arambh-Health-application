import React, { useState, useEffect } from 'react';
import { 
  UserCheck, CheckCircle2, Clock, AlertCircle, RefreshCw, 
  HelpCircle, ChevronRight, Stethoscope, FileText 
} from 'lucide-react';
import { Patient, Consultation, FollowUp, User } from '../types';
import { LocalClinicalStorage, maskPhi, generateId } from '../services/storage';

interface FollowUpWorkflowProps {
  patients: Patient[];
  consultations: Consultation[];
  selectedPatientId?: string;
  onSelectPatientId: (id: string) => void;
  currentUser: User | null;
  phiMasked: boolean;
  isOfflineMode: boolean;
  onFollowUpSaved: (followup: FollowUp) => void;
  onOpenTimeline: (patientId: string) => void;
}

export const FollowUpWorkflow: React.FC<FollowUpWorkflowProps> = ({
  patients,
  consultations,
  selectedPatientId,
  onSelectPatientId,
  currentUser,
  phiMasked,
  isOfflineMode,
  onFollowUpSaved,
  onOpenTimeline,
}) => {
  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [patientConsultations, setPatientConsultations] = useState<Consultation[]>([]);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);

  // Comparative assessment fields (PDF Section 06)
  const [symptomsImproved, setSymptomsImproved] = useState<boolean>(true);
  const [symptomsPersistent, setSymptomsPersistent] = useState<boolean>(false);
  const [newSymptoms, setNewSymptoms] = useState<string>('');
  const [treatmentChanged, setTreatmentChanged] = useState<boolean>(false);
  const [comparativeNotes, setComparativeNotes] = useState<string>('');
  const [nextFollowupDate, setNextFollowupDate] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
    const cons = consultations.filter(c => c.patient_id === activePatient.id || c.patient_id === activePatient.patient_id);
    setPatientConsultations(cons);
    if (cons.length > 0) {
      setSelectedConsultation(cons[0]);
    } else {
      setSelectedConsultation(null);
    }
  }, [activePatient, consultations]);

  const handleSubmitFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) return;

    setIsSaving(true);

    const payload = {
      patient_id: activePatient.id,
      doctor_id: currentUser?.id || 'usr-1',
      doctor_name: currentUser?.name || 'Dr. Arjun Mehta, MD',
      previous_consultation_id: selectedConsultation?.id,
      symptoms_improved: symptomsImproved,
      symptoms_persistent: symptomsPersistent,
      new_symptoms: newSymptoms.trim() || 'None',
      treatment_changed: treatmentChanged,
      comparative_notes: comparativeNotes.trim() || 'Comparative clinical evaluation completed.',
      next_followup_date: nextFollowupDate || undefined,
    };

    try {
      if (!isOfflineMode) {
        const res = await fetch('/followups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          onFollowUpSaved(data.followup);
          setSaveSuccess(true);
          setIsSaving(false);
          setTimeout(() => {
            setSaveSuccess(false);
            onOpenTimeline(activePatient.id);
          }, 1200);
          return;
        }
      }
    } catch (e) {
      console.warn('Network followup call failed, saving locally:', e);
    }

    // Local / Offline storage
    const newFol: FollowUp = {
      id: generateId('fol'),
      patient_id: payload.patient_id,
      doctor_id: payload.doctor_id,
      doctor_name: payload.doctor_name,
      previous_consultation_id: payload.previous_consultation_id,
      date: new Date().toISOString(),
      symptoms_improved: payload.symptoms_improved,
      symptoms_persistent: payload.symptoms_persistent,
      new_symptoms: payload.new_symptoms,
      treatment_changed: payload.treatment_changed,
      comparative_notes: payload.comparative_notes,
      next_followup_date: payload.next_followup_date,
      created_at: new Date().toISOString(),
    };

    const allFollowups = LocalClinicalStorage.getFollowUps();
    allFollowups.unshift(newFol);
    LocalClinicalStorage.setFollowUps(allFollowups);

    LocalClinicalStorage.logAuditAction(
      currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : { id: 'usr-1', name: 'Dr. Arjun Mehta, MD', role: 'doctor' },
      'FOLLOW_UP_CREATED',
      activePatient.id,
      `Follow-up visit documented. Symptoms improved: ${newFol.symptoms_improved}. Treatment changed: ${newFol.treatment_changed}.`
    );

    onFollowUpSaved(newFol);
    setSaveSuccess(true);
    setIsSaving(false);
    setTimeout(() => {
      setSaveSuccess(false);
      onOpenTimeline(activePatient.id);
    }, 1200);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="followup-workflow-container">
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-green-400" />
            <span className="text-[10px] font-mono text-green-400 uppercase tracking-widest">
              LONGITUDINAL CONTINUITY
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
            Follow-Up Evaluation
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Compare previous baseline vs current condition (Symptoms Improved, Persistent, New Symptoms, Treatment Changed).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Select Patient & Previous Consultations */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">
              Select Patient for Review
            </span>

            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {patients.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActivePatient(p);
                    onSelectPatientId(p.id);
                  }}
                  className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                    activePatient?.id === p.id
                      ? 'bg-slate-900 text-white border border-red-800/80'
                      : 'bg-slate-900/50 hover:bg-slate-900 text-slate-300 border border-transparent'
                  }`}
                >
                  <div>
                    <div className="font-medium">
                      {phiMasked ? maskPhi(p.name, 'name') : p.name}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {p.patient_id} • {p.gender}, {p.age} yrs
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </button>
              ))}
            </div>
          </div>

          {/* Previous Consultation Summary */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">
              Baseline Consultation
            </span>

            {patientConsultations.length === 0 ? (
              <p className="text-xs font-mono text-slate-500">
                No previous consultations found for this patient. Please record a consultation first.
              </p>
            ) : (
              <div className="space-y-2">
                <select
                  value={selectedConsultation?.id || ''}
                  onChange={(e) => {
                    const found = patientConsultations.find(c => c.id === e.target.value);
                    setSelectedConsultation(found || null);
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-slate-700 outline-none font-mono"
                >
                  {patientConsultations.map(c => (
                    <option key={c.id} value={c.id}>
                      {new Date(c.date).toLocaleDateString()} — {c.chief_complaint.slice(0, 35)}...
                    </option>
                  ))}
                </select>

                {selectedConsultation && (
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs space-y-2">
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">Chief Complaint:</span>
                      <p className="text-slate-200 mt-0.5">{selectedConsultation.chief_complaint}</p>
                    </div>
                    {selectedConsultation.diagnosis && (
                      <div>
                        <span className="text-[10px] font-mono text-red-400 uppercase">Diagnosis:</span>
                        <p className="text-red-400 mt-0.5 font-medium">{selectedConsultation.diagnosis}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">Prescriptions:</span>
                      <p className="text-slate-300 font-mono text-[11px] mt-0.5">
                        {selectedConsultation.prescriptions?.join(', ') || 'None documented'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Follow-up Comparison Form */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl p-6">
          {saveSuccess && (
            <div className="mb-4 bg-green-950/30 border border-green-800/60 text-green-300 text-xs p-3.5 rounded-lg flex items-center space-x-2 font-mono">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span>Follow-up visit saved and timeline updated!</span>
            </div>
          )}

          <form onSubmit={handleSubmitFollowUp} className="space-y-5">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white tracking-tight">
                Compare Previous vs Current Condition
              </h3>
              <p className="text-xs font-mono text-slate-400">
                Patient: <span className="text-white">{activePatient ? (phiMasked ? maskPhi(activePatient.name, 'name') : activePatient.name) : 'None'}</span>
              </p>
            </div>

            {/* Comparative Checkboxes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Symptoms Improved */}
              <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">
                  1. Symptoms Improved?
                </span>
                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="symptoms_improved"
                      checked={symptomsImproved === true}
                      onChange={() => {
                        setSymptomsImproved(true);
                        setSymptomsPersistent(false);
                      }}
                      className="accent-green-500"
                    />
                    <span>Yes (Improvement noted)</span>
                  </label>
                  <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="symptoms_improved"
                      checked={symptomsImproved === false}
                      onChange={() => setSymptomsImproved(false)}
                      className="accent-red-500"
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>

              {/* Symptoms Persistent */}
              <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">
                  2. Symptoms Persistent?
                </span>
                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="symptoms_persistent"
                      checked={symptomsPersistent === true}
                      onChange={() => {
                        setSymptomsPersistent(true);
                        setSymptomsImproved(false);
                      }}
                      className="accent-red-500"
                    />
                    <span>Yes (Ongoing)</span>
                  </label>
                  <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="symptoms_persistent"
                      checked={symptomsPersistent === false}
                      onChange={() => setSymptomsPersistent(false)}
                      className="accent-green-500"
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 3. New Symptoms */}
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                3. New Symptoms Reported
              </label>
              <input
                type="text"
                value={newSymptoms}
                onChange={(e) => setNewSymptoms(e.target.value)}
                placeholder="e.g. None, or developed mild nausea on medication, dry cough, etc."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none"
              />
            </div>

            {/* 4. Treatment Changed */}
            <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">
                4. Treatment Regimen Changed?
              </span>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="treatment_changed"
                    checked={treatmentChanged === true}
                    onChange={() => setTreatmentChanged(true)}
                    className="accent-red-500"
                  />
                  <span>Yes (Dosage altered, discontinued, or new medication added)</span>
                </label>
                <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="treatment_changed"
                    checked={treatmentChanged === false}
                    onChange={() => setTreatmentChanged(false)}
                    className="accent-green-500"
                  />
                  <span>No (Continue ongoing therapy)</span>
                </label>
              </div>
            </div>

            {/* Comparative Notes */}
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                Comparative Clinical Evaluation & Progress Notes *
              </label>
              <textarea
                required
                rows={3}
                value={comparativeNotes}
                onChange={(e) => setComparativeNotes(e.target.value)}
                placeholder="Detail the patient's recovery trajectory, response to therapy, vital signs, and recommendations..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none"
              />
            </div>

            {/* Next Follow-up Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  Schedule Next Review Date
                </label>
                <input
                  type="date"
                  value={nextFollowupDate}
                  onChange={(e) => setNextFollowupDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-slate-700 outline-none font-mono"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-900 flex items-center justify-end space-x-3">
              <button
                type="submit"
                disabled={isSaving || !activePatient}
                className="bg-red-600 hover:bg-red-500 disabled:bg-slate-900 text-white font-semibold py-2.5 px-6 rounded-lg text-xs font-mono uppercase tracking-wider flex items-center space-x-2 transition-colors cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Follow-Up Record...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Save Follow-Up & Update Timeline</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
