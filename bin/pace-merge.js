#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function deepMerge(base, override) {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const baseVal = result[key];
    const overrideVal = override[key];
    if (
      baseVal && overrideVal &&
      typeof baseVal === 'object' && typeof overrideVal === 'object' &&
      !Array.isArray(baseVal) && !Array.isArray(overrideVal)
    ) {
      result[key] = deepMerge(baseVal, overrideVal);
    } else {
      result[key] = overrideVal;
    }
  }
  return result;
}

function main() {
  const env = process.argv[2];
  if (!env) {
    console.error('用法: pace-merge <local|multica>');
    process.exit(1);
  }

  const paceDir = path.resolve(process.cwd(), '.pace');
  const baseFile = path.join(paceDir, 'config.yaml');
  const envFile = path.join(paceDir, `config.${env}.yaml`);
  const outputFile = path.resolve(process.cwd(), '.pace-config.yaml');

  if (!fs.existsSync(baseFile)) {
    console.error(`基础配置文件不存在: ${baseFile}`);
    process.exit(1);
  }

  if (!fs.existsSync(envFile)) {
    console.error(`环境配置文件不存在: ${envFile}`);
    process.exit(1);
  }

  const base = yaml.load(fs.readFileSync(baseFile, 'utf8'));
  const override = yaml.load(fs.readFileSync(envFile, 'utf8'));
  const merged = deepMerge(base, override);

  const output = yaml.dump(merged, { lineWidth: -1, noRefs: true });
  fs.writeFileSync(outputFile, output, 'utf8');

  console.log(`配置已合并: ${baseFile} + ${envFile} → ${outputFile}`);
}

main();
