import express from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

// Register candidate endpoint
router.post('/register/candidate', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          user_type: 'candidate',
          full_name: fullName
        }
      }
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    if (!authData.user) {
      return res.status(400).json({ error: 'Failed to create user' });
    }

    // Create profile entry
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        user_type: 'candidate',
        full_name: fullName
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
    }

    // Create candidate details entry
    const { error: candidateError } = await supabaseAdmin
      .from('candidate_details')
      .insert({
        profile_id: authData.user.id,
        job_preferences: {},
        skills: [],
        parsed_resume_data: {},
        interview_knowledge_data: {}
      });

    if (candidateError) {
      console.error('Candidate details creation error:', candidateError);
    }

    res.status(201).json({
      message: 'Candidate registered successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        userType: 'candidate',
        fullName
      },
      session: authData.session
    });

  } catch (error) {
    console.error('Candidate registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register employer endpoint
router.post('/register/employer', async (req, res) => {
  try {
    const { email, password, fullName, companyName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          user_type: 'employer',
          full_name: fullName
        }
      }
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    if (!authData.user) {
      return res.status(400).json({ error: 'Failed to create user' });
    }

    // Create profile entry
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        user_type: 'employer',
        full_name: fullName
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
    }

    // Create employer details entry
    const { error: employerError } = await supabaseAdmin
      .from('employer_details')
      .insert({
        profile_id: authData.user.id,
        company_name: companyName || fullName || 'New Company'
      });

    if (employerError) {
      console.error('Employer details creation error:', employerError);
    }

    res.status(201).json({
      message: 'Employer registered successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        userType: 'employer',
        fullName,
        companyName
      },
      session: authData.session
    });

  } catch (error) {
    console.error('Employer registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login candidate endpoint
router.post('/login/candidate', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // Get user profile and verify user type
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (profile.user_type !== 'candidate') {
      return res.status(403).json({ error: 'Invalid login for candidate' });
    }

    res.json({
      message: 'Candidate login successful',
      user: {
        id: data.user.id,
        email: data.user.email,
        userType: profile.user_type,
        fullName: profile.full_name
      },
      session: data.session
    });

  } catch (error) {
    console.error('Candidate login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login employer endpoint
router.post('/login/employer', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // Get user profile and verify user type
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (profile.user_type !== 'employer') {
      return res.status(403).json({ error: 'Invalid login for employer' });
    }

    // Get company details
    const { data: companyDetails } = await supabaseAdmin
      .from('employer_details')
      .select('company_name')
      .eq('profile_id', data.user.id)
      .single();

    res.json({
      message: 'Employer login successful',
      user: {
        id: data.user.id,
        email: data.user.email,
        userType: profile.user_type,
        fullName: profile.full_name,
        companyName: companyDetails?.company_name
      },
      session: data.session
    });

  } catch (error) {
    console.error('Employer login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google OAuth callback (can be used for both types)
router.post('/google', async (req, res) => {
  try {
    const { access_token, refresh_token, userType } = req.body;

    if (!access_token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    if (!userType || !['candidate', 'employer'].includes(userType)) {
      return res.status(400).json({ error: 'Valid user type is required' });
    }

    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // Check if profile exists, if not create it
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (!existingProfile) {
      // Create profile for new Google user
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: data.user.id,
          email: data.user.email,
          user_type: userType,
          full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
      }

      // Create type-specific details
      if (userType === 'candidate') {
        await supabaseAdmin
          .from('candidate_details')
          .insert({
            profile_id: data.user.id,
            job_preferences: {},
            skills: [],
            parsed_resume_data: {},
            interview_knowledge_data: {}
          });
      } else {
        await supabaseAdmin
          .from('employer_details')
          .insert({
            profile_id: data.user.id,
            company_name: 'New Company'
          });
      }
    }

    res.json({
      message: 'Google OAuth successful',
      user: {
        id: data.user.id,
        email: data.user.email,
        userType: existingProfile?.user_type || userType,
        fullName: existingProfile?.full_name || data.user.user_metadata?.full_name
      },
      session: data.session
    });

  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user endpoint
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        userType: profile.user_type,
        fullName: profile.full_name
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;