#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting PearlPath API...\n');

// Check if .env file exists
const fs = require('fs');
const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  console.log('⚠️  .env file not found!');
  console.log('📋 Please copy env.example to .env and configure your environment variables.\n');
  console.log('   cp env.example .env');
  console.log('   # Then edit .env with your configuration\n');
  process.exit(1);
}

// Start the application
const app = spawn('node', ['src/app.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

app.on('close', (code) => {
  console.log(`\n📊 PearlPath API exited with code ${code}`);
});

app.on('error', (error) => {
  console.error('❌ Error starting PearlPath API:', error);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down PearlPath API...');
  app.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down PearlPath API...');
  app.kill('SIGTERM');
});
