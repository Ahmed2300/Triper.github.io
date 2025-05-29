import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut as firebaseSignOut,
  User as FirebaseUser
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { hasCompletedProfile, getCurrentUserProfile, UserProfile } from "@/services/userService";

// Define the shape of auth context
interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  hasPhoneNumber: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPhoneNumber, setHasPhoneNumber] = useState(false);

  // Sign in with Google
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    // Add scopes if needed
    provider.addScope('profile');
    provider.addScope('email');
    // Set custom parameters
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      
      // Handle specific error types
      if (error.code === 'auth/popup-closed-by-user') {
        console.log('Authentication popup was closed before completing the sign-in process');
        // We don't throw this error as it's a user action, not a system failure
        return;
      }
      
      // For other errors, provide more detailed logs
      if (error.code) {
        console.error("Google sign-in error details:", JSON.stringify(error));
      }
      
      throw error;
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  // Refresh user profile
  const refreshUserProfile = async () => {
    if (currentUser) {
      try {
        const profile = await getCurrentUserProfile();
        setUserProfile(profile);
        setHasPhoneNumber(!!profile?.phoneNumber);
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          const profile = await getCurrentUserProfile();
          setUserProfile(profile);
          
          // Check if user has added phone number
          const hasPhone = await hasCompletedProfile();
          setHasPhoneNumber(hasPhone);
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setUserProfile(null);
        setHasPhoneNumber(false);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    loading,
    hasPhoneNumber,
    signInWithGoogle,
    signOut,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
