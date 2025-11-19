/**
 * Manus AI Kickoff Prompt Template
 * Dynamically constructs the prompt for company profile generation
 */

interface CompanyProfileData {
  clientName: string;
  industry: string;
  offerService: string;
  pricing: string;
  targetMarket: string;
  goals: string;
  fileNames?: string[];
}

/**
 * Constructs the kickoff prompt for Manus AI
 */
export function buildKickoffPrompt(data: CompanyProfileData): string {
  const { clientName, industry, offerService, pricing, targetMarket, goals, fileNames = [] } = data;

  const prompt = `You are a business research and analysis expert. Your task is to create a comprehensive company profile and market analysis report for ${clientName}.

## COMPANY INFORMATION

**Company Name:** ${clientName}
**Industry:** ${industry}
**What They Offer/Service:** ${offerService}
**Pricing Model:** ${pricing}
**Target Market:** ${targetMarket}
**Success Goals:** ${goals}

${fileNames.length > 0 ? `## UPLOADED FILES\n\nThe following files have been uploaded for additional context:\n${fileNames.map(name => `- ${name}`).join('\n')}\n\nPlease review these files and incorporate relevant information into your analysis.` : ''}

## YOUR TASK

Create a comprehensive company profile and market analysis report that includes:

1. **Company Overview**
   - Detailed description of the company and its offerings
   - Business model and value proposition
   - Key differentiators

2. **Target Market Analysis**
   - Detailed profile of ideal customers
   - Market size and opportunity
   - Customer pain points and needs
   - Buying behavior and decision-making process

3. **Competitive Landscape**
   - Identify main competitors
   - Competitive advantages and disadvantages
   - Market positioning
   - Pricing comparison

4. **Marketing & Sales Recommendations**
   - Recommended messaging and positioning
   - Channel recommendations
   - Campaign ideas aligned with their goals: ${goals}
   - Content strategy suggestions

5. **Strategic Recommendations**
   - Actionable insights for growth
   - Opportunities for market expansion
   - Risk factors and mitigation strategies

## OUTPUT FORMAT

Please provide your analysis in a structured JSON format that can be easily parsed and displayed. The report should be comprehensive, data-driven, and actionable.

Focus on providing insights that will help ${clientName} achieve their stated goals: ${goals}`;

  return prompt;
}

