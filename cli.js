#!/usr/bin/env node

// Node.js wrapper for npm/npx compatibility
// The actual tool runs with Bun for better performance

import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if bun is installed
try {
  execSync('bun --version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ Bun is required to run har-api-extract');
  console.error('\nInstall Bun with:');
  console.error('  curl -fsSL https://bun.sh/install | bash');
  console.error('\nOr use npm:');
  console.error('  npm install -g bun');
  process.exit(1);
}

// Run the actual har script with bun
const harScript = join(__dirname, 'har');
const args = process.argv.slice(2);

const child = spawn('bun', [harScript, ...args], {
  stdio: 'inherit',
  shell: false
});

child.on('error', (error) => {
  console.error('❌ Failed to run har-api-extract:', error.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});