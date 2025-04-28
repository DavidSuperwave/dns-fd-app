-- Create storage bucket for CSV files
INSERT INTO storage.buckets (id, name, public)
VALUES ('domain-csv-files', 'domain-csv-files', false)
ON CONFLICT (id) DO NOTHING;

-- Add storage_url column to domains table
ALTER TABLE domains 
ADD COLUMN IF NOT EXISTS storage_url TEXT;

-- Create policy to allow authenticated users to upload CSV files if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow authenticated users to upload CSV files'
  ) THEN
    CREATE POLICY "Allow authenticated users to upload CSV files"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'domain-csv-files'
      AND (storage.extension(name) = 'csv')
    );
  END IF;
END $$;

-- Create policy to allow users to read their own domain CSV files if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow users to read their own domain CSV files'
  ) THEN
    CREATE POLICY "Allow users to read their own domain CSV files"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'domain-csv-files'
      AND (
        -- Admin can read all files
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
        OR
        -- Users can read files for domains assigned to them
        auth.uid() IN (
          SELECT user_id
          FROM domains
          WHERE storage_url LIKE '%' || storage.objects.name
        )
      )
    );
  END IF;
END $$;