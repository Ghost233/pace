const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;
const COMMAND_TIMEOUTS_MS = {
  git: 10_000,
  gh: 20_000,
  multica: 15_000,
  curl: 20_000,
  node: 10_000,
};

function shellQuote(value) {
  const text = String(value ?? '');
  if (!text) return '""';
  if (/^[A-Za-z0-9._/@:=+-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, `'\"'\"'`)}'`;
}

function formatCommand(command, args = []) {
  return [command, ...args].map(shellQuote).join(' ');
}

function defaultTimeoutMs(command) {
  return COMMAND_TIMEOUTS_MS[command] || DEFAULT_TIMEOUT_MS;
}

function normalizeOutput(output) {
  if (output == null) return '';
  if (Buffer.isBuffer(output)) return output.toString('utf8').trimEnd();
  return String(output).trimEnd();
}

function extractOutput(error, key) {
  const value = error?.[key];
  if (value == null) return '';
  return normalizeOutput(value);
}

function buildExecError(command, args, error, timeoutMs) {
  const display = formatCommand(command, args);
  const stderr = extractOutput(error, 'stderr');
  const stdout = extractOutput(error, 'stdout');
  let summary = `命令执行失败: ${display}`;

  if (error?.code === 'ETIMEDOUT') {
    summary = `命令执行超时 (${timeoutMs}ms): ${display}`;
  } else if (error?.code === 'ENOENT') {
    summary = `命令不存在: ${command}`;
  } else if (typeof error?.status === 'number') {
    summary = `命令执行失败 (exit ${error.status}): ${display}`;
  }

  const details = [];
  if (stderr) details.push(`stderr:\n${stderr}`);
  if (stdout && !stderr) details.push(`stdout:\n${stdout}`);
  if (!stderr && !stdout && error?.message) details.push(error.message);

  const wrapped = new Error([summary, ...details].join('\n\n'));
  wrapped.cause = error;
  wrapped.command = command;
  wrapped.args = [...args];
  wrapped.display = display;
  wrapped.code = error?.code;
  wrapped.signal = error?.signal;
  wrapped.status = error?.status;
  wrapped.stdout = stdout;
  wrapped.stderr = stderr;
  return wrapped;
}

function run(command, args = [], options = {}) {
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs(command);
  const execOptions = {
    cwd: options.cwd || process.cwd(),
    encoding: options.encoding ?? 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    timeout: timeoutMs,
    maxBuffer: options.maxBuffer ?? DEFAULT_MAX_BUFFER,
  };

  if (Object.prototype.hasOwnProperty.call(options, 'input')) {
    execOptions.input = options.input;
  }

  try {
    return normalizeOutput(execFileSync(command, args, execOptions));
  } catch (error) {
    throw buildExecError(command, args, error, timeoutMs);
  }
}

function probe(command, args = [], options = {}) {
  try {
    return run(command, args, options);
  } catch (error) {
    if (typeof options.onError === 'function') {
      return options.onError(error);
    }
    return options.fallback ?? '';
  }
}

function runJson(command, args = [], options = {}) {
  const output = run(command, args, options);
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`JSON 解析失败: ${formatCommand(command, args)}\n\n${output}`);
  }
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findExecutable(command, envPath = process.env.PATH || '') {
  if (!command) return '';
  if (command.includes(path.sep)) {
    return isExecutable(command) ? command : '';
  }
  for (const dir of envPath.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, command);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }
  return '';
}

function ensureBinary(command, options = {}) {
  const found = findExecutable(command, options.envPath);
  if (!found) {
    throw new Error(options.message || `${command} 未安装，不能执行相关操作`);
  }
  return found;
}

module.exports = {
  ensureBinary,
  findExecutable,
  formatCommand,
  probe,
  run,
  runJson,
};
