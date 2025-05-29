
import { useState, useEffect, useRef } from 'react';
import { Location, RideRequest } from '@/services/firebaseService';
import { calculateDistance } from '@/services/locationService';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { MapPin, Navigation, Map as MapIcon } from 'lucide-react';

// Define types for Leaflet Routing extensions
declare global {
  interface Window {
    L: typeof L & {
      Routing: {
        control: (options: any) => any;
      }
    }
  }
}

// Add Routing to Leaflet's type definition
declare module 'leaflet' {
  namespace L {
    namespace Routing {
      function control(options: any): any;
    }
  }
}

interface LiveRouteMapProps {
  ride: RideRequest;
  driverLocation: Location;
  className?: string;
}

const LiveRouteMap = ({ ride, driverLocation, className = '' }: LiveRouteMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mapError, setMapError] = useState<string | null>(null);
  
  const routeControl = useRef<any>(null);
  const pickupMarker = useRef<L.Marker | null>(null);
  const destinationMarker = useRef<L.Marker | null>(null);
  const driverMarker = useRef<L.Marker | null>(null);

  // Initialize map on component mount
  useEffect(() => {
    // Skip if no map container
    if (!mapRef.current) return;
    
    // Clean up existing map instance if it exists
    if (leafletMap.current) {
      leafletMap.current.remove();
    }
    
    // Create map instance
    try {
      setIsLoading(true);
      setMapError(null);
      
      const map = L.map(mapRef.current, {
        center: [driverLocation.latitude, driverLocation.longitude],
        zoom: 13,
        layers: [
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          })
        ]
      });
      
      leafletMap.current = map;
      setIsLoading(false);
    } catch (error) {
      console.error("Error initializing map:", error);
      setMapError("Failed to initialize map");
      setIsLoading(false);
    }
    
    // Cleanup function to remove map when component unmounts
    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);
  
  // Update route when pickup, destination or driver location changes
  useEffect(() => {
    if (!leafletMap.current || !ride.pickupLocation || !ride.destinationLocation) return;
    
    const map = leafletMap.current;
    
    // Clear previous markers
    if (pickupMarker.current) map.removeLayer(pickupMarker.current);
    if (destinationMarker.current) map.removeLayer(destinationMarker.current);
    if (driverMarker.current) map.removeLayer(driverMarker.current);
    
    // Create marker icons
    const pickupIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      shadowSize: [41, 41]
    });
    
    const destinationIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      shadowSize: [41, 41]
    });
    
    const driverIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      shadowSize: [41, 41]
    });
    
    // Add markers for pickup, destination and driver
    pickupMarker.current = L.marker(
      [ride.pickupLocation.latitude, ride.pickupLocation.longitude],
      { icon: pickupIcon }
    ).addTo(map);
    
    destinationMarker.current = L.marker(
      [ride.destinationLocation.latitude, ride.destinationLocation.longitude],
      { icon: destinationIcon }
    ).addTo(map);
    
    driverMarker.current = L.marker(
      [driverLocation.latitude, driverLocation.longitude],
      { icon: driverIcon }
    ).addTo(map);
    
    // Add popups with information
    pickupMarker.current.bindPopup(`<b>Pickup:</b> ${ride.pickupAddress || 'Customer Location'}`);
    destinationMarker.current.bindPopup(`<b>Destination:</b> ${ride.destinationAddress || 'Destination'}`);
    
    // Simplified approach - always use the fallback route
    try {
      // Draw a simple line between points
      drawFallbackRoute(map);
    } catch (error) {
      console.error("Error setting up route:", error);
    }
    
    // Function to draw a fallback route as a simple polyline
    function drawFallbackRoute(map: L.Map) {
      console.warn("Using fallback route visualization");
      
      // Draw a simple line between points
      const routePoints = ride.status === 'started'
        ? [
            [driverLocation.latitude, driverLocation.longitude],
            [ride.destinationLocation.latitude, ride.destinationLocation.longitude]
          ]
        : [
            [driverLocation.latitude, driverLocation.longitude],
            [ride.pickupLocation.latitude, ride.pickupLocation.longitude]
          ];
      
      L.polyline(routePoints as L.LatLngExpression[], {
        color: '#3388ff',
        weight: 4,
        opacity: 0.7
      }).addTo(map);
      
      // Calculate straight-line distance
      const distance = ride.status === 'started'
        ? calculateDistance(
            driverLocation.latitude,
            driverLocation.longitude,
            ride.destinationLocation.latitude,
            ride.destinationLocation.longitude
          )
        : calculateDistance(
            driverLocation.latitude,
            driverLocation.longitude,
            ride.pickupLocation.latitude,
            ride.pickupLocation.longitude
          );
      
      setEstimatedDistance(Math.round(distance * 100) / 100);
      
      // Estimate time based on average speed of 30 mph
      const timeInMinutes = Math.round(distance / 30 * 60);
      setEstimatedTime(timeInMinutes);
    }
    
    // Fit the map to include all markers
    const bounds = L.latLngBounds(
      [ride.pickupLocation.latitude, ride.pickupLocation.longitude],
      [ride.destinationLocation.latitude, ride.destinationLocation.longitude]
    );
    bounds.extend([driverLocation.latitude, driverLocation.longitude]);
    map.fitBounds(bounds, { padding: [30, 30] });
    
  }, [ride, driverLocation]);
  
  // Update driver marker position when location changes
  useEffect(() => {
    if (!leafletMap.current || !driverMarker.current) return;
    
    // Update driver marker position
    driverMarker.current.setLatLng([driverLocation.latitude, driverLocation.longitude]);
    
  }, [driverLocation]);

  return (
    <div className={`relative rounded-lg overflow-hidden shadow-md ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
          <div className="flex flex-col items-center">
            <span className="animate-spin h-8 w-8 mb-2 rounded-full border-4 border-blue-500 border-t-transparent"></span>
            <span className="text-blue-600 text-sm font-medium">Loading map...</span>
          </div>
        </div>
      )}
      
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-10">
          <span className="text-red-600 text-sm p-3 text-center">{mapError}</span>
        </div>
      )}
      
      {/* Map container with responsive height */}
      <div 
        ref={mapRef} 
        className="w-full h-48 sm:h-64 md:h-80 mobile-map-container transition-all duration-300"
      ></div>
      
      {estimatedTime !== null && estimatedDistance !== null && (
        <div className="absolute bottom-0 left-0 right-0 bg-white bg-opacity-95 backdrop-blur-sm px-3 py-2.5 text-xs sm:text-sm flex justify-between items-center shadow-inner">
          <div className="flex items-center">
            <span className="text-blue-500 mr-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </span>
            <span className="font-medium">Distance:</span> 
            <span className="ml-1">{estimatedDistance} miles</span>
          </div>
          <div className="flex items-center">
            <span className="text-blue-500 mr-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </span>
            <span className="font-medium">ETA:</span> 
            <span className="ml-1">{estimatedTime} min</span>
          </div>
        </div>
      )}
      
      {/* Mobile control overlay */}
      <div className="absolute top-2 right-2 z-20">
        <button 
          onClick={() => {
            if (leafletMap.current) {
              // Re-center map on driver's location
              leafletMap.current.setView(
                [driverLocation.latitude, driverLocation.longitude],
                leafletMap.current.getZoom()
              );
            }
          }}
          className="bg-white rounded-full p-2 shadow-md hover:bg-blue-50 transition-colors"
          aria-label="Center on driver"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-700" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default LiveRouteMap;