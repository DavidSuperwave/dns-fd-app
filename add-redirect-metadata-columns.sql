-- Add redirect-related columns to domains table if they don't exist

-- Add redirect_url column if it doesn't exist
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
        RAISE NOTICE 'Added redirect_url column to domains table';
    ELSE
        RAISE NOTICE 'redirect_url column already exists in domains table';
    END IF;
END $$;

-- Add redirect_url_last_updated column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'domains' 
        AND column_name = 'redirect_url_last_updated'
    ) THEN
        ALTER TABLE domains 
        ADD COLUMN redirect_url_last_updated TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added redirect_url_last_updated column to domains table';
    ELSE
        RAISE NOTICE 'redirect_url_last_updated column already exists in domains table';
    END IF;
END $$;

-- Add comments to the columns
COMMENT ON COLUMN domains.redirect_url IS 'The URL that this domain redirects to, if any';
COMMENT ON COLUMN domains.redirect_url_last_updated IS 'Timestamp when the redirect URL was last updated';

-- Verify the columns were added
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'domains' 
AND column_name IN ('redirect_url', 'redirect_url_last_updated')
ORDER BY column_name;
