-- Create tasks table in Supabase
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  user_account TEXT,
  user_email TEXT,
  task_type TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'Medium',
  status TEXT NOT NULL DEFAULT 'Open',
  due_date DATE,
  assigned_to TEXT DEFAULT 'unassigned',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

-- Example task data (optional)
INSERT INTO tasks (user_id, user_account, user_email, task_type, description, priority, status, due_date, assigned_to, tags)
VALUES 
  (
    'sample-user-1', 
    'Acme Corp', 
    'contact@acmecorp.com',
    'DNS Configuration',
    'Update MX records for new email provider',
    'High',
    'Open',
    CURRENT_DATE + INTERVAL '7 days',
    'Support Team',
    ARRAY['dns', 'email']
  );
