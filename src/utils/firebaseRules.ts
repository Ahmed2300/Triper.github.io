import { auth, database } from '@/lib/firebase';
import { ref, set } from 'firebase/database';
import rules from '../../firebase-rules.json';

/**
 * Utility to apply Firebase rules programmatically
 * Note: This can only test rules locally - to actually update rules on Firebase,
 * you'll need to use the Firebase console or Firebase CLI
 */
export const testFirebaseRules = async (): Promise<boolean> => {
  try {
    console.log('Testing Firebase rules access patterns...');
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('User not authenticated, cannot test rules');
      return false;
    }
    
    // Test users path
    try {
      const usersRef = ref(database, `users/${currentUser.uid}`);
      await set(usersRef, {
        testRuleAccess: true,
        timestamp: Date.now()
      });
      console.log('Successfully wrote to users path');
    } catch (error) {
      console.error('Failed to write to users path:', error);
    }
    
    // Test TriptakerUsers path
    try {
      const triptakerUsersRef = ref(database, `TriptakerUsers/${currentUser.uid}`);
      await set(triptakerUsersRef, {
        testRuleAccess: true,
        timestamp: Date.now()
      });
      console.log('Successfully wrote to TriptakerUsers path');
    } catch (error) {
      console.error('Failed to write to TriptakerUsers path:', error);
    }
    
    // Test rideRequests path
    try {
      const rideRequestsRef = ref(database, `rideRequests/test-${Date.now()}`);
      await set(rideRequestsRef, {
        customerId: currentUser.uid,
        driverId: null,
        status: 'pending',
        timestamp: Date.now(),
        testData: true
      });
      console.log('Successfully wrote to rideRequests path');
    } catch (error) {
      console.error('Failed to write to rideRequests path:', error);
    }
    
    return true;
  } catch (error) {
    console.error('Error testing Firebase rules:', error);
    return false;
  }
};

/**
 * Get the current Firebase rules as a formatted string
 */
export const getFirebaseRulesString = (): string => {
  return JSON.stringify(rules, null, 2);
};

/**
 * Instructions to apply the Firebase rules through the Firebase console
 */
export const getFirebaseRulesInstructions = (): string => {
  return `
To apply these Firebase rules to your project:

1. Go to the Firebase console: https://console.firebase.google.com/
2. Select your project: "wechat-9694d"
3. In the left sidebar, click "Realtime Database"
4. Click on the "Rules" tab
5. Replace the current rules with the rules from your firebase-rules.json file
6. Click "Publish" to apply the rules

The rules will allow:
- Users to read and write their own data
- Public access to ride requests
- Proper indexing for efficient queries
- Location tracking for drivers
- Notification management
- Rating system
`;
};
