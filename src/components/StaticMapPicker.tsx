import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Location } from '@/services/firebaseService';
import { Badge } from '@/components/ui/badge';
import { MapPin, CheckCircle2, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAddressFromLocation } from '@/services/locationService';

interface StaticMapPickerProps {
  initialLocation: Location;
  initialAddress: string;
  onSelectLocation: (location: Location, address: string) => void;
  onClose?: () => void;
}

const StaticMapPicker = ({
  initialLocation,
  initialAddress,
  onSelectLocation,
  onClose
}: StaticMapPickerProps) => {
  const [location, setLocation] = useState<Location>(initialLocation);
  const [address, setAddress] = useState(initialAddress);
  const [isLoading, setIsLoading] = useState(false);
  
  // Update address based on new location
  const updateAddress = async (newLocation: Location) => {
    setIsLoading(true);
    try {
      const newAddress = await getAddressFromLocation(newLocation);
      setAddress(newAddress);
    } catch (error) {
      console.error('Error getting address:', error);
      setAddress('Selected location');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle location adjustment
  const adjustLocation = (direction: 'north' | 'south' | 'east' | 'west', amount: number = 0.0005) => {
    const newLocation = { ...location };
    
    switch (direction) {
      case 'north':
        newLocation.latitude += amount;
        break;
      case 'south':
        newLocation.latitude -= amount;
        break;
      case 'east':
        newLocation.longitude += amount;
        break;
      case 'west':
        newLocation.longitude -= amount;
        break;
    }
    
    setLocation(newLocation);
    updateAddress(newLocation);
  };
  
  // Handle confirmation
  const handleConfirmLocation = () => {
    onSelectLocation(location, address);
    if (onClose) onClose();
  };
  
  // Reset to initial location
  const handleReset = () => {
    setLocation(initialLocation);
    setAddress(initialAddress);
  };
  
  // Generate static map URL using OpenStreetMap
  const getStaticMapUrl = () => {
    const zoom = 16;
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${location.latitude},${location.longitude}&zoom=${zoom}&size=600x400&maptype=mapnik&markers=${location.latitude},${location.longitude},red-pushpin`;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            Select Exact Location
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Use arrows to adjust
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Map display */}
        <div className="relative rounded-md overflow-hidden border h-[300px] flex flex-col">
          <img 
            src={getStaticMapUrl()} 
            alt="Map location" 
            className="w-full h-full object-cover"
          />
          
          {/* Map controls overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="h-6 w-6 rounded-full bg-red-500 border-2 border-white shadow-lg"></div>
            </div>
          </div>
          
          {/* Direction controls */}
          <div className="absolute inset-x-0 bottom-4 flex justify-center">
            <div className="grid grid-cols-3 gap-1 pointer-events-auto">
              <div></div>
              <Button 
                variant="secondary" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => adjustLocation('north')}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <div></div>
              <Button 
                variant="secondary" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => adjustLocation('west')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div></div>
              <Button 
                variant="secondary" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => adjustLocation('east')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div></div>
              <Button 
                variant="secondary" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => adjustLocation('south')}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <div></div>
            </div>
          </div>
          
          {/* Fine adjustment controls */}
          <div className="absolute top-3 right-3 flex flex-col gap-1 pointer-events-auto">
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-7 text-xs px-2"
              onClick={() => adjustLocation('north', 0.0001)}
            >
              Fine
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-7 text-xs px-2"
              onClick={() => adjustLocation('north', 0.001)}
            >
              Medium
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-7 text-xs px-2"
              onClick={() => adjustLocation('north', 0.005)}
            >
              Large
            </Button>
          </div>
        </div>

        {/* Selected location info */}
        <div className="bg-muted p-3 rounded-md">
          <p className="text-sm font-medium mb-1">Selected Location:</p>
          <p className="text-sm text-muted-foreground break-words">
            {isLoading ? 'Loading address...' : address}
          </p>
          <div className="text-xs text-muted-foreground mt-1">
            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-1"
            onClick={handleReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button 
            className="flex items-center gap-1 ml-auto"
            onClick={handleConfirmLocation}
          >
            <CheckCircle2 className="h-4 w-4" />
            Confirm Location
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default StaticMapPicker;
