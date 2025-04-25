// Execute this in the Supabase SQL editor to disable confirmation emails
// for users signing up through our custom invite flow

/*
This script configures Supabase Auth to:
1. Disable email confirmations for new signups
2. Auto-confirm new users (they'll be pre-verified since we invited them)
3. Prevent sending Supabase's built-in emails
*/

// SQL script to run

/*
-- Update auth.config to disable email confirmations
UPDATE auth.config 
SET confirm_email_template_id = NULL,
    enable_signup_email_otp = false,
    mailer_autoconfirm = true,
    sms_autoconfirm = true;

-- Check the current configuration
SELECT * FROM auth.config;

-- For already invited users, confirm their emails if needed
UPDATE auth.users
SET email_confirmed_at = CURRENT_TIMESTAMP
WHERE email_confirmed_at IS NULL;
*/

console.log(`
Execute the following SQL in the Supabase SQL Editor to disable confirmation emails:

------------------------------------------------------

-- Update auth.config to disable email confirmations
UPDATE auth.config 
SET confirm_email_template_id = NULL,
    enable_signup_email_otp = false,
    mailer_autoconfirm = true,
    sms_autoconfirm = true;

-- Check the current configuration
SELECT * FROM auth.config;

-- For already invited users, confirm their emails if needed
UPDATE auth.users
SET email_confirmed_at = CURRENT_TIMESTAMP
WHERE email_confirmed_at IS NULL;

------------------------------------------------------

After running this script, new users will not receive the default Supabase confirmation emails.
They will be automatically confirmed when they sign up with an invitation link.
`);