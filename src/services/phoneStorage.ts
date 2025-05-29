import { database } from '@/lib/firebase';
import { ref, set, get } from 'firebase/database';

// Interface for phone storage
interface PhoneData {
  phoneNumber: string;
  userType: 'customer' | 'driver';
  verified: boolean;
  timestamp: number;
}

/**
 * Save phone number to local storage and Firebase
 * This doesn't require authentication
 */
export const savePhoneNumber = async (
  userId: string, 
  phoneNumber: string,
  userType: 'customer' | 'driver' = 'customer'
): Promise<void> => {
  // First, save to local storage as a backup
  localStorage.setItem('phone_number', phoneNumber);
  localStorage.setItem('user_type', userType);
  localStorage.setItem('user_id', userId);
  
  // Then attempt to save to Firebase (without requiring authentication)
  try {
    const phoneRef = ref(database, `phone_numbers/${userId}`);
    
    const phoneData: PhoneData = {
      phoneNumber,
      userType,
      verified: true, // Just format validation, not SMS verification
      timestamp: Date.now()
    };
    
    await set(phoneRef, phoneData);
  } catch (error) {
    console.log('Saved to local storage only, Firebase save failed:', error);
    // Still return success since we saved to localStorage
  }
};

/**
 * Get phone number from local storage or Firebase
 * Tries localStorage first, then Firebase as fallback
 */
export const getPhoneNumber = async (userId: string): Promise<string | null> => {
  // Try local storage first (faster)
  const localPhone = localStorage.getItem('phone_number');
  if (localPhone) {
    return localPhone;
  }
  
  // Try Firebase as backup
  try {
    const phoneRef = ref(database, `phone_numbers/${userId}`);
    const snapshot = await get(phoneRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val() as PhoneData;
      // Save to localStorage for next time
      localStorage.setItem('phone_number', data.phoneNumber);
      localStorage.setItem('user_type', data.userType);
      return data.phoneNumber;
    }
  } catch (error) {
    console.log('Failed to get phone from Firebase:', error);
  }
  
  return null;
};

/**
 * Check if user has a stored phone number
 */
export const hasStoredPhoneNumber = async (userId: string): Promise<boolean> => {
  const phoneNumber = await getPhoneNumber(userId);
  return !!phoneNumber;
};
