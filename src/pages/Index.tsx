
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Car, User, MapPin, Clock, PhoneCall, CheckCircle, ArrowRight, Bell, LogOut, Settings } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4 md:p-6 relative overflow-hidden">
      {/* Improved background elements with better animation */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse"></div>
      <div className="absolute top-20 right-10 w-80 h-80 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse animation-delay-2000"></div>
      <div className="absolute bottom-10 left-1/4 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse animation-delay-4000"></div>
      <div className="absolute bottom-40 right-1/4 w-60 h-60 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse animation-delay-3000"></div>
      
      {/* Sign out button in better position */}
      {user && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleSignOut} 
          className="absolute top-4 right-4 z-50 rounded-full px-4 py-2 text-sm font-medium shadow-sm hover:bg-gray-100 transition-all flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </Button>
      )}
      
      <div className="w-full max-w-md space-y-10 relative z-10">
        {/* App logo and branding */}
        <div className="flex flex-col items-center justify-center animate-fadeIn">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg mb-4 transform rotate-12">
            <Car className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-800 to-indigo-900">TripTracker</h1>
          <p className="text-gray-600 mt-2 text-center max-w-xs">Your reliable ride-sharing companion</p>
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-blue-900 mb-5 pt-4">TripTracker</h1>
          {/* Removed the static tagline as the user profile now shows instead */}
          {/* User Profile Display */}
          <div className="mt-4 mb-6 mx-auto max-w-sm">
            <div className="bg-white rounded-xl p-4 shadow-md flex flex-col items-center">
              {/* User profile - removed the duplicate title */}
              <div className="flex justify-center">
                <UserProfileCard user={user} className="w-full max-w-sm animate-fadeInUp shadow-xl rounded-2xl border border-gray-100 overflow-hidden" />
              </div>

              <h2 className="text-xl font-semibold text-gray-700 text-center">Choose your role</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeInUp animation-delay-500">
                {/* Customer Card */}
                <Card 
                  className="cursor-pointer overflow-hidden transform transition-all duration-300 hover:scale-102 hover:shadow-xl border-0 bg-white shadow-lg relative group rounded-3xl" 
                  onClick={() => handleUserTypeSelection('customer')}
                >
                  {/* Card decoration */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-100 rounded-full opacity-0 group-hover:opacity-70 transition-opacity duration-500"></div>
                  
                  <CardHeader className="relative z-10 pb-2">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-6 group-hover:rotate-0 transition-transform duration-300">
                        <User className="w-8 h-8 text-white" />
                      </div>
                      <div className="text-left">
                        <CardTitle className="text-xl font-bold text-blue-800 group-hover:text-blue-900 transition-colors duration-300">Ride as Customer</CardTitle>
                        <CardDescription className="text-blue-600 font-medium text-sm">
                          Request rides to your destination
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pb-5 relative z-10">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-2 rounded-lg group-hover:bg-blue-50 transition-colors duration-300">
                        <div className="bg-blue-100 p-2 rounded-xl group-hover:bg-blue-200 transition-colors duration-300">
                          <MapPin className="h-5 w-5 text-blue-700" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">Real-time Tracking</h3>
                          <p className="text-xs text-gray-500">Track your ride in real-time</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-2 rounded-lg group-hover:bg-blue-50 transition-colors duration-300">
                        <div className="bg-blue-100 p-2 rounded-xl group-hover:bg-blue-200 transition-colors duration-300">
                          <PhoneCall className="h-5 w-5 text-blue-700" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">Direct Communication</h3>
                          <p className="text-xs text-gray-500">Call your driver directly</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex justify-end">
                      <Button 
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white flex items-center gap-2 rounded-full px-6 py-2 shadow-md transition-all duration-300 hover:shadow-lg"
                      >
                        Select
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Driver Card */}
                <Card 
                  className="cursor-pointer overflow-hidden transform transition-all duration-300 hover:scale-102 hover:shadow-xl border-0 bg-white shadow-lg relative group rounded-3xl" 
                  onClick={() => setUserType('driver')}
                >
                  {/* Card decoration */}
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-100 rounded-full opacity-0 group-hover:opacity-70 transition-opacity duration-500"></div>
                  
                  <CardHeader className="relative z-10 pb-2">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-6 group-hover:rotate-0 transition-transform duration-300">
                        <Car className="w-8 h-8 text-white" />
                      </div>
                      <div className="text-left">
                        <CardTitle className="text-xl font-bold text-indigo-800 group-hover:text-indigo-900 transition-colors duration-300">Drive with Us</CardTitle>
                        <CardDescription className="text-indigo-600 font-medium text-sm">
                          Accept rides and earn money
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pb-5 relative z-10">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-2 rounded-lg group-hover:bg-indigo-50 transition-colors duration-300">
                        <div className="bg-indigo-100 p-2 rounded-xl group-hover:bg-indigo-200 transition-colors duration-300">
                          <MapPin className="h-5 w-5 text-indigo-700" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">Smart Navigation</h3>
                          <p className="text-xs text-gray-500">Efficient routes to destinations</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-2 rounded-lg group-hover:bg-indigo-50 transition-colors duration-300">
                        <div className="bg-indigo-100 p-2 rounded-xl group-hover:bg-indigo-200 transition-colors duration-300">
                          <Clock className="h-5 w-5 text-indigo-700" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">Earnings Tracker</h3>
                          <p className="text-xs text-gray-500">Monitor your income easily</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex justify-end">
                      <Button 
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white flex items-center gap-2 rounded-full px-6 py-2 shadow-md transition-all duration-300 hover:shadow-lg"
                      >
                        Select
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
