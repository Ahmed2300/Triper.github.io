import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Clock, Car, Phone, AlertCircle, History, CheckCircle, MapIcon, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DestinationSearch from "./DestinationSearch";
import OpenStreetMapPicker from "./OpenStreetMapPicker";
import { 
  listenToCustomerActiveRide, 
  listenToAllCustomerRides, 
  createRideRequest, 
  cancelRide, 
  updateRideRequest, 
  checkCustomerActiveRide,
  getCustomerRideHistory,
  RideRequest, 
  Location 
} from "@/services/firebaseService";
import { calculateEstimatedPrice, formatPrice } from "@/utils/priceCalculator";
import PhoneVerificationModal from "./PhoneVerificationModal";
import CallButton from "./CallButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { getAddressFromLocation } from "@/services/locationService";
import { setUserPhoneNumber, getCurrentUser, updateUserData } from "@/services/authService";
import { getPhoneNumber, hasStoredPhoneNumber, savePhoneNumber } from "@/services/phoneStorage";

interface CustomerInterfaceProps {
  onBack: () => void;
}

const CustomerInterface = ({ onBack }: CustomerInterfaceProps) => {
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<{ location: Location; address: string } | null>(null);
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [isInitialSearch, setIsInitialSearch] = useState(true); // To track if it's the first search result
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [hasPhoneNumber, setHasPhoneNumber] = useState(false);
  const [userPhoneNumber, setUserPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [rideHistory, setRideHistory] = useState<RideRequest[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [manualPrice, setManualPrice] = useState<string>("25.00"); // Default price
  const [cancellingRide, setCancellingRide] = useState(false);
  const { toast } = useToast();
  
  // Get authenticated user from Firebase Auth
  const [customerId, setCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setCustomerId(user.uid);
      setCustomerName(user.displayName || "Customer User");
    } else {
      const savedId = localStorage.getItem('customerId');
      if (savedId) {
        setCustomerId(savedId);
      } else {
        const newId = `customer_${Date.now()}`;
        localStorage.setItem('customerId', newId);
        setCustomerId(newId);
      }
    }
  }, []);

  // Get current location with fallback options
  useEffect(() => {
    // First try to get a cached location from localStorage if available
    const cachedLocation = localStorage.getItem('lastKnownLocation');
    if (cachedLocation) {
      try {
        const location = JSON.parse(cachedLocation);
        console.log("Using cached location:", location);
        setCurrentLocation(location);
      } catch (error) {
        console.error("Error parsing cached location:", error);
      }
    }
    
    // Then try to get the current location
    if (navigator.geolocation) {
      const geoOptions = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      };
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          console.log("Got current location:", newLocation);
          setCurrentLocation(newLocation);
          
          // Cache the location for future use
          localStorage.setItem('lastKnownLocation', JSON.stringify(newLocation));
        },
        (error) => {
          console.error("Error getting location:", error);
          
          // If we don't have a cached location either, use a default location (Egypt)
          if (!cachedLocation) {
            const defaultLocation = {
              latitude: 30.0444,
              longitude: 31.2357
            };
            console.log("Using default location (Cairo, Egypt):", defaultLocation);
            setCurrentLocation(defaultLocation);
            toast({
              title: "Location Notice",
              description: "Using default location in Egypt. You can still request a ride.",
              variant: "default",
            });
          } else {
            toast({
              title: "Location Note",
              description: "Using your last known location. Location updates are not available.",
              variant: "default",
            });
          }
        },
        geoOptions
      );
    } else {
      // Browser doesn't support geolocation
      const defaultLocation = {
        latitude: 30.0444,
        longitude: 31.2357
      };
      console.log("Geolocation not supported, using default location:", defaultLocation);
      setCurrentLocation(defaultLocation);
      toast({
        title: "Location Not Supported",
        description: "Your browser doesn't support geolocation. Using default location in Egypt.",
        variant: "default",
      });
    }
  }, [toast]);

  useEffect(() => {
    const checkForActiveRide = async () => {
      setIsLoading(true);
      try {
        const activeRide = await checkCustomerActiveRide(customerId);
        
        if (activeRide) {
          setActiveRide(activeRide);
          setCurrentRideId(activeRide.id || null);
          console.log("Found active ride:", activeRide);
        }
        
        const history = await getCustomerRideHistory(customerId);
        setRideHistory(history);
      } catch (error) {
        console.error("Error checking for active rides:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (customerId) {
      checkForActiveRide();
    }
  }, [customerId, toast]);

  // Save active ride to localStorage to persist between refreshes
  useEffect(() => {
    if (activeRide) {
      localStorage.setItem('activeRide', JSON.stringify(activeRide));
      localStorage.setItem('currentRideId', activeRide.id || '');
    }
  }, [activeRide]);

  // Load active ride from localStorage on component mount
  useEffect(() => {
    const savedRide = localStorage.getItem('activeRide');
    const savedRideId = localStorage.getItem('currentRideId');
    
    if (savedRide && savedRideId) {
      try {
        const parsedRide = JSON.parse(savedRide);
        // Only restore if the ride belongs to this customer
        if (parsedRide.customerId === customerId) {
          setActiveRide(parsedRide);
          setCurrentRideId(savedRideId);
        }
      } catch (e) {
        console.error('Error parsing saved ride:', e);
      }
    }
  }, [customerId]);

  // Listen for ride updates from Firebase
  useEffect(() => {
    if (!customerId) return;
    
    // Listen to ALL rides for this customer, including active and recently completed ones
    const unsubscribe = listenToAllCustomerRides(customerId, (rides) => {
      console.log("Rides update from Firebase:", rides);
      
      if (rides.length === 0) {
        // No rides found, clear everything
        resetRide();
        return;
      }
      
      // Find active rides first (pending, accepted, started)
      const activeRides = rides.filter(ride => 
        ['pending', 'accepted', 'started'].includes(ride.status));
      
      if (activeRides.length > 0) {
        // Use the first active ride (should only be one)
        const currentRide = activeRides[0];
        setActiveRide(currentRide);
        setCurrentRideId(currentRide.id || null);
        return;
      }
      
      // If no active rides, check for recently completed rides (within last 5 minutes)
      const now = Date.now();
      const fiveMinutesAgo = now - (5 * 60 * 1000);
      
      const recentlyCompletedRides = rides
        .filter(ride => ride.status === 'completed' && ride.endTime && ride.endTime > fiveMinutesAgo)
        .sort((a, b) => (b.endTime || 0) - (a.endTime || 0));
      
      if (recentlyCompletedRides.length > 0) {
        // Show the most recently completed ride briefly
        const completedRide = recentlyCompletedRides[0];
        setActiveRide(completedRide);
        setCurrentRideId(completedRide.id || null);
        
        // After a short delay, clear the completed ride
        setTimeout(() => {
          toast({
            title: "Trip Completed",
            description: "Your trip has been completed successfully."
          });
          resetRide();
        }, 5000); // Show completion status for 5 seconds before resetting
      } else {
        // No active or recently completed rides
        resetRide();
      }
    });
    
    return () => unsubscribe();
  }, [customerId]);

  useEffect(() => {
    const checkPhoneNumber = async () => {
      try {
        // Check if we have a phone number saved in localStorage first
        const hasPhone = await hasStoredPhoneNumber(customerId);
        if (hasPhone) {
          const phone = await getPhoneNumber(customerId);
          setUserPhoneNumber(phone || "");
          setHasPhoneNumber(true);
          return;
        }
        
        // If not in localStorage, check Firebase user data
        const user = getCurrentUser();
        if (user && user.phoneNumber) {
          setUserPhoneNumber(user.phoneNumber);
          setHasPhoneNumber(true);
          savePhoneNumber(user.phoneNumber); // Save to local storage for future
        } else {
          setHasPhoneNumber(false);
        }
      } catch (error) {
        console.error("Error checking phone number:", error);
        toast.error({ title: "Error", description: "Error verifying phone number" });
      }
    };
    checkPhoneNumber();
  }, [toast]);

  const handlePhoneSubmit = async (phoneNumber: string) => {
    try {
      setIsLoading(true);
      // Save phone number
      await savePhoneNumber(phoneNumber);
      
      // If Firebase user exists, update their phone number
      const user = getCurrentUser();
      if (user) {
        await setUserPhoneNumber(user.uid, phoneNumber);
        await updateUserData(user.uid, { phoneNumber });
      }
      
      setUserPhoneNumber(phoneNumber);
      setHasPhoneNumber(true);
      setShowPhoneModal(false);
      
      toast({
        title: "Success", 
        description: "Phone number added successfully!"
      });
    } catch (error) {
      console.error("Error saving phone number:", error);
      toast({
        title: "Error", 
        description: "Failed to save phone number.", 
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const requestRide = async () => {
    console.log("Request ride initiated with destination:", selectedDestination);
    console.log("Current location:", currentLocation);
    
    // More robust validation with detailed logging
    if (!selectedDestination) {
      console.error("Missing destination");
      toast({
        title: "Missing Information",
        description: "Please select a destination",
        variant: "destructive"
      });
      return;
    }
    
    if (!currentLocation) {
      console.error("Missing current location");
      toast({
        title: "Missing Information",
        description: "Unable to determine your current location",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Check if there's already an active ride
      const existingRide = await checkCustomerActiveRide(customerId);
      if (existingRide && (existingRide.status === 'pending' || existingRide.status === 'accepted' || existingRide.status === 'started')) {
        toast({
          title: "Active Ride Found",
          description: "You already have an active ride in progress.",
          variant: "destructive"
        });
        setActiveRide(existingRide);
        setCurrentRideId(existingRide.id || null);
        setIsLoading(false);
        return;
      }
      
      // Validate price
      const price = parseFloat(manualPrice);
      if (isNaN(price) || price <= 0) {
        toast({
          title: "Invalid Price", 
          description: "Please enter a valid price for the trip.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }
      
      // Get the pickup address using reverse geocoding
      let pickupAddress = "Current Location";
      try {
        pickupAddress = await getAddressFromLocation(currentLocation);
        console.log("Pickup address resolved:", pickupAddress);
      } catch (error) {
        console.error("Error getting pickup address:", error);
        // Continue with the default address if reverse geocoding fails
      }
      
      // Create ride request
      const request: Omit<RideRequest, "id" | "requestTime" | "status" | "calculatedMileage"> = {
        customerId,
        customerName: customerName || "Customer",
        customerPhoneNumber: userPhoneNumber,
        pickupLocation: currentLocation,
        pickupAddress: pickupAddress, // Include the resolved pickup address
        destinationLocation: selectedDestination.location,
        destinationAddress: selectedDestination.address,
        estimatedPrice: price,
      };
      
      console.log("Creating ride request with data:", request);
      const rideId = await createRideRequest(request);
      console.log("Ride created with ID:", rideId);
      
      // Immediately create a pending ride object to show in UI while we wait for Firebase listener
      const newRide: RideRequest = {
        ...request,
        id: rideId,
        requestTime: new Date().toISOString(),
        status: 'pending',
        calculatedMileage: 0
      };
      
      // Update both states
      setCurrentRideId(rideId);
      setActiveRide(newRide);
      
      toast({
        title: "Ride Requested", 
        description: "Your ride request has been sent to nearby drivers."
      });
      
      // Reset UI states
      setShowMapSelector(false);
    } catch (error) {
      console.error("Error requesting ride:", error);
      toast({
        title: "Request Failed", 
        description: "Could not create ride request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetRide = () => {
    // Clear local storage to ensure the ride doesn't come back
    localStorage.removeItem('activeRide');
    localStorage.removeItem('currentRideId');
    
    // Reset all states
    setSelectedDestination(null);
    setCurrentRideId(null);
    setActiveRide(null);
    setShowMapSelector(false);
    setIsInitialSearch(true);
    
    // Force page refresh to ensure clean state
    console.log('Ride reset complete');
  };
  
  // Cancel a pending or accepted ride
  const handleCancelRide = async () => {
    if (!activeRide || !activeRide.id) {
      toast({
        title: "Error", 
        description: "No active ride to cancel",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setCancellingRide(true);
      await cancelRide(activeRide.id);
      
      toast({
        title: "Ride Cancelled", 
        description: "Your ride has been cancelled successfully."
      });
      
      // Reset states
      setActiveRide(null);
      setCurrentRideId(null);
      // Optionally reset destination too
      setSelectedDestination(null);
    } catch (error) {
      console.error("Error cancelling ride:", error);
      toast({
        title: "Error", 
        description: "Failed to cancel ride. Please try again.",
        variant: "destructive"
      });
    } finally {
      setCancellingRide(false);
    }
  };

  const getStatusText = () => {
    if (!activeRide) return "";
    
    switch (activeRide.status) {
      case "pending":
        return "Waiting for a driver";
      case "accepted":
        return `${activeRide.driverName || "Driver"} is on the way`;
      case "started":
        return "Trip in progress";
      case "completed":
        return "Trip completed";
      case "cancelled":
        return "Trip cancelled";
      default:
        return activeRide.status;
    }
  };

  const getStatusColor = () => {
    if (!activeRide) return "default";
    
    switch (activeRide.status) {
      case "pending":
        return "secondary";
      case "accepted":
        return "default"; // Using default instead of blue
      case "started":
        return "default"; // Using default instead of green
      case "completed":
        return "default";
      case "cancelled":
        return "destructive";
      default:
        return "default";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white relative">
      {/* Enhanced Header with better navigation */}
      <div className="bg-white p-4 shadow-md flex items-center justify-between sticky top-0 z-50 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="rounded-full hover:bg-blue-50 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-blue-700" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-blue-900">Customer Dashboard</h1>
            <p className="text-xs text-gray-500">Book and manage your rides</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {activeRide && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-medium">
              {getStatusText()}
            </Badge>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowHistory(!showHistory)}
            className="rounded-full flex items-center gap-1 text-xs border-blue-200 hover:bg-blue-50 hover:text-blue-700 transition-all"
          >
            <History className="h-3.5 w-3.5" />
            {showHistory ? 'Current' : 'History'}
          </Button>
        </div>
      </div>
      
      <div className="space-y-4">
        {/* Phone verification alert */}
        {!hasPhoneNumber && (
          <Alert variant="default" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You need to add a phone number to use the full features of this app
            </AlertDescription>
          </Alert>
        )}
        
        {activeRide?.status === 'completed' && (
          <Card className="mb-4 bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <div className="bg-green-100 p-2 rounded-full">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                Trip Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-green-700">
                Your trip has been completed successfully. Total distance: {activeRide.calculatedMileage?.toFixed(2) || "0"} miles.
              </p>
              <Button
                variant="outline" 
                className="w-full mt-4"
                onClick={resetRide}
              >
                Start New Trip
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* Only show destination selection when there's no active ride */}
        {(!activeRide || activeRide.status === 'completed' || activeRide.status === 'cancelled') && !isLoading && (
          <div className="space-y-6">
            {!selectedDestination && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Where would you like to go?</CardTitle>
                </CardHeader>
                <CardContent>
                  <DestinationSearch 
                    currentLocation={currentLocation} 
                    onSelectDestination={(destination) => {
                      setSelectedDestination(destination);
                      setShowMapSelector(true); // Show map selector after destination selection
                      setIsInitialSearch(true);
                    }}
                  />
                </CardContent>
              </Card>
            )}
            
            {selectedDestination && (
              <div className="max-w-md mx-auto p-4 space-y-6">
                <Card className="bg-white shadow-lg border-0 overflow-hidden rounded-xl">
                  <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                    <CardTitle className="text-xl font-bold text-blue-800 flex items-center gap-2">
                      <Car className="h-5 w-5 text-blue-600" />
                      Request a Ride
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    {!selectedDestination ? (
                      <div className="space-y-5">
                        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <div className="bg-white p-2 rounded-full shadow-sm">
                            <MapPin className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <span className="font-medium text-blue-900">Where would you like to go?</span>
                            <p className="text-xs text-blue-700">Search for your destination below</p>
                          </div>
                        </div>
                        
                        <DestinationSearch 
                          onSelectDestination={(destination) => {
                            setSelectedDestination(destination);
                            setShowMapSelector(true);
                          }}
                          onInitialSearch={() => setIsInitialSearch(false)}
                          isInitialSearch={isInitialSearch}
                        />
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                          <div className="bg-white p-2 rounded-full shadow-sm mt-1">
                            <MapPin className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-blue-900">Destination</div>
                            <div className="text-sm text-gray-700 mt-1 break-words">{selectedDestination.address}</div>
                            <Button 
                              variant="ghost" 
                              className="px-0 h-8 mt-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-transparent"
                              onClick={() => setSelectedDestination(null)}
                            >
                              <span className="underline">Change Destination</span>
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <label className="flex justify-between items-center" htmlFor="price">
                            <span className="text-sm font-medium text-gray-700">Trip Price (EGP)</span>
                            <span className="text-xs text-gray-500">Enter your price</span>
                          </label>
                          <div className="relative">
                            <input 
                              id="price"
                              type="number"
                              min="1"
                              step="0.5"
                              value={manualPrice}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Ensure the value is a positive number
                                if (parseFloat(value) > 0 || value === '') {
                                  setManualPrice(value);
                                }
                              }}
                              className="border rounded p-2"
                            />
                          </div>
                        </div>
                        
                        <div className="pt-4">
                          <Button 
                            onClick={() => {
                              console.log("Request Ride button clicked");
                              console.log("Selected destination:", selectedDestination);
                              // Verify destination is properly set before proceeding
                              if (!selectedDestination || !selectedDestination.location || !selectedDestination.address) {
                                toast({
                                  title: "Missing Destination",
                                  description: "Please select a valid destination before requesting a ride.",
                                  variant: "destructive"
                                });
                                return;
                              }
                              requestRide();
                            }} 
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            Request Ride
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
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
                      <div className="max-w-md mx-auto p-4 space-y-5">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h2 className="text-xl font-bold text-blue-900">Your Ride History</h2>
                            <p className="text-sm text-gray-500">View your past trips</p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setShowHistory(false)}
                            className="rounded-full border-blue-200 text-blue-700 hover:bg-blue-50 flex items-center gap-1"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Current
                          </Button>
                        </div>
                        
                        {rideHistory.length === 0 ? (
                          <Card className="border-0 shadow-md rounded-xl overflow-hidden bg-gradient-to-r from-blue-50 to-indigo-50">
                            <CardContent className="p-8 text-center flex flex-col items-center gap-4">
                              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
                                <History className="h-8 w-8" />
                              </div>
                              <div>
                                <h3 className="text-lg font-medium text-blue-800">No Ride History</h3>
                                <p className="text-gray-600 mt-1">Your completed trips will appear here</p>
                              </div>
                              <Button 
                                className="mt-2 bg-blue-600 hover:bg-blue-700 rounded-full px-5 text-white"
                                onClick={() => setShowHistory(false)}
                              >
                                Request a Ride
                              </Button>
                            </CardContent>
                          </Card>
                        ) : (
                          <div className="space-y-4">
                            {rideHistory.map((ride) => (
                              <Card key={ride.id} className="border-0 shadow-md rounded-xl overflow-hidden transition-all hover:shadow-lg">
                                <div className={`h-1.5 w-full ${ride.status === 'completed' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <CardHeader className="pb-2 pt-4">
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <Badge 
                                        variant="outline"
                                        className={`${ride.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'} rounded-full px-3 py-1 text-xs font-medium`}
                                      >
                                        {ride.status.toUpperCase()}
                                      </Badge>
                                      <span className="text-sm text-gray-600">
                                        {new Date(ride.requestTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                    <div className="text-lg font-bold text-blue-900">
                                      {formatPrice(ride.estimatedPrice || 0)}
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="py-3">
                                  <div className="space-y-4">
                                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                      <div className="flex items-start gap-3">
                                        <div className="mt-1">
                                          <MapPin className="h-5 w-5 text-red-500" />
                                        </div>
                                        <div className="flex-1">
                                          <div className="text-sm font-medium text-gray-900">Destination</div>
                                          <div className="text-sm text-gray-700 mt-1 break-words">
                                            {ride.destinationAddress}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-center">
                                      <div className="flex items-center gap-2">
                                        <div className="bg-blue-100 p-1.5 rounded-full">
                                          <Clock className="h-4 w-4 text-blue-700" />
                                        </div>
                                        <div>
                                          <div className="text-xs text-gray-500">TIME</div>
                                          <div className="text-sm font-medium">
                                            {new Date(ride.requestTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {ride.driverName && (
                                        <div className="flex items-center gap-2">
                                          <div className="bg-indigo-100 p-1.5 rounded-full">
                                            <Car className="h-4 w-4 text-indigo-700" />
                                          </div>
                                          <div>
                                            <div className="text-xs text-gray-500">DRIVER</div>
                                            <div className="text-sm font-medium">{ride.driverName}</div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
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
        )}
        
        {activeRide && activeRide.status !== 'completed' && (
          <Card className="shadow-lg bg-white border-0 rounded-xl overflow-hidden">
            <div className={`h-2 w-full ${activeRide.status === 'pending' ? 'bg-amber-400' : activeRide.status === 'accepted' ? 'bg-blue-500' : activeRide.status === 'started' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Ride Status</CardTitle>
                <div className="flex gap-2">
                  {activeRide && activeRide.status === 'pending' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleCancelRide}
                      disabled={cancellingRide}
                      className="flex items-center gap-1"
                    >
                      {cancellingRide ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        <>
                          <X className="h-3.5 w-3.5" />
                          Cancel Ride
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-full ${activeRide.status === 'pending' ? 'bg-amber-100 text-amber-600' : activeRide.status === 'accepted' ? 'bg-blue-100 text-blue-600' : activeRide.status === 'started' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                  {activeRide.status === 'pending' ? (
                    <Clock className="h-5 w-5" />
                  ) : activeRide.status === 'accepted' ? (
                    <Car className="h-5 w-5" />
                  ) : activeRide.status === 'started' ? (
                    <MapPin className="h-5 w-5" />
                  ) : (
                    <CheckCircle className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-gray-800">{getStatusText()}</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    {activeRide.status === 'pending' && 'Your ride request has been sent to nearby drivers'}
                    {activeRide.status === 'accepted' && 'A driver has accepted and is on the way to pick you up'}
                    {activeRide.status === 'started' && 'Your trip is in progress. Enjoy your ride!'}
                    {activeRide.status === 'completed' && 'Your trip has been completed'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-2">
                <Badge 
                  variant="outline" 
                  className={`text-xs font-medium px-3 py-1 rounded-full ${activeRide.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : activeRide.status === 'accepted' ? 'bg-blue-50 text-blue-700 border-blue-200' : activeRide.status === 'started' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}
                >
                  {activeRide.status.toUpperCase()}
                </Badge>
                <div className="text-xs text-gray-500">
                  Requested at {new Date(activeRide.requestTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pb-5 pt-0">
              <div className="space-y-5">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">From</p>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        <p className="text-sm text-gray-800 font-medium truncate">Current Location</p>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">To</p>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-red-500"></div>
                        <p className="text-sm text-gray-800 font-medium truncate">
                          {activeRide.destinationAddress?.split(',')[0] || "Destination"}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">FULL DESTINATION</p>
                      <p className="text-sm text-gray-800">{activeRide.destinationAddress}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-2">
                    <div className="bg-white p-1.5 rounded-full shadow-sm">
                      <Car className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Trip Price</span>
                  </div>
                  <span className="text-lg font-bold text-blue-800">
                    {formatPrice(activeRide.estimatedPrice || 0)}
                  </span>
                </div>

                {(activeRide.status === 'accepted' || activeRide.status === 'started') && activeRide.driverName && (
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-blue-800">Your Driver</p>
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                        {activeRide.status === 'accepted' ? 'On the way' : 'Driving'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold">
                          {activeRide.driverName?.charAt(0) || "D"}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{activeRide.driverName || "Driver"}</p>
                          {activeRide.driverPhoneNumber && (
                            <p className="text-xs text-gray-500">{activeRide.driverPhoneNumber}</p>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        {activeRide.driverPhoneNumber && hasPhoneNumber ? (
                          <CallButton 
                            phoneNumber={activeRide.driverPhoneNumber} 
                            recipientName={activeRide.driverName || "Driver"}
                            variant="button"
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-2 text-sm shadow-sm"
                          />
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex items-center gap-1 rounded-full border-blue-300 text-blue-700 hover:bg-blue-100"
                            onClick={() => setShowPhoneModal(true)}
                          >
                            <Phone className="h-3.5 w-3.5" />
                            Verify Phone
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <PhoneVerificationModal 
        isOpen={showPhoneModal} 
        onClose={() => setShowPhoneModal(false)} 
        onSubmit={handlePhoneSubmit}
      />
    </div>
  );
};

export default CustomerInterface;
