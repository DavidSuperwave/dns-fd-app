-- Create a table to track pending user invitations
CREATE TABLE pending_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    invitation_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    created_by TEXT,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW() + INTERVAL '7 days'),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for common queries
CREATE INDEX idx_pending_users_email ON pending_users(email);
CREATE INDEX idx_pending_users_token ON pending_users(invitation_token);
CREATE INDEX idx_pending_users_status ON pending_users(status);

-- Add RLS policies
ALTER TABLE pending_users ENABLE ROW LEVEL SECURITY;

-- Allow admins to read all pending users
CREATE POLICY "Allow admins to read pending_users"
ON pending_users FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Allow system to insert new pending users
CREATE POLICY "Allow system to insert pending_users"
ON pending_users FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Allow system to update pending users
CREATE POLICY "Allow system to update pending_users"
ON pending_users FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);