#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const GROUP_FILES_DIR = __dirname;
const DEFAULT_OUTPUT_DIR = path.join(__dirname, 'exported-migrations');

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    outputDir: args.find(a => !a.startsWith('--')) || DEFAULT_OUTPUT_DIR,
    dryRun: args.includes('--dry-run')
  };
}

function extractMigrations(groupFilePath) {
  const content = fs.readFileSync(groupFilePath, 'utf8');
  const migrations = [];
  const regex = /-- ={76}\n-- MIGRATION \d+: ([^\n]+)\n-- ={76}\n([\s\S]*?)(?=-- ={76}|\/\*\n={80}\nEND OF GROUP)/g;
  
  let match;
  while ((match = regex.exec(content)) !== null) {
    migrations.push({
      filename: match[1].trim(),
      content: match[2].trim().replace(/\n{3,}$/, '\n')
    });
  }
  return migrations;
}

function exportMigrations(config) {
  console.log('Export Individual Migrations\n' + '='.repeat(80));
  console.log(`Output: ${config.outputDir}`);
  console.log(`Mode: ${config.dryRun ? 'DRY RUN' : 'EXPORT'}\n`);

  const groupFiles = fs.readdirSync(GROUP_FILES_DIR)
    .filter(f => f.startsWith('group-') && f.endsWith('.sql')).sort();

  if (!config.dryRun && !fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }

  let total = 0;
  groupFiles.forEach(groupFile => {
    console.log(`Processing: ${groupFile}`);
    const migrations = extractMigrations(path.join(GROUP_FILES_DIR, groupFile));
    console.log(`  Found ${migrations.length} migrations\n`);
    
    migrations.forEach(m => {
      total++;
      if (!config.dryRun) {
        fs.writeFileSync(path.join(config.outputDir, m.filename), m.content + '\n');
        console.log(`  ✓ ${m.filename}`);
      } else {
        console.log(`  Would export: ${m.filename} (${m.content.length} bytes)`);
      }
    });
    console.log('');
  });

  console.log('='.repeat(80));
  console.log(`Complete! ${total} migrations ${config.dryRun ? 'would be' : ''} exported`);
  if (!config.dryRun) console.log(`Files saved to: ${config.outputDir}`);
}

if (require.main === module) {
  try {
    exportMigrations(parseArgs());
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}
