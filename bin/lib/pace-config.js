const fs = require('fs');
const path = require('path');

function stripComment(line) {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (ch === '#' && !inSingle && !inDouble) {
      return line.slice(0, i).trimEnd();
    }
  }

  return line.trimEnd();
}

function parseScalar(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

function parseYaml(text) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  const lines = text.split(/\r?\n/);

  for (const originalLine of lines) {
    const withoutComment = stripComment(originalLine);
    if (!withoutComment.trim()) continue;

    const indent = withoutComment.match(/^ */)[0].length;
    const line = withoutComment.trim();
    const match = line.match(/^([^:]+):(.*)$/);
    if (!match) continue;

    const key = match[1].trim();
    const rawValue = match[2].trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].value;

    if (!rawValue) {
      parent[key] = {};
      stack.push({ indent, value: parent[key] });
    } else {
      parent[key] = parseScalar(rawValue);
    }
  }

  return root;
}

function formatScalar(value) {
  if (typeof value === 'string') {
    if (value === '') return '""';
    if (/^[A-Za-z0-9._/@:-]+$/.test(value)) return value;
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  if (value === null) return 'null';
  return JSON.stringify(value);
}

function dumpYaml(value, indent = 0) {
  const lines = [];
  const prefix = ' '.repeat(indent);

  for (const [key, item] of Object.entries(value)) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      lines.push(`${prefix}${key}:`);
      lines.push(dumpYaml(item, indent + 2));
    } else {
      lines.push(`${prefix}${key}: ${formatScalar(item)}`);
    }
  }

  return lines.filter(Boolean).join('\n');
}

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

function resolveTemplateFiles(cwd, env, scriptFilename) {
  const paceDir = path.resolve(cwd, '.pace');
  const bundledPaceDir = path.resolve(path.dirname(fs.realpathSync(scriptFilename)), '..', '.pace');
  const localBaseFile = path.join(paceDir, 'config.yaml');
  const localEnvFile = path.join(paceDir, `config.${env}.yaml`);
  const bundledBaseFile = path.join(bundledPaceDir, 'config.yaml');
  const bundledEnvFile = path.join(bundledPaceDir, `config.${env}.yaml`);

  return {
    paceDir,
    baseFile: fs.existsSync(localBaseFile) ? localBaseFile : bundledBaseFile,
    envFile: fs.existsSync(localEnvFile) ? localEnvFile : bundledEnvFile,
  };
}

function loadMergedConfig(cwd, env, scriptFilename) {
  const { paceDir, baseFile, envFile } = resolveTemplateFiles(cwd, env, scriptFilename);
  if (!fs.existsSync(baseFile)) {
    throw new Error(`基础配置文件不存在: ${baseFile}`);
  }
  if (!fs.existsSync(envFile)) {
    throw new Error(`环境配置文件不存在: ${envFile}`);
  }

  const base = parseYaml(fs.readFileSync(baseFile, 'utf8'));
  const override = parseYaml(fs.readFileSync(envFile, 'utf8'));
  return {
    paceDir,
    baseFile,
    envFile,
    merged: deepMerge(base, override),
  };
}

function loadSession(cwd) {
  const sessionPath = path.resolve(cwd, '.pace', 'session.yaml');
  if (!fs.existsSync(sessionPath)) {
    return {
      sessionPath,
      exists: false,
      data: null,
    };
  }

  return {
    sessionPath,
    exists: true,
    data: parseYaml(fs.readFileSync(sessionPath, 'utf8')),
  };
}

module.exports = {
  dumpYaml,
  deepMerge,
  loadMergedConfig,
  loadSession,
  parseYaml,
};
