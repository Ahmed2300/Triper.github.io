import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Location } from '@/services/firebaseService';
import { Badge } from '@/components/ui/badge';
import { MapPin, CheckCircle2, RotateCcw } from 'lucide-react';
import { getAddressFromLocation } from '@/services/locationService';
import { getComprehensiveLocationInfo } from '@/services/detailedLocationService';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface OpenStreetMapPickerProps {
  initialLocation: Location;
  initialAddress: string;
  onSelectLocation: (location: Location, address: string) => void;
  onClose?: () => void;
}

const OpenStreetMapPicker = ({
  initialLocation,
  initialAddress,
  onSelectLocation,
  onClose
}: OpenStreetMapPickerProps) => {
  const [location, setLocation] = useState<Location>(initialLocation);
  const [address, setAddress] = useState(initialAddress);
  const [isLoading, setIsLoading] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);

  // Initialize the map
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    // Create map instance
    const map = L.map(mapRef.current).setView(
      [initialLocation.latitude, initialLocation.longitude], 
      16
    );

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Create marker with custom icon
    const defaultIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    const locationMarker = L.marker(
      [initialLocation.latitude, initialLocation.longitude],
      { draggable: true, icon: defaultIcon }
    ).addTo(map);

    // Handle marker drag end
    locationMarker.on('dragend', async function(e) {
      const markerPosition = locationMarker.getLatLng();
      const newLocation = {
        latitude: markerPosition.lat,
        longitude: markerPosition.lng
      };
      setLocation(newLocation);
      updateAddress(newLocation);
    });

    // Handle map click
    map.on('click', async function(e) {
      const clickPosition = e.latlng;
      locationMarker.setLatLng(clickPosition);
      
      const newLocation = {
        latitude: clickPosition.lat,
        longitude: clickPosition.lng
      };
      setLocation(newLocation);
      updateAddress(newLocation);
    });

    // Store references
    leafletMap.current = map;
    marker.current = locationMarker;
    setMapInitialized(true);

    // Clean up on unmount
    return () => {
      if (map) {
        map.remove();
        leafletMap.current = null;
        marker.current = null;
      }
    };
  }, [initialLocation]);

  // Cairo area location data for address lookup
  const cairoLocations = [
    { name: 'Cairo Downtown', latitude: 30.0444, longitude: 31.2357, radius: 0.015 },
    { name: 'Tahrir Square', latitude: 30.0455, longitude: 31.2355, radius: 0.007 },
    { name: 'Maadi', latitude: 29.9603, longitude: 31.2503, radius: 0.02 },
    { name: 'Nasr City', latitude: 30.0511, longitude: 31.3656, radius: 0.02 },
    { name: 'Heliopolis', latitude: 30.0887, longitude: 31.3222, radius: 0.02 },
    { name: 'Giza', latitude: 29.9870, longitude: 31.2118, radius: 0.02 },
    { name: 'Al Mohandessin', latitude: 30.0533, longitude: 31.2000, radius: 0.015 },
    { name: 'Garden City', latitude: 30.0341, longitude: 31.2313, radius: 0.01 },
    { name: 'New Cairo', latitude: 30.0291, longitude: 31.4816, radius: 0.04 },
    { name: 'Zamalek', latitude: 30.0596, longitude: 31.2215, radius: 0.01 },
    { name: 'Dokki', latitude: 30.0380, longitude: 31.2127, radius: 0.015 },
    { name: 'Agouza', latitude: 30.0547, longitude: 31.2105, radius: 0.01 },
    { name: 'Pyramids Area', latitude: 29.9758, longitude: 31.1308, radius: 0.03 },
    { name: 'Cairo International Airport', latitude: 30.1119, longitude: 31.4128, radius: 0.03 },
    { name: 'Helwan', latitude: 29.8500, longitude: 31.3333, radius: 0.02 },
    { name: 'Ramses Square', latitude: 30.0639, longitude: 31.2469, radius: 0.01 },
    { name: 'Abbassia', latitude: 30.0728, longitude: 31.2886, radius: 0.015 },
    { name: 'Al Azhar', latitude: 30.0427, longitude: 31.2625, radius: 0.01 },
    { name: 'Khan el-Khalili', latitude: 30.0477, longitude: 31.2622, radius: 0.01 },
  ];
  
  // Calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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
  
  // Get nearest location name based on coordinates
  const getNearestLocationName = (lat: number, lng: number): string => {
    let nearestLocation = null;
    let smallestDistance = Infinity;
    
    for (const location of cairoLocations) {
      const distance = calculateDistance(lat, lng, location.latitude, location.longitude);
      
      // If within the location's radius, return immediately
      if (distance <= location.radius) {
        return location.name;
      }
      
      // Otherwise track the closest one
      if (distance < smallestDistance) {
        smallestDistance = distance;
        nearestLocation = location;
      }
    }
    
    // If we have a nearest location within 5km, use it with 'near'
    if (nearestLocation && smallestDistance < 5) {
      return `Near ${nearestLocation.name}`;
    }
    
    // Default fallback
    return 'Cairo, Egypt';
  };
  
  // Update address from coordinates
  const updateAddress = async (newLocation: Location) => {
    setIsLoading(true);
    try {
      // Short delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 700));
      
      // First, get a basic location name instantly (fallback)
      const basicLocationName = getNearestLocationName(newLocation.latitude, newLocation.longitude);
      setAddress(basicLocationName);

      // Then, get detailed location information
      const locationInfo = getComprehensiveLocationInfo(newLocation);
      
      // Use the short name which has the most precise information
      setAddress(locationInfo.shortName);
      
      // Try API call in background as final attempt
      getAddressFromLocation(newLocation)
        .then(apiAddress => {
          if (apiAddress && apiAddress !== 'Unknown location') {
            // Format the API address for better display
            const parts = apiAddress.split(',');
            if (parts.length >= 3) {
              // Use the first 2-3 parts for a cleaner, more specific address
              const formattedAddress = parts.slice(0, 3).join(', ');
              // Only update if it seems more specific than what we already have
              if (formattedAddress.length > 10) {
                setAddress(formattedAddress);
              }
            }
          }
        })
        .catch(err => {
          console.warn('Background address lookup failed:', err);
          // We already have detailed location from our local data
        });
    } catch (error) {
      console.error('Error getting address:', error);
      setAddress('Selected location');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to initial location
  const handleReset = () => {
    if (leafletMap.current && marker.current) {
      const initialLatLng = L.latLng(initialLocation.latitude, initialLocation.longitude);
      marker.current.setLatLng(initialLatLng);
      leafletMap.current.setView(initialLatLng, leafletMap.current.getZoom());
      
      setLocation(initialLocation);
      setAddress(initialAddress);
    }
  };

  // Confirm location selection
  const handleConfirmLocation = () => {
    onSelectLocation(location, address);
    if (onClose) onClose();
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            Select Exact Location
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Drag marker or tap map
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Map container */}
        <div 
          ref={mapRef} 
          className="h-[300px] w-full rounded-md overflow-hidden border"
          style={{ position: 'relative' }}
        >
          {/* Loading overlay */}
          {!mapInitialized && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-70 z-10">
              <div className="flex flex-col items-center">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
                <p className="mt-2 text-sm text-gray-600">Loading map...</p>
              </div>
            </div>
          )}
        </div>

        {/* Selected location info */}
        <div className="bg-muted p-3 rounded-md">
          <p className="text-sm font-medium mb-1">Selected Location:</p>
          <div className="min-h-[28px]">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="animate-spin h-3 w-3 border-2 border-blue-500 rounded-full border-t-transparent"></span>
                <span>Finding location name...</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground break-words font-medium">
                {address}
              </p>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-1"
            onClick={handleReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button 
            className="flex items-center gap-1 ml-auto"
            onClick={handleConfirmLocation}
          >
            <CheckCircle2 className="h-4 w-4" />
            Confirm Location
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OpenStreetMapPicker;
