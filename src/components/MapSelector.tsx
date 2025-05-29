import { useEffect, useState, useRef, FC } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Location } from '@/services/firebaseService';
import { Badge } from '@/components/ui/badge';
import { MapPin, CheckCircle2, RotateCcw } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLngExpression, LatLngTuple } from 'leaflet';

// Create a custom icon for the map marker
const createCustomIcon = () => {
  return new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

interface MapSelectorProps {
  initialLocation: Location;
  initialAddress: string;
  onSelectLocation: (location: Location, address: string) => void;
  onClose?: () => void;
}

// TileLayer component that uses OpenStreetMap
const TileLayerComponent: FC = () => {
  return (
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      // Use type assertion to bypass TypeScript errors with react-leaflet props
      {...{ attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' } as any}
    />
  );
};

// Custom draggable marker component
interface DraggableMarkerProps {
  position: LatLngTuple;
  onMarkerDrag: (lat: number, lng: number) => void;
}

const DraggableMarker: FC<DraggableMarkerProps> = ({ position, onMarkerDrag }) => {
  const customIcon = createCustomIcon();
  
  return (
    <Marker
      position={position}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target;
          const position = marker.getLatLng();
          onMarkerDrag(position.lat, position.lng);
        },
      }}
      // Use custom icon and make marker draggable
      icon={customIcon}
      {...({ draggable: true } as any)}
    />
  );
};

// Component to handle map interactions
const MapInteraction: FC<{ 
  setMarkerPosition: (pos: [number, number]) => void;
  onAddressUpdate: (lat: number, lng: number) => void;
}> = ({ setMarkerPosition, onAddressUpdate }) => {
  const map = useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      setMarkerPosition([lat, lng]);
      onAddressUpdate(lat, lng);
    },
  });

  return null;
};

const MapSelector = ({ 
  initialLocation, 
  initialAddress, 
  onSelectLocation,
  onClose 
}: MapSelectorProps) => {
  const [markerPosition, setMarkerPosition] = useState<[number, number]>([
    initialLocation.latitude,
    initialLocation.longitude
  ]);
  const [address, setAddress] = useState(initialAddress);
  const [isLoading, setIsLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  
  // Convert Location coordinates to Leaflet LatLngExpression
  const locationToLatLng = (loc: Location): LatLngExpression => {
    return [loc.latitude, loc.longitude];
  };
  
  // Load Leaflet CSS and initialize map
  useEffect(() => {
    // Inject Leaflet CSS if not already present
    if (!document.querySelector('#leaflet-css')) {
      const leafletStyles = document.createElement('link');
      leafletStyles.id = 'leaflet-css';
      leafletStyles.rel = 'stylesheet';
      leafletStyles.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(leafletStyles);
    }
    
    // Set map as loaded
    setMapLoaded(true);
    
    return () => {
      // Clean up when component unmounts
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);
  
  // Reverse geocode to get address from coordinates
  const getAddressFromCoordinates = async (lat: number, lng: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'TripTrackerApp',
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch address');
      }
      
      const data = await response.json();
      const newAddress = data.display_name || 'Unknown location';
      setAddress(newAddress);
    } catch (error) {
      console.error('Error getting address:', error);
      setAddress('Selected location');
    } finally {
      setIsLoading(false);
    }
  };

  // Update address when marker moves
  const handleAddressUpdate = (lat: number, lng: number) => {
    getAddressFromCoordinates(lat, lng);
  };

  // Confirm location selection
  const handleConfirmLocation = () => {
    onSelectLocation(
      { latitude: markerPosition[0], longitude: markerPosition[1] },
      address
    );
    if (onClose) onClose();
  };

  // Reset to initial position
  const handleReset = () => {
    setMarkerPosition([initialLocation.latitude, initialLocation.longitude]);
    setAddress(initialAddress);
    if (mapRef.current) {
      mapRef.current.setView(
        locationToLatLng(initialLocation),
        mapRef.current.getZoom()
      );
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
        <div className="h-[300px] w-full rounded-md overflow-hidden border">
          {/* Add a loading indicator */}
          {!mapLoaded ? (
            <div className="h-full w-full flex items-center justify-center bg-gray-100">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
          ) : null}
          
          {/* We're using a simpler approach with type assertion to avoid TypeScript errors */}
          <MapContainer
            {...{
              style: { height: '100%', width: '100%' },
              zoom: 15,
              center: markerPosition,
              scrollWheelZoom: true
            } as any}
            ref={mapRef}
          >
            <TileLayerComponent />
            <DraggableMarker 
              position={markerPosition} 
              onMarkerDrag={(lat, lng) => {
                setMarkerPosition([lat, lng]);
                handleAddressUpdate(lat, lng);
              }} 
            />
            <MapInteraction 
              setMarkerPosition={setMarkerPosition} 
              onAddressUpdate={handleAddressUpdate}
            />
          </MapContainer>
        </div>

        {/* Selected location info */}
        <div className="bg-muted p-3 rounded-md">
          <p className="text-sm font-medium mb-1">Selected Location:</p>
          <p className="text-sm text-muted-foreground break-words">
            {isLoading ? 'Loading address...' : address}
          </p>
          <div className="text-xs text-muted-foreground mt-1">
            {markerPosition[0].toFixed(6)}, {markerPosition[1].toFixed(6)}
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

export default MapSelector;
