/**
 * Basic location service for geocoding and search
 * This provides backward compatibility while we transition to the enhanced version
 */

import { Location } from './firebaseService';
import { searchPlacesEnhanced, calculateDistance as calcDist } from './enhancedLocationService';

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  location: Location;
  distance?: number;
  accuracy?: 'approximate' | 'exact'; // Indicates if the location is exact or needs refinement
}

/**
 * Search for places by query string (redirects to enhanced service)
 * @param query The search query (e.g. "coffee shop", "123 Main St", etc.)
 * @param nearLocation Optional location to bias results toward
 * @param limit Maximum number of results to return (default: 5)
 */
export const searchPlaces = async (
  query: string,
  nearLocation?: Location,
  limit: number = 5
): Promise<PlaceResult[]> => {
  // Simply redirect to the enhanced implementation
  return searchPlacesEnhanced(query, nearLocation, limit);
};

/**
 * Get address details from coordinates using reverse geocoding
 * @param location Location coordinates
 */
export const getAddressFromLocation = async (location: Location): Promise<string> => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.latitude}&lon=${location.longitude}`;
    
    const headers = {
      'User-Agent': 'TripTracker-App',
      'Accept-Language': 'en'
    };
    
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error('Reverse geocoding failed');
    
    const data = await response.json();
    return data.display_name || 'Unknown location';
  } catch (error) {
    console.error('Error getting address:', error);
    return 'Unknown location';
  }
};

/**
 * Re-export the calculateDistance function from enhancedLocationService
 * to maintain backward compatibility
 */
export const calculateDistance = calcDist;

/**
 * Helper function to get the deg2rad calculation
 * @param deg Degrees to convert
 * @returns Radians
 */
const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180);
};
