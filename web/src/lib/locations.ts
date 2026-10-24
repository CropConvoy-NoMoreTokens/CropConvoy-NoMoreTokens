import type { Point } from '../api/types';

export type LocationCategory = 'economic_centre' | 'major_city' | 'agricultural_hub';

export interface LocationItem {
  id: string;
  name: string;
  secondary?: string;
  category: LocationCategory;
  categoryLabel: string;
  lat: number;
  lng: number;
  source: 'preset';
}

export const SRI_LANKA_PRESET_LOCATIONS: LocationItem[] = [
  // Dedicated Economic Centres & Primary Wholesale Hubs
  {
    id: 'dec-dambulla',
    name: 'Dambulla Dedicated Economic Centre',
    secondary: 'Central Province · National Wholesale Hub',
    category: 'economic_centre',
    categoryLabel: 'Economic Centre',
    lat: 7.8742,
    lng: 80.6511,
    source: 'preset',
  },
  {
    id: 'dec-peliyagoda',
    name: 'Peliyagoda Manning Market',
    secondary: 'Western Province · Colombo Wholesale Terminal',
    category: 'economic_centre',
    categoryLabel: 'Wholesale Market',
    lat: 6.9632,
    lng: 79.8918,
    source: 'preset',
  },
  {
    id: 'dec-meegoda',
    name: 'Meegoda Dedicated Economic Centre',
    secondary: 'Western Province · Homagama District',
    category: 'economic_centre',
    categoryLabel: 'Economic Centre',
    lat: 6.8488,
    lng: 80.0577,
    source: 'preset',
  },
  {
    id: 'dec-narahenpita',
    name: 'Narahenpita Dedicated Economic Centre',
    secondary: 'Western Province · Colombo Central',
    category: 'economic_centre',
    categoryLabel: 'Economic Centre',
    lat: 6.8929,
    lng: 79.8828,
    source: 'preset',
  },
  {
    id: 'dec-welisara',
    name: 'Welisara Dedicated Economic Centre',
    secondary: 'Western Province · Gampaha District',
    category: 'economic_centre',
    categoryLabel: 'Economic Centre',
    lat: 7.0134,
    lng: 79.9142,
    source: 'preset',
  },
  {
    id: 'dec-keppetipola',
    name: 'Keppetipola Dedicated Economic Centre',
    secondary: 'Uva Province · Upcountry Produce Hub',
    category: 'economic_centre',
    categoryLabel: 'Economic Centre',
    lat: 6.9145,
    lng: 80.8841,
    source: 'preset',
  },
  {
    id: 'dec-nuwara-eliya',
    name: 'Nuwara Eliya Dedicated Economic Centre',
    secondary: 'Central Province · Upcountry Vegetable Hub',
    category: 'economic_centre',
    categoryLabel: 'Economic Centre',
    lat: 6.9685,
    lng: 80.7718,
    source: 'preset',
  },
  {
    id: 'dec-embilipitiya',
    name: 'Embilipitiya Dedicated Economic Centre',
    secondary: 'Sabaragamuwa Province · Southern Produce Hub',
    category: 'economic_centre',
    categoryLabel: 'Economic Centre',
    lat: 6.3072,
    lng: 80.8524,
    source: 'preset',
  },
  {
    id: 'dec-veyangoda',
    name: 'Veyangoda Dedicated Economic Centre',
    secondary: 'Western Province · Transport Node',
    category: 'economic_centre',
    categoryLabel: 'Economic Centre',
    lat: 7.1554,
    lng: 80.0583,
    source: 'preset',
  },
  {
    id: 'dec-thambuththegama',
    name: 'Thambuththegama Dedicated Economic Centre',
    secondary: 'North Central Province · Rajarata Agriculture',
    category: 'economic_centre',
    categoryLabel: 'Economic Centre',
    lat: 8.1469,
    lng: 80.3014,
    source: 'preset',
  },

  // Major Cities and District Capitals
  {
    id: 'city-kandy',
    name: 'Kandy',
    secondary: 'Central Province · Hill Capital',
    category: 'major_city',
    categoryLabel: 'City',
    lat: 7.2906,
    lng: 80.6337,
    source: 'preset',
  },
  {
    id: 'city-colombo',
    name: 'Colombo',
    secondary: 'Western Province · Commercial Capital',
    category: 'major_city',
    categoryLabel: 'Capital',
    lat: 6.9271,
    lng: 79.8612,
    source: 'preset',
  },
  {
    id: 'city-kurunegala',
    name: 'Kurunegala',
    secondary: 'North Western Province · Central Transport Junction',
    category: 'major_city',
    categoryLabel: 'City',
    lat: 7.4863,
    lng: 80.3623,
    source: 'preset',
  },
  {
    id: 'city-anuradhapura',
    name: 'Anuradhapura',
    secondary: 'North Central Province · Agricultural Hub',
    category: 'major_city',
    categoryLabel: 'City',
    lat: 8.3114,
    lng: 80.4037,
    source: 'preset',
  },
  {
    id: 'city-polonnaruwa',
    name: 'Polonnaruwa',
    secondary: 'North Central Province · Ancient Capital & Paddy Hub',
    category: 'major_city',
    categoryLabel: 'Town',
    lat: 7.9403,
    lng: 81.0188,
    source: 'preset',
  },
  {
    id: 'city-galle',
    name: 'Galle',
    secondary: 'Southern Province · Provincial Capital',
    category: 'major_city',
    categoryLabel: 'City',
    lat: 6.0535,
    lng: 80.221,
    source: 'preset',
  },
  {
    id: 'city-matara',
    name: 'Matara',
    secondary: 'Southern Province · Commercial Centre',
    category: 'major_city',
    categoryLabel: 'City',
    lat: 5.9549,
    lng: 80.555,
    source: 'preset',
  },
  {
    id: 'city-jaffna',
    name: 'Jaffna',
    secondary: 'Northern Province · Provincial Capital',
    category: 'major_city',
    categoryLabel: 'City',
    lat: 9.6615,
    lng: 80.0255,
    source: 'preset',
  },
  {
    id: 'city-badulla',
    name: 'Badulla',
    secondary: 'Uva Province · Provincial Capital',
    category: 'major_city',
    categoryLabel: 'City',
    lat: 6.9895,
    lng: 81.0557,
    source: 'preset',
  },
  {
    id: 'city-ratnapura',
    name: 'Ratnapura',
    secondary: 'Sabaragamuwa Province · Provincial Capital',
    category: 'major_city',
    categoryLabel: 'City',
    lat: 6.6828,
    lng: 80.4034,
    source: 'preset',
  },
  {
    id: 'city-matale',
    name: 'Matale',
    secondary: 'Central Province · Spice & Vegetable District',
    category: 'major_city',
    categoryLabel: 'Town',
    lat: 7.4675,
    lng: 80.6234,
    source: 'preset',
  },
  {
    id: 'city-gampaha',
    name: 'Gampaha',
    secondary: 'Western Province · District Capital',
    category: 'major_city',
    categoryLabel: 'City',
    lat: 7.084,
    lng: 79.9939,
    source: 'preset',
  },
  {
    id: 'city-negombo',
    name: 'Negombo',
    secondary: 'Western Province · Coastal & Airport Hub',
    category: 'major_city',
    categoryLabel: 'City',
    lat: 7.2008,
    lng: 79.8737,
    source: 'preset',
  },
  {
    id: 'city-kegalle',
    name: 'Kegalle',
    secondary: 'Sabaragamuwa Province · District Town',
    category: 'major_city',
    categoryLabel: 'Town',
    lat: 7.2513,
    lng: 80.3464,
    source: 'preset',
  },
  {
    id: 'city-hambantota',
    name: 'Hambantota',
    secondary: 'Southern Province · Port & Highway Hub',
    category: 'major_city',
    categoryLabel: 'Town',
    lat: 6.1246,
    lng: 81.1185,
    source: 'preset',
  },
  {
    id: 'city-trincomalee',
    name: 'Trincomalee',
    secondary: 'Eastern Province · Port City',
    category: 'major_city',
    categoryLabel: 'City',
    lat: 8.5874,
    lng: 81.2152,
    source: 'preset',
  },
  {
    id: 'city-batticaloa',
    name: 'Batticaloa',
    secondary: 'Eastern Province · Coastal City',
    category: 'major_city',
    categoryLabel: 'City',
    lat: 7.731,
    lng: 81.6747,
    source: 'preset',
  },
  {
    id: 'city-vavuniya',
    name: 'Vavuniya',
    secondary: 'Northern Province · Transport Gateway',
    category: 'major_city',
    categoryLabel: 'Town',
    lat: 8.7542,
    lng: 80.4982,
    source: 'preset',
  },
  {
    id: 'city-puttalam',
    name: 'Puttalam',
    secondary: 'North Western Province · Agricultural Town',
    category: 'major_city',
    categoryLabel: 'Town',
    lat: 8.0408,
    lng: 79.8394,
    source: 'preset',
  },

  // Agricultural Nodes & Key Corridors
  {
    id: 'hub-galewela',
    name: 'Galewela',
    secondary: 'Central Province · North Dambulla Corridor',
    category: 'agricultural_hub',
    categoryLabel: 'Agricultural Hub',
    lat: 7.95,
    lng: 80.65,
    source: 'preset',
  },
  {
    id: 'hub-peradeniya',
    name: 'Peradeniya',
    secondary: 'Central Province · South Kandy Junction',
    category: 'agricultural_hub',
    categoryLabel: 'Town',
    lat: 7.25,
    lng: 80.63,
    source: 'preset',
  },
  {
    id: 'hub-gampola',
    name: 'Gampola',
    secondary: 'Central Province · Mahaweli Valley',
    category: 'agricultural_hub',
    categoryLabel: 'Town',
    lat: 7.1643,
    lng: 80.5694,
    source: 'preset',
  },
  {
    id: 'hub-bandarawela',
    name: 'Bandarawela',
    secondary: 'Uva Province · Vegetable Production Hub',
    category: 'agricultural_hub',
    categoryLabel: 'Agricultural Hub',
    lat: 6.8259,
    lng: 80.9982,
    source: 'preset',
  },
  {
    id: 'hub-hatton',
    name: 'Hatton',
    secondary: 'Central Province · Upcountry Corridor',
    category: 'agricultural_hub',
    categoryLabel: 'Town',
    lat: 6.8916,
    lng: 80.5966,
    source: 'preset',
  },
  {
    id: 'hub-monaragala',
    name: 'Monaragala',
    secondary: 'Uva Province · Agricultural District',
    category: 'agricultural_hub',
    categoryLabel: 'Town',
    lat: 6.8714,
    lng: 81.3487,
    source: 'preset',
  },
  {
    id: 'hub-chilaw',
    name: 'Chilaw',
    secondary: 'North Western Province · Coastal Transport Hub',
    category: 'agricultural_hub',
    categoryLabel: 'Town',
    lat: 7.5758,
    lng: 79.7953,
    source: 'preset',
  },
  {
    id: 'hub-kilinochchi',
    name: 'Kilinochchi',
    secondary: 'Northern Province · Agricultural Centre',
    category: 'agricultural_hub',
    categoryLabel: 'Town',
    lat: 9.3803,
    lng: 80.377,
    source: 'preset',
  },
  {
    id: 'hub-mannar',
    name: 'Mannar',
    secondary: 'Northern Province · Coastal Town',
    category: 'agricultural_hub',
    categoryLabel: 'Town',
    lat: 8.981,
    lng: 79.9044,
    source: 'preset',
  },
  {
    id: 'hub-ampara',
    name: 'Ampara',
    secondary: 'Eastern Province · Digamadulla Agriculture',
    category: 'agricultural_hub',
    categoryLabel: 'Town',
    lat: 7.2912,
    lng: 81.6724,
    source: 'preset',
  },
];

export function findMatchingPresets(query: string, limit = 6): LocationItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return SRI_LANKA_PRESET_LOCATIONS.slice(0, limit);
  }
  const scored = SRI_LANKA_PRESET_LOCATIONS.map((loc) => {
    const nameLower = loc.name.toLowerCase();
    const secLower = (loc.secondary || '').toLowerCase();
    let score = -1;
    if (nameLower.startsWith(q)) {
      score = 100 - nameLower.length;
    } else if (nameLower.includes(q)) {
      score = 50;
    } else if (secLower.includes(q)) {
      score = 25;
    }
    if (score >= 0 && loc.category === 'economic_centre') {
      score += 15;
    }
    return { loc, score };
  })
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.loc);

  return scored.slice(0, limit);
}

export function findNearestPreset(point: Point, thresholdKm = 1.0): LocationItem | null {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
  let best: LocationItem | null = null;
  let minDistance = Infinity;

  for (const loc of SRI_LANKA_PRESET_LOCATIONS) {
    const latDiff = (loc.lat - point.lat) * 111.139;
    const lngDiff = (loc.lng - point.lng) * 111.139 * Math.cos((point.lat * Math.PI) / 180);
    const d = Math.hypot(latDiff, lngDiff);
    if (d < minDistance) {
      minDistance = d;
      best = loc;
    }
  }

  return minDistance <= thresholdKm ? best : null;
}
