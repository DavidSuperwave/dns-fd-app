-- Create storage bucket for company profile files
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-profile-files', 'company-profile-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to upload company profile files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow authenticated users to upload company profile files'
  ) THEN
    CREATE POLICY "Allow authenticated users to upload company profile files"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'company-profile-files'
    );
  END IF;
END $$;

-- Create policy to allow users to read their own company profile files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow users to read their own company profile files'
  ) THEN
    CREATE POLICY "Allow users to read their own company profile files"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'company-profile-files'
      AND (
        -- Admin can read all files
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
        OR
        -- Users can read files for their own company profiles
        -- File path format: {company_profile_id}/{filename}
        auth.uid() IN (
          SELECT user_id
          FROM company_profiles
          WHERE id::text = split_part((storage.objects.name)::text, '/', 1)
        )
      )
    );
  END IF;
END $$;

-- Create policy to allow users to delete their own company profile files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow users to delete their own company profile files'
  ) THEN
    CREATE POLICY "Allow users to delete their own company profile files"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'company-profile-files'
      AND (
        -- Admin can delete all files
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
        OR
        -- Users can delete files for their own company profiles
        -- File path format: {company_profile_id}/{filename}
        auth.uid() IN (
          SELECT user_id
          FROM company_profiles
          WHERE id::text = split_part((storage.objects.name)::text, '/', 1)
        )
      )
    );
  END IF;
END $$;

SELECT 'Company profile storage bucket and policies created successfully!' as result;

