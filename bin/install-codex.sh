#!/usr/bin/env bash

set -euo pipefail

CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PACE_HOME="$CODEX_HOME/skills/pace"
BIN_DIR="$CODEX_HOME/bin"
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
PACE_MERGE_SRC="$SOURCE_ROOT/bin/pace-merge.js"

if [[ ! -d "$SKILLS_SRC" ]]; then
  echo "未找到技能目录: $SKILLS_SRC" >&2
  exit 1
fi

if [[ ! -d "$PACE_CONFIG_SRC" ]]; then
  echo "未找到 pace 配置模板目录: $PACE_CONFIG_SRC" >&2
  exit 1
fi

if [[ ! -f "$PACE_MERGE_SRC" ]]; then
  echo "未找到 pace-merge.js: $PACE_MERGE_SRC" >&2
  exit 1
fi

mkdir -p "$PACE_HOME" "$BIN_DIR"

rsync -a --delete "$SKILLS_SRC/" "$PACE_HOME/"
mkdir -p "$PACE_HOME/bin" "$PACE_HOME/.pace"
rsync -a --delete "$PACE_CONFIG_SRC/" "$PACE_HOME/.pace/"
install -m 755 "$PACE_MERGE_SRC" "$PACE_HOME/bin/pace-merge.js"

cat > "$BIN_DIR/pace-merge" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec node "$PACE_HOME/bin/pace-merge.js" "\$@"
EOF
chmod +x "$BIN_DIR/pace-merge"

cat <<EOF
PACE 已安装到:

- Skills: $PACE_HOME
- Helper: $BIN_DIR/pace-merge

建议把以下目录加入 PATH:

  export PATH="$BIN_DIR:\$PATH"

之后可直接在任意项目根目录运行:

  pace-merge local
  pace-merge multica
EOF
