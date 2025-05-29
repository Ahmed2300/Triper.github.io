import { database } from '@/lib/firebase';
import { ref, push, set, onValue, off, serverTimestamp, query, orderByChild, equalTo, get } from 'firebase/database';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface RideRequest {
  id?: string;
  customerId: string;
  customerName?: string;
  customerPhoneNumber?: string;
  requestTime: number;
  pickupLocation: Location;
  pickupAddress?: string;
  destinationLocation?: Location;
  destinationAddress?: string;
  status: 'pending' | 'accepted' | 'started' | 'completed' | 'cancelled';
  driverId?: string;
  driverName?: string;
  driverPhoneNumber?: string;
  startTime?: number;
  endTime?: number;
  cancelTime?: number; // Add timestamp for when ride was cancelled
  startTripLocation?: Location;
  currentDriverLocation?: Location;
  calculatedMileage: number;
  estimatedPrice?: number; // This will be manually set by the customer
  manualPrice?: boolean; // Flag to indicate if price was manually set
}

export const createRideRequest = async (rideData: Omit<RideRequest, 'id' | 'requestTime' | 'calculatedMileage' | 'status'>) => {
  const ridesRef = ref(database, 'rideRequests');
  const newRideRef = push(ridesRef);
  
  const rideRequest: Omit<RideRequest, 'id'> = {
    ...rideData,
    requestTime: Date.now(),
    status: 'pending',
    calculatedMileage: 0
  };
  
  await set(newRideRef, rideRequest);
  return newRideRef.key;
};

export const updateRideRequest = async (rideId: string, updates: Partial<RideRequest>) => {
  const rideRef = ref(database, `rideRequests/${rideId}`);
  
  // First get the current ride data
  const snapshot = await get(rideRef);
  if (snapshot.exists()) {
    // Update only the specified fields, preserving other data
    await set(rideRef, { ...snapshot.val(), ...updates });
  } else {
    await set(rideRef, updates);
  }
};

/**
 * Cancel a ride request
 * @param rideId The ID of the ride to cancel
 * @returns Promise that resolves when the cancellation is complete
 */
export const cancelRide = async (rideId: string): Promise<void> => {
  try {
    const rideRef = ref(database, `rideRequests/${rideId}`);
    
    // Get current ride data
    const snapshot = await get(rideRef);
    if (!snapshot.exists()) {
      throw new Error('Ride not found');
    }
    
    const rideData = snapshot.val() as RideRequest;
    
    // Only allow cancellation if the ride is in pending or accepted status
    if (rideData.status !== 'pending' && rideData.status !== 'accepted') {
      throw new Error(`Cannot cancel ride with status: ${rideData.status}`);
    }
    
    // Update the ride status to cancelled
    await updateRideRequest(rideId, {
      status: 'cancelled',
      cancelTime: Date.now(),
    });
    
    console.log(`Ride ${rideId} cancelled successfully`);
  } catch (error) {
    console.error('Error cancelling ride:', error);
    throw error;
  }
};

export const listenToRideRequest = (rideId: string, callback: (ride: RideRequest | null) => void) => {
  const rideRef = ref(database, `rideRequests/${rideId}`);
  const unsubscribe = onValue(rideRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback({ ...data, id: rideId });
    } else {
      callback(null);
    }
  });
  
  return () => off(rideRef, 'value', unsubscribe);
};

export const listenToPendingRides = (callback: (rides: RideRequest[]) => void) => {
  const ridesRef = ref(database, 'rideRequests');
  const pendingQuery = query(ridesRef, orderByChild('status'), equalTo('pending'));
  
  const unsubscribe = onValue(pendingQuery, (snapshot) => {
    const rides: RideRequest[] = [];
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val();
      rides.push({ ...data, id: childSnapshot.key });
    });
    callback(rides);
  });
  
  return () => off(pendingQuery, 'value', unsubscribe);
};

/**
 * Check if a customer has any active ride requests
 * Active means pending, accepted, or started - not completed or cancelled
 */
export const checkCustomerActiveRide = async (customerId: string): Promise<RideRequest | null> => {
  const ridesRef = ref(database, 'rideRequests');
  const customerQuery = query(ridesRef, orderByChild('customerId'), equalTo(customerId));
  
  const snapshot = await get(customerQuery);
  if (!snapshot.exists()) return null;
  
  let activeRide: RideRequest | null = null;
  
  snapshot.forEach((childSnapshot) => {
    const data = childSnapshot.val() as RideRequest;
    // Only consider active status types
    if (['pending', 'accepted', 'started'].includes(data.status)) {
      activeRide = { ...data, id: childSnapshot.key };
      // We found an active ride, no need to continue
      return true; 
    }
  });
  
  return activeRide;
};

/**
 * Check if a driver has any active ride requests
 * Active means accepted or started - not pending, completed or cancelled
 */
export const checkDriverActiveRide = async (driverId: string): Promise<RideRequest | null> => {
  const ridesRef = ref(database, 'rideRequests');
  const driverQuery = query(ridesRef, orderByChild('driverId'), equalTo(driverId));
  
  const snapshot = await get(driverQuery);
  if (!snapshot.exists()) return null;
  
  let activeRide: RideRequest | null = null;
  
  snapshot.forEach((childSnapshot) => {
    const data = childSnapshot.val() as RideRequest;
    // Only consider active status types for drivers
    if (['accepted', 'started'].includes(data.status)) {
      activeRide = { ...data, id: childSnapshot.key };
      // We found an active ride, no need to continue
      return true; 
    }
  });
  
  return activeRide;
};

/**
 * Listen to active ride for a customer
 * This will provide updates as the ride status changes
 */
export const listenToCustomerActiveRide = (customerId: string, callback: (ride: RideRequest | null) => void) => {
  const ridesRef = ref(database, 'rideRequests');
  const customerQuery = query(ridesRef, orderByChild('customerId'), equalTo(customerId));
  
  const unsubscribe = onValue(customerQuery, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    
    let activeRide: RideRequest | null = null;
    
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val() as RideRequest;
      // Only consider active status types
      if (['pending', 'accepted', 'started'].includes(data.status)) {
        activeRide = { ...data, id: childSnapshot.key };
        // We found an active ride, no need to continue
        return true; 
      }
    });
    
    callback(activeRide);
  });
  
  return () => off(customerQuery, 'value', unsubscribe);
};

/**
 * Listen to ALL rides for a customer
 * This will provide updates for all rides (active, completed, cancelled) for a customer
 */
export const listenToAllCustomerRides = (customerId: string, callback: (rides: RideRequest[]) => void) => {
  const ridesRef = ref(database, 'rideRequests');
  const customerQuery = query(ridesRef, orderByChild('customerId'), equalTo(customerId));
  
  const unsubscribe = onValue(customerQuery, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    
    const rides: RideRequest[] = [];
    
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val() as RideRequest;
      rides.push({ ...data, id: childSnapshot.key });
    });
    
    // Sort by requestTime descending (newest first)
    rides.sort((a, b) => {
      // Convert string requestTime to number if needed
      const timeA = typeof a.requestTime === 'string' ? new Date(a.requestTime).getTime() : a.requestTime;
      const timeB = typeof b.requestTime === 'string' ? new Date(b.requestTime).getTime() : b.requestTime;
      return timeB - timeA;
    });
    
    callback(rides);
  });
  
  return () => off(customerQuery, 'value', unsubscribe);
};

/**
 * Listen to active ride for a driver
 * This will provide updates as the ride status changes
 */
export const listenToDriverActiveRide = (driverId: string, callback: (ride: RideRequest | null) => void) => {
  const ridesRef = ref(database, 'rideRequests');
  const driverQuery = query(ridesRef, orderByChild('driverId'), equalTo(driverId));
  
  const unsubscribe = onValue(driverQuery, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    
    let activeRide: RideRequest | null = null;
    
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val() as RideRequest;
      // Only consider active status types for drivers
      if (['accepted', 'started'].includes(data.status)) {
        activeRide = { ...data, id: childSnapshot.key };
        // We found an active ride, no need to continue
        return true; 
      }
    });
    
    callback(activeRide);
  });
  
  return () => off(driverQuery, 'value', unsubscribe);
};

/**
 * Get ride history for a customer (completed and cancelled rides)
 */
export const getCustomerRideHistory = async (customerId: string): Promise<RideRequest[]> => {
  const ridesRef = ref(database, 'rideRequests');
  const customerQuery = query(ridesRef, orderByChild('customerId'), equalTo(customerId));
  
  const snapshot = await get(customerQuery);
  if (!snapshot.exists()) return [];
  
  const history: RideRequest[] = [];
  
  snapshot.forEach((childSnapshot) => {
    const data = childSnapshot.val() as RideRequest;
    // Only include completed or cancelled rides
    if (['completed', 'cancelled'].includes(data.status)) {
      history.push({ ...data, id: childSnapshot.key });
    }
  });
  
  // Sort by request time, newest first
  return history.sort((a, b) => b.requestTime - a.requestTime);
};

/**
 * Get ride history for a driver (completed rides)
 */
export const getDriverRideHistory = async (driverId: string): Promise<RideRequest[]> => {
  const ridesRef = ref(database, 'rideRequests');
  const driverQuery = query(ridesRef, orderByChild('driverId'), equalTo(driverId));
  
  const snapshot = await get(driverQuery);
  if (!snapshot.exists()) return [];
  
  const history: RideRequest[] = [];
  
  snapshot.forEach((childSnapshot) => {
    const data = childSnapshot.val() as RideRequest;
    // Only include completed rides
    if (data.status === 'completed') {
      history.push({ ...data, id: childSnapshot.key });
    }
  });
  
  // Sort by request time, newest first
  return history.sort((a, b) => b.requestTime - a.requestTime);
};
