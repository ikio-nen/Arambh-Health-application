import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, PhoneCall, Zap, MapPin, AlertTriangle, ShieldCheck, 
  Heart, Activity, CheckCircle2, Clock, Navigation, Volume2, VolumeX, 
  ArrowRight, Stethoscope, RefreshCw, Radio, UserCheck, ShieldAlert, Bot
} from 'lucide-react';
import { EmergencyCase, HospitalEvaluation, TriageTag } from '../types';
import { rankAllHospitals, nearestHospital } from '../services/geo';
import { callDev4AI } from '../services/triageAi';
import { secureLocalDB } from '../services/secureLocalDatabase';
import { LocalClinicalStorage } from '../services/storage';
import { aiModelCacheService } from '../services/aiModelCacheService';
import { VibrationService } from '../services/vibrationService';
import { SmsEmergencyService } from '../services/smsEmergencyService';
import { MessageSquare, Send, Copy, Check } from 'lucide-react';
import { AmbulanceLiveTracker } from './AmbulanceLiveTracker';
import { SmsDispatchModal } from './SmsDispatchModal';

interface FastAdmitVoiceProps {
  isOfflineMode: boolean;
  onCaseCreated?: (newCase: EmergencyCase) => void;
  onOpenAiAssistant?: () => void;
  onViewHospitals?: () => void;
}

export const FastAdmitVoice: React.FC<FastAdmitVoiceProps> = ({
  isOfflineMode,
  onCaseCreated,
  onOpenAiAssistant,
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
  const [showSmsPreview, setShowSmsPreview] = useState<boolean>(false);
  const [smsCopied, setSmsCopied] = useState<boolean>(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState<boolean>(false);

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
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-6 text-slate-800" id="fast-admit-view">
      {/* SUCCESS BANNER: INSTANT ADMISSION RESERVED */}
      {admitSuccessCase && (
        <div className="p-5 rounded-2xl bg-white border border-emerald-300 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  Emergency Admission Confirmed • Case #{admitSuccessCase.id}
                </span>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Trauma Bed Reserved & Ambulance Dispatched
                </h2>
              </div>
            </div>

            <div className="text-left sm:text-right bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-medium">Bed Token</span>
              <div className="text-sm font-mono font-bold text-sky-700">{reservationToken}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-slate-500 block text-[11px]">Assigned Hospital</span>
              <span className="text-xs font-semibold text-slate-900 block mt-0.5">{admitSuccessCase.assigned_hospital}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-slate-500 block text-[11px]">Ambulance Arrival</span>
              <span className="text-xs font-semibold text-rose-600 block mt-0.5">~{admitSuccessCase.eta_minutes} mins ({admitSuccessCase.distance_km} km)</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-slate-500 block text-[11px]">Triage Priority</span>
              <span className="text-xs font-semibold text-slate-800 uppercase block mt-0.5">{admitSuccessCase.triage_tag} priority</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            {onOpenAiAssistant && (
              <button
                type="button"
                onClick={() => {
                  VibrationService.triggerQuickTap();
                  onOpenAiAssistant();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs"
              >
                <Bot className="w-4 h-4" />
                <span>Consult AI Emergency Protocols</span>
              </button>
            )}
            <a
              href={`tel:${admitSuccessCase.ambulance_phone || '108'}`}
              className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs flex items-center justify-center space-x-2 border border-slate-200 cursor-pointer transition-colors"
            >
              <span>Call Paramedic ({admitSuccessCase.ambulance_phone || '108'})</span>
            </a>
            <button
              type="button"
              onClick={() => {
                VibrationService.triggerQuickTap();
                setIsSmsModalOpen(true);
              }}
              className="py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs flex items-center justify-center space-x-1.5 border border-rose-200 cursor-pointer transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-rose-600" />
              <span>Dispatch SMS (108)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                VibrationService.triggerQuickTap();
                setAdmitSuccessCase(null);
                setConditionText('');
                setTranscript('');
              }}
              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-xs flex items-center justify-center space-x-1 border border-slate-200 cursor-pointer transition-colors"
              title="Reset and file new case"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>New SOS</span>
            </button>
          </div>

          {/* LIVE AMBULANCE DELIVERY APP TRACKER */}
          <div className="pt-2">
            <AmbulanceLiveTracker 
              emergencyCase={admitSuccessCase} 
              onCallAmbulance={() => {
                window.location.href = `tel:${admitSuccessCase.ambulance_phone || '108'}`;
              }}
            />
          </div>
        </div>
      )}

      {/* CORE USP CARD: MINIMALIST & PROFESSIONAL HEALTHCARE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-xs space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-semibold text-sky-700 uppercase tracking-wide">
                Fast Admission Protocol
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Voice Emergency Intake
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5 max-w-xl leading-relaxed">
              Eliminate paperwork delays. Speak or select symptoms below to pre-allocate an emergency room bed and route nearest ambulance.
            </p>
          </div>

          {/* GPS Status */}
          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700">
            <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span className="text-slate-600 truncate max-w-[200px] font-medium">{gpsStatus}</span>
            <button
              onClick={detectLocation}
              disabled={isDetectingGps}
              className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer transition-colors"
              title="Refresh GPS"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDetectingGps ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* VOICE-TO-FILL SECTION */}
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
          {/* Microphone Button */}
          <button
            id="btn-voice-fill-trigger"
            onClick={toggleListening}
            className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 transition-all cursor-pointer shadow-xs ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-100'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
            }`}
            title="Click to activate voice triage"
          >
            {isListening ? (
              <>
                <MicOff className="w-6 h-6 text-white" />
                <span className="text-[10px] font-semibold mt-0.5">Listening</span>
              </>
            ) : (
              <>
                <Mic className="w-6 h-6 text-sky-600" />
                <span className="text-[10px] font-semibold mt-0.5 text-slate-700">Tap to Speak</span>
              </>
            )}
          </button>

          {/* Transcript / Spoken Waveform Feedback */}
          <div className="flex-1 w-full space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 flex items-center space-x-1.5 font-medium">
                <span className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}></span>
                <span>{isListening ? 'Listening hands-free...' : 'Hands-free voice recognition'}</span>
              </span>
              <span className="text-slate-400 text-xs">
                e.g. "45 years old, chest pain, fast admit"
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 min-h-[46px] flex items-center shadow-xs">
              {transcript ? (
                <p className="text-slate-900 text-xs sm:text-sm font-medium">
                  "{transcript}"
                </p>
              ) : (
                <p className="text-slate-400 text-xs">
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
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
            Common Emergency Symptoms
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" id="emergency-presets-grid">
            <button
              type="button"
              onClick={() => applyPreset('cardiac', 'Severe acute chest pain radiating to left arm & cold sweats')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedTag === 'cardiac'
                  ? 'bg-rose-50 border-rose-400 ring-1 ring-rose-400'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Chest Pain</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700">Cardiac</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Pressure / Pain radiating</p>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('trauma', 'Uncontrolled heavy bleeding / deep laceration from accident')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedTag === 'trauma' && conditionText.includes('bleeding')
                  ? 'bg-rose-50 border-rose-400 ring-1 ring-rose-400'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Severe Bleed</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700">Trauma</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Heavy wound / Laceration</p>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('respiratory', 'Severe breathing difficulty / choking / asthma failure')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedTag === 'respiratory'
                  ? 'bg-sky-50 border-sky-400 ring-1 ring-sky-400'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Breathing Issue</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800">Airway</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Severe breathlessness</p>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('trauma', 'Hard fall / head impact with confusion or unconsciousness')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                conditionText.includes('fall')
                  ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Fall / Shock</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">Impact</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Head injury / Collapse</p>
            </button>
          </div>
        </div>

        {/* PATIENT DETAILS FIELDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Patient Full Name</label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="e.g. Rohan Deshmukh"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Age & Gender</label>
            <div className="flex space-x-2">
              <input
                type="number"
                value={patientAge}
                onChange={(e) => setPatientAge(e.target.value)}
                placeholder="Age"
                className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
              <select
                value={patientGender}
                onChange={(e) => setPatientGender(e.target.value as any)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Emergency Contact Number</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+91 98201 44521"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>
        </div>

        {/* NEAREST BEST HOSPITAL SELECTION */}
        {bestHospital && (
          <div className="p-4 rounded-xl bg-sky-50/50 border border-sky-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-sky-600 text-white uppercase tracking-wide">
                  Optimal Match
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {bestHospital.distanceKm} km away
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-1">
                {bestHospital.hospital.name}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {bestHospital.recommendationReason}
              </p>
            </div>

            <div className="flex items-center space-x-4 shrink-0">
              <div className="text-right">
                <div className="text-xl font-bold text-sky-800">
                  ~{bestHospital.etaMinutes} <span className="text-xs font-normal text-slate-500">mins</span>
                </div>
                <div className="text-xs font-semibold text-emerald-700">
                  {bestHospital.availableBeds} ER Beds Free
                </div>
              </div>

              {onViewHospitals && (
                <button
                  type="button"
                  onClick={onViewHospitals}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer shadow-xs transition-colors"
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
            className="w-full py-3.5 px-6 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-base flex items-center justify-center space-x-2.5 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
          >
            <Zap className="w-5 h-5 fill-white" />
            <span>
              {isSubmitting ? 'Reserving ER Bed...' : 'Fast Admit & Dispatch Ambulance'}
            </span>
            <ArrowRight className="w-4 h-4 ml-auto" />
          </button>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-2.5 px-1 font-medium">
            <span>• Pre-allocated trauma bed</span>
            <span>• Direct emergency line</span>
            <span>• Zero paperwork on arrival</span>
          </div>
        </div>

        {/* OFFLINE SMS EMERGENCY DISPATCH (SIH RESILIENCE PROTOCOL) */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-sky-600" />
              <span className="text-xs font-semibold text-slate-800">
                Offline SMS Emergency Dispatch (108)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSmsPreview(!showSmsPreview)}
              className="text-xs text-sky-600 hover:text-sky-800 font-medium underline cursor-pointer"
            >
              {showSmsPreview ? 'Hide Payload' : 'View Payload Details'}
            </button>
          </div>

          {showSmsPreview && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span>Compressed GSM 7-Bit Payload:</span>
                <span className="text-emerald-700 font-medium">
                  {SmsEmergencyService.encodeEmergencyCase({
                    lat,
                    long,
                    age: patientAge || 45,
                    gender: patientGender,
                    triageTag: selectedTag,
                    condition: conditionText || 'Emergency intake',
                    bedToken: reservationToken || 'BED-RES-108',
                    targetHospital: bestHospital?.hospital.name || 'Metro Trauma Center',
                  }).length}/160 chars (Single SMS)
                </span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg font-mono text-xs text-slate-800 break-all select-all">
                {SmsEmergencyService.encodeEmergencyCase({
                  lat,
                  long,
                  age: patientAge || 45,
                  gender: patientGender,
                  triageTag: selectedTag,
                  condition: conditionText || 'Emergency intake',
                  bedToken: reservationToken || 'BED-RES-108',
                  targetHospital: bestHospital?.hospital.name || 'Metro Trauma Center',
                })}
              </div>
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    VibrationService.triggerQuickTap();
                    const payload = SmsEmergencyService.encodeEmergencyCase({
                      lat,
                      long,
                      age: patientAge || 45,
                      gender: patientGender,
                      triageTag: selectedTag,
                      condition: conditionText || 'Emergency intake',
                      bedToken: reservationToken || 'BED-RES-108',
                      targetHospital: bestHospital?.hospital.name || 'Metro Trauma Center',
                    });
                    navigator.clipboard.writeText(payload);
                    setSmsCopied(true);
                    setTimeout(() => setSmsCopied(false), 2000);
                  }}
                  className="px-2.5 py-1 rounded bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center space-x-1 cursor-pointer border border-slate-200 shadow-xs"
                >
                  {smsCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                  <span>{smsCopied ? 'Copied' : 'Copy Payload'}</span>
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              VibrationService.triggerQuickTap();
              setIsSmsModalOpen(true);
            }}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
          >
            <Send className="w-4 h-4 text-sky-400" />
            <span>Open Emergency SMS Dispatch Gateway (108 & Contacts)</span>
          </button>
        </div>
      </div>

      {/* EMERGENCY SMS DISPATCH MODAL */}
      <SmsDispatchModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        initialMessage={SmsEmergencyService.encodeEmergencyCase({
          lat,
          long,
          age: patientAge || 45,
          gender: patientGender,
          triageTag: selectedTag,
          condition: conditionText || 'Emergency Fast Admit',
          bedToken: reservationToken || 'BED-RES-108',
          targetHospital: bestHospital?.hospital.name || 'Metro Trauma Center',
        })}
        initialPhone="108"
        caseId={admitSuccessCase?.id || 'EMG-ADMIT-108'}
        targetHospital={bestHospital?.hospital.name || 'Metro Trauma Center'}
      />
    </div>
  );
};
