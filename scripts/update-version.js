#!/usr/bin/env node
/**
 * Aggiorna il campo "version" nei package.json di root, frontend e backend.
 * Viene invocato da semantic-release tramite @semantic-release/exec:
 *   node scripts/update-version.js <nuova-versione>
 */

const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/update-version.js <version>');
  process.exit(1);
}

const files = [
  path.resolve(__dirname, '../package.json'),
  path.resolve(__dirname, '../frontend/package.json'),
  path.resolve(__dirname, '../backend/package.json'),
];

for (const filePath of files) {
  const pkg = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  pkg.version = version;
  fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Updated ${path.relative(process.cwd(), filePath)} → v${version}`);
}
