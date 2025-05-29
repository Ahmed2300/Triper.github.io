import { 
  signInWithPopup, 
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  updateProfile,
  User,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';
import { ref, get, set, update } from 'firebase/database';
import { auth, database } from '@/lib/firebase';
import { determineValidFirebasePath, setupFirebaseRules } from '@/lib/firebaseAdmin';

// Set auth persistence to local (IndexedDB)
// This ensures the user stays logged in between page refreshes
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Error setting auth persistence:", error);
  // Log more detailed information about the error
  if (error instanceof Error) {
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
  }
});

// Create a Google auth provider
const googleProvider = new GoogleAuthProvider();

// Function to sign in with Google
export const signInWithGoogle = async () => {
  try {
    // Ensure we're using local persistence
    await setPersistence(auth, browserLocalPersistence);
    
    console.log('Attempting Google sign-in...');
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Try to set up Firebase rules (this will help with permissions)
    try {
      await setupFirebaseRules();
    } catch (ruleError) {
      console.warn('Unable to set up Firebase rules, continuing anyway:', ruleError);
    }
    
    console.log('Google sign-in successful, saving user to database...');
    // Save user info to database
    await saveUserToDatabase(user);
    
    // Store critical user data in localStorage
    localStorage.setItem('user_displayName', user.displayName || '');
    localStorage.setItem('user_photoURL', user.photoURL || '');
    localStorage.setItem('user_uid', user.uid);
    
    console.log('User data saved successfully:', user.uid);
    return user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    // Log more detailed information about the error
    if (error instanceof Error) {
      console.error("Google sign-in error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
        code: error.hasOwnProperty('code') ? (error as any).code : 'unknown'
      });
    }
    throw error;
  }
};

// Function to sign out
export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

// Save user to database when they sign in
const saveUserToDatabase = async (user: User) => {
  try {
    if (!user || !user.uid) {
      throw new Error('Invalid user object provided to saveUserToDatabase');
    }
    
    console.log('Saving user to database:', user.uid);
    
    // Define the user data to save
    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: Date.now(),
      lastLogin: Date.now(),
      updatedAt: Date.now(),
      userType: null, // Will be set later when user selects customer or driver
      phoneNumber: null,
      phoneVerified: false,
      preferences: {
        notifications: true,
        darkMode: false
      },
      // Store authentication provider information
      authProvider: 'google'
    };
    
    // Try all possible paths with fallback mechanism
    let savedSuccessfully = false;
    let savedData = null;
    
    // List of paths to try in order of preference
    const pathsToTry = [
      `users/${user.uid}`,
      `TriptakerUsers/${user.uid}`,
      `app_users/${user.uid}`,
      `userProfiles/${user.uid}`
    ];
    
    // Try each path until one works
    for (const path of pathsToTry) {
      try {
        console.log(`Attempting to save user data to path: ${path}`);
        const userRef = ref(database, path);
        
        // Check if user already exists in this path
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
          console.log(`User exists in ${path}, updating data...`);
          // Update existing user data
          const updateData = {
            lastLogin: Date.now(),
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            updatedAt: Date.now()
          };
          
          await update(userRef, updateData);
          console.log(`User data updated successfully in ${path}`);
          savedSuccessfully = true;
          savedData = { ...snapshot.val(), ...updateData };
          break;
        } else {
          console.log(`Creating new user in ${path}...`);
          // Create new user entry
          await set(userRef, userData);
          console.log(`New user created successfully in ${path}`);
          savedSuccessfully = true;
          savedData = userData;
          break;
        }
      } catch (pathError) {
        console.warn(`Failed to save to ${path}:`, pathError);
        // Continue to next path
      }
    }
    
    if (!savedSuccessfully) {
      // Skip trying to write to a public path as it causes permission errors
      // Go straight to localStorage as the final fallback
      try {
        localStorage.setItem('user_data', JSON.stringify({
          ...userData,
          _source: 'localStorage_fallback',
          _timestamp: Date.now()
        }));
        console.log('Saved user data to localStorage as fallback');
        savedData = userData;
      } catch (storageError) {
        console.log('Could not save to localStorage:', storageError instanceof Error ? storageError.message : 'unknown error');
      }
    }
    
    // Return the saved data
    return savedData;
  } catch (error) {
    console.error("Error saving user to database:", error);
    // Log more detailed information about the error
    if (error instanceof Error) {
      console.error("Database save error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
        uid: user?.uid || 'unknown'
      });
    }
    
    // Don't throw the error, instead return basic user info to allow login
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      _errorFallback: true
    };
  }
};

// Function to check if user exists and get their data
export const getUserData = async (userId: string) => {
  try {
    if (!userId) {
      throw new Error('Invalid userId provided to getUserData');
    }
    
    console.log('Getting user data for:', userId);
    
    // Try multiple paths with fallback mechanism
    const pathsToTry = [
      `users/${userId}`,
      `TriptakerUsers/${userId}`,
      `app_users/${userId}`,
      `userProfiles/${userId}`,
      `.public_data/users/${userId}`
    ];
    
    // Try each path until we find user data
    for (const path of pathsToTry) {
      try {
        console.log(`Checking for user data in path: ${path}`);
        const userRef = ref(database, path);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
          console.log(`User data found in ${path}`);
          return snapshot.val();
        }
      } catch (pathError) {
        console.warn(`Failed to read from ${path}:`, pathError);
        // Continue to next path
      }
    }
    
    // Check localStorage as final fallback
    const localData = localStorage.getItem('user_data');
    if (localData) {
      try {
        const parsedData = JSON.parse(localData);
        if (parsedData.uid === userId) {
          console.log('Found user data in localStorage');
          return parsedData;
        }
      } catch (parseError) {
        console.error('Error parsing localStorage data:', parseError);
      }
    }
    
    console.log('No user data found in any location for ID:', userId);
    return null;
  } catch (error) {
    console.error("Error getting user data:", error);
    // Log more detailed information about the error
    if (error instanceof Error) {
      console.error("Get user data error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
        userId: userId || 'unknown'
      });
    }
    return null;
  }
};

// Function to update user data
export const updateUserData = async (userId: string, data: any) => {
  try {
    if (!userId) {
      throw new Error('Invalid userId provided to updateUserData');
    }
    
    console.log('Updating user data for:', userId);
    
    // Prepare update data
    const updatedData = {
      ...data,
      updatedAt: Date.now()
    };
    
    // Try multiple paths with fallback mechanism
    const pathsToTry = [
      `users/${userId}`,
      `TriptakerUsers/${userId}`,
      `app_users/${userId}`,
      `userProfiles/${userId}`,
      `.public_data/users/${userId}`
    ];
    
    let updateSuccess = false;
    
    // Try each path until one works
    for (const path of pathsToTry) {
      try {
        console.log(`Attempting to update user data in path: ${path}`);
        const userRef = ref(database, path);
        
        // Check if user exists in this path
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
          console.log(`User exists in ${path}, updating data...`);
          // Update existing user data
          await update(userRef, updatedData);
          console.log(`User data updated successfully in ${path}`);
          updateSuccess = true;
          break;
        } else {
          console.log(`User doesn't exist in ${path}, creating new entry...`);
          // Create new user entry
          const newUserData = {
            uid: userId,
            ...data,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastLogin: Date.now()
          };
          
          await set(userRef, newUserData);
          console.log(`New user created successfully in ${path}`);
          updateSuccess = true;
          break;
        }
      } catch (pathError) {
        console.warn(`Failed to update in ${path}:`, pathError);
        // Continue to next path
      }
    }
    
    // If all database paths failed, store in localStorage
    if (!updateSuccess) {
      console.log('Storing user data in localStorage as fallback');
      // Try to get existing data first
      let existingData = {};
      try {
        const localData = localStorage.getItem('user_data');
        if (localData) {
          existingData = JSON.parse(localData);
        }
      } catch (parseError) {
        console.error('Error parsing localStorage data:', parseError);
      }
      
      // Update and save the data
      const localUserData = {
        ...existingData,
        uid: userId,
        ...data,
        updatedAt: Date.now(),
        _localStorageFallback: true
      };
      
      localStorage.setItem('user_data', JSON.stringify(localUserData));
      console.log('User data saved to localStorage');
    }
    
    // Update profile in Firebase Auth if this is the current user
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === userId) {
      const updateData: {
        displayName?: string;
        photoURL?: string;
      } = {};
      
      // Only include fields that Firebase Auth profile supports
      if (data.displayName) updateData.displayName = data.displayName;
      if (data.photoURL) updateData.photoURL = data.photoURL;
      
      // Only update if there are fields to update
      if (Object.keys(updateData).length > 0) {
        try {
          console.log('Updating Firebase Auth profile with:', updateData);
          
          // Update the profile
          await updateProfile(currentUser, updateData);
          
          // Force a refresh of the token after profile updates
          await currentUser.getIdToken(true);
          
          // Force user reload to ensure we have latest profile data
          await currentUser.reload();
          
          console.log('Profile updated successfully, new profile:', {
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL
          });
          
          // Store in localStorage as well for extra redundancy
          if (data.displayName) localStorage.setItem('user_displayName', data.displayName);
          if (data.photoURL) localStorage.setItem('user_photoURL', data.photoURL);
          
          // Create a global event to notify components of profile updates
          window.dispatchEvent(new CustomEvent('user-profile-updated', { 
            detail: { displayName: currentUser.displayName, photoURL: currentUser.photoURL }
          }));
        } catch (authError) {
          console.error('Error updating Firebase Auth profile:', authError);
          // Continue despite auth error - we don't want to block the whole update
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error updating user data:", error);
    
    // Log more detailed information about the error
    if (error instanceof Error) {
      console.error("Update user data error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
        userId: userId || 'unknown'
      });
    }
    
    // Store in localStorage as ultimate fallback
    try {
      if (userId) {
        localStorage.setItem(`user_data_${userId}`, JSON.stringify({
          ...data,
          _errorFallback: true,
          updatedAt: Date.now()
        }));
        console.log('Saved data to localStorage after error');
      }
    } catch (localError) {
      console.error('Failed to save to localStorage:', localError);
    }
    
    return false;
  }
};

// Function to set user type (customer or driver)
export const setUserType = async (userId: string, userType: 'customer' | 'driver') => {
  return updateUserData(userId, { userType });
};

// Function to set user phone number
export const setUserPhoneNumber = async (userId: string, phoneNumber: string) => {
  return updateUserData(userId, { phoneNumber, phoneVerified: true });
};

// Function to listen to auth state changes
export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Get current user
export const getCurrentUser = () => {
  return auth.currentUser;
};
