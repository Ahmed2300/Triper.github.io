import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Car, User, MapPin, Clock, PhoneCall, CheckCircle, ArrowRight, Bell, LogOut, Shield, Coins, Star } from "lucide-react";
import CustomerInterface from "@/components/CustomerInterface";
import DriverInterface from "@/components/DriverInterface";
import LoginScreen from "@/components/LoginScreen";
import UserProfileCard from "@/components/UserProfileCard";
import { subscribeToAuthChanges, signOutUser, setUserType as updateUserType, getUserData } from "@/services/authService";
import { User as FirebaseUser } from "firebase/auth";

// Add animation styles
import "@/styles/animations.css";

const Index = () => {
  const [userType, setUserType] = useState<'customer' | 'driver' | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (authUser) => {
      setUser(authUser);
      
      if (authUser) {
        // Check if user has already selected a type
        const userData = await getUserData(authUser.uid);
        if (userData?.userType) {
          setUserType(userData.userType);
        }
      }
      
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, []);
  
  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOutUser();
      setUserType(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  
  // Handle user type selection
  const handleUserTypeSelection = async (type: 'customer' | 'driver') => {
    if (user) {
      await updateUserType(user.uid, type);
      setUserType(type);
    }
  };
  
  // Show login screen if user is not logged in
  if (!user) {
    return <LoginScreen onLoginSuccess={setUser} />;
  }
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
      </div>
    );
  }
  
  // Show customer interface
  if (userType === 'customer') {
    return (
      <div className="relative">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleSignOut} 
          className="absolute top-4 right-4 z-50"
        >
          <LogOut className="h-5 w-5" />
        </Button>
        <CustomerInterface onBack={() => setUserType(null)} />
      </div>
    );
  }

  // Show driver interface
  if (userType === 'driver') {
    return (
      <div className="relative">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleSignOut} 
          className="absolute top-4 right-4 z-50"
        >
          <LogOut className="h-5 w-5" />
        </Button>
        <DriverInterface onBack={() => setUserType(null)} />
      </div>
    );
  }

  // Role selection screen with enhanced UI
  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 flex items-center justify-center p-4 md:p-6 relative overflow-hidden">
      {/* Enhanced background elements with more dynamic animation */}
      <div className="absolute top-0 left-0 w-[40vw] h-[40vw] bg-blue-300 rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute top-[10%] right-[5%] w-[35vw] h-[35vw] bg-indigo-300 rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-pulse animation-delay-2000"></div>
      <div className="absolute bottom-[5%] left-[15%] w-[30vw] h-[30vw] bg-purple-300 rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-pulse animation-delay-4000"></div>
      <div className="absolute bottom-[20%] right-[20%] w-[25vw] h-[25vw] bg-cyan-300 rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-pulse animation-delay-3000"></div>
      
      {/* Sign out button */}
      {user && (
        <Button 
          variant="outline"
          size="icon"
          onClick={handleSignOut}
          className="absolute top-6 right-6 z-20 text-white border-white/30 hover:bg-white/10 transition-all duration-300"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      )}

      <div className="w-full max-w-5xl mx-auto z-10">
        {/* App logo and branding with animation */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-6 animate-bounce">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-600 rounded-2xl blur-md opacity-30 animate-pulse"></div>
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-4 rounded-2xl shadow-xl relative">
                <Car className="h-12 w-12" />
              </div>
            </div>
          </div>
          
          {/* App name with gradient text */}
          <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-100 mb-2">TripTracker</h1>
          <p className="text-sm text-white/80 font-medium mb-8">Your reliable ride-sharing companion</p>
        </div>

        {/* User profile with glass morphism effect */}
        {user && (
          <div className="mb-8 max-w-sm mx-auto">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-400 flex items-center justify-center text-white text-xl font-bold overflow-hidden border-2 border-white/40 shadow-inner">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                    ) : (
                      user.displayName?.charAt(0).toUpperCase() || 'U'
                    )}
                    <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1 border-2 border-white">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-white truncate">{user.displayName || 'User'}</h2>
                  <p className="text-sm text-white/70 truncate">{user.email}</p>
                  {user.phoneNumber && (
                    <div className="flex items-center mt-1 text-sm text-white/60">
                      <PhoneCall className="w-3 h-3 mr-1" />
                      {user.phoneNumber}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Choose your role header */}
        <div className="text-center mb-6">
          <h2 className="inline-block text-xl font-bold text-white px-6 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg">
            Choose your role
          </h2>
        </div>

        {/* Role selection cards with glass morphism */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Customer Card */}
          <div 
            className="group cursor-pointer bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 overflow-hidden transform transition-all duration-500 hover:scale-[1.02] hover:bg-white/15 hover:shadow-2xl relative" 
            onClick={() => handleUserTypeSelection('customer')}
          >
            {/* Animated accent */}
            <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-blue-400 to-cyan-400 group-hover:w-2 transition-all duration-300"></div>
            
            <div className="p-6">
              <div className="flex items-center gap-5 mb-5">
                <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-2xl shadow-lg">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white group-hover:text-blue-100 transition-colors duration-300">Ride as Customer</h3>
                  <p className="text-white/70 text-sm">Request rides to your destination</p>
                </div>
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-4 bg-white/5 p-3 rounded-xl group-hover:bg-white/10 transition-colors duration-300">
                  <div className="bg-blue-500/20 p-2 rounded-lg">
                    <MapPin className="h-6 w-6 text-blue-300" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium">Real-time Tracking</h4>
                    <p className="text-white/60 text-sm">Watch your driver's location update every 5 seconds with accurate ETA</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 bg-white/5 p-3 rounded-xl group-hover:bg-white/10 transition-colors duration-300">
                  <div className="bg-blue-500/20 p-2 rounded-lg">
                    <Bell className="h-6 w-6 text-blue-300" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium">Ride Management</h4>
                    <p className="text-white/60 text-sm">Request, monitor, and cancel rides with a simple interface</p>
                  </div>
                </div>
              </div>
              
              <Button 
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium py-5 rounded-xl shadow-lg group-hover:shadow-blue-500/30 transition-all duration-300 flex justify-center items-center gap-2 border-0"
              >
                Select
                <ArrowRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform duration-300" />
              </Button>
            </div>
          </div>

          {/* Driver Card */}
          <div 
            className="group cursor-pointer bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 overflow-hidden transform transition-all duration-500 hover:scale-[1.02] hover:bg-white/15 hover:shadow-2xl relative" 
            onClick={() => handleUserTypeSelection('driver')}
          >
            {/* Animated accent */}
            <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-indigo-400 to-purple-400 group-hover:w-2 transition-all duration-300"></div>
            
            <div className="p-6">
              <div className="flex items-center gap-5 mb-5">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-500 p-3 rounded-2xl shadow-lg">
                  <Car className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white group-hover:text-indigo-100 transition-colors duration-300">Drive with Us</h3>
                  <p className="text-white/70 text-sm">Accept rides and earn money</p>
                </div>
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-4 bg-white/5 p-3 rounded-xl group-hover:bg-white/10 transition-colors duration-300">
                  <div className="bg-indigo-500/20 p-2 rounded-lg">
                    <MapPin className="h-6 w-6 text-indigo-300" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium">Smart Navigation</h4>
                    <p className="text-white/60 text-sm">Get turn-by-turn directions and optimal routes to destinations</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 bg-white/5 p-3 rounded-xl group-hover:bg-white/10 transition-colors duration-300">
                  <div className="bg-indigo-500/20 p-2 rounded-lg">
                    <Coins className="h-6 w-6 text-indigo-300" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium">Earnings Tracker</h4>
                    <p className="text-white/60 text-sm">Monitor your income and ride statistics in real-time</p>
                  </div>
                </div>
              </div>
              
              <Button 
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-medium py-5 rounded-xl shadow-lg group-hover:shadow-indigo-500/30 transition-all duration-300 flex justify-center items-center gap-2 border-0"
              >
                Select
                <ArrowRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform duration-300" />
              </Button>
            </div>
          </div>
        </div>

        {/* Additional features section */}
        <div className="mt-10 px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 flex flex-col items-center text-center hover:bg-white/10 transition-all duration-300">
              <div className="bg-blue-500/20 p-3 rounded-full mb-3">
                <Shield className="h-6 w-6 text-blue-100" />
              </div>
              <h3 className="text-white font-medium mb-1">Secure Rides</h3>
              <p className="text-white/60 text-sm">All rides are tracked and monitored for your safety</p>
            </div>
            
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 flex flex-col items-center text-center hover:bg-white/10 transition-all duration-300">
              <div className="bg-indigo-500/20 p-3 rounded-full mb-3">
                <Clock className="h-6 w-6 text-indigo-100" />
              </div>
              <h3 className="text-white font-medium mb-1">24/7 Available</h3>
              <p className="text-white/60 text-sm">Request or provide rides anytime you need</p>
            </div>
            
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 flex flex-col items-center text-center hover:bg-white/10 transition-all duration-300">
              <div className="bg-purple-500/20 p-3 rounded-full mb-3">
                <Star className="h-6 w-6 text-purple-100" />
              </div>
              <h3 className="text-white font-medium mb-1">Rate Your Experience</h3>
              <p className="text-white/60 text-sm">Help us improve with your valuable feedback</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
