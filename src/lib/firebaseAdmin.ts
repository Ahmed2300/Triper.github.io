import { database, auth } from './firebase';
import { ref, set, update, get, onValue, off } from 'firebase/database';

/**
 * Checks Firebase database access permissions without generating console errors
 * This is a read-only version that doesn't attempt any writes
 */
export const checkFirebaseAccess = async (): Promise<{[key: string]: boolean}> => {
  const results: {[key: string]: boolean} = {
    users: false,
    triptakerUsers: false,
    rideRequests: false,
    authenticated: false
  };

  try {
    console.log('Checking Firebase access (read-only)...');
    
    // First check if user is authenticated
    const currentUser = auth.currentUser;
    if (currentUser) {
      results.authenticated = true;
      console.log('User authenticated:', currentUser.uid);
    } else {
      console.log('No authenticated user');
      return results;
    }
    
    // Check users path with read-only operation
    try {
      const usersRef = ref(database, `users/${currentUser.uid}`);
      const snapshot = await get(usersRef);
      results.users = snapshot.exists();
      console.log('Users path access:', results.users ? 'Available' : 'Not available or empty');
    } catch (error) {
      console.log('Users path not accessible');
    }
    
    // Check TriptakerUsers path with read-only operation
    try {
      const triptakerUsersRef = ref(database, `TriptakerUsers/${currentUser.uid}`);
      const snapshot = await get(triptakerUsersRef);
      results.triptakerUsers = snapshot.exists();
      console.log('TriptakerUsers path access:', results.triptakerUsers ? 'Available' : 'Not available or empty');
    } catch (error) {
      console.log('TriptakerUsers path not accessible');
    }
    
    // Check rideRequests path with read-only operation
    try {
      const rideRequestsRef = ref(database, 'rideRequests');
      const snapshot = await get(rideRequestsRef);
      results.rideRequests = true; // Just checking access, not necessarily existence
      console.log('RideRequests path access:', 'Available');
    } catch (error) {
      console.log('RideRequests path not accessible');
    }
    
    return results;
  } catch (error) {
    // Log at info level to avoid console errors
    console.log('Firebase access check completed with issues');
    return results;
  }
};

/**
 * Attempts to create necessary database entries if permissions allow
 * Gracefully handles permission errors without console errors
 */
export const setupFirebaseRules = async () => {
  try {
    // Check if user is authenticated
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('Not authenticated, using localStorage only');
      return false;
    }
    
    // Get user info to store
    const uid = currentUser.uid;
    const userData = {
      uid,
      email: currentUser.email,
      displayName: currentUser.displayName,
      photoURL: currentUser.photoURL,
      lastLogin: Date.now(),
      updatedAt: Date.now()
    };
    
    // First check which paths are accessible before attempting writes
    const accessResults = await checkFirebaseAccess();
    console.log('Access check results:', accessResults);
    
    // Try to write to users path if we have access
    let success = false;
    if (accessResults.users) {
      try {
        const userRef = ref(database, `users/${uid}`);
        // First check if user exists
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
          // Update last login
          await update(userRef, {
            lastLogin: Date.now(),
            updatedAt: Date.now()
          });
        } else {
          // Create new user
          await set(userRef, {
            ...userData,
            createdAt: Date.now()
          });
        }
        success = true;
        console.log('Users path updated successfully');
      } catch (e) {
        // Log at info level
        console.log('Could not write to users path');
      }
    }
    
    // Always store in localStorage as fallback
    try {
      localStorage.setItem('user_data', JSON.stringify({
        ...userData,
        _source: 'firebase_setup',
        _timestamp: Date.now()
      }));
      console.log('User data saved to localStorage');
    } catch (storageError) {
      console.log('localStorage not available');
    }
    
    return success;
  } catch (error) {
    // Log at info level to avoid console errors
    console.log('Firebase setup completed with warnings');
    return false;
  }
};

/**
 * Updates the service to use the correct path based on permissions
 */
export const determineValidFirebasePath = async (): Promise<string> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return 'users';
    
    // Try TriptakerUsers path first
    try {
      const testRef = ref(database, `TriptakerUsers/${currentUser.uid}`);
      await get(testRef);
      return 'TriptakerUsers';
    } catch (error) {
      console.log('TriptakerUsers path not accessible, using users path instead');
      return 'users';
    }
  } catch (error) {
    console.error('Error determining valid path:', error);
    return 'users'; // Default fallback
  }
};
