
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Search } from "lucide-react";
import { Location } from "@/services/firebaseService";

interface DestinationInputProps {
  onDestinationSelected: (location: Location, address: string) => void;
  selectedDestination?: { location: Location; address: string };
}

const DestinationInput = ({ onDestinationSelected, selectedDestination }: DestinationInputProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ address: string; location: Location }>>([]);

  // Mock geocoding - in production you'd use Google Places API
  const searchDestination = async () => {
    if (!searchQuery.trim()) return;

    // Simulate search results
    const mockResults = [
      {
        address: `${searchQuery} - Main St, Los Angeles, CA`,
        location: { latitude: 34.0522 + Math.random() * 0.01, longitude: -118.2437 + Math.random() * 0.01 }
      },
      {
        address: `${searchQuery} - Downtown, Los Angeles, CA`,
        location: { latitude: 34.0522 + Math.random() * 0.01, longitude: -118.2437 + Math.random() * 0.01 }
      },
      {
        address: `${searchQuery} - Hollywood, CA`,
        location: { latitude: 34.0928 + Math.random() * 0.01, longitude: -118.3287 + Math.random() * 0.01 }
      }
    ];

    setSuggestions(mockResults);
  };

  const selectDestination = (destination: { address: string; location: Location }) => {
    onDestinationSelected(destination.location, destination.address);
    setSuggestions([]);
    setSearchQuery("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Where would you like to go?"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && searchDestination()}
        />
        <Button onClick={searchDestination} size="icon">
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {selectedDestination && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Destination: {selectedDestination.address}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {suggestions.length > 0 && (
        <Card>
          <CardContent className="p-2">
            <div className="space-y-1">
              {suggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  className="w-full justify-start h-auto p-2"
                  onClick={() => selectDestination(suggestion)}
                >
                  <MapPin className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="text-sm">{suggestion.address}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DestinationInput;
