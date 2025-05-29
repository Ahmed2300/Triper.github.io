import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateUserData } from '@/services/authService';

interface ProfileImageUploadProps {
  user: User;
  onImageUpdate?: (newPhotoURL: string) => void;
}

const ProfileImageUpload: React.FC<ProfileImageUploadProps> = ({ user, onImageUpdate }) => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  // Use the provided ImgBB API key
  const apiKey = "ba5c99fa4cda140ebd1595a615100f5d";

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name.split(' ').map(part => part[0]).join('').toUpperCase().substring(0, 2);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (limit to 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 2MB in size.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    toast({
      title: "Uploading image...",
      description: "Please wait while we upload your profile photo.",
    });

    try {
      // Create form data
      const formData = new FormData();
      formData.append('image', file);
      
      // Set expiration to 0 (never expire)
      const url = `https://api.imgbb.com/1/upload?key=${apiKey}&expiration=0`;

      // Upload image to ImgBB
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        // Get display URL from response (higher quality than thumb)
        const imageUrl = data.data.display_url;
        
        console.log('Image uploaded successfully:', data.data);
        
        // Update user profile in Firebase
        await updateUserData(user.uid, { 
          photoURL: imageUrl,
          // Store additional image information
          profileImage: {
            url: imageUrl,
            thumbnail: data.data.thumb?.url || imageUrl,
            updatedAt: new Date().toISOString()
          }
        });
        
        // Notify parent component
        if (onImageUpdate) {
          onImageUpdate(imageUrl);
        }

        toast({
          title: "Success!",
          description: "Your profile photo has been updated.",
        });
      } else {
        console.error("ImgBB upload failed:", data);
        throw new Error("Failed to upload image: " + (data.error?.message || 'Unknown error'));
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Upload Failed",
        description: "There was a problem uploading your image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative inline-block">
      <Avatar className="w-20 h-20 border-2 border-white shadow-md">
        <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User"} />
        <AvatarFallback className="bg-blue-500 text-white text-xl">
          {getInitials(user.displayName)}
        </AvatarFallback>
      </Avatar>
      
      <label 
        htmlFor="profile-upload" 
        className={`absolute -right-2 -bottom-2 bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-full cursor-pointer shadow-md transition-all duration-200 ${isUploading ? 'opacity-70 pointer-events-none' : ''}`}
        title="Update profile picture"
      >
        {isUploading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Camera size={16} />
        )}
        <input 
          type="file"
          id="profile-upload"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />
      </label>
      
      {isUploading && (
        <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
        </div>
      )}
    </div>
  );
};

export default ProfileImageUpload;
