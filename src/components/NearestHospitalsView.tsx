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
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-6 text-slate-800" id="nearest-hospitals-view">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-semibold text-sky-700 uppercase tracking-wide">
              Live Facility Vacancy & ETA
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Nearest Emergency Facilities
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Ranked by instantaneous ambulance arrival time and live emergency room trauma bed vacancies.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700">
          <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span className="text-slate-600 truncate max-w-[200px] font-medium">{locationStatus}</span>
          <button
            onClick={() => {
              detectLocation();
              VibrationService.triggerQuickTap();
            }}
            disabled={isDetecting}
            className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            title="Refresh GPS"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* BEST HOSPITAL FOR YOU */}
      {bestChoice && (
        <div className="bg-white border border-sky-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 flex items-center space-x-1.5">
                <Star className="w-3.5 h-3.5 fill-sky-700 text-sky-700" />
                <span>Optimal Emergency Match</span>
              </span>
              <span className="text-xs font-medium text-slate-500">
                Match Score: {bestChoice.score}/100
              </span>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-500">Ambulance ETA</span>
              <div className="text-lg font-bold text-sky-800">
                ~{bestChoice.etaMinutes} mins
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {bestChoice.hospital.name}
              </h2>
              <p className="text-xs text-slate-500 flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{bestChoice.hospital.address}</span>
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 mt-2">
                <span className="text-xs font-semibold text-slate-700 block">
                  Why this facility is recommended:
                </span>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  {bestChoice.recommendationReason}
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-500 block text-[11px]">ER Trauma Beds</span>
                <span className="text-lg font-bold text-emerald-700 block mt-0.5">
                  {bestChoice.availableBeds} Vacant
                </span>
                <span className="text-[11px] text-slate-400">Zero wait-time</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-500 block text-[11px]">Distance</span>
                <span className="text-lg font-bold text-slate-800 block mt-0.5">
                  {bestChoice.distanceKm} km
                </span>
                <span className="text-[11px] text-slate-400">{bestChoice.hospital.trauma_level}</span>
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
              className="flex-1 py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Fast Admit to This Hospital</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </button>

            <button
              onClick={() => {
                VibrationService.triggerQuickTap();
                onOpenReceptionist(bestChoice.hospital.name);
              }}
              className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs flex items-center justify-center space-x-1.5 border border-slate-200 cursor-pointer transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5 text-sky-600" />
              <span>Connect Receptionist</span>
            </button>

            <a
              href={`tel:${bestChoice.hospital.ambulance_hotline}`}
              className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs flex items-center justify-center space-x-1.5 border border-slate-200 cursor-pointer transition-colors"
            >
              <span>Hotline ({bestChoice.hospital.phone})</span>
            </a>
          </div>
        </div>
      )}

      {/* ALL NEARBY HOSPITALS LIST */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
          Nearby Emergency Centers ({evaluations.length})
        </h2>

        <div className="space-y-2.5">
          {evaluations.map((item) => (
            <div
              key={item.hospital.id}
              className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-white ${
                item.isBestChoice 
                  ? 'border-sky-300 ring-1 ring-sky-200 shadow-xs' 
                  : 'border-slate-200/90 hover:border-slate-300'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-sm text-slate-900">{item.hospital.name}</h3>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {item.hospital.trauma_level}
                  </span>
                  {item.isBestChoice && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                      Optimal Match
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{item.hospital.address}</p>
                <p className="text-xs text-slate-600">{item.recommendationReason}</p>
              </div>

              <div className="flex items-center space-x-4 shrink-0 text-xs">
                <div className="text-right">
                  <div className="text-slate-900 font-bold">~{item.etaMinutes} mins</div>
                  <div className="text-xs text-slate-400">{item.distanceKm} km</div>
                </div>

                <div className="text-right">
                  <div className="text-emerald-700 font-bold">{item.availableBeds} beds</div>
                  <div className="text-xs text-slate-400">Vacant</div>
                </div>

                <div className="flex space-x-1.5">
                  <button
                    onClick={() => {
                      VibrationService.triggerQuickTap();
                      onSelectHospitalForAdmit(item);
                    }}
                    className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white transition-colors cursor-pointer shadow-xs"
                    title="Fast Admit to this hospital"
                  >
                    <Zap className="w-3.5 h-3.5 fill-white" />
                  </button>
                  <button
                    onClick={() => {
                      VibrationService.triggerQuickTap();
                      onOpenReceptionist(item.hospital.name);
                    }}
                    className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 cursor-pointer transition-colors"
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
