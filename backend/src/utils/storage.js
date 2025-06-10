import { supabase } from '../config/supabase.js';

export class StorageService {
  static async uploadFile(bucket, fileName, fileBuffer, contentType) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, fileBuffer, {
          contentType,
          upsert: true
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      return { success: true, url: publicUrl, path: data.path };
    } catch (error) {
      console.error(`Storage upload error (${bucket}):`, error);
      return { success: false, error: error.message };
    }
  }

  static async deleteFile(bucket, fileName) {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([fileName]);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error(`Storage delete error (${bucket}):`, error);
      return { success: false, error: error.message };
    }
  }

  static async getSignedUrl(bucket, fileName, expiresIn = 3600) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(fileName, expiresIn);

      if (error) throw error;
      return { success: true, url: data.signedUrl };
    } catch (error) {
      console.error(`Storage signed URL error (${bucket}):`, error);
      return { success: false, error: error.message };
    }
  }
}

export default StorageService;