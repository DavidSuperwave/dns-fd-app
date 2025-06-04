import { Resend } from 'resend';

// Resend configuration
const resendApiKey = process.env.RESEND_API_KEY;
// IMPORTANT: This 'from' address MUST be from a domain you have verified in your Resend account for production.
// For testing, you can use "onboarding@resend.dev", but emails will show "via resend.dev"
const defaultSenderAddress = process.env.DEFAULT_SENDER_EMAIL || "onboarding@resend.dev"; // Example: "hey@c.superwave.ai" IF VERIFIED

if (!resendApiKey) {
  console.warn('[Resend Email] RESEND_API_KEY is not set. Email sending will likely fail or be severely restricted.');
}

const resend = new Resend(resendApiKey);

/**
 * Sends an email using Resend
 * @param to Recipient email address
 * @param subject Email subject
 * @param plainTextContent Plain text content of the email
 * @param htmlContent HTML content of the email (optional)
 * @param fromAddress Sender email address (optional, defaults to defaultSenderAddress)
 * @returns Promise with the send operation result
 */
export async function sendEmail(
  to: string,
  subject: string,
  plainTextContent: string,
  htmlContent?: string,
  fromAddress?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!resendApiKey) {
    const errorMessage = 'Resend API key is not configured. Cannot send email.';
    console.error('[Resend Email]', errorMessage);
    return { success: false, error: errorMessage };
  }

  const effectiveFromAddress = fromAddress || defaultSenderAddress;

  try {
    console.log(`[Resend Email] Attempting to send email via Resend to ${to} from ${effectiveFromAddress} with subject "${subject}"`);

    const { data, error } = await resend.emails.send({
      from: effectiveFromAddress,
      to: [to], // Resend expects 'to' to be an array of strings
      subject: subject,
      text: plainTextContent,
      html: htmlContent || plainTextContent, // Use plainText as HTML if HTML not provided
    });

    if (error) {
      console.error('[Resend Email] Error sending email:', error);
      return { success: false, error: error.message || 'Unknown error sending email via Resend' };
    }

    console.log('[Resend Email] Email sent successfully. Message ID:', data?.id);
    return {
      success: true,
      messageId: data?.id || 'unknown',
    };
  } catch (e: any) { // Catch any other unexpected errors during the API call itself
    console.error('[Resend Email] Exception during email sending:', e);
    return {
      success: false,
      error: e.message || 'Exception occurred while sending email via Resend',
    };
  }
}

/**
 * Sends an invitation email with a signup link using Resend
 * @param to Recipient email address
 * @param role User role (admin, user, guest)
 * @param token Invitation token
 * @returns Promise with the send operation result
 */
export async function sendInvitationEmail(
  to: string,
  role: string,
  token: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Construct the base URL
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Create the invitation link
  const invitationLink = `${baseUrl}/signup?token=${token}&email=${encodeURIComponent(to)}`;

  // Create the email content
  const subject = "Your Invitation to Superwave";
  const plainTextContent = `
Hello,

You've been invited to join Superwave with the role of '${role}'.

To accept your invitation and set up your account, please click on the following link:
${invitationLink}

If you did not expect this invitation, please ignore this email.

Thanks,
The Superwave Team
`;

  // Create richer HTML content
  const htmlContent = `
    <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9;">
      <div style="text-align: center; margin-bottom: 25px;">
        <img src="${baseUrl}/superwave-logo-black.png" alt="Superwave Logo" style="max-width: 180px; display: block; margin: 0 auto;" />
      </div>
      <h1 style="color: #333; text-align: center; font-size: 24px; margin-bottom: 15px;">You're Invited to Superwave!</h1>
      <p style="color: #555; font-size: 16px; line-height: 1.6;">Hello,</p>
      <p style="color: #555; font-size: 16px; line-height: 1.6;">
        You've been invited to join the Superwave platform with the role: <strong>${role}</strong>.
      </p>
      <p style="color: #555; font-size: 16px; line-height: 1.6;">
        Click the button below to set up your password and access the platform:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${invitationLink}"
           style="background-color: #000000; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">
          Accept Invitation & Set Password
        </a>
      </div>
      <p style="color: #555; font-size: 16px; line-height: 1.6;">
        If the button doesn't work, you can copy and paste this link into your browser:
      </p>
      <p style="background-color: #ffffff; padding: 10px 15px; border: 1px solid #e0e0e0; border-radius: 4px; word-break: break-all; text-align: center; font-size: 14px;">
        <a href="${invitationLink}" style="color: #007bff; text-decoration: none;">${invitationLink}</a>
      </p>
      <p style="margin-top: 30px; font-size: 14px; color: #777; text-align: center; line-height: 1.5;">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;" />
      <p style="font-size: 12px; color: #999; text-align: center;">
        &copy; ${new Date().getFullYear()} Superwave. All rights reserved.
      </p>
    </div>
  `;

  // Send the email using the Resend-backed function
  // The `from` address will be defaultSenderAddress or "onboarding@resend.dev" if not set.
  // You can override it by passing a fourth argument to sendEmail if needed, e.g., "invitations@yourverifieddomain.com"
  return sendEmail(to, subject, plainTextContent, htmlContent);
}

/**
 * Sends a password reset email using Resend
 * @param to Recipient email address
 * @param resetLink The direct link for resetting the password
 * @returns Promise with the send operation result
 */
export async function sendPasswordResetEmail(
  to: string,
  resetLink: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; // Ensure consistent URL base

  const subject = "Reset Your Password - Superwave";
  const plainTextContent = `
Hello,

A password reset was requested for your Superwave account.
If you requested this reset, click the following link to choose a new password:
${resetLink}

If you didn't request this, please ignore this email. Your password will remain unchanged.

Thanks,
The Superwave Team
`;

  const htmlContent = `
    <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9;">
      <div style="text-align: center; margin-bottom: 25px;">
        <img src="${baseUrl}/superwave-logo-black.png" alt="Superwave Logo" style="max-width: 180px; display: block; margin: 0 auto;" />
      </div>
      <h1 style="color: #333; text-align: center; font-size: 24px; margin-bottom: 15px;">Reset Your Password</h1>
      <p style="color: #555; font-size: 16px; line-height: 1.6;">Hello,</p>
      <p style="color: #555; font-size: 16px; line-height: 1.6;">
        We received a request to reset the password for your Superwave account associated with this email address.
      </p>
      <p style="color: #555; font-size: 16px; line-height: 1.6;">
        Click the button below to choose a new password:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}"
           style="background-color: #000000; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">
          Reset Password
        </a>
      </div>
      <p style="color: #555; font-size: 16px; line-height: 1.6;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="background-color: #ffffff; padding: 10px 15px; border: 1px solid #e0e0e0; border-radius: 4px; word-break: break-all; text-align: center; font-size: 14px;">
        <a href="${resetLink}" style="color: #007bff; text-decoration: none;">${resetLink}</a>
      </p>
      <p style="color: #555; font-size: 16px; line-height: 1.6; margin-top: 25px;">
        If you did not request a password reset, please ignore this email. Your password will not be changed.
      </p>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;" />
      <p style="font-size: 12px; color: #999; text-align: center;">
        &copy; ${new Date().getFullYear()} Superwave. All rights reserved.
      </p>
    </div>
  `;

  // Send the email using the Resend-backed function
  // The `from` address will be defaultSenderAddress.
  // You can override it by passing a fourth argument to sendEmail if needed, e.g., "support@yourverifieddomain.com"
  return sendEmail(to, subject, plainTextContent, htmlContent);
}