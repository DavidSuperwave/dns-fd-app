-- Create invitations table for user invites
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    token TEXT NOT NULL UNIQUE,
    created_by TEXT DEFAULT 'system',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    used_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);

-- Enable Row Level Security
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Allow admins to read all invitations
CREATE POLICY "Allow admins to read invitations" ON public.invitations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND email = 'admin@superwave.io'
        ) OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Allow admins to insert invitations
CREATE POLICY "Allow admins to insert invitations" ON public.invitations
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND email = 'admin@superwave.io'
        ) OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Allow service role to insert invitations (for API)
CREATE POLICY "Allow service to insert invitations" ON public.invitations
    FOR INSERT TO service_role
    WITH CHECK (true);

-- Allow service role to read invitations (for API)
CREATE POLICY "Allow service to read invitations" ON public.invitations
    FOR SELECT TO service_role
    USING (true);

-- Allow service role to update invitations (for API)
CREATE POLICY "Allow service to update invitations" ON public.invitations
    FOR UPDATE TO service_role
    USING (true);
