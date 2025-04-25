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