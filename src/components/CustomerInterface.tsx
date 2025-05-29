import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Clock, Car, Phone, AlertCircle, History, CheckCircle, MapIcon } from "lucide-react";
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

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          toast({
            title: "Location Error",
            description: "Unable to get your current location. Please check your location settings.",
            variant: "destructive",
          });
        }
      );
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
    if (!currentLocation || !selectedDestination) {
      toast({
        title: "Missing Information", 
        description: "Please select a destination.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Get price from state
      const price = parseFloat(manualPrice || '0');
      
      if (isNaN(price) || price <= 0) {
        toast({
          title: "Invalid Price", 
          description: "Please enter a valid price for the trip.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }
      
      // Create ride request
      const request: Omit<RideRequest, "id" | "requestTime" | "status" | "calculatedMileage"> = {
        customerId,
        customerName: customerName || "Customer",
        customerPhoneNumber: userPhoneNumber,
        pickupLocation: currentLocation,
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
    } catch (error) {
      console.error("Error requesting ride:", error);
      toast({
        title: "Error", 
        description: "Failed to request ride. Please try again.",
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
    <div className="w-full max-w-md mx-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Customer</h1>
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
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Confirm your ride</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {showMapSelector && (
                      <div className="mb-4">
                        <OpenStreetMapPicker
                          initialLocation={selectedDestination.location}
                          initialAddress={selectedDestination.address}
                          onSelectLocation={(location, address) => {
                            setSelectedDestination({ location, address });
                            setShowMapSelector(false);
                            setIsInitialSearch(false);
                          }}
                        />
                      </div>
                    )}
                    
                    {!showMapSelector && (
                      <div className="space-y-4">
                        <div className="flex items-start gap-3 justify-between">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              <MapPin className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-medium">Destination</h3>
                              <p className="text-sm text-muted-foreground">{selectedDestination.address}</p>
                            </div>
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowMapSelector(true)}
                            className="flex items-center gap-1 h-8"
                          >
                            <MapIcon className="h-3.5 w-3.5" />
                            {isInitialSearch ? "Fine-tune" : "Edit"}
                          </Button>
                        </div>
                        
                        <div className="border-t pt-4 mt-2">
                          <div className="flex flex-col space-y-2">
                            <label htmlFor="price" className="text-sm font-medium">
                              Trip Price (EGP)
                            </label>
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
                          <Button onClick={requestRide} className="w-full">
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
                                  <Badge variant={ride.status === 'completed' ? 'default' : 'secondary'}>
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
        
        {activeRide && activeRide.status !== 'completed' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Ride Status</CardTitle>
                <div className="flex gap-2">
                  {activeRide.driverPhoneNumber && hasPhoneNumber && 
                    (activeRide.status === 'accepted' || activeRide.status === 'started') && (
                    <CallButton 
                      phoneNumber={activeRide.driverPhoneNumber} 
                      recipientName={activeRide.driverName || "Driver"}
                      variant="button"
                      size="sm"
                    />
                  )}
                  {(activeRide.status === 'pending' || activeRide.status === 'accepted') && (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      disabled={cancellingRide}
                      onClick={handleCancelRide}
                    >
                      {cancellingRide ? "Cancelling..." : "Cancel Trip"}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusColor() as "default" | "secondary" | "destructive" | "outline"} className="mr-2">
                    {activeRide.status}
                  </Badge>
                  <span className="text-sm font-medium">
                    {activeRide.status === 'pending' && 'Waiting for a driver to accept your request'}
                    {activeRide.status === 'accepted' && 'A driver has accepted your request and is on the way'}
                    {activeRide.status === 'started' && 'Your trip is in progress'}
                  </span>
                </div>

                <div className="border-t pt-4 mt-2">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Request Time</span>
                    </div>
                    <span className="text-sm">
                      {new Date(activeRide.requestTime).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Destination</span>
                    </div>
                    <span className="text-sm text-right max-w-[60%]">
                      {activeRide.destinationAddress}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Trip Price</span>
                    </div>
                    <span className="text-sm font-bold">
                      {formatPrice(activeRide.estimatedPrice || 0)}
                    </span>
                  </div>
                </div>

                {(activeRide.status === 'accepted' || activeRide.status === 'started') && activeRide.driverName && (
                  <div className="mt-4 bg-blue-50 p-3 rounded-md">
                    <p className="text-sm font-medium mb-2">Driver Information</p>
                    <div className="flex justify-between items-center">
                      <p className="font-medium">{activeRide.driverName || "Driver"}</p>
                      
                      <div>
                        {activeRide.driverPhoneNumber && hasPhoneNumber ? (
                          <CallButton 
                            phoneNumber={activeRide.driverPhoneNumber} 
                            recipientName={activeRide.driverName || "Driver"}
                            variant="button"
                            size="sm"
                          />
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex items-center gap-1 text-xs"
                            onClick={() => setShowPhoneModal(true)}
                          >
                            <Phone className="h-3 w-3" />
                            Add Phone
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
