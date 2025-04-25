import { EmailClient } from "@azure/communication-email";

// Azure Communication Services configuration
const connectionString = "endpoint=https://sw-01.unitedstates.communication.azure.com/;accesskey=AEukP4bAKqA7qviO1tDeVxTMhzkTpw5ciJl9IhZbFeVOE7OjV9UGJQQJ99AFACULyCpb8TiCAAAAAZCSHrmv";
const senderAddress = "desk@concierge.swbs.co";

/**
 * Sends an email using Azure Communication Services
 * @param to Recipient email address
 * @param subject Email subject
 * @param plainTextContent Plain text content of the email
 * @param htmlContent HTML content of the email (optional)
 * @returns Promise with the send operation result
 */
export async function sendEmail(
  to: string,
  subject: string,
  plainTextContent: string,
  htmlContent?: string
): Promise<{success: boolean, messageId?: string, error?: string}> {
  try {
    // Create the email client
    const emailClient = new EmailClient(connectionString);
    
    // Create the email message according to Azure JS SDK format
    const emailMessage = {
      senderAddress: senderAddress,
      content: {
        subject: subject,
        plainText: plainTextContent,
        html: htmlContent || plainTextContent // Use plainText as HTML if HTML not provided
      },
      recipients: {
        to: [{ address: to }]
      }
    };
    
    console.log(`[Azure Email] Sending email to ${to} with subject "${subject}"`);
    
    // Send the email using the correct SDK method (beginSend for async operation)
    const poller = await emailClient.beginSend(emailMessage);
    const result = await poller.pollUntilDone();
    
    // Log the result for debugging
    console.log('[Azure Email] Email send operation completed:', {
      pollerType: typeof poller,
      resultType: typeof result,
      result: result
    });
    
    // The email was sent successfully since we got here
    console.log('[Azure Email] Email sent successfully');
    return {
      success: true,
      messageId: typeof result?.id === 'string' ? result.id : 'unknown'
    };
    // We don't need an else clause since we're expecting the poller to complete
    // successfully or throw an error if something goes wrong
  } catch (error) {
    console.error('[Azure Email] Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error sending email'
    };
  }
}

/**
 * Sends an invitation email with a signup link
 * @param to Recipient email address
 * @param role User role (admin, user, guest)
 * @param token Invitation token
 * @returns Promise with the send operation result
 */
export async function sendInvitationEmail(
  to: string,
  role: string,
  token: string
): Promise<{success: boolean, messageId?: string, error?: string}> {
  // Construct the base URL
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  // Create the invitation link
  const invitationLink = `${baseUrl}/signup?token=${token}&email=${encodeURIComponent(to)}`;
  
  // Create the email content
  const subject = "Your invitation to Superwave";
  const plainTextContent = `Please use the following link to set your password and access the platform: ${invitationLink}`;
  
  // Create simple HTML content with just a hyperlink
  const htmlContent = `Please use the following <a href="${invitationLink}">link</a> to set your password and access the platform.`;
  
  // Send the email
  return sendEmail(to, subject, plainTextContent, htmlContent);
}