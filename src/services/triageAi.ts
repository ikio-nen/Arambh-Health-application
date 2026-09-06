import { TriageTag, StructuredSymptomResponse } from '../types';

export interface TriageResult {
  triage_tag: TriageTag;
  urgency: 'Immediate' | 'Urgent' | 'Standard';
  primary_suspected_category: string;
  first_aid_guidance: string[];
  immediate_dos: string[];
  immediate_donts: string[];
  cpr_advised: boolean;
}

/**
 * Dev 4 AI Emergency Triage & First Aid Assistant
 * Categorizes condition into cardiac, trauma, respiratory, or unclear
 * and delivers immediate life-saving first-aid instructions while ambulance is en route.
 */
export function callDev4AI(conditionText: string): TriageResult {
  const text = (conditionText || '').toLowerCase();

  // Cardiac indicators
  const cardiacKeywords = [
    'chest pain', 'chest tightness', 'heart', 'cardiac', 'arm pain', 'jaw pain', 
    'left arm', 'palpitations', 'heart attack', 'myocardial', 'angina', 'crushing pain',
    'collapsing', 'pulse weak', 'cardiac arrest', 'clutched chest'
  ];

  // Trauma indicators
  const traumaKeywords = [
    'bleed', 'bleeding', 'blood', 'fracture', 'broken', 'bone', 'wound', 'accident',
    'crash', 'stab', 'cut', 'fall', 'head injury', 'concussion', 'burn', 'deep cut',
    'amputation', 'crushed', 'puncture', 'bullet', 'trauma'
  ];

  // Respiratory indicators
  const respiratoryKeywords = [
    'breath', 'breathing', 'suffocating', 'asthma', 'choking', 'wheezing', 'gasping',
    'inhaler', 'shortness of breath', 'cyanosis', 'blue lips', 'stridor', 'drowning',
    'anaphylaxis', 'allergic', 'throat swelling'
  ];

  let cardiacScore = 0;
  let traumaScore = 0;
  let respiratoryScore = 0;

  for (const kw of cardiacKeywords) {
    if (text.includes(kw)) cardiacScore += 2;
  }
  for (const kw of traumaKeywords) {
    if (text.includes(kw)) traumaScore += 2;
  }
  for (const kw of respiratoryKeywords) {
    if (text.includes(kw)) respiratoryScore += 2;
  }

  let tag: TriageTag = 'unclear';

  if (cardiacScore > 0 || traumaScore > 0 || respiratoryScore > 0) {
    if (cardiacScore >= traumaScore && cardiacScore >= respiratoryScore) {
      tag = 'cardiac';
    } else if (traumaScore >= cardiacScore && traumaScore >= respiratoryScore) {
      tag = 'trauma';
    } else {
      tag = 'respiratory';
    }
  }

  // Generate specialized first aid instructions tailored to the triage tag
  switch (tag) {
    case 'cardiac':
      return {
        triage_tag: 'cardiac',
        urgency: 'Immediate',
        primary_suspected_category: 'Acute Cardiac Event / Angina / Coronary Syndrome',
        first_aid_guidance: [
          'Keep patient seated upright and resting in a comfortable position (semi-recumbent) to reduce cardiac workload.',
          'Loosen all tight clothing around the neck, chest, and waist immediately.',
          'If patient is conscious and not allergic to aspirin, chew 300mg soluble aspirin slowly.',
          'If patient has prescribed nitroglycerin (sorbitrate/glyceryl trinitrate), administer one tablet under the tongue.',
          'Monitor consciousness and breathing continuously. If patient becomes unresponsive and stops breathing, START CPR IMMEDIATELY (100-120 chest compressions per minute).',
          'Locate the nearest Automated External Defibrillator (AED) if available in the building.'
        ],
        immediate_dos: [
          'Keep patient completely calm and still',
          'Administer prescribed cardiac medication if authorized',
          'Stay on speakerphone with emergency dispatch'
        ],
        immediate_donts: [
          'Do NOT allow patient to walk, drive, or exert themselves',
          'Do NOT give solid foods or caffeinated drinks',
          'Do NOT leave patient unattended'
        ],
        cpr_advised: text.includes('unconscious') || text.includes('stopped breathing') || text.includes('no pulse')
      };

    case 'trauma':
      return {
        triage_tag: 'trauma',
        urgency: 'Immediate',
        primary_suspected_category: 'Severe Trauma / Hemorrhage / Musculoskeletal Injury',
        first_aid_guidance: [
          'Control Active Bleeding: Apply firm, direct pressure over the wound using a clean sterile dressing, cloth, or gauze.',
          'Maintain Continuous Pressure: Do not remove soaked cloths; stack clean layers directly on top and continue pressing.',
          'If bleeding is from a limb and life-threatening arterial blood is spurting, apply a tourniquet 2-3 inches above the wound (note exact time applied).',
          'Suspected Spinal/Neck Injury: Keep patient completely immobilized. Do NOT move their head or neck unless in imminent physical danger.',
          'Elevate legs 12 inches (Trendelenburg position) if signs of hypovolemic shock appear (pale, cold, sweaty skin), UNLESS head/spinal injury is suspected.',
          'Cover the patient with a warm blanket or coat to prevent hypothermia.'
        ],
        immediate_dos: [
          'Apply firm direct pressure with clean material',
          'Immobilize any suspected fractured limb',
          'Keep patient warm and reassure them'
        ],
        immediate_donts: [
          'Do NOT remove deeply embedded foreign objects (knife, glass) — stabilize around them',
          'Do NOT straighten deformed fractures or joints',
          'Do NOT give liquids if emergency surgery may be imminent'
        ],
        cpr_advised: false
      };

    case 'respiratory':
      return {
        triage_tag: 'respiratory',
        urgency: 'Immediate',
        primary_suspected_category: 'Acute Respiratory Distress / Severe Bronchospasm / Airway Obstruction',
        first_aid_guidance: [
          'Position: Help the patient sit upright leaning slightly forward (tripod position) with arms resting on knees or table to maximize lung expansion.',
          'Check Airway: Look for foreign body obstruction. If patient is choking and conscious, administer 5 back blows followed by 5 abdominal thrusts (Heimlich maneuver).',
          'Rescue Inhaler: If the patient has an asthma rescue inhaler (albuterol/salbutamol), administer 2-4 puffs via spacer immediately, repeating every 4-5 minutes if distress continues.',
          'Severe Allergy / Anaphylaxis: If accompanied by facial swelling, hives, or difficulty speaking, deploy EpiPen / Epinephrine auto-injector into the outer mid-thigh immediately.',
          'Open Windows: Ensure ample fresh air flow and clear crowds away from the patient.',
          'Coach Slow Paced Breathing: Guide patient to breathe in through nose for 2 seconds and exhale through pursed lips for 4 seconds.'
        ],
        immediate_dos: [
          'Keep patient seated upright',
          'Help administer patient’s prescribed inhaler or EpiPen',
          'Maintain continuous calming verbal contact'
        ],
        immediate_donts: [
          'Do NOT force the patient to lie flat on their back',
          'Do NOT attempt blind finger sweeps if object in airway is not clearly visible',
          'Do NOT administer sedatives or oral liquids during active choking'
        ],
        cpr_advised: false
      };

    case 'unclear':
    default:
      return {
        triage_tag: 'unclear',
        urgency: 'Urgent',
        primary_suspected_category: 'Unspecified Acute Clinical Condition / Urgent Evaluation Required',
        first_aid_guidance: [
          'Ensure the surrounding area is safe for both patient and first responder.',
          'Check Responsiveness: Gently tap shoulders and ask loudly: "Are you okay?". Check if chest is rising and falling normally.',
          'If Conscious: Place in recovery position (on their side with airway tilted open) if drowsy or vomiting, to prevent aspiration.',
          'Do not administer solid foods, liquids, or oral medications until emergency paramedics evaluate.',
          'Keep patient warm, rested, and sheltered from extreme temperatures.',
          'Gather any current medications, prescription bottles, or medical IDs to hand directly to paramedics.'
        ],
        immediate_dos: [
          'Keep patient in a safe, comfortable resting position',
          'Monitor pulse, skin color, and breathing rate every 2 minutes',
          'Keep phone line open for paramedic dispatcher instructions'
        ],
        immediate_donts: [
          'Do NOT give oral medicines without medical consultation',
          'Do NOT leave an unresponsive patient face down',
          'Do NOT move patient unnecessarily'
        ],
        cpr_advised: text.includes('unconscious') || text.includes('unresponsive')
      };
  }
}

/**
 * Rule-based fallback for AI Symptom Structuring when offline
 * Meets PDF SIH26047 Phase 4 / Phase 7 requirements:
 * Free text -> Extracted symptoms, duration, severity, associated symptoms -> Structured JSON
 */
export function extractStructuredSymptomsLocal(freeText: string): StructuredSymptomResponse {
  const text = (freeText || '').trim();
  const lower = text.toLowerCase();

  // Common duration patterns: "3 days", "2 weeks", "since yesterday", "4 hours"
  let duration = 'Not specified';
  const durationMatch = text.match(/(\d+\s*(?:days?|weeks?|months?|hours?|years?)|yesterday|today|last night|several days)/i);
  if (durationMatch) {
    duration = durationMatch[0];
  }

  // Severity keywords
  let severity: 'Mild' | 'Moderate' | 'Severe' | 'Critical' = 'Moderate';
  if (lower.includes('critical') || lower.includes('unbearable') || lower.includes('crushing') || lower.includes('excruciating')) {
    severity = 'Critical';
  } else if (lower.includes('severe') || lower.includes('intense') || lower.includes('extreme') || lower.includes('high')) {
    severity = 'Severe';
  } else if (lower.includes('mild') || lower.includes('slight') || lower.includes('occasional') || lower.includes('low-grade')) {
    severity = 'Mild';
  }

  // Identify primary complaint
  let primaryComplaint = 'General malaise / Unspecified symptom';
  const symptomKeywords = [
    'headache', 'migraine', 'chest pain', 'fever', 'cough', 'abdominal pain', 'stomach ache',
    'back pain', 'shortness of breath', 'dyspnea', 'dizziness', 'vertigo', 'joint pain',
    'nausea', 'vomiting', 'diarrhea', 'rash', 'fatigue', 'sore throat', 'palpitations',
    'hypertension', 'hypotension', 'wound', 'trauma', 'burn', 'swelling', 'edema'
  ];

  const foundSymptoms: string[] = [];
  for (const sym of symptomKeywords) {
    if (lower.includes(sym)) {
      foundSymptoms.push(sym.charAt(0).toUpperCase() + sym.slice(1));
    }
  }

  if (foundSymptoms.length > 0) {
    primaryComplaint = foundSymptoms[0];
  } else {
    // Take the first clause before comma or period
    const firstClause = text.split(/[,.\n]/)[0].trim();
    if (firstClause.length > 0 && firstClause.length < 50) {
      primaryComplaint = firstClause;
    }
  }

  const associatedSymptoms = foundSymptoms.slice(1);

  // Suggested clinical examination focus
  const examFocus: string[] = [];
  if (lower.includes('head') || lower.includes('dizziness') || lower.includes('vision')) {
    examFocus.push('Neurological exam', 'Pupillary reflex', 'Blood pressure');
  }
  if (lower.includes('chest') || lower.includes('heart') || lower.includes('palpitations')) {
    examFocus.push('Cardiac auscultation', '12-lead ECG', 'Pulse oximetry');
  }
  if (lower.includes('breath') || lower.includes('cough') || lower.includes('wheez')) {
    examFocus.push('Pulmonary auscultation', 'Respiratory rate', 'Chest expansion');
  }
  if (lower.includes('abdom') || lower.includes('stomach') || lower.includes('nausea')) {
    examFocus.push('Abdominal palpation', 'Bowel sounds', 'Rebound tenderness');
  }

  return {
    primaryComplaint,
    duration,
    severity,
    associatedSymptoms: associatedSymptoms.length > 0 ? associatedSymptoms : ['None reported explicitly'],
    suggestedExaminationFocus: examFocus.length > 0 ? examFocus : ['Vital signs', 'General physical examination'],
    urgencyLevel: severity === 'Critical' || severity === 'Severe' ? 'Urgent' : 'Routine',
  };
}
