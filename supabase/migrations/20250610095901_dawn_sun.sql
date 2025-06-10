/*
  # Initial Database Schema for Job Matching Platform

  1. New Tables
    - `profiles` - User profile information linking to auth.users
    - `candidate_details` - Candidate-specific information and preferences
    - `employer_details` - Employer/company information
    - `jobs` - Job postings from employers
    - `candidate_job_interactions` - Track swipes, applications, views

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Add policies for public job browsing by candidates
    - Add policies for employers to manage their jobs
*/

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL CHECK (user_type IN ('candidate', 'employer')),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  location TEXT,
  bio TEXT,
  profile_picture_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidate details table
CREATE TABLE IF NOT EXISTS candidate_details (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  resume_url TEXT,
  parsed_resume_data JSONB DEFAULT '{}',
  interview_knowledge_data JSONB DEFAULT '{}',
  job_preferences JSONB DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  experience_level TEXT,
  salary_expectation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employer details table
CREATE TABLE IF NOT EXISTS employer_details (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  industry TEXT,
  company_size TEXT,
  company_logo_url TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employer_details(profile_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  location TEXT,
  job_type TEXT DEFAULT 'full-time' CHECK (job_type IN ('full-time', 'part-time', 'contract', 'internship')),
  salary_range TEXT,
  requirements TEXT,
  parsed_requirements_data JSONB DEFAULT '{}',
  about_role TEXT,
  benefits TEXT,
  team_size TEXT,
  remote_friendly BOOLEAN DEFAULT false,
  career_growth BOOLEAN DEFAULT false,
  great_culture BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'draft')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidate job interactions table
CREATE TABLE IF NOT EXISTS candidate_job_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_details(profile_id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('interested', 'not_interested', 'applied', 'viewed', 'saved')),
  matching_score NUMERIC(3,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, job_id, interaction_type)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_jobs_employer_id ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_candidate_interactions_candidate_id ON candidate_job_interactions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_interactions_job_id ON candidate_job_interactions(job_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE employer_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_job_interactions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Candidate details policies
CREATE POLICY "Candidates can manage their own details"
  ON candidate_details FOR ALL
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Employers can view candidate details for matching"
  ON candidate_details FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.user_type = 'employer'
    )
  );

-- Employer details policies
CREATE POLICY "Employers can manage their own details"
  ON employer_details FOR ALL
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Candidates can view employer details"
  ON employer_details FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.user_type = 'candidate'
    )
  );

-- Jobs policies
CREATE POLICY "Employers can manage their own jobs"
  ON jobs FOR ALL
  TO authenticated
  USING (
    employer_id IN (
      SELECT profile_id FROM employer_details WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Candidates can view active jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    status = 'active' AND published_at IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.user_type = 'candidate'
    )
  );

-- Candidate job interactions policies
CREATE POLICY "Candidates can manage their own interactions"
  ON candidate_job_interactions FOR ALL
  TO authenticated
  USING (candidate_id = auth.uid());

CREATE POLICY "Employers can view interactions with their jobs"
  ON candidate_job_interactions FOR SELECT
  TO authenticated
  USING (
    job_id IN (
      SELECT j.id FROM jobs j 
      JOIN employer_details ed ON j.employer_id = ed.profile_id 
      WHERE ed.profile_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_candidate_details_updated_at BEFORE UPDATE ON candidate_details FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employer_details_updated_at BEFORE UPDATE ON employer_details FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();