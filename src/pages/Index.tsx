
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 md:p-6 relative overflow-hidden">
      {/* Settings link removed */}
      {/* Abstract background elements */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      
      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-blue-900 mb-5 pt-4">TripTracker</h1>
          {/* Removed the static tagline as the user profile now shows instead */}
          {/* User Profile Display */}
          <div className="mt-4 mb-6 mx-auto max-w-sm">
            <div className="bg-white rounded-xl p-4 shadow-md flex flex-col items-center">
              <UserProfileCard user={user} />
              <p className="text-sm text-gray-600 mt-2">Click on the photo to edit your profile image</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 mt-8">
          <Card 
            className="cursor-pointer border border-blue-100 overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-xl bg-gradient-to-br from-white to-blue-50" 
            onClick={() => setUserType('customer')}
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-100 rounded-full opacity-70"></div>
            <CardHeader className="text-center relative z-10">
              <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg transform -rotate-6">
                <User className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-blue-800">I'm a Customer</CardTitle>
              <CardDescription className="text-blue-600 font-medium mt-1">
                Request a ride and track your journey
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <div className="bg-blue-100 p-1 rounded-full">
                    <MapPin className="h-3.5 w-3.5" />
                  </div>
                  <span>Live tracking</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <div className="bg-blue-100 p-1 rounded-full">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <span>Real-time updates</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <div className="bg-blue-100 p-1 rounded-full">
                    <CheckCircle className="h-3.5 w-3.5" />
                  </div>
                  <span>Verified drivers</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-700 font-medium">
                  <div className="bg-blue-100 p-1 rounded-full">
                    <PhoneCall className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-blue-800">Direct calling</span>
                </div>
              </div>
              <div className="flex justify-center">
                <Button 
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white flex items-center gap-2 mt-2 rounded-full px-5 py-2 shadow-md transition-all duration-300 hover:shadow-lg"
                >
                  Select
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer border border-indigo-100 overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-xl bg-gradient-to-br from-white to-indigo-50" 
            onClick={() => setUserType('driver')}
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-100 rounded-full opacity-70"></div>
            <CardHeader className="text-center relative z-10">
              <div className="mx-auto w-16 h-16 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg transform rotate-6">
                <Car className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-indigo-800">I'm a Driver</CardTitle>
              <CardDescription className="text-indigo-600 font-medium mt-1">
                Accept rides and track your earnings
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-indigo-700">
                  <div className="bg-indigo-100 p-1 rounded-full">
                    <MapPin className="h-3.5 w-3.5" />
                  </div>
                  <span>Navigation</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-indigo-700">
                  <div className="bg-indigo-100 p-1 rounded-full">
                    <PhoneCall className="h-3.5 w-3.5" />
                  </div>
                  <span>Direct calling</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-indigo-700">
                  <div className="bg-indigo-100 p-1 rounded-full">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <span>Earnings tracker</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-indigo-700 font-medium">
                  <div className="bg-indigo-100 p-1 rounded-full">
                    <CheckCircle className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-indigo-800">Track earnings</span>
                </div>
              </div>
              <div className="flex justify-center">
                <Button 
                  className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white flex items-center gap-2 mt-2 rounded-full px-5 py-2 shadow-md transition-all duration-300 hover:shadow-lg"
                >
                  Select
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
