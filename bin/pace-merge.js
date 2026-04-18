#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { dumpYaml, loadMergedConfig } = require('./lib/pace-config');

function main() {
  const env = process.argv[2];
  if (!env) {
    console.error('用法: pace-merge <local|multica>');
    process.exit(1);
  }

  let loaded;
  try {
    loaded = loadMergedConfig(process.cwd(), env, __filename);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const { baseFile, envFile, merged } = loaded;
  const outputFile = path.resolve(process.cwd(), '.pace-config.yaml');

  const output = `${dumpYaml(merged)}\n`;
  fs.writeFileSync(outputFile, output, 'utf8');

  console.log(`配置已合并: ${baseFile} + ${envFile} → ${outputFile}`);
}

main();
