import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Play, Square, Navigation, Clock, Phone, AlertCircle, History, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  listenToPendingRides, 
  updateRideRequest, 
  RideRequest, 
  Location, 
  listenToDriverActiveRide, 
  checkDriverActiveRide,
  getDriverRideHistory
} from "@/services/firebaseService";
import { calculateEstimatedPrice, formatPrice } from "@/utils/priceCalculator";
import PhoneVerificationModal from "./PhoneVerificationModal";
import CallButton from "./CallButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { setUserPhoneNumber, getCurrentUser, updateUserData } from "@/services/authService";
import { savePhoneNumber, getPhoneNumber, hasStoredPhoneNumber } from "@/services/phoneStorage";

interface DriverInterfaceProps {
  onBack: () => void;
}

const DriverInterface = ({ onBack }: DriverInterfaceProps) => {
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [pendingRides, setPendingRides] = useState<RideRequest[]>([]);
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);
  const [mileage, setMileage] = useState(0);
  const [startLocation, setStartLocation] = useState<Location | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [hasPhoneNumber, setHasPhoneNumber] = useState(false);
  const [userPhoneNumber, setUserPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [rideHistory, setRideHistory] = useState<RideRequest[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();
  
  // Get authenticated user from Firebase Auth
  const [driverId, setDriverId] = useState<string>("");
  const [driverName, setDriverName] = useState<string>("");
  
  // Get user info from Firebase Auth on component mount
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setDriverId(user.uid);
      setDriverName(user.displayName || "Driver User");
    } else {
      // Fallback to local storage if not authenticated (should not happen with our new flow)
      const savedId = localStorage.getItem('driverId');
      if (savedId) {
        setDriverId(savedId);
      } else {
        const newId = `driver_${Date.now()}`;
        localStorage.setItem('driverId', newId);
        setDriverId(newId);
      }
      
      const savedName = localStorage.getItem('driverName');
      setDriverName(savedName || "Driver User");
    }
  }, []);

  useEffect(() => {
    // Get current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          toast({
            title: "Location Error",
            description: "Could not get your current location. Please enable location services.",
            variant: "destructive",
          });
        }
      );
    }
    
    // Start watching position
    let watchId: number;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          
          setCurrentLocation(newLocation);
          
          // If we're actively tracking a ride, update the mileage
          if (isTracking && startLocation) {
            const distance = calculateDistance(
              startLocation.latitude,
              startLocation.longitude,
              newLocation.latitude,
              newLocation.longitude
            );
            
            setMileage(prevMileage => prevMileage + distance);
            
            // If we have an active ride, update its calculated mileage
            if (activeRide) {
              updateRideRequest(activeRide.id as string, {
                calculatedMileage: mileage + distance,
                currentDriverLocation: newLocation
              });
            }
          }
        },
        (error) => {
          console.error('Error watching position:', error);
        },
        { enableHighAccuracy: true }
      );
    }
    
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isTracking, startLocation, mileage, activeRide, toast]);
  
  useEffect(() => {
    if (!driverId) return;
    
    const checkForActiveRide = async () => {
      setIsLoading(true);
      try {
        const ride = await checkDriverActiveRide(driverId);
        if (ride) {
          setActiveRide(ride);
          
          // If the ride is in progress, start tracking
          if (ride.status === 'started') {
            setIsTracking(true);
            setStartLocation(ride.startTripLocation || null);
            setMileage(ride.calculatedMileage || 0);
          }
        }
        
        // Get ride history
        const history = await getDriverRideHistory(driverId);
        setRideHistory(history);
      } catch (error) {
        console.error("Error checking for active ride:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkForActiveRide();
  }, [driverId, toast]);

  // Listen to active ride updates
  useEffect(() => {
    const unsubscribe = listenToDriverActiveRide(driverId, (ride) => {
      setActiveRide(ride);
      
      // If the ride is completed, stop tracking
      if (ride?.status === 'completed') {
        setIsTracking(false);
        setStartLocation(null);
        
        toast({
          title: "Ride Completed",
          description: `Trip completed! Total distance: ${ride.calculatedMileage.toFixed(2)} miles.`,
        });
        
        // Refresh ride history
        getDriverRideHistory(driverId).then(history => {
          setRideHistory(history);
        });
      }
    });
    
    return unsubscribe;
  }, [driverId, toast]);

  // Listen to pending rides when there's no active ride
  useEffect(() => {
    // Only listen to pending rides if the driver doesn't have an active ride
    // or if the active ride is completed
    if (activeRide && ['accepted', 'started'].includes(activeRide.status)) {
      setPendingRides([]);
      return () => {};
    }
    
    const unsubscribe = listenToPendingRides((rides) => {
      // If driver's location is available, sort rides by proximity
      if (currentLocation) {
        // Create a copy with distance calculated for each ride
        const ridesWithDistance = rides.map(ride => {
          const distance = ride.pickupLocation ? 
            calculateDistance(
              currentLocation.latitude,
              currentLocation.longitude,
              ride.pickupLocation.latitude,
              ride.pickupLocation.longitude
            ) : Infinity;
          
          return { ...ride, _distance: distance };
        });
        
        // Sort by distance (ascending - closest first)
        ridesWithDistance.sort((a, b) => {
          return (a._distance || Infinity) - (b._distance || Infinity);
        });
        
        // Remove the temporary distance property before setting state
        setPendingRides(ridesWithDistance.map(({ _distance, ...ride }) => ride));
      } else {
        // If no location yet, just use the unsorted list
        setPendingRides(rides);
      }
    });
    
    return unsubscribe;
  }, [activeRide, currentLocation]);

  // Check for existing phone number in local storage or Firebase on component mount
  useEffect(() => {
    const checkPhoneNumber = async () => {
      if (!driverId) return;
      
      try {
        const hasPhone = await hasStoredPhoneNumber(driverId);
        setHasPhoneNumber(hasPhone);
        
        if (hasPhone) {
          const phone = await getPhoneNumber(driverId);
          setUserPhoneNumber(phone || "");
        } else {
          // If no phone number, prompt user to add one
          setShowPhoneModal(true);
        }
      } catch (error) {
        console.error("Error checking phone number:", error);
      }
    };
    
    checkPhoneNumber();
  }, [driverId]);

  // Handle phone number submission from the modal
  const handlePhoneSubmit = async (phoneNumber: string) => {
    try {
      if (driverId) {
        // Save phone number to Firebase and local storage
        await savePhoneNumber(driverId, phoneNumber, 'driver');
        
        // Update user profile as well
        await updateUserData(driverId, { 
          phoneNumber, 
          phoneVerified: true 
        });
        
        setUserPhoneNumber(phoneNumber);
        setHasPhoneNumber(true);
        setShowPhoneModal(false);
        
        toast({
          title: "Phone Saved",
          description: "Your phone number has been saved.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error saving phone number:", error);
      toast({
        title: "Error",
        description: "Could not save phone number. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Helper function to calculate distance between two coordinates (in miles)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    // Approximate radius of earth in miles
    const R = 3958.8;
    
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in miles
    
    return distance;
  };

  // Accept a ride request
  const acceptRide = async (ride: RideRequest) => {
    if (!driverId || !driverName) {
      toast({
        title: "Account Required",
        description: "Please sign in to accept rides.",
        variant: "destructive",
      });
      return;
    }
    
    if (!hasPhoneNumber) {
      toast({
        title: "Phone Required",
        description: "You must add a phone number before accepting rides.",
        variant: "destructive",
      });
      setShowPhoneModal(true);
      return;
    }
    
    try {
      // Update the ride status to accepted
      const updatedRide: Partial<RideRequest> = {
        status: 'accepted' as const,
        driverId,
        driverName,
        driverPhoneNumber: userPhoneNumber,
      };
      
      await updateRideRequest(ride.id as string, updatedRide);
      setActiveRide({...ride, ...updatedRide});
      
      toast({
        title: "Ride Accepted",
        description: "You have accepted this ride request.",
      });
    } catch (error) {
      console.error("Error accepting ride:", error);
      toast({
        title: "Accept Failed",
        description: "Could not accept the ride. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Start a ride that has been accepted
  const startRide = async () => {
    if (!activeRide || !activeRide.id || activeRide.status !== 'accepted') {
      toast({
        title: "Cannot Start Ride",
        description: "This ride cannot be started right now.",
        variant: "destructive",
      });
      return;
    }
    
    if (!currentLocation) {
      toast({
        title: "Location Required",
        description: "Cannot start the ride without your current location.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if driver is close enough to the pickup location
    if (activeRide.pickupLocation) {
      const distanceToPickup = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        activeRide.pickupLocation.latitude,
        activeRide.pickupLocation.longitude
      );
      
      // Define a threshold distance (in miles) that is considered "at pickup location"
      // 0.1 miles is approximately 160 meters or about 525 feet
      const PICKUP_PROXIMITY_THRESHOLD = 0.1;
      
      if (distanceToPickup > PICKUP_PROXIMITY_THRESHOLD) {
        toast({
          title: "Too Far From Pickup",
          description: `You must be within ${(PICKUP_PROXIMITY_THRESHOLD * 5280).toFixed(0)} feet of the pickup location to start the trip. Current distance: ${(distanceToPickup * 5280).toFixed(0)} feet.`,
          variant: "destructive",
        });
        return;
      }
    }
    
    try {
      // Start trip location will be used to calculate total distance
      setStartLocation(currentLocation);
      setIsTracking(true);
      setMileage(0); // Reset mileage for new trip
      
      // Update the ride status to started
      const updatedRide: Partial<RideRequest> = {
        status: 'started' as const,
        startTime: Date.now(),
        startTripLocation: currentLocation,
        calculatedMileage: 0,
      };
      
      await updateRideRequest(activeRide.id, updatedRide);
      setActiveRide({...activeRide, ...updatedRide});
      
      toast({
        title: "Ride Started",
        description: "The ride has been started. Drive safely!",
      });
    } catch (error) {
      console.error("Error starting ride:", error);
      toast({
        title: "Start Failed",
        description: "Could not start the ride. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Complete a ride that is in progress
  const completeRide = async () => {
    if (!activeRide || !activeRide.id || activeRide.status !== 'started') {
      toast({
        title: "Cannot Complete Ride",
        description: "This ride cannot be completed right now.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Stop tracking
      setIsTracking(false);
      
      // Update the ride status to completed
      const updatedRide: Partial<RideRequest> = {
        status: 'completed' as const,
        endTime: Date.now(),
        calculatedMileage: mileage,
      };
      
      await updateRideRequest(activeRide.id, updatedRide);
      setActiveRide({...activeRide, ...updatedRide});
      
      toast({
        title: "Ride Completed",
        description: `Trip completed! Total distance: ${mileage.toFixed(2)} miles.`,
      });
      
      // Get updated ride history
      const history = await getDriverRideHistory(driverId);
      setRideHistory(history);
    } catch (error) {
      console.error("Error completing ride:", error);
      toast({
        title: "Completion Failed",
        description: "Could not complete the ride. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Reset active ride state
  const resetRide = () => {
    setActiveRide(null);
    setStartLocation(null);
    setIsTracking(false);
    setMileage(0);
  };

  return (
    <div className="container p-0 md:p-4 max-w-3xl mx-auto">
      <div className="bg-white p-4 flex items-center mb-4">
        <Button variant="ghost" onClick={onBack} className="p-2 mr-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Driver View</h1>
      </div>
      
      <div className="space-y-6">
        {/* Driver Info Alert - Show if no phone number */}
        {!hasPhoneNumber && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You need to add a phone number before accepting rides.{" "}
              <Button 
                variant="link" 
                className="p-0 h-auto text-red-800 underline"
                onClick={() => setShowPhoneModal(true)}
              >
                Add Phone Number
              </Button>
            </AlertDescription>
          </Alert>
        )}
      
        {isLoading ? (
          <Card className="p-8">
            <div className="flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
              <p className="text-muted-foreground">Loading ride information...</p>
            </div>
          </Card>
        ) : (
          <div>
            {/* Active Ride Card */}
            {activeRide && (
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Active Ride</CardTitle>
                    <Badge 
                      variant={
                        activeRide.status === 'accepted' ? "outline" : 
                        activeRide.status === 'started' ? "default" : 
                        "secondary"
                      }
                    >
                      {activeRide.status.charAt(0).toUpperCase() + activeRide.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Customer Info */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Customer</p>
                        <p className="font-medium">{activeRide.customerName || 'Customer'}</p>
                      </div>
                      
                      {activeRide.customerPhoneNumber && (
                        <CallButton 
                          phoneNumber={activeRide.customerPhoneNumber} 
                          recipientName={activeRide.customerName || "Customer"}
                          size="sm"
                        />
                      )}
                    </div>
                    
                    <Separator />
                    
                    {/* Locations */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Pickup Location</p>
                          <p>{activeRide.pickupAddress}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <MapPin className="h-5 w-5 text-red-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Destination</p>
                          <p>{activeRide.destinationAddress}</p>
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Ride Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Price</p>
                        <p className="font-medium">{formatPrice(activeRide.estimatedPrice || 0)}</p>
                      </div>
                      
                      {activeRide.status === 'started' && (
                        <div>
                          <p className="text-sm text-gray-500">Distance</p>
                          <p className="font-medium">{mileage.toFixed(2)} miles</p>
                        </div>
                      )}
                      
                      {activeRide.startTime && (
                        <div>
                          <p className="text-sm text-gray-500">Start Time</p>
                          <p className="font-medium">{new Date(activeRide.startTime).toLocaleTimeString()}</p>
                        </div>
                      )}
                      
                      {activeRide.endTime && (
                        <div>
                          <p className="text-sm text-gray-500">End Time</p>
                          <p className="font-medium">{new Date(activeRide.endTime).toLocaleTimeString()}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-2 mt-2">
                      {activeRide.status === 'accepted' && (
                        <div className="flex flex-col w-full">
                          <Button 
                            onClick={startRide}
                            variant="default"
                          >
                            <Play className="mr-2 h-4 w-4" />
                            Start Trip
                          </Button>
                          {currentLocation && activeRide.pickupLocation && (
                            <p className="text-xs text-gray-500 mt-1 text-center">
                              You must be at the pickup location to start the trip. 
                              Current distance: {(calculateDistance(
                                currentLocation.latitude,
                                currentLocation.longitude,
                                activeRide.pickupLocation.latitude,
                                activeRide.pickupLocation.longitude
                              ) * 5280).toFixed(0)} feet
                            </p>
                          )}
                        </div>
                      )}
                      
                      {activeRide.status === 'started' && (
                        <Button 
                          onClick={completeRide}
                          variant="default"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Complete Trip
                        </Button>
                      )}
                      
                      {activeRide.status === 'completed' && (
                        <Button 
                          onClick={resetRide}
                          variant="outline"
                        >
                          Back to Ride List
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Pending Rides Section - only show if no active ride or active ride is completed */}
            {(!activeRide || activeRide.status === 'completed') && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Available Ride Requests</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pendingRides.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Clock className="mx-auto h-8 w-8 mb-2 text-gray-400" />
                        <p>No ride requests available at the moment</p>
                        <p className="text-sm mt-1">When customers request rides, they will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {pendingRides.map((ride) => (
                          <Card key={ride.id} className="shadow-sm">
                            <CardContent className="p-4">
                              <div className="flex flex-col space-y-3">
                                <div className="flex justify-between items-start">
                                  <div className="font-medium">{ride.customerName || 'Customer'}</div>
                                  <Badge variant="outline" className="text-xs">
                                    {new Date(ride.requestTime).toLocaleTimeString()}
                                  </Badge>
                                </div>
                                
                                <div className="space-y-1">
                                  <div className="flex items-start gap-2">
                                    <MapPin className="h-4 w-4 text-blue-500 mt-0.5" />
                                    <div className="flex-1">
                                      <div className="flex justify-between items-center">
                                        <p className="text-xs text-gray-500">Pickup</p>
                                        {currentLocation && ride.pickupLocation && (
                                          <Badge variant="outline" className="ml-1 text-xs bg-blue-50">
                                            <Navigation className="h-3 w-3 mr-1 text-blue-500" />
                                            {calculateDistance(
                                              currentLocation.latitude,
                                              currentLocation.longitude,
                                              ride.pickupLocation.latitude,
                                              ride.pickupLocation.longitude
                                            ).toFixed(1)} mi
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm">{ride.pickupAddress || "Customer Location"}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <MapPin className="h-4 w-4 text-red-500 mt-0.5" />
                                    <div>
                                      <p className="text-xs text-gray-500">Destination</p>
                                      <p className="text-sm">{ride.destinationAddress}</p>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex justify-between items-center pt-2">
                                  <div>
                                    <p className="text-xs text-gray-500">Est. Price</p>
                                    <p className="font-medium">{formatPrice(ride.estimatedPrice || 0)}</p>
                                  </div>
                                  <Button 
                                    size="sm"
                                    onClick={() => acceptRide(ride)}
                                    disabled={!hasPhoneNumber}
                                  >
                                    Accept Ride
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Ride History Section */}
                {rideHistory.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Ride History
                      </h3>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowHistory(!showHistory)}
                      >
                        {showHistory ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                    
                    {showHistory && (
                      <div className="space-y-3 mt-2">
                        {rideHistory.map((ride) => (
                          <Card key={ride.id} className="p-3 shadow-sm">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">{new Date(ride.requestTime).toLocaleString()}</p>
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-medium">To:</span> {ride.destinationAddress}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="secondary">
                                    {ride.status}
                                  </Badge>
                                  {ride.calculatedMileage && (
                                    <span className="text-sm">
                                      {ride.calculatedMileage.toFixed(2)} miles
                                    </span>
                                  )}
                                </div>
                              </div>
                              {ride.status === 'completed' && ride.estimatedPrice && (
                                <div className="text-right">
                                  <p className="font-bold">{formatPrice(ride.estimatedPrice)}</p>
                                </div>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Phone verification modal */}
      <PhoneVerificationModal
        isOpen={showPhoneModal}
        onClose={() => setShowPhoneModal(false)}
        onSubmit={handlePhoneSubmit}
      />
    </div>
  );
};

export default DriverInterface;
