// Component Debug Script
// This script helps diagnose issues with component imports and path resolution

const fs = require('fs');
const path = require('path');

// Log function that shows clear visual separators
function logHeader(message) {
  console.log('\n' + '='.repeat(80));
  console.log(message);
  console.log('='.repeat(80) + '\n');
}

// Check if a file exists and log its details
function checkFile(filePath) {
  try {
    const fullPath = path.resolve(filePath);
    const stats = fs.statSync(fullPath);
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    const firstLine = fileContent.split('\n')[0];
    
    console.log(`✅ File exists: ${fullPath}`);
    console.log(`   - Size: ${stats.size} bytes`);
    console.log(`   - Modified: ${stats.mtime}`);
    console.log(`   - First line: "${firstLine}"`);
    
    if (firstLine.includes('export default')) {
      console.log(`   - Default export found in first line`);
    } else {
      // Scan for default export in the file
      const hasDefaultExport = /export\s+default/.test(fileContent);
      console.log(`   - Default export found: ${hasDefaultExport ? 'Yes' : 'No'}`);
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Error with file ${filePath}: ${error.message}`);
    return false;
  }
}

// Test various relative paths from the users page to find the dashboard layout
function testRelativePaths() {
  logHeader('TESTING RELATIVE PATHS FROM users/page.tsx TO dashboard-layout.tsx');
  
  // Starting from dns-fd-app/src/app/users/page.tsx
  const basePaths = [
    './components/layout/dashboard-layout.tsx',                 // Same directory
    '../components/layout/dashboard-layout.tsx',                // One level up
    '../../components/layout/dashboard-layout.tsx',             // Two levels up
    '../../../components/layout/dashboard-layout.tsx',          // Three levels up
    '../../../../components/layout/dashboard-layout.tsx',       // Four levels up
    '../../../../../components/layout/dashboard-layout.tsx',    // Five levels up
  ];
  
  // Test from the perspective of app/users (where page.tsx is)
  const fromDir = 'dns-fd-app/src/app/users';
  
  for (const relativePath of basePaths) {
    const testPath = path.join(fromDir, relativePath);
    console.log(`\nTesting path: ${relativePath}`);
    checkFile(testPath);
  }
}

// Check all dashboard-layout.tsx files in the project
function findAllLayoutComponents() {
  logHeader('FINDING ALL dashboard-layout.tsx FILES IN PROJECT');
  
  // Look in standard locations
  const possiblePaths = [
    'src/components/layout/dashboard-layout.tsx',
    'dns-fd-app/src/components/layout/dashboard-layout.tsx',
    'components/layout/dashboard-layout.tsx',
    'dns-fd-app/components/layout/dashboard-layout.tsx',
  ];
  
  for (const layoutPath of possiblePaths) {
    console.log(`\nChecking: ${layoutPath}`);
    checkFile(layoutPath);
  }
}

// Check import resolution in Next.js config
function checkNextConfig() {
  logHeader('CHECKING NEXT.JS CONFIGURATION');
  
  try {
    const nextConfigPath = 'dns-fd-app/next.config.ts';
    const configExists = fs.existsSync(nextConfigPath);
    
    if (configExists) {
      const configContent = fs.readFileSync(nextConfigPath, 'utf8');
      console.log(`✅ Next.js config found at ${nextConfigPath}`);
      
      // Check for path aliases
      if (configContent.includes('alias')) {
        console.log(`   - Path aliases found in Next.js config`);
        
        // Simple regex to extract aliases (might not catch all formats)
        const aliasMatch = configContent.match(/alias\s*:\s*{([^}]*)}/);
        if (aliasMatch && aliasMatch[1]) {
          console.log(`   - Aliases defined: ${aliasMatch[1]}`);
        }
      } else {
        console.log(`   - No path aliases found in Next.js config`);
      }
    } else {
      console.log(`❌ Next.js config not found at ${nextConfigPath}`);
    }
    
    // Also check tsconfig.json for path mappings
    const tsConfigPath = 'dns-fd-app/tsconfig.json';
    const tsConfigExists = fs.existsSync(tsConfigPath);
    
    if (tsConfigExists) {
      const tsConfigContent = fs.readFileSync(tsConfigPath, 'utf8');
      const tsConfig = JSON.parse(tsConfigContent);
      
      console.log(`✅ TypeScript config found at ${tsConfigPath}`);
      
      if (tsConfig.compilerOptions && tsConfig.compilerOptions.paths) {
        console.log(`   - Path mappings found in tsconfig.json:`);
        console.log(JSON.stringify(tsConfig.compilerOptions.paths, null, 2));
      } else {
        console.log(`   - No path mappings found in tsconfig.json`);
      }
    } else {
      console.log(`❌ TypeScript config not found at ${tsConfigPath}`);
    }
  } catch (error) {
    console.log(`❌ Error checking configuration: ${error.message}`);
  }
}

// Run all diagnostic functions
function runAllDiagnostics() {
  logHeader('COMPONENT IMPORT DIAGNOSTICS');
  console.log('Current directory:', process.cwd());
  
  findAllLayoutComponents();
  testRelativePaths();
  checkNextConfig();
  
  logHeader('DIAGNOSTICS COMPLETE');
}

// Execute all diagnostics
runAllDiagnostics();