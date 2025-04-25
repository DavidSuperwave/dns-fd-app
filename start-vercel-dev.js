#!/usr/bin/env node

/**
 * Script to kill all running ports and start vercel dev with cron simulation
 * This script will:
 * 1. Kill any processes running on common development ports (3000, 3001, etc.)
 * 2. Start vercel dev with --listen 3000
 */

const { execSync, spawn } = require('child_process');
const process = require('process');
const os = require('os');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Log with timestamp and color
function log(message, color = colors.reset) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

// Kill processes on common development ports
function killPorts() {
  const portsToKill = [3000, 3001, 3002, 3003, 3004, 3005, 3006];
  log('Killing processes on ports: ' + portsToKill.join(', '), colors.yellow);

  try {
    if (os.platform() === 'win32') {
      // Windows
      portsToKill.forEach(port => {
        try {
          execSync(`FOR /F "tokens=5" %a in ('netstat -ano ^| findstr :${port} ^| findstr LISTENING') do taskkill /F /PID %a`, { stdio: 'ignore' });
          log(`Killed process on port ${port}`, colors.green);
        } catch (e) {
          // Process might not exist, which is fine
        }
      });
    } else {
      // macOS/Linux
      portsToKill.forEach(port => {
        try {
          execSync(`lsof -i :${port} -t | xargs -r kill -9`, { stdio: 'ignore' });
          log(`Killed process on port ${port}`, colors.green);
        } catch (e) {
          // Process might not exist, which is fine
        }
      });
    }
    log('Port cleanup completed', colors.green);
  } catch (error) {
    log(`Error killing ports: ${error.message}`, colors.red);
  }
}

// Start vercel dev with cron simulation
function startVercelDev() {
  log('Starting vercel dev with cron simulation...', colors.cyan);
  
  // Set environment variables for better debugging
  const env = {
    ...process.env,
    DEBUG: 'vercel:*,vercel:cron:*',
    NODE_ENV: 'development'
  };

  const vercel = spawn('npx', ['vercel', 'dev', '--listen', '3000'], {
    env,
    stdio: 'inherit',
    shell: true
  });

  vercel.on('error', (error) => {
    log(`Failed to start vercel dev: ${error.message}`, colors.red);
  });

  log('Vercel dev process started', colors.green);
  log('URL for cron endpoint: http://localhost:3000/api/cron/sync', colors.magenta);
  log('URL for cron monitor: http://localhost:3000/cron-monitor', colors.magenta);
  log('To simulate a cron job manually, send a GET request with Vercel cron headers:', colors.cyan);
  log('curl -X GET "http://localhost:3000/api/cron/sync" \\', colors.blue);
  log('  -H "User-Agent: vercel-cron/1.0" \\', colors.blue);
  log('  -H "x-vercel-cron: true"', colors.blue);
}

// Main execution
(async function main() {
  log('=== Starting Vercel Dev with Cron Simulation ===', colors.cyan);
  
  // Kill all running ports
  killPorts();
  
  // Wait a moment to ensure ports are freed
  setTimeout(() => {
    // Start vercel dev
    startVercelDev();
  }, 1000);
})();