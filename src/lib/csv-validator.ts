import { parse } from 'csv-parse/sync';

// --- Interfaces ---
interface ValidationResult {
  errors: string[];
  repeatedEmails: [string, string][];
  hasErrors: boolean;
  domain?: string | null; // The single domain found in the file
  cleanedContent?: string; // The CSV content with standardized headers
}

// --- TLD Caching (for performance) ---
let tlds: Set<string> = new Set();
let lastTldFetch: number = 0;

// The new function using fetch
async function getTldSet(): Promise<Set<string>> {
  const oneDay = 24 * 60 * 60 * 1000;
  if (tlds.size > 0 && (Date.now() - lastTldFetch < oneDay)) {
    return tlds;
  }
  try {
    const tldUrl = "https://data.iana.org/TLD/tlds-alpha-by-domain.txt";
    const response = await fetch(tldUrl); // <-- Use fetch

    // With fetch, you must manually check for HTTP errors
    if (!response.ok) {
      throw new Error(`Failed to fetch TLDs with status: ${response.status}`);
    }

    const textData = await response.text(); // Get the response body as text
    const tldList = textData.split('\n')
      .filter((tld: string) => tld && !tld.startsWith('#'))
      .map((tld: string) => tld.toLowerCase());
    
    tlds = new Set(tldList);
    lastTldFetch = Date.now();
    console.log(`[Validator] Successfully fetched and cached ${tlds.size} TLDs.`);
    return tlds;
  } catch (e) {
    console.error(`Error downloading TLDs: ${e}`);
    if (tlds.size > 0) return tlds;
    throw new Error("Could not download required TLD list for validation.");
  }
}

// --- Helper Functions (from your script) ---
function detectDelimiter(sample: string): string {
  const delimiters = [',', ';', '\t', '|'];
  return delimiters.reduce((a, b) => 
    (sample.split(a).length > sample.split(b).length) ? a : b
  );
}

function containsNonEnglishCharacters(text: string): boolean {
  return !/^[\x00-\x7F]*$/.test(text);
}

function validateEmail(email: string, tldSet: Set<string>): [string | null, string | null] {
    const [prefix] = email.split('@');
    if (prefix.includes('..')) return ["contains two consecutive dots in the prefix", null];
    if (prefix.endsWith('.')) return ["contains a dot immediately before the @ sign", null];

    const pattern = /^(?<local>[^@]+)@(?<domain>[^@]+)$/;
    const match = email.match(pattern);
    if (!match) return ["does not match basic email structure", null];

    const { local, domain } = match.groups!;
    if (!/^[a-zA-Z0-9.+_-]+$/.test(local)) return ["contains invalid characters in local part", null];
    if ("._-".includes(local[0])) return ["starts with a prohibited symbol", null];
    if (local.includes('+')) return ["local part contains prohibited symbol '+'", null];
    
    const domainParts = domain.split('.');
    if (domainParts.length < 2) return ["missing domain TLD", null];
    if (!tldSet.has(domainParts[domainParts.length - 1].toLowerCase())) return ["has invalid TLD", null];
    
    return [null, domain];
}

// --- Main Validator Function ---
export async function validateCsvForDeployment(csvContent: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const domainSet = new Set<string>();
  const emailLines: Record<string, number> = {};
  const repeatedEmailsWithLines: [string, string][] = [];

  try {
    if (!csvContent || csvContent.trim().length === 0) {
      return { errors: ["CSV content is empty."], repeatedEmails: [], hasErrors: true };
    }

    const tldSet = await getTldSet();
    const delimiter = detectDelimiter(csvContent.slice(0, 1024));
    
    // Use parse to get rows, without assuming headers yet.
    let rows: string[][] = parse(csvContent, { delimiter, skip_empty_lines: true, trim: true });

    if (rows.length === 0) {
        return { errors: ["CSV contains no data rows."], repeatedEmails: [], hasErrors: true };
    }
    
    // Intelligent header standardization
    const firstRowStr = rows[0].join(delimiter);
    if (firstRowStr.includes('@')) {
      // First row appears to be data, prepend standard headers
      rows.unshift(['DisplayName', 'EmailAddress']);
    } else {
      // First row appears to be a header, replace it
      rows[0] = ['DisplayName', 'EmailAddress'];
    }

    // Convert back to a clean string and re-parse with headers object
    const cleanedContent = rows.map(row => row.join(',')).join('\n');
    const parsedRows = parse(cleanedContent, { columns: true, skip_empty_lines: true, trim: true });

    // Validate each row
    parsedRows.forEach((row: any, index: number) => {
        const lineNumberInFile = index + 2; // Line 1 is header, data starts on 2
        
        if (containsNonEnglishCharacters(row.DisplayName) || containsNonEnglishCharacters(row.EmailAddress)) {
            errors.push(`Non-English characters detected on line ${lineNumberInFile}.`);
        }

        const email = (row.EmailAddress || '').trim().toLowerCase();
        if (!email) {
            errors.push(`Missing email address on line ${lineNumberInFile}.`);
            return; // Skip other email checks for this row
        }

        if (emailLines[email]) {
            repeatedEmailsWithLines.push([email, `Lines: ${emailLines[email]} & ${lineNumberInFile}`]);
        } else {
            emailLines[email] = lineNumberInFile;
        }

        const [errorMessage, domain] = validateEmail(email, tldSet);
        if (errorMessage) {
            errors.push(`"${email}": ${errorMessage} (Line: ${lineNumberInFile})`);
        }
        if (domain) {
            domainSet.add(domain);
        }
    });

    if (domainSet.size > 1) {
        errors.push("Multiple domains detected in email addresses. All emails must belong to the same domain.");
    }
    
    const hasErrors = errors.length > 0 || repeatedEmailsWithLines.length > 0;
    const finalDomain = domainSet.size === 1 ? Array.from(domainSet)[0] : null;

    return {
      errors,
      repeatedEmails: repeatedEmailsWithLines,
      hasErrors,
      domain: finalDomain,
      cleanedContent: hasErrors ? undefined : cleanedContent,
    };

  } catch (e: any) {
    console.error("Error during CSV validation:", e.message);
    return { errors: [`Failed to parse CSV file: ${e.message}`], repeatedEmails: [], hasErrors: true };
  }
}