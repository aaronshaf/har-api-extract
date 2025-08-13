#!/usr/bin/env node

// Entry point for npm/npx compatibility
// Spawn tsx as a child process to run the TypeScript file
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tsxPath = join(__dirname, 'node_modules', '.bin', 'tsx');
const harPath = join(__dirname, 'har.ts');
const args = process.argv.slice(2);

const child = spawn(tsxPath, [harPath, ...args], {
  stdio: 'inherit',
  shell: false
});

child.on('error', (error) => {
  // If tsx not found in local node_modules, try global
  const globalChild = spawn('tsx', [harPath, ...args], {
    stdio: 'inherit',
    shell: true
  });
  
  globalChild.on('error', (err) => {
    console.error('Error: tsx is required. Please ensure har-api-extract is properly installed.');
    process.exit(1);
  });
  
  globalChild.on('exit', (code) => {
    process.exit(code || 0);
  });
});

child.on('exit', (code) => {
  process.exit(code || 0);
});