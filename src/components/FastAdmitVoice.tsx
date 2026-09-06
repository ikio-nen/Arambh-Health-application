import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, PhoneCall, Zap, MapPin, AlertTriangle, ShieldCheck, 
  Heart, Activity, CheckCircle2, Clock, Navigation, Volume2, VolumeX, 
  ArrowRight, Stethoscope, RefreshCw, Radio, UserCheck, ShieldAlert
} from 'lucide-react';
import { EmergencyCase, HospitalEvaluation, TriageTag } from '../types';
import { rankAllHospitals, nearestHospital } from '../services/geo';
import { callDev4AI } from '../services/triageAi';
import { secureLocalDB } from '../services/secureLocalDatabase';
import { LocalClinicalStorage } from '../services/storage';
import { aiModelCacheService } from '../services/aiModelCacheService';
import { VibrationService } from '../services/vibrationService';

interface FastAdmitVoiceProps {
  isOfflineMode: boolean;
  onCaseCreated?: (newCase: EmergencyCase) => void;
  onOpenReceptionist?: (hospitalName: string, caseData?: EmergencyCase) => void;
  onViewHospitals?: () => void;
}

export const FastAdmitVoice: React.FC<FastAdmitVoiceProps> = ({
  isOfflineMode,
  onCaseCreated,
  onOpenReceptionist,
  onViewHospitals,
}) => {
  // Voice input state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const recognitionRef = useRef<any>(null);

  // Form Fields (voice-to-fill)
  const [patientName, setPatientName] = useState<string>('');
  const [patientAge, setPatientAge] = useState<string>('');
  const [patientGender, setPatientGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [conditionText, setConditionText] = useState<string>('Severe acute chest pain radiating to left arm');
  const [contactPhone, setContactPhone] = useState<string>('+91 98201 44521');
  const [selectedTag, setSelectedTag] = useState<TriageTag>('cardiac');

  // Location & Hospital Routing
  const [lat, setLat] = useState<number>(28.6139);
  const [long, setLong] = useState<number>(77.2090);
  const [gpsStatus, setGpsStatus] = useState<string>('Coordinates Locked: 28.6139° N, 77.2090° E');
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [hospitals, setHospitals] = useState<HospitalEvaluation[]>([]);
  const [bestHospital, setBestHospital] = useState<HospitalEvaluation | null>(null);

  // Fast Admit Status
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [reservationToken, setReservationToken] = useState<string>('');
  const [admitSuccessCase, setAdmitSuccessCase] = useState<EmergencyCase | null>(null);

  // 1. Initialize GPS & Nearby Hospitals
  useEffect(() => {
    detectLocation();
  }, []);

  const detectLocation = () => {
    setIsDetectingGps(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const uLat = pos.coords.latitude;
          const uLong = pos.coords.longitude;
          setLat(uLat);
          setLong(uLong);
          setGpsStatus(`GPS: ${uLat.toFixed(4)}° N, ${uLong.toFixed(4)}° E`);
          setIsDetectingGps(false);
          updateHospitalRankings(uLat, uLong);
        },
        (err) => {
          setGpsStatus('GPS Default: New Delhi AIIMS Cluster (28.6139, 77.2090)');
          setIsDetectingGps(false);
          updateHospitalRankings(28.6139, 77.2090);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setGpsStatus('Default: New Delhi AIIMS Cluster (28.6139, 77.2090)');
      setIsDetectingGps(false);
      updateHospitalRankings(28.6139, 77.2090);
    }
  };

  const updateHospitalRankings = (uLat: number, uLong: number) => {
    const ranked = rankAllHospitals(uLat, uLong);
    setHospitals(ranked);
    if (ranked.length > 0) {
      setBestHospital(ranked[0]);
    }
  };

  // 2. Web Speech Recognition for Voice-to-Fill
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
        parseVoiceEntities(currentTranscript);
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (e) {
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = () => {
    VibrationService.triggerQuickTap();
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        setTranscript('');
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch (e) {
          console.warn('Start listening error:', e);
        }
      }
    }
  };

  // 3. Entity Extraction from Voice
  const parseVoiceEntities = (text: string) => {
    const lower = text.toLowerCase();

    // Extract Age
    const ageMatch = lower.match(/(?:i am|he is|she is|patient is|age|aged)?\s*(\d{1,2})\s*(?:years|yr|years old|yo)/);
    if (ageMatch && ageMatch[1]) {
      setPatientAge(ageMatch[1]);
    }

    // Extract Gender
    if (lower.includes('female') || lower.includes('woman') || lower.includes('girl') || lower.includes('mother') || lower.includes('she')) {
      setPatientGender('Female');
    } else if (lower.includes('male') || lower.includes('man') || lower.includes('boy') || lower.includes('father') || lower.includes('he')) {
      setPatientGender('Male');
    }

    // Extract Name
    const nameMatch = lower.match(/(?:my name is|name is|patient name|call me)\s+([a-zA-Z\s]+?)(?:i am|and|age|having|with|$)/);
    if (nameMatch && nameMatch[1]) {
      setPatientName(nameMatch[1].trim());
    }

    // Extract Condition & Triage Category
    if (lower.includes('chest') || lower.includes('heart') || lower.includes('cardiac') || lower.includes('attack') || lower.includes('angina')) {
      setSelectedTag('cardiac');
      setConditionText(text);
    } else if (lower.includes('bleed') || lower.includes('blood') || lower.includes('fracture') || lower.includes('accident') || lower.includes('trauma') || lower.includes('cut')) {
      setSelectedTag('trauma');
      setConditionText(text);
    } else if (lower.includes('breath') || lower.includes('choking') || lower.includes('asthma') || lower.includes('oxygen') || lower.includes('gasping')) {
      setSelectedTag('respiratory');
      setConditionText(text);
    } else {
      setConditionText(text);
    }
  };

  // Apply Quick Preset
  const applyPreset = (tag: TriageTag, desc: string) => {
    VibrationService.triggerQuickTap();
    setSelectedTag(tag);
    setConditionText(desc);
  };

  // 4. Instant Fast Admit Execution
  const handleTriggerFastAdmit = async () => {
    setIsSubmitting(true);
    VibrationService.triggerDispatchSuccess();

    // 1. Call AI Triage
    const guidance = callDev4AI(conditionText || 'Emergency Fast Admit Request');

    const targetHosp = bestHospital ? bestHospital.hospital : nearestHospital(lat, long).hospital;
    const etaMin = bestHospital ? bestHospital.etaMinutes : 4;
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const caseId = `EMG-${suffix}`;
    const token = `BED-RES-${suffix}`;
    const shellPatientId = `pt-shell-${suffix}`;

    const newCase: EmergencyCase = {
      id: caseId,
      patient_profile_id: shellPatientId,
      lat: lat,
      long: long,
      condition_text: conditionText || 'Emergency Fast Admit Request',
      contact: contactPhone || '+91 99999 00000',
      triage_tag: selectedTag,
      assigned_hospital: targetHosp.name,
      hospital_phone: targetHosp.phone,
      ambulance_phone: targetHosp.ambulance_hotline,
      distance_km: bestHospital?.distanceKm || 2.1,
      eta_minutes: etaMin,
      status: 'pending',
      first_aid_guidance: guidance.first_aid_guidance || [
        'Maintain open airway and loosen restrictive garments.',
        'Keep patient calm and still while ambulance arrives.',
      ],
      created_at: new Date().toISOString(),
    };

    const shellPatient = {
      id: shellPatientId,
      patient_id: `PT-${suffix}`,
      name: patientName.trim() || 'Fast Admit Emergency Patient',
      age: patientAge || 45,
      gender: patientGender,
      contact: contactPhone,
      address: `Live Emergency Fix (${lat}° N, ${long}° E)`,
      emergency_contact: 'Local EMS Dispatched',
      is_emergency_shell: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save to Secure Local Database
    await secureLocalDB.saveEmergencyCase(newCase, isOfflineMode);
    await secureLocalDB.savePatient(shellPatient, isOfflineMode);

    setReservationToken(token);
    setAdmitSuccessCase(newCase);
    setIsSubmitting(false);

    if (onCaseCreated) {
      onCaseCreated(newCase);
    }

    // Voice announcement of admission
    if ('speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(
          `Emergency fast admission confirmed at ${targetHosp.name}. Bed reserved. Ambulance arriving in ${etaMin} minutes.`
        );
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Speech synthesis err:', err);
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-6 text-slate-100" id="fast-admit-view">
      {/* SUCCESS BANNER: INSTANT ADMISSION RESERVED */}
      {admitSuccessCase && (
        <div className="p-5 rounded-2xl bg-[#111317] border border-red-500/50 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500 text-red-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  Fast Admit Protocol Dispatched • Case {admitSuccessCase.id}
                </span>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Trauma Bed Reserved & Ambulance Dispatched
                </h2>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Bed Reservation Token</span>
              <div className="text-sm font-mono font-bold text-amber-400">{reservationToken}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3 bg-[#181b22] rounded-xl border border-white/5">
              <span className="text-slate-400 block text-[10px] uppercase">Assigned Hospital</span>
              <span className="text-xs font-semibold text-white block mt-0.5">{admitSuccessCase.assigned_hospital}</span>
            </div>
            <div className="p-3 bg-[#181b22] rounded-xl border border-white/5">
              <span className="text-slate-400 block text-[10px] uppercase">Ambulance Arrival</span>
              <span className="text-xs font-semibold text-red-400 block mt-0.5">~{admitSuccessCase.eta_minutes} mins ({admitSuccessCase.distance_km} km)</span>
            </div>
            <div className="p-3 bg-[#181b22] rounded-xl border border-white/5">
              <span className="text-slate-400 block text-[10px] uppercase">Triage Protocol</span>
              <span className="text-xs font-semibold text-amber-400 uppercase block mt-0.5">{admitSuccessCase.triage_tag} priority</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              onClick={() => onOpenReceptionist && onOpenReceptionist(admitSuccessCase.assigned_hospital, admitSuccessCase)}
              className="flex-1 py-3 px-4 rounded-xl bg-white text-black hover:bg-slate-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Talk to Hospital Receptionist</span>
            </button>
            <a
              href={`tel:${admitSuccessCase.ambulance_phone}`}
              className="py-3 px-5 rounded-xl bg-[#181b22] hover:bg-[#20242e] text-slate-300 font-mono text-xs uppercase flex items-center justify-center space-x-2 border border-white/10 cursor-pointer"
            >
              <span>Direct Hotline ({admitSuccessCase.ambulance_phone})</span>
            </a>
          </div>
        </div>
      )}

      {/* CORE USP CARD: MINIMALIST TITANIUM */}
      <div className="bg-[#111317] border border-white/10 rounded-2xl p-5 sm:p-7 shadow-xl space-y-6">
        {/* Header with high contrast */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Our USP: Zero-Delay Fast Admit
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
              Voice-to-Fill Emergency Intake
            </h1>
            <p className="text-slate-400 text-xs mt-0.5 max-w-xl">
              Eliminate paper triage delays. Speak or tap to pre-allocate an ER bed and route the nearest ambulance.
            </p>
          </div>

          {/* GPS Status */}
          <div className="flex items-center space-x-2 bg-[#181b22] px-3 py-1.5 rounded-xl border border-white/5 font-mono text-xs">
            <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="text-slate-300 truncate max-w-[190px]">{gpsStatus}</span>
            <button
              onClick={detectLocation}
              disabled={isDetectingGps}
              className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
              title="Refresh GPS"
            >
              <RefreshCw className={`w-3 h-3 ${isDetectingGps ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* VOICE-TO-FILL SECTION */}
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#14161a] p-4 rounded-xl border border-white/5">
          {/* Microphone Button */}
          <button
            id="btn-voice-fill-trigger"
            onClick={toggleListening}
            className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 transition-all cursor-pointer ${
              isListening
                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                : 'bg-[#1c1f26] text-slate-400 hover:text-white border border-white/10 hover:border-white/20'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-6 h-6 text-white" />
                <span className="text-[9px] font-mono mt-0.5 uppercase">Listening</span>
              </>
            ) : (
              <>
                <Mic className="w-6 h-6" />
                <span className="text-[9px] font-mono mt-0.5 uppercase">Speak</span>
              </>
            )}
          </button>

          {/* Transcript / Spoken Waveform Feedback */}
          <div className="flex-1 w-full space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center space-x-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-red-500 animate-ping' : 'bg-slate-600'}`}></span>
                <span>{isListening ? 'Listening hands-free...' : 'Press to talk'}</span>
              </span>
              <span className="text-slate-500 text-[11px]">
                Say: "45 years old, chest pain, fast admit"
              </span>
            </div>

            <div className="p-3 bg-[#111317] rounded-lg border border-white/5 min-h-[46px] flex items-center">
              {transcript ? (
                <p className="text-white text-xs sm:text-sm font-medium">
                  "{transcript}"
                </p>
              ) : (
                <p className="text-slate-500 text-xs italic">
                  {isListening 
                    ? 'Capturing audio... entity extractor active...' 
                    : 'Tap microphone and describe symptoms. Arambh auto-extracts age, condition, and triage category.'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* QUICK 1-TAP EMERGENCY PRESETS */}
        <div className="space-y-2">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
            Instant Triage Presets
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" id="emergency-presets-grid">
            <button
              type="button"
              onClick={() => applyPreset('cardiac', 'Severe acute chest pain radiating to left arm & cold sweats')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedTag === 'cardiac'
                  ? 'bg-red-500/15 border-red-500/60 text-white'
                  : 'bg-[#14161a] border-white/5 text-slate-300 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-400">Chest Pain</span>
                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-red-500/20 text-red-400">CARDIAC</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Heart attack / Angina</p>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('trauma', 'Uncontrolled heavy bleeding / deep laceration from accident')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedTag === 'trauma' && conditionText.includes('bleeding')
                  ? 'bg-red-500/15 border-red-500/60 text-white'
                  : 'bg-[#14161a] border-white/5 text-slate-300 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-400">Severe Bleed</span>
                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-red-500/20 text-red-400">TRAUMA</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Heavy wound / Laceration</p>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('respiratory', 'Severe breathing difficulty / choking / asthma failure')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedTag === 'respiratory'
                  ? 'bg-red-500/15 border-red-500/60 text-white'
                  : 'bg-[#14161a] border-white/5 text-slate-300 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-400">Choking / Airway</span>
                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-red-500/20 text-red-400">AIRWAY</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Asthma / Breathlessness</p>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('trauma', 'Hard fall / head impact with confusion or unconsciousness')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                conditionText.includes('fall')
                  ? 'bg-red-500/15 border-red-500/60 text-white'
                  : 'bg-[#14161a] border-white/5 text-slate-300 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-400">Fall / Shock</span>
                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-red-500/20 text-red-400">IMPACT</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Head injury / Collapse</p>
            </button>
          </div>
        </div>

        {/* PATIENT DETAILS FIELDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Patient Name</label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="e.g. Rohan Deshmukh"
              className="w-full bg-[#14161a] border border-white/10 focus:border-white/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Age / Gender</label>
            <div className="flex space-x-2">
              <input
                type="number"
                value={patientAge}
                onChange={(e) => setPatientAge(e.target.value)}
                placeholder="Age"
                className="w-20 bg-[#14161a] border border-white/10 focus:border-white/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
              <select
                value={patientGender}
                onChange={(e) => setPatientGender(e.target.value as any)}
                className="flex-1 bg-[#14161a] border border-white/10 focus:border-white/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Emergency Contact</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+91 98201 44521"
              className="w-full bg-[#14161a] border border-white/10 focus:border-white/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>
        </div>

        {/* NEAREST BEST HOSPITAL SELECTION */}
        {bestHospital && (
          <div className="p-4 rounded-xl bg-[#14161a] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-1.5 py-0.5 rounded font-mono text-[9px] font-bold bg-amber-400 text-black uppercase">
                  RECOMMENDED HOSPITAL
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {bestHospital.distanceKm} km away
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-1">
                {bestHospital.hospital.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {bestHospital.recommendationReason}
              </p>
            </div>

            <div className="flex items-center space-x-4 shrink-0">
              <div className="text-right">
                <div className="text-xl font-mono font-bold text-white">
                  ~{bestHospital.etaMinutes} <span className="text-xs font-normal text-slate-400">MIN</span>
                </div>
                <div className="text-[10px] font-mono text-emerald-400">
                  {bestHospital.availableBeds} ER Beds Free
                </div>
              </div>

              {onViewHospitals && (
                <button
                  type="button"
                  onClick={onViewHospitals}
                  className="px-3 py-1.5 rounded-lg bg-[#1c1f26] border border-white/10 hover:border-white/20 text-xs font-mono text-slate-300 cursor-pointer"
                >
                  View All
                </button>
              )}
            </div>
          </div>
        )}

        {/* ACTION BUTTON: INSTANT ADMISSION DISPATCH */}
        <div className="pt-2">
          <button
            id="btn-fast-admit-now"
            type="button"
            disabled={isSubmitting}
            onClick={handleTriggerFastAdmit}
            className="w-full py-4 px-6 rounded-xl bg-white text-black hover:bg-slate-200 font-bold text-base uppercase tracking-wider flex items-center justify-center space-x-2.5 transition-all cursor-pointer shadow-lg active:scale-98"
          >
            <Zap className="w-5 h-5 text-red-600 fill-red-600" />
            <span>
              {isSubmitting ? 'Reserving ER Bed...' : 'Fast Admit & Dispatch Ambulance'}
            </span>
            <ArrowRight className="w-4 h-4 ml-auto" />
          </button>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-2 px-1">
            <span>Pre-allocates trauma bed</span>
            <span>Hands-free coordinates</span>
            <span>Zero queue on arrival</span>
          </div>
        </div>
      </div>
    </div>
  );
};
