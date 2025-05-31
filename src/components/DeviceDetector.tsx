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
  
  // Desktop placeholder UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-700 flex flex-col items-center justify-center text-white p-6">
      <div className="max-w-2xl w-full backdrop-blur-md bg-black/30 rounded-2xl p-8 shadow-2xl border border-white/10">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-gradient-to-r from-sky-400 to-blue-600 p-4 rounded-full">
            <Phone size={40} className="text-white" />
          </div>
          <div className="mx-4">
            <ArrowRight size={24} className="text-white/70" />
          </div>
          <div className="bg-white/10 p-4 rounded-full">
            <Laptop size={40} className="text-white/70" />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold text-center mb-2 bg-clip-text text-transparent bg-gradient-to-r from-sky-300 to-blue-500">
          Trip Tracker Mobile App
        </h1>
        
        <p className="text-xl text-center mb-8 text-white/80">
          This application is designed for mobile devices only
        </p>
        
        <div className="relative max-w-xs mx-auto mb-8 animate-bounce duration-[4000ms] ease-in-out">
          <div className="border-8 border-gray-800 rounded-3xl overflow-hidden shadow-xl p-2 bg-black">
            <div className="rounded-2xl overflow-hidden aspect-[9/16] bg-gradient-to-b from-blue-800 to-indigo-900 flex items-center justify-center">
              <div className="text-center p-4">
                <div className="flex justify-center">
                  <div className="animate-pulse">
                    <Phone size={48} className="text-white" />
                  </div>
                </div>
                <p className="mt-3 text-white/90 font-medium">App Preview</p>
              </div>
            </div>
            <div className="flex justify-center mt-2">
              <div className="w-20 h-2 rounded-full bg-gray-700"></div>
            </div>
          </div>
        </div>
        
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Please switch to a mobile device</h2>
          <p className="text-white/70 mb-6">
            For the best experience, open Trip Tracker on your smartphone or tablet.
          </p>
          <div className="flex flex-col gap-4 md:flex-row justify-center">
            <div className="flex items-center p-4 bg-white/10 rounded-lg">
              <div className="mr-3 bg-indigo-500/20 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="text-indigo-300"><path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3"></path><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"></path><path d="M12 8v8"></path><path d="M8 12h8"></path></svg>
              </div>
              <div>
                <p className="font-medium">Scan QR Code</p>
                <p className="text-sm text-white/60">Use your phone's camera</p>
              </div>
            </div>
            <div className="flex items-center p-4 bg-white/10 rounded-lg">
              <div className="mr-3 bg-teal-500/20 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="text-teal-300"><path d="M9 17H7A5 5 0 0 1 7 7h2"></path><path d="M15 7h2a5 5 0 1 1 0 10h-2"></path><line x1="8" y1="12" x2="16" y2="12"></line></svg>
              </div>
              <div>
                <p className="font-medium">Share Link</p>
                <p className="text-sm text-white/60">Send to your mobile device</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Add animation styles via Tailwind classes instead of jsx style tag */}
    </div>
  );
};

export default DeviceDetector;
