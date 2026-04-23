#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { dumpYaml, loadMergedConfig } = require('./lib/pace-config');

function usage(exitCode = 0) {
  console.error(
    [
      '用法: node <pace-bin>/pace-merge.js <local|multica>',
      '',
      '作用:',
      '  把 `.pace/config.yaml` 和对应环境配置合并后输出到 `.pace-config.yaml`。',
      '',
      '说明:',
      '  - 当前主路径推荐使用 `local`',
      '  - `multica` 仅用于排查旧兼容配置',
    ].join('\n')
  );
  process.exit(exitCode);
}

function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage(0);
  }
  const env = process.argv[2];
  if (!env) {
    usage(1);
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
