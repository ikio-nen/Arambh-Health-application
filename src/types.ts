export type UserRole = 'super_admin' | 'admin' | 'doctor' | 'receptionist';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  active: boolean;
  registeredAt: string;
  lastLogin?: string;
}

export interface Patient {
  id: string; // Internal UUID
  patient_id: string; // Human-readable ID like PT-1023 or EMG-8492
  name: string;
  age: number | string;
  gender: 'Male' | 'Female' | 'Other' | 'Undisclosed';
  contact: string;
  email?: string;
  address: string;
  emergency_contact: string;
  is_emergency_shell: boolean;
  created_at: string;
  updated_at: string;
}

export type TriageTag = 'cardiac' | 'trauma' | 'respiratory' | 'unclear';
export type EmergencyStatus = 'pending' | 'assigned' | 'dispatched' | 'en_route' | 'arrived' | 'admitted' | 'converted';

export interface Hospital {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  ambulance_hotline: string;
  trauma_level: 'Level 1' | 'Level 2' | 'Community Emergency';
  available_er_beds: number;
}

export interface FirstAidStep {
  step_number: number;
  title: string;
  action: string;
  vital_check?: string;
  duration_seconds?: number;
  warning?: string;
}

export interface EmergencyCase {
  id: string; // Case ID like EMG-CASE-8492
  patient_profile_id: string; // Reference to patient shell
  lat: number;
  long: number;
  condition_text: string;
  contact: string;
  triage_tag: TriageTag;
  assigned_hospital: string;
  hospital_phone: string;
  ambulance_phone: string;
  distance_km: number;
  eta_minutes: number;
  status: EmergencyStatus;
  first_aid_guidance: string[];
  first_aid_steps?: FirstAidStep[];
  assigned_staff_id?: string;
  assigned_staff_name?: string;
  assigned_at?: string;
  sync_status?: 'synced' | 'pending_sync' | 'sync_failed';
  offline_created?: boolean;
  created_at: string;
}

export interface SyncQueueItem {
  id: string;
  operation: 'CREATE_CASE' | 'CONVERT_PATIENT' | 'UPDATE_CASE_STATUS' | 'ASSIGN_CASE' | 'CREATE_PATIENT';
  table_name: 'emergency_cases' | 'patient_profiles';
  entity_id: string;
  payload: any;
  created_at: string;
  retry_count: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  error?: string;
}

export interface DatabaseStats {
  engine: string;
  encrypted: boolean;
  encryption_algorithm: string;
  tables: {
    name: string;
    count: number;
  }[];
  pending_sync_count: number;
  last_sync_timestamp?: string;
  cache_entries_count: number;
}

export interface Symptom {
  id: string;
  consultation_id?: string;
  symptom_name: string;
  duration: string;
  severity: 'Mild' | 'Moderate' | 'Severe' | 'Critical';
  associated_symptoms?: string[];
}

export interface Consultation {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string;
  date: string;
  chief_complaint: string;
  present_illness: string;
  medical_history: string;
  family_history: string;
  lifestyle_history: string;
  physical_examination: string;
  observations: string;
  clinical_notes: string;
  symptoms: Symptom[];
  ai_structured_raw?: any;
  doctor_approved: boolean;
  diagnosis?: string;
  prescriptions?: string[];
  created_at: string;
}

export interface FollowUp {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string;
  previous_consultation_id?: string;
  date: string;
  symptoms_improved: boolean;
  symptoms_persistent: boolean;
  new_symptoms: string;
  treatment_changed: boolean;
  comparative_notes: string;
  next_followup_date?: string;
  created_at: string;
}

export type TimelineEventType = 
  | 'emergency_intake'
  | 'registration'
  | 'consultation'
  | 'diagnosis_update'
  | 'treatment_update'
  | 'follow_up'
  | 'record_update';

export interface TimelineEvent {
  id: string;
  patient_id: string;
  type: TimelineEventType;
  date: string;
  title: string;
  description: string;
  actor: string;
  metadata?: Record<string, any>;
}

export type AuditAction = 
  | 'LOGIN'
  | 'LOGOUT'
  | 'PATIENT_CREATED'
  | 'PATIENT_UPDATED'
  | 'PATIENT_VIEWED'
  | 'PATIENT_CONVERTED'
  | 'CONSULTATION_CREATED'
  | 'CONSULTATION_UPDATED'
  | 'FOLLOW_UP_CREATED'
  | 'RECORD_DOWNLOADED'
  | 'USER_ROLE_CHANGED'
  | 'USER_CREATED'
  | 'EMERGENCY_INTAKE_SUBMITTED'
  | 'EMERGENCY_STATUS_UPDATED'
  | 'CASE_ASSIGNED'
  | 'OFFLINE_DATA_SYNCED'
  | 'SECURITY_UNAUTHORIZED_ACCESS_BLOCKED'
  | 'AI_CACHE_CLEARED';

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  user_role: UserRole;
  action: AuditAction;
  patient_id?: string;
  timestamp: string;
  ip: string;
  details?: string;
  integrity_hash: string;
}

export interface StructuredSymptomResponse {
  primaryComplaint: string;
  duration: string;
  severity: 'Mild' | 'Moderate' | 'Severe' | 'Critical';
  associatedSymptoms: string[];
  suggestedExaminationFocus?: string[];
  urgencyLevel?: 'Routine' | 'Urgent' | 'Emergency';
}

export interface EmergencyContactPerson {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  notifyOnFall: boolean;
  notifyOnSos: boolean;
}

export interface HospitalEvaluation {
  hospital: Hospital;
  distanceKm: number;
  etaMinutes: number;
  availableBeds: number;
  score: number;
  isBestChoice: boolean;
  recommendationReason: string;
}
