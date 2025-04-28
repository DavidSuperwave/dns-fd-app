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
  const emailLines: Record<string, number> = {};
  const repeatedEmailsWithLines: [string, string][] = [];
  let lineNumber = 0;
  let nonEnglishDetected = false;

  try {
    const cleaned = cleanCsv(content);
    if (!cleaned) {
      errors.push("CSV file appears empty or contains no valid data.");
      return { errors, repeatedEmails: [], hasErrors: true };
    }

    const { rows, delimiter } = cleaned;

    // Check and standardize headers
    const firstRow = rows[0];
    const firstRowStr = firstRow.join(',');
    let finalRows: string[][];

    if (firstRowStr.includes('@')) {
      // First row contains '@', so it's data; add headers
      const headers = ['DisplayName', 'EmailAddress'];
      finalRows = [headers, ...rows];
    } else {
      // First row does not contain '@', replace with standard headers
      rows[0] = ['DisplayName', 'EmailAddress'];
      finalRows = rows;
    }

    // Parse the modified CSV
    const csvString = finalRows.map(row => row.join(delimiter)).join('\n');
    const parsedRows = parse(csvString, { columns: true, delimiter });

    // Validate each row
    for (const row of parsedRows) {
      lineNumber++;
      const lineNumberInFile = lineNumber + 1; // Headers are on line 1, data starts at line 2

      // Check for non-English characters specifically in DisplayName and EmailAddress
      const displayName = row.DisplayName || '';
      const emailAddress = row.EmailAddress || '';
      if (containsNonEnglishCharacters(displayName) || containsNonEnglishCharacters(emailAddress)) {
        nonEnglishDetected = true; // Keep flag for hasErrors calculation
        // Add more specific error message
        errors.push(`Invalid characters found. Please use only standard English letters, numbers, and symbols. (Check Line: ${lineNumberInFile})`);
        // Don't break immediately, continue checking other rows for more errors
      }

      const email = row.EmailAddress.trim().toLowerCase();
      if (email in emailLines) {
        repeatedEmailsWithLines.push([
          email,
          `Lines: ${emailLines[email]} & ${lineNumberInFile}`
        ]);
      } else {
        emailLines[email] = lineNumberInFile;
      }

      const [emailValidationError, domain] = validateEmail(email);
      if (emailValidationError) {
        // Add the specific email and the improved error message
        errors.push(`"${email}": ${emailValidationError} (Check Line: ${lineNumberInFile})`);
      }
      if (domain) domainSet.add(domain);
    }

    if (domainSet.size > 1) {
      errors.push("All emails in the file must belong to the same domain (e.g., all '@company.com'). Found multiple domains.");
    }

    // Filter out duplicate non-English error messages if present
    const uniqueErrors = [...new Set(errors)];

    return {
      errors: uniqueErrors, // Use unique errors
      // Removed duplicate 'errors' property
      repeatedEmails: repeatedEmailsWithLines,
      hasErrors: uniqueErrors.length > 0 || nonEnglishDetected || repeatedEmailsWithLines.length > 0 // Check length of uniqueErrors
    };
  } catch (e) {
    console.error("CSV Validation Error:", e); // Log the actual error for debugging
    return {
      errors: [`An unexpected error occurred while reading the CSV file. Please check the file format.`],
      repeatedEmails: [],
      hasErrors: true
    };
  }
}