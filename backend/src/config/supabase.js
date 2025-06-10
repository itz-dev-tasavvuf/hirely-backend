import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

console.log('Environment check:', {
  SUPABASE_URL: process.env.SUPABASE_URL ? 'Set' : 'Missing',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing'
});

if (!process.env.SUPABASE_URL) {
  console.error('SUPABASE_URL is missing from environment variables');
  process.exit(1);
}

if (!process.env.SUPABASE_ANON_KEY) {
  console.error('SUPABASE_ANON_KEY is missing from environment variables');
  process.exit(1);
}

// Create Supabase client
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
);

// Create Supabase admin client for server-side operations
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Initialize storage buckets
export async function initializeStorage() {
  try {
    // Create buckets if they don't exist
    const buckets = [
      {
        name: 'resumes',
        options: {
          public: false,
          allowedMimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
          fileSizeLimit: 10485760 // 10MB
        }
      },
      {
        name: 'profile-pictures',
        options: {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          fileSizeLimit: 5242880 // 5MB
        }
      },
      {
        name: 'company-logos',
        options: {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
          fileSizeLimit: 2097152 // 2MB
        }
      }
    ];

    for (const bucket of buckets) {
      const { data: existingBucket } = await supabaseAdmin.storage.getBucket(bucket.name);
      
      if (!existingBucket) {
        const { error } = await supabaseAdmin.storage.createBucket(bucket.name, bucket.options);
        if (error) {
          console.error(`Error creating bucket ${bucket.name}:`, error);
        } else {
          console.log(`Created storage bucket: ${bucket.name}`);
        }
      }
    }
  } catch (error) {
    console.error('Error initializing storage:', error);
  }
}

export default supabase;