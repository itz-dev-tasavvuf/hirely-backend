import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { email, password, userType, fullName } = req.body;

    if (!email || !password || !userType) {
      return res.status(400).json({
        error: 'Email, password, and userType are required'
      });
    }

    if (!['candidate', 'employer'].includes(userType)) {
      return res.status(400).json({
        error: 'userType must be either "candidate" or "employer"'
      });
    }

    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          user_type: userType,
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
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        user_type: userType,
        full_name: fullName
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Note: User is already created in auth, so we don't want to fail here
    }

    // Create user-type specific details
    if (userType === 'candidate') {
      const { error: candidateError } = await supabase
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
    } else if (userType === 'employer') {
      const { error: employerError } = await supabase
        .from('employer_details')
        .insert({
          profile_id: authData.user.id,
          company_name: fullName || 'New Company'
        });

      if (employerError) {
        console.error('Employer details creation error:', employerError);
      }
    }

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        userType,
        fullName
      },
      session: authData.session
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
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

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
    }

    res.json({
      message: 'Login successful',
      user: {
        id: data.user.id,
        email: data.user.email,
        userType: profile?.user_type,
        fullName: profile?.full_name
      },
      session: data.session
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google OAuth callback
router.post('/google', async (req, res) => {
  try {
    const { access_token, refresh_token } = req.body;

    if (!access_token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      message: 'Google OAuth successful',
      user: {
        id: data.user.id,
        email: data.user.email
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

export default router;