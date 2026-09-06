import React, { useState, useEffect } from 'react';
import { 
  Hospital, MapPin, PhoneCall, Zap, Clock, ShieldCheck, 
  Activity, Star, RefreshCw, ArrowRight, Bed, Navigation, HeartHandshake,
  AlertCircle
} from 'lucide-react';
import { HospitalEvaluation, EmergencyCase } from '../types';
import { rankAllHospitals, HOSPITALS_DATABASE } from '../services/geo';
import { VibrationService } from '../services/vibrationService';

interface NearestHospitalsViewProps {
  onSelectHospitalForAdmit: (hospital: HospitalEvaluation) => void;
  onOpenReceptionist: (hospitalName: string) => void;
}

export const NearestHospitalsView: React.FC<NearestHospitalsViewProps> = ({
  onSelectHospitalForAdmit,
  onOpenReceptionist,
}) => {
  const [lat, setLat] = useState<number>(28.6139);
  const [long, setLong] = useState<number>(77.2090);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [locationStatus, setLocationStatus] = useState<string>('Central Delhi Emergency Corridor (28.6139° N, 77.2090° E)');
  const [evaluations, setEvaluations] = useState<HospitalEvaluation[]>([]);

  useEffect(() => {
    updateRankings(lat, long);
    detectLocation();
  }, []);

  const updateRankings = (userLat: number, userLong: number) => {
    const results = rankAllHospitals(userLat, userLong);
    setEvaluations(results);
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation not supported. Showing standard central hospital registry.');
      return;
    }

    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = Math.round(pos.coords.latitude * 10000) / 10000;
        const uLng = Math.round(pos.coords.longitude * 10000) / 10000;
        setLat(uLat);
        setLong(uLng);
        setLocationStatus(`GPS: ${uLat.toFixed(4)}° N, ${uLng.toFixed(4)}° E`);
        setIsDetecting(false);
        updateRankings(uLat, uLng);
      },
      (err) => {
        setLocationStatus('GPS signal weak. Defaulting to New Delhi central cluster (28.6139, 77.2090)');
        setIsDetecting(false);
        updateRankings(28.6139, 77.2090);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const bestChoice = evaluations.find(e => e.isBestChoice) || evaluations[0];

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-6 text-slate-100" id="nearest-hospitals-view">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              Real-Time Vacancy & ETA Routing
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Nearest Emergency Facilities
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Ranked by instantaneous ambulance arrival time and live ER trauma bed vacancies.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-[#14161a] px-3 py-1.5 rounded-xl border border-white/5 text-xs font-mono">
          <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-slate-300 truncate max-w-[200px]">{locationStatus}</span>
          <button
            onClick={() => {
              detectLocation();
              VibrationService.triggerQuickTap();
            }}
            disabled={isDetecting}
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh GPS"
          >
            <RefreshCw className={`w-3 h-3 ${isDetecting ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* BEST HOSPITAL FOR YOU */}
      {bestChoice && (
        <div className="bg-[#111317] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-amber-400 text-black uppercase flex items-center space-x-1">
                <Star className="w-3 h-3 fill-black" />
                <span>RECOMMENDED BEST CHOICE</span>
              </span>
              <span className="text-xs font-mono text-slate-400">
                Score: {bestChoice.score}/100
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Ambulance ETA</span>
              <div className="text-lg font-mono font-bold text-red-400">
                ~{bestChoice.etaMinutes} MINS
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <h2 className="text-lg font-bold text-white tracking-tight">
                {bestChoice.hospital.name}
              </h2>
              <p className="text-xs text-slate-400 flex items-center space-x-1">
                <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                <span>{bestChoice.hospital.address}</span>
              </p>
              <div className="p-3 bg-[#181b22] rounded-xl border border-white/5 mt-2">
                <span className="text-[10px] font-mono text-amber-400 font-semibold block">
                  WHY THIS IS YOUR SAFEST OPTION:
                </span>
                <p className="text-xs text-slate-300 mt-0.5">
                  {bestChoice.recommendationReason}
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <div className="p-3 bg-[#181b22] rounded-xl border border-white/5">
                <span className="text-[10px] text-slate-400 uppercase block">ER Trauma Beds</span>
                <span className="text-lg font-bold text-emerald-400 block mt-1">
                  {bestChoice.availableBeds} VACANT
                </span>
                <span className="text-[10px] text-slate-500">Zero wait</span>
              </div>

              <div className="p-3 bg-[#181b22] rounded-xl border border-white/5">
                <span className="text-[10px] text-slate-400 uppercase block">Distance</span>
                <span className="text-lg font-bold text-white block mt-1">
                  {bestChoice.distanceKm} KM
                </span>
                <span className="text-[10px] text-slate-500">{bestChoice.hospital.trauma_level}</span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              onClick={() => {
                VibrationService.triggerQuickTap();
                onSelectHospitalForAdmit(bestChoice);
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-white text-black hover:bg-slate-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 text-red-600 fill-red-600" />
              <span>Fast Admit to This Hospital</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </button>

            <button
              onClick={() => {
                VibrationService.triggerQuickTap();
                onOpenReceptionist(bestChoice.hospital.name);
              }}
              className="py-3 px-4 rounded-xl bg-[#181b22] hover:bg-[#20242e] text-white font-mono text-xs uppercase flex items-center justify-center space-x-1.5 border border-white/10 cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5 text-red-400" />
              <span>Connect Receptionist</span>
            </button>

            <a
              href={`tel:${bestChoice.hospital.ambulance_hotline}`}
              className="py-3 px-4 rounded-xl bg-[#181b22] hover:bg-[#20242e] text-slate-300 font-mono text-xs uppercase flex items-center justify-center space-x-1.5 border border-white/10 cursor-pointer"
            >
              <span>Hotline ({bestChoice.hospital.phone})</span>
            </a>
          </div>
        </div>
      )}

      {/* ALL NEARBY HOSPITALS LIST */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono text-slate-400 uppercase tracking-wider">
          Nearby Emergency Centers ({evaluations.length})
        </h2>

        <div className="space-y-2.5">
          {evaluations.map((item) => (
            <div
              key={item.hospital.id}
              className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                item.isBestChoice 
                  ? 'bg-[#111317] border-red-500/30' 
                  : 'bg-[#111317] border-white/5 hover:border-white/15'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-sm text-white">{item.hospital.name}</h3>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#181b22] text-slate-400">
                    {item.hospital.trauma_level}
                  </span>
                  {item.isBestChoice && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-400 text-black font-bold">
                      TOP MATCH
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{item.hospital.address}</p>
                <p className="text-[11px] text-slate-500 font-mono">{item.recommendationReason}</p>
              </div>

              <div className="flex items-center space-x-4 shrink-0 font-mono text-xs">
                <div className="text-right">
                  <div className="text-white font-bold">~{item.etaMinutes} mins</div>
                  <div className="text-[10px] text-slate-400">{item.distanceKm} km</div>
                </div>

                <div className="text-right">
                  <div className="text-emerald-400 font-bold">{item.availableBeds} beds</div>
                  <div className="text-[10px] text-slate-500">Vacant</div>
                </div>

                <div className="flex space-x-1.5">
                  <button
                    onClick={() => {
                      VibrationService.triggerQuickTap();
                      onSelectHospitalForAdmit(item);
                    }}
                    className="p-2 rounded-lg bg-white text-black hover:bg-slate-200 transition-colors cursor-pointer"
                    title="Fast Admit to this hospital"
                  >
                    <Zap className="w-3.5 h-3.5 fill-black" />
                  </button>
                  <button
                    onClick={() => {
                      VibrationService.triggerQuickTap();
                      onOpenReceptionist(item.hospital.name);
                    }}
                    className="p-2 rounded-lg bg-[#181b22] text-slate-300 hover:text-white border border-white/5 cursor-pointer"
                    title="Call Receptionist"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
