import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasCompletedProfile, updatePhoneNumber } from "@/services/userService";
import PhoneNumberInput from "./PhoneNumberInput";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface PhoneVerificationProps {
  onComplete?: () => void;
}

const PhoneVerification = ({ onComplete }: PhoneVerificationProps) => {
  const [isVerifying, setIsVerifying] = useState(true);
  const [hasPhoneNumber, setHasPhoneNumber] = useState<boolean | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user already has a phone number on component mount
    const checkProfile = async () => {
      try {
        const hasPhone = await hasCompletedProfile();
        setHasPhoneNumber(hasPhone);
        
        if (hasPhone && onComplete) {
          onComplete();
        }
        
        setIsVerifying(false);
      } catch (err) {
        setError("Failed to check profile status");
        setIsVerifying(false);
      }
    };

    checkProfile();
  }, [onComplete]);

  const handleSubmitPhoneNumber = async (phoneNumber: string) => {
    try {
      await updatePhoneNumber(phoneNumber);
      setSuccess(true);
      setHasPhoneNumber(true);
      
      // Wait a moment to show success message before completing
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
      }, 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update phone number");
      throw err; // Re-throw to be caught by PhoneNumberInput
    }
  };

  if (isVerifying) {
    return (
      <Card className="w-full max-w-md mx-auto p-6">
        <CardContent className="pt-6">
          <div className="flex justify-center items-center h-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
          </div>
          <p className="text-center text-gray-500 mt-4">Checking your profile...</p>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <Alert variant="default" className="bg-green-50 border-green-200">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <AlertTitle>Success!</AlertTitle>
            <AlertDescription>
              Your phone number has been successfully saved.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (error && !hasPhoneNumber) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (hasPhoneNumber === false) {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Phone Number Required</CardTitle>
            <CardDescription>
              Please add your phone number to continue. This is required for the calling feature.
            </CardDescription>
          </CardHeader>
        </Card>
        <PhoneNumberInput onSubmit={handleSubmitPhoneNumber} />
      </div>
    );
  }

  return null;
};

export default PhoneVerification;
