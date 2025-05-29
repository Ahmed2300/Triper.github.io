import { database, auth } from '@/lib/firebase';
import { ref, set, get, onValue, off, update } from 'firebase/database';
import { determineValidFirebasePath } from '@/lib/firebaseAdmin';

export interface UserProfile {
  uid: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  photoURL?: string;
  userType?: 'customer' | 'driver';
  phoneVerified?: boolean;
  createdAt?: number;
  lastLogin?: number;
  updatedAt?: number;
  authProvider?: string;
  preferences?: {
    notifications?: boolean;
    darkMode?: boolean;
    [key: string]: any;
  };
  profileImage?: {
    url: string;
    thumbnail?: string;
    updatedAt: string;
  };
  [key: string]: any; // Allow for additional properties
}

/**
 * Updates or creates a user profile with phone number
 */
export const updateUserProfile = async (data: Partial<UserProfile>): Promise<void> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('No authenticated user found');
    }

    const uid = data.uid || currentUser.uid;
    // Use original users path to avoid permission issues
    const userRef = ref(database, `users/${uid}`);
    
    console.log('Updating user profile for:', uid);
    
    // First get the existing profile to merge with new data
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
      console.log('Existing profile found, updating specific fields');
      // Only update specific fields using update() instead of set()
      const updateData = {
        ...data,
        updatedAt: Date.now()
      };
      
      await update(userRef, updateData);
      console.log('Profile updated successfully');
    } else {
      console.log('No existing profile, creating new one');
      // Create a new profile if it doesn't exist
      const newProfile = {
        ...data,
        uid,
        // Update fields from auth if available and not overridden
        displayName: data.displayName || currentUser.displayName || '',
        email: data.email || currentUser.email || '',
        photoURL: data.photoURL || currentUser.photoURL || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastLogin: Date.now(),
        authProvider: 'google'
      };
      
      await set(userRef, newProfile);
      console.log('New profile created successfully');
    }
  } catch (error) {
    console.error('Error updating user profile:', error);
    // Log more detailed information about the error
    if (error instanceof Error) {
      console.error('User profile update error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        uid: data.uid || 'unknown'
      });
    }
    throw error;
  }
};

/**
 * Gets a user's profile by UID
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    if (!uid) {
      console.error('Invalid uid provided to getUserProfile');
      return null;
    }
    
    console.log('Getting user profile for:', uid);
    
    // Try multiple paths with fallback mechanism
    const pathsToTry = [
      `users/${uid}`,
      `TriptakerUsers/${uid}`,
      `app_users/${uid}`,
      `userProfiles/${uid}`,
      `.public_data/users/${uid}`
    ];
    
    // Try each path until we find user data
    for (const path of pathsToTry) {
      try {
        console.log(`Checking for user profile in path: ${path}`);
        const userRef = ref(database, path);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
          console.log(`User profile found in ${path}`);
          return snapshot.val() as UserProfile;
        }
      } catch (pathError) {
        console.warn(`Failed to read profile from ${path}:`, pathError);
        // Continue to next path
      }
    }
    
    // Check localStorage as final fallback
    const localData = localStorage.getItem('user_data');
    if (localData) {
      try {
        const parsedData = JSON.parse(localData);
        if (parsedData.uid === uid) {
          console.log('Found user profile in localStorage');
          return parsedData as UserProfile;
        }
      } catch (parseError) {
        console.error('Error parsing localStorage profile data:', parseError);
      }
    }
    
    console.log('No user profile found in any location for ID:', uid);
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    // Log more detailed information about the error
    if (error instanceof Error) {
      console.error('User profile error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        uid: uid || 'unknown'
      });
    }
    return null;
  }
};

/**
 * Gets the current user's profile
 */
export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('No authenticated user found in getCurrentUserProfile');
      return null;
    }
    
    console.log('Getting current user profile for:', currentUser.uid);
    return getUserProfile(currentUser.uid);
  } catch (error) {
    console.error('Error in getCurrentUserProfile:', error);
    // Log more detailed information about the error
    if (error instanceof Error) {
      console.error('Current user profile error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
    return null;
  }
};

/**
 * Listens to changes in a user's profile
 */
export const listenToUserProfile = (uid: string, callback: (profile: UserProfile | null) => void) => {
  // Start with users path by default
  const userRef = ref(database, `users/${uid}`);
  
  // Set up a local storage fallback for when database fails
  let localStorageCheck = false;
  
  const unsubscribe = onValue(userRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as UserProfile);
      localStorageCheck = false; // Reset flag when database works
    } else {
      // If database doesn't have the data, try localStorage
      if (!localStorageCheck) {
        localStorageCheck = true;
        try {
          const localData = localStorage.getItem('user_data');
          if (localData) {
            const parsedData = JSON.parse(localData);
            if (parsedData.uid === uid) {
              console.log('Providing profile from localStorage fallback');
              callback(parsedData as UserProfile);
              return;
            }
          }
        } catch (error) {
          console.error('Error getting profile from localStorage:', error);
        }
      }
      callback(null);
    }
  }, (error) => {
    console.error('Error listening to profile:', error);
    // On error, try localStorage as fallback
    try {
      const localData = localStorage.getItem('user_data');
      if (localData) {
        const parsedData = JSON.parse(localData);
        if (parsedData.uid === uid) {
          console.log('Providing profile from localStorage after database error');
          callback(parsedData as UserProfile);
          return;
        }
      }
    } catch (parseError) {
      console.error('Error parsing localStorage profile data:', parseError);
    }
    callback(null);
  });
  
  return () => off(userRef, 'value', unsubscribe);
};

/**
 * Checks if the current user has completed their profile with a phone number
 */
export const hasCompletedProfile = async (): Promise<boolean> => {
  const profile = await getCurrentUserProfile();
  return !!profile && !!profile.phoneNumber;
};

/**
 * Updates a user's phone number and sets phoneVerified flag
 */
export const updatePhoneNumber = async (phoneNumber: string): Promise<void> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('No authenticated user found');
    }
    
    console.log('Updating phone number for user:', currentUser.uid);
    await updateUserProfile({
      uid: currentUser.uid,
      phoneNumber,
      phoneVerified: true // We're using format validation instead of SMS verification
    });
    console.log('Phone number updated successfully');
  } catch (error) {
    console.error('Error updating phone number:', error);
    // Log more detailed information about the error
    if (error instanceof Error) {
      console.error('Phone update error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        phoneNumber: phoneNumber ? 'provided' : 'missing'
      });
    }
    throw error;
  }
};
