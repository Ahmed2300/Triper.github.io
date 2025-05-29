import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Location } from '@/services/firebaseService';
import { Badge } from '@/components/ui/badge';
import { MapPin, CheckCircle2, RotateCcw } from 'lucide-react';
import { getAddressFromLocation } from '@/services/locationService';

interface SimpleMapPickerProps {
  initialLocation: Location;
  initialAddress: string;
  onSelectLocation: (location: Location, address: string) => void;
  onClose?: () => void;
}

const SimpleMapPicker = ({
  initialLocation,
  initialAddress,
  onSelectLocation,
  onClose
}: SimpleMapPickerProps) => {
  const [address, setAddress] = useState(initialAddress);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLat, setSelectedLat] = useState(initialLocation.latitude);
  const [selectedLng, setSelectedLng] = useState(initialLocation.longitude);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    // Load Google Maps API script dynamically
    const loadGoogleMapsAPI = () => {
      if (window.google && window.google.maps) {
        initializeMap();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=&libraries=places&callback=initGoogleMap`;
      script.async = true;
      script.defer = true;
      
      // Define the callback function globally
      window.initGoogleMap = initializeMap;
      
      document.head.appendChild(script);
    };

    const initializeMap = () => {
      if (!mapContainerRef.current || mapRef.current) return;
      
      const { google } = window;
      if (!google) return;

      // Create the map
      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: selectedLat, lng: selectedLng },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });
      
      // Create a marker
      const marker = new google.maps.Marker({
        position: { lat: selectedLat, lng: selectedLng },
        map: map,
        draggable: true,
        title: 'Drag to adjust location'
      });
      
      // Set up event listener for marker drag
      marker.addListener('dragend', async () => {
        const position = marker.getPosition();
        if (position) {
          const lat = position.lat();
          const lng = position.lng();
          setSelectedLat(lat);
          setSelectedLng(lng);
          
          // Update address
          updateAddress(lat, lng);
        }
      });
      
      // Set up click handler on map
      map.addListener('click', async (event: any) => {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        
        // Update marker position
        marker.setPosition({ lat, lng });
        
        // Update state
        setSelectedLat(lat);
        setSelectedLng(lng);
        
        // Update address
        updateAddress(lat, lng);
      });
      
      // Store references
      mapRef.current = map;
      markerRef.current = marker;
    };
    
    loadGoogleMapsAPI();
    
    // Cleanup function
    return () => {
      if (window.google && mapRef.current) {
        // Clean up map resources if needed
        mapRef.current = null;
        markerRef.current = null;
        delete window.initGoogleMap;
      }
    };
  }, []);
  
  const updateAddress = async (lat: number, lng: number) => {
    setIsLoading(true);
    try {
      const newAddress = await getAddressFromLocation({ latitude: lat, longitude: lng });
      setAddress(newAddress);
    } catch (error) {
      console.error('Error getting address:', error);
      setAddress('Selected location');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleConfirmLocation = () => {
    onSelectLocation(
      { latitude: selectedLat, longitude: selectedLng },
      address
    );
    if (onClose) onClose();
  };
  
  const handleReset = () => {
    setSelectedLat(initialLocation.latitude);
    setSelectedLng(initialLocation.longitude);
    setAddress(initialAddress);
    
    if (markerRef.current && mapRef.current) {
      const newPosition = { 
        lat: initialLocation.latitude, 
        lng: initialLocation.longitude 
      };
      
      markerRef.current.setPosition(newPosition);
      mapRef.current.setCenter(newPosition);
    }
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
            Drag or tap to place marker
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Map container */}
        <div 
          ref={mapContainerRef} 
          className="h-[300px] w-full rounded-md overflow-hidden border"
          style={{ position: 'relative' }}
        >
          {/* Loading indicator */}
          {!mapRef.current && (
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
          <p className="text-sm text-muted-foreground break-words">
            {isLoading ? 'Loading address...' : address}
          </p>
          <div className="text-xs text-muted-foreground mt-1">
            {selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}
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

declare global {
  interface Window {
    google: any;
    initGoogleMap: () => void;
  }
}

export default SimpleMapPicker;
