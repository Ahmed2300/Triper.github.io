import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, Phone } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PhoneNumberInputProps {
  onSubmit: (phoneNumber: string) => Promise<void>;
  isLoading?: boolean;
  initialPhoneNumber?: string;
}

const PhoneNumberInput = ({ 
  onSubmit, 
  isLoading = false, 
  initialPhoneNumber = "" 
}: PhoneNumberInputProps) => {
  const [phoneNumber, setPhoneNumber] = useState<string>(initialPhoneNumber);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Phone number validation
  const validatePhoneNumber = (number: string): boolean => {
    // Simple validation for international format phone numbers
    // Allows +1234567890 format or 1234567890 (10+ digits)
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    return phoneRegex.test(number.replace(/\s+/g, ""));
  };

  // Update validation state whenever phone number changes
  useEffect(() => {
    if (phoneNumber.length > 0) {
      setIsValid(validatePhoneNumber(phoneNumber.replace(/\s+/g, "")));
    } else {
      setIsValid(null);
    }
  }, [phoneNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Remove any spaces from the phone number
    const formattedNumber = phoneNumber.replace(/\s+/g, "");
    
    if (!validatePhoneNumber(formattedNumber)) {
      setError("Please enter a valid phone number (10+ digits, optionally starting with +)");
      return;
    }

    setError(null);
    
    try {
      await onSubmit(formattedNumber);
      // Success - handled by parent component
    } catch (err: any) {
      setError(err?.message || "Failed to save phone number");
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
          <Phone className="w-6 h-6 text-blue-600" />
        </div>
        <CardTitle className="text-center">Phone Number Required</CardTitle>
        <CardDescription className="text-center">
          Add your phone number to enable call functionality
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <div className="relative">
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className={`pr-10 ${
                    isValid === false ? "border-red-500 focus-visible:ring-red-500" : ""
                  } ${
                    isValid === true ? "border-green-500 focus-visible:ring-green-500" : ""
                  }`}
                  required
                />
                {isValid !== null && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    {isValid ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                )}
              </div>
              {isValid === false && (
                <p className="text-sm text-red-500">
                  Please enter a valid phone number (e.g., +1 234 567 8900)
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Include country code (e.g. +1 for US/Canada)
              </p>
            </div>
          </div>
          
          <Button 
            type="submit" 
            disabled={!isValid || isLoading}
            className="w-full mt-4"
          >
            {isLoading ? "Saving..." : "Save Phone Number"}
          </Button>
          
          <p className="text-center text-sm text-muted-foreground mt-4">
            Your phone number will only be shared with your ride partner
          </p>
        </form>
      </CardContent>
    </Card>
  );
};

export default PhoneNumberInput;
