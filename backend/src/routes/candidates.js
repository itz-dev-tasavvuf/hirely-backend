import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateUser, requireUserType } from '../middleware/auth.js';

const router = express.Router();

// Get candidates for employers (with pagination and filtering)
router.get('/', authenticateUser, requireUserType('employer'), async (req, res) => {
  try {
    const { page = 1, limit = 10, skills, location, experienceLevel } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('candidate_details')
      .select(`
        *,
        profiles!inner(
          id,
          full_name,
          location,
          bio,
          profile_picture_url,
          created_at
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (skills) {
      const skillsArray = skills.split(',').map(s => s.trim());
      query = query.overlaps('skills', skillsArray);
    }
    if (location) {
      query = query.ilike('profiles.location', `%${location}%`);
    }
    if (experienceLevel) {
      query = query.eq('experience_level', experienceLevel);
    }

    const { data: candidates, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      candidates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: candidates.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Candidates fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single candidate details
router.get('/:candidateId', authenticateUser, requireUserType('employer'), async (req, res) => {
  try {
    const { candidateId } = req.params;

    const { data: candidate, error } = await supabase
      .from('candidate_details')
      .select(`
        *,
        profiles!inner(
          id,
          full_name,
          location,
          bio,
          profile_picture_url,
          created_at
        )
      `)
      .eq('profile_id', candidateId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    res.json(candidate);

  } catch (error) {
    console.error('Candidate fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;