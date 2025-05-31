import React, { useState, useEffect, ReactNode } from 'react';
import { Phone, Laptop, ArrowRight } from 'lucide-react';

interface DeviceDetectorProps {
  children: ReactNode;
}

const DeviceDetector: React.FC<DeviceDetectorProps> = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    // Function to check if the device is mobile
    const checkIfMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = [
        'android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'
      ];
      
      // Check for mobile keywords in user agent or if screen width is less than 768px
      const isMobileDevice = mobileKeywords.some(keyword => userAgent.includes(keyword)) || 
                            window.innerWidth < 768;
      
      setIsMobile(isMobileDevice);
    };
    
    // Check on initial render
    checkIfMobile();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);
  
  if (isMobile) {
    // If mobile, render the children components (normal app)
    return <>{children}</>;
  }
  
  // Desktop placeholder UI - Simplified and cleaner design
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-xl p-8 shadow-xl border border-white/20 text-center">
        <div className="mb-6 flex justify-center">
          <div className="bg-blue-500 p-3 rounded-full">
            <Phone size={32} className="text-white" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-3">
          Trip Tracker
        </h1>
        
        <div className="h-px w-16 bg-blue-400/50 mx-auto mb-6"></div>
        
        <p className="text-white/80 mb-8 text-lg">
          Please view this application on a mobile device for the best experience.
        </p>
        
        <div className="flex items-center justify-center mb-8">
          <div className="bg-white/5 border-2 border-white/10 rounded-2xl p-4 w-32 flex items-center justify-center">
            <div className="relative">
              <div className="animate-pulse">
                <Phone size={48} className="text-blue-300" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full"></div>
            </div>
          </div>
        </div>
        
        <p className="text-white/60 text-sm my-2">
          Access from your smartphone
        </p>
      </div>
    </div>
  );
};

export default DeviceDetector;
