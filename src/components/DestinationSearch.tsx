import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchIcon, Loader2, MapPin, History, X, Map as MapIcon } from "lucide-react";
import { PlaceResult } from "@/services/locationService";
import { searchPlacesEnhanced } from "@/services/enhancedLocationService";
import { Location } from "@/services/firebaseService";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import OpenStreetMapPicker from "./OpenStreetMapPicker";

// Custom debounce hook for search as you type
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface DestinationSearchProps {
  currentLocation: Location | null;
  onSelectDestination: (destination: { location: Location; address: string }) => void;
  className?: string;
  location?: Location;
  address?: string;
}

const DestinationSearch = ({
  currentLocation,
  onSelectDestination,
  className = "",
  location,
  address,
}: DestinationSearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [recentSearches, setRecentSearches] = useState<PlaceResult[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [autoSearchEnabled, setAutoSearchEnabled] = useState(true); // Flag to control auto-search
  const [showMapSelector, setShowMapSelector] = useState(false); // Show/hide map selector
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null); // Currently selected place for map adjustment
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Debounce the search query to avoid making too many API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 500); // 500ms delay
  
  // Initialize with existing location if provided
  useEffect(() => {
    if (address) {
      setSearchQuery(address);
    }
  }, [address]);

  // Save recent searches to local storage
  const saveRecentSearch = useCallback((place: PlaceResult) => {
    const storedRecent = localStorage.getItem('recentSearches');
    let recentPlaces: PlaceResult[] = [];
    
    if (storedRecent) {
      try {
        recentPlaces = JSON.parse(storedRecent);
      } catch (e) {
        console.error('Error parsing recent searches:', e);
      }
    }
    
    // Remove duplicates by id
    const existingIndex = recentPlaces.findIndex(p => p.id === place.id);
    if (existingIndex !== -1) {
      recentPlaces.splice(existingIndex, 1);
    }
    
    // Add to beginning of array and limit to 5 items
    recentPlaces.unshift(place);
    if (recentPlaces.length > 5) {
      recentPlaces = recentPlaces.slice(0, 5);
    }
    
    localStorage.setItem('recentSearches', JSON.stringify(recentPlaces));
    setRecentSearches(recentPlaces);
  }, []);
  
  // Load recent searches from local storage
  useEffect(() => {
    const storedRecent = localStorage.getItem('recentSearches');
    if (storedRecent) {
      try {
        const recentPlaces = JSON.parse(storedRecent);
        setRecentSearches(recentPlaces);
      } catch (e) {
        console.error('Error loading recent searches:', e);
      }
    }
  }, []);

  // Handle search query changes with more detailed error handling
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      console.log(`Searching for: "${searchQuery}" near:`, currentLocation);
      
      // Search using the enhanced location service with updated API
      const results = await searchPlacesEnhanced(searchQuery, currentLocation, 10);
      console.log(`Got ${results.length} search results for "${searchQuery}":`); 
      console.log(results);
      
      if (results && results.length > 0) {
        // Make sure all required fields exist before displaying
        const validResults = results.filter(r => r.name && r.location && r.location.latitude);
        setSearchResults(validResults);
        setShowResults(true);
        setShowRecent(false);
      } else {
        setSearchResults([]);
        setShowResults(true);
      }
    } catch (error) {
      console.error("Error searching for places:", error);
      // Show error to user
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Clear results if query is empty
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      setShowResults(false);
    }
  }, [searchQuery]);
  
  // Auto-search when debounced query changes and has at least 2 characters
  useEffect(() => {
    if (autoSearchEnabled && debouncedSearchQuery.trim().length >= 2) {
      handleSearch();
    }
  }, [debouncedSearchQuery, autoSearchEnabled]);

  // Handle click outside to close results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle selection of a place
  const handleSelectPlace = (place: PlaceResult) => {
    // Store the selected place for potential map adjustment
    setSelectedPlace(place);
    setSearchQuery(place.address);
    setShowResults(false);
    setShowRecent(false);
    
    // Save to recent searches
    saveRecentSearch(place);
    
    // Either show map selector or directly select the destination
    if (place.accuracy === 'exact') {
      // If location is already precise, no need for map adjustment
      finalizeDestinationSelection(place.location, place.address);
    } else {
      // Show map selector for fine-tuning
      setShowMapSelector(true);
    }
  };
  
  // Finalize destination selection (either direct or after map adjustment)
  const finalizeDestinationSelection = (location: Location, address: string) => {
    onSelectDestination({
      location: location,
      address: address,
    });
  };
  
  // Clear search query
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    inputRef.current?.focus();
  };
  
  // Toggle recent searches
  const toggleRecentSearches = () => {
    if (showRecent) {
      setShowRecent(false);
    } else {
      setShowRecent(true);
      setShowResults(false);
    }
  };

  // Format distance for display
  const formatDistance = (distance?: number) => {
    if (distance === undefined) return "";
    return distance < 1
      ? `${Math.round(distance * 1000)}m away`
      : `${distance.toFixed(1)}km away`;
  };

  // Highlight matching text in search results
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const normalizedText = text.toLowerCase();
    const normalizedQuery = query.toLowerCase();
    
    if (!normalizedText.includes(normalizedQuery)) return text;
    
    const startIndex = normalizedText.indexOf(normalizedQuery);
    const endIndex = startIndex + normalizedQuery.length;
    
    return (
      <>
        {text.substring(0, startIndex)}
        <span className="bg-yellow-200 text-black font-medium">
          {text.substring(startIndex, endIndex)}
        </span>
        {text.substring(endIndex)}
      </>
    );
  };

  return (
    <div className={`relative ${className}`} ref={searchRef}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            placeholder="Where do you want to go?"  
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim() === '') {
                setShowResults(false);
              } else if (e.target.value.trim().length >= 2) {
                // Show loading state immediately
                setIsSearching(true);
                setShowResults(true);
                setShowRecent(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim().length >= 2) {
                e.preventDefault();
                // Force immediate search on Enter key
                handleSearch();
              }
            }}
            onFocus={() => {
              if (searchQuery.trim().length > 0) {
                setShowResults(true);
              } else if (recentSearches.length > 0) {
                setShowRecent(true);
              }
            }}
            className="pl-10 pr-8"
          />
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
            <SearchIcon size={16} />
          </div>
          {searchQuery && (
            <button 
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={clearSearch}
            >
              <X size={16} />
            </button>
          )}
        </div>
        {recentSearches.length > 0 && (
          <Button
            variant="outline"
            size="icon"
            onClick={toggleRecentSearches}
            title="Recent searches"
          >
            <History size={16} className={showRecent ? "text-primary" : ""} />
          </Button>
        )}
        <Button 
          variant={autoSearchEnabled ? "secondary" : "outline"}
          size="icon"
          onClick={() => setAutoSearchEnabled(!autoSearchEnabled)}
          title={autoSearchEnabled ? "Auto-search enabled (click to disable)" : "Auto-search disabled (click to enable)"}
          className={autoSearchEnabled ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SearchIcon className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* Map button - only shown when a location is selected but map selector is not yet open */}
      {selectedPlace && !showMapSelector && (
        <div className="mt-2">
          <Button 
            variant="outline" 
            size="sm"
            className="w-full flex items-center justify-center gap-2 text-sm"
            onClick={() => setShowMapSelector(true)}
          >
            <MapIcon className="h-4 w-4" />
            Adjust Location on Map
          </Button>
        </div>
      )}
      
      {/* Search suggestion tags */}
      {!showResults && !showRecent && !searchQuery && (
        <div className="mt-2 flex flex-wrap gap-1">
          {["Airport", "Museum", "Restaurant", "Hotel", "Mall"].map(suggestion => (
            <Badge 
              key={suggestion} 
              variant="outline" 
              className="cursor-pointer hover:bg-secondary"
              onClick={() => setSearchQuery(suggestion)}
            >
              {suggestion}
            </Badge>
          ))}
        </div>
      )}

      {/* Search results dropdown */}
      {showResults && searchResults.length > 0 && (
        <Card className="absolute mt-1 p-2 w-full z-10 max-h-64 overflow-y-auto shadow-lg">
          <div className="space-y-1">
            {searchResults.map((place) => (
              <div key={place.id}>
                <div
                  className="flex items-start gap-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                  onClick={() => handleSelectPlace(place)}
                >
                  <MapPin className="h-4 w-4 mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {highlightText(place.name, searchQuery)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {highlightText(place.address, searchQuery)}
                    </p>
                    {place.distance !== undefined && (
                      <p className="text-xs text-blue-600">{formatDistance(place.distance)}</p>
                    )}
                  </div>
                </div>
                <Separator className="my-1" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent searches dropdown */}
      {showRecent && recentSearches.length > 0 && (
        <Card className="absolute mt-1 p-2 w-full z-10 max-h-64 overflow-y-auto shadow-lg">
          <div className="px-2 py-1 text-sm font-medium text-muted-foreground">
            Recent Searches
          </div>
          <div className="space-y-1">
            {recentSearches.map((place) => (
              <div key={place.id}>
                <div
                  className="flex items-start gap-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                  onClick={() => handleSelectPlace(place)}
                >
                  <History className="h-4 w-4 mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{place.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                    {place.distance !== undefined && (
                      <p className="text-xs text-blue-600">{formatDistance(place.distance)}</p>
                    )}
                  </div>
                </div>
                <Separator className="my-1" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {showResults && searchQuery.trim().length > 0 && searchResults.length === 0 && !isSearching && (
        <Card className="absolute mt-1 p-4 w-full z-10 shadow-lg">
          <p className="text-center text-muted-foreground">No results found</p>
          <p className="text-center text-xs text-muted-foreground mt-1">
            Try different keywords or check your spelling
          </p>
        </Card>
      )}
      
      {/* Map selector modal */}
      {showMapSelector && selectedPlace && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <OpenStreetMapPicker
              initialLocation={selectedPlace.location}
              initialAddress={selectedPlace.address}
              onSelectLocation={(location, address) => {
                finalizeDestinationSelection(location, address);
                setShowMapSelector(false);
              }}
              onClose={() => setShowMapSelector(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DestinationSearch;
