import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from root directory
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

class PicaService {
  constructor() {
    this.apiUrl = process.env.PICA_API_URL || 'https://api.pica.com';
    this.apiKey = process.env.PICA_API_KEY;
    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      },
      timeout: 60000 // 60 seconds timeout for AI processing
    });
  }

  async analyzeResume(resumeText) {
    try {
      const prompt = `Analyze the following resume text. Act as an expert HR analyst and resume parser. Extract the key information into a structured JSON object. Be precise and thorough. If a field is not found, use null. For skills, use common, descriptive terms. For work experience, list responsibilities/achievements as individual strings.

**Resume Text:**
${resumeText}

**Output JSON Schema:**
{
  "full_name": "string",
  "contact_info": {
    "email": "string",
    "phone": "string",
    "linkedin_url": "string",
    "portfolio_url": "string",
    "github_url": "string"
  },
  "location": "string",
  "summary_or_objective": "string",
  "total_years_experience": "number",
  "skills": {
    "programming_languages": ["string"],
    "frameworks_libraries": ["string"],
    "databases": ["string"],
    "tools": ["string"],
    "cloud_platforms": ["string"],
    "other_technologies": ["string"],
    "soft_skills": ["string"]
  },
  "work_experience": [
    {
      "job_title": "string",
      "company_name": "string",
      "location": "string",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD or 'Present'",
      "responsibilities_achievements": ["string"]
    }
  ],
  "education": [
    {
      "degree": "string",
      "major": "string",
      "institution": "string",
      "location": "string",
      "graduation_date": "YYYY-MM-DD or 'Present'"
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuing_organization": "string",
      "issue_date": "YYYY-MM-DD"
    }
  ],
  "projects": [
    {
      "project_name": "string",
      "description": "string",
      "technologies_used": ["string"],
      "project_url": "string"
    }
  ],
  "languages": ["string"]
}

Please respond with only the JSON object, no additional text.`;

      const response = await this.client.post('/v1/chat/completions', {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert HR analyst and resume parser. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      const content = response.data.choices[0].message.content;
      
      try {
        return JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse Pica response as JSON:', content);
        throw new Error('Invalid JSON response from AI service');
      }
    } catch (error) {
      console.error('Pica resume analysis error:', error);
      throw new Error(`Resume analysis failed: ${error.message}`);
    }
  }

  async analyzeJobDescription(jobDescriptionText) {
    try {
      const prompt = `Analyze the following job description text. Act as an expert HR recruitment analyst. Extract the key requirements, details, and benefits into a structured JSON object. Be precise and thorough. If a field is not found, use null.

**Job Description Text:**
${jobDescriptionText}

**Output JSON Schema:**
{
  "job_title": "string",
  "company_name": "string",
  "location": "string",
  "job_type": "string",
  "salary_range": {
    "min": "number",
    "max": "number",
    "currency": "string",
    "negotiable": "boolean"
  },
  "experience_level": "string",
  "required_years_experience": "number",
  "required_skills": {
    "technical": ["string"],
    "soft_skills": ["string"],
    "other": ["string"]
  },
  "preferred_skills": {
    "technical": ["string"],
    "soft_skills": ["string"],
    "other": ["string"]
  },
  "education_requirements": ["string"],
  "responsibilities": ["string"],
  "about_role_summary": "string",
  "benefits": ["string"],
  "team_size": "string",
  "remote_policy": "string",
  "career_growth_opportunities": "boolean",
  "culture_description": "string",
  "keywords": ["string"]
}

Please respond with only the JSON object, no additional text.`;

      const response = await this.client.post('/v1/chat/completions', {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert HR recruitment analyst. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      const content = response.data.choices[0].message.content;
      
      try {
        return JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse Pica response as JSON:', content);
        throw new Error('Invalid JSON response from AI service');
      }
    } catch (error) {
      console.error('Pica job analysis error:', error);
      throw new Error(`Job analysis failed: ${error.message}`);
    }
  }
}

export default new PicaService();
</invoke>