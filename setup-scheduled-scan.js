#!/usr/bin/env node

/**
 * Superwave DNS - Scheduled Scan Setup
 * 
 * This script helps set up automated hourly scanning for Cloudflare domains.
 * It will create or update a cron job to run the scheduled-scan.js script.
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const DEFAULT_SCAN_INTERVAL = '0 * * * *'; // Every hour at minute 0
const CONFIG_FILE = path.join(__dirname, '.scan-config.json');
const SCAN_SCRIPT = path.join(__dirname, 'scheduled-scan.js');
const LOG_FILE = path.join(__dirname, 'scan.log');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper: Execute a command and return a promise
function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.warn(`Command stderr: ${stderr}`);
      }
      resolve(stdout.trim());
    });
  });
}

// Helper: Save configuration to file
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    console.log(`Configuration saved to ${CONFIG_FILE}`);
    return true;
  } catch (error) {
    console.error(`Error saving configuration: ${error.message}`);
    return false;
  }
}

// Helper: Load configuration from file
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(configData);
    }
  } catch (error) {
    console.error(`Error loading configuration: ${error.message}`);
  }
  return null;
}

// Helper: Make script executable
async function makeExecutable(scriptPath) {
  try {
    await execCommand(`chmod +x "${scriptPath}"`);
    console.log(`Made ${scriptPath} executable`);
    return true;
  } catch (error) {
    console.error(`Error making script executable: ${error.message}`);
    return false;
  }
}

// Helper: Check if cron is installed
async function checkCronInstalled() {
  try {
    await execCommand('crontab -l');
    return true;
  } catch (error) {
    return false;
  }
}

// Helper: Set up cron job
async function setupCronJob(config) {
  try {
    // Get current crontab
    let currentCrontab = '';
    try {
      currentCrontab = await execCommand('crontab -l');
    } catch (error) {
      // Empty crontab is fine
    }

    // Build the cron job line
    const cronJobLine = `${config.interval} node "${SCAN_SCRIPT}" >> "${LOG_FILE}" 2>&1`;
    
    // Check if the job already exists
    const cronJobPattern = new RegExp(`.*node\\s+"${SCAN_SCRIPT.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}".*`);
    const lines = currentCrontab.split('\n');
    let jobExists = false;
    
    for (let i = 0; i < lines.length; i++) {
      if (cronJobPattern.test(lines[i])) {
        // Replace existing job
        lines[i] = cronJobLine;
        jobExists = true;
        break;
      }
    }
    
    // Add new job if it doesn't exist
    if (!jobExists) {
      lines.push(cronJobLine);
    }
    
    // Save the updated crontab
    const newCrontab = lines.join('\n');
    fs.writeFileSync('/tmp/superwave-crontab', newCrontab);
    await execCommand('crontab /tmp/superwave-crontab');
    fs.unlinkSync('/tmp/superwave-crontab');
    
    console.log(`Cron job ${jobExists ? 'updated' : 'created'} successfully!`);
    return true;
  } catch (error) {
    console.error(`Error setting up cron job: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  console.log('\n===== Superwave DNS - Scheduled Scan Setup =====\n');
  
  // Check if cron is installed
  const cronInstalled = await checkCronInstalled();
  if (!cronInstalled) {
    console.error('Error: cron is not installed or not available. Please install cron first.');
    process.exit(1);
  }
  
  // Check if scan script exists
  if (!fs.existsSync(SCAN_SCRIPT)) {
    console.error(`Error: Scan script not found at ${SCAN_SCRIPT}`);
    process.exit(1);
  }
  
  // Make sure the scan script is executable
  await makeExecutable(SCAN_SCRIPT);
  
  // Load existing configuration if available
  const existingConfig = loadConfig();
  
  // Ask for scan interval
  rl.question(`Enter cron schedule (default: "${DEFAULT_SCAN_INTERVAL}" - every hour):\n`, async (interval) => {
    // Use default or existing interval if none provided
    interval = interval.trim() || (existingConfig?.interval || DEFAULT_SCAN_INTERVAL);
    
    // Check if interval looks valid
    if (!interval.match(/^(\S+\s+){4}\S+$/)) {
      console.warn('Warning: The schedule format looks incorrect. A cron schedule should have 5 fields: minute, hour, day, month, weekday');
      
      // Ask for confirmation
      rl.question('Continue anyway? (y/n): ', async (confirm) => {
        if (confirm.toLowerCase() !== 'y') {
          console.log('Setup cancelled.');
          rl.close();
          return;
        }
        
        await finishSetup(interval);
      });
    } else {
      await finishSetup(interval);
    }
  });
  
  // Finish setup with the provided interval
  async function finishSetup(interval) {
    // Save configuration
    const config = {
      interval,
      lastSetup: new Date().toISOString()
    };
    
    saveConfig(config);
    
    // Set up cron job
    const success = await setupCronJob(config);
    
    if (success) {
      console.log('\n===== Setup Complete =====');
      console.log(`Cloudflare domain scans will run at: ${interval}`);
      console.log(`Log file: ${LOG_FILE}`);
      console.log('\nYou can modify this schedule by running this setup script again.');
    } else {
      console.error('\nSetup failed. Please check the error messages above.');
    }
    
    rl.close();
  }
}

// Run the main function
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});