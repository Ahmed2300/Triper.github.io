import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PhoneNumberInput from "./PhoneNumberInput";

interface PhoneVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (phoneNumber: string) => Promise<void>;
}

const PhoneVerificationModal = ({ isOpen, onClose, onSubmit }: PhoneVerificationModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitPhoneNumber = async (phoneNumber: string) => {
    setIsSubmitting(true);
    try {
      // Just validate the phone number format without authentication
      console.log("Phone number validated:", phoneNumber);
      await onSubmit(phoneNumber);
    } catch (error) {
      console.error("Error validating phone number:", error);
      throw error; // Will be caught by PhoneNumberInput
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Phone Number Required</DialogTitle>
          <DialogDescription>
            Please add your phone number to enable calling features. This will allow you to
            contact your driver/customer directly when needed.
          </DialogDescription>
        </DialogHeader>
        <PhoneNumberInput 
          onSubmit={handleSubmitPhoneNumber}
          isLoading={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
};

export default PhoneVerificationModal;
