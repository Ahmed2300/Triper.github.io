import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Play, Square, Navigation, Clock, Phone, AlertCircle, History, CheckCircle, Map } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import LiveRouteMap from "./LiveRouteMap";
import { 
  listenToPendingRides, 
  updateRideRequest, 
  RideRequest, 
  Location, 
  listenToDriverActiveRide, 
  checkDriverActiveRide,
  getDriverRideHistory
} from "@/services/firebaseService";
import { database } from "@/lib/firebase";
import { ref, get, update } from "firebase/database";
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
  const [showMap, setShowMap] = useState(true); // Control for map visibility
  const { toast } = useToast();
  
  // Reference for tracking the location update interval
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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

  // Enhanced location tracking that updates every 5 seconds
  useEffect(() => {
    // Function to get current location
    const updateDriverLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            };
            console.log("Driver location updated:", newLocation);
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
              if (activeRide && activeRide.id) {
                updateRideRequest(activeRide.id, {
                  calculatedMileage: mileage + distance,
                  currentDriverLocation: newLocation
                }).catch(error => {
                  console.error("Error updating ride mileage:", error);
                });
              }
            }
          },
          (error) => {
            console.error('Error getting position:', error);
            toast({
              title: "Location Error",
              description: "Unable to update your location. Some features may not work correctly.",
              variant: "destructive",
            });
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    };
    
    // Get location immediately
    updateDriverLocation();
    
    // Set up interval to update location every 5 seconds
    const intervalId = setInterval(() => {
      updateDriverLocation();
    }, 5000);
    
    // Clean up on component unmount
    return () => {
      clearInterval(intervalId);
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
      // Filter out rides created by the current user (driver)
      // This prevents users from seeing their own ride requests when they switch roles
      const filteredRides = rides.filter(ride => ride.customerId !== driverId);
      
      // If driver's location is available, sort rides by proximity
      if (currentLocation) {
        // Create a copy with distance calculated for each ride
        const ridesWithDistance = filteredRides.map(ride => {
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
        setPendingRides(filteredRides);
      }
    });
    
    return unsubscribe;
  }, [activeRide, currentLocation, driverId]);

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
    setMileage(0);
    setStartLocation(null);
    setIsTracking(false);
  };
  
  // Cancel an accepted ride and return it to pending status
  const cancelAcceptedRide = async () => {
    if (!activeRide || !activeRide.id) {
      toast({
        title: "No Active Ride",
        description: "There is no active ride to cancel.",
        variant: "destructive",
      });
      return;
    }
    
    // Allow cancellation even if status is not exactly 'accepted'
    // This ensures drivers can cancel even if there's a state mismatch
    if (activeRide.status !== 'accepted' && activeRide.status !== 'started') {
      toast({
        title: "Cannot Cancel",
        description: "You can only cancel rides that are in 'accepted' or 'started' status.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Use a loading state while updating
      setIsLoading(true);
      
      // Get a direct reference to the ride in Firebase
      const rideRef = ref(database, `rideRequests/${activeRide.id}`);
      
      // Get the current ride data
      const snapshot = await get(rideRef);
      if (!snapshot.exists()) {
        throw new Error('Ride not found');
      }
      
      // Create an update object that explicitly removes driver fields
      const updates = {
        status: 'pending',
        driverId: null,
        driverName: null,
        driverPhoneNumber: null
      };
      
      // Update the ride directly in Firebase
      await update(rideRef, updates);
      
      // Success message
      toast({
        title: "Ride Cancelled",
        description: "The ride has been returned to the pending rides list.",
      });
      
      // Reset ride state for the driver
      resetRide();
    } catch (error) {
      console.error("Error cancelling ride:", error);
      toast({
        title: "Cancel Failed",
        description: "Could not cancel the ride. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container p-0 md:p-4 max-w-3xl mx-auto">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-4 rounded-lg shadow-md flex items-center justify-between mb-4 text-white">
        <div className="flex items-center">
          <Button variant="ghost" onClick={onBack} className="p-2 mr-2 text-white hover:bg-blue-700/50 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Driver Dashboard</h1>
        </div>
        
        <div className="flex items-center gap-2">
          {hasPhoneNumber && (
            <Badge variant="outline" className="bg-blue-700/30 text-white border-blue-400 px-3 py-1">
              {driverName}
            </Badge>
          )}
          
          <Button variant="ghost" className="rounded-full p-2 bg-blue-700/30 hover:bg-blue-700/50">
            <span className="sr-only">Profile</span>
            <div className="h-6 w-6 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-sm font-medium">
              {driverName ? driverName.charAt(0).toUpperCase() : 'D'}
            </div>
          </Button>
        </div>
      </div>
      
      <div className="space-y-6">
        {/* Driver Info Alert - Show if no phone number */}
        {!hasPhoneNumber && (
          <Alert variant="destructive" className="mb-4 rounded-lg border-red-300 shadow-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>You need to add a phone number before accepting rides.</span>
              <Button 
                variant="outline" 
                size="sm"
                className="bg-white border-red-300 text-red-600 hover:bg-red-50 ml-2"
                onClick={() => setShowPhoneModal(true)}
              >
                <Phone className="h-3 w-3 mr-1" />
                Add Phone
              </Button>
            </AlertDescription>
          </Alert>
        )}
      
        {isLoading ? (
          <Card className="p-8 rounded-xl shadow-lg border-0">
            <div className="flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-muted-foreground font-medium">Loading ride information...</p>
            </div>
          </Card>
        ) : (
          <div>
            {/* Active Ride Card */}
            {activeRide && (
              <Card className="mb-6 rounded-xl shadow-lg border-0 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b">
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center">
                      <Navigation className="h-5 w-5 mr-2 text-blue-600" />
                      Active Ride
                    </CardTitle>
                    <Badge 
                      variant={
                        activeRide.status === 'accepted' ? "outline" : 
                        activeRide.status === 'started' ? "default" : 
                        "secondary"
                      }
                      className={
                        activeRide.status === 'accepted' ? "bg-yellow-100 text-yellow-800 border-yellow-300" :
                        activeRide.status === 'started' ? "bg-green-100 text-green-800 border-green-300" :
                        "bg-blue-100 text-blue-800 border-blue-300"
                      }
                    >
                      {activeRide.status === 'accepted' && <Clock className="h-3 w-3 mr-1" />}
                      {activeRide.status === 'started' && <Play className="h-3 w-3 mr-1" />}
                      {activeRide.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
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
                    
                    {/* Live Route Map */}
                    {activeRide && currentLocation && showMap && (
                      <div className="mt-4 mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-sm font-medium flex items-center gap-2">
                            <Map className="h-4 w-4 text-blue-600" />
                            Live Route
                          </h3>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setShowMap(!showMap)}
                            className="text-xs h-6 px-2"
                          >
                            {showMap ? 'Hide Map' : 'Show Map'}
                          </Button>
                        </div>
                        <LiveRouteMap 
                          ride={activeRide} 
                          driverLocation={currentLocation} 
                          className="rounded-lg overflow-hidden h-64 border border-gray-200"
                        />
                      </div>
                    )}
                    
                    {/* Ride Details */}
                    <div className="grid grid-cols-2 gap-4 mt-4">
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
                          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                            <Button 
                              onClick={startRide}
                              variant="default"
                              className="bg-green-600 hover:bg-green-700 text-white font-medium flex-1"
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Start Trip
                            </Button>
                            <Button 
                              onClick={cancelAcceptedRide}
                              variant="outline"
                              className="border-red-300 text-red-600 hover:bg-red-50 flex-1"
                              disabled={isLoading}
                            >
                              {isLoading ? (
                                <>
                                  <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                                  </svg>
                                  Cancelling...
                                </>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>
                                  Cancel Ride
                                </>
                              )}
                            </Button>
                          </div>
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
                          className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Complete Trip
                        </Button>
                      )}
                      
                      {activeRide.status === 'completed' && (
                        <Button 
                          onClick={resetRide}
                          variant="outline"
                          className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        >
                          <ArrowLeft className="mr-2 h-4 w-4" />
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
                <Card className="rounded-xl shadow-lg border-0 overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b">
                    <CardTitle className="flex items-center">
                      <MapPin className="h-5 w-5 mr-2 text-blue-600" />
                      Available Ride Requests
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pendingRides.length === 0 ? (
                      <div className="text-center py-12 px-4 text-gray-500 bg-gray-50 rounded-lg my-4">
                        <div className="bg-white p-6 rounded-full inline-flex items-center justify-center shadow-sm mb-4">
                          <Clock className="h-10 w-10 text-blue-400" />
                        </div>
                        <p className="font-medium text-lg text-gray-700">No ride requests available</p>
                        <p className="text-sm mt-2 max-w-md mx-auto">When customers request rides, they will appear here. You'll be notified when new ride requests come in.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {pendingRides.map((ride) => (
                          <Card key={ride.id} className="shadow-md rounded-lg border-0 hover:shadow-lg transition-shadow duration-200">
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
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
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
                    <Card className="rounded-xl shadow-lg border-0 overflow-hidden">
                      <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b py-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center text-base">
                            <History className="h-5 w-5 mr-2 text-blue-600" />
                            Ride History
                          </CardTitle>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setShowHistory(!showHistory)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                          >
                            {showHistory ? 'Hide' : 'Show'}
                          </Button>
                        </div>
                      </CardHeader>
                    
                      <CardContent className="p-0">
                        {showHistory && (
                          <div className="space-y-3 p-4">
                            {rideHistory.map((ride) => (
                              <Card key={ride.id} className="p-3 shadow-sm hover:shadow-md transition-shadow duration-200 border-0 bg-white">
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
                      </CardContent>
                    </Card>
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
