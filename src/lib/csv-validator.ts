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
  if (prefix.includes('..')) return "contains two consecutive dots in the prefix";
  if (prefix.endsWith('.')) return "contains a dot immediately before the @ sign";
  return null;
}

function validateEmail(email: string): [string | null, string | null] {
  const prefixError = validateEmailPrefix(email);
  if (prefixError) return [prefixError, null];

  const pattern = /^(?<local>[^@]+)@(?<domain>[^@]+)$/;
  const match = email.match(pattern);
  if (!match) return ["does not match basic email structure", null];
  
  const { local, domain } = match.groups!;
  if (!/^[a-zA-Z0-9.+_-]+$/.test(local)) return ["contains invalid characters in local part", null];
  if ("._-".includes(local[0])) return ["starts with a prohibited symbol", null];
  if (local.includes('+')) return ["local part contains prohibited symbol '+'", null];
  
  const domainParts = domain.split('.');
  if (domainParts.length < 2) return ["missing domain TLD", null];
  
  return [null, domain];
}

function cleanCsv(content: string): CleanedCsv | null {
  const delimiter = detectDelimiter(content.slice(0, 1024));
  const rows = parse(content, { delimiter });
  const cleanedRows = rows.filter(row => row.some(cell => cell.trim()));
  
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
      errors.push("CSV is empty after cleaning");
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

      if (Object.values(row).some(containsNonEnglishCharacters)) {
        nonEnglishDetected = true;
        errors.push(`Non-English characters detected (Line: ${lineNumberInFile})`);
        break;
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

      const [errorMessage, domain] = validateEmail(email);
      if (errorMessage) {
        errors.push(`${email}: ${errorMessage} (Line: ${lineNumberInFile})`);
      }
      if (domain) domainSet.add(domain);
    }

    if (domainSet.size > 1) {
      errors.push("Multiple domains detected in email addresses");
    }

    return {
      errors,
      repeatedEmails: repeatedEmailsWithLines,
      hasErrors: errors.length > 0 || nonEnglishDetected
    };
  } catch (e) {
    return {
      errors: [`Failed to validate CSV: ${e instanceof Error ? e.message : String(e)}`],
      repeatedEmails: [],
      hasErrors: true
    };
  }
}