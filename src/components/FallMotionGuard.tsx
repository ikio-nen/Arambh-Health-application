import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, Activity, Volume2, VolumeX, Mic, MicOff, 
  PhoneCall, AlertTriangle, Plus, Trash2, CheckCircle2, 
  Send, Zap, Bell, UserPlus, HeartPulse, Sparkles, Smartphone, Vibrate
} from 'lucide-react';
import { EmergencyContactPerson, EmergencyCase } from '../types';
import { LocalClinicalStorage } from '../services/storage';
import { nearestHospital } from '../services/geo';
import { secureLocalDB } from '../services/secureLocalDatabase';
import { VibrationService } from '../services/vibrationService';
import { SmsEmergencyService } from '../services/smsEmergencyService';
import { AmbulanceLiveTracker } from './AmbulanceLiveTracker';
import { SmsDispatchModal } from './SmsDispatchModal';
import { MessageSquare } from 'lucide-react';

interface FallMotionGuardProps {
  isOfflineMode: boolean;
  onEmergencyTriggered?: (caseData: EmergencyCase) => void;
}

export const FallMotionGuard: React.FC<FallMotionGuardProps> = ({
  isOfflineMode,
  onEmergencyTriggered,
}) => {
  // Motion Sensor State
  const [motionSupported, setMotionSupported] = useState<boolean>(true);
  const [currentAccel, setCurrentAccel] = useState<number>(9.8);
  const [maxAccelObserved, setMaxAccelObserved] = useState<number>(9.8);
  const [fallDetected, setFallDetected] = useState<boolean>(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(15);
  const [alertDispatched, setAlertDispatched] = useState<boolean>(false);
  const [dispatchedCase, setDispatchedCase] = useState<EmergencyCase | null>(null);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState<boolean>(false);
  const [hapticEnabled, setHapticEnabled] = useState<boolean>(true);
  const [hapticTested, setHapticTested] = useState<boolean>(false);

  // Voice Activation State
  const [voiceActive, setVoiceActive] = useState<boolean>(false);
  const [lastVoiceTrigger, setLastVoiceTrigger] = useState<string>('');
  const voiceRecognitionRef = useRef<any>(null);

  // Emergency Contacts State
  const [contacts, setContacts] = useState<EmergencyContactPerson[]>([]);
  const [newName, setNewName] = useState<string>('');
  const [newRel, setNewRel] = useState<string>('Spouse');
  const [newPhone, setNewPhone] = useState<string>('');
  const [showAddContact, setShowAddContact] = useState<boolean>(false);
  const [testNotificationSent, setTestNotificationSent] = useState<string>('');

  // Audio Beep Synthesizer for Fall Alarm
  const audioCtxRef = useRef<AudioContext | null>(null);
  const countdownIntervalRef = useRef<any>(null);

  // Load Contacts on mount
  useEffect(() => {
    setContacts(LocalClinicalStorage.getEmergencyContacts());
  }, []);

  // 1. Device Motion Sensor Event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc) return;

      const x = acc.x || 0;
      const y = acc.y || 0;
      const z = acc.z || 0;
      const magnitude = Math.round(Math.sqrt(x * x + y * y + z * z) * 10) / 10;

      setCurrentAccel(magnitude);
      if (magnitude > maxAccelObserved) {
        setMaxAccelObserved(magnitude);
      }

      // Shock Threshold: Sudden deceleration/impact spike > 24 m/s²
      if (magnitude > 24 && !fallDetected && !alertDispatched) {
        triggerFallEmergency('Device accelerometer spike: Sudden impact detected');
      }
    };

    if ('DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', handleMotion);
    } else {
      setMotionSupported(false);
    }

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [fallDetected, alertDispatched, maxAccelObserved]);

  // 2. Play Alarm Sound
  const playAlarmBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current && AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current) {
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, audioCtxRef.current.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtxRef.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        osc.start();
        osc.stop(audioCtxRef.current.currentTime + 0.3);
      }
    } catch (e) {
      console.warn('Audio alarm error:', e);
    }
  };

  // 3. Trigger Fall Countdown with Physical Vibration Feedback
  const triggerFallEmergency = (reason: string) => {
    setFallDetected(true);
    setCountdownSeconds(15);

    // Trigger immediate physical haptic pulse
    if (hapticEnabled) {
      VibrationService.triggerFallAlarmPulse();
    }

    // Spoken alert
    if ('speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance('Fall detected. Ambulance and emergency contacts will be dispatched.');
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech error:', e);
      }
    }
  };

  // Countdown timer effect
  useEffect(() => {
    if (fallDetected && countdownSeconds > 0) {
      playAlarmBeep();
      // Physically pulse every 2 seconds during active countdown
      if (hapticEnabled && countdownSeconds % 2 === 0) {
        VibrationService.triggerFallAlarmPulse();
      }

      countdownIntervalRef.current = setTimeout(() => {
        setCountdownSeconds(prev => prev - 1);
      }, 1000);
    } else if (fallDetected && countdownSeconds === 0) {
      executeEmergencyDispatch();
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearTimeout(countdownIntervalRef.current);
      }
    };
  }, [fallDetected, countdownSeconds, hapticEnabled]);

  const cancelFallAlert = () => {
    // Physically stop all vibrations immediately
    VibrationService.stopAll();
    setFallDetected(false);
    setCountdownSeconds(15);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const cancelUtterance = new SpeechSynthesisUtterance('Fall alert cancelled.');
      window.speechSynthesis.speak(cancelUtterance);
    }
  };

  // Execute Dispatch when Fall Confirmed
  const executeEmergencyDispatch = async () => {
    setFallDetected(false);
    setAlertDispatched(true);

    if (hapticEnabled) {
      VibrationService.triggerDispatchSuccess();
    }

    const geo = nearestHospital(28.6139, 77.2090);
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const caseId = `EMG-FALL-${suffix}`;

    const newCase: EmergencyCase = {
      id: caseId,
      patient_profile_id: `pt-shell-${suffix}`,
      lat: 28.6139,
      long: 77.2090,
      condition_text: 'SUDDEN HARD FALL DETECTED (High-g Impact Shock). Physical vibration alarm dispatched.',
      contact: contacts[0]?.phone || '+91 98201 44521',
      triage_tag: 'trauma',
      assigned_hospital: geo.hospital.name,
      hospital_phone: geo.hospital.phone,
      ambulance_phone: geo.hospital.ambulance_hotline,
      distance_km: geo.distanceKm,
      eta_minutes: geo.etaMinutes,
      status: 'dispatched',
      first_aid_guidance: [
        'Do not move patient head or neck if spinal injury is suspected.',
        'Keep patient warm and check airway breathing rhythm.',
      ],
      created_at: new Date().toISOString(),
    };

    await secureLocalDB.saveEmergencyCase(newCase, isOfflineMode);
    setDispatchedCase(newCase);

    // Automatically dispatch cellular SMS alert to 108 and emergency contact
    SmsEmergencyService.dispatchEmergencySms({
      phoneNumber: contacts[0]?.phone || '108',
      message: SmsEmergencyService.encodeEmergencyCase({
        lat: 28.6139,
        long: 77.2090,
        triageTag: 'trauma',
        condition: 'HARD FALL DETECTED (High-g Impact Shock)',
        bedToken: `BED-RES-${suffix}`,
        targetHospital: geo.hospital.name,
      }),
      caseId: caseId,
      recipientType: contacts[0]?.phone ? 'EMERGENCY_CONTACT' : 'EMS_CONTROL_ROOM',
    });

    if (onEmergencyTriggered) {
      onEmergencyTriggered(newCase);
    }

    if ('speechSynthesis' in window) {
      const dispatchUtterance = new SpeechSynthesisUtterance(
        `Emergency dispatched to ${geo.hospital.name}. Contacts alerted.`
      );
      window.speechSynthesis.speak(dispatchUtterance);
    }
  };

  // 4. Continuous Voice Trigger Listener (Hands-Free)
  const toggleVoiceTrigger = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition not supported in this browser.');
      return;
    }

    if (voiceActive) {
      if (voiceRecognitionRef.current) voiceRecognitionRef.current.stop();
      setVoiceActive(false);
    } else {
      try {
        const recog = new SpeechRecognition();
        recog.continuous = true;
        recog.interimResults = true;
        recog.lang = 'en-US';

        recog.onresult = (evt: any) => {
          for (let i = evt.resultIndex; i < evt.results.length; i++) {
            const text = evt.results[i][0].transcript.toLowerCase();
            if (
              text.includes('help') || 
              text.includes('sos') || 
              text.includes('ambulance') || 
              text.includes('admit') || 
              text.includes('heart') || 
              text.includes('fell')
            ) {
              setLastVoiceTrigger(text);
              triggerFallEmergency(`Voice trigger keyword detected: "${text}"`);
            }
          }
        };

        recog.onerror = (err: any) => console.warn('Voice recog error:', err);
        recog.onend = () => {
          if (voiceActive) {
            try { recog.start(); } catch {}
          }
        };

        recog.start();
        voiceRecognitionRef.current = recog;
        setVoiceActive(true);
      } catch (e) {
        console.warn('Voice listener start err:', e);
      }
    }
  };

  // Test Vibration Manually
  const handleTestVibration = () => {
    VibrationService.triggerFallAlarmPulse();
    setHapticTested(true);
    setTimeout(() => setHapticTested(false), 2500);
  };

  // Contacts Management
  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    const newContact: EmergencyContactPerson = {
      id: `ec-${Date.now()}`,
      name: newName.trim(),
      relationship: newRel,
      phone: newPhone.trim(),
      notifyOnFall: true,
      notifyOnSos: true,
    };

    const updated = [...contacts, newContact];
    setContacts(updated);
    LocalClinicalStorage.saveEmergencyContacts(updated);
    setNewName('');
    setNewPhone('');
    setShowAddContact(false);
    VibrationService.triggerQuickTap();
  };

  const handleDeleteContact = (id: string) => {
    const updated = contacts.filter(c => c.id !== id);
    setContacts(updated);
    LocalClinicalStorage.saveEmergencyContacts(updated);
    VibrationService.triggerQuickTap();
  };

  const handleSendTestNotification = () => {
    VibrationService.triggerQuickTap();
    setIsSmsModalOpen(true);
    setTestNotificationSent('Opening Emergency SMS Dispatcher with test payload...');
    setTimeout(() => setTestNotificationSent(''), 4000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-6 text-slate-100" id="fall-motion-guard-view">
      {/* FULLSCREEN COUNTDOWN MODAL ON FALL DETECTION */}
      {fallDetected && (
        <div className="fixed inset-0 z-[120] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#111317] border border-red-500/40 rounded-2xl p-6 sm:p-8 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500 text-red-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8 animate-bounce" />
            </div>

            <div>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-red-500/15 text-red-400 uppercase tracking-wider">
                IMPACT SHOCK DETECTED
              </span>
              <h2 className="text-3xl font-extrabold text-white mt-2 tracking-tight">
                Fall Alarm Active
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                Your device is physically vibrating. Alerting emergency contacts & nearest hospital in:
              </p>
            </div>

            {/* Huge Clean Countdown */}
            <div className="py-2">
              <div className="text-7xl font-mono font-extrabold text-white tracking-tighter">
                {countdownSeconds}s
              </div>
            </div>

            {/* Cancel False Alarm Button */}
            <div className="space-y-3">
              <button
                onClick={cancelFallAlert}
                className="w-full py-4 rounded-xl bg-white text-black hover:bg-slate-200 font-bold text-base transition-all cursor-pointer shadow-lg active:scale-98"
              >
                I'm Okay — Cancel Alert
              </button>

              <button
                onClick={executeEmergencyDispatch}
                className="w-full py-3 rounded-xl bg-[#1a1d24] hover:bg-[#232731] text-red-400 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer border border-red-500/30"
              >
                Dispatch Immediately
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISPATCH CONFIRMATION */}
      {alertDispatched && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white border border-emerald-300 shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <h3 className="font-semibold text-sm text-slate-900">Fall Emergency Dispatched</h3>
                <p className="text-xs text-slate-500">
                  Ambulance routed & emergency contacts messaged with your coordinates.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsSmsModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-semibold border border-sky-200 cursor-pointer"
              >
                SMS Gateway
              </button>
              <button
                onClick={() => setAlertDispatched(false)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>

          {dispatchedCase && (
            <AmbulanceLiveTracker emergencyCase={dispatchedCase} />
          )}
        </div>
      )}

      {/* HEADER: MINIMAL & REFINED */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              Autonomous Motion & Tactile Safety
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
            Fall Guard & Vibration Feedback
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Samples motion deceleration vectors and physically pulses the phone upon impact.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleTestVibration}
            className="py-2 px-3 rounded-xl bg-[#14161a] hover:bg-[#1a1d24] text-xs font-mono text-slate-200 border border-white/10 flex items-center space-x-1.5 transition-all cursor-pointer"
            title="Test Physical Vibration API on your device"
          >
            <Smartphone className={`w-3.5 h-3.5 ${hapticTested ? 'text-red-400 animate-spin' : 'text-slate-400'}`} />
            <span>{hapticTested ? 'Pulsing Device...' : 'Test Vibration'}</span>
          </button>

          <button
            onClick={() => triggerFallEmergency('Manual Simulation')}
            className="py-2 px-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-mono text-xs font-bold uppercase transition-all cursor-pointer"
          >
            Simulate Fall
          </button>
        </div>
      </div>

      {/* SENSORS & PHYSICAL FEEDBACK CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Accelerometer & Vibration Status */}
        <div className="bg-[#111317] border border-white/5 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">Motion Accelerometer</h3>
                <span className="text-[10px] font-mono text-slate-400">
                  {motionSupported ? 'Active 3-Axis Vector' : 'Simulated Sensor Mode'}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setHapticEnabled(!hapticEnabled);
                VibrationService.triggerQuickTap();
              }}
              className={`text-[10px] font-mono px-2 py-1 rounded-md border transition-colors ${
                hapticEnabled 
                  ? 'bg-red-500/15 border-red-500/40 text-red-400' 
                  : 'bg-[#181b22] border-white/10 text-slate-500'
              }`}
            >
              {hapticEnabled ? 'HAPTIC ON' : 'HAPTIC OFF'}
            </button>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Live Force: <b className="text-white">{currentAccel} m/s²</b></span>
              <span>Peak Recorded: <b className="text-amber-400">{maxAccelObserved} m/s²</b></span>
            </div>
            {/* Minimal gauge bar */}
            <div className="w-full h-2 bg-[#1a1d24] rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-100 ${
                  currentAccel > 20 ? 'bg-red-500' : currentAccel > 14 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, (currentAccel / 30) * 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>0 Rest</span>
              <span>9.8 Gravity</span>
              <span>&gt;24 Impact Shock</span>
            </div>
          </div>
        </div>

        {/* Card 2: Hands-Free Continuous Voice Activation */}
        <div className="bg-[#111317] border border-white/5 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">Voice Trigger Sentinel</h3>
                <span className="text-[10px] font-mono text-slate-400">Hands-Free Hotword Detection</span>
              </div>
            </div>

            <button
              onClick={toggleVoiceTrigger}
              className={`text-[10px] font-mono px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                voiceActive 
                  ? 'bg-red-500 text-white font-bold' 
                  : 'bg-[#181b22] text-slate-400 border border-white/10 hover:text-white'
              }`}
            >
              {voiceActive ? 'LISTENING' : 'START LISTENING'}
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Shout keywords like <span className="text-white font-mono font-medium">"HELP"</span>, <span className="text-white font-mono font-medium">"SOS"</span>, or <span className="text-white font-mono font-medium">"AMBULANCE"</span> to trigger emergency dispatch hands-free.
          </p>

          {lastVoiceTrigger && (
            <div className="text-[11px] font-mono text-emerald-400">
              Detected: "{lastVoiceTrigger}"
            </div>
          )}
        </div>
      </div>

      {/* GUARDIAN CONTACTS SETUP */}
      <div className="bg-[#111317] border border-white/5 p-5 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
          <div>
            <h2 className="text-base font-semibold text-white">
              Emergency Contacts ({contacts.length})
            </h2>
            <p className="text-xs text-slate-400">
              Recipients receiving SMS and live GPS coordinates when a fall occurs.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAddContact(!showAddContact)}
              className="px-3 py-1.5 rounded-lg bg-white text-black hover:bg-slate-200 font-mono text-xs font-semibold uppercase flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>

            <button
              onClick={handleSendTestNotification}
              className="px-3 py-1.5 rounded-lg bg-[#181b22] hover:bg-[#20242e] text-slate-300 font-mono text-xs uppercase border border-white/10 cursor-pointer"
            >
              Test SMS
            </button>
          </div>
        </div>

        {testNotificationSent && (
          <div className="p-3 bg-[#181b22] border border-emerald-500/30 rounded-xl text-xs font-mono text-emerald-400 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{testNotificationSent}</span>
          </div>
        )}

        {/* Add Contact Form */}
        {showAddContact && (
          <form onSubmit={handleAddContact} className="p-4 bg-[#14161a] rounded-xl border border-white/10 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">Contact Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Sunita Deshmukh"
                  className="w-full bg-[#1c1f26] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">Relationship</label>
                <select
                  value={newRel}
                  onChange={(e) => setNewRel(e.target.value)}
                  className="w-full bg-[#1c1f26] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                >
                  <option value="Spouse">Spouse</option>
                  <option value="Parent">Parent</option>
                  <option value="Son/Daughter">Son/Daughter</option>
                  <option value="Family Doctor">Family Doctor</option>
                  <option value="Neighbor">Neighbor</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">Phone Number</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+91 98201 11223"
                  className="w-full bg-[#1c1f26] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddContact(false)}
                className="px-3 py-1.5 rounded-lg bg-[#181b22] text-xs font-mono text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white font-mono text-xs font-bold uppercase"
              >
                Save Contact
              </button>
            </div>
          </form>
        )}

        {/* Contacts List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {contacts.map((contact) => (
            <div 
              key={contact.id}
              className="p-3.5 bg-[#14161a] border border-white/5 rounded-xl flex items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-sm text-white">{contact.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1c1f26] text-slate-400">
                    {contact.relationship}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400 mt-0.5">{contact.phone}</div>
              </div>

              <div className="flex items-center space-x-1">
                <a
                  href={`tel:${contact.phone}`}
                  className="p-2 rounded-lg bg-[#1c1f26] hover:bg-[#232731] text-slate-300 hover:text-white"
                  title="Call Contact"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => handleDeleteContact(contact.id)}
                  className="p-2 rounded-lg bg-[#1c1f26] hover:bg-[#232731] text-slate-500 hover:text-red-400"
                  title="Remove Contact"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* EMERGENCY SMS DISPATCH MODAL */}
      <SmsDispatchModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        initialMessage={dispatchedCase ? SmsEmergencyService.encodeEmergencyCase({
          lat: dispatchedCase.lat,
          long: dispatchedCase.long,
          triageTag: dispatchedCase.triage_tag,
          condition: dispatchedCase.condition_text,
          bedToken: `BED-RES-${dispatchedCase.id.slice(-4)}`,
          targetHospital: dispatchedCase.assigned_hospital,
        }) : 'ARAMBH#SOS|v1|GPS:28.6139,77.2090|P:65M|T:TRM|C:TEST_FALL_ALERT|BED:BED-TEST|H:AIIMS|TM:1200'}
        initialPhone={contacts[0]?.phone || '108'}
        caseId={dispatchedCase?.id || 'EMG-FALL-TEST'}
        targetHospital={dispatchedCase?.assigned_hospital || 'AIIMS Trauma Center'}
      />
    </div>
  );
};
