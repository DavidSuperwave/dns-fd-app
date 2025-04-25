-- Add status column with check constraint
ALTER TABLE public.user_profiles
ADD COLUMN status text;

-- Add check constraint after adding column
ALTER TABLE public.user_profiles
ADD CONSTRAINT user_profiles_status_check 
CHECK (status IN ('pending', 'active', 'inactive'));

-- Set default status for existing rows
UPDATE public.user_profiles
SET status = 'active'
WHERE status IS NULL;

-- Make status column not nullable after setting defaults
ALTER TABLE public.user_profiles
ALTER COLUMN status SET NOT NULL;