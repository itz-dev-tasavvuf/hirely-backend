import { supabase, supabaseAdmin } from '../config/supabase.js';

export async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Missing or invalid authorization header' 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ 
        error: 'Invalid or expired token' 
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Attach user and profile to request object
    req.user = user;
    req.profile = profile;
    req.token = token;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ 
      error: 'Internal server error during authentication' 
    });
  }
}

export function requireUserType(userType) {
  return async (req, res, next) => {
    try {
      if (!req.profile) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (req.profile.user_type !== userType) {
        return res.status(403).json({ 
          error: `Access denied. Required user type: ${userType}` 
        });
      }

      next();
    } catch (error) {
      console.error('User type check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export function requireAnyUserType(userTypes) {
  return async (req, res, next) => {
    try {
      if (!req.profile) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!userTypes.includes(req.profile.user_type)) {
        return res.status(403).json({ 
          error: `Access denied. Required user types: ${userTypes.join(', ')}` 
        });
      }

      next();
    } catch (error) {
      console.error('User type check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}