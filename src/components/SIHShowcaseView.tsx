import React, { useState } from 'react';
import { 
  Radio, Smartphone, Download, CheckCircle2, ShieldCheck, 
  Zap, MapPin, Send, AlertTriangle, MessageSquare, Terminal, 
  ArrowRight, Copy, Check, ExternalLink, RefreshCw, Layers
} from 'lucide-react';
import { SmsEmergencyService, DecodedEmergencySms } from '../services/smsEmergencyService';
import { PWAInstallButton } from './PWAInstallButton';
import { VibrationService } from '../services/vibrationService';

interface SIHShowcaseViewProps {
  isOfflineMode: boolean;
  onToggleOfflineMode: () => void;
  onOpenFastAdmit: () => void;
}

export const SIHShowcaseView: React.FC<SIHShowcaseViewProps> = ({
  isOfflineMode,
  onToggleOfflineMode,
  onOpenFastAdmit,
}) => {
  const [activeTab, setActiveTab] = useState<'sms_lab' | 'apk_guide' | 'architecture'>('sms_lab');
  
  // SMS Lab State
  const presets = SmsEmergencyService.getSihDemoPresets();
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const selectedPreset = presets[selectedPresetIndex];

  const [generatedSms, setGeneratedSms] = useState<string>(() => {
    return SmsEmergencyService.encodeEmergencyCase({
      lat: presets[0].lat,
      long: presets[0].long,
      age: presets[0].age,
      gender: presets[0].gender,
      triageTag: presets[0].tag,
      condition: presets[0].condition,
      bedToken: 'BED-RES-1081',
      targetHospital: presets[0].hospital,
    });
  });

  const [decodedSms, setDecodedSms] = useState<DecodedEmergencySms | null>(() => {
    return SmsEmergencyService.decodeEmergencySms(generatedSms);
  });

  const [isSimulatingReceiver, setIsSimulatingReceiver] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const handleSelectPreset = (index: number) => {
    VibrationService.triggerQuickTap();
    setSelectedPresetIndex(index);
    const p = presets[index];
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const encoded = SmsEmergencyService.encodeEmergencyCase({
      lat: p.lat,
      long: p.long,
      age: p.age,
      gender: p.gender,
      triageTag: p.tag,
      condition: p.condition,
      bedToken: `BED-RES-${suffix}`,
      targetHospital: p.hospital,
    });
    setGeneratedSms(encoded);
    setDecodedSms(SmsEmergencyService.decodeEmergencySms(encoded));
  };

  const handleSimulateHospitalReceive = () => {
    VibrationService.triggerDispatchSuccess();
    setIsSimulatingReceiver(true);
    setTimeout(() => {
      setDecodedSms(SmsEmergencyService.decodeEmergencySms(generatedSms));
      setIsSimulatingReceiver(false);
    }, 400);
  };

  const copyToClipboard = (text: string) => {
    VibrationService.triggerQuickTap();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAndroidManifest = () => {
    VibrationService.triggerQuickTap();
    const manifestData = {
      packageId: "com.arambh.emergency.app",
      host: window.location.hostname,
      name: "Arambh Health - Emergency Fast Admit",
      shortName: "ArambhSOS",
      themeColor: "#090a0c",
      navigationColor: "#090a0c",
      backgroundColor: "#090a0c",
      startUrl: "/",
      iconUrl: `${window.location.origin}/pwa-512x512.png`,
      maskableIconUrl: `${window.location.origin}/pwa-maskable-512x512.png`,
      display: "standalone",
      orientation: "portrait",
      features: [
        "Offline Service Worker Caching",
        "Encrypted GSM 7-bit SMS Dispatch (108)",
        "Hardware Vibration API for CPR & Impact",
        "GPS Geolocation without Mobile Internet",
        "IndexedDB Local Clinical Vault"
      ]
    };
    const blob = new Blob([JSON.stringify(manifestData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arambh-android-twa-manifest.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 space-y-6 text-slate-100" id="sih-showcase-view">
      {/* SIH HEADER BANNER */}
      <div className="bg-[#111317] border border-red-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-red-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded bg-red-500 text-white font-mono text-[10px] font-bold uppercase tracking-wider">
                SIH HACKATHON SHOWCASE
              </span>
              <span className="text-[11px] font-mono text-emerald-400 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>JURY DEMO MODE</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1.5">
              Zero-Delay Emergency Fast Admit & Offline SMS
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Engineered for disaster zones, rural highways, and zero-connectivity scenarios. Demonstrates 100% offline APK execution and compressed GSM 7-bit SMS emergency dispatch to 108.
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            <PWAInstallButton variant="compact" />
            <button
              onClick={() => {
                VibrationService.triggerQuickTap();
                onToggleOfflineMode();
              }}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs border transition-all cursor-pointer flex items-center space-x-1.5 ${
                isOfflineMode 
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-400 font-bold' 
                  : 'bg-[#181b22] border-white/10 text-slate-400'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{isOfflineMode ? 'AIRPLANE MODE (OFF-GRID)' : 'SIMULATE AIRPLANE MODE'}</span>
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex border-b border-white/5 pt-3 font-mono text-xs">
          <button
            onClick={() => {
              VibrationService.triggerQuickTap();
              setActiveTab('sms_lab');
            }}
            className={`py-2.5 px-4 font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center space-x-2 ${
              activeTab === 'sms_lab'
                ? 'border-b-2 border-red-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-red-500" />
            <span>1. Offline SMS Protocol Lab</span>
          </button>

          <button
            onClick={() => {
              VibrationService.triggerQuickTap();
              setActiveTab('apk_guide');
            }}
            className={`py-2.5 px-4 font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center space-x-2 ${
              activeTab === 'apk_guide'
                ? 'border-b-2 border-red-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-red-500" />
            <span>2. Android APK Installation</span>
          </button>

          <button
            onClick={() => {
              VibrationService.triggerQuickTap();
              setActiveTab('architecture');
            }}
            className={`py-2.5 px-4 font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center space-x-2 ${
              activeTab === 'architecture'
                ? 'border-b-2 border-red-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-red-500" />
            <span>3. Hackathon Architecture</span>
          </button>
        </div>
      </div>

      {/* TAB 1: OFFLINE SMS LAB */}
      {activeTab === 'sms_lab' && (
        <div className="space-y-6">
          {/* Preset Selector */}
          <div className="bg-[#111317] border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-400">SIH Judge Demo</span>
                <h3 className="text-base font-bold text-white">Select Disaster / Highway Scenario</h3>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                0 KB DATA REQUIRED
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {presets.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectPreset(idx)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedPresetIndex === idx
                      ? 'bg-red-500/15 border-red-500 text-white shadow-lg'
                      : 'bg-[#14161a] border-white/5 text-slate-300 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{item.title}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 uppercase">
                      {item.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{item.condition}</p>
                  <div className="text-[10px] font-mono text-slate-500 mt-1.5">
                    {item.hospital} • {item.age}y/{item.gender}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* TWO-TERMINAL SIMULATION GRID: OUTBOUND PATIENT PHONE vs INBOUND HOSPITAL TERMINAL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TERMINAL A: PATIENT / CALLER PHONE (OUTBOUND SMS) */}
            <div className="bg-[#111317] border border-white/10 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="w-4 h-4 text-red-400" />
                    <span className="text-xs font-mono font-bold text-white uppercase">
                      Caller Device (Android / 2G)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    Target: <b>108 Emergency</b>
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                    <span>ARAMBH COMPACT GSM 7-BIT PAYLOAD:</span>
                    <span className={generatedSms.length <= 160 ? 'text-emerald-400' : 'text-amber-400'}>
                      {generatedSms.length}/160 chars (Single SMS)
                    </span>
                  </div>
                  <div className="p-3 bg-[#0a0b0e] border border-white/10 rounded-xl font-mono text-xs text-amber-300 break-all select-all leading-relaxed">
                    {generatedSms}
                  </div>
                </div>

                <div className="p-3 bg-[#181b22] rounded-xl border border-white/5 text-xs text-slate-400 space-y-1 font-mono">
                  <div className="text-white font-semibold">How it works without internet:</div>
                  <p>1. Coordinates, trauma category, bed reservation token, and condition are condensed into a 130-char GSM string.</p>
                  <p>2. Tapping below opens Android's native Messages app addressed to 108 with 1-click dispatch.</p>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="space-y-2 pt-2">
                <a
                  href={SmsEmergencyService.buildSmsLaunchUrl(SmsEmergencyService.DEFAULT_EMERGENCY_SMS_NUMBER, generatedSms)}
                  onClick={() => VibrationService.triggerDispatchSuccess()}
                  className="w-full py-3.5 px-4 rounded-xl bg-white text-black hover:bg-slate-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg active:scale-98"
                >
                  <Send className="w-4 h-4 text-red-600" />
                  <span>Launch Native SMS to 108</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                </a>

                <div className="flex space-x-2">
                  <button
                    onClick={() => copyToClipboard(generatedSms)}
                    className="flex-1 py-2 px-3 rounded-lg bg-[#181b22] hover:bg-[#20242e] text-slate-300 font-mono text-xs flex items-center justify-center space-x-1 border border-white/10 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied Payload' : 'Copy SMS Payload'}</span>
                  </button>

                  <button
                    onClick={handleSimulateHospitalReceive}
                    className="flex-1 py-2 px-3 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-mono text-xs flex items-center justify-center space-x-1 border border-red-500/30 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSimulatingReceiver ? 'animate-spin' : ''}`} />
                    <span>Decode in Terminal</span>
                  </button>
                </div>
              </div>
            </div>

            {/* TERMINAL B: INBOUND HOSPITAL RECEPTION DISPATCH TERMINAL */}
            <div className="bg-[#111317] border border-white/10 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-mono font-bold text-white uppercase">
                      Hospital ER Receiving Terminal
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>AUTOMATIC PARSER ACTIVE</span>
                  </span>
                </div>

                {decodedSms ? (
                  <div className="space-y-2.5 font-mono text-xs">
                    <div className="p-3 bg-[#181b22] rounded-xl border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Bed Reservation Token</span>
                        <span className="text-sm font-bold text-amber-400">{decodedSms.bedToken}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold uppercase text-[10px]">
                        ER BED LOCKED
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-[#14161a] rounded-lg border border-white/5">
                        <span className="text-[10px] text-slate-500 block uppercase">Patient Demographics</span>
                        <span className="text-slate-200 font-semibold">{decodedSms.patientAge} Years • {decodedSms.patientGender}</span>
                      </div>
                      <div className="p-2.5 bg-[#14161a] rounded-lg border border-white/5">
                        <span className="text-[10px] text-slate-500 block uppercase">Triage Priority</span>
                        <span className="text-red-400 font-bold uppercase">{decodedSms.triageTag} RED-ALERT</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-[#14161a] rounded-lg border border-white/5">
                      <span className="text-[10px] text-slate-500 block uppercase">Extracted Condition</span>
                      <span className="text-white font-medium">{decodedSms.condition}</span>
                    </div>

                    <div className="p-2.5 bg-[#14161a] rounded-lg border border-white/5">
                      <span className="text-[10px] text-slate-500 block uppercase">GPS Fix Coordinates</span>
                      <span className="text-slate-300">{decodedSms.lat.toFixed(4)}° N, {decodedSms.long.toFixed(4)}° E (Auto-mapped)</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-500 text-xs font-mono">
                    Waiting for incoming SMS payload...
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={onOpenFastAdmit}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#181b22] hover:bg-[#20242e] border border-white/10 text-white font-mono text-xs flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-red-500" />
                  <span>Go to Fast Admit Voice Hotline</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ANDROID APK INSTALLATION */}
      {activeTab === 'apk_guide' && (
        <div className="space-y-6">
          <div className="bg-[#111317] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-400">Android Packaging</span>
                <h3 className="text-xl font-bold text-white mt-0.5">Two Ways to Install the APK for SIH</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Your app includes a fully compliant Service Worker, Web App Manifest, and high-res maskable Android icons.
                </p>
              </div>

              <PWAInstallButton variant="full" className="sm:max-w-xs" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Method 1: WebAPK (Instant on Android) */}
              <div className="p-5 bg-[#14161a] rounded-xl border border-white/5 space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Instant WebAPK on Phone (Recommended)</h4>
                    <span className="text-[10px] font-mono text-emerald-400">NO DEV TOOLS NEEDED</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Open this link on any Android smartphone in Chrome, Edge, or Samsung Internet:
                </p>

                <ol className="list-decimal pl-4 text-xs text-slate-400 space-y-1.5 font-mono">
                  <li>Tap the <strong>"INSTALL APK"</strong> button on top right of the navbar.</li>
                  <li>Or tap Chrome's <strong>⋮ menu</strong> &gt; <strong>"Install app"</strong>.</li>
                  <li>Android automatically creates a native <strong>WebAPK</strong> registered in Android Settings with its own app launcher icon, standalone window, and offline caching.</li>
                </ol>

                <div className="p-2.5 bg-[#0a0b0e] rounded-lg border border-white/5 text-[11px] font-mono text-slate-400">
                  Runs with zero internet latency in offline disaster zones.
                </div>
              </div>

              {/* Method 2: Standalone .APK via PWABuilder / Bubblewrap */}
              <div className="p-5 bg-[#14161a] rounded-xl border border-white/5 space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Build Signed .APK (Bubblewrap CLI)</h4>
                    <span className="text-[10px] font-mono text-amber-400">STANDALONE .APK FILE</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  To generate an independent <code>app-release-signed.apk</code> to upload or share via pendrive:
                </p>

                <div className="p-3 bg-[#0a0b0e] rounded-lg border border-white/10 font-mono text-xs text-slate-300 space-y-1.5">
                  <div className="text-slate-500 text-[10px]">Run in terminal:</div>
                  <div className="text-red-400 select-all">npx @bubblewrap/cli init --manifest=manifest.webmanifest</div>
                  <div className="text-emerald-400 select-all">npx @bubblewrap/cli build</div>
                </div>

                <button
                  onClick={downloadAndroidManifest}
                  className="w-full py-2.5 px-3 rounded-lg bg-[#181b22] hover:bg-[#20242e] border border-white/10 text-white font-mono text-xs flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download TWA Android Config JSON</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SIH WINNING ARCHITECTURE HIGHLIGHTS */}
      {activeTab === 'architecture' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 bg-[#111317] border border-white/10 rounded-2xl space-y-2">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
              1
            </div>
            <h3 className="font-bold text-white text-sm">Paperless Fast Admit</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cuts 20–40 minute emergency room intake queues down to 0 seconds by pre-allocating an ER trauma bed and dispatching the nearest ambulance via hands-free voice or single-tap SOS.
            </p>
          </div>

          <div className="p-5 bg-[#111317] border border-white/10 rounded-2xl space-y-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              2
            </div>
            <h3 className="font-bold text-white text-sm">GSM 7-bit SMS Fallback</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              When 4G/5G towers collapse during floods or cyclones, Arambh compresses GPS, age, condition, and reservation token into an ultra-dense 130-character SMS directly to 108.
            </p>
          </div>

          <div className="p-5 bg-[#111317] border border-white/10 rounded-2xl space-y-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              3
            </div>
            <h3 className="font-bold text-white text-sm">Offline AI Triage & Mesh</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Works completely off-grid with cached clinical decision models, physical vibration CPR pacing, autonomous accelerometer fall detection, and zero external dependencies.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
