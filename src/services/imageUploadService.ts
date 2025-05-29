/**
 * Service for uploading images to imgBB API
 */

const API_KEY = "eaba1bc0300ab3681e35e1eef62d2503";
const UPLOAD_URL = `https://api.imgbb.com/1/upload?key=${API_KEY}`;

export interface ImageUploadResponse {
  success: boolean;
  data?: {
    url: string;
    display_url: string;
    delete_url: string;
  };
  error?: string;
}

/**
 * Upload an image file to imgBB
 * @param file Image file to upload
 * @returns Promise with the upload response
 */
export const uploadImage = async (file: File): Promise<ImageUploadResponse> => {
  try {
    const formData = new FormData();
    formData.append("image", file);
    
    const response = await fetch(UPLOAD_URL, {
      method: "POST",
      body: formData,
    });
    
    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        data: {
          url: result.data.url,
          display_url: result.data.display_url,
          delete_url: result.data.delete_url
        }
      };
    } else {
      return {
        success: false,
        error: "Failed to upload image"
      };
    }
  } catch (error) {
    console.error("Image upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
};

/**
 * Upload an image from a base64 string to imgBB
 * @param base64String Base64 encoded image string
 * @returns Promise with the upload response
 */
export const uploadBase64Image = async (base64String: string): Promise<ImageUploadResponse> => {
  try {
    // Remove data URL prefix if present
    const base64Data = base64String.includes(',') 
      ? base64String.split(',')[1]
      : base64String;
    
    const formData = new FormData();
    formData.append("image", base64Data);
    
    const response = await fetch(UPLOAD_URL, {
      method: "POST",
      body: formData,
    });
    
    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        data: {
          url: result.data.url,
          display_url: result.data.display_url,
          delete_url: result.data.delete_url
        }
      };
    } else {
      return {
        success: false,
        error: "Failed to upload image"
      };
    }
  } catch (error) {
    console.error("Image upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
};
