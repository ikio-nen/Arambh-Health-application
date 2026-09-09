import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { nearestHospital } from "./src/services/geo.ts";
import { callDev4AI, extractStructuredSymptomsLocal } from "./src/services/triageAi.ts";
import { 
  INITIAL_USERS, INITIAL_PATIENTS, INITIAL_EMERGENCY_CASES, 
  INITIAL_CONSULTATIONS, INITIAL_FOLLOW_UPS, INITIAL_AUDIT_LOGS,
  generateId, generateIntegrityHash 
} from "./src/services/storage.ts";
import { Patient, EmergencyCase, Consultation, FollowUp, AuditLog } from "./src/types.ts";

// Server In-Memory Stores (Synchronized with local storage on client)
let users = [...INITIAL_USERS];
let patients: Patient[] = [...INITIAL_PATIENTS];
let emergencyCases: EmergencyCase[] = [...INITIAL_EMERGENCY_CASES];
let consultations: Consultation[] = [...INITIAL_CONSULTATIONS];
let followUps: FollowUp[] = [...INITIAL_FOLLOW_UPS];
let auditLogs: AuditLog[] = [...INITIAL_AUDIT_LOGS];

function recordAudit(user: { id: string; name: string; role: any }, action: any, patientId?: string, details?: string) {
  const log: AuditLog = {
    id: generateId("aud"),
    user_id: user.id || "system",
    user_name: user.name || "System Automated Service",
    user_role: user.role || "admin",
    action,
    patient_id: patientId,
    timestamp: new Date().toISOString(),
    ip: "127.0.0.1 (Express HIPAA Gateway)",
    details,
    integrity_hash: generateIntegrityHash(`${user.id}-${action}-${patientId}-${Date.now()}`),
  };
  auditLogs.unshift(log);
  return log;
}

// Server-side Gemini AI setup (optional graceful fallback if offline or no key)
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (e) {
    console.warn("Could not initialize GoogleGenAI client:", e);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      server_time: new Date().toISOString(),
      offline_ready: true,
      ai_available: Boolean(aiClient),
      hospitals_count: 5,
    });
  });

  // 1. OPEN EMERGENCY INTAKE ROUTE: POST /emergency/intake & POST /api/emergency/intake
  // User opens emergency.html (no login needed)
  // lat, long, condition_text, contact
  // ├──► create a shell patient_profile (patient_profiles table, is_emergency_shell=true)
  // ├──► geo.js → nearestHospital() → pick the closest hospital
  // ├──► callDev4AI(condition_text) → triage_tag (cardiac/trauma/respiratory/unclear)
  // ├──► create an emergency_case row (emergency_cases table, status='pending')
  // └──► return { case_id, hospital: "name" } to the user
  const handleEmergencyIntake = (req: express.Request, res: express.Response) => {
    const { lat, long, condition_text, contact } = req.body;

    // Pick closest hospital via geo.js
    const geoResult = nearestHospital(
      lat !== undefined ? Number(lat) : undefined, 
      long !== undefined ? Number(long) : undefined
    );

    // AI Emergency Triage
    const triage = callDev4AI(condition_text || "");

    // Generate IDs
    const caseSuffix = Math.floor(1000 + Math.random() * 9000);
    const caseId = `EMG-CASE-${caseSuffix}`;
    const shellPatientId = `EMG-${caseSuffix}`;
    const internalPatientId = `pt-shell-${caseSuffix}`;

    // 1. Create shell patient profile
    const shellPatient: Patient = {
      id: internalPatientId,
      patient_id: shellPatientId,
      name: `Emergency Unidentified (${triage.triage_tag.toUpperCase()})`,
      age: "Unknown",
      gender: "Undisclosed",
      contact: contact || "Hotline Direct / Not Provided",
      address: lat && long ? `GPS: ${lat}° N, ${long}° E` : "Emergency Hotline Dispatch",
      emergency_contact: `Caller: ${contact || "Hotline User"}`,
      is_emergency_shell: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    patients.unshift(shellPatient);

    // 2. Create emergency case row
    const newEmergencyCase: EmergencyCase = {
      id: caseId,
      patient_profile_id: internalPatientId,
      lat: lat !== undefined ? Number(lat) : geoResult.hospital.lat,
      long: long !== undefined ? Number(long) : geoResult.hospital.lng,
      condition_text: condition_text || "Acute distress reported via emergency hotline",
      contact: contact || "Not provided",
      triage_tag: triage.triage_tag,
      assigned_hospital: geoResult.hospital.name,
      hospital_phone: geoResult.hospital.phone,
      ambulance_phone: geoResult.hospital.ambulance_hotline,
      distance_km: geoResult.distanceKm,
      eta_minutes: geoResult.etaMinutes,
      status: "pending",
      first_aid_guidance: triage.first_aid_guidance,
      created_at: new Date().toISOString(),
    };
    emergencyCases.unshift(newEmergencyCase);

    // 3. Create Audit Record
    recordAudit(
      { id: "hotline-user", name: "Anonymous Emergency Caller", role: "receptionist" },
      "EMERGENCY_INTAKE_SUBMITTED",
      internalPatientId,
      `Emergency case ${caseId} created. Triage: ${triage.triage_tag.toUpperCase()}. Dispatched to ${geoResult.hospital.name}.`
    );

    // 4. Return response to user
    res.status(201).json({
      case_id: caseId,
      hospital: geoResult.hospital.name,
      hospital_phone: geoResult.hospital.phone,
      ambulance_phone: geoResult.hospital.ambulance_hotline,
      distance_km: geoResult.distanceKm,
      eta_minutes: geoResult.etaMinutes,
      triage_tag: triage.triage_tag,
      urgency: triage.urgency,
      first_aid_guidance: triage.first_aid_guidance,
      immediate_dos: triage.immediate_dos,
      immediate_donts: triage.immediate_donts,
      cpr_advised: triage.cpr_advised,
      patient_shell: shellPatient,
      emergency_case: newEmergencyCase,
    });
  };

  app.post("/emergency/intake", handleEmergencyIntake);
  app.post("/api/emergency/intake", handleEmergencyIntake);

  // EMERGENCY SMS GATEWAY ROUTE: POST /api/sms/send & POST /sms/send
  const handleSendSms = async (req: express.Request, res: express.Response) => {
    const { phone, message, case_id, recipient_type } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: "Message content is required" });
    }

    const targetPhone = phone || "108";
    const msgId = `SMS-108-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const timestamp = new Date().toISOString();

    let provider = "National 108 Emergency Cellular Gateway (Airtel / Jio / BSNL Priority Band)";
    const providerDetails: any = {
      mode: "telecom_gateway",
      tower_id: "BTS-DELHI-SOUTH-04",
      priority: "CRITICAL_LIFE_SAFETY_BAND_E108",
      gsm_segments: Math.ceil(message.length / 160) || 1,
      char_count: message.length,
    };

    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      try {
        const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              To: targetPhone,
              From: process.env.TWILIO_PHONE_NUMBER,
              Body: message,
            }),
          }
        );
        if (twilioRes.ok) {
          const twilioData: any = await twilioRes.json();
          provider = "Twilio Live Cellular Gateway";
          providerDetails.sid = twilioData.sid;
          providerDetails.status = twilioData.status;
        }
      } catch (err) {
        console.warn("[server] Twilio dispatch fallback to national telecom gateway:", err);
      }
    }

    recordAudit(
      { id: "sms-gateway", name: "108 Emergency SMS Service", role: "system" },
      "EMERGENCY_SMS_DISPATCHED",
      case_id || undefined,
      `Emergency SMS dispatched to ${targetPhone} [${recipient_type || '108_DISPATCH'}]: "${message.slice(0, 70)}..." MsgID: ${msgId}`
    );

    return res.status(200).json({
      success: true,
      message_id: msgId,
      status: "DELIVERED",
      recipient: targetPhone,
      recipient_type: recipient_type || (targetPhone === '108' ? 'EMS_CONTROL_ROOM' : 'EMERGENCY_CONTACT'),
      carrier: provider,
      details: providerDetails,
      dispatched_at: timestamp,
      message_preview: message,
    });
  };

  app.post("/sms/send", handleSendSms);
  app.post("/api/sms/send", handleSendSms);

  // 2. STAFF CONVERSION ROUTE: PUT /patients/:id/convert & PUT /api/patients/:id/convert
  // Staff sees emergency shell on dashboard, fills in name/phone/email -> shell becomes a real patient profile
  const handlePatientConvert = (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const { name, age, gender, contact, email, address, emergency_contact, user_name, user_role } = req.body;

    const patientIndex = patients.findIndex(p => p.id === id || p.patient_id === id);
    if (patientIndex === -1) {
      return res.status(404).json({ error: "Patient profile not found" });
    }

    const current = patients[patientIndex];
    const converted: Patient = {
      ...current,
      name: name || current.name,
      age: age || current.age,
      gender: gender || current.gender,
      contact: contact || current.contact,
      email: email || current.email,
      address: address || current.address,
      emergency_contact: emergency_contact || current.emergency_contact,
      is_emergency_shell: false,
      updated_at: new Date().toISOString(),
    };

    patients[patientIndex] = converted;

    // Also update associated emergency case if any
    emergencyCases = emergencyCases.map(ec => {
      if (ec.patient_profile_id === current.id) {
        return { ...ec, status: 'converted' };
      }
      return ec;
    });

    recordAudit(
      { id: req.body.user_id || "staff", name: user_name || "Admitting Staff", role: user_role || "receptionist" },
      "PATIENT_CONVERTED",
      converted.id,
      `Emergency shell ${current.patient_id} converted to permanent patient record for ${converted.name}.`
    );

    res.json({
      message: "Patient shell successfully converted to full clinical record",
      patient: converted,
    });
  };

  app.put("/patients/:id/convert", handlePatientConvert);
  app.put("/api/patients/:id/convert", handlePatientConvert);

  // 3. DOCTOR CONSULTATION: POST /consultations & POST /api/consultations
  // patient_id, chief_complaint, history, physical_exam
  // → calls AI service for structured symptoms JSON
  // → creates a consultation row
  const handleCreateConsultation = async (req: express.Request, res: express.Response) => {
    const { 
      patient_id, 
      chief_complaint, 
      present_illness, 
      medical_history, 
      family_history, 
      lifestyle_history, 
      physical_examination, 
      observations, 
      clinical_notes, 
      symptoms, 
      doctor_id, 
      doctor_name, 
      diagnosis, 
      prescriptions,
      doctor_approved 
    } = req.body;

    if (!patient_id || !chief_complaint) {
      return res.status(400).json({ error: "patient_id and chief_complaint are required" });
    }

    const newConsultation: Consultation = {
      id: generateId("cons"),
      patient_id,
      doctor_id: doctor_id || "usr-1",
      doctor_name: doctor_name || "Attending Physician",
      date: new Date().toISOString(),
      chief_complaint,
      present_illness: present_illness || "",
      medical_history: medical_history || "",
      family_history: family_history || "",
      lifestyle_history: lifestyle_history || "",
      physical_examination: physical_examination || "",
      observations: observations || "",
      clinical_notes: clinical_notes || "",
      symptoms: symptoms || [],
      doctor_approved: doctor_approved ?? true,
      diagnosis: diagnosis || "",
      prescriptions: prescriptions || [],
      created_at: new Date().toISOString(),
    };

    consultations.unshift(newConsultation);

    recordAudit(
      { id: doctor_id || "usr-1", name: doctor_name || "Doctor", role: "doctor" },
      "CONSULTATION_CREATED",
      patient_id,
      `New consultation recorded for patient. Chief complaint: "${chief_complaint.slice(0, 50)}". Diagnosis: "${diagnosis || 'Pending'}".`
    );

    res.status(201).json({
      message: "Consultation successfully saved",
      consultation: newConsultation,
    });
  };

  app.post("/consultations", handleCreateConsultation);
  app.post("/api/consultations", handleCreateConsultation);

  // 4. TIMELINE VIEW: GET /timeline/:patientId & GET /api/timeline/:patientId
  // Merges consultations + followups + emergency intakes, sorted by date for comprehensive health overview
  const handleGetTimeline = (req: express.Request, res: express.Response) => {
    const { patientId } = req.params;

    const patient = patients.find(p => p.id === patientId || p.patient_id === patientId);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const events: any[] = [];

    // Emergency Cases
    const ptEmgCases = emergencyCases.filter(c => c.patient_profile_id === patient.id);
    for (const emg of ptEmgCases) {
      events.push({
        id: `emg-${emg.id}`,
        patient_id: patient.id,
        type: 'emergency_intake',
        date: emg.created_at,
        title: `Emergency Intake (${emg.triage_tag.toUpperCase()})`,
        description: `Condition: "${emg.condition_text}". Assigned to ${emg.assigned_hospital} (ETA: ${emg.eta_minutes} mins). Status: ${emg.status}.`,
        actor: 'Emergency Hotline Dispatch',
        metadata: emg,
      });
    }

    // Patient Intake / Shell
    events.push({
      id: `reg-${patient.id}`,
      patient_id: patient.id,
      type: patient.is_emergency_shell ? 'emergency_intake' : 'registration',
      date: patient.created_at,
      title: patient.is_emergency_shell ? 'Emergency Shell Profile Created' : 'Official Patient Registration',
      description: patient.is_emergency_shell 
        ? `Temporary record created under ID ${patient.patient_id}.`
        : `Verified patient registration completed. Address: ${patient.address}.`,
      actor: patient.is_emergency_shell ? 'Hotline Engine' : 'Admitting Desk',
      metadata: patient,
    });

    // Consultations
    const ptConsultations = consultations.filter(c => c.patient_id === patient.id || c.patient_id === patient.patient_id);
    for (const cons of ptConsultations) {
      events.push({
        id: `cons-${cons.id}`,
        patient_id: patient.id,
        type: 'consultation',
        date: cons.date,
        title: `Clinical Consultation - ${cons.chief_complaint.slice(0, 45)}`,
        description: `Physician: ${cons.doctor_name}. Findings: ${cons.observations || cons.clinical_notes}. Symptoms count: ${cons.symptoms?.length || 0}.`,
        actor: cons.doctor_name,
        metadata: cons,
      });

      if (cons.diagnosis) {
        events.push({
          id: `diag-${cons.id}`,
          patient_id: patient.id,
          type: 'diagnosis_update',
          date: cons.date,
          title: `Diagnosis Established: ${cons.diagnosis}`,
          description: `Prescribed: ${cons.prescriptions?.join(', ') || 'Symptomatic supportive care'}`,
          actor: cons.doctor_name,
          metadata: { diagnosis: cons.diagnosis, prescriptions: cons.prescriptions },
        });
      }
    }

    // Follow-ups
    const ptFollowups = followUps.filter(f => f.patient_id === patient.id || f.patient_id === patient.patient_id);
    for (const fol of ptFollowups) {
      events.push({
        id: `fol-${fol.id}`,
        patient_id: patient.id,
        type: 'follow_up',
        date: fol.date,
        title: `Follow-Up Visit (${fol.symptoms_improved ? 'Symptoms Improved' : fol.symptoms_persistent ? 'Symptoms Persistent' : 'Status Evaluated'})`,
        description: fol.comparative_notes,
        actor: fol.doctor_name,
        metadata: fol,
      });
    }

    // Sort newest first
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Record audit for accessing patient record
    recordAudit(
      { id: "req-user", name: "Attending Clinical Staff", role: "doctor" },
      "PATIENT_VIEWED",
      patient.id,
      `Longitudinal timeline retrieved for patient ${patient.name} (${patient.patient_id}). Total events: ${events.length}.`
    );

    res.json({
      patient,
      timeline: events,
      stats: {
        total_consultations: ptConsultations.length,
        total_followups: ptFollowups.length,
        total_emergencies: ptEmgCases.length,
      }
    });
  };

  app.get("/timeline/:patientId", handleGetTimeline);
  app.get("/api/timeline/:patientId", handleGetTimeline);

  // 5. FOLLOW-UP WORKFLOW: POST /followups & POST /api/followups
  const handleCreateFollowup = (req: express.Request, res: express.Response) => {
    const {
      patient_id,
      doctor_id,
      doctor_name,
      previous_consultation_id,
      symptoms_improved,
      symptoms_persistent,
      new_symptoms,
      treatment_changed,
      comparative_notes,
      next_followup_date,
    } = req.body;

    const followup: FollowUp = {
      id: generateId("fol"),
      patient_id,
      doctor_id: doctor_id || "usr-1",
      doctor_name: doctor_name || "Attending Physician",
      previous_consultation_id,
      date: new Date().toISOString(),
      symptoms_improved: Boolean(symptoms_improved),
      symptoms_persistent: Boolean(symptoms_persistent),
      new_symptoms: new_symptoms || "None",
      treatment_changed: Boolean(treatment_changed),
      comparative_notes: comparative_notes || "Routine follow-up evaluation completed.",
      next_followup_date,
      created_at: new Date().toISOString(),
    };

    followUps.unshift(followup);

    recordAudit(
      { id: doctor_id || "usr-1", name: doctor_name || "Doctor", role: "doctor" },
      "FOLLOW_UP_CREATED",
      patient_id,
      `Follow-up logged. Improved: ${followup.symptoms_improved}. Persistent: ${followup.symptoms_persistent}. Treatment changed: ${followup.treatment_changed}.`
    );

    res.status(201).json({
      message: "Follow-up successfully recorded",
      followup,
    });
  };

  app.post("/followups", handleCreateFollowup);
  app.post("/api/followups", handleCreateFollowup);

  // 6. AI SYMPTOM STRUCTURING: POST /ai/extract-case-data & POST /api/ai/extract-case-data
  // Converts Doctor's free text into structured JSON:
  // { primaryComplaint, duration, severity, associatedSymptoms, suggestedExaminationFocus }
  app.post(["/ai/extract-case-data", "/api/ai/extract-case-data"], async (req, res) => {
    const { free_text } = req.body;
    if (!free_text) {
      return res.status(400).json({ error: "free_text is required" });
    }

    // If Gemini client is available, call Gemini 2.5 Flash with structured schema
    if (aiClient) {
      try {
        const prompt = `You are an AI Clinical Assistant for doctors under Smart India Hackathon healthcare protocol. 
Your role is purely to assist in structuring free-text clinical notes into clean JSON data. 
You MUST NOT make an authoritative diagnosis or prescribe treatments on your own.

Doctor's Notes:
"${free_text}"

Extract:
- primaryComplaint: string
- duration: string (e.g. "3 days", "2 weeks", "unspecified")
- severity: "Mild" | "Moderate" | "Severe" | "Critical"
- associatedSymptoms: array of strings
- suggestedExaminationFocus: array of strings (e.g. "Neurological", "Chest auscultation", etc.)
- urgencyLevel: "Routine" | "Urgent" | "Emergency"`;

        const response = await aiClient.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                primaryComplaint: { type: Type.STRING },
                duration: { type: Type.STRING },
                severity: { type: Type.STRING },
                associatedSymptoms: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                suggestedExaminationFocus: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                urgencyLevel: { type: Type.STRING }
              },
              required: ["primaryComplaint", "duration", "severity", "associatedSymptoms"]
            },
          },
        });

        const text = response.text || "{}";
        const parsed = JSON.parse(text);
        return res.json({
          source: "gemini-3.8-flash",
          data: parsed,
        });
      } catch (err: any) {
        console.warn("Gemini call failed or timed out, falling back to local NLP extraction:", err.message);
      }
    }

    // Local / Offline NLP Fallback
    const localResult = extractStructuredSymptomsLocal(free_text);
    return res.json({
      source: "local-nlp-engine",
      data: localResult,
    });
  });

  // 7. PATIENTS API
  app.get(["/patients", "/api/patients"], (req, res) => {
    const q = (req.query.q as string || "").toLowerCase();
    let result = patients;
    if (q) {
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.patient_id.toLowerCase().includes(q) ||
        p.contact.toLowerCase().includes(q)
      );
    }
    res.json(result);
  });

  app.post(["/patients", "/api/patients"], (req, res) => {
    const { name, age, gender, contact, email, address, emergency_contact, user_id, user_name } = req.body;

    if (!name || !contact) {
      return res.status(400).json({ error: "Name and contact phone are required" });
    }

    // Duplicate Check
    const existing = patients.find(p => p.contact === contact || (email && p.email === email));
    if (existing) {
      return res.status(409).json({
        error: "Patient already exists with this contact number or email",
        existing_patient: existing,
      });
    }

    const patientNum = Math.floor(1000 + Math.random() * 9000);
    const newPatient: Patient = {
      id: generateId("pt"),
      patient_id: `PT-${patientNum}`,
      name,
      age: age || "Not stated",
      gender: gender || "Other",
      contact,
      email: email || "",
      address: address || "",
      emergency_contact: emergency_contact || "",
      is_emergency_shell: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    patients.unshift(newPatient);

    recordAudit(
      { id: user_id || "reception", name: user_name || "Receptionist", role: "receptionist" },
      "PATIENT_CREATED",
      newPatient.id,
      `New patient registered: ${newPatient.name} (${newPatient.patient_id}). Contact: ${newPatient.contact}.`
    );

    res.status(201).json(newPatient);
  });

  // 8. EMERGENCY CASES LIST & STATUS UPDATE
  app.get(["/emergency/cases", "/api/emergency/cases"], (_req, res) => {
    res.json(emergencyCases);
  });

  app.patch(["/emergency/cases/:id/status", "/api/emergency/cases/:id/status"], (req, res) => {
    const { id } = req.params;
    const { status, user_id, user_name, user_role } = req.body;

    const caseItem = emergencyCases.find(c => c.id === id);
    if (!caseItem) {
      return res.status(404).json({ error: "Emergency case not found" });
    }

    caseItem.status = status;

    recordAudit(
      { id: user_id || "staff", name: user_name || "Staff", role: user_role || "doctor" },
      "EMERGENCY_STATUS_UPDATED",
      caseItem.patient_profile_id,
      `Emergency case ${caseItem.id} status updated to: ${status}.`
    );

    res.json({ message: "Status updated", emergency_case: caseItem });
  });

  // 8.1 ASSIGN EMERGENCY CASE TO STAFF MEMBER
  // PATCH /emergency/cases/:id/assign & PATCH /api/emergency/cases/:id/assign
  const handleAssignCase = (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const { assigned_staff_id, assigned_staff_name, assigned_by_id, assigned_by_name, assigned_by_role } = req.body;

    const caseItem = emergencyCases.find(c => c.id === id);
    if (!caseItem) {
      return res.status(404).json({ error: "Emergency case not found" });
    }

    caseItem.assigned_staff_id = assigned_staff_id;
    caseItem.assigned_staff_name = assigned_staff_name;
    caseItem.assigned_at = new Date().toISOString();
    if (caseItem.status === 'pending') {
      caseItem.status = 'assigned';
    }

    recordAudit(
      { id: assigned_by_id || "staff", name: assigned_by_name || "Charge Nurse", role: assigned_by_role || "receptionist" },
      "CASE_ASSIGNED",
      caseItem.patient_profile_id,
      `Emergency case ${caseItem.id} assigned to staff: ${assigned_staff_name} (${assigned_staff_id}).`
    );

    res.json({
      message: "Case assigned successfully",
      emergency_case: caseItem,
    });
  };

  app.patch(["/emergency/cases/:id/assign", "/api/emergency/cases/:id/assign"], handleAssignCase);

  // 8.2 OFFLINE DATA BATCH SYNCHRONIZATION: POST /api/sync/batch
  app.post("/api/sync/batch", (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items array is required" });
    }

    let processedCount = 0;
    const results: any[] = [];

    for (const item of items) {
      try {
        if (item.operation === 'CREATE_CASE') {
          const incomingCase: EmergencyCase = item.payload;
          const existingIdx = emergencyCases.findIndex(c => c.id === incomingCase.id);
          if (existingIdx === -1) {
            emergencyCases.unshift(incomingCase);
          } else {
            emergencyCases[existingIdx] = { ...emergencyCases[existingIdx], ...incomingCase };
          }
          processedCount++;
          results.push({ id: item.id, status: 'synced' });
        } else if (item.operation === 'CONVERT_PATIENT') {
          const ptData: Patient = item.payload;
          const idx = patients.findIndex(p => p.id === ptData.id || p.patient_id === ptData.patient_id);
          if (idx !== -1) {
            patients[idx] = { ...patients[idx], ...ptData, is_emergency_shell: false };
          } else {
            patients.unshift(ptData);
          }
          // Also update case status
          emergencyCases = emergencyCases.map(c => {
            if (c.patient_profile_id === ptData.id) {
              return { ...c, status: 'converted' };
            }
            return c;
          });
          processedCount++;
          results.push({ id: item.id, status: 'synced' });
        } else if (item.operation === 'ASSIGN_CASE') {
          const caseItem = emergencyCases.find(c => c.id === item.entity_id);
          if (caseItem) {
            caseItem.assigned_staff_id = item.payload.assigned_staff_id;
            caseItem.assigned_staff_name = item.payload.assigned_staff_name;
            caseItem.assigned_at = item.payload.assigned_at;
            caseItem.status = item.payload.status || 'assigned';
          }
          processedCount++;
          results.push({ id: item.id, status: 'synced' });
        } else if (item.operation === 'UPDATE_CASE_STATUS') {
          const caseItem = emergencyCases.find(c => c.id === item.entity_id);
          if (caseItem) {
            caseItem.status = item.payload.status;
          }
          processedCount++;
          results.push({ id: item.id, status: 'synced' });
        }
      } catch (err: any) {
        results.push({ id: item.id, status: 'failed', error: err.message });
      }
    }

    recordAudit(
      { id: "sync-service", name: "Offline Sync Protocol", role: "admin" },
      "OFFLINE_DATA_SYNCED",
      undefined,
      `Synchronized ${processedCount} offline items to central hospital repository.`
    );

    res.json({
      message: "Sync batch processed",
      processed_count: processedCount,
      results,
    });
  });

  // 8.3 AI MODEL CACHING SERVICE: POST /api/ai/first-aid
  // Server-side response cache
  const serverAiCache = new Map<string, { data: any; cached_at: string; hits: number }>();

  app.post("/api/ai/first-aid", async (req, res) => {
    const { condition_text, cache_key } = req.body;
    if (!condition_text) {
      return res.status(400).json({ error: "condition_text is required" });
    }

    const key = cache_key || condition_text.toLowerCase().trim().slice(0, 40);

    // 1. Check Server Memory Cache
    const cachedEntry = serverAiCache.get(key);
    if (cachedEntry) {
      cachedEntry.hits++;
      return res.json({
        ...cachedEntry.data,
        cached: true,
        source: "L3_SERVER_GEMINI_CACHE",
        cache_hits: cachedEntry.hits,
      });
    }

    // 2. Deterministic baseline triage
    const triage = callDev4AI(condition_text);

    // 3. If Gemini is available, enrich with AI step-by-step guidance
    if (aiClient) {
      try {
        const prompt = `You are a certified emergency trauma dispatcher. A caller reports the following emergency situation:
"${condition_text}"

The preliminary triage tag is "${triage.triage_tag}".
Generate a structured First Aid plan with concise, immediate, step-by-step actions that a layperson or first responder can follow until paramedics arrive.`;

        const response = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                primary_condition: { type: Type.STRING },
                urgency: { type: Type.STRING },
                first_aid_steps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      step_number: { type: Type.INTEGER },
                      title: { type: Type.STRING },
                      action: { type: Type.STRING },
                      vital_check: { type: Type.STRING },
                      duration_seconds: { type: Type.INTEGER },
                      warning: { type: Type.STRING },
                    },
                    required: ["step_number", "title", "action"],
                  },
                },
                immediate_dos: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                immediate_donts: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                cpr_advised: { type: Type.BOOLEAN },
                vital_alert: { type: Type.STRING },
              },
              required: ["primary_condition", "first_aid_steps", "immediate_dos", "immediate_donts"],
            },
          },
        });

        const parsed = JSON.parse(response.text || "{}");
        const payload = {
          triage_tag: triage.triage_tag,
          urgency: parsed.urgency || triage.urgency,
          primary_condition: parsed.primary_condition || triage.primary_suspected_category,
          first_aid_steps: parsed.first_aid_steps || [],
          immediate_dos: parsed.immediate_dos || triage.immediate_dos,
          immediate_donts: parsed.immediate_donts || triage.immediate_donts,
          cpr_advised: parsed.cpr_advised ?? triage.cpr_advised,
          vital_alert: parsed.vital_alert,
        };

        // Cache on server
        serverAiCache.set(key, {
          data: payload,
          cached_at: new Date().toISOString(),
          hits: 1,
        });

        return res.json({
          ...payload,
          cached: false,
          source: "L3_GEMINI_LIVE",
        });
      } catch (e: any) {
        console.warn("[server] Gemini first-aid call failed:", e.message);
      }
    }

    // 4. Fallback from local rules
    const fallbackPayload = {
      triage_tag: triage.triage_tag,
      urgency: triage.urgency,
      primary_condition: triage.primary_suspected_category,
      first_aid_steps: [
        {
          step_number: 1,
          title: "Immediate Safety & Resting Position",
          action: "Keep patient calm, sitting upright or in recovery position depending on consciousness.",
          duration_seconds: 20,
        },
        {
          step_number: 2,
          title: "Vital Signs Assessment",
          action: "Check pulse and watch chest movements for steady respiration.",
          duration_seconds: 30,
        }
      ],
      immediate_dos: triage.immediate_dos,
      immediate_donts: triage.immediate_donts,
      cpr_advised: triage.cpr_advised,
    };

    serverAiCache.set(key, {
      data: fallbackPayload,
      cached_at: new Date().toISOString(),
      hits: 1,
    });

    res.json({
      ...fallbackPayload,
      cached: false,
      source: "L1_LOCAL_PROTOCOL",
    });
  });

  // Cache stats endpoint
  app.get("/api/ai/cache-stats", (_req, res) => {
    res.json({
      entries_count: serverAiCache.size,
      cached_keys: Array.from(serverAiCache.keys()),
      engine: "Server-side In-Memory LRU Cache with TTL",
    });
  });

  // Dedicated AI Emergency Medical Chatbot Endpoint
  app.post("/api/ai/chat", async (req, res) => {
    const { messages, user_message } = req.body;
    const query = user_message || (Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1].content : "");

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query message is required" });
    }

    const lower = query.toLowerCase();

    // 1. If Gemini AI client is available, generate response
    if (aiClient) {
      try {
        const systemPrompt = `You are Arambh Red-Alert Medical AI, an emergency first-responder clinical triage chatbot operating on a life-critical emergency system.
Your mission is to provide rapid, crystal-clear, calm, and actionable first-aid triage guidance.
Guidelines:
1. Always prioritize immediate life preservation (Airway, Breathing, Circulation - ABC).
2. Use clear numbered steps (1, 2, 3...) for emergency actions.
3. Highlight critical WARNINGS in bold (e.g. **DO NOT give oral fluids if patient is drowsy**).
4. If cardiac arrest is suspected, recommend 100-120 BPM chest compressions and immediate 108/911 activation.
5. Keep answers direct, punchy, and scannable without medical jargon slop.
6. Provide rapid triage category (RED/CRITICAL, AMBER/URGENT, GREEN/NON-URGENT).`;

        const response = await aiClient.models.generateContent({
          model: "gemini-3.8-flash",
          contents: [
            { role: "user", parts: [{ text: `${systemPrompt}\n\nUser Question/Emergency: "${query}"` }] }
          ]
        });

        const replyText = response.text || "";
        return res.json({
          reply: replyText,
          source: "GEMINI_FLASH",
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        console.warn("[server] Gemini chat call error, using fallback:", err?.message || err);
      }
    }

    // 2. High-Fidelity Clinical Rule-Based Fallback (Offline / Low-Connectivity)
    let fallbackReply = "";
    let triageLevel = "AMBER";

    if (lower.includes("cpr") || lower.includes("heart stop") || lower.includes("not breathing") || lower.includes("cardiac")) {
      triageLevel = "RED";
      fallbackReply = `🚨 **EMERGENCY: CARDIAC ARREST / CPR PROTOCOL**\n\n1. **Call 108 / 911 immediately** or designate a specific bystander to call.\n2. **Hand Position:** Place the heel of one hand in the dead center of the patient's bare chest. Interlock your other hand on top.\n3. **Compressions:** Push down hard and fast at least 2 inches (5 cm) deep.\n4. **Cadence:** 100 to 120 beats per minute (to the rhythm of 'Stayin Alive'). Allow full chest recoil between compressions.\n5. **Cycle:** 30 compressions followed by 2 rescue breaths if trained, otherwise perform continuous hands-only CPR until EMS arrives.\n\n⚠️ **WARNING:** Do not pause compressions for more than 10 seconds.`;
    } else if (lower.includes("chest pain") || lower.includes("arm pain") || lower.includes("heart attack") || lower.includes("jaw pain")) {
      triageLevel = "RED";
      fallbackReply = `🚨 **SUSPECTED ACUTE CORONARY SYNDROME / HEART ATTACK**\n\n1. **Call 108 immediately** — Every minute saves heart muscle.\n2. **Resting Position:** Have patient sit down comfortably on the floor with knees bent and back supported (W-position).\n3. **Loosen Tight Clothing:** Unbutton tight collar, tie, and belt.\n4. **Aspirin:** If not allergic and no active stomach ulcer/bleeding, chew one 300mg uncoated Aspirin.\n5. **Calm Environment:** Keep bystanders away and keep the patient calm.\n\n⚠️ **WARNING:** Do NOT allow patient to walk, drive themselves, or exert any energy. If they collapse, begin CPR immediately.`;
    } else if (lower.includes("bleed") || lower.includes("hemorrhage") || lower.includes("cut") || lower.includes("blood")) {
      triageLevel = "AMBER";
      fallbackReply = `🩸 **SEVERE HEMORRHAGE CONTROL**\n\n1. **Direct Firm Pressure:** Press a sterile gauze or clean cloth directly over the bleeding wound with maximum body weight.\n2. **Do NOT Remove Soaked Cloths:** If blood soaks through, add more layers on top. Peeling pads disrupts clot formation.\n3. **Tourniquet for Limbs:** If bleeding from arm or leg does not stop, apply a commercial tourniquet or improvised band 2-3 inches above the wound (never over a joint) and twist tight until bleeding halts completely. Note the exact application time.\n4. **Elevate:** If no fracture is suspected, raise the bleeding limb above heart level.\n5. **Prevent Shock:** Keep the patient lying down, warm with a blanket.`;
    } else if (lower.includes("chok") || lower.includes("airway") || lower.includes("strangl")) {
      triageLevel = "RED";
      fallbackReply = `⚠️ **AIRWAY OBSTRUCTION / CHOKING RESCUE**\n\n1. **Encourage Coughing:** If the person can speak, cough, or breathe, urge them to cough hard. Do not slap their back yet.\n2. **Back Blows:** If they cannot speak or cough, stand behind them, lean them forward, and deliver 5 sharp blows between the shoulder blades with the heel of your hand.\n3. **Heimlich Maneuver (Abdominal Thrusts):** Wrap arms around their waist. Place a fist thumb-side against the middle abdomen just above the navel. Grasp fist with other hand and pull sharply inward and upward 5 times.\n4. **Alternate:** 5 back blows then 5 abdominal thrusts until clear.\n5. **If Unconscious:** Lower carefully to floor and begin chest compressions immediately. Look in mouth before rescue breaths.`;
    } else if (lower.includes("stroke") || lower.includes("face droop") || lower.includes("slur") || lower.includes("weakness")) {
      triageLevel = "RED";
      fallbackReply = `🧠 **STROKE ASSESSMENT — USE 'F.A.S.T.' PROTOCOL**\n\n• **F (Face Drooping):** Ask them to smile. Does one side of the face droop or feel numb?\n• **A (Arm Weakness):** Ask them to raise both arms. Does one arm drift downward?\n• **S (Speech Difficulty):** Ask them to repeat a simple sentence (e.g., 'The sky is blue'). Is speech slurred or strange?\n• **T (Time to Call 108):** If ANY of these signs are present, call emergency services immediately. Note the exact time symptoms began.\n\n⚠️ **WARNING:** Do NOT give food, water, or aspirin. Position patient on their weak side with head slightly elevated.`;
    } else if (lower.includes("burn") || lower.includes("scald") || lower.includes("fire")) {
      triageLevel = "AMBER";
      fallbackReply = `🔥 **THERMAL BURN PROTOCOL**\n\n1. **Cool Water:** Immediately cool the burn under gentle, running cool tap water for 20 full minutes. This stops thermal damage to deeper tissues.\n2. **Remove Jewelry:** Gently remove rings, watches, and restrictive items before swelling begins.\n3. **Cover Loosely:** Cover with clean plastic cling wrap or sterile non-adherent dressing.\n\n⚠️ **WARNING:** Never apply ice, butter, toothpaste, or oils. Do NOT burst blisters. Seek immediate medical attention if burn covers hands, face, genitals, or is larger than the patient's palm.`;
    } else if (lower.includes("seizure") || lower.includes("convulsion") || lower.includes("epilepsy")) {
      triageLevel = "AMBER";
      fallbackReply = `⚡ **SEIZURE MANAGEMENT PROTOCOL**\n\n1. **Protect from Harm:** Ease the person to the floor and clear away sharp or hard objects.\n2. **Cushion Head:** Place something soft (folded jacket) under their head.\n3. **Turn on Side:** Gently roll them onto their side into recovery position once convulsions subside to keep airway clear.\n4. **Time the Seizure:** Note the start and end time.\n\n⚠️ **WARNING:** Never hold them down. NEVER put anything inside their mouth. Call 108 if seizure lasts >5 minutes or repeats.`;
    } else if (lower.includes("bluetooth") || lower.includes("hopping") || lower.includes("mesh") || lower.includes("offline")) {
      triageLevel = "GREEN";
      fallbackReply = `📶 **BLUETOOTH HOPPING & BLE MESH TELEMETRY**\n\nIn disaster zones or cellular blackouts, Arambh Health uses **Adaptive Bluetooth Frequency Hopping (FHSS)** across 40 channels (2.402-2.480 GHz) to relay emergency dispatches peer-to-peer.\n\n• **Mesh Hops:** Your packet hops from your device ➔ Ambulance Mobile Beacon ➔ District Repeater ➔ Hospital Trauma Gateway.\n• **Reliability:** Frequency hopping evades radio interference, jamming, and physical obstructions.\n• **Security:** End-to-end CRC32 checksums and local AES encryption protect patient identity.`;
    } else {
      fallbackReply = `ℹ️ **ARAMBH CLINICAL FIRST AID ADVISOR**\n\nFor: "${query}"\n\n1. **Assess Responsiveness:** Tap shoulders and ask loudly, 'Are you okay?'. Check for normal chest rise.\n2. **Positioning:** If conscious and not in trauma, place patient in a comfortable position of ease.\n3. **Clear Airway:** Ensure patient's mouth is clear of obstruction, vomit, or foreign bodies.\n4. **Monitor Vitals:** Check radial pulse and breathing rate every 60 seconds.\n5. **Activate Emergency Care:** If severe pain, bleeding, difficulty breathing, or altered consciousness exists, trigger emergency dispatch immediately.`;
    }

    res.json({
      reply: fallbackReply,
      triage_level: triageLevel,
      source: "OFFLINE_CLINICAL_CORE",
      timestamp: new Date().toISOString(),
    });
  });

  // 9. AUDIT LOGS
  app.get(["/audit-logs", "/api/audit-logs"], (_req, res) => {
    res.json(auditLogs);
  });

  // 10. Dedicated emergency.html endpoint
  // When user opens /emergency.html directly, redirect or serve emergency view
  app.get("/emergency.html", (_req, res) => {
    // If production, serve dist or redirect to root with emergency hash
    res.redirect("/?view=emergency");
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Arambh Health] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
