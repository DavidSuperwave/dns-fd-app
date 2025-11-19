-- Enable RLS on company_profiles
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Users can view company profiles linked to their projects" ON company_profiles;

-- Create policy to allow users to view company profiles linked to their projects
CREATE POLICY "Users can view company profiles linked to their projects"
ON company_profiles
FOR SELECT
USING (
  id IN (
    SELECT company_profile_id
    FROM projects
    WHERE user_id = auth.uid()
  )
);

-- Allow users to update their own company profiles (via project link)
DROP POLICY IF EXISTS "Users can update company profiles linked to their projects" ON company_profiles;

CREATE POLICY "Users can update company profiles linked to their projects"
ON company_profiles
FOR UPDATE
USING (
  id IN (
    SELECT company_profile_id
    FROM projects
    WHERE user_id = auth.uid()
  )
);
