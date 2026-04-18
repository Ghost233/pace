#!/usr/bin/env bash

set -euo pipefail

CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PACE_HOME="$CODEX_HOME/skills/pace"
ARCHIVE_URL="${PACE_INSTALL_ARCHIVE_URL:-https://github.com/Ghost233/pace/archive/refs/heads/main.tar.gz}"
SOURCE_DIR="${PACE_INSTALL_SOURCE_DIR:-}"
TMP_DIR=""

cleanup() {
  if [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
  fi
}

trap cleanup EXIT

load_source() {
  if [[ -n "$SOURCE_DIR" ]]; then
    cd "$SOURCE_DIR" && pwd
    return
  fi

  TMP_DIR="$(mktemp -d)"
  curl -fsSL "$ARCHIVE_URL" -o "$TMP_DIR/pace.tar.gz"
  tar -xzf "$TMP_DIR/pace.tar.gz" -C "$TMP_DIR"

  local extracted_root
  extracted_root="$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [[ -z "$extracted_root" ]]; then
    echo "未找到解压后的 pace 源码目录" >&2
    exit 1
  fi

  cd "$extracted_root" && pwd
}

SOURCE_ROOT="$(load_source)"

SKILLS_SRC="$SOURCE_ROOT/.claude-plugin/skills"
PACE_CONFIG_SRC="$SOURCE_ROOT/.pace"
PACE_BIN_SRC="$SOURCE_ROOT/bin"

if [[ ! -d "$SKILLS_SRC" ]]; then
  echo "未找到技能目录: $SKILLS_SRC" >&2
  exit 1
fi

if [[ ! -d "$PACE_CONFIG_SRC" ]]; then
  echo "未找到 pace 配置模板目录: $PACE_CONFIG_SRC" >&2
  exit 1
fi

if [[ ! -d "$PACE_BIN_SRC" ]]; then
  echo "未找到 bin 目录: $PACE_BIN_SRC" >&2
  exit 1
fi

mkdir -p "$PACE_HOME"

rsync -a --delete "$SKILLS_SRC/" "$PACE_HOME/"
mkdir -p "$PACE_HOME/bin" "$PACE_HOME/.pace"
rsync -a --delete "$PACE_CONFIG_SRC/" "$PACE_HOME/.pace/"
rsync -a --delete "$PACE_BIN_SRC/" "$PACE_HOME/bin/"
chmod +x \
  "$PACE_HOME/bin/pace-merge.js" \
  "$PACE_HOME/bin/pace-init.js" \
  "$PACE_HOME/bin/pace-git.js" \
  "$PACE_HOME/bin/pace-gh.js"

cat <<EOF
PACE 已安装到:

- Skills: $PACE_HOME
- Scripts: $PACE_HOME/bin/pace-merge.js, $PACE_HOME/bin/pace-init.js, $PACE_HOME/bin/pace-git.js, $PACE_HOME/bin/pace-gh.js

之后可直接在任意项目根目录运行:

  node "$PACE_HOME/bin/pace-merge.js" local
  node "$PACE_HOME/bin/pace-merge.js" multica
  node "$PACE_HOME/bin/pace-init.js" local
  node "$PACE_HOME/bin/pace-init.js" multica --repo <owner/repo> --github-user <username>
  node "$PACE_HOME/bin/pace-git.js" status
  node "$PACE_HOME/bin/pace-gh.js" issue-read --issue 72
EOF
