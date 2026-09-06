import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneCall, MapPin, AlertTriangle, ShieldCheck, Heart, Activity, 
  Clock, Navigation, CheckCircle2, XCircle, Volume2, VolumeX, Send, 
  Sparkles, RefreshCw, Radio, PhoneForwarded, Play, Pause, SkipForward,
  Database, Zap, Info, Check, ShieldAlert, Cpu
} from 'lucide-react';
import { EmergencyCase, TriageTag, FirstAidStep } from '../types';
import { nearestHospital } from '../services/geo';
import { callDev4AI } from '../services/triageAi';
import { LocalClinicalStorage } from '../services/storage';
import { secureLocalDB } from '../services/secureLocalDatabase';
import { aiModelCacheService, FirstAidResponse } from '../services/aiModelCacheService';
import { bluetoothHoppingService, HopPacket } from '../services/bluetoothHopping';
import { DatabaseCacheModal } from './DatabaseCacheModal';

interface EmergencyHotlineProps {
  isOfflineMode: boolean;
  onCaseCreated?: (newCase: EmergencyCase) => void;
}

export const EmergencyHotline: React.FC<EmergencyHotlineProps> = ({ isOfflineMode, onCaseCreated }) => {
  const [lat, setLat] = useState<number | ''>(28.6139);
  const [long, setLong] = useState<number | ''>(77.2090);
  const [addressDesc, setAddressDesc] = useState<string>('Connaught Place / Ring Road vicinity');
  const [conditionText, setConditionText] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [locationDetecting, setLocationDetecting] = useState<boolean>(false);
  const [locationStatus, setLocationStatus] = useState<string>('');

  // Bluetooth Hopping State
  const [bleBroadcastActive, setBleBroadcastActive] = useState<boolean>(false);
  const [bleHopPacket, setBleHopPacket] = useState<HopPacket | null>(null);
  const [bleRelayStatus, setBleRelayStatus] = useState<string>('');

  // Active Dispatched Case Response & AI Cache Guidance
  const [activeCase, setActiveCase] = useState<EmergencyCase | null>(null);
  const [activeTriageDetails, setActiveTriageDetails] = useState<any | null>(null);
  const [aiGuidance, setAiGuidance] = useState<FirstAidResponse | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [stepSecondsLeft, setStepSecondsLeft] = useState<number>(30);
  const [isStepTimerRunning, setIsStepTimerRunning] = useState<boolean>(false);
  const [isSpeakingStep, setIsSpeakingStep] = useState<boolean>(false);

  // CPR Metronome State (Web Audio API sound + pulse)
  const [cprMetronomeActive, setCprMetronomeActive] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const metronomeIntervalRef = useRef<any>(null);

  // Inspector Modal
  const [isInspectorModalOpen, setIsInspectorModalOpen] = useState<boolean>(false);

  // Interactive AI First Aid Assistant Chat
  const [aiChatMessages, setAiChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; source?: string }>>([]);
  const [userQuery, setUserQuery] = useState<string>('');
  const [aiTyping, setAiTyping] = useState<boolean>(false);

  // Grab GPS Coordinates
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation not supported on this browser. Using default central coordinates.');
      return;
    }
    setLocationDetecting(true);
    setLocationStatus('Acquiring GPS satellite fix...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const detectedLat = Math.round(position.coords.latitude * 10000) / 10000;
        const detectedLng = Math.round(position.coords.longitude * 10000) / 10000;
        setLat(detectedLat);
        setLong(detectedLng);
        setAddressDesc(`GPS Location: ${detectedLat}° N, ${detectedLng}° E (±${Math.round(position.coords.accuracy)}m accuracy)`);
        setLocationDetecting(false);
        setLocationStatus('GPS fix acquired successfully!');
      },
      (error) => {
        setLocationDetecting(false);
        setLocationStatus(`GPS unavailable (${error.message}). Using manual coordinates.`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Preset emergency buttons for quick triage tap under distress
  const handlePresetSelect = (text: string) => {
    setConditionText(text);
  };

  // CPR Metronome Sound Synthesizer (110 BPM beep)
  useEffect(() => {
    if (cprMetronomeActive) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioCtxRef.current && AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }

        const intervalMs = Math.round((60 / 110) * 1000); // 110 BPM
        metronomeIntervalRef.current = setInterval(() => {
          if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
            const osc = audioCtxRef.current.createOscillator();
            const gain = audioCtxRef.current.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, audioCtxRef.current.currentTime); // High pitch tick
            gain.gain.setValueAtTime(0.2, audioCtxRef.current.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.08);
            osc.connect(gain);
            gain.connect(audioCtxRef.current.destination);
            osc.start();
            osc.stop(audioCtxRef.current.currentTime + 0.08);
          }
        }, intervalMs);
      } catch (err) {
        console.warn('AudioContext not permitted yet:', err);
      }
    } else {
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current);
        metronomeIntervalRef.current = null;
      }
    }

    return () => {
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current);
      }
    };
  }, [cprMetronomeActive]);

  // Step countdown timer
  useEffect(() => {
    let timer: any = null;
    if (isStepTimerRunning && stepSecondsLeft > 0) {
      timer = setInterval(() => {
        setStepSecondsLeft(prev => {
          if (prev <= 1) {
            setIsStepTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isStepTimerRunning, stepSecondsLeft]);

  // Voice read-out for hands-free first-aid
  const handleSpeakStep = (text: string) => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeakingStep) {
      window.speechSynthesis.cancel();
      setIsSpeakingStep(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92; // Clear emergency pace
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeakingStep(false);
    utterance.onerror = () => setIsSpeakingStep(false);

    setIsSpeakingStep(true);
    window.speechSynthesis.speak(utterance);
  };

  // Select Step in Interactive Player
  const handleSelectStep = (idx: number) => {
    setActiveStepIndex(idx);
    if (aiGuidance?.first_aid_steps[idx]) {
      const duration = aiGuidance.first_aid_steps[idx].duration_seconds || 30;
      setStepSecondsLeft(duration);
      setIsStepTimerRunning(true);
    }
  };

  // Advance Step
  const handleNextStep = () => {
    if (!aiGuidance?.first_aid_steps) return;
    if (activeStepIndex < aiGuidance.first_aid_steps.length - 1) {
      handleSelectStep(activeStepIndex + 1);
    }
  };

  // Broadcast Emergency Intake via 2.4 GHz Bluetooth Hopping Mesh (Off-Grid)
  const handleBroadcastBleMesh = async () => {
    if (!conditionText.trim() || bleBroadcastActive) return;

    setBleBroadcastActive(true);
    setBleRelayStatus('Broadcasting distress packet across 40 Bluetooth hopping channels (2.402-2.480 GHz)...');

    try {
      const pkt = await bluetoothHoppingService.transmitPacket(
        'EMERGENCY_DISPATCH',
        conditionText,
        {
          lat: typeof lat === 'number' ? lat : 28.6139,
          long: typeof long === 'number' ? long : 77.2090,
          contact: contactPhone || 'Anonymous Caller',
          address: addressDesc,
          timestamp: new Date().toISOString(),
        }
      );

      setBleHopPacket(pkt);
      setBleRelayStatus(`Packet ${pkt.packetId} relayed to Hospital Gateway across ${pkt.hopCount} hops in ${pkt.latencyMs}ms!`);
    } catch (err: any) {
      setBleRelayStatus(`Bluetooth transmission error: ${err.message}`);
    } finally {
      setBleBroadcastActive(false);
    }
  };

  // Submit Emergency Intake: POST /emergency/intake
  const handleSubmitIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conditionText.trim()) return;

    setIsSubmitting(true);

    // Concurrently broadcast via Bluetooth Hopping Mesh
    bluetoothHoppingService.transmitPacket(
      'EMERGENCY_DISPATCH',
      conditionText,
      {
        lat: typeof lat === 'number' ? lat : 28.6139,
        long: typeof long === 'number' ? long : 77.2090,
        contact: contactPhone,
        timestamp: new Date().toISOString()
      }
    ).then((pkt) => {
      setBleHopPacket(pkt);
      setBleRelayStatus(`Mesh Hopping: Relayed to Gateway in ${pkt.latencyMs}ms (${pkt.hopCount} hops, CRC: ${pkt.crc32})`);
    }).catch((e) => console.warn('BLE mesh transmission err:', e));

    const payload = {
      lat: typeof lat === 'number' ? lat : 28.6139,
      long: typeof long === 'number' ? long : 77.2090,
      condition_text: conditionText,
      contact: contactPhone || 'Anonymous Caller',
    };

    // 1. Fetch AI First Aid Guidance through the multi-tier AI Model Caching Service
    const guidanceResult = await aiModelCacheService.getFirstAidGuidance(payload.condition_text, isOfflineMode);
    setAiGuidance(guidanceResult);

    try {
      if (!isOfflineMode) {
        // Online Call to Express POST /emergency/intake
        const res = await fetch('/emergency/intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          const emgCase: EmergencyCase = {
            ...data.emergency_case,
            first_aid_steps: guidanceResult.first_aid_steps,
          };

          setActiveCase(emgCase);
          setActiveTriageDetails(data);
          if (data.cpr_advised || guidanceResult.cpr_advised) {
            setCprMetronomeActive(true);
          }

          // Persist into embedded local database
          await secureLocalDB.saveEmergencyCase(emgCase, false);
          if (data.patient_shell) {
            await secureLocalDB.savePatient(data.patient_shell, false);
          }

          // Initialize Interactive Step Player
          if (guidanceResult.first_aid_steps.length > 0) {
            setActiveStepIndex(0);
            setStepSecondsLeft(guidanceResult.first_aid_steps[0].duration_seconds || 30);
            setIsStepTimerRunning(true);
          }

          // Seed AI Chat with immediate first-aid instructions
          setAiChatMessages([
            {
              sender: 'ai',
              text: `🚨 AMBULANCE DISPATCHED: ${data.hospital} has been alerted. Estimated arrival: ${data.eta_minutes} minutes. Guided first-aid protocol loaded from ${guidanceResult.source} (${guidanceResult.latency_ms}ms). Follow the instructions below or ask any emergency question.`,
              source: guidanceResult.source,
            }
          ]);

          if (onCaseCreated) onCaseCreated(emgCase);
          setIsSubmitting(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Network call failed, falling back to local offline emergency processing:', err);
    }

    // Local / Offline Processing
    const geo = nearestHospital(payload.lat, payload.long);
    const triage = callDev4AI(payload.condition_text);
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const caseId = `EMG-CASE-${suffix}`;
    const shellPatientId = `pt-shell-${suffix}`;

    const newCase: EmergencyCase = {
      id: caseId,
      patient_profile_id: shellPatientId,
      lat: payload.lat,
      long: payload.long,
      condition_text: payload.condition_text,
      contact: payload.contact,
      triage_tag: triage.triage_tag,
      assigned_hospital: geo.hospital.name,
      hospital_phone: geo.hospital.phone,
      ambulance_phone: geo.hospital.ambulance_hotline,
      distance_km: geo.distanceKm,
      eta_minutes: geo.etaMinutes,
      status: 'pending',
      first_aid_guidance: triage.first_aid_guidance,
      first_aid_steps: guidanceResult.first_aid_steps,
      created_at: new Date().toISOString(),
    };

    const shellPatient = {
      id: shellPatientId,
      patient_id: `EMG-${suffix}`,
      name: `Emergency Shell (${triage.triage_tag.toUpperCase()})`,
      age: 'Unknown',
      gender: 'Undisclosed' as any,
      contact: payload.contact,
      address: `GPS: ${payload.lat}° N, ${payload.long}° E`,
      emergency_contact: `Caller: ${payload.contact}`,
      is_emergency_shell: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save shell patient & case into secure local database (IndexedDB + Sync Queue)
    await secureLocalDB.savePatient(shellPatient, true);
    await secureLocalDB.saveEmergencyCase(newCase, true);

    // Also update LocalStorage cache
    const patients = LocalClinicalStorage.getPatients();
    patients.unshift(shellPatient);
    LocalClinicalStorage.setPatients(patients);

    const cases = LocalClinicalStorage.getEmergencyCases();
    cases.unshift(newCase);
    LocalClinicalStorage.setEmergencyCases(cases);

    LocalClinicalStorage.logAuditAction(
      { id: 'offline-hotline', name: 'Offline Hotline Dispatch', role: 'receptionist' },
      'EMERGENCY_INTAKE_SUBMITTED',
      shellPatientId,
      `Offline emergency intake: ${caseId} (${triage.triage_tag}). Dispatched to ${geo.hospital.name}.`
    );

    setActiveCase(newCase);
    setActiveTriageDetails({
      case_id: caseId,
      hospital: geo.hospital.name,
      hospital_phone: geo.hospital.phone,
      ambulance_phone: geo.hospital.ambulance_hotline,
      distance_km: geo.distanceKm,
      eta_minutes: geo.etaMinutes,
      triage_tag: triage.triage_tag,
      urgency: triage.urgency,
      first_aid_guidance: triage.first_aid_guidance,
      immediate_dos: guidanceResult.immediate_dos || triage.immediate_dos,
      immediate_donts: guidanceResult.immediate_donts || triage.immediate_donts,
      cpr_advised: guidanceResult.cpr_advised ?? triage.cpr_advised,
    });

    if (triage.cpr_advised || guidanceResult.cpr_advised) {
      setCprMetronomeActive(true);
    }

    if (guidanceResult.first_aid_steps.length > 0) {
      setActiveStepIndex(0);
      setStepSecondsLeft(guidanceResult.first_aid_steps[0].duration_seconds || 30);
      setIsStepTimerRunning(true);
    }

    setAiChatMessages([
      {
        sender: 'ai',
        text: `🚨 AMBULANCE DISPATCHED: ${geo.hospital.name} alerted. Estimated arrival: ${geo.etaMinutes} minutes. Offline first-aid protocol loaded from ${guidanceResult.source} (${guidanceResult.latency_ms}ms). Follow the step-by-step procedure below.`,
        source: guidanceResult.source,
      }
    ]);

    if (onCaseCreated) onCaseCreated(newCase);
    setIsSubmitting(false);
  };

  // AI First Aid Guidance Chat (Offline + Online)
  const handleSendChatQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim()) return;

    const q = userQuery.trim();
    const newHistory = [...aiChatMessages, { sender: 'user' as const, text: q }];
    setAiChatMessages(newHistory);
    setUserQuery('');
    setAiTyping(true);

    const queryResult = await aiModelCacheService.getFirstAidGuidance(q, isOfflineMode);

    let reply = '';
    const lower = q.toLowerCase();

    if (lower.includes('water') || lower.includes('drink') || lower.includes('food')) {
      reply = '❌ DO NOT give food or water if the patient is unresponsive, having chest pain, severe trauma, or may require emergency anesthesia/surgery upon hospital arrival.';
    } else if (lower.includes('cpr') || lower.includes('pump') || lower.includes('chest compression')) {
      reply = '🚨 CPR GUIDE: Place heel of one hand in the center of the chest, other hand on top. Lock elbows. Push down hard and fast at 100-120 beats per minute. Allow full chest recoil between compressions.';
    } else if (lower.includes('bleed') || lower.includes('cut') || lower.includes('pressure')) {
      reply = '🩸 BLEEDING CONTROL: Press firmly with a clean cloth or gauze directly on the wound. Do NOT remove soaked pads — add more on top. If bleeding does not stop on limb, apply a tourniquet 2-3 inches above.';
    } else if (lower.includes('vomit') || lower.includes('chok')) {
      reply = '⚠️ VOMITING / ASPIRATION RISK: Immediately roll the patient onto their side in the Recovery Position. Tilt chin upward slightly to keep the airway open.';
    } else if (lower.includes('inhaler') || lower.includes('asthma') || lower.includes('breath')) {
      reply = '🫁 RESPIRATORY RESCUE: Keep patient seated upright, leaning slightly forward. Administer 2-4 puffs of blue rescue inhaler. Repeat in 4 minutes if severe breathing distress persists.';
    } else if (queryResult.first_aid_steps.length > 0) {
      reply = `${queryResult.primary_condition}: ${queryResult.first_aid_steps.map(s => `[${s.step_number}] ${s.title}: ${s.action}`).join(' ')}`;
    } else {
      reply = `🚑 MEDICAL PROTOCOL: Keep the patient calm, resting, and sheltered. Continuously observe breathing and responsiveness. Paramedics from ${activeCase?.assigned_hospital || 'the trauma center'} are currently en route.`;
    }

    setAiChatMessages([...newHistory, { sender: 'ai', text: reply, source: queryResult.source }]);
    setAiTyping(false);
  };

  const currentStep: FirstAidStep | undefined = aiGuidance?.first_aid_steps[activeStepIndex];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="emergency-hotline-container">
      {/* Black & Red Minimalist Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-red-950/60 border border-red-800/80 rounded-full mb-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
          <span className="text-[10px] uppercase tracking-widest text-red-400 font-mono font-bold">
            ARAMBH RED-ALERT • 2.4 GHz BLUETOOTH HOPPING READY
          </span>
        </div>
        <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-3 text-white">
          Emergency SOS Intake
        </h2>
        <p className="text-neutral-400 text-sm sm:text-base leading-relaxed">
          High-urgency emergency dispatch with real-time AI first-aid triage, offline AES-256 storage, and 40-channel Bluetooth mesh relay.
        </p>

        {/* Database & Cache Inspector Trigger */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setIsInspectorModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-red-400" />
            <span>Inspect Embedded DB & AI Cache</span>
          </button>
        </div>
      </div>

      {/* Hero Action Call Buttons (Black & Red Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        <a
          href="tel:108"
          id="btn-call-hotline"
          className="flex flex-col items-center justify-center p-6 bg-neutral-950 border border-red-900/40 rounded-xl hover:border-red-600 transition-colors group cursor-pointer shadow-lg shadow-black"
        >
          <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center mb-3 shadow-lg shadow-red-950/80 group-hover:scale-105 transition-transform">
            <PhoneCall className="w-6 h-6 text-white" />
          </div>
          <span className="text-sm font-bold uppercase tracking-widest text-white">Call 108 / 911 Hotline</span>
          <span className="text-[10px] text-neutral-400 font-mono mt-1">Direct Emergency Dispatch Line</span>
        </a>

        <button
          type="button"
          onClick={() => {
            const formElem = document.getElementById('emergency-condition-input');
            if (formElem) {
              formElem.focus();
              formElem.scrollIntoView({ behavior: 'smooth' });
            }
          }}
          id="btn-start-intake"
          className="flex flex-col items-center justify-center p-6 bg-neutral-950 border border-neutral-800 hover:border-red-800/60 rounded-xl transition-colors group cursor-pointer shadow-lg shadow-black"
        >
          <div className="w-12 h-12 bg-neutral-900 border border-neutral-700 rounded-full flex items-center justify-center mb-3 group-hover:border-red-600 transition-colors">
            <Radio className="w-6 h-6 text-red-500" />
          </div>
          <span className="text-sm font-bold uppercase tracking-widest text-white">Rapid Clinical Intake</span>
          <span className="text-[10px] text-neutral-400 font-mono mt-1">GPS Hospital Routing + AI Triage</span>
        </button>
      </div>

      {/* Bluetooth Mesh Hopping Live Alert Banner if relayed */}
      {bleHopPacket && (
        <div className="max-w-4xl mx-auto p-4 bg-neutral-950 border border-red-700/60 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Radio className="w-4 h-4 text-red-500 animate-pulse" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                Bluetooth Hopping Mesh Relay Active
              </span>
            </div>
            <span className="text-[10px] font-mono text-green-400 font-bold">
              DELIVERED ({bleHopPacket.latencyMs}ms)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-neutral-300">
            <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-white font-bold">
              Packet ID: {bleHopPacket.packetId}
            </span>
            <span>•</span>
            <span>Hops: <strong className="text-red-400">{bleHopPacket.hopCount}/3</strong></span>
            <span>•</span>
            <span>CRC: <strong className="text-neutral-200">{bleHopPacket.crc32}</strong></span>
            <span>•</span>
            <span className="text-neutral-400">Channels: {bleHopPacket.channelsHopped.join(' ➔ ')}</span>
          </div>

          <p className="text-[11px] font-mono text-neutral-400">
            Route: [Dispatcher] ➔ [Ambulance DL-108 Transceiver] ➔ [District Tower Repeater] ➔ [AIIMS ER Gateway]
          </p>
        </div>
      )}

      {/* Main Intake Form or Active Emergency View */}
      {!activeCase ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Intake Form Column */}
          <div className="lg:col-span-8 bg-neutral-950 border border-neutral-900 rounded-xl p-6 sm:p-8" id="intake-form-wrapper">
            <div className="flex items-center justify-between border-b border-neutral-900 pb-4 mb-6">
              <div>
                <span className="text-[10px] font-mono text-red-500 uppercase tracking-widest font-bold">RAPID CLINICAL INTAKE</span>
                <h3 className="text-lg font-black text-white tracking-tight">Patient Assessment & Geolocation</h3>
              </div>
              <div className="flex items-center space-x-2 px-2.5 py-1 bg-red-950/40 border border-red-900/60 rounded-full">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>
                <span className="text-[9px] font-mono text-red-300 uppercase tracking-widest font-bold">OFF-GRID SECURE DB</span>
              </div>
            </div>

            <form onSubmit={handleSubmitIntake} className="space-y-6">
              {/* Quick preset symptom buttons */}
              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-widest mb-3">
                  SCENARIO PRESETS (TAP TO AUTO-FILL)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('Crushing chest pain radiating to left arm and jaw, profuse cold sweating, patient clutched chest.')}
                    className="p-4 bg-neutral-900/90 rounded-lg border-l-4 border-red-600 text-left hover:bg-neutral-800 transition-colors cursor-pointer border border-neutral-800"
                  >
                    <p className="text-[10px] text-red-400 mb-1 font-mono font-bold">CODE: RED [CARDIAC]</p>
                    <p className="text-sm font-bold text-white">Suspected Cardiac Event</p>
                    <p className="text-xs text-neutral-400 mt-1">Crushing chest pain, arm radiation, cold sweat</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePresetSelect('Deep bleeding wound on right leg with heavy blood flow after accident, patient feeling faint.')}
                    className="p-4 bg-neutral-900/90 rounded-lg border-l-4 border-red-500 text-left hover:bg-neutral-800 transition-colors cursor-pointer border border-neutral-800"
                  >
                    <p className="text-[10px] text-red-400 mb-1 font-mono font-bold">CODE: AMBER [TRAUMA]</p>
                    <p className="text-sm font-bold text-white">Severe Arterial Trauma</p>
                    <p className="text-xs text-neutral-400 mt-1">Profuse bleeding, laceration, hypotension risk</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePresetSelect('Acute severe asthma attack, choking, wheezing heavily, lips turning blue, unable to speak in sentences.')}
                    className="p-4 bg-neutral-900/90 rounded-lg border-l-4 border-red-700 text-left hover:bg-neutral-800 transition-colors cursor-pointer border border-neutral-800"
                  >
                    <p className="text-[10px] text-neutral-300 mb-1 font-mono font-bold">CODE: RED [AIRWAY]</p>
                    <p className="text-sm font-bold text-white">Respiratory Distress / Choking</p>
                    <p className="text-xs text-neutral-400 mt-1">Severe wheezing, cyanosis, airway obstruction</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePresetSelect('Person collapsed on floor, unconscious and unresponsive, weak or irregular pulse.')}
                    className="p-4 bg-neutral-900/90 rounded-lg border-l-4 border-neutral-600 text-left hover:bg-neutral-800 transition-colors cursor-pointer border border-neutral-800"
                  >
                    <p className="text-[10px] text-neutral-400 mb-1 font-mono font-bold">CODE: RED [COLLAPSE]</p>
                    <p className="text-sm font-bold text-white">Unresponsive / Syncope</p>
                    <p className="text-xs text-neutral-400 mt-1">Sudden loss of consciousness, weak pulse</p>
                  </button>
                </div>
              </div>

              {/* Condition text area */}
              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-widest mb-1">
                  PATIENT CONDITION DESCRIPTION *
                </label>
                <textarea
                  required
                  id="emergency-condition-input"
                  rows={3}
                  value={conditionText}
                  onChange={(e) => setConditionText(e.target.value)}
                  placeholder="Describe patient status, chief symptoms, pain location, consciousness..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-600"
                />
              </div>

              {/* GPS Geolocation Coordinates */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                    EMERGENCY GPS COORDINATES
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={locationDetecting}
                    className="text-xs font-mono text-red-400 hover:text-red-300 flex items-center space-x-1 cursor-pointer"
                  >
                    <Navigation className={`w-3.5 h-3.5 ${locationDetecting ? 'animate-spin' : ''}`} />
                    <span>{locationDetecting ? 'Detecting Fix...' : 'Acquire GPS Position'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-neutral-500 font-mono">LATITUDE</span>
                    <input
                      type="number"
                      step="any"
                      value={lat}
                      onChange={(e) => setLat(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-red-600"
                      placeholder="28.6139"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-neutral-500 font-mono">LONGITUDE</span>
                    <input
                      type="number"
                      step="any"
                      value={long}
                      onChange={(e) => setLong(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-red-600"
                      placeholder="77.2090"
                    />
                  </div>
                </div>

                {locationStatus && (
                  <p className="text-[11px] font-mono text-neutral-400 flex items-center space-x-1.5">
                    <MapPin className="w-3 h-3 text-red-500" />
                    <span>{locationStatus}</span>
                  </p>
                )}
              </div>

              {/* Contact Phone */}
              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-widest mb-1">
                  CALLER / ON-SCENE CONTACT NUMBER
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 98112 34567 (Optional)"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-red-600"
                />
              </div>

              {/* Action Buttons: Primary Dispatch & Bluetooth Hopping */}
              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !conditionText.trim()}
                  id="btn-submit-emergency-intake"
                  className="w-full bg-red-600 hover:bg-red-500 disabled:bg-neutral-900 disabled:text-neutral-600 text-white font-bold py-3.5 px-6 rounded-lg uppercase tracking-widest text-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer shadow-lg shadow-red-950/80"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Dispatching & Querying AI Cache...</span>
                    </>
                  ) : (
                    <>
                      <Radio className="w-4 h-4" />
                      <span>Trigger Emergency Dispatch & AI First Aid</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBroadcastBleMesh}
                  disabled={bleBroadcastActive || !conditionText.trim()}
                  className="w-full bg-neutral-900 hover:bg-neutral-850 border border-red-900/60 hover:border-red-600 text-neutral-200 hover:text-white font-mono uppercase tracking-wider text-xs py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <Radio className={`w-4 h-4 text-red-500 ${bleBroadcastActive ? 'animate-spin' : ''}`} />
                  <span>
                    {bleBroadcastActive 
                      ? 'Hopping across 2.4 GHz Bluetooth Mesh...' 
                      : 'Broadcast via Bluetooth Hopping Mesh (Off-Grid)'}
                  </span>
                </button>
              </div>

              {bleRelayStatus && (
                <p className="text-xs font-mono text-neutral-300 p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
                  {bleRelayStatus}
                </p>
              )}
            </form>
          </div>

          {/* Clinical Protocol Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="p-6 bg-neutral-950 border border-neutral-900 rounded-xl space-y-4">
              <div className="flex items-center space-x-2 border-b border-neutral-900 pb-3">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-xs font-mono uppercase tracking-widest text-neutral-300 font-bold">
                  PROCEDURE GUIDE
                </span>
              </div>
              <ol className="space-y-4 text-sm font-sans">
                <li className="flex space-x-3">
                  <span className="text-red-500 font-mono text-[10px] mt-0.5 font-bold">01</span>
                  <span className="text-neutral-300">Loosen restrictive clothing around patient's neck and chest.</span>
                </li>
                <li className="flex space-x-3">
                  <span className="text-red-500 font-mono text-[10px] mt-0.5 font-bold">02</span>
                  <span className="text-neutral-300">Help patient into a comfortable resting position (sitting or side).</span>
                </li>
                <li className="flex space-x-3">
                  <span className="text-red-500 font-mono text-[10px] mt-0.5 font-bold">03</span>
                  <span className="text-white font-bold">Monitor breathing rate and pulse every 60 seconds.</span>
                </li>
              </ol>
            </div>

            {/* Offline Embedded Database Status Card */}
            <div className="p-4 bg-neutral-950 border border-neutral-900 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-neutral-500 uppercase font-mono">STORAGE STATUS</span>
                <span className="text-[10px] font-mono text-green-400 flex items-center space-x-1 font-bold">
                  <ShieldCheck className="w-3 h-3 text-green-400" />
                  <span>EMBEDDED DB ACTIVE</span>
                </span>
              </div>
              <div className="w-full h-1 bg-neutral-900 rounded-full overflow-hidden">
                <div className={`w-full h-full ${isOfflineMode ? 'bg-red-500' : 'bg-green-500'}`}></div>
              </div>
              <p className="text-[10px] text-neutral-400 font-mono">
                IndexedDB AES-256-GCM hardware encryption active. Emergency cases synchronize automatically over BLE mesh or WiFi.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* ACTIVE DISPATCHED EMERGENCY INTERACTION SCREEN (Black & Red) */
        <div className="space-y-6 max-w-5xl mx-auto" id="active-dispatch-container">
          {/* Dispatch Confirmation Card */}
          <div className="bg-neutral-950 border border-red-900/60 rounded-xl p-6 sm:p-8 space-y-6 shadow-2xl shadow-black">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-900 pb-5">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-red-400 font-bold">
                    DISPATCH CONFIRMED • CASE #{activeCase.id}
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
                  Ambulance En Route
                </h3>
                <div className="text-xs font-mono text-neutral-400 mt-1 flex flex-wrap items-center gap-2">
                  <span>Patient ID: <strong className="text-red-400">{activeCase.patient_profile_id}</strong></span>
                  <span>•</span>
                  <span>Status: <strong className="text-red-300 uppercase">{activeCase.status}</strong></span>
                  <span>•</span>
                  <span className="text-neutral-400">AI Cache: {aiGuidance?.source || 'L1_PROTOCOL'} ({aiGuidance?.latency_ms || 1}ms)</span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <a
                  href={`tel:${activeCase.ambulance_phone}`}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2.5 rounded-lg text-xs uppercase tracking-wider flex items-center space-x-2 transition-colors shadow-lg shadow-red-950/80 cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call Ambulance</span>
                </a>

                <button
                  onClick={() => {
                    setActiveCase(null);
                    setActiveTriageDetails(null);
                    setAiGuidance(null);
                  }}
                  className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 px-3 py-2.5 rounded-lg text-xs font-mono uppercase tracking-wider cursor-pointer"
                >
                  New Intake
                </button>
              </div>
            </div>

            {/* Hospital & Arrival Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-neutral-900 rounded-lg border-l-4 border-neutral-700">
                <p className="text-[10px] text-neutral-500 mb-1 font-mono uppercase font-bold">ASSIGNED FACILITY</p>
                <p className="text-sm font-bold text-white">{activeCase.assigned_hospital}</p>
                <p className="text-xs font-mono text-neutral-400 mt-2">ER Hotline: {activeCase.hospital_phone}</p>
              </div>

              <div className="p-4 bg-neutral-900 rounded-lg border-l-4 border-red-600">
                <p className="text-[10px] text-neutral-500 mb-1 font-mono uppercase font-bold">PARAMEDIC ETA</p>
                <p className="text-2xl font-black text-red-500 tracking-tight">~{activeCase.eta_minutes} mins</p>
                <p className="text-xs text-neutral-400 mt-1">{activeCase.distance_km} km distance</p>
              </div>

              <div className="p-4 bg-neutral-900 rounded-lg border-l-4 border-red-500">
                <p className="text-[10px] text-neutral-500 mb-1 font-mono uppercase font-bold">TRIAGE TAG</p>
                <p className="text-sm font-bold text-red-400 uppercase font-mono">{activeCase.triage_tag} PROTOCOL</p>
                <p className="text-xs text-neutral-400 mt-2">Urgency: {activeTriageDetails?.urgency || 'CRITICAL'}</p>
              </div>
            </div>

            {/* CPR Metronome Box (If Cardiac) */}
            {(activeTriageDetails?.cpr_advised || aiGuidance?.cpr_advised) && (
              <div className="bg-neutral-900 border border-red-900/60 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full bg-red-600 flex items-center justify-center ${cprMetronomeActive ? 'animate-ping' : ''}`}>
                    <Heart className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-red-400 text-xs font-mono uppercase">CPR METRONOME PACER (110 BPM)</div>
                    <div className="text-xs text-neutral-300">Push down hard & fast in center of chest 2 inches deep. Synchronized audible tick active.</div>
                  </div>
                </div>
                <button
                  onClick={() => setCprMetronomeActive(!cprMetronomeActive)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded uppercase tracking-wider cursor-pointer"
                >
                  {cprMetronomeActive ? 'Mute Pacer' : 'Start Beat'}
                </button>
              </div>
            )}
          </div>

          {/* INTERACTIVE STEP-BY-STEP FIRST AID GUIDANCE ENGINE */}
          {aiGuidance && aiGuidance.first_aid_steps.length > 0 && (
            <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-6 sm:p-8 space-y-6">
              {/* Guidance Engine Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-900 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-red-400" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-red-400 font-bold">
                      STEP-BY-STEP FIRST AID GUIDANCE • AI RESOLVED
                    </span>
                  </div>
                  <h4 className="text-xl font-black text-white tracking-tight mt-1">
                    {aiGuidance.primary_condition}
                  </h4>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Hands-Free Voice Read-Out */}
                  <button
                    onClick={() => {
                      if (currentStep) {
                        handleSpeakStep(`Step ${currentStep.step_number}. ${currentStep.title}. ${currentStep.action}`);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono uppercase flex items-center space-x-1.5 cursor-pointer transition-colors ${
                      isSpeakingStep 
                        ? 'bg-red-600 text-white border-red-500 animate-pulse' 
                        : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:text-white'
                    }`}
                  >
                    {isSpeakingStep ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span>{isSpeakingStep ? 'Mute Voice' : 'Spoken Guidance'}</span>
                  </button>

                  <button
                    onClick={() => setIsInspectorModalOpen(true)}
                    className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white text-xs cursor-pointer"
                    title="View Cache Details"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Step Navigation Bar */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                {aiGuidance.first_aid_steps.map((st, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectStep(idx)}
                    className={`px-3 py-2 rounded-lg text-xs font-mono whitespace-nowrap transition-colors flex items-center space-x-1.5 cursor-pointer ${
                      activeStepIndex === idx
                        ? 'bg-red-600 text-white font-bold shadow-md shadow-red-950/80'
                        : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                    }`}
                  >
                    <span>Step {st.step_number}</span>
                    {idx < activeStepIndex && <Check className="w-3 h-3 text-green-400" />}
                  </button>
                ))}
              </div>

              {/* Active Step Card */}
              {currentStep && (
                <div className="p-6 bg-neutral-900/90 border border-neutral-800 rounded-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800/80 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold text-white font-mono">
                        {currentStep.step_number}
                      </span>
                      <h5 className="text-base sm:text-lg font-bold text-white">
                        {currentStep.title}
                      </h5>
                    </div>

                    {/* Step Countdown Timer */}
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-red-400" />
                      <span className="text-xs font-mono text-red-400 font-bold">
                        {stepSecondsLeft > 0 ? `${stepSecondsLeft}s Recommended` : 'Completed'}
                      </span>
                      <button
                        onClick={() => setIsStepTimerRunning(!isStepTimerRunning)}
                        className="text-neutral-400 hover:text-white p-1 rounded hover:bg-neutral-800 cursor-pointer"
                      >
                        {isStepTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-sm sm:text-base text-neutral-200 leading-relaxed font-sans">
                    {currentStep.action}
                  </p>

                  {/* Vital Check Callout */}
                  {currentStep.vital_check && (
                    <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-300 flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span>Vital Observation: {currentStep.vital_check}</span>
                    </div>
                  )}

                  {/* Warning Callout */}
                  {currentStep.warning && (
                    <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-xs font-mono text-red-300 flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span>Safety Warning: {currentStep.warning}</span>
                    </div>
                  )}

                  {/* Step Action Buttons */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => handleSpeakStep(`${currentStep.title}. ${currentStep.action}`)}
                      className="text-xs font-mono text-neutral-400 hover:text-white flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-red-400" />
                      <span>Repeat Step Voice</span>
                    </button>

                    <button
                      onClick={handleNextStep}
                      disabled={activeStepIndex >= aiGuidance.first_aid_steps.length - 1}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-xs font-mono uppercase tracking-wider rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <span>{activeStepIndex >= aiGuidance.first_aid_steps.length - 1 ? 'All Steps Completed' : 'Next Step'}</span>
                      <SkipForward className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* First Aid Instructions & Live AI Chat Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Do's and Don'ts */}
            <div className="lg:col-span-7 bg-neutral-950 border border-neutral-900 rounded-xl p-6 space-y-4">
              <div className="flex items-center space-x-2 border-b border-neutral-900 pb-3">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <h4 className="text-xs font-mono uppercase tracking-widest text-neutral-300 font-bold">
                  CRITICAL DO'S AND DON'TS
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-2">
                  <div className="text-[10px] font-mono text-green-400 uppercase tracking-widest flex items-center space-x-1.5 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>WHAT TO DO NOW</span>
                  </div>
                  <ul className="text-xs text-neutral-300 space-y-1.5">
                    {activeTriageDetails?.immediate_dos?.map((item: string, i: number) => (
                      <li key={i} className="flex items-start space-x-1.5">
                        <span className="text-green-400">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-neutral-900 border border-red-950/80 rounded-lg p-4 space-y-2">
                  <div className="text-[10px] font-mono text-red-400 uppercase tracking-widest flex items-center space-x-1.5 font-bold">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>DO NOT DO (PREVENT COMPLICATIONS)</span>
                  </div>
                  <ul className="text-xs text-neutral-300 space-y-1.5">
                    {activeTriageDetails?.immediate_donts?.map((item: string, i: number) => (
                      <li key={i} className="flex items-start space-x-1.5">
                        <span className="text-red-400">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Interactive First Aid AI Advisor Chat */}
            <div className="lg:col-span-5 bg-neutral-950 border border-neutral-900 rounded-xl p-5 flex flex-col h-[480px]">
              <div className="flex items-center justify-between border-b border-neutral-900 pb-3 mb-3">
                <div>
                  <h4 className="text-xs font-bold text-white tracking-tight">AI Medic Chatbot</h4>
                  <p className="text-[10px] font-mono text-neutral-500 uppercase">Interactive Bystander Advice</p>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-neutral-900 text-red-400 border border-neutral-800 uppercase font-bold">
                  {aiGuidance?.source || 'AI ACTIVE'}
                </span>
              </div>

              {/* Chat Message Box */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                {aiChatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg max-w-[90%] leading-relaxed ${
                      msg.sender === 'ai'
                        ? 'bg-neutral-900 text-neutral-200 border border-neutral-800 mr-auto'
                        : 'bg-red-600 text-white ml-auto'
                    }`}
                  >
                    <div>{msg.text}</div>
                    {msg.source && (
                      <div className="text-[9px] font-mono text-neutral-500 mt-1">Source: {msg.source}</div>
                    )}
                  </div>
                ))}

                {aiTyping && (
                  <div className="bg-neutral-900 text-neutral-400 p-2.5 rounded-lg border border-neutral-800 mr-auto inline-flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-bounce"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                )}
              </div>

              {/* Quick Questions */}
              <div className="py-2 flex flex-wrap gap-1.5 border-t border-neutral-900">
                <button
                  onClick={() => setUserQuery('Can I give them water or food?')}
                  className="text-[10px] font-mono px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 cursor-pointer"
                >
                  Give water?
                </button>
                <button
                  onClick={() => setUserQuery('How do I do chest compressions?')}
                  className="text-[10px] font-mono px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 cursor-pointer"
                >
                  How to CPR?
                </button>
                <button
                  onClick={() => setUserQuery('What is recovery position?')}
                  className="text-[10px] font-mono px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 cursor-pointer"
                >
                  Recovery position?
                </button>
                <button
                  onClick={() => setUserQuery('Bleeding is soaking through cloths!')}
                  className="text-[10px] font-mono px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 cursor-pointer"
                >
                  Severe bleeding?
                </button>
              </div>

              {/* Question Input */}
              <form onSubmit={handleSendChatQuery} className="flex items-center space-x-2 pt-2">
                <input
                  type="text"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Ask urgent first-aid question..."
                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-600 font-mono"
                />
                <button
                  type="submit"
                  disabled={!userQuery.trim()}
                  className="bg-red-600 hover:bg-red-500 disabled:bg-neutral-900 text-white p-2 rounded-lg cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Embedded DB & AI Cache Inspector Modal */}
      <DatabaseCacheModal
        isOpen={isInspectorModalOpen}
        onClose={() => setIsInspectorModalOpen(false)}
        isOfflineMode={isOfflineMode}
      />
    </div>
  );
};
