import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateUser, requireUserType } from '../middleware/auth.js';

const router = express.Router();

// Get jobs for candidates (with pagination and filtering)
router.get('/', authenticateUser, requireUserType('candidate'), async (req, res) => {
  try {
    const { page = 1, limit = 10, location, jobType, salaryMin } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('jobs')
      .select(`
        *,
        employer_details!inner(
          company_name,
          industry,
          company_logo_url
        )
      `)
      .eq('status', 'active')
      .not('published_at', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (location) {
      query = query.ilike('location', `%${location}%`);
    }
    if (jobType) {
      query = query.eq('job_type', jobType);
    }

    const { data: jobs, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Get user's interactions with these jobs
    const jobIds = jobs.map(job => job.id);
    const { data: interactions } = await supabase
      .from('candidate_job_interactions')
      .select('job_id, interaction_type')
      .eq('candidate_id', req.user.id)
      .in('job_id', jobIds);

    // Add interaction info to jobs
    const jobsWithInteractions = jobs.map(job => ({
      ...job,
      userInteraction: interactions?.find(i => i.job_id === job.id)?.interaction_type || null
    }));

    res.json({
      jobs: jobsWithInteractions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: jobs.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Jobs fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single job details
router.get('/:jobId', authenticateUser, async (req, res) => {
  try {
    const { jobId } = req.params;

    const { data: job, error } = await supabase
      .from('jobs')
      .select(`
        *,
        employer_details!inner(
          company_name,
          industry,
          company_logo_url,
          website_url
        )
      `)
      .eq('id', jobId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if user has interacted with this job
    const { data: interaction } = await supabase
      .from('candidate_job_interactions')
      .select('interaction_type')
      .eq('candidate_id', req.user.id)
      .eq('job_id', jobId)
      .single();

    res.json({
      ...job,
      userInteraction: interaction?.interaction_type || null
    });

  } catch (error) {
    console.error('Job fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Record job interaction (swipe, apply, etc.)
router.post('/:jobId/interact', authenticateUser, requireUserType('candidate'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const { interactionType, notes } = req.body;

    if (!['interested', 'not_interested', 'applied', 'viewed', 'saved'].includes(interactionType)) {
      return res.status(400).json({ error: 'Invalid interaction type' });
    }

    // Upsert interaction
    const { error } = await supabase
      .from('candidate_job_interactions')
      .upsert({
        candidate_id: req.user.id,
        job_id: jobId,
        interaction_type: interactionType,
        notes: notes || null
      }, {
        onConflict: 'candidate_id,job_id,interaction_type'
      });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Interaction recorded successfully' });

  } catch (error) {
    console.error('Job interaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new job (employers only)
router.post('/', authenticateUser, requireUserType('employer'), async (req, res) => {
  try {
    const {
      title,
      location,
      jobType = 'full-time',
      salaryRange,
      requirements,
      aboutRole,
      benefits,
      teamSize,
      remoteFriendly = false,
      careerGrowth = false,
      greatCulture = false
    } = req.body;

    if (!title || !location || !requirements) {
      return res.status(400).json({ 
        error: 'Title, location, and requirements are required' 
      });
    }

    // Get employer details for company name
    const { data: employerDetails, error: employerError } = await supabase
      .from('employer_details')
      .select('company_name')
      .eq('profile_id', req.user.id)
      .single();

    if (employerError) {
      return res.status(400).json({ error: 'Employer profile not found' });
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        employer_id: req.user.id,
        title,
        company_name: employerDetails.company_name,
        location,
        job_type: jobType,
        salary_range: salaryRange,
        requirements,
        about_role: aboutRole,
        benefits,
        team_size: teamSize,
        remote_friendly: remoteFriendly,
        career_growth: careerGrowth,
        great_culture: greatCulture,
        published_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Job created successfully',
      job
    });

  } catch (error) {
    console.error('Job creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get employer's jobs
router.get('/employer/my-jobs', authenticateUser, requireUserType('employer'), async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('jobs')
      .select('*')
      .eq('employer_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: jobs, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: jobs.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Employer jobs fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;