import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { signInWithGoogle, subscribeToAuthChanges } from "@/services/authService";
import { User } from "firebase/auth";
import { Loader2 } from "lucide-react";

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
    <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Trip Tracker</CardTitle>
          <CardDescription>Sign in to access the app</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-center">
              <img 
                src="/logo.png" 
                alt="Trip Tracker Logo" 
                className="h-32 w-32 object-contain"
                onError={(e) => {
                  // If logo doesn't exist, hide the image
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            
            <Button 
              variant="outline" 
              className="w-full flex items-center justify-center gap-2"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <img 
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                  alt="Google Logo" 
                  className="h-5 w-5"
                />
              )}
              Sign in with Google
            </Button>
            
            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}
            
            <p className="text-xs text-center text-gray-500 mt-6">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginScreen;
