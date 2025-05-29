/**
 * Utility functions for mobile compatibility
 */

/**
 * Detects if the application is running in a WebView environment
 * This is useful for handling platform-specific functionality
 */
export const isRunningInWebView = (): boolean => {
  // Check for common WebView identifiers in the user agent
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Android WebView
  if (userAgent.includes('wv')) return true;
  
  // iOS WebView
  if (userAgent.includes('safari') && userAgent.includes('mobile') && !userAgent.includes('chrome') && !userAgent.includes('firefox')) {
    // Safari mobile without another browser identifier could be a WebView
    return window.navigator.hasOwnProperty('standalone');
  }
  
  // Check for a custom identifier that might be added by your WebView implementation
  if (window.hasOwnProperty('ReactNativeWebView') || window.hasOwnProperty('TripTrackerWebView')) {
    return true;
  }
  
  // Fallback detection method - try to access features that might be limited in WebViews
  try {
    // In some WebViews, window.open might be restricted
    const popup = window.open('', '_blank');
    if (!popup || popup.closed) return true;
    popup.close();
  } catch (e) {
    return true; // Error when opening a window could indicate a WebView
  }
  
  return false;
};
