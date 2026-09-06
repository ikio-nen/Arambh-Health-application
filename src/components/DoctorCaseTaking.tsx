import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, Sparkles, CheckCircle2, Clock, AlertCircle, FileText, 
  User, RefreshCw, Edit3, ShieldAlert, Plus, Trash2, HeartPulse, ChevronRight 
} from 'lucide-react';
import { Patient, Consultation, Symptom, StructuredSymptomResponse, User as SystemUser } from '../types';
import { LocalClinicalStorage, maskPhi, generateId } from '../services/storage';

interface DoctorCaseTakingProps {
  patients: Patient[];
  selectedPatientId?: string;
  onSelectPatientId: (id: string) => void;
  currentUser: SystemUser | null;
  phiMasked: boolean;
  isOfflineMode: boolean;
  onConsultationSaved: (cons: Consultation) => void;
  onOpenTimeline: (patientId: string) => void;
}

export const DoctorCaseTaking: React.FC<DoctorCaseTakingProps> = ({
  patients,
  selectedPatientId,
  onSelectPatientId,
  currentUser,
  phiMasked,
  isOfflineMode,
  onConsultationSaved,
  onOpenTimeline,
}) => {
  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');

  // Structured Case Form Fields (PDF 2 Section 03)
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [presentIllness, setPresentIllness] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [familyHistory, setFamilyHistory] = useState('');
  const [lifestyleHistory, setLifestyleHistory] = useState('');
  const [physicalExamination, setPhysicalExamination] = useState('');
  const [observations, setObservations] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescriptionsText, setPrescriptionsText] = useState('');

  // Extracted Symptoms List
  const [symptomsList, setSymptomsList] = useState<Symptom[]>([]);

  // AI Assistance Layer (PDF 2 Section 04)
  const [freeTextAiInput, setFreeTextAiInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiStructuredPreview, setAiStructuredPreview] = useState<StructuredSymptomResponse | null>(null);
  const [doctorApprovalStatus, setDoctorApprovalStatus] = useState<boolean>(false);
  const [aiSource, setAiSource] = useState<string>('');

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync active patient
  useEffect(() => {
    if (selectedPatientId) {
      const found = patients.find(p => p.id === selectedPatientId || p.patient_id === selectedPatientId);
      if (found) {
        setActivePatient(found);
        // Preload any known history
        if (found.address.includes('GPS') && !medicalHistory) {
          setMedicalHistory('Patient admitted through Emergency Hotline dispatch.');
        }
      }
    } else if (patients.length > 0 && !activePatient) {
      setActivePatient(patients[0]);
    }
  }, [selectedPatientId, patients]);

  // Handle Free Text AI Structuring (PDF Section 04: AI Symptom Structuring Flow)
  const handleRunAiStructuring = async () => {
    if (!freeTextAiInput.trim()) return;
    setIsAiProcessing(true);
    setDoctorApprovalStatus(false);

    try {
      if (!isOfflineMode) {
        const res = await fetch('/ai/extract-case-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ free_text: freeTextAiInput }),
        });

        if (res.ok) {
          const result = await res.json();
          setAiStructuredPreview(result.data);
          setAiSource(result.source || 'gemini-3.8-flash');
          setIsAiProcessing(false);
          return;
        }
      }
    } catch (e) {
      console.warn('AI API call failed, falling back to local NLP extraction:', e);
    }

    // Local rule-based NLP extraction
    const { extractStructuredSymptomsLocal } = await import('../services/triageAi');
    const localData = extractStructuredSymptomsLocal(freeTextAiInput);
    setAiStructuredPreview(localData);
    setAiSource('local-nlp-engine (Offline Secure)');
    setIsAiProcessing(false);
  };

  // Doctor Approves AI Extraction (Doctor Approval step required by SIH document)
  const handleApproveAiExtraction = () => {
    if (!aiStructuredPreview) return;

    // Auto-fill chief complaint if empty
    if (!chiefComplaint) {
      setChiefComplaint(`${aiStructuredPreview.primaryComplaint} (${aiStructuredPreview.duration})`);
    }

    // Add primary complaint as symptom
    const newSyms: Symptom[] = [
      {
        id: generateId('sym'),
        symptom_name: aiStructuredPreview.primaryComplaint,
        duration: aiStructuredPreview.duration,
        severity: aiStructuredPreview.severity,
        associated_symptoms: aiStructuredPreview.associatedSymptoms,
      }
    ];

    // Add associated symptoms
    for (const assoc of aiStructuredPreview.associatedSymptoms) {
      if (assoc && assoc !== 'None reported explicitly') {
        newSyms.push({
          id: generateId('sym'),
          symptom_name: assoc,
          duration: aiStructuredPreview.duration,
          severity: 'Moderate',
        });
      }
    }

    setSymptomsList(prev => [...prev, ...newSyms]);

    if (aiStructuredPreview.suggestedExaminationFocus?.length && !physicalExamination) {
      setPhysicalExamination(`Recommended Focus: ${aiStructuredPreview.suggestedExaminationFocus.join(', ')}.`);
    }

    setDoctorApprovalStatus(true);
  };

  // Add custom manual symptom row
  const handleAddSymptomRow = () => {
    setSymptomsList(prev => [
      ...prev,
      {
        id: generateId('sym'),
        symptom_name: 'New Symptom',
        duration: '1 day',
        severity: 'Moderate',
      }
    ]);
  };

  // Remove symptom row
  const handleRemoveSymptom = (id: string) => {
    setSymptomsList(prev => prev.filter(s => s.id !== id));
  };

  // Save Consultation (POST /consultations)
  const handleSaveConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) return;
    if (!chiefComplaint.trim()) {
      alert('Please enter a chief complaint or use the AI symptom extraction assistant.');
      return;
    }

    setIsSaving(true);

    const prescriptionsArray = prescriptionsText
      .split('\n')
      .map(p => p.trim())
      .filter(Boolean);

    const payload = {
      patient_id: activePatient.id,
      doctor_id: currentUser?.id || 'usr-1',
      doctor_name: currentUser?.name || 'Dr. Arjun Mehta, MD',
      chief_complaint: chiefComplaint.trim(),
      present_illness: presentIllness.trim(),
      medical_history: medicalHistory.trim(),
      family_history: familyHistory.trim(),
      lifestyle_history: lifestyleHistory.trim(),
      physical_examination: physicalExamination.trim(),
      observations: observations.trim(),
      clinical_notes: clinicalNotes.trim(),
      symptoms: symptomsList,
      diagnosis: diagnosis.trim() || 'Clinical assessment documented',
      prescriptions: prescriptionsArray,
      doctor_approved: true,
      ai_structured_raw: aiStructuredPreview,
    };

    try {
      if (!isOfflineMode) {
        const res = await fetch('/consultations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          onConsultationSaved(data.consultation);
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
      console.warn('Network consultation save failed, saving to local storage:', e);
    }

    // Local / Offline storage
    const newCons: Consultation = {
      id: generateId('cons'),
      patient_id: payload.patient_id,
      doctor_id: payload.doctor_id,
      doctor_name: payload.doctor_name,
      date: new Date().toISOString(),
      chief_complaint: payload.chief_complaint,
      present_illness: payload.present_illness,
      medical_history: payload.medical_history,
      family_history: payload.family_history,
      lifestyle_history: payload.lifestyle_history,
      physical_examination: payload.physical_examination,
      observations: payload.observations,
      clinical_notes: payload.clinical_notes,
      symptoms: payload.symptoms,
      doctor_approved: true,
      diagnosis: payload.diagnosis,
      prescriptions: payload.prescriptions,
      created_at: new Date().toISOString(),
    };

    const existingCons = LocalClinicalStorage.getConsultations();
    existingCons.unshift(newCons);
    LocalClinicalStorage.setConsultations(existingCons);

    LocalClinicalStorage.logAuditAction(
      currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : { id: 'usr-1', name: 'Dr. Arjun Mehta, MD', role: 'doctor' },
      'CONSULTATION_CREATED',
      activePatient.id,
      `Consultation saved by ${newCons.doctor_name}. Diagnosis: "${newCons.diagnosis}".`
    );

    onConsultationSaved(newCons);
    setSaveSuccess(true);
    setIsSaving(false);
    setTimeout(() => {
      setSaveSuccess(false);
      onOpenTimeline(activePatient.id);
    }, 1200);
  };

  // Filtered patients list for selection
  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.patient_id.toLowerCase().includes(patientSearch.toLowerCase())
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="doctor-case-taking-container">
      {/* Top Header */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Stethoscope className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">
              PHYSICIAN CLINICAL MODULE
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
            Case-Taking & Clinical Evaluation
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Structured 8-part clinical examination form with AI symptom extraction and doctor approval step (<code className="text-red-400 font-mono">POST /consultations</code>).
          </p>
        </div>

        {activePatient && (
          <button
            type="button"
            onClick={() => onOpenTimeline(activePatient.id)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-blue-400 rounded-lg text-xs font-mono uppercase tracking-wider border border-slate-800 flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <span>View Timeline</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Patient Selector & AI Assistant */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                Select Patient
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {filteredPatients.length} records
              </span>
            </div>

            <input
              type="text"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder="Search by name or MRN (e.g. PT-1023)..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none"
            />

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {filteredPatients.map(p => (
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
                    <div className="font-medium flex items-center space-x-1">
                      <span>{phiMasked ? maskPhi(p.name, 'name') : p.name}</span>
                      {p.is_emergency_shell && (
                        <span className="text-[9px] font-mono px-1 py-0.2 bg-amber-950/50 text-amber-400 rounded border border-amber-800/60 uppercase">
                          Shell
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {p.patient_id} • {p.age}y • {p.gender}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </button>
              ))}
            </div>
          </div>

          {/* Active Patient Demographics Card */}
          {activePatient && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    {phiMasked ? maskPhi(activePatient.name, 'name') : activePatient.name}
                  </h3>
                  <p className="text-xs font-mono text-red-400">{activePatient.patient_id}</p>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                  {activePatient.gender}, {activePatient.age} yrs
                </span>
              </div>

              <div className="text-xs space-y-1.5 text-slate-300 font-mono text-[11px]">
                <div><span className="text-slate-500">Phone:</span> {phiMasked ? maskPhi(activePatient.contact, 'phone') : activePatient.contact}</div>
                <div><span className="text-slate-500">Address:</span> {phiMasked ? maskPhi(activePatient.address, 'address') : activePatient.address}</div>
                <div><span className="text-slate-500">Emergency:</span> {phiMasked ? maskPhi(activePatient.emergency_contact, 'phone') : activePatient.emergency_contact}</div>
                <div><span className="text-slate-500">File Opened:</span> {new Date(activePatient.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          )}

          {/* AI Symptom Structuring Assistant Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center space-x-2 text-blue-400">
              <Sparkles className="w-4 h-4" />
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
                AI Clinical Entity Structurer
              </h3>
            </div>
            <p className="text-xs font-mono text-slate-400 leading-relaxed">
              Type or dictate free-text notes. The AI extracts structured JSON (primary complaint, duration, severity, associated symptoms) without diagnosing.
            </p>

            <textarea
              rows={3}
              value={freeTextAiInput}
              onChange={(e) => setFreeTextAiInput(e.target.value)}
              placeholder="e.g. 'Severe pounding headache for 3 days with occasional dizziness, photophobia, and neck stiffness, no fever reported.'"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none"
            />

            <button
              type="button"
              onClick={handleRunAiStructuring}
              disabled={isAiProcessing || !freeTextAiInput.trim()}
              className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-50 text-blue-400 text-xs font-mono uppercase tracking-wider py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
            >
              {isAiProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Extracting Entities...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Structure Symptoms via AI</span>
                </>
              )}
            </button>

            {/* AI Extraction Preview & Doctor Approval Step */}
            {aiStructuredPreview && (
              <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px] text-blue-400 font-mono">
                  <span className="uppercase">Extracted Structured JSON</span>
                  <span className="text-[10px] text-slate-500">{aiSource}</span>
                </div>

                <div className="font-mono text-[11px] text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800 overflow-x-auto space-y-1">
                  <div><span className="text-red-400">primaryComplaint:</span> "{aiStructuredPreview.primaryComplaint}"</div>
                  <div><span className="text-amber-400">duration:</span> "{aiStructuredPreview.duration}"</div>
                  <div><span className="text-blue-400">severity:</span> "{aiStructuredPreview.severity}"</div>
                  <div><span className="text-green-400">associatedSymptoms:</span> {JSON.stringify(aiStructuredPreview.associatedSymptoms)}</div>
                  <div><span className="text-purple-400">examFocus:</span> {JSON.stringify(aiStructuredPreview.suggestedExaminationFocus)}</div>
                </div>

                {/* Doctor Approval step as mandated in PDF */}
                {!doctorApprovalStatus ? (
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={handleApproveAiExtraction}
                      className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 px-3 rounded-lg text-xs font-mono uppercase tracking-wider flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve & Auto-Fill</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-green-400 text-xs font-mono flex items-center space-x-1 pt-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Doctor approved extraction — form populated!</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Complete Structured Case Form */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl p-6">
          {saveSuccess && (
            <div className="mb-4 bg-green-950/30 border border-green-800/60 text-green-300 text-xs p-3.5 rounded-lg flex items-center space-x-2 font-mono">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span>Consultation recorded in database and timeline updated!</span>
            </div>
          )}

          <form onSubmit={handleSaveConsultation} className="space-y-5">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Clinical Examination Form
                </h3>
                <p className="text-xs font-mono text-slate-400">
                  Attending Physician: <span className="text-white">{currentUser?.name || 'Dr. Arjun Mehta, MD'}</span>
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded bg-slate-900 text-slate-300 font-mono border border-slate-800">
                Date: {new Date().toLocaleDateString()}
              </span>
            </div>

            {/* 1. Chief Complaint */}
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                1. Chief Complaint *
              </label>
              <input
                required
                type="text"
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="e.g. Throbbing headache for 3 days with occasional dizziness"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none"
              />
            </div>

            {/* Structured Symptoms Table */}
            <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                  Structured Symptoms Table
                </span>
                <button
                  type="button"
                  onClick={handleAddSymptomRow}
                  className="text-xs font-mono text-blue-400 hover:text-blue-300 flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Symptom</span>
                </button>
              </div>

              {symptomsList.length === 0 ? (
                <p className="text-xs font-mono text-slate-500">
                  No structured symptoms added yet. Use the AI Assistant on the left or click "Add Symptom".
                </p>
              ) : (
                <div className="space-y-2">
                  {symptomsList.map(sym => (
                    <div key={sym.id} className="grid grid-cols-12 gap-2 items-center bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono">
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={sym.symptom_name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSymptomsList(prev => prev.map(s => s.id === sym.id ? { ...s, symptom_name: val } : s));
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white focus:border-slate-700 outline-none text-xs"
                          placeholder="Symptom name"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={sym.duration}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSymptomsList(prev => prev.map(s => s.id === sym.id ? { ...s, duration: val } : s));
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white focus:border-slate-700 outline-none text-xs"
                          placeholder="Duration"
                        />
                      </div>
                      <div className="col-span-3">
                        <select
                          value={sym.severity}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setSymptomsList(prev => prev.map(s => s.id === sym.id ? { ...s, severity: val } : s));
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white focus:border-slate-700 outline-none text-xs"
                        >
                          <option value="Mild">Mild</option>
                          <option value="Moderate">Moderate</option>
                          <option value="Severe">Severe</option>
                          <option value="Critical">Critical</option>
                        </select>
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveSymptom(sym.id)}
                          className="text-slate-500 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Present Illness & 3. Medical History */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  2. Present Illness
                </label>
                <textarea
                  rows={2}
                  value={presentIllness}
                  onChange={(e) => setPresentIllness(e.target.value)}
                  placeholder="Onset, progression, aggravating/relieving factors..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  3. Medical History
                </label>
                <textarea
                  rows={2}
                  value={medicalHistory}
                  onChange={(e) => setMedicalHistory(e.target.value)}
                  placeholder="Prior conditions, surgeries, known allergies, chronic medications..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none"
                />
              </div>
            </div>

            {/* 4. Family History & 5. Lifestyle History */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  4. Family History
                </label>
                <input
                  type="text"
                  value={familyHistory}
                  onChange={(e) => setFamilyHistory(e.target.value)}
                  placeholder="Cardiac, diabetes, hypertension, hereditary patterns..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  5. Lifestyle History
                </label>
                <input
                  type="text"
                  value={lifestyleHistory}
                  onChange={(e) => setLifestyleHistory(e.target.value)}
                  placeholder="Occupation, screen hours, diet, exercise, smoking/alcohol..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none"
                />
              </div>
            </div>

            {/* 6. Physical Examination & 7. Observations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  6. Physical Examination
                </label>
                <textarea
                  rows={2}
                  value={physicalExamination}
                  onChange={(e) => setPhysicalExamination(e.target.value)}
                  placeholder="Vitals (BP, HR, RR, SpO2), systemic examination findings..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  7. Observations
                </label>
                <textarea
                  rows={2}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Physician clinical impression, differential considerations..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none"
                />
              </div>
            </div>

            {/* 8. Clinical Notes, Diagnosis & Prescriptions */}
            <div className="space-y-4 pt-2 border-t border-slate-900">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  8. Clinical Notes & Assessment
                </label>
                <textarea
                  rows={2}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Detailed physician narrative and follow-up guidance..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-red-400 uppercase tracking-widest mb-1">
                    Formulated Clinical Diagnosis
                  </label>
                  <input
                    type="text"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="e.g. Mixed Tension Cephalalgia / Stage 1 Hypertension"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-slate-700 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                    Prescriptions & Medications (one per line)
                  </label>
                  <textarea
                    rows={2}
                    value={prescriptionsText}
                    onChange={(e) => setPrescriptionsText(e.target.value)}
                    placeholder="Naproxen 500mg PRN&#10;Telmisartan 40mg OD"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-slate-700 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Save Action */}
            <div className="pt-4 border-t border-slate-900 flex items-center justify-end space-x-3">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-red-600 hover:bg-red-500 disabled:bg-slate-900 text-white font-semibold py-2.5 px-6 rounded-lg text-xs font-mono uppercase tracking-wider flex items-center space-x-2 transition-colors cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Save Consultation & Update Timeline</span>
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
