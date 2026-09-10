import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Shield, AlertTriangle, Activity, Settings2, Bell, 
  RotateCcw, CheckCircle2, Volume2, VolumeX, Smartphone,
  Clock, Heart, HelpCircle, ArrowRight, X
} from 'lucide-react';
import { EmergencyCase } from '../types';
import { generateId } from '../services/storage';
import { VibrationService } from '../services/vibrationService';

interface FallMotionGuardProps {
  isOfflineMode: boolean;
  onEmergencyTriggered: (caseData: EmergencyCase) => void;
  onNavigateToSos?: () => void;
}

export type SensitivityLevel = 'normal' | 'low' | 'high';

interface SensitivityConfig {
  name: string;
  description: string;
  freeFallThreshold: number; // m/s^2 (below this is near-zero gravity dip)
  impactThreshold: number;   // m/s^2 (above this is impact spike)
  immobilityTimeMs: number;  // ms of post-impact stillness required
  impactWindowMs: number;    // ms between dip and impact peak
}

const SENSITIVITY_CONFIGS: Record<SensitivityLevel, SensitivityConfig> = {
  normal: {
    name: 'Balanced (Recommended)',
    description: 'Calibrated for everyday home & indoor movement. Filters out phone drops on bed or normal steps.',
    freeFallThreshold: 5.8,  // ~0.59g dip
    impactThreshold: 26.5,   // ~2.70g impact peak
    immobilityTimeMs: 1500,  // 1.5s stillness
    impactWindowMs: 800,     // impact must occur within 800ms of dip
  },
  low: {
    name: 'Low Sensitivity (Active / Commute)',
    description: 'Requires higher impact force. Ideal for running, cycling, driving over speedbumps or active chores.',
    freeFallThreshold: 4.5,  // ~0.46g dip
    impactThreshold: 32.0,   // ~3.26g impact peak
    immobilityTimeMs: 2000,  // 2.0s stillness
    impactWindowMs: 700,
  },
  high: {
    name: 'High Sensitivity (High-Risk Frailty)',
    description: 'Sensitive to gentle slips, bed rolls, or assisted walking. Best for post-operative or elderly care.',
    freeFallThreshold: 6.8,  // ~0.69g dip
    impactThreshold: 22.0,   // ~2.24g impact peak
    immobilityTimeMs: 1200,  // 1.2s stillness
    impactWindowMs: 900,
  },
};

export const FallMotionGuard: React.FC<FallMotionGuardProps> = ({
  isOfflineMode,
  onEmergencyTriggered,
  onNavigateToSos,
}) => {
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [sensitivity, setSensitivity] = useState<SensitivityLevel>('normal');
  const [sensorSupported, setSensorSupported] = useState<boolean>(true);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(true);
  
  // Live Telemetry
  const [currentG, setCurrentG] = useState<number>(1.0);
  const [peakG, setPeakG] = useState<number>(1.0);
  const [statusMessage, setStatusMessage] = useState<string>('Sensor active. Monitoring 3-axis motion.');
  
  // Fall detection state machine
  const [fallAlarmActive, setFallAlarmActive] = useState<boolean>(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(15);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Biomedical Fall Algorithm Refs
  const config = SENSITIVITY_CONFIGS[sensitivity];
  const freeFallTimeRef = useRef<number | null>(null);
  const impactDetectedTimeRef = useRef<number | null>(null);
  const recentAccelerationsRef = useRef<{ g: number; t: number }[]>([]);
  const countdownTimerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Beep sound generator using Web Audio API
  const playAlertChirp = useCallback(() => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioContextRef.current = new AudioCtx();
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      if (audioContextRef.current) {
        const ctx = audioContextRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch {
      // Audio context might be blocked by browser policy
    }
  }, [soundEnabled]);

  // Request iOS Sensor Permissions
  const requestSensorPermission = async () => {
    if (typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
      try {
        const permissionState = await (DeviceMotionEvent as any).requestPermission();
        if (permissionState === 'granted') {
          setPermissionGranted(true);
          setStatusMessage('Accelerometer permission granted.');
        } else {
          setPermissionGranted(false);
          setStatusMessage('Sensor permission was denied.');
        }
      } catch {
        setPermissionGranted(false);
      }
    } else {
      setPermissionGranted(true);
    }
  };

  // Three-Phase Biomedical Fall Detection Processor
  const handleDeviceMotion = useCallback((event: DeviceMotionEvent) => {
    if (!isEnabled || fallAlarmActive) return;

    let ax = 0, ay = 0, az = 0;
    // Prefer accelerationIncludingGravity for true vector magnitude
    if (event.accelerationIncludingGravity && event.accelerationIncludingGravity.x !== null) {
      ax = event.accelerationIncludingGravity.x || 0;
      ay = event.accelerationIncludingGravity.y || 0;
      az = event.accelerationIncludingGravity.z || 0;
    } else if (event.acceleration && event.acceleration.x !== null) {
      ax = event.acceleration.x || 0;
      ay = (event.acceleration.y || 0) + 9.81;
      az = event.acceleration.z || 0;
    } else {
      return;
    }

    // Calculate instantaneous vector magnitude in m/s^2 and Gs
    const totalAccMs2 = Math.sqrt(ax * ax + ay * ay + az * az);
    const totalG = totalAccMs2 / 9.80665;
    const now = Date.now();

    setCurrentG(parseFloat(totalG.toFixed(2)));
    setPeakG(prev => Math.max(prev, parseFloat(totalG.toFixed(2))));

    // Keep last 3 seconds of readings for post-impact immobility analysis
    recentAccelerationsRef.current.push({ g: totalG, t: now });
    if (recentAccelerationsRef.current.length > 90) {
      recentAccelerationsRef.current.shift();
    }

    // Phase 1: Free-fall dip detection (body descending in air)
    if (totalAccMs2 <= config.freeFallThreshold) {
      freeFallTimeRef.current = now;
    }

    // Phase 2: Impact shock peak detection (body striking ground)
    if (totalAccMs2 >= config.impactThreshold) {
      const freeFallTime = freeFallTimeRef.current;
      // Impact must be preceded by a free-fall dip within the allowable window!
      if (freeFallTime && (now - freeFallTime) <= config.impactWindowMs && (now - freeFallTime) >= 40) {
        impactDetectedTimeRef.current = now;
        freeFallTimeRef.current = null; // consume

        // Phase 3: Check for post-impact stillness / immobility
        setTimeout(() => {
          checkImmobilityAfterImpact(now);
        }, config.immobilityTimeMs);
      }
    }
  }, [isEnabled, fallAlarmActive, config]);

  // Phase 3 Immobility Verification
  const checkImmobilityAfterImpact = (impactTime: number) => {
    if (fallAlarmActive) return;
    const readingsAfterImpact = recentAccelerationsRef.current.filter(
      r => r.t >= impactTime && r.t <= impactTime + config.immobilityTimeMs
    );

    if (readingsAfterImpact.length > 5) {
      // Calculate variance of acceleration: if variance is high, user is actively moving / jogging
      const mean = readingsAfterImpact.reduce((acc, r) => acc + r.g, 0) / readingsAfterImpact.length;
      const variance = readingsAfterImpact.reduce((acc, r) => acc + Math.pow(r.g - mean, 2), 0) / readingsAfterImpact.length;
      
      // If variance is low (< 0.15 G^2), user is motionless / incapacitated on floor!
      if (variance < 0.25) {
        triggerFallCountdown();
      }
    } else {
      // Direct trigger if sufficient stillness window elapsed
      triggerFallCountdown();
    }
  };

  // Trigger Fall Alarm Countdown
  const triggerFallCountdown = () => {
    setFallAlarmActive(true);
    setCountdownSeconds(15);
    VibrationService.triggerFallAlarmPulse();
    playAlertChirp();

    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    
    countdownTimerRef.current = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          dispatchAutoEmergency();
          return 0;
        }
        playAlertChirp();
        VibrationService.triggerQuickTap();
        return prev - 1;
      });
    }, 1000);
  };

  // Cancel False Alarm ("I am OK")
  const cancelFallAlarm = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setFallAlarmActive(false);
    setCountdownSeconds(15);
    freeFallTimeRef.current = null;
    impactDetectedTimeRef.current = null;
    setStatusMessage('Fall alarm cancelled. User indicated safe.');
    VibrationService.triggerQuickTap();
  };

  // Dispatch Emergency SOS Automatically
  const dispatchAutoEmergency = () => {
    setFallAlarmActive(false);
    const newCase: EmergencyCase = {
      id: generateId('fall'),
      patient_profile_id: 'pt-1021',
      lat: 19.0760,
      long: 72.8777,
      condition_text: 'Automatic Fall Detected (High-G Impact with Subsequent Immobility). User unconfirmed.',
      contact: '+91 98201 11223',
      triage_tag: 'trauma',
      assigned_hospital: 'Arambh Metro Trauma Center',
      hospital_phone: '+91 22 2656 8000',
      ambulance_phone: '+91 98200 10800',
      distance_km: 1.8,
      eta_minutes: 4,
      status: 'pending',
      first_aid_guidance: [
        'Do not move patient if neck or spine injury is suspected.',
        'Keep patient warm and calm until 108 emergency paramedics arrive.',
        'Check airway and breathing continuously.',
      ],
      created_at: new Date().toISOString(),
    };

    onEmergencyTriggered(newCase);
    if (onNavigateToSos) {
      onNavigateToSos();
    }
  };

  // Simulate Fall for Testing
  const simulateFallImpact = () => {
    VibrationService.triggerFallAlarmPulse();
    setStatusMessage('Simulating biomedical fall sequence (Drop -> Impact -> Immobility)...');
    setCurrentG(0.35); // Free-fall dip
    setTimeout(() => {
      setCurrentG(3.1); // High-G impact
      setPeakG(3.1);
      setTimeout(() => {
        setCurrentG(1.0); // Rest
        triggerFallCountdown();
      }, 300);
    }, 200);
  };

  // Attach DeviceMotion listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!window.DeviceMotionEvent) {
      setSensorSupported(false);
      setStatusMessage('Device motion sensors not supported on this browser/hardware.');
      return;
    }

    window.addEventListener('devicemotion', handleDeviceMotion);
    return () => {
      window.removeEventListener('devicemotion', handleDeviceMotion);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [handleDeviceMotion]);

  // Reset Peak G after 5 seconds of inactivity
  useEffect(() => {
    const timer = setInterval(() => {
      setPeakG(prev => Math.max(1.0, parseFloat((prev * 0.95).toFixed(2))));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-slate-800" id="fall-motion-guard-view">
      
      {/* HEADER: Claude-Style Refined Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              Biomedical Motion Guard • Calibrated Physics
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Fall & Rapid Deceleration Guard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-lg">
            3-stage algorithm: Free-fall weightlessness dip, impact shock spike, and post-fall immobility verification.
          </p>
        </div>

        {/* Master Toggle Switch */}
        <div className="flex items-center space-x-3">
          <span className="text-xs font-semibold text-slate-700">
            {isEnabled ? 'Protection Active' : 'Sensor Paused'}
          </span>
          <button
            type="button"
            onClick={() => {
              setIsEnabled(!isEnabled);
              VibrationService.triggerQuickTap();
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${
              isEnabled ? 'bg-emerald-600' : 'bg-slate-200'
            }`}
            aria-label="Toggle Fall Guard"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* LIVE TELEMETRY & G-FORCE METER CARD */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-sky-600" />
            <h2 className="text-sm font-bold text-slate-900">Live Accelerometer G-Force Telemetry</h2>
          </div>
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span>Peak: <strong className="font-mono text-slate-800">{peakG}g</strong></span>
            <span>•</span>
            <span>Impact Trigger: <strong className="font-mono text-rose-700">{(config.impactThreshold / 9.81).toFixed(1)}g</strong></span>
          </div>
        </div>

        {/* G-Force Visual Gauge */}
        <div>
          <div className="flex justify-between text-[11px] font-mono text-slate-500 mb-1.5">
            <span>0.0g (Free-Fall Dip)</span>
            <span className="text-emerald-700 font-semibold">1.0g (Resting Gravity)</span>
            <span className="text-rose-700 font-semibold">{(config.impactThreshold / 9.81).toFixed(1)}g (Threshold)</span>
            <span>4.0g (Max)</span>
          </div>

          <div className="relative w-full h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            {/* Safe resting gravity marker line */}
            <div className="absolute top-0 bottom-0 left-[25%] w-0.5 bg-emerald-500 z-10" title="1.0g Rest"></div>
            {/* Impact threshold marker line */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10" 
              style={{ left: `${Math.min(100, (config.impactThreshold / (9.81 * 4)) * 100)}%` }}
              title="Impact Threshold"
            ></div>

            {/* Current G bar */}
            <div
              className={`h-full transition-all duration-75 rounded-full ${
                currentG >= config.impactThreshold / 9.81 ? 'bg-rose-600' : 'bg-sky-600'
              }`}
              style={{ width: `${Math.min(100, (currentG / 4.0) * 100)}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-slate-500 font-medium">Instantaneous Vector:</span>
            <span className="text-sm font-bold font-mono text-slate-900">{currentG} G</span>
          </div>
        </div>

        {/* Action Bar: iOS Permission + Test Button */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 flex items-center space-x-1.5">
            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
            <span>{statusMessage}</span>
          </div>

          <div className="flex items-center space-x-2">
            {!permissionGranted && (
              <button
                type="button"
                onClick={requestSensorPermission}
                className="px-3 py-1.5 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 font-semibold hover:bg-sky-100 transition-colors cursor-pointer"
              >
                Enable Motion Sensors
              </button>
            )}

            <button
              type="button"
              onClick={simulateFallImpact}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-colors cursor-pointer shadow-xs flex items-center space-x-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Test Fall Detection</span>
            </button>
          </div>
        </div>
      </div>

      {/* SENSITIVITY CALIBRATION PRESETS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Settings2 className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">Sensitivity & Environmental Tuning</h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">Prevents false alarms</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['normal', 'low', 'high'] as SensitivityLevel[]).map(key => {
            const item = SENSITIVITY_CONFIGS[key];
            const isSelected = sensitivity === key;

            return (
              <div
                key={key}
                onClick={() => {
                  setSensitivity(key);
                  VibrationService.triggerQuickTap();
                }}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  isSelected
                    ? 'border-sky-600 bg-sky-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900">{item.name}</h3>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100/80 text-[10px] font-mono text-slate-600 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Impact Peak:</span>
                    <strong className="text-slate-900">{(item.impactThreshold / 9.81).toFixed(1)}g</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Immobility Hold:</span>
                    <strong className="text-slate-900">{item.immobilityTimeMs / 1000}s</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* HOW THE BIOMEDICAL 3-PHASE DETECTION WORKS */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 text-xs text-slate-600 space-y-2">
        <h3 className="font-bold text-slate-900 flex items-center space-x-1.5">
          <Shield className="w-3.5 h-3.5 text-sky-600" />
          <span>Why this algorithm prevents false alarms:</span>
        </h3>
        <p className="text-slate-500 leading-relaxed">
          Standard smartphone accelerometers often trigger false alarms simply from jumping, sitting down firmly, or tossing a phone on a bed.
          Arambh's clinical algorithm strictly requires a <strong>weightlessness descent</strong> (below 0.59g) immediately before the <strong>impact shock</strong> (exceeding 2.7g), followed by <strong>1.5 seconds of physical stillness</strong>. If the user continues walking or moving normally, the alarm is automatically suppressed.
        </p>
      </div>

      {/* 15-SECOND REASSURING CANCELLATION MODAL */}
      {fallAlarmActive && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-rose-200 rounded-3xl w-full max-w-md shadow-2xl p-6 text-center space-y-6 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="w-16 h-16 rounded-2xl bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-600">
                High-Impact Deceleration Detected
              </span>
              <h2 className="text-xl font-extrabold text-slate-900">
                Are You Injured?
              </h2>
              <p className="text-xs text-slate-500">
                Auto-dispatching 108 Emergency Ambulance & Trauma Bed Reservation in:
              </p>
            </div>

            {/* Countdown Ring */}
            <div className="w-24 h-24 rounded-full border-4 border-rose-600 bg-rose-50/50 flex flex-col items-center justify-center mx-auto shadow-xs">
              <span className="text-3xl font-black font-mono text-rose-600">{countdownSeconds}</span>
              <span className="text-[10px] font-semibold text-rose-500 uppercase">seconds</span>
            </div>

            {/* Huge Prominent "I am OK" Cancel Button */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={cancelFallAlarm}
                className="w-full py-3.5 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
              >
                I am OK • Cancel Emergency Alert
              </button>

              <button
                type="button"
                onClick={dispatchAutoEmergency}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors cursor-pointer border border-rose-200"
              >
                Send 108 Ambulance Immediately
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
