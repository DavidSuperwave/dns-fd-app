const fs = require('fs');
const path = require('path');
require('dotenv').config();

const sqlFilePath = path.join(__dirname, '..', 'create-company-profiles-and-projects.sql');
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

console.log('\x1b[36m%s\x1b[0m', '===================================================');
console.log('\x1b[36m%s\x1b[0m', '   Supabase Database Triggers Setup Instructions   ');
console.log('\x1b[36m%s\x1b[0m', '===================================================');
console.log('');
console.log('You need to run the following SQL in your Supabase Dashboard SQL Editor:');
console.log('');
console.log('\x1b[33m%s\x1b[0m', sqlContent);
console.log('');
console.log('\x1b[36m%s\x1b[0m', '===================================================');
console.log('Instructions:');
console.log('1. Go to your Supabase Dashboard: https://supabase.com/dashboard');
console.log('2. Select your project.');
console.log('3. Go to the "SQL Editor" section (icon with >_).');
console.log('4. Click "New Query".');
console.log('5. Copy and paste the SQL content above.');
console.log('6. Click "Run".');
console.log('');
console.log('This will create the necessary tables and triggers to auto-create projects.');
