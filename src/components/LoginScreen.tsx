import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { signInWithGoogle, subscribeToAuthChanges } from "@/services/authService";
import { User } from "firebase/auth";
import { Loader2, MapPin, Navigation, Car, Shield } from "lucide-react";
import { motion } from "framer-motion";

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

const LoginScreen = ({ onLoginSuccess }: LoginScreenProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already logged in
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      if (user) {
        onLoginSuccess(user);
      }
    });
    
    return () => unsubscribe();
  }, [onLoginSuccess]);
  
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const user = await signInWithGoogle();
      if (user) {
        onLoginSuccess(user);
      }
    } catch (error) {
      console.error("Login failed:", error);
      setError("Failed to sign in with Google. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen p-4 bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <motion.div 
          className="absolute top-10 left-10 w-64 h-64 rounded-full bg-cyan-400 blur-3xl"
          animate={{ 
            x: [0, 30, 0], 
            y: [0, 20, 0] 
          }}
          transition={{ 
            repeat: Infinity, 
            duration: 10,
            ease: "easeInOut" 
          }}
        />
        <motion.div 
          className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-purple-400 blur-3xl"
          animate={{ 
            x: [0, -40, 0], 
            y: [0, -30, 0] 
          }}
          transition={{ 
            repeat: Infinity, 
            duration: 14,
            ease: "easeInOut" 
          }}
        />
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="z-10 w-full max-w-md"
      >
        <Card className="w-full border-0 shadow-2xl bg-white/95 backdrop-blur-sm rounded-xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
          <CardHeader className="text-center pb-2">
            <motion.div 
              initial={{ scale: 0.8 }} 
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="flex justify-center mb-4"
            >
              <div className="relative w-20 h-20 flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full shadow-lg">
                <Car size={40} className="text-white" />
              </div>
            </motion.div>
            <CardTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-800 pb-1">Trip Tracker</CardTitle>
            <CardDescription className="text-gray-600">Your journey, our priority</CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="space-y-6">
              <div className="flex justify-center space-x-8 mb-6 pt-2">
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="flex flex-col items-center">
                  <div className="bg-blue-100 p-3 rounded-full text-blue-600 mb-2">
                    <MapPin size={20} />
                  </div>
                  <span className="text-xs font-medium text-gray-600">Track Routes</span>
                </motion.div>
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="flex flex-col items-center">
                  <div className="bg-indigo-100 p-3 rounded-full text-indigo-600 mb-2">
                    <Navigation size={20} />
                  </div>
                  <span className="text-xs font-medium text-gray-600">Real-time Updates</span>
                </motion.div>
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="flex flex-col items-center">
                  <div className="bg-purple-100 p-3 rounded-full text-purple-600 mb-2">
                    <Shield size={20} />
                  </div>
                  <span className="text-xs font-medium text-gray-600">Secure Rides</span>
                </motion.div>
              </div>
              
              <motion.div 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  className="w-full py-6 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-base font-medium rounded-lg shadow-lg flex items-center justify-center gap-3 transition-all duration-300"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <img 
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                      alt="Google Logo" 
                      className="h-5 w-5 bg-white rounded-full"
                    />
                  )}
                  {isLoading ? "Signing In..." : "Sign in with Google"}
                </Button>
              </motion.div>
              
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm"
                >
                  {error}
                </motion.div>
              )}
              
              {/* Terms and Privacy Policy text removed */}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default LoginScreen;
