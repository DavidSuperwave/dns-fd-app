#!/usr/bin/env node

/**
 * Cloudflare Domain Scanner
 * 
 * This script initiates a background scan of all Cloudflare domains.
 * It should be run periodically (e.g., via cron job) to keep domain data fresh.
 * 
 * Environment variables:
 * - SCAN_SECRET_KEY: The secret key for authorizing the scan (defaults to 'superwave-scheduled-scan-key')
 * - SCAN_ENDPOINT: The API endpoint URL (defaults to http://localhost:3000/api/cloudflare/scheduled-scan)
 * - SCAN_PER_PAGE: Number of items per page (defaults to 50)
 * 
 * Example cron entry (every hour):
 * 0 * * * * node /path/to/scheduled-scan.js >> /path/to/scan.log 2>&1
 */

const https = require('https');
const http = require('http');

// Configuration - can be overridden with environment variables
const config = {
  secretKey: process.env.SCAN_SECRET_KEY || 'superwave-scheduled-scan-key',
  endpoint: process.env.SCAN_ENDPOINT || 'http://localhost:3000/api/cloudflare/scheduled-scan',
  perPage: parseInt(process.env.SCAN_PER_PAGE || '50', 10),
  timeout: parseInt(process.env.SCAN_TIMEOUT || '30000', 10) // 30 seconds
};

/**
 * Logger function with timestamps
 */
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logMethod = isError ? console.error : console.log;
  logMethod(`[${timestamp}] ${message}`);
}

/**
 * Make an HTTP request
 */
function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    // Choose the appropriate library based on the URL
    const httpLib = url.startsWith('https') ? https : http;
    
    const req = httpLib.request(url, options, (res) => {
      const chunks = [];
      
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        let data;
        
        try {
          data = JSON.parse(body);
        } catch (e) {
          data = { success: false, error: 'Failed to parse response', body };
        }
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, data });
        } else {
          reject({ 
            statusCode: res.statusCode, 
            data,
            message: `HTTP Error ${res.statusCode}: ${res.statusMessage}`
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject({ message: `Request failed: ${error.message}`, error });
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject({ message: 'Request timed out' });
    });
    
    // Set timeout
    req.setTimeout(config.timeout);
    
    // End the request
    req.end();
  });
}

/**
 * Run the scheduled scan
 */
async function runScheduledScan() {
  log('Starting scheduled Cloudflare domain scan');
  
  try {
    // Prepare request URL with any query parameters
    const url = new URL(config.endpoint);
    url.searchParams.append('per_page', config.perPage.toString());
    
    // Make the request
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.secretKey}`
      }
    };
    
    const response = await makeRequest(url.toString(), options);
    
    log(`Scan initiated successfully (ID: ${response.data.scanId})`);
    log(`Scanning ${response.data.perPage} domains per page`);
    
    return { success: true, scanId: response.data.scanId };
  } catch (error) {
    log(`Failed to initiate scan: ${error.message}`, true);
    
    // Log detailed error information if available
    if (error.data) {
      log(`Error details: ${JSON.stringify(error.data)}`, true);
    }
    
    return { success: false, error };
  }
}

// Run the scan if this file is executed directly
if (require.main === module) {
  runScheduledScan()
    .then((result) => {
      if (result.success) {
        log('Scheduled scan job completed successfully');
        process.exit(0);
      } else {
        log('Scheduled scan job failed', true);
        process.exit(1);
      }
    })
    .catch((err) => {
      log(`Unexpected error: ${err.message}`, true);
      process.exit(1);
    });
} else {
  // Export for use in other scripts
  module.exports = { runScheduledScan };
}