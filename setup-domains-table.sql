-- Enable RLS
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON domains
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for service role" ON domains
    FOR INSERT TO service_role USING (true);

CREATE POLICY "Enable update access for service role" ON domains
    FOR UPDATE TO service_role USING (true);

CREATE POLICY "Enable delete access for service role" ON domains
    FOR DELETE TO service_role USING (true);