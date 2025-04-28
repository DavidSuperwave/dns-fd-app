import { parse } from 'csv-parse/sync';

interface ValidationResult {
  errors: string[];
  repeatedEmails: [string, string][];
  hasErrors: boolean;
}

interface CleanedCsv {
  rows: string[][];
  delimiter: string;
}

function detectDelimiter(sample: string): string {
  const delimiters = [',', ';', '\t', '|'];
  return delimiters.reduce((a, b) => 
    (sample.split(a).length > sample.split(b).length) ? a : b
  );
}

function containsNonEnglishCharacters(text: string): boolean {
  return !/^[\x00-\x7F]*$/.test(text);
}

function validateEmailPrefix(email: string): string | null {
  const [prefix] = email.split('@');
  if (prefix.includes('..')) return "Email name (before @) cannot contain two consecutive dots (..)";
  if (prefix.endsWith('.')) return "Email name (before @) cannot end with a dot (.)";
  return null;
}

function validateEmail(email: string): [string | null, string | null] {
  const prefixError = validateEmailPrefix(email);
  if (prefixError) return [prefixError, null];

  const pattern = /^(?<local>[^@]+)@(?<domain>[^@]+)$/;
  const match = email.match(pattern);
  if (!match) return ["Invalid email format (missing @ or domain)", null];

  const { local, domain } = match.groups!;
  // Simplified check - focus on common invalid chars like spaces, commas, etc.
  if (/[^a-zA-Z0-9.+_-]/.test(local)) return ["Email name (before @) contains invalid characters", null];
  if ("._-".includes(local[0])) return ["Email name (before @) cannot start with '.', '_', or '-'", null];
  if (local.includes('+')) return ["Email name (before @) cannot contain the '+' symbol", null];

  const domainParts = domain.split('.');
  if (domainParts.length < 2 || domainParts.some(part => part.length === 0)) return ["Email domain is incomplete or invalid (e.g., missing .com or has ..)", null];

  return [null, domain];
}

function cleanCsv(content: string): CleanedCsv | null {
  const delimiter = detectDelimiter(content.slice(0, 1024));
  const rows = parse(content, { delimiter });
  const cleanedRows = (rows as string[][]).filter((row: string[]) =>
    row.some((cell: string) => cell.trim())
  );
  
  
  if (cleanedRows.length === 0) return null;

  const columns = cleanedRows[0].map((_, colIndex) => 
    cleanedRows.map(row => row[colIndex])
  );
  
  const nonEmptyColumns = columns.filter(col => col.some(cell => cell.trim()));
  const finalRows = nonEmptyColumns[0].map((_, rowIndex) => 
    nonEmptyColumns.map(col => col[rowIndex] || '')
  );

  return { rows: finalRows, delimiter };
}

export async function validateCsvContent(content: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const domainSet = new Set<string>();
  const emailLines: Record<string, number> = {}; // Tracks email address and its first line number
  const repeatedEmailsWithLines: [string, string][] = [];
  let nonEnglishDetected = false;
  let parsedRows: any[] = []; // Define outside try block

  try {
    // 1. Detect delimiter directly from raw content
    const delimiter = detectDelimiter(content.slice(0, 1024));
    console.log(`[CSV Validator] Detected delimiter: "${delimiter}"`);

    // 2. Parse the *raw* content directly using csv-parse
    //    Let csv-parse handle headers, empty lines, trimming, and column count variations.
    parsedRows = parse(content, {
      columns: true,             // Treat first row as headers
      delimiter: delimiter,
      skip_empty_lines: true,    // Ignore empty lines
      trim: true,                // Trim whitespace from cells/headers
      relax_column_count: true,  // Allow rows with more/fewer columns than headers
      bom: true                  // Handle potential Byte Order Mark
    });
    console.log(`[CSV Validator] Parsed ${parsedRows.length} rows directly from content.`);

    // 3. Basic check after parsing
    if (!parsedRows || parsedRows.length === 0) {
      errors.push("CSV file appears empty or contains no valid data rows.");
      return { errors, repeatedEmails: [], hasErrors: true };
    }

    // Log detected headers
    const headers = Object.keys(parsedRows[0]);
    console.log("[CSV Validator] Detected headers:", headers);

    // Check if required headers exist (case-insensitive check after trim)
    const hasDisplayName = headers.some(h => h.toLowerCase() === 'displayname');
    const hasEmailAddress = headers.some(h => h.toLowerCase() === 'emailaddress');

    if (!hasDisplayName || !hasEmailAddress) {
      errors.push("CSV header row must contain both 'DisplayName' and 'EmailAddress'.");
      return { errors, repeatedEmails: [], hasErrors: true };
    }

    // Find the exact header names (preserving case) for later access
    const displayNameHeader = headers.find(h => h.toLowerCase() === 'displayname')!;
    const emailAddressHeader = headers.find(h => h.toLowerCase() === 'emailaddress')!;
    console.log(`[CSV Validator] Using headers: DisplayName='${displayNameHeader}', EmailAddress='${emailAddressHeader}'`);

    // Validate each data row (lineNumber starts from 1 for data rows)
    parsedRows.forEach((row, index) => {
      const lineNumber = index + 1;
      const lineNumberInFile = lineNumber + 1; // +1 because header is line 1

      // Defensive check in case row is null/undefined somehow
      if (!row) {
        console.warn(`[CSV Validator] Skipping null/undefined row at index ${index}`);
        return;
      }

      const displayName = row[displayNameHeader] || '';
      const emailAddress = row[emailAddressHeader] || '';

      // Basic Row Checks
      if (!emailAddress && displayName) { // Only error if email is missing but display name is present
         errors.push(`Missing EmailAddress on data row ${lineNumber}. (Check Line: ${lineNumberInFile})`);
         return; // Skip further validation for this row
      } else if (!emailAddress && !displayName) {
         // Skip entirely empty rows silently (should be handled by skip_empty_lines, but belt-and-suspenders)
         return;
      }

      // Content Validation
      if (containsNonEnglishCharacters(displayName) || containsNonEnglishCharacters(emailAddress)) {
        nonEnglishDetected = true;
        errors.push(`Invalid characters found in DisplayName or EmailAddress. Please use only standard English letters, numbers, and symbols. (Check Line: ${lineNumberInFile})`);
      }

      const email = emailAddress.toLowerCase();
      const [emailValidationError, domain] = validateEmail(email);
      if (emailValidationError) {
        errors.push(`"${emailAddress}": ${emailValidationError} (Check Line: ${lineNumberInFile})`);
      }
      if (domain) {
        domainSet.add(domain);
      }

      if (emailLines[email]) {
        repeatedEmailsWithLines.push([
          emailAddress,
          `Lines: ${emailLines[email]} & ${lineNumberInFile}`
        ]);
      } else {
        emailLines[email] = lineNumberInFile;
      }
    });

    // File-level Checks
    if (domainSet.size > 1) {
      errors.push("All emails in the file must belong to the same domain (e.g., all '@company.com'). Found multiple domains.");
    }

    // Final Result
    const uniqueErrors = [...new Set(errors)];
    const hasErrors = uniqueErrors.length > 0 || nonEnglishDetected || repeatedEmailsWithLines.length > 0;

    console.log(`[CSV Validator] Validation complete. Has Errors: ${hasErrors}, Errors: ${uniqueErrors.length}, Repeated: ${repeatedEmailsWithLines.length}`);
    return {
      errors: uniqueErrors,
      repeatedEmails: repeatedEmailsWithLines,
      hasErrors: hasErrors
    };

  } catch (e: any) {
    // Log the *entire* error object to the console for maximum detail
    console.error("[CSV Validator] DETAILED PARSING ERROR OBJECT:", e);

    // Attempt to extract common properties for a more informative user message
    let userErrorMessage = "An unexpected error occurred while reading the CSV file.";
    let errorDetails = [];

    if (e && typeof e === 'object') {
      if (e.message) {
        // Use the library's message if available
        userErrorMessage = `Error parsing CSV: ${e.message}`;
      }
      if (e.code) errorDetails.push(`Code: ${e.code}`);
      if (e.lines) errorDetails.push(`Near line: ${e.lines}`);
      // Add other potential properties if needed, e.g., e.column
      if (e.column) errorDetails.push(`Column: ${e.column}`);
    } else if (e instanceof Error) {
       // Fallback for standard Error objects
       userErrorMessage = `Error reading CSV: ${e.message}`;
    } else {
       // Fallback for non-object errors
       userErrorMessage = `An unknown error occurred: ${String(e)}`;
    }

    // Combine the main message with details if any were found
    const finalUserMessage = errorDetails.length > 0
      ? `${userErrorMessage} (${errorDetails.join(', ')}). Please check the file format.`
      : `${userErrorMessage}. Please check the file format.`;

    return {
      errors: [finalUserMessage],
      repeatedEmails: [],
      hasErrors: true
    };
  }
}