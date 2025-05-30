
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
      
      // Force an update of the distance calculation each time driver location changes
      calculateAndUpdateDistance();
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
      
      calculateAndUpdateDistance();
    }
    
    // Separate function to calculate and update distance
    function calculateAndUpdateDistance() {
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
      
      // Ensure we never display 0.00 by using a minimum value if distance is too small
      const roundedDistance = Math.max(0.01, Math.round(distance * 100) / 100);
      setEstimatedDistance(roundedDistance);
      
      // Estimate time based on average speed of 30 mph
      const timeInMinutes = Math.round(distance / 30 * 60);
      setEstimatedTime(Math.max(1, timeInMinutes)); // Minimum 1 minute ETA
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
    
    // Recalculate and update distance whenever driver location changes
    const calculateAndUpdateDistance = () => {
      if (!ride.pickupLocation || !ride.destinationLocation) return;
      
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
      
      // Ensure we never display 0.00 by using a minimum value if distance is too small
      const roundedDistance = Math.max(0.01, Math.round(distance * 100) / 100);
      setEstimatedDistance(roundedDistance);
      
      // Estimate time based on average speed of 30 mph
      const timeInMinutes = Math.round(distance / 30 * 60);
      setEstimatedTime(Math.max(1, timeInMinutes)); // Minimum 1 minute ETA
    };
    
    calculateAndUpdateDistance();
  }, [driverLocation, ride]);

  return (
    <div className={`relative rounded-lg overflow-hidden ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
          <span className="text-blue-600">Loading map...</span>
        </div>
      )}
      
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-10">
          <span className="text-red-600">{mapError}</span>
        </div>
      )}
      
      <div ref={mapRef} className="h-64 w-full"></div>
      
      {estimatedTime !== null && estimatedDistance !== null && (
        <div className="absolute bottom-0 left-0 right-0 bg-white bg-opacity-90 p-2 text-xs flex justify-between">
          <div>
            <span className="font-medium">Distance:</span> {estimatedDistance.toFixed(2)} miles
          </div>
          <div>
            <span className="font-medium">ETA:</span> {estimatedTime} min
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveRouteMap;