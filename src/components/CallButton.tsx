import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone, PhoneCall } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { isRunningInWebView } from "@/utils/mobileCompatibility";

interface CallButtonProps {
  phoneNumber: string;
  recipientName: string;
  variant?: "icon" | "button" | "floating";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const CallButton = ({
  phoneNumber,
  recipientName,
  variant = "icon",
  size = "md",
  className = "",
}: CallButtonProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Calculate button size based on prop
  const getSize = () => {
    switch (size) {
      case "sm":
        return variant === "icon" ? "w-8 h-8" : "text-sm py-1 px-2";
      case "lg":
        return variant === "icon" ? "w-12 h-12" : "text-lg py-2 px-4";
      default:
        return variant === "icon" ? "w-10 h-10" : "text-md py-1.5 px-3";
    }
  };

  // Configure button appearance based on variant
  const getButtonClass = () => {
    switch (variant) {
      case "icon":
        return `rounded-full flex items-center justify-center bg-green-500 hover:bg-green-600 text-white ${getSize()} ${className}`;
      case "floating":
        return `rounded-full fixed bottom-4 right-4 shadow-lg flex items-center justify-center bg-green-500 hover:bg-green-600 text-white ${getSize()} ${className}`;
      default:
        return `rounded-md flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white ${getSize()} ${className}`;
    }
  };

  // Handle call initiation
  const handleCall = () => {
    if (!phoneNumber) {
      toast({
        title: "Cannot make call",
        description: "No phone number available for this contact.",
        variant: "destructive",
      });
      return;
    }

    // Format the phone number for tel: protocol
    // Remove any non-digit except the + sign at the beginning
    const formattedNumber = phoneNumber.startsWith('+')
      ? phoneNumber.replace(/[^\d+]/g, '')
      : phoneNumber.replace(/[^\d]/g, '');
    
    try {
      // Create a link and click it to initiate the call
      const callLink = document.createElement('a');
      callLink.href = `tel:${formattedNumber}`;
      callLink.style.display = 'none';
      document.body.appendChild(callLink);
      callLink.click();
      document.body.removeChild(callLink);
      
      // In a WebView environment, we might want to use the Android/iOS call intent
      if (isRunningInWebView()) {
        // This is a signal to the WebView to handle the call intent
        window.dispatchEvent(new CustomEvent('triptracker:call', { 
          detail: { phoneNumber: formattedNumber } 
        }));
      }
      
      toast({
        title: "Calling",
        description: `Initiating call to ${recipientName}...`,
      });
    } catch (error) {
      console.error('Error making phone call:', error);
      toast({
        title: "Call Failed",
        description: "Unable to initiate the call. Please try again.",
        variant: "destructive"
      });
    }
    setIsDialogOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        className={getButtonClass()}
        onClick={() => setIsDialogOpen(true)}
        aria-label={`Call ${recipientName}`}
      >
        {variant === "icon" || variant === "floating" ? (
          <Phone className={size === "sm" ? "h-4 w-4" : size === "lg" ? "h-6 w-6" : "h-5 w-5"} />
        ) : (
          <>
            <Phone className="h-4 w-4" />
            <span>Call {recipientName}</span>
          </>
        )}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-green-500" />
              Call {recipientName}
            </DialogTitle>
            <DialogDescription>
              You are about to call {recipientName} at {phoneNumber}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-green-500 hover:bg-green-600"
              onClick={handleCall}
            >
              Call Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CallButton;
