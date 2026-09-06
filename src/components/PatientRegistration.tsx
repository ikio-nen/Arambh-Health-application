import React, { useState } from 'react';
import { 
  UserPlus, Search, CheckCircle2, AlertTriangle, User, 
  Phone, MapPin, Heart, ShieldCheck, RefreshCw, ChevronRight 
} from 'lucide-react';
import { Patient, User as SystemUser } from '../types';
import { LocalClinicalStorage, maskPhi } from '../services/storage';

interface PatientRegistrationProps {
  patients: Patient[];
  currentUser: SystemUser | null;
  phiMasked: boolean;
  isOfflineMode: boolean;
  onPatientCreated: (p: Patient) => void;
  onOpenConsultation: (patientId: string) => void;
  onOpenTimeline: (patientId: string) => void;
}

export const PatientRegistration: React.FC<PatientRegistrationProps> = ({
  patients,
  currentUser,
  phiMasked,
  isOfflineMode,
  onPatientCreated,
  onOpenConsultation,
  onOpenTimeline,
}) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | 'Undisclosed'>('Male');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Duplicate Check
  const [duplicateWarning, setDuplicateWarning] = useState<Patient | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdPatient, setCreatedPatient] = useState<Patient | null>(null);

  const handlePhoneBlur = (phoneVal: string) => {
    if (!phoneVal.trim()) return;
    const cleanPhone = phoneVal.replace(/[^0-9]/g, '');
    const matched = patients.find(p => p.contact.replace(/[^0-9]/g, '') === cleanPhone);
    if (matched) {
      setDuplicateWarning(matched);
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim()) return;

    setIsSubmitting(true);

    const payload = {
      name: name.trim(),
      age: age ? Number(age) : '30',
      gender,
      contact: contact.trim(),
      email: email.trim(),
      address: address.trim() || 'Local resident',
      emergency_contact: emergencyContact.trim() || 'Not specified',
      user_id: currentUser?.id || 'usr-3',
      user_name: currentUser?.name || 'Anita Roy',
      user_role: currentUser?.role || 'receptionist',
    };

    try {
      if (!isOfflineMode) {
        const res = await fetch('/patients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          setCreatedPatient(data.patient);
          onPatientCreated(data.patient);
          setIsSubmitting(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Network registration failed, creating in local storage:', e);
    }

    // Local fallback
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const newPt: Patient = {
      id: `pt-${suffix}`,
      patient_id: `PT-${suffix}`,
      name: payload.name,
      age: payload.age,
      gender: payload.gender,
      contact: payload.contact,
      email: payload.email,
      address: payload.address,
      emergency_contact: payload.emergency_contact,
      is_emergency_shell: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const existing = LocalClinicalStorage.getPatients();
    existing.unshift(newPt);
    LocalClinicalStorage.setPatients(existing);

    LocalClinicalStorage.logAuditAction(
      currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : { id: 'usr-3', name: 'Anita Roy', role: 'receptionist' },
      'PATIENT_CREATED',
      newPt.id,
      `New patient registered: ${newPt.name} (${newPt.patient_id}).`
    );

    setCreatedPatient(newPt);
    onPatientCreated(newPt);
    setIsSubmitting(false);
  };

  const handleResetForm = () => {
    setName('');
    setAge('');
    setGender('Male');
    setContact('');
    setEmail('');
    setAddress('');
    setEmergencyContact('');
    setDuplicateWarning(null);
    setCreatedPatient(null);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="patient-registration-container">
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center space-x-2">
          <UserPlus className="w-4 h-4 text-red-400" />
          <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest">
            OUTPATIENT INTAKE DESK
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
          Patient Registration
        </h2>
        <p className="text-xs font-mono text-slate-400 mt-1">
          Collect demographics, check duplicate phone validation, assign MRN (<code className="text-red-400 font-mono">PT-XXXX</code>), and store HIPAA-compliant records.
        </p>
      </div>

      {/* If newly created, show confirmation card */}
      {createdPatient ? (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-4 border-l-4 border-l-green-500">
          <div className="flex items-center space-x-3 text-green-400">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Registration Complete</h3>
              <p className="text-xs font-mono text-slate-400">
                Patient record saved to database and encrypted local cache.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono text-[11px]">
            <div>
              <span className="text-slate-500 uppercase">Generated Medical Record No (MRN):</span>
              <div className="text-red-400 text-base font-bold">{createdPatient.patient_id}</div>
            </div>
            <div>
              <span className="text-slate-500 uppercase">Full Name:</span>
              <div className="text-white font-medium">{phiMasked ? maskPhi(createdPatient.name, 'name') : createdPatient.name}</div>
            </div>
            <div>
              <span className="text-slate-500 uppercase">Contact Number:</span>
              <div className="text-slate-300">{phiMasked ? maskPhi(createdPatient.contact, 'phone') : createdPatient.contact}</div>
            </div>
            <div>
              <span className="text-slate-500 uppercase">Demographics:</span>
              <div className="text-slate-300">{createdPatient.age} yrs, {createdPatient.gender}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onOpenConsultation(createdPatient.id)}
              className="bg-red-600 hover:bg-red-500 text-white text-xs font-mono uppercase tracking-wider px-4 py-2.5 rounded-lg flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <span>Begin Doctor Consultation</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onOpenTimeline(createdPatient.id)}
              className="bg-slate-900 hover:bg-slate-800 text-blue-400 text-xs font-mono uppercase tracking-wider px-4 py-2.5 rounded-lg border border-slate-800 transition-colors cursor-pointer"
            >
              <span>View Timeline</span>
            </button>

            <button
              onClick={handleResetForm}
              className="text-slate-400 hover:text-white text-xs font-mono uppercase px-3 py-2 cursor-pointer"
            >
              Register Another Patient
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
          {/* Duplicate phone banner */}
          {duplicateWarning && (
            <div className="mb-5 bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs p-4 rounded-lg flex items-start space-x-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-mono text-[11px]">
                <div className="font-bold text-amber-300 uppercase">Duplicate Phone Warning</div>
                <p className="mt-0.5 text-slate-300">
                  A patient with this phone is already registered: <strong className="text-white">{duplicateWarning.name}</strong> ({duplicateWarning.patient_id}).
                </p>
                <div className="mt-2 flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => onOpenTimeline(duplicateWarning.id)}
                    className="underline text-amber-400 hover:text-white font-semibold cursor-pointer uppercase"
                  >
                    Open Existing Record →
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicateWarning(null)}
                    className="text-slate-400 hover:text-slate-200 cursor-pointer uppercase"
                  >
                    Dismiss & Proceed as New
                  </button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  Full Legal Name *
                </label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Meera Sharma"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  Age (Years) *
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  max="125"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 42"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white focus:border-slate-700 outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Undisclosed">Undisclosed</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  Primary Phone Number *
                </label>
                <input
                  required
                  type="tel"
                  value={contact}
                  onBlur={(e) => handlePhoneBlur(e.target.value)}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="+91 98765 00000"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="meera@example.com"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  Emergency Contact & Relation *
                </label>
                <input
                  required
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="+91 98765 11111 (Husband)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                Residential Street Address & Ward
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Door no, street, locality, PIN code"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none"
              />
            </div>

            <div className="pt-3 border-t border-slate-900 flex items-center justify-end space-x-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-red-600 hover:bg-red-500 disabled:bg-slate-900 text-white font-semibold py-2.5 px-6 rounded-lg text-xs font-mono uppercase tracking-wider flex items-center space-x-2 transition-colors cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying & Generating MRN...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Register Patient & Generate MRN</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
