/**
 * Enhanced location service for geocoding and search using smarter algorithms
 * Provides more accurate search results for text queries
 */

import { Location } from './firebaseService'; // Assuming this path is correct

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  location: Location;
  distance?: number;
  osm_type?: 'node' | 'way' | 'relation' | string; // string for flexibility if OSM adds new types
  osm_id?: string;
  place_rank?: number;
  importance_score?: number; // Score from local DB or OSM importance
}

// Constants for scoring
const FUZZY_MATCH_THRESHOLD = 0.7; // Minimum similarity score to consider a match for non-Arabic
const ARABIC_FUZZY_MATCH_THRESHOLD = 0.5; // More lenient threshold for Arabic
const BOOST_NAME_MATCH = 1.5; // Multiplier for name match scores
const BOOST_KEYWORD_MATCH = 1.2; // Multiplier for keyword match scores
const BOOST_EXACT_MATCH = 2.0; // Multiplier for exact matches (score = 1.0)
const BOOST_NEARBY = 1.2; // Multiplier for nearby locations
const EARTH_RADIUS_KM = 6371; // Earth radius in kilometers

// Location entry with extended information for better matching
interface LocationEntry {
  id: string;
  name: string;
  fullName: string;
  address: string;
  location: Location;
  keywords: string[];
  category?: string;
  importance?: number; // 0-1, higher means more important/popular location
}

// --- Start of Nominatim API specific types ---
interface NominatimAddress {
  amenity?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  borough?: string; // e.g., New York boroughs
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  building?: string;
  shop?: string;
  office?: string;
  house_number?: string;
  // Add other common fields as needed from Nominatim's addressdetails output
}

interface NominatimResult {
  place_id: string; // Unique ID for the place
  licence: string; // Licence of the data
  osm_type: 'node' | 'way' | 'relation';
  osm_id: string; // OSM ID
  boundingbox: string[]; // Array of 4 strings: "south Latitude", "north Latitude", "west Longitude", "east Longitude"
  lat: string; // Latitude as a string
  lon: string; // Longitude as a string
  display_name: string; // Full address/name string
  name?: string; // The common name (if available, often part of display_name)
  place_rank: number; // Importance rank from Nominatim (lower is more important locally)
  category: string; // e.g., "boundary", "place", "highway"
  type: string; // More specific type, e.g., "administrative", "city", "residential"
  importance: number; // Importance score from Nominatim (0 to 1)
  address?: NominatimAddress; // Detailed address components
  extratags?: Record<string, string>; // Additional OSM tags
  namedetails?: Record<string, string>; // Alternative names
}
// --- End of Nominatim API specific types ---

/**
 * Calculate Levenshtein distance between two strings.
 * @returns The number of edits (insertions, deletions, substitutions) to change a to b.
 */
const levenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(a.length + 1)
    .fill(null)
    .map(() => Array(b.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[a.length][b.length];
};


/**
 * Finds common characters in order.
 * Example: s1="apple", s2="apply" -> common=4 ('a','p','p','l') - greedy match.
 */
const findCommonCharsOrdered = (s1: string, s2: string): number => {
    let common = 0;
    let s2Pos = 0;
    for (let i = 0; i < s1.length && s2Pos < s2.length; i++) {
        const charInS1 = s1[i];
        const foundPos = s2.indexOf(charInS1, s2Pos);
        if (foundPos !== -1) {
            common++;
            s2Pos = foundPos + 1;
        }
    }
    return common;
};

/**
 * Special similarity calculation for Arabic text.
 * Uses a more lenient matching by finding ordered common characters.
 */
const calculateArabicSimilarity = (a: string, b: string): number => {
  if (a === b) return 1.0;
  if (!a.length || !b.length) return 0.0;

  // Normalize by removing Tatweel (elongation character) for more robust matching
  const normalizeArabic = (text: string) => text.replace(/\u0640/g, '');
  const normA = normalizeArabic(a);
  const normB = normalizeArabic(b);

  const commonAInB = findCommonCharsOrdered(normA, normB);
  const commonBInA = findCommonCharsOrdered(normB, normA);
  
  const common = Math.max(commonAInB, commonBInA);
  const maxLength = Math.max(normA.length, normB.length);
  
  return maxLength > 0 ? common / maxLength : 0;
};


/**
 * Calculate similarity between two strings (case-insensitive).
 * Uses improved matching for both Latin and Arabic scripts.
 * @returns Score between 0-1 where 1 is perfect match.
 */
const calculateStringSimilarity = (a: string, b: string): number => {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();

  if (s1 === s2) return 1.0;
  if (!s1.length || !s2.length) return 0.0;

  // Prefer contains for quick, strong matches before more complex calculations
  if (s1.includes(s2)) return 0.9; // s1 is "search query", s2 is "query" -> good partial match
  if (s2.includes(s1)) return 0.85; // s1 is "query", s2 is "search query"

  const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);
  if (isArabic(s1) || isArabic(s2)) {
    const arabicSimilarity = calculateArabicSimilarity(s1, s2);
    // Use Arabic similarity if it's reasonably high, otherwise fallback to general method
    if (arabicSimilarity > 0.4) return arabicSimilarity; // Adjusted threshold
  }

  // Word-level matching for longer strings
  const words1 = s1.split(/\s+/).filter(w => w.length > 0);
  const words2 = s2.split(/\s+/).filter(w => w.length > 0);
  
  if (words1.length > 0 && words2.length > 0) {
    let matchedWordPairs = 0;
    const uniqueWords2 = new Set(words2); // For efficient lookup

    for (const word1 of words1) {
      let bestWordMatchScore = 0;
      for (const word2 of uniqueWords2) {
        // Use Levenshtein for word similarity if they are not identical
        const maxLenWord = Math.max(word1.length, word2.length);
        if (maxLenWord === 0) continue;
        const dist = levenshteinDistance(word1, word2);
        const currentWordSim = 1 - dist / maxLenWord;
        if (currentWordSim > bestWordMatchScore) {
          bestWordMatchScore = currentWordSim;
        }
      }
      if (bestWordMatchScore > 0.6) { // Threshold for considering a word "matched"
        matchedWordPairs++;
      }
    }
    if (matchedWordPairs > 0) {
      // Average of matched words proportion from both sides
      const precision = matchedWordPairs / words1.length;
      const recall = matchedWordPairs / words2.length;
      if (precision + recall > 0) {
         const f1ScoreBased = (2 * precision * recall) / (precision + recall);
         return Math.min(0.8, 0.4 + f1ScoreBased * 0.4); // Scale to not overshadow exact/includes
      }
    }
  }
  
  // Fallback to Levenshtein distance for the whole strings
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0; // Should have been caught by s1 === s2 or length checks

  const distance = levenshteinDistance(s1, s2);
  return 1 - (distance / maxLen);
};


/**
 * Calculate distance between two points in kilometers
 * Uses the Haversine formula
 */
export const calculateDistance = (
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number => {
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180);
};

// Default fallback locations for when search fails completely
const fallbackLocations: LocationEntry[] = [
  // Major global cities for worldwide coverage
  { id: 'cairo1', name: 'Cairo', fullName: 'Cairo', address: 'Cairo, Egypt', location: { latitude: 30.0444, longitude: 31.2357 }, keywords: ['cairo', 'egypt', 'القاهرة', 'مصر'], importance: 1.0 },
  { id: 'newyork1', name: 'New York', fullName: 'New York City', address: 'New York, NY, USA', location: { latitude: 40.7128, longitude: -74.0060 }, keywords: ['nyc', 'new york', 'manhattan', 'big apple'], importance: 1.0 },
  { id: 'london1', name: 'London', fullName: 'London', address: 'London, United Kingdom', location: { latitude: 51.5074, longitude: -0.1278 }, keywords: ['london', 'uk', 'england', 'britain'], importance: 1.0 },
  { id: 'tokyo1', name: 'Tokyo', fullName: 'Tokyo', address: 'Tokyo, Japan', location: { latitude: 35.6762, longitude: 139.6503 }, keywords: ['tokyo', 'japan', '東京', '日本'], importance: 1.0 },
  { id: 'paris1', name: 'Paris', fullName: 'Paris', address: 'Paris, France', location: { latitude: 48.8566, longitude: 2.3522 }, keywords: ['paris', 'france'], importance: 1.0 },
  { id: 'dubai1', name: 'Dubai', fullName: 'Dubai', address: 'Dubai, United Arab Emirates', location: { latitude: 25.2048, longitude: 55.2708 }, keywords: ['dubai', 'uae', 'دبي', 'الإمارات'], importance: 0.9 },
  { id: 'riyadh1', name: 'Riyadh', fullName: 'Riyadh', address: 'Riyadh, Saudi Arabia', location: { latitude: 24.7136, longitude: 46.6753 }, keywords: ['riyadh', 'saudi', 'ksa', 'الرياض', 'السعودية'], importance: 0.9 }
];

// Use the fallback locations only - we'll primarily rely on OpenStreetMap for real data
const allLocations = fallbackLocations;

/**
 * Search for places by query string with enhanced matching and detailed OSM data
 * @param query The search query (e.g. "coffee shop", "123 Main St", etc.)
 * @param nearLocation Optional location to bias results toward
 * @param limit Maximum number of results to return (default: 5)
 */
export async function searchPlacesEnhanced(
  query: string,
  nearLocation?: Location,
  limit: number = 5
): Promise<PlaceResult[]> {
  if (!query.trim()) return [];

  try {
    console.log(`Enhanced search for query: "${query}"`);
    
    // Detect if query contains Arabic characters
    const isArabicQuery = /[؀-ۿ]/.test(query);
    console.log(`Query detected as ${isArabicQuery ? 'Arabic' : 'non-Arabic'}`);
    
    // First try OpenStreetMap for online results
    let results: PlaceResult[] = [];
    try {
      results = await searchOpenStreetMapDetailed(query, nearLocation, limit, isArabicQuery);
      console.log(`OSM returned ${results.length} results for "${query}"`);
    } catch (error) {
      console.error('Error in enhanced search:', error);
      // Fallback to only local database on major error with OSM
      return await searchLocalDatabase(query, nearLocation, limit, /[؀-ۿ]/.test(query));
    }

    // Always get some results from the local database as backup
    const localResults = await searchLocalDatabase(query, nearLocation, limit * 2, isArabicQuery);
    console.log(`Got ${localResults.length} local results for "${query}"`);

    // Combine results - prioritizing OSM results for more detail, but fall back to local
    // When we combine, filter duplicates by location proximity
    const combinedResults: PlaceResult[] = [];
    const seenLocations: Set<string> = new Set();
    
    // First add all API results
    for (const result of results) {
      const locationKey = `${result.location.latitude.toFixed(4)}-${result.location.longitude.toFixed(4)}`;
      if (!seenLocations.has(locationKey)) {
        combinedResults.push(result);
        seenLocations.add(locationKey);
      }
    }

    // Then add local results that aren't duplicates
    for (const result of localResults) {
      const locationKey = `${result.location.latitude.toFixed(4)}-${result.location.longitude.toFixed(4)}`;
      if (!seenLocations.has(locationKey) && combinedResults.length < limit) {
        combinedResults.push(result);
        seenLocations.add(locationKey);
      }
    }

    console.log(`Returning ${combinedResults.length} combined results for "${query}"`);

    return combinedResults;
  } catch (error) {
    console.error('Error in enhanced search:', error);
    // Fallback to only local database on major error with OSM
    return await searchLocalDatabase(query, nearLocation, limit, /[\u0600-\u06FF]/.test(query));
  }
};

/**
 * Search OpenStreetMap Nominatim API with enhanced parameters
 */
/**
 * Search for locations using the OpenStreetMap Nominatim API
 * Using exact format from example: https://nominatim.openstreetmap.org/search?q=شربين&format=json
 */
async function searchOpenStreetMapDetailed(
  query: string,
  nearLocation?: Location,
  limit: number = 10,
  isArabicQuery: boolean = false
): Promise<PlaceResult[]> {
  try {
    // Create the exact URL format from the example
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json`;
    
    console.log(`SEARCH URL: ${url}`);
    
    // Make direct fetch call with minimal headers
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TripTracker-App/1.0'
      }
    });
    
    if (!response.ok) {
      console.error(`API error: ${response.status}`);
      return [];
    }

    // Parse the response as JSON array - EXACTLY as in the example
    const data = await response.json();
    console.log(`Received ${data.length} results from API for "${query}"`);
    console.log('Raw API response:', JSON.stringify(data).substring(0, 200) + '...');
    
    if (!data || data.length === 0) {
      console.log('No results returned from API');
      return [];
    }
    
    // Convert API results to our format
    const results = data.map((item: any): PlaceResult => {
      // Parse coordinates
      const location: Location = {
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon)
      };

      // Calculate distance if user location is provided
      let distance: number | undefined;
      if (nearLocation) {
        distance = calculateDistance(
          nearLocation.latitude,
          nearLocation.longitude,
          location.latitude,
          location.longitude
        );
      }
      
      // Use name from API response
      return {
        id: `osm-${item.place_id}`,
        name: item.name || item.display_name.split(',')[0],
        address: item.display_name,
        location,
        distance,
        osm_type: item.osm_type,
        osm_id: item.osm_id,
        importance_score: item.importance
      };
    });
    
    console.log(`Processed ${results.length} places for "${query}"`);
    return results.slice(0, limit);

  } catch (error: any) {
    console.error(`Error searching OpenStreetMap for query "${query}":`, error.message, error.stack);
    return [];
  }
}

/**
 * Format OSM address components into a readable string, prioritizing more specific details.
 */
function formatOsmAddress(addressDetails: NominatimAddress | undefined, fallbackDisplay: string): string {
  if (!addressDetails) return fallbackDisplay;

  const components = new Set<string>(); // Use Set to avoid duplicates

  // Order of preference for address components
  const order = [
    addressDetails.amenity,
    addressDetails.shop,
    addressDetails.office,
    addressDetails.building,
    addressDetails.house_number,
    addressDetails.road,
    addressDetails.neighbourhood,
    addressDetails.quarter, // Often used in some regions
    addressDetails.suburb,
    addressDetails.city_district, // e.g. districts within a large city
    addressDetails.village,
    addressDetails.town,
    addressDetails.city,
    addressDetails.municipality, // Can be city or broader area
    addressDetails.county, // Or state_district
    addressDetails.state_district,
    addressDetails.state,
    addressDetails.postcode,
    addressDetails.country
  ];

  for (const component of order) {
    if (component) {
      components.add(component);
    }
  }

  if (components.size > 0) {
    return Array.from(components).join(', ');
  }

  // Fall back to the display_name if we couldn't build a good address
  return fallbackDisplay;
}


/**
 * Merge and deduplicate results from OSM and local database.
 * OSM results are generally preferred for the same location.
 */
function mergeAndDeduplicate(
  osmResults: PlaceResult[], 
  localResults: PlaceResult[], 
  limit: number
): PlaceResult[] {
  const locationMap = new Map<string, PlaceResult>();

  // Add OSM results first (they take priority if coordinates are very similar)
  // Key for deduplication: rounded coordinates (e.g., ~10m to ~100m precision)
  const coordToKey = (loc: Location) => `${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}`;

  for (const result of osmResults) {
    const key = coordToKey(result.location);
    if (!locationMap.has(key)) { // Add if not already present (or prefer OSM if same key later)
        locationMap.set(key, result);
    }
  }

  // Add local results if they don't overlap significantly with OSM results or offer new locations
  for (const result of localResults) {
    const key = coordToKey(result.location);
    if (!locationMap.has(key)) {
      locationMap.set(key, result);
    } else {
      // Optional: If local result has more/better keywords or a higher local 'importance',
      // you might augment the existing OSM result or decide to replace if OSM data is sparse.
      // For now, simple OSM priority on duplicate key.
    }
  }

  let combinedResults = Array.from(locationMap.values());

  // Sort: Prioritize by distance if available, then by OSM importance, then local importance
  combinedResults.sort((a, b) => {
    if (a.distance !== undefined && b.distance !== undefined) {
      if (a.distance !== b.distance) return a.distance - b.distance;
    }
    // Higher importance_score is better
    const impA = a.importance_score || 0;
    const impB = b.importance_score || 0;
    if (impA !== impB) return impB - impA; // Sort descending by importance

    // If OSM result, it might have a place_rank (lower is better for Nominatim rank)
    const rankA = a.place_rank === undefined ? Infinity : a.place_rank;
    const rankB = b.place_rank === undefined ? Infinity : b.place_rank;
    if (rankA !== rankB) return rankA - rankB;

    return 0; // Keep original order if all else is equal (OSM generally came first)
  });

  return combinedResults.slice(0, limit);
}


/**
 * Search local database for locations matching the query
 */
async function searchLocalDatabase(
  query: string,
  nearLocation?: Location,
  limit: number = 10, // Usually fetch more for merging
  isArabicQuery: boolean = false
): Promise<PlaceResult[]> {
  try {
    const scoredResults: { location: LocationEntry; score: number; distance?: number }[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Use space splitting for both Latin and Arabic for query words
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 0);
        
    const currentFuzzyThreshold = isArabicQuery ? ARABIC_FUZZY_MATCH_THRESHOLD : FUZZY_MATCH_THRESHOLD;

    for (const entry of allLocations) {
      let score = 0;
      
      const nameSimilarity = calculateStringSimilarity(lowerQuery, entry.name);
      if (nameSimilarity === 1.0) {
        score += nameSimilarity * BOOST_EXACT_MATCH;
      } else if (nameSimilarity > currentFuzzyThreshold) {
        score += nameSimilarity * BOOST_NAME_MATCH;
      }

      // Consider fullName only if significantly different from name or adds more score
      if (entry.fullName.toLowerCase() !== entry.name.toLowerCase()) {
          const fullNameSimilarity = calculateStringSimilarity(lowerQuery, entry.fullName);
          if (fullNameSimilarity === 1.0 && score < BOOST_EXACT_MATCH) { // Only add exact if not already maxed from name
             score = Math.max(score, fullNameSimilarity * BOOST_EXACT_MATCH);
          } else if (fullNameSimilarity > currentFuzzyThreshold) {
            score += fullNameSimilarity * BOOST_NAME_MATCH * 0.5; // Less weight than primary name match
          }
      }
      
      let keywordMatchScoreTotal = 0;
      let matchedKeywordsCount = 0;
      for (const keyword of entry.keywords) {
        const keywordSim = calculateStringSimilarity(lowerQuery, keyword);
        if (keywordSim === 1.0) { // Exact keyword match
            keywordMatchScoreTotal += keywordSim * 1.5; // Stronger boost for exact keyword
            matchedKeywordsCount++;
        } else if (keywordSim > currentFuzzyThreshold) {
          keywordMatchScoreTotal += keywordSim;
          matchedKeywordsCount++;
        }
      }
      if (matchedKeywordsCount > 0) {
         score += (keywordMatchScoreTotal / matchedKeywordsCount) * BOOST_KEYWORD_MATCH; // Average similarity of matched keywords
      }

      // Word-level partial matches with query terms against name/keywords
      for (const queryWord of queryWords) {
        if (queryWord.length < 2) continue; // Skip very short query words
        if (entry.name.toLowerCase().includes(queryWord)) score += 0.2;
        if (entry.fullName.toLowerCase().includes(queryWord)) score += 0.1;
        if (entry.keywords.some(k => k.toLowerCase().includes(queryWord))) score += 0.3;
      }

      if (entry.importance !== undefined) {
        score *= (1 + entry.importance * 0.5); // Importance boost (0 to 0.5 multiplier)
      }

      let distance: number | undefined;
      if (nearLocation && score > 0.05) { // Only calculate distance if there's some relevance
        distance = calculateDistance(
          nearLocation.latitude,
          nearLocation.longitude,
          entry.location.latitude,
          entry.location.longitude
        );
        if (distance < 5) score *= (BOOST_NEARBY + (5-distance)/5); // Stronger boost for very close <5km
        else if (distance < 20) score *= (BOOST_NEARBY * (1 - distance / 20)); // Within 20km
        else if (distance < 50) score *= (1 + 0.1 * (1 - distance / 50)); // Slight boost up to 50km
      }

      if (score > 0.1) { // Minimum score threshold
        scoredResults.push({ location: entry, score, distance });
      }
    }

    scoredResults.sort((a, b) => b.score - a.score); // Sort by score (highest first)
    
    return scoredResults.slice(0, limit).map(item => ({
      id: item.location.id,
      name: item.location.name,
      address: item.location.address,
      location: item.location.location,
      distance: item.distance,
      importance_score: item.location.importance // Pass local importance
    }));
  } catch (error: any) {
    console.error('Error searching local database:', error.message, error.stack);
    // Basic fallback as in original, though error here is less likely than API errors
    const fallbackName = query.split(" ")[0] || "Cairo"; // Simple fallback name
    return [
      { id: 'fallback_local_1', name: fallbackName, address: `${fallbackName}, Egypt`, location: { latitude: 30.0444, longitude: 31.2357 }, distance: nearLocation ? calculateDistance(nearLocation.latitude, nearLocation.longitude, 30.0444, 31.2357) : undefined },
    ];
  }
};