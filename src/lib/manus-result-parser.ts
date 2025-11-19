/**
 * Utilities for normalizing Manus AI task results into structured JSON reports.
 */

const JSON_BLOCK_REGEX = /```(?:json)?\s*([\s\S]*?)```/i;
const MAX_RECURSION_DEPTH = 10;

const NESTED_RESULT_KEYS = [
  'result',
  'output',
  'data',
  'response',
  'message',
  'messages',
  'content',
  'value',
];

/**
 * Determine if the payload already looks like a structured Manus report.
 */
export function hasManusReportShape(value: any): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  // Phase 1: Client Offer Brief structure
  const isPhase1 = Boolean(
    value.client_offer_brief ||
    value.market_competitive_analysis ||
    value.core_value_proposition
  );

  // Phase 2: ICP Reports structure
  const isPhase2 = Boolean(
    value.icp_reports && Array.isArray(value.icp_reports)
  );

  // Phase 3: Campaign Blueprints structure
  const isPhase3 = Boolean(
    value.campaign_blueprints && Array.isArray(value.campaign_blueprints) ||
    value.target_profile
  );

  // Legacy structures (keep for backwards compatibility)
  const isLegacy = Boolean(
    value.company_overview ||
    value.target_market_analysis ||
    value.competitive_landscape ||
    value.marketing_and_sales_recommendations ||
    value.strategic_recommendations ||
    value.recommendations ||
    value.overview ||
    value.targetMarket ||
    value.valueProposition ||
    value.pricing
  );

  return isPhase1 || isPhase2 || isPhase3 || isLegacy;
}

function tryParseJson(text: string): any | null {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchJsonFromUrl(url: string, fetchedFiles: Set<string>): Promise<any | null> {
  if (!url || fetchedFiles.has(url)) {
    return null;
  }

  fetchedFiles.add(url);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('[Manus Result Parser] Failed to fetch output file:', url, response.status);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json();
    }

    const text = await response.text();
    return tryParseJson(text);
  } catch (error) {
    console.error('[Manus Result Parser] Error fetching output file:', error);
    return null;
  }
}

function extractTextCandidates(contentItem: any): string[] {
  const candidates: string[] = [];

  if (!contentItem) {
    return candidates;
  }

  if (typeof contentItem === 'string') {
    candidates.push(contentItem);
  }

  if (typeof contentItem.text === 'string') {
    candidates.push(contentItem.text);
  } else if (typeof contentItem.text?.value === 'string') {
    candidates.push(contentItem.text.value);
  } else if (Array.isArray(contentItem.text?.content)) {
    candidates.push(contentItem.text.content.join('\n'));
  }

  if (typeof contentItem.value === 'string') {
    candidates.push(contentItem.value);
  }

  if (typeof contentItem.content === 'string') {
    candidates.push(contentItem.content);
  }

  if (typeof contentItem.output === 'string') {
    candidates.push(contentItem.output);
  }

  return candidates.filter(Boolean);
}

async function parseStringPayload(
  text: string,
  depth: number,
  visited: Set<any>,
  fetchedFiles: Set<string>
): Promise<any | null> {
  const trimmed = text?.trim();
  if (!trimmed) {
    return null;
  }

  const direct = tryParseJson(trimmed);
  if (direct) {
    const parsed = await parseManusReportInternal(direct, depth + 1, visited, fetchedFiles);
    if (parsed) return parsed;
  }

  const blockMatch = trimmed.match(JSON_BLOCK_REGEX);
  if (blockMatch?.[1]) {
    const parsedBlock = tryParseJson(blockMatch[1]);
    if (parsedBlock) {
      const parsed = await parseManusReportInternal(parsedBlock, depth + 1, visited, fetchedFiles);
      if (parsed) return parsed;
    }
  }

  return null;
}

async function parseManusReportInternal(
  payload: any,
  depth: number,
  visited: Set<any>,
  fetchedFiles: Set<string>
): Promise<any | null> {
  if (payload === null || payload === undefined) {
    return null;
  }

  if (depth > MAX_RECURSION_DEPTH) {
    console.warn('[Manus Result Parser] Max recursion depth reached');
    return null;
  }

  if (hasManusReportShape(payload)) {
    return payload;
  }

  if (typeof payload === 'string') {
    return parseStringPayload(payload, depth, visited, fetchedFiles);
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const parsed = await parseManusReportInternal(item, depth + 1, visited, fetchedFiles);
      if (parsed) {
        return parsed;
      }
    }
    return null;
  }

  if (typeof payload === 'object') {
    if (visited.has(payload)) {
      return null;
    }
    visited.add(payload);

    // First inspect content array (Manus message structure)
    if (Array.isArray(payload.content)) {
      // Output files first
      for (const contentItem of payload.content) {
        if (contentItem?.type === 'output_file') {
          const fileUrl = contentItem.fileUrl || contentItem.file_url || contentItem.url;
          const inlineJson = contentItem.json || contentItem.data;

          if (inlineJson && hasManusReportShape(inlineJson)) {
            return inlineJson;
          }

          if (fileUrl) {
            const fileData = await fetchJsonFromUrl(fileUrl, fetchedFiles);
            if (fileData) {
              const parsedFile = hasManusReportShape(fileData)
                ? fileData
                : await parseManusReportInternal(fileData, depth + 1, visited, fetchedFiles);
              if (parsedFile) {
                return parsedFile;
              }
            }
          }
        }
      }

      // Text-based content
      for (const contentItem of payload.content) {
        if (contentItem && typeof contentItem === 'object' && hasManusReportShape(contentItem)) {
          return contentItem;
        }

        const candidates = extractTextCandidates(contentItem);
        for (const candidate of candidates) {
          const parsed = await parseStringPayload(candidate, depth + 1, visited, fetchedFiles);
          if (parsed) {
            return parsed;
          }
        }
      }
    }

    // Check for nested keys commonly used in Manus responses
    for (const key of NESTED_RESULT_KEYS) {
      if (key in payload) {
        const parsed = await parseManusReportInternal(
          (payload as Record<string, any>)[key],
          depth + 1,
          visited,
          fetchedFiles
        );
        if (parsed) {
          return parsed;
        }
      }
    }
  }

  return null;
}

/**
 * Attempt to parse various Manus response payloads into a structured report object.
 * Returns `null` when no structured report can be found.
 */
export async function parseManusReportPayload(payload: any): Promise<any | null> {
  return parseManusReportInternal(payload, 0, new Set(), new Set());
}


