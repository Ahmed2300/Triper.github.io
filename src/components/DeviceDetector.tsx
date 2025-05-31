import React, { useState, useEffect, ReactNode } from 'react';
import { Phone, Smartphone } from 'lucide-react';

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
  
  // Desktop placeholder UI with modern smartphone frame
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center relative">
        {/* Phone Frame */}
        <div className="relative mx-auto">
          {/* Outer Phone Frame */}
          <div className="relative w-[300px] h-[600px] bg-gray-900 rounded-[40px] p-3 shadow-2xl mx-auto overflow-hidden">
            {/* Just a small notch */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[80px] h-[12px] bg-black rounded-b-lg z-20"></div>
            
            {/* Phone Content */}
            <div className="w-full h-full rounded-[32px] overflow-hidden bg-blue-900 flex flex-col items-center justify-center relative pt-8">
              {/* App Content */}
              <div className="flex-1 w-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-blue-800 to-indigo-900">
                <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
                  <Phone className="h-8 w-8 text-white" />
                </div>
                
                <h1 className="text-2xl font-bold text-white mb-3 tracking-tight">
                  Trip Tracker
                </h1>
                
                <div className="h-1 w-12 bg-blue-400 rounded-full mx-auto mb-6"></div>
                
                <p className="text-white/90 mb-8 text-sm max-w-[200px] leading-relaxed">
                  Please view this application on a mobile device for the best experience.
                </p>
                
                <div className="mt-6 flex flex-col items-center justify-center">
                  <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20 mb-3">
                    <Smartphone className="h-7 w-7 text-blue-300" />
                  </div>
                  
                  <span className="text-white/80 text-xs font-medium">
                    Access from your smartphone
                  </span>
                </div>
              </div>
              
              {/* Home Indicator */}
              <div className="h-1 w-32 bg-white/50 rounded-full mb-2 mt-4"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceDetector;
