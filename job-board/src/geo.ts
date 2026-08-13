import { Company } from './types';

/**
 * Approximate centres for the Melbourne postcodes that appear in the company
 * list. The source CSV has street addresses but no coordinates, and geocoding
 * 400 addresses in the browser isn't on — so the postcode, the one reliably
 * machine-readable part of those addresses, places a company in its suburb.
 *
 * That means the map is honest to about a suburb, not to a street. Companies
 * are grouped by postcode rather than scattered around it, because nudging
 * markers apart would invent a precision this data doesn't have.
 *
 * To improve a pin, correct its entry here — or add one for a postcode that is
 * currently unmapped.
 */
export interface Place {
  suburb: string;
  lat: number;
  lng: number;
}

export const POSTCODE_PLACES: Record<string, Place> = {
  '3000': { suburb: 'Melbourne CBD', lat: -37.8136, lng: 144.9631 },
  '3002': { suburb: 'East Melbourne', lat: -37.8151, lng: 144.9871 },
  '3003': { suburb: 'West Melbourne', lat: -37.8064, lng: 144.9435 },
  '3004': { suburb: 'Melbourne (St Kilda Rd)', lat: -37.8398, lng: 144.9767 },
  '3006': { suburb: 'Southbank', lat: -37.8226, lng: 144.9648 },
  '3008': { suburb: 'Docklands', lat: -37.8177, lng: 144.9463 },
  '3011': { suburb: 'Footscray', lat: -37.7995, lng: 144.9 },
  '3012': { suburb: 'Maidstone', lat: -37.7833, lng: 144.8667 },
  '3015': { suburb: 'Newport', lat: -37.8437, lng: 144.8829 },
  '3016': { suburb: 'Williamstown', lat: -37.8586, lng: 144.8977 },
  '3018': { suburb: 'Altona', lat: -37.8686, lng: 144.8306 },
  '3021': { suburb: 'St Albans', lat: -37.7452, lng: 144.8009 },
  '3025': { suburb: 'Altona North', lat: -37.8267, lng: 144.8531 },
  '3031': { suburb: 'Kensington', lat: -37.7936, lng: 144.9297 },
  '3032': { suburb: 'Ascot Vale', lat: -37.7761, lng: 144.9169 },
  '3039': { suburb: 'Moonee Ponds', lat: -37.7654, lng: 144.9199 },
  '3040': { suburb: 'Essendon', lat: -37.7524, lng: 144.9067 },
  '3043': { suburb: 'Tullamarine', lat: -37.7003, lng: 144.8836 },
  '3051': { suburb: 'North Melbourne', lat: -37.7981, lng: 144.9497 },
  '3052': { suburb: 'Parkville', lat: -37.7847, lng: 144.9556 },
  '3053': { suburb: 'Carlton', lat: -37.8, lng: 144.9669 },
  '3054': { suburb: 'Carlton North', lat: -37.7847, lng: 144.9714 },
  '3056': { suburb: 'Brunswick', lat: -37.7669, lng: 144.9597 },
  '3057': { suburb: 'Brunswick East', lat: -37.7686, lng: 144.9756 },
  '3058': { suburb: 'Coburg', lat: -37.7434, lng: 144.9642 },
  '3065': { suburb: 'Fitzroy', lat: -37.7981, lng: 144.9789 },
  '3066': { suburb: 'Collingwood', lat: -37.8022, lng: 144.9847 },
  '3067': { suburb: 'Abbotsford', lat: -37.8033, lng: 144.9958 },
  '3068': { suburb: 'Clifton Hill', lat: -37.7886, lng: 144.9953 },
  '3070': { suburb: 'Northcote', lat: -37.7697, lng: 144.9997 },
  '3072': { suburb: 'Preston', lat: -37.7411, lng: 145.0069 },
  '3078': { suburb: 'Fairfield', lat: -37.7772, lng: 145.0175 },
  '3079': { suburb: 'Ivanhoe', lat: -37.7686, lng: 145.0428 },
  '3081': { suburb: 'Heidelberg West', lat: -37.7383, lng: 145.0392 },
  '3084': { suburb: 'Rosanna', lat: -37.7439, lng: 145.0631 },
  '3095': { suburb: 'Eltham', lat: -37.7139, lng: 145.1478 },
  '3101': { suburb: 'Kew', lat: -37.8064, lng: 145.03 },
  '3103': { suburb: 'Balwyn', lat: -37.8092, lng: 145.0797 },
  '3104': { suburb: 'Balwyn North', lat: -37.7911, lng: 145.0847 },
  '3121': { suburb: 'Richmond', lat: -37.8231, lng: 144.9981 },
  '3122': { suburb: 'Hawthorn', lat: -37.8214, lng: 145.0347 },
  '3124': { suburb: 'Camberwell', lat: -37.8397, lng: 145.0686 },
  '3125': { suburb: 'Burwood', lat: -37.8503, lng: 145.1136 },
  '3128': { suburb: 'Box Hill', lat: -37.8194, lng: 145.1219 },
  '3130': { suburb: 'Blackburn', lat: -37.8194, lng: 145.1489 },
  '3141': { suburb: 'South Yarra', lat: -37.8397, lng: 144.9925 },
  '3142': { suburb: 'Toorak', lat: -37.8408, lng: 145.0128 },
  '3143': { suburb: 'Armadale', lat: -37.8556, lng: 145.0206 },
  '3144': { suburb: 'Malvern', lat: -37.8578, lng: 145.0281 },
  '3145': { suburb: 'Malvern East', lat: -37.8756, lng: 145.0419 },
  '3146': { suburb: 'Glen Iris', lat: -37.8608, lng: 145.0603 },
  '3149': { suburb: 'Mount Waverley', lat: -37.8756, lng: 145.1281 },
  '3150': { suburb: 'Glen Waverley', lat: -37.8797, lng: 145.1636 },
  '3166': { suburb: 'Oakleigh', lat: -37.8994, lng: 145.0894 },
  '3168': { suburb: 'Clayton', lat: -37.9247, lng: 145.1211 },
  '3170': { suburb: 'Mulgrave', lat: -37.9231, lng: 145.1697 },
  '3175': { suburb: 'Dandenong', lat: -37.9878, lng: 145.2144 },
  '3181': { suburb: 'Prahran', lat: -37.8517, lng: 144.9931 },
  '3182': { suburb: 'St Kilda', lat: -37.8678, lng: 144.9811 },
  '3183': { suburb: 'Balaclava', lat: -37.8683, lng: 144.9944 },
  '3185': { suburb: 'Elsternwick', lat: -37.8853, lng: 144.9983 },
  '3186': { suburb: 'Brighton', lat: -37.9083, lng: 144.9964 },
  '3189': { suburb: 'Moorabbin', lat: -37.9394, lng: 145.0453 },
  '3190': { suburb: 'Highett', lat: -37.9483, lng: 145.0347 },
  '3192': { suburb: 'Cheltenham', lat: -37.9628, lng: 145.0533 },
  '3195': { suburb: 'Mordialloc', lat: -38.0053, lng: 145.0872 },
  '3199': { suburb: 'Frankston', lat: -38.1436, lng: 145.1225 },
  '3205': { suburb: 'South Melbourne', lat: -37.8328, lng: 144.9564 },
  '3206': { suburb: 'Albert Park', lat: -37.8419, lng: 144.9553 },
  '3207': { suburb: 'Port Melbourne', lat: -37.8397, lng: 144.9375 },
  '3800': { suburb: 'Clayton (Monash)', lat: -37.9105, lng: 145.1362 },
};

/** The Victorian postcode in a free-text address, if there is one. */
export function postcodeOf(address: string): string | undefined {
  return address.match(/\b(3\d{3})\b/)?.[1];
}

export interface MapCluster extends Place {
  postcode: string;
  companies: Company[];
}

/**
 * Companies grouped into the suburb each one's postcode points at, biggest
 * group first so the busiest areas draw on top. Anything we can't place is
 * returned separately rather than dropped — a map that quietly loses a fifth
 * of the list is worse than one that says so.
 */
export function clusterCompanies(companies: Company[]) {
  const byPostcode = new Map<string, MapCluster>();
  const unplaced: Company[] = [];

  for (const company of companies) {
    const postcode = postcodeOf(company.hqAddress);
    const place = postcode ? POSTCODE_PLACES[postcode] : undefined;
    if (!postcode || !place) {
      unplaced.push(company);
      continue;
    }
    const existing = byPostcode.get(postcode);
    if (existing) existing.companies.push(company);
    else byPostcode.set(postcode, { ...place, postcode, companies: [company] });
  }

  const clusters = Array.from(byPostcode.values()).sort(
    (a, b) => b.companies.length - a.companies.length
  );
  return { clusters, unplaced };
}
