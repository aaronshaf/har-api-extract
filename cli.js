#!/usr/bin/env node

// Entry point for npm/npx compatibility
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const harPath = join(__dirname, 'har.ts');
const args = process.argv.slice(2);

// Try different locations for tsx
const possibleTsxPaths = [
  join(__dirname, 'node_modules', '.bin', 'tsx'),
  join(__dirname, '..', '.bin', 'tsx'),  // When installed as dependency
  'tsx'  // Global or in PATH
];

let tsxPath = null;
for (const path of possibleTsxPaths) {
  try {
    if (path === 'tsx') {
      // Try to run tsx --version to check if it's available
      execFileSync('tsx', ['--version'], { stdio: 'ignore' });
      tsxPath = 'tsx';
      break;
    } else if (existsSync(path)) {
      tsxPath = path;
      break;
    }
  } catch (e) {
    // Continue to next path
  }
}

if (!tsxPath) {
  console.error('Error: Could not find tsx. This is likely an installation issue.');
  console.error('Try reinstalling: npm install -g har-api-extract');
  process.exit(1);
}

try {
  execFileSync(tsxPath, [harPath, ...args], { stdio: 'inherit' });
} catch (error) {
  // Error already printed to stderr via stdio: 'inherit'
  process.exit(error.status || 1);
}