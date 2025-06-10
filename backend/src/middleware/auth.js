import { supabase } from '../config/supabase.js';

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

    // Attach user to request object
    req.user = user;
    req.token = token;
    
    // Set Supabase auth context for RLS
    supabase.auth.setAuth(token);
    
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
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Get user profile to check user type
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', req.user.id)
        .single();

      if (error || !profile) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      if (profile.user_type !== userType) {
        return res.status(403).json({ 
          error: `Access denied. Required user type: ${userType}` 
        });
      }

      req.userType = profile.user_type;
      next();
    } catch (error) {
      console.error('User type check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}