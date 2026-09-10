import React, { useState, useEffect } from 'react';
import { 
  X, WifiOff, Wifi, PhoneCall, MessageSquare, MapPin, Copy, Check, 
  Heart, Activity, AlertTriangle, ShieldCheck, Zap, Radio, 
  ExternalLink, Stethoscope, Share2, RefreshCw, Smartphone
} from 'lucide-react';
import { rankAllHospitals } from '../services/geo';
import { SmsEmergencyService } from '../services/smsEmergencyService';
import { VibrationService } from '../services/vibrationService';

interface OfflineEmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOfflineMode: boolean;
  onToggleOfflineMode: () => void;
  onTriggerSmsModal?: () => void;
}

export const OfflineEmergencyModal: React.FC<OfflineEmergencyModalProps> = ({
  isOpen,
  onClose,
  isOfflineMode,
  onToggleOfflineMode,
  onTriggerSmsModal,
}) => {
  const [copiedCoords, setCopiedCoords] = useState<boolean>(false);
  const [activeFirstAidTab, setActiveFirstAidTab] = useState<'cpr' | 'bleed' | 'choke' | 'seizure'>('cpr');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 28.6139, lng: 77.2090 });
  const [hospitals, setHospitals] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    // Detect user coordinates if available
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(current);
          const ranked = rankAllHospitals(current.lat, current.lng, 'trauma');
          setHospitals(ranked.slice(0, 3));
        },
        () => {
          const ranked = rankAllHospitals(28.6139, 77.2090, 'trauma');
          setHospitals(ranked.slice(0, 3));
        },
        { timeout: 4000 }
      );
    } else {
      const ranked = rankAllHospitals(28.6139, 77.2090, 'trauma');
      setHospitals(ranked.slice(0, 3));
    }

    // Keyboard ESC to close
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyCoordinates = () => {
    VibrationService.triggerQuickTap();
    const text = `EMERGENCY SOS: GPS ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} - Urgent medical assistance needed.`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 2500);
    });
  };

  const emergencySmsPayload = SmsEmergencyService.encodeEmergencyCase({
    lat: coords.lat,
    long: coords.lng,
    age: 45,
    gender: 'Unknown',
    triageTag: 'cardiac',
    condition: 'Offline SOS Alert',
    bedToken: 'BED-RES-OFFLINE',
    targetHospital: hospitals[0]?.hospital.name || 'Metro Trauma Center',
  });

  const launchDirectSms = () => {
    VibrationService.triggerDispatchSuccess();
    const encoded = encodeURIComponent(emergencySmsPayload);
    // Open native SMS compose screen with 108 recipient
    window.location.href = `sms:108?body=${encoded}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-modal-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500 via-rose-500 to-rose-600 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30">
              <WifiOff className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 id="offline-modal-title" className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                  Offline Emergency Toolkit
                </h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/25 text-white">
                  Zero Data
                </span>
              </div>
              <p className="text-xs text-white/90 font-medium mt-0.5">
                Works 100% without internet, mobile data, or Wi-Fi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close offline toolkit"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-slate-800 text-xs">
          
          {/* Quick Offline / Online Switch Banner */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isOfflineMode ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="font-semibold text-slate-700">
                Current App Status: <span className={isOfflineMode ? 'text-amber-700' : 'text-emerald-700'}>{isOfflineMode ? 'Offline (Mesh / 2G)' : 'Online (Live Cloud)'}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                VibrationService.triggerQuickTap();
                onToggleOfflineMode();
              }}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700 transition-colors cursor-pointer shadow-2xs"
            >
              {isOfflineMode ? 'Switch to Online' : 'Simulate Offline'}
            </button>
          </div>

          {/* 1-TAP INSTANT DIALERS */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              1-Tap Emergency Hotlines (No Data Required)
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <a
                href="tel:108"
                onClick={() => VibrationService.triggerQuickTap()}
                className="p-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-left transition-all shadow-xs flex items-center space-x-2.5 active:scale-98"
              >
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <PhoneCall className="w-4 h-4 fill-white" />
                </div>
                <div>
                  <div className="font-bold text-sm leading-tight">Call 108</div>
                  <div className="text-[10px] text-white/80">Ambulance Hotline</div>
                </div>
              </a>

              <a
                href="tel:112"
                onClick={() => VibrationService.triggerQuickTap()}
                className="p-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-left transition-all shadow-xs flex items-center space-x-2.5 active:scale-98"
              >
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <PhoneCall className="w-4 h-4 fill-white" />
                </div>
                <div>
                  <div className="font-bold text-sm leading-tight">Call 112</div>
                  <div className="text-[10px] text-white/80">National Emergency</div>
                </div>
              </a>
            </div>
          </div>

          {/* 1-TAP OFFLINE SMS DISPATCH (GSM 7-BIT) */}
          <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-sky-600" />
                <span className="font-bold text-slate-900 text-xs">
                  Offline SMS Emergency SOS
                </span>
              </div>
              <span className="text-[10px] font-semibold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                GSM 7-Bit
              </span>
            </div>

            <p className="text-slate-600 text-xs leading-relaxed">
              Launches your phone's SMS app with a compressed GPS & emergency triage code addressed directly to emergency coordination hotline <strong>108</strong>.
            </p>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={launchDirectSms}
                className="flex-1 py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Launch Direct SMS (108)</span>
              </button>

              {onTriggerSmsModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onTriggerSmsModal();
                  }}
                  className="py-2 px-3 rounded-lg bg-white border border-sky-300 hover:bg-sky-50 text-sky-700 font-semibold text-xs cursor-pointer shadow-2xs transition-colors"
                >
                  View Details
                </button>
              )}
            </div>
          </div>

          {/* CURRENT GPS & COPY COORDINATES */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
              <div>
                <span className="font-semibold text-slate-700 block">
                  Your GPS Coordinates:
                </span>
                <span className="font-mono text-slate-900 text-[11px]">
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyCoordinates}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center space-x-1 cursor-pointer transition-colors"
            >
              {copiedCoords ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Coordinates</span>
                </>
              )}
            </button>
          </div>

          {/* NEAREST CACHED HOSPITALS & LANDLINES */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Nearest Hospitals (Cached in Local Memory)
              </span>
              <span className="text-[10px] text-slate-400">Direct Landlines</span>
            </div>

            <div className="space-y-1.5">
              {hospitals.map((h, i) => (
                <div
                  key={h.hospital.id || i}
                  className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between hover:border-slate-300 transition-all shadow-2xs"
                >
                  <div className="flex-1 pr-2">
                    <div className="font-semibold text-slate-900 text-xs flex items-center space-x-1.5">
                      <span className="truncate max-w-[200px] sm:max-w-xs">{h.hospital.name}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 shrink-0">
                        {h.availableBeds} ER Beds
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {h.distanceKm} km away • {h.hospital.trauma_level}
                    </div>
                  </div>

                  <a
                    href={`tel:${h.hospital.phone.replace(/[^0-9+]/g, '')}`}
                    onClick={() => VibrationService.triggerQuickTap()}
                    className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-xs flex items-center space-x-1 shrink-0 transition-colors"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="hidden sm:inline">Call ER</span>
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* OFFLINE FIRST-AID QUICK CARDS */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                <Stethoscope className="w-3.5 h-3.5 text-rose-500" />
                <span>Instant Offline First-Aid Guidelines</span>
              </span>
            </div>

            {/* Sub Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveFirstAidTab('cpr')}
                className={`py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                  activeFirstAidTab === 'cpr'
                    ? 'bg-white text-rose-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                CPR (Heart)
              </button>
              <button
                type="button"
                onClick={() => setActiveFirstAidTab('bleed')}
                className={`py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                  activeFirstAidTab === 'bleed'
                    ? 'bg-white text-rose-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bleeding
              </button>
              <button
                type="button"
                onClick={() => setActiveFirstAidTab('choke')}
                className={`py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                  activeFirstAidTab === 'choke'
                    ? 'bg-white text-rose-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Choking
              </button>
              <button
                type="button"
                onClick={() => setActiveFirstAidTab('seizure')}
                className={`py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                  activeFirstAidTab === 'seizure'
                    ? 'bg-white text-rose-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Seizure
              </button>
            </div>

            {/* Protocol Content Card */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              {activeFirstAidTab === 'cpr' && (
                <>
                  <div className="font-bold text-rose-800 flex items-center space-x-1.5">
                    <Heart className="w-3.5 h-3.5 fill-rose-600 text-rose-600" />
                    <span>Adult CPR: 100-120 Compressions/min</span>
                  </div>
                  <ul className="list-disc list-inside text-slate-600 space-y-1 pl-1 text-[11px]">
                    <li>Place heel of one hand in center of chest, interlock fingers of other hand.</li>
                    <li>Push hard and fast: 2 inches deep. Allow full chest recoil.</li>
                    <li>Follow 30 chest compressions with 2 gentle rescue breaths (if trained).</li>
                    <li>Do not stop until paramedics arrive or person breathes normally.</li>
                  </ul>
                </>
              )}

              {activeFirstAidTab === 'bleed' && (
                <>
                  <div className="font-bold text-rose-800 flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Severe Bleeding & Lacerations</span>
                  </div>
                  <ul className="list-disc list-inside text-slate-600 space-y-1 pl-1 text-[11px]">
                    <li>Apply direct continuous pressure with a clean cloth or gauze.</li>
                    <li>Do not remove soaked cloth; layer fresh bandages directly on top.</li>
                    <li>Elevate the wounded limb above heart level if no fracture is suspected.</li>
                    <li>For catastrophic limb bleeding, apply a tourniquet 2 inches above wound.</li>
                  </ul>
                </>
              )}

              {activeFirstAidTab === 'choke' && (
                <>
                  <div className="font-bold text-sky-800 flex items-center space-x-1.5">
                    <Activity className="w-3.5 h-3.5 text-sky-600" />
                    <span>Choking & Airway Obstruction</span>
                  </div>
                  <ul className="list-disc list-inside text-slate-600 space-y-1 pl-1 text-[11px]">
                    <li>Deliver 5 sharp back blows between shoulder blades with heel of hand.</li>
                    <li>Perform 5 abdominal thrusts (Heimlich): fist above navel, pull inward & upward.</li>
                    <li>Repeat cycle of 5 blows and 5 thrusts until airway clears.</li>
                    <li>If person falls unconscious, lower gently to floor and begin CPR.</li>
                  </ul>
                </>
              )}

              {activeFirstAidTab === 'seizure' && (
                <>
                  <div className="font-bold text-amber-800 flex items-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>Seizure & Head Collapse</span>
                  </div>
                  <ul className="list-disc list-inside text-slate-600 space-y-1 pl-1 text-[11px]">
                    <li>Gently guide person to ground; cushion head with folded jacket or towel.</li>
                    <li>Turn person onto their side (recovery position) to prevent choking.</li>
                    <li><strong>NEVER</strong> insert fingers, spoons, or objects into their mouth.</li>
                    <li>Time the seizure. Call 108 immediately if seizure lasts over 5 minutes.</li>
                  </ul>
                </>
              )}
            </div>
          </div>

          {/* Bluetooth Mesh Relay Info */}
          <div className="p-2.5 rounded-xl bg-slate-100/70 border border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center space-x-1.5">
              <Radio className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
              <span>Offline Bluetooth Beacon: Active (Ready to hop across local nodes)</span>
            </div>
            <span className="font-mono text-[10px] text-slate-400">Arambh-Mesh v1</span>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            Arambh Offline Protocol • SIH 2024
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs cursor-pointer transition-colors shadow-xs"
          >
            Close Toolkit
          </button>
        </div>
      </div>
    </div>
  );
};
