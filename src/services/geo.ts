import { Hospital } from '../types';

export const HOSPITALS_DATABASE: Hospital[] = [
  {
    id: 'hosp-1',
    name: 'Arambh Metro Trauma Center & Super Specialty Hospital',
    address: '104 Emergency Ring Road, Central Health District',
    lat: 28.6139,
    lng: 77.2090,
    phone: '+1 (800) 555-0199',
    ambulance_hotline: '108 / 911 / +1 (800) 555-AMBU',
    trauma_level: 'Level 1',
    available_er_beds: 14,
  },
  {
    id: 'hosp-2',
    name: 'St. Jude Memorial Critical Care Hospital',
    address: '42 Medical Boulevard, Westside Healthcare Zone',
    lat: 28.6304,
    lng: 77.2177,
    phone: '+1 (800) 555-0244',
    ambulance_hotline: '+1 (800) 555-9911',
    trauma_level: 'Level 1',
    available_er_beds: 8,
  },
  {
    id: 'hosp-3',
    name: 'City Apex Emergency & Cardiac Institute',
    address: '88 Express Highway Interchange, South Corridor',
    lat: 28.5355,
    lng: 77.3910,
    phone: '+1 (800) 555-0377',
    ambulance_hotline: '+1 (800) 555-7722',
    trauma_level: 'Level 2',
    available_er_beds: 19,
  },
  {
    id: 'hosp-4',
    name: 'North Hills Community General & Pediatric ER',
    address: '15 Foothills Way, North Sector',
    lat: 28.7041,
    lng: 77.1025,
    phone: '+1 (800) 555-0811',
    ambulance_hotline: '+1 (800) 555-8833',
    trauma_level: 'Community Emergency',
    available_er_beds: 5,
  },
  {
    id: 'hosp-5',
    name: 'Grace Valley Emergency Medical Station',
    address: '320 Riverside Park Avenue, East Riverside',
    lat: 28.5921,
    lng: 77.3005,
    phone: '+1 (800) 555-0955',
    ambulance_hotline: '+1 (800) 555-1122',
    trauma_level: 'Level 2',
    available_er_beds: 11,
  },
];

// Haversine formula to compute great-circle distance between two points in km
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export interface NearestHospitalResult {
  hospital: Hospital;
  distanceKm: number;
  etaMinutes: number;
  evaluation?: import('../types').HospitalEvaluation;
}

/**
 * Calculates rankings and recommendation for all nearby hospitals
 * considering distance, ambulance ETA, bed vacancy, and emergency trauma level
 */
export function rankAllHospitals(lat?: number, long?: number, conditionText?: string): import('../types').HospitalEvaluation[] {
  const userLat = (lat !== undefined && !isNaN(lat)) ? lat : 28.6139;
  const userLong = (long !== undefined && !isNaN(long)) ? long : 77.2090;

  const evals: import('../types').HospitalEvaluation[] = HOSPITALS_DATABASE.map(hospital => {
    const dist = calculateDistanceKm(userLat, userLong, hospital.lat, hospital.lng);
    const etaMinutes = Math.max(3, Math.round((dist / 35) * 60) + 3);
    const availableBeds = hospital.available_er_beds;
    
    // Scoring formula: lower ETA is better, higher beds is better, Level 1 trauma has advantage
    // Bed availability factor
    const bedWeight = availableBeds >= 10 ? 30 : availableBeds >= 5 ? 20 : availableBeds > 0 ? 10 : 0;
    // ETA factor (under 6 mins = 50 pts, under 10 mins = 35 pts, under 15 mins = 20 pts)
    const etaWeight = Math.max(0, 50 - etaMinutes * 2.5);
    // Trauma factor
    const traumaWeight = hospital.trauma_level === 'Level 1' ? 20 : hospital.trauma_level === 'Level 2' ? 12 : 5;

    const totalScore = Math.round(bedWeight + etaWeight + traumaWeight);

    let reason = `${etaMinutes}m Ambulance ETA • ${availableBeds} ER Beds Available`;
    if (availableBeds >= 10 && etaMinutes <= 7) {
      reason = `BEST SPEED & CAPACITY: ~${etaMinutes}m ambulance dispatch with ${availableBeds} trauma beds vacant!`;
    } else if (hospital.trauma_level === 'Level 1') {
      reason = `LEVEL 1 ADVANCED TRAUMA: Immediate resuscitation team & ${availableBeds} ICU beds vacant.`;
    } else if (etaMinutes <= 5) {
      reason = `FASTEST PROXIMITY: Closest ambulance station (${dist} km, ~${etaMinutes} min arrival).`;
    }

    return {
      hospital,
      distanceKm: dist,
      etaMinutes,
      availableBeds,
      score: totalScore,
      isBestChoice: false,
      recommendationReason: reason,
    };
  });

  // Sort descending by score
  evals.sort((a, b) => b.score - a.score);

  if (evals.length > 0) {
    evals[0].isBestChoice = true;
  }

  return evals;
}

/**
 * Picks the closest / best hospital from given coordinates
 * Defaults to reference hospital if coordinates are invalid
 */
export function nearestHospital(lat?: number, long?: number): NearestHospitalResult {
  const rankings = rankAllHospitals(lat, long);
  const best = rankings[0];

  return {
    hospital: best.hospital,
    distanceKm: best.distanceKm,
    etaMinutes: best.etaMinutes,
    evaluation: best,
  };
}
