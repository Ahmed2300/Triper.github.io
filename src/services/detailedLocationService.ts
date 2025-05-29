/**
 * Detailed location service for reverse geocoding
 * Provides highly detailed location names based on coordinates
 */

import { Location } from './firebaseService';

// Point of interest with detailed information
interface POI {
  name: string;
  type: 'landmark' | 'street' | 'building' | 'district' | 'intersection';
  latitude: number;
  longitude: number;
  radius: number; // in kilometers
  address?: string;
  description?: string;
}

// Area data structure for neighborhoods
interface Area {
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // in kilometers
}

// District data
interface District {
  name: string;
  center: {
    latitude: number;
    longitude: number;
  };
  boundaries: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

// Street data
interface Street {
  name: string;
  startPoint: {
    latitude: number;
    longitude: number;
  };
  endPoint: {
    latitude: number;
    longitude: number;
  };
  width: number; // approximate width in meters
}

// Cairo districts
const cairoDistricts: District[] = [
  {
    name: 'Downtown Cairo',
    center: { latitude: 30.0444, longitude: 31.2357 },
    boundaries: { north: 30.0561, south: 30.0336, east: 31.2468, west: 31.2243 }
  },
  {
    name: 'Zamalek',
    center: { latitude: 30.0596, longitude: 31.2215 },
    boundaries: { north: 30.0689, south: 30.0525, east: 31.2273, west: 31.2141 }
  },
  {
    name: 'Maadi',
    center: { latitude: 29.9603, longitude: 31.2503 },
    boundaries: { north: 29.9750, south: 29.9456, east: 31.2625, west: 31.2350 }
  },
  {
    name: 'Nasr City',
    center: { latitude: 30.0511, longitude: 31.3656 },
    boundaries: { north: 30.0736, south: 30.0286, east: 31.3881, west: 31.3431 }
  },
  {
    name: 'Heliopolis',
    center: { latitude: 30.0887, longitude: 31.3222 },
    boundaries: { north: 30.1037, south: 30.0737, east: 31.3372, west: 31.3072 }
  },
  {
    name: 'Giza',
    center: { latitude: 29.9870, longitude: 31.2118 },
    boundaries: { north: 30.0100, south: 29.9640, east: 31.2348, west: 31.1888 }
  }
];

// Major streets in Cairo
const cairoStreets: Street[] = [
  {
    name: 'Tahrir Street',
    startPoint: { latitude: 30.0436, longitude: 31.2336 },
    endPoint: { latitude: 30.0456, longitude: 31.2376 },
    width: 20
  },
  {
    name: 'Kasr El Nile Street',
    startPoint: { latitude: 30.0445, longitude: 31.2356 },
    endPoint: { latitude: 30.0452, longitude: 31.2416 },
    width: 18
  },
  {
    name: 'Road 9',
    startPoint: { latitude: 29.9608, longitude: 31.2481 },
    endPoint: { latitude: 29.9608, longitude: 31.2587 },
    width: 15
  },
  {
    name: 'Abbas El Akkad Street',
    startPoint: { latitude: 30.0565, longitude: 31.3436 },
    endPoint: { latitude: 30.0707, longitude: 31.3536 },
    width: 25
  },
  {
    name: 'Makram Ebeid Street',
    startPoint: { latitude: 30.0546, longitude: 31.3413 },
    endPoint: { latitude: 30.0546, longitude: 31.3700 },
    width: 22
  }
];

// Points of Interest in Cairo
const cairoPOIs: POI[] = [
  {
    name: 'Egyptian Museum',
    type: 'landmark',
    latitude: 30.0478,
    longitude: 31.2336,
    radius: 0.2,
    address: 'Tahrir Square, Downtown Cairo',
    description: 'Famous museum with ancient Egyptian artifacts'
  },
  {
    name: 'Cairo Tower',
    type: 'landmark',
    latitude: 30.0459,
    longitude: 31.2243,
    radius: 0.1,
    address: 'Gezira Island, Zamalek',
    description: 'Iconic 187m tall tower with observation deck'
  },
  {
    name: 'Khan el-Khalili',
    type: 'landmark',
    latitude: 30.0477,
    longitude: 31.2622,
    radius: 0.25,
    address: 'Al-Azhar Street, Islamic Cairo',
    description: 'Famous bazaar district with shops and cafes'
  },
  {
    name: 'City Stars Mall',
    type: 'building',
    latitude: 30.0729,
    longitude: 31.3456,
    radius: 0.15,
    address: 'Omar Ibn El-Khattab, Nasr City',
    description: 'Large shopping mall with retail and entertainment'
  },
  {
    name: 'Cairo International Stadium',
    type: 'landmark',
    latitude: 30.0686,
    longitude: 31.3119,
    radius: 0.3,
    address: 'Nasr City, Cairo',
    description: 'Major sports stadium'
  },
  {
    name: 'Al-Azhar Park',
    type: 'landmark',
    latitude: 30.0342,
    longitude: 31.2665,
    radius: 0.3,
    address: 'Salah Salem Street, Cairo',
    description: 'Large public garden with historical views'
  },
  {
    name: 'Cairo Festival City',
    type: 'building',
    latitude: 30.0283,
    longitude: 31.4071,
    radius: 0.2,
    address: 'New Cairo',
    description: 'Shopping mall and residential complex'
  },
  {
    name: 'The Pyramids of Giza',
    type: 'landmark',
    latitude: 29.9792,
    longitude: 31.1342,
    radius: 0.5,
    address: 'Al Haram, Giza',
    description: 'Ancient Egyptian pyramids and the Great Sphinx'
  },
  {
    name: 'Cairo Opera House',
    type: 'building',
    latitude: 30.0422,
    longitude: 31.2245,
    radius: 0.1,
    address: 'Gezira Island, Zamalek',
    description: 'Main performing arts venue'
  },
  {
    name: 'Tahrir Square',
    type: 'landmark',
    latitude: 30.0444,
    longitude: 31.2357,
    radius: 0.1,
    address: 'Downtown Cairo',
    description: 'Famous public square in central Cairo'
  },
  {
    name: 'American University in Cairo',
    type: 'building',
    latitude: 30.0218,
    longitude: 31.4993,
    radius: 0.3,
    address: 'AUC Avenue, New Cairo',
    description: 'Private university campus'
  },
  {
    name: 'Maadi Club',
    type: 'building',
    latitude: 29.9601,
    longitude: 31.2572,
    radius: 0.15,
    address: 'Street 87, Maadi',
    description: 'Sports and social club'
  }
];

// Neighborhood areas
const cairoAreas: Area[] = [
  { name: 'Cairo Downtown', latitude: 30.0444, longitude: 31.2357, radius: 2.0 },
  { name: 'Tahrir Square', latitude: 30.0455, longitude: 31.2355, radius: 0.3 },
  { name: 'Maadi', latitude: 29.9603, longitude: 31.2503, radius: 2.5 },
  { name: 'Nasr City', latitude: 30.0511, longitude: 31.3656, radius: 3.0 },
  { name: 'Heliopolis', latitude: 30.0887, longitude: 31.3222, radius: 2.5 },
  { name: 'Giza', latitude: 29.9870, longitude: 31.2118, radius: 3.0 },
  { name: 'Al Mohandessin', latitude: 30.0533, longitude: 31.2000, radius: 1.5 },
  { name: 'Garden City', latitude: 30.0341, longitude: 31.2313, radius: 1.0 },
  { name: 'New Cairo', latitude: 30.0291, longitude: 31.4816, radius: 5.0 },
  { name: 'Zamalek', latitude: 30.0596, longitude: 31.2215, radius: 1.0 },
  { name: 'Dokki', latitude: 30.0380, longitude: 31.2127, radius: 1.5 },
  { name: 'Agouza', latitude: 30.0547, longitude: 31.2105, radius: 1.0 },
  { name: 'Pyramids Area', latitude: 29.9758, longitude: 31.1308, radius: 3.0 }
];

// Calculate distance between two points in kilometers
const calculateDistance = (
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Check if a point is within a district's boundaries
const isInDistrict = (lat: number, lng: number, district: District): boolean => {
  return (
    lat <= district.boundaries.north &&
    lat >= district.boundaries.south &&
    lng <= district.boundaries.east &&
    lng >= district.boundaries.west
  );
};

// Calculate distance from a point to a street segment
const distanceToStreet = (
  lat: number, 
  lng: number, 
  street: Street
): number => {
  // This is a simplified calculation for demo purposes
  // Actual implementation would use more complex geometry
  
  // Find the midpoint of the street
  const midLat = (street.startPoint.latitude + street.endPoint.latitude) / 2;
  const midLng = (street.startPoint.longitude + street.endPoint.longitude) / 2;
  
  // Calculate distance from point to midpoint
  return calculateDistance(lat, lng, midLat, midLng);
};

// Find the nearest POI to a given point
const findNearestPOI = (
  lat: number, 
  lng: number
): POI | null => {
  let nearestPOI: POI | null = null;
  let smallestDistance = Infinity;
  
  for (const poi of cairoPOIs) {
    const distance = calculateDistance(lat, lng, poi.latitude, poi.longitude);
    
    // If within POI radius, return immediately
    if (distance <= poi.radius) {
      return poi;
    }
    
    // Otherwise track the closest POI
    if (distance < smallestDistance) {
      smallestDistance = distance;
      nearestPOI = poi;
    }
  }
  
  // If nearest POI is within 0.5km, still consider it relevant
  if (nearestPOI && smallestDistance <= 0.5) {
    return nearestPOI;
  }
  
  return null;
};

// Find the district containing a point
const findDistrict = (
  lat: number, 
  lng: number
): District | null => {
  for (const district of cairoDistricts) {
    if (isInDistrict(lat, lng, district)) {
      return district;
    }
  }
  return null;
};

// Find the nearest street to a point
const findNearestStreet = (
  lat: number, 
  lng: number
): Street | null => {
  let nearestStreet: Street | null = null;
  let smallestDistance = Infinity;
  
  for (const street of cairoStreets) {
    const distance = distanceToStreet(lat, lng, street);
    
    // If very close to street (within 100m), return immediately
    if (distance <= 0.1) {
      return street;
    }
    
    // Track closest street
    if (distance < smallestDistance) {
      smallestDistance = distance;
      nearestStreet = street;
    }
  }
  
  // If nearest street is within 0.3km, still consider it relevant
  if (nearestStreet && smallestDistance <= 0.3) {
    return nearestStreet;
  }
  
  return null;
};

// Find the area containing a point
const findArea = (
  lat: number, 
  lng: number
): Area | null => {
  let containingArea: Area | null = null;
  let smallestRadius = Infinity;
  
  for (const area of cairoAreas) {
    const distance = calculateDistance(lat, lng, area.latitude, area.longitude);
    
    // If within area radius, track the smallest containing area
    if (distance <= area.radius) {
      // In case of multiple matches, prefer the more specific (smaller) area
      if (area.radius < smallestRadius) {
        smallestRadius = area.radius;
        containingArea = area;
      }
    }
  }
  
  return containingArea;
};

// Get detailed location description from coordinates
export const getDetailedLocation = (location: Location): string => {
  const { latitude, longitude } = location;
  
  // Start with the most specific locations
  
  // 1. Check for a specific POI
  const nearestPOI = findNearestPOI(latitude, longitude);
  if (nearestPOI) {
    if (calculateDistance(latitude, longitude, nearestPOI.latitude, nearestPOI.longitude) <= nearestPOI.radius) {
      return `At ${nearestPOI.name}${nearestPOI.address ? `, ${nearestPOI.address}` : ''}`;
    } else {
      return `Near ${nearestPOI.name}${nearestPOI.address ? `, ${nearestPOI.address}` : ''}`;
    }
  }
  
  // 2. Check for a specific street
  const nearestStreet = findNearestStreet(latitude, longitude);
  const district = findDistrict(latitude, longitude);
  
  if (nearestStreet && district) {
    return `On ${nearestStreet.name}, ${district.name}`;
  } else if (nearestStreet) {
    return `On ${nearestStreet.name}`;
  }
  
  // 3. If no street, try a district
  if (district) {
    return `In ${district.name}`;
  }
  
  // 4. Fall back to general area
  const area = findArea(latitude, longitude);
  if (area) {
    return `In ${area.name}`;
  }
  
  // Ultimate fallback
  return 'Cairo, Egypt';
};

// Get a complete detailed address with hierarchical information
export const getDetailedAddress = (location: Location): string => {
  const { latitude, longitude } = location;
  const parts: string[] = [];
  
  // Start with most specific
  const nearestPOI = findNearestPOI(latitude, longitude);
  const nearestStreet = findNearestStreet(latitude, longitude);
  const district = findDistrict(latitude, longitude);
  const area = findArea(latitude, longitude);
  
  // Build hierarchical address
  if (nearestPOI) {
    parts.push(nearestPOI.name);
  }
  
  if (nearestStreet) {
    // If we already have a POI, say "on X street" instead of just the street name
    parts.push(parts.length ? `on ${nearestStreet.name}` : nearestStreet.name);
  }
  
  if (district && (!area || district.name !== area.name)) {
    parts.push(district.name);
  } else if (area) {
    parts.push(area.name);
  }
  
  // Always add Cairo, Egypt
  parts.push('Cairo, Egypt');
  
  // Combine all parts
  return parts.join(', ');
};

// Get distance and direction from a known reference point
export const getLocationRelativeToLandmark = (
  location: Location,
  landmarkName: string = 'Tahrir Square'
): string | null => {
  // Find the landmark
  const landmark = cairoPOIs.find(poi => poi.name === landmarkName);
  if (!landmark) return null;
  
  // Calculate distance
  const distance = calculateDistance(
    location.latitude, 
    location.longitude, 
    landmark.latitude, 
    landmark.longitude
  );
  
  // Calculate direction
  const dx = location.longitude - landmark.longitude;
  const dy = location.latitude - landmark.latitude;
  
  let direction = '';
  if (Math.abs(dy) > Math.abs(dx)) {
    direction = dy > 0 ? 'north' : 'south';
  } else {
    direction = dx > 0 ? 'east' : 'west';
  }
  
  // Format distance
  let distanceStr = '';
  if (distance < 1) {
    distanceStr = `${Math.round(distance * 1000)} meters`;
  } else {
    distanceStr = `${distance.toFixed(1)} km`;
  }
  
  return `${distanceStr} ${direction} of ${landmarkName}`;
};

// Main function to get comprehensive location info
export const getComprehensiveLocationInfo = (location: Location): {
  shortName: string;
  fullAddress: string;
  relative?: string;
} => {
  const shortName = getDetailedLocation(location);
  const fullAddress = getDetailedAddress(location);
  const relative = getLocationRelativeToLandmark(location);
  
  return {
    shortName,
    fullAddress,
    relative
  };
};
