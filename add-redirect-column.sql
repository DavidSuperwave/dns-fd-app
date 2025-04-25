-- Add redirect_url column to domains table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'domains' 
        AND column_name = 'redirect_url'
    ) THEN
        ALTER TABLE domains 
        ADD COLUMN redirect_url TEXT;
    END IF;
END $$;

-- Add comment to the column
COMMENT ON COLUMN domains.redirect_url IS 'The URL that this domain redirects to, if any';