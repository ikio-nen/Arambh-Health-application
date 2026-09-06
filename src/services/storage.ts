import { 
  User, Patient, EmergencyCase, Consultation, FollowUp, TimelineEvent, AuditLog, UserRole, AuditAction 
} from '../types';
import { secureLocalDB } from './secureLocalDatabase';

// Default initial system users matching PDF 1 & PDF 2
export const INITIAL_USERS: User[] = [
  {
    id: 'usr-1',
    name: 'Dr. Arjun Mehta, MD',
    email: 'doctor.mehta@arambhhealth.org',
    role: 'doctor',
    department: 'Cardiology & Acute Care',
    active: true,
    registeredAt: '2026-01-10T09:00:00Z',
    lastLogin: '2026-09-05T08:30:00Z',
  },
  {
    id: 'usr-2',
    name: 'Priya Sharma',
    email: 'priya.reception@arambhhealth.org',
    role: 'receptionist',
    department: 'Central Emergency Admitting',
    active: true,
    registeredAt: '2026-01-12T10:15:00Z',
    lastLogin: '2026-09-05T07:45:00Z',
  },
  {
    id: 'usr-3',
    name: 'Col. Rajesh Verma (Retd.)',
    email: 'admin.verma@arambhhealth.org',
    role: 'admin',
    department: 'Hospital Administration & Audits',
    active: true,
    registeredAt: '2026-01-05T08:00:00Z',
    lastLogin: '2026-09-05T09:12:00Z',
  },
  {
    id: 'usr-4',
    name: 'DevSys SuperAdmin',
    email: 'superadmin.core@arambhhealth.org',
    role: 'super_admin',
    department: 'Core Infrastructure & Security',
    active: true,
    registeredAt: '2026-01-01T00:00:00Z',
    lastLogin: '2026-09-05T03:00:00Z',
  },
];

// Seed patients
export const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'pt-1023',
    patient_id: 'PT-1023',
    name: 'Rohan Deshmukh',
    age: 48,
    gender: 'Male',
    contact: '+91 98201 44521',
    email: 'rohan.deshmukh@example.com',
    address: 'Flat 402, Green Meadows, Andheri East, Mumbai',
    emergency_contact: '+91 98201 99887 (Wife - Sunita)',
    is_emergency_shell: false,
    created_at: '2026-01-10T10:30:00Z',
    updated_at: '2026-02-20T11:00:00Z',
  },
  {
    id: 'pt-1045',
    patient_id: 'PT-1045',
    name: 'Ananya Iyer',
    age: 32,
    gender: 'Female',
    contact: '+91 94451 22890',
    email: 'ananya.iyer@example.com',
    address: 'B-12 Orchid Residency, Indiranagar, Bengaluru',
    emergency_contact: '+91 94451 88712 (Brother - Karthik)',
    is_emergency_shell: false,
    created_at: '2026-01-18T14:15:00Z',
    updated_at: '2026-03-01T15:30:00Z',
  },
  {
    id: 'pt-shell-8492',
    patient_id: 'EMG-8492',
    name: 'Emergency Shell Patient #8492',
    age: 'Unknown (Est. 55-60)',
    gender: 'Male',
    contact: '+91 98112 34567',
    address: 'Location via GPS: 28.6139° N, 77.2090° E (Ring Road)',
    emergency_contact: 'Caller: Dispatch Bystander',
    is_emergency_shell: true,
    created_at: '2026-09-05T09:45:00Z',
    updated_at: '2026-09-05T09:45:00Z',
  },
];

export const INITIAL_EMERGENCY_CASES: EmergencyCase[] = [
  {
    id: 'EMG-CASE-8492',
    patient_profile_id: 'pt-shell-8492',
    lat: 28.6139,
    long: 77.2090,
    condition_text: 'Severe chest tightness radiating to left shoulder and jaw, profuse cold sweating, clutched chest and collapsed while walking.',
    contact: '+91 98112 34567',
    triage_tag: 'cardiac',
    assigned_hospital: 'Arambh Metro Trauma Center & Super Specialty Hospital',
    hospital_phone: '+1 (800) 555-0199',
    ambulance_phone: '108 / 911 / +1 (800) 555-AMBU',
    distance_km: 1.8,
    eta_minutes: 5,
    status: 'pending',
    first_aid_guidance: [
      'Keep patient seated upright and resting in a comfortable position to reduce cardiac workload.',
      'Loosen tight clothing around neck and chest.',
      'Administer 300mg chewable aspirin if conscious and not allergic.',
      'Check breathing constantly; prepare to initiate CPR if pulse stops.'
    ],
    created_at: '2026-09-05T09:45:00Z',
  },
  {
    id: 'EMG-CASE-8491',
    patient_profile_id: 'pt-1023',
    lat: 28.6250,
    long: 77.2150,
    condition_text: 'Deep laceration on right forearm with heavy pulsing bleed after workshop glass collision.',
    contact: '+91 98201 44521',
    triage_tag: 'trauma',
    assigned_hospital: 'St. Jude Memorial Critical Care Hospital',
    hospital_phone: '+1 (800) 555-0244',
    ambulance_phone: '+1 (800) 555-9911',
    distance_km: 2.1,
    eta_minutes: 6,
    status: 'converted',
    first_aid_guidance: [
      'Apply firm direct pressure with clean sterile dressing.',
      'Maintain continuous compression; do not remove soaked cloths.',
      'Keep patient warm and elevate legs to prevent shock.'
    ],
    created_at: '2026-08-20T16:20:00Z',
  }
];

export const INITIAL_CONSULTATIONS: Consultation[] = [
  {
    id: 'cons-101',
    patient_id: 'pt-1023',
    doctor_id: 'usr-1',
    doctor_name: 'Dr. Arjun Mehta, MD',
    date: '2026-01-10T11:00:00Z',
    chief_complaint: 'Severe throbbing headache for 3 days with occasional dizziness and light sensitivity',
    present_illness: 'Patient reports progressive onset of hemicranial pulsating cephalalgia starting Thursday. Worsens with physical movement and bright LED lights. Mild nausea without vomiting.',
    medical_history: 'Known hypertension for 4 years on Telmisartan 40mg OD. No known drug allergies.',
    family_history: 'Father has history of ischemic heart disease; mother had recurrent migraines.',
    lifestyle_history: 'Desk worker, 10-12 hours screen exposure daily. Occasional social alcohol, non-smoker.',
    physical_examination: 'BP: 142/90 mmHg, HR: 76 bpm regular. Cranial nerves II-XII intact. Fundus examination normal, no papilledema. Neck supple, negative Kernig.',
    observations: 'Tension-vascular mixed headache pattern precipitated by digital fatigue and elevated blood pressure.',
    clinical_notes: 'Advised lifestyle modification, sleep hygiene, oral hydration, and temporary analgesic cover.',
    symptoms: [
      { id: 'sym-1', symptom_name: 'Throbbing Headache', duration: '3 days', severity: 'Severe', associated_symptoms: ['Dizziness', 'Photophobia'] },
      { id: 'sym-2', symptom_name: 'Occasional Dizziness', duration: '2 days', severity: 'Moderate' }
    ],
    doctor_approved: true,
    diagnosis: 'Mixed Vascular & Tension Cephalalgia / Stage 1 Hypertension',
    prescriptions: ['Naproxen 500mg PRN', 'Telmisartan 40mg OD (continue)', 'Magnesium glycinate 400mg at bedtime'],
    created_at: '2026-01-10T11:30:00Z',
  },
  {
    id: 'cons-102',
    patient_id: 'pt-1023',
    doctor_id: 'usr-1',
    doctor_name: 'Dr. Arjun Mehta, MD',
    date: '2026-02-20T10:30:00Z',
    chief_complaint: 'Trauma wound follow-up and intermittent exertional chest discomfort',
    present_illness: 'Laceration healing well with clean scar margin. Patient now mentions mild exertional chest heaviness after climbing 2 flights of stairs, resolving within 3 minutes of rest.',
    medical_history: 'Hypertension, post-traumatic glass laceration right forearm.',
    family_history: 'Father myocardial infarction at age 62.',
    lifestyle_history: 'Sedentary, high work stress.',
    physical_examination: 'BP: 130/84 mmHg on current meds. Normal S1/S2, no murmurs. Clear breath sounds bilaterally. Right forearm scar clean, no induration.',
    observations: 'Atypical angina vs exertional chest wall strain. Needs Treadmill Stress Test (TMT) and lipid profiling.',
    clinical_notes: 'Ordered 12-lead ECG, fasting lipid panel, Troponin I baseline. Patient warned regarding red flag symptoms.',
    symptoms: [
      { id: 'sym-3', symptom_name: 'Exertional Chest Tightness', duration: '1 week', severity: 'Moderate', associated_symptoms: ['Mild dyspnea on exertion'] }
    ],
    doctor_approved: true,
    diagnosis: 'Suspected Angina Pectoris / Essential Hypertension Controlled',
    prescriptions: ['Aspirin 75mg OD', 'Atorvastatin 20mg HS', 'Sublingual Sorbitrate 5mg SOS for chest pain'],
    created_at: '2026-02-20T11:00:00Z',
  }
];

export const INITIAL_FOLLOW_UPS: FollowUp[] = [
  {
    id: 'fol-201',
    patient_id: 'pt-1023',
    doctor_id: 'usr-1',
    doctor_name: 'Dr. Arjun Mehta, MD',
    previous_consultation_id: 'cons-101',
    date: '2026-01-20T10:00:00Z',
    symptoms_improved: true,
    symptoms_persistent: false,
    new_symptoms: 'None. Headache resolved by day 5.',
    treatment_changed: false,
    comparative_notes: 'BP stabilized at 128/82 mmHg. Sleep cycle improved. Headache subsided completely on Naproxen and posture correction.',
    next_followup_date: '2026-02-20',
    created_at: '2026-01-20T10:30:00Z',
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud-001',
    user_id: 'usr-1',
    user_name: 'Dr. Arjun Mehta, MD',
    user_role: 'doctor',
    action: 'LOGIN',
    timestamp: '2026-09-05T08:30:00Z',
    ip: '192.168.1.45 (Local Clinical Workstation)',
    details: 'Authenticated via secure JWT session token.',
    integrity_hash: 'sha256-a9f7832e18d6bc19c',
  },
  {
    id: 'aud-002',
    user_id: 'usr-2',
    user_name: 'Priya Sharma',
    user_role: 'receptionist',
    action: 'EMERGENCY_INTAKE_SUBMITTED',
    patient_id: 'pt-shell-8492',
    timestamp: '2026-09-05T09:45:00Z',
    ip: '192.168.1.10 (Reception Terminal 1)',
    details: 'Emergency intake shell created from hotline dispatch; triage tag: cardiac.',
    integrity_hash: 'sha256-b8120c99f82410a7b',
  },
  {
    id: 'aud-003',
    user_id: 'usr-1',
    user_name: 'Dr. Arjun Mehta, MD',
    user_role: 'doctor',
    action: 'PATIENT_VIEWED',
    patient_id: 'pt-1023',
    timestamp: '2026-09-05T09:50:00Z',
    ip: '192.168.1.45 (Local Clinical Workstation)',
    details: 'Viewed longitudinal timeline and medical history of patient Rohan Deshmukh.',
    integrity_hash: 'sha256-c47120a1129bcfe14',
  },
  {
    id: 'aud-004',
    user_id: 'usr-3',
    user_name: 'Col. Rajesh Verma (Retd.)',
    user_role: 'admin',
    action: 'LOGIN',
    timestamp: '2026-09-05T09:12:00Z',
    ip: '192.168.1.100 (Admin Security Console)',
    details: 'Auditor console session established. Verification passed.',
    integrity_hash: 'sha256-d92418eab3275cd88',
  }
];

// Helper to generate unique ID
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

// Simple simulated HMAC/Hash for HIPAA compliance audit trails
export function generateIntegrityHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `sha256-${Math.abs(hash).toString(16).padStart(8, '0')}${Date.now().toString(16)}`;
}

// Local Storage Keys
const STORAGE_KEYS = {
  USERS: 'arambh_users_v1',
  PATIENTS: 'arambh_patients_v1',
  EMERGENCY_CASES: 'arambh_emergency_cases_v1',
  CONSULTATIONS: 'arambh_consultations_v1',
  FOLLOW_UPS: 'arambh_followups_v1',
  AUDIT_LOGS: 'arambh_audit_logs_v1',
  CURRENT_USER: 'arambh_current_user_v1',
  PHI_MASKED: 'arambh_phi_masked_v1',
  ENCRYPTION_ENABLED: 'arambh_encryption_enabled_v1',
};

// Client-side persistence engine
export class LocalClinicalStorage {
  private static getItem<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private static setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('LocalStorage write error:', e);
    }
  }

  static getUsers(): User[] {
    return this.getItem<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
  }

  static setUsers(users: User[]): void {
    this.setItem(STORAGE_KEYS.USERS, users);
  }

  static getPatients(): Patient[] {
    return this.getItem<Patient[]>(STORAGE_KEYS.PATIENTS, INITIAL_PATIENTS);
  }

  static setPatients(patients: Patient[]): void {
    this.setItem(STORAGE_KEYS.PATIENTS, patients);
    // Asynchronously replicate to IndexedDB secure database
    if (typeof window !== 'undefined') {
      patients.forEach(p => secureLocalDB.savePatient(p, false).catch(() => {}));
    }
  }

  static getEmergencyCases(): EmergencyCase[] {
    return this.getItem<EmergencyCase[]>(STORAGE_KEYS.EMERGENCY_CASES, INITIAL_EMERGENCY_CASES);
  }

  static setEmergencyCases(cases: EmergencyCase[]): void {
    this.setItem(STORAGE_KEYS.EMERGENCY_CASES, cases);
    // Asynchronously replicate to IndexedDB secure database
    if (typeof window !== 'undefined') {
      cases.forEach(c => secureLocalDB.saveEmergencyCase(c, false).catch(() => {}));
    }
  }

  static getConsultations(): Consultation[] {
    return this.getItem<Consultation[]>(STORAGE_KEYS.CONSULTATIONS, INITIAL_CONSULTATIONS);
  }

  static setConsultations(consultations: Consultation[]): void {
    this.setItem(STORAGE_KEYS.CONSULTATIONS, consultations);
  }

  static getFollowUps(): FollowUp[] {
    return this.getItem<FollowUp[]>(STORAGE_KEYS.FOLLOW_UPS, INITIAL_FOLLOW_UPS);
  }

  static setFollowUps(followUps: FollowUp[]): void {
    this.setItem(STORAGE_KEYS.FOLLOW_UPS, followUps);
  }

  static getAuditLogs(): AuditLog[] {
    return this.getItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
  }

  static logAuditAction(
    user: { id: string; name: string; role: UserRole },
    action: AuditAction,
    patient_id?: string,
    details?: string
  ): AuditLog {
    const logs = this.getAuditLogs();
    const timestamp = new Date().toISOString();
    const logEntry: AuditLog = {
      id: generateId('aud'),
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      action,
      patient_id,
      timestamp,
      ip: '127.0.0.1 (Local Client Storage / Offline Secured)',
      details,
      integrity_hash: generateIntegrityHash(`${user.id}-${action}-${timestamp}-${patient_id || ''}`),
    };
    logs.unshift(logEntry);
    this.setItem(STORAGE_KEYS.AUDIT_LOGS, logs.slice(0, 500)); // Cap to recent 500
    return logEntry;
  }

  static getCurrentUser(): User {
    const stored = this.getItem<User | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (stored) return stored;
    return INITIAL_USERS[0]; // Default to Doctor for seamless clinical review
  }

  static setCurrentUser(user: User): void {
    this.setItem(STORAGE_KEYS.CURRENT_USER, user);
  }

  static getPhiMasked(): boolean {
    return this.getItem<boolean>(STORAGE_KEYS.PHI_MASKED, false);
  }

  static setPhiMasked(val: boolean): void {
    this.setItem(STORAGE_KEYS.PHI_MASKED, val);
  }

  static getEncryptionStatus(): boolean {
    return this.getItem<boolean>(STORAGE_KEYS.ENCRYPTION_ENABLED, true);
  }

  static setEncryptionStatus(val: boolean): void {
    this.setItem(STORAGE_KEYS.ENCRYPTION_ENABLED, val);
  }

  // Merged timeline calculation
  static getPatientTimeline(patientId: string): TimelineEvent[] {
    const events: TimelineEvent[] = [];
    const patients = this.getPatients();
    const patient = patients.find(p => p.id === patientId || p.patient_id === patientId);

    if (!patient) return [];

    // 1. Emergency Case Intake if exists
    const emergencyCases = this.getEmergencyCases().filter(c => c.patient_profile_id === patient.id);
    for (const emg of emergencyCases) {
      events.push({
        id: `evt-emg-${emg.id}`,
        patient_id: patient.id,
        type: 'emergency_intake',
        date: emg.created_at,
        title: `Emergency Hotline Intake (${emg.triage_tag.toUpperCase()})`,
        description: `Incoming condition: "${emg.condition_text.slice(0, 100)}..." Dispatched to ${emg.assigned_hospital} (ETA: ${emg.eta_minutes} mins).`,
        actor: 'Emergency Hotline Dispatch',
        metadata: emg,
      });
    }

    // 2. Patient Registration / Conversion
    events.push({
      id: `evt-reg-${patient.id}`,
      patient_id: patient.id,
      type: patient.is_emergency_shell ? 'emergency_intake' : 'registration',
      date: patient.created_at,
      title: patient.is_emergency_shell ? 'Temporary Emergency Shell Created' : 'Official Patient Registration',
      description: patient.is_emergency_shell 
        ? `Shell profile created for unverified patient ID ${patient.patient_id}. Awaiting staff bedside conversion.`
        : `Patient file opened with full verified demographics. Contact: ${patient.contact}.`,
      actor: patient.is_emergency_shell ? 'Emergency Intake API' : 'Receptionist Admitting Desk',
      metadata: patient,
    });

    // 3. Consultations
    const consultations = this.getConsultations().filter(c => c.patient_id === patient.id || c.patient_id === patient.patient_id);
    for (const cons of consultations) {
      events.push({
        id: `evt-cons-${cons.id}`,
        patient_id: patient.id,
        type: 'consultation',
        date: cons.date,
        title: `Doctor Consultation - ${cons.chief_complaint.slice(0, 50)}`,
        description: `Attending: ${cons.doctor_name}. Findings: ${cons.observations || cons.clinical_notes.slice(0, 80)}`,
        actor: cons.doctor_name,
        metadata: cons,
      });

      if (cons.diagnosis) {
        events.push({
          id: `evt-diag-${cons.id}`,
          patient_id: patient.id,
          type: 'diagnosis_update',
          date: cons.date,
          title: `Clinical Diagnosis Formulated: ${cons.diagnosis}`,
          description: `Prescribed: ${cons.prescriptions?.join(', ') || 'Under clinical observation'}`,
          actor: cons.doctor_name,
          metadata: { diagnosis: cons.diagnosis, prescriptions: cons.prescriptions },
        });
      }
    }

    // 4. Follow-ups
    const followups = this.getFollowUps().filter(f => f.patient_id === patient.id || f.patient_id === patient.patient_id);
    for (const fol of followups) {
      events.push({
        id: `evt-fol-${fol.id}`,
        patient_id: patient.id,
        type: 'follow_up',
        date: fol.date,
        title: `Follow-Up Review (Symptoms ${fol.symptoms_improved ? 'Improved' : fol.symptoms_persistent ? 'Persistent' : 'Changed'})`,
        description: fol.comparative_notes,
        actor: fol.doctor_name,
        metadata: fol,
      });
    }

    // Sort chronologically descending (newest first for medical charts, or toggle)
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // Emergency Contacts & Motion Fall Guard
  static getEmergencyContacts(): import('../types').EmergencyContactPerson[] {
    const raw = localStorage.getItem('arambh_emergency_contacts');
    if (!raw) {
      const defaultContacts: import('../types').EmergencyContactPerson[] = [
        {
          id: 'ec-1',
          name: 'Sunita Deshmukh',
          relationship: 'Spouse',
          phone: '+91 98201 11223',
          notifyOnFall: true,
          notifyOnSos: true,
        },
        {
          id: 'ec-2',
          name: 'Dr. Vivek Joshi',
          relationship: 'Family Physician',
          phone: '+91 98112 99887',
          notifyOnFall: true,
          notifyOnSos: true,
        },
      ];
      this.saveEmergencyContacts(defaultContacts);
      return defaultContacts;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveEmergencyContacts(contacts: import('../types').EmergencyContactPerson[]): void {
    localStorage.setItem('arambh_emergency_contacts', JSON.stringify(contacts));
  }
}

// HIPAA PHI Masking utility
export function maskPhi(value: string | number | undefined, type: 'phone' | 'address' | 'id' | 'name'): string {
  if (!value) return '';
  const str = String(value);

  switch (type) {
    case 'phone':
      // Show only last 4 digits: +91 •••• ••521
      return str.replace(/(\+?\d{2,3})?\s*(\d{3,5})\s*(\d{2,3})(\d{3,4})/, '$1 ••••• ••$4');
    case 'address':
      // Redact specific flat/street numbers: [Protected Residence], Mumbai
      const parts = str.split(',');
      if (parts.length > 1) {
        return `[Confidential Address], ${parts[parts.length - 1].trim()}`;
      }
      return '[Confidential Location]';
    case 'id':
      return str.slice(0, 3) + '•••' + str.slice(-2);
    case 'name':
      const names = str.split(' ');
      if (names.length > 1) {
        return `${names[0]} ${names[1].charAt(0)}.`;
      }
      return str;
    default:
      return str;
  }
}
