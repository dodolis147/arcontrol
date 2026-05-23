import { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from '../../services/supabase';

export const useImageUpload = (bucketName: string) => {
  const [uploading, setUploading] = useState(false);

  const uploadImages = async (files: File[]) => {
    setUploading(true);
    try {
      const uploadPromises = files.map(async (file) => {
        const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);
        const fileName = `${Date.now()}_${file.name}`;
        const { error } = await supabase.storage
          .from(bucketName)
          .upload(fileName, compressedFile);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName);
        return publicUrl;
      });
      return await Promise.all(uploadPromises);
    } finally {
      setUploading(false);
    }
  };

  return { uploadImages, uploading };
};
