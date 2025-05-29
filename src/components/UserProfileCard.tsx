import { useState, useEffect, useRef, ChangeEvent } from "react";
import { User } from "firebase/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Loader2, Check, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { uploadImage } from "@/services/imageUploadService";
import { updateUserData, getCurrentUser } from "@/services/authService";
import { auth } from "@/lib/firebase";
import { getPhoneNumber, savePhoneNumber, hasStoredPhoneNumber } from "@/services/phoneStorage";
import { Input } from "@/components/ui/input";

interface UserProfileCardProps {
  user: User | null;
  className?: string;
  onSignOut?: () => void;
}

const UserProfileCard = ({ user, className = '', onSignOut }: UserProfileCardProps) => {
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Initialize state from user object or localStorage backup
  const [displayName, setDisplayName] = useState(() => {
    return user?.displayName || localStorage.getItem('user_displayName') || "";
  });
  
  const [profileImage, setProfileImage] = useState(() => {
    return user?.photoURL || localStorage.getItem('user_photoURL') || "";
  });
  
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [hasPhone, setHasPhone] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isLoadingPhone, setIsLoadingPhone] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Function to refresh user data from all available sources
  const refreshUserData = async () => {
    // First check the current auth user (most accurate source)
    const currentUser = auth.currentUser;
    if (currentUser) {
      setDisplayName(currentUser.displayName || localStorage.getItem('user_displayName') || "");
      setProfileImage(currentUser.photoURL || localStorage.getItem('user_photoURL') || "");
      
      // Load phone number
      setIsLoadingPhone(true);
      try {
        const hasPhoneNumber = await hasStoredPhoneNumber(currentUser.uid);
        setHasPhone(hasPhoneNumber);
        
        if (hasPhoneNumber) {
          const phone = await getPhoneNumber(currentUser.uid);
          setPhoneNumber(phone || "");
        }
      } catch (error) {
        console.error("Error loading phone number:", error);
      } finally {
        setIsLoadingPhone(false);
      }
      return;
    }
    
    // Fall back to the user prop if auth.currentUser is not available
    if (user) {
      setDisplayName(user.displayName || localStorage.getItem('user_displayName') || "");
      setProfileImage(user.photoURL || localStorage.getItem('user_photoURL') || "");
      
      // Load phone number
      setIsLoadingPhone(true);
      try {
        const hasPhoneNumber = await hasStoredPhoneNumber(user.uid);
        setHasPhone(hasPhoneNumber);
        
        if (hasPhoneNumber) {
          const phone = await getPhoneNumber(user.uid);
          setPhoneNumber(phone || "");
        }
      } catch (error) {
        console.error("Error loading phone number:", error);
      } finally {
        setIsLoadingPhone(false);
      }
    }
  };
  
  // Update state when user data changes
  useEffect(() => {
    refreshUserData();
    
    // Listen for profile update events
    const handleProfileUpdate = () => {
      console.log('Profile update event detected, refreshing user data');
      refreshUserData();
    };
    
    window.addEventListener('user-profile-updated', handleProfileUpdate);
    
    // Clean up event listener
    return () => {
      window.removeEventListener('user-profile-updated', handleProfileUpdate);
    };
  }, [user]);
  
  // Handle file selection for profile image
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Get the most current user
    const currentUser = auth.currentUser;
    if (!file || !currentUser) {
      toast({
        title: "Error",
        description: "Could not update profile. Please sign in again.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsUploading(true);
      const result = await uploadImage(file);
      
      if (result.success && result.data) {
        const photoURL = result.data.display_url;
        console.log('Image uploaded successfully, URL:', photoURL);
        
        // Update user data in Firebase using the photoURL field
        await updateUserData(currentUser.uid, { photoURL });
        
        // Update local state
        setProfileImage(photoURL);
        
        // Manual backup to localStorage for redundancy
        localStorage.setItem('user_photoURL', photoURL);
        
        // Show success toast notification
        toast({
          title: "Profile Updated",
          description: "Your profile picture has been successfully updated.",
          variant: "default"
        });
        
        // Force refresh the user data from all sources
        refreshUserData();
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Update Failed",
        description: "Could not update profile picture. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setIsEditingImage(false);
    }
  };
  
  // Trigger file input click
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };
  
  // Handle display name update
  const handleNameUpdate = async () => {
    // Get most current user
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast({
        title: "Error",
        description: "Could not update name. Please sign in again.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Update user data in Firebase
      await updateUserData(currentUser.uid, { displayName });
      
      // Manual backup to localStorage for redundancy
      localStorage.setItem('user_displayName', displayName);
      
      // Show success notification
      toast({
        title: "Name Updated",
        description: "Your display name has been successfully updated.",
        variant: "default"
      });
      
      setIsEditingName(false);
      
      // Force refresh the user data from all sources
      refreshUserData();
    } catch (error) {
      console.error("Error updating name:", error);
      toast({
        title: "Update Failed",
        description: "Could not update display name. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Handle phone number update
  const handlePhoneUpdate = async () => {
    // Validate phone number format
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    if (!phoneRegex.test(phoneNumber)) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid phone number.",
        variant: "destructive"
      });
      return;
    }
    
    // Get most current user
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast({
        title: "Error",
        description: "Could not update phone number. Please sign in again.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Save phone number to Firestore/localStorage
      await savePhoneNumber(currentUser.uid, phoneNumber);
      
      // Update user data
      await updateUserData(currentUser.uid, {
        phoneNumber,
        phoneVerified: true
      });
      
      // Show success notification
      toast({
        title: "Phone Updated",
        description: "Your phone number has been successfully saved.",
        variant: "default"
      });
      
      setIsEditingPhone(false);
      setHasPhone(true);
      
      // Force refresh the user data from all sources
      refreshUserData();
    } catch (error) {
      console.error("Error updating phone number:", error);
      toast({
        title: "Update Failed",
        description: "Could not update phone number. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (!user) return null;

  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center py-4">
        <div className="w-full flex flex-col items-center gap-2">
          {/* Profile Image */}
          <div className="relative mb-3">
            {isUploading ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-2"></div>
                <span className="text-sm text-gray-500">Uploading...</span>
              </div>
            ) : (
              <div className="relative">
                <img 
                  src={profileImage || '/placeholder-user.png'} 
                  alt="Profile" 
                  className="h-20 w-20 rounded-full object-cover border-2 border-gray-200"
                />
                <button 
                  onClick={triggerFileInput} 
                  className="absolute bottom-0 right-0 bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded-full"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* User Name */}
          <div className="w-full flex items-center justify-center mb-2">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="px-2 py-1 border rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleNameUpdate}
                  className="h-8 w-8"
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <h3 className="font-medium text-lg">{displayName || "User"}</h3>
                <button 
                  onClick={() => setIsEditingName(true)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* User Email */}
          {user.email && (
            <p className="text-sm text-gray-500">{user.email}</p>
          )}

          {/* Phone Number Section */}
          <div className="w-full mt-3 border-t pt-3">
            {isLoadingPhone ? (
              <div className="flex items-center justify-center">
                <Loader2 className="h-4 w-4 text-blue-500 animate-spin mr-2" />
                <span className="text-sm text-gray-500">Loading phone info...</span>
              </div>
            ) : isEditingPhone ? (
              <div className="flex flex-col gap-2 w-full">
                <label htmlFor="phone" className="text-sm text-gray-700 font-medium">
                  Phone Number
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id="phone"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1234567890"
                    className="flex-1"
                  />
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handlePhoneUpdate}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-500" />
                  {hasPhone ? (
                    <span className="text-sm">{phoneNumber}</span>
                  ) : (
                    <span className="text-sm text-red-500 font-medium">Add Phone Number (required)</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingPhone(true)}
                  className="h-8 px-2"
                >
                  {hasPhone ? 'Update' : 'Add'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserProfileCard;
