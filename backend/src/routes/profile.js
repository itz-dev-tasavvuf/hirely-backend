import express from 'express';
import multer from 'multer';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { authenticateUser } from '../middleware/auth.js';
import TextExtractor from '../utils/textExtractor.js';
import PicaService from '../services/picaService.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'profilePicture') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for profile pictures'));
      }
    } else if (file.fieldname === 'resume') {
      try {
        TextExtractor.validateFileType(file.mimetype, file.originalname);
        cb(null, true);
      } catch (error) {
        cb(new Error(error.message));
      }
    } else if (file.fieldname === 'companyLogo') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for company logos'));
      }
    } else {
      cb(new Error('Unknown file field'));
    }
  }
});

// Get user profile
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = req.profile;

    let userDetails = null;

    // Get user-type specific details
    if (profile.user_type === 'candidate') {
      const { data: candidateDetails, error: candidateError } = await supabaseAdmin
        .from('candidate_details')
        .select('*')
        .eq('profile_id', userId)
        .single();

      if (!candidateError) {
        userDetails = candidateDetails;
      }
    } else if (profile.user_type === 'employer') {
      const { data: employerDetails, error: employerError } = await supabaseAdmin
        .from('employer_details')
        .select('*')
        .eq('profile_id', userId)
        .single();

      if (!employerError) {
        userDetails = employerDetails;
      }
    }

    res.json({
      profile,
      details: userDetails
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = req.profile;
    const { fullName, location, bio, ...userTypeFields } = req.body;

    // Update basic profile
    const profileUpdates = {};
    if (fullName !== undefined) profileUpdates.full_name = fullName;
    if (location !== undefined) profileUpdates.location = location;
    if (bio !== undefined) profileUpdates.bio = bio;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userId);

      if (profileError) {
        return res.status(400).json({ error: profileError.message });
      }
    }

    // Update user-type specific details
    if (profile.user_type === 'candidate' && Object.keys(userTypeFields).length > 0) {
      const candidateUpdates = {};
      if (userTypeFields.skills !== undefined) candidateUpdates.skills = userTypeFields.skills;
      if (userTypeFields.experienceLevel !== undefined) candidateUpdates.experience_level = userTypeFields.experienceLevel;
      if (userTypeFields.salaryExpectation !== undefined) candidateUpdates.salary_expectation = userTypeFields.salaryExpectation;
      if (userTypeFields.jobPreferences !== undefined) candidateUpdates.job_preferences = userTypeFields.jobPreferences;

      if (Object.keys(candidateUpdates).length > 0) {
        const { error: candidateError } = await supabaseAdmin
          .from('candidate_details')
          .update(candidateUpdates)
          .eq('profile_id', userId);

        if (candidateError) {
          return res.status(400).json({ error: candidateError.message });
        }
      }
    } else if (profile.user_type === 'employer' && Object.keys(userTypeFields).length > 0) {
      const employerUpdates = {};
      if (userTypeFields.companyName !== undefined) employerUpdates.company_name = userTypeFields.companyName;
      if (userTypeFields.industry !== undefined) employerUpdates.industry = userTypeFields.industry;
      if (userTypeFields.companySize !== undefined) employerUpdates.company_size = userTypeFields.companySize;
      if (userTypeFields.websiteUrl !== undefined) employerUpdates.website_url = userTypeFields.websiteUrl;

      if (Object.keys(employerUpdates).length > 0) {
        const { error: employerError } = await supabaseAdmin
          .from('employer_details')
          .update(employerUpdates)
          .eq('profile_id', userId);

        if (employerError) {
          return res.status(400).json({ error: employerError.message });
        }
      }
    }

    res.json({ message: 'Profile updated successfully' });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload profile picture
router.post('/picture', authenticateUser, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const fileName = `${userId}-${Date.now()}.${req.file.originalname.split('.').pop()}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('profile-pictures')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (uploadError) {
      return res.status(400).json({ error: uploadError.message });
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('profile-pictures')
      .getPublicUrl(fileName);

    // Update profile with new picture URL
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ profile_picture_url: publicUrl })
      .eq('id', userId);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({
      message: 'Profile picture uploaded successfully',
      url: publicUrl
    });

  } catch (error) {
    console.error('Profile picture upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload resume (candidates only) with AI parsing
router.post('/resume', authenticateUser, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (req.profile.user_type !== 'candidate') {
      return res.status(403).json({ error: 'Only candidates can upload resumes' });
    }

    const userId = req.user.id;
    const fileName = `${userId}-resume-${Date.now()}.${req.file.originalname.split('.').pop()}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('resumes')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (uploadError) {
      return res.status(400).json({ error: uploadError.message });
    }

    // Get public URL (for private bucket, this would be a signed URL)
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('resumes')
      .getPublicUrl(fileName);

    let parsedData = {};
    
    try {
      // Extract text from the uploaded file
      console.log('Extracting text from resume...');
      const extractedText = await TextExtractor.extractText(
        req.file.buffer, 
        req.file.mimetype, 
        req.file.originalname
      );

      console.log('Text extracted, length:', extractedText.length);

      // Analyze with Pica AI
      console.log('Analyzing resume with AI...');
      parsedData = await PicaService.analyzeResume(extractedText);
      console.log('AI analysis completed');

    } catch (aiError) {
      console.error('AI processing error:', aiError);
      // Continue without AI data, but log the error
      parsedData = {
        error: 'AI processing failed',
        extractedText: aiError.message
      };
    }

    // Update candidate details with resume URL and parsed data
    const { error: updateError } = await supabaseAdmin
      .from('candidate_details')
      .update({ 
        resume_url: publicUrl,
        parsed_resume_data: parsedData 
      })
      .eq('profile_id', userId);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    // If AI parsing was successful, also update profile with extracted info
    if (parsedData.full_name || parsedData.contact_info?.email) {
      const profileUpdates = {};
      
      if (parsedData.full_name && !req.profile.full_name) {
        profileUpdates.full_name = parsedData.full_name;
      }
      
      if (parsedData.location && !req.profile.location) {
        profileUpdates.location = parsedData.location;
      }

      if (parsedData.summary_or_objective && !req.profile.bio) {
        profileUpdates.bio = parsedData.summary_or_objective;
      }

      if (Object.keys(profileUpdates).length > 0) {
        await supabaseAdmin
          .from('profiles')
          .update(profileUpdates)
          .eq('id', userId);
      }
    }

    res.json({
      message: 'Resume uploaded and analyzed successfully',
      url: publicUrl,
      parsed_data: parsedData
    });

  } catch (error) {
    console.error('Resume upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload company logo (employers only)
router.post('/company-logo', authenticateUser, upload.single('companyLogo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (req.profile.user_type !== 'employer') {
      return res.status(403).json({ error: 'Only employers can upload company logos' });
    }

    const userId = req.user.id;
    const fileName = `${userId}-logo-${Date.now()}.${req.file.originalname.split('.').pop()}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('company-logos')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (uploadError) {
      return res.status(400).json({ error: uploadError.message });
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('company-logos')
      .getPublicUrl(fileName);

    // Update employer details with new logo URL
    const { error: updateError } = await supabaseAdmin
      .from('employer_details')
      .update({ company_logo_url: publicUrl })
      .eq('profile_id', userId);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({
      message: 'Company logo uploaded successfully',
      url: publicUrl
    });

  } catch (error) {
    console.error('Company logo upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
</invoke>