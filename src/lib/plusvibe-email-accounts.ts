/**
 * Fetch email accounts associated with a campaign
 */
export async function fetchCampaignEmailAccounts(
    campaignId: string,
    credentials?: PlusVibeClientCredentials
): Promise<any[]> {
    try {
        const response = await plusVibeRequest<{ data?: any[]; accounts?: any[]; email_accounts?: any[] }>(
            "/campaign/get/accounts",
            {
                query: { campaign_id: campaignId },
                credentials,
            }
        );

        const accounts = response.accounts || response.email_accounts || response.data || [];
        return Array.isArray(accounts) ? accounts : [];
    } catch (error) {
        if (error instanceof PlusVibeAPIError && error.status === 404) {
            console.warn(`[PlusVibe] No email accounts found for campaign ${campaignId}`);
            return [];
        }
        throw error;
    }
}
