-- Create company_profiles table
CREATE TABLE IF NOT EXISTS company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  offer_service TEXT NOT NULL,
  pricing TEXT NOT NULL,
  target_market TEXT NOT NULL,
  goals TEXT NOT NULL,
  workflow_status TEXT DEFAULT 'pending', -- pending, generating, creating_report, validating_report, finding_competitors, completed
  manus_workflow_id TEXT, -- Reference to Manus AI workflow
  company_report JSONB, -- Generated report from Manus AI
  competitors_data JSONB, -- Competitor analysis data
  logo_url TEXT, -- URL to company logo
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Create company_profile_files table
CREATE TABLE IF NOT EXISTS company_profile_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Create projects table (linked to company_profiles)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Usually same as client_name, but can be customized
  status TEXT DEFAULT 'active', -- active, generating, paused, completed, deleted
  logo_url TEXT, -- Reference to company logo
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP -- Soft delete
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_company_profiles_user_id ON company_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_company_profiles_workflow_status ON company_profiles(workflow_status);
CREATE INDEX IF NOT EXISTS idx_company_profile_files_profile_id ON company_profile_files(company_profile_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_profile_id ON projects(company_profile_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NULL;

-- Enable Row Level Security
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_profile_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_profiles
DROP POLICY IF EXISTS "Users can view their own company profiles" ON company_profiles;
DROP POLICY IF EXISTS "Users can create their own company profiles" ON company_profiles;
DROP POLICY IF EXISTS "Users can update their own company profiles" ON company_profiles;
DROP POLICY IF EXISTS "Users can delete their own company profiles" ON company_profiles;

CREATE POLICY "Users can view their own company profiles"
  ON company_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own company profiles"
  ON company_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own company profiles"
  ON company_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own company profiles"
  ON company_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for company_profile_files
DROP POLICY IF EXISTS "Users can view files for their company profiles" ON company_profile_files;
DROP POLICY IF EXISTS "Users can upload files for their company profiles" ON company_profile_files;
DROP POLICY IF EXISTS "Users can delete files for their company profiles" ON company_profile_files;

CREATE POLICY "Users can view files for their company profiles"
  ON company_profile_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_profiles
      WHERE company_profiles.id = company_profile_files.company_profile_id
      AND company_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload files for their company profiles"
  ON company_profile_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_profiles
      WHERE company_profiles.id = company_profile_files.company_profile_id
      AND company_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete files for their company profiles"
  ON company_profile_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_profiles
      WHERE company_profiles.id = company_profile_files.company_profile_id
      AND company_profiles.user_id = auth.uid()
    )
  );

-- RLS Policies for projects
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their own projects (soft delete)" ON projects;

CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id OR deleted_at IS NULL);

CREATE POLICY "Users can create their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects (soft delete)"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to automatically create a project when company profile is created
CREATE OR REPLACE FUNCTION create_project_from_company_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Create project immediately when company profile is created
  -- Only create if project doesn't already exist for this company profile
  IF NOT EXISTS (SELECT 1 FROM projects WHERE company_profile_id = NEW.id) THEN
    INSERT INTO projects (user_id, company_profile_id, name, logo_url, status)
    VALUES (
      NEW.user_id,
      NEW.id,
      NEW.client_name,
      NEW.logo_url,
      CASE 
        WHEN NEW.workflow_status = 'completed' THEN 'active'
        ELSE 'generating'
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create project when company profile is created
DROP TRIGGER IF EXISTS on_company_profile_created ON company_profiles;
CREATE TRIGGER on_company_profile_created
  AFTER INSERT ON company_profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_project_from_company_profile();

-- Function to update project status when company profile workflow status changes
CREATE OR REPLACE FUNCTION update_project_status_from_company_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Update project status based on company profile workflow status
  IF NEW.workflow_status = 'completed' AND OLD.workflow_status != 'completed' THEN
    UPDATE projects
    SET status = 'active',
        updated_at = NOW()
    WHERE company_profile_id = NEW.id;
  ELSIF NEW.workflow_status IN ('generating', 'creating_report', 'validating_report', 'finding_competitors') THEN
    UPDATE projects
    SET status = 'generating',
        updated_at = NOW()
    WHERE company_profile_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update project status when company profile workflow status changes
DROP TRIGGER IF EXISTS on_company_profile_status_updated ON company_profiles;
CREATE TRIGGER on_company_profile_status_updated
  AFTER UPDATE OF workflow_status ON company_profiles
  FOR EACH ROW
  WHEN (NEW.workflow_status IS DISTINCT FROM OLD.workflow_status)
  EXECUTE FUNCTION update_project_status_from_company_profile();

