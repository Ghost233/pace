#!/usr/bin/env bash

set -euo pipefail

CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PACE_HOME="$CODEX_HOME/skills/pace"
PACE_INSTALL_REF="${PACE_INSTALL_REF:-main}"
PACE_INSTALL_REF_TYPE="${PACE_INSTALL_REF_TYPE:-heads}"
ARCHIVE_URL="${PACE_INSTALL_ARCHIVE_URL:-https://github.com/Ghost233/pace/archive/refs/${PACE_INSTALL_REF_TYPE}/${PACE_INSTALL_REF}.tar.gz}"
BACKUP_ROOT="${PACE_INSTALL_BACKUP_ROOT:-$CODEX_HOME/backups/pace}"
SOURCE_DIR="${PACE_INSTALL_SOURCE_DIR:-}"
TMP_DIR=""
BACKUP_DIR=""

cleanup() {
  if [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
  fi
}

trap cleanup EXIT

copy_managed_entry() {
  local src="$1"
  local dest_root="$2"
  local base
  base="$(basename "$src")"
  rm -rf "$dest_root/$base"
  rsync -a "$src" "$dest_root/"
}

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
PACE_ROLES_SRC="$SOURCE_ROOT/roles"

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

if [[ ! -d "$PACE_ROLES_SRC" ]]; then
  echo "未找到 roles 目录: $PACE_ROLES_SRC" >&2
  exit 1
fi

if [[ -d "$PACE_HOME" ]]; then
  mkdir -p "$BACKUP_ROOT"
  BACKUP_DIR="$BACKUP_ROOT/$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$BACKUP_DIR"
  rsync -a "$PACE_HOME/" "$BACKUP_DIR/"
fi

mkdir -p "$PACE_HOME"

for entry in "$SKILLS_SRC"/*; do
  [[ -e "$entry" ]] || continue
  copy_managed_entry "$entry" "$PACE_HOME"
done

rm -rf "$PACE_HOME/.pace" "$PACE_HOME/bin" "$PACE_HOME/roles"
mkdir -p "$PACE_HOME/.pace" "$PACE_HOME/bin" "$PACE_HOME/roles"
rsync -a "$PACE_CONFIG_SRC/" "$PACE_HOME/.pace/"
rsync -a "$PACE_BIN_SRC/" "$PACE_HOME/bin/"
rsync -a "$PACE_ROLES_SRC/" "$PACE_HOME/roles/"
chmod +x \
  "$PACE_HOME/bin/pace-merge.js" \
  "$PACE_HOME/bin/pace-init.js" \
  "$PACE_HOME/bin/pace-git.js" \
  "$PACE_HOME/bin/pace-gh.js" \
  "$PACE_HOME/bin/pace-issue-doc.js" \
  "$PACE_HOME/bin/pace-multica.js"

cat <<EOF
PACE 已安装到:

- Skills: $PACE_HOME
- Scripts: $PACE_HOME/bin/pace-merge.js, $PACE_HOME/bin/pace-init.js, $PACE_HOME/bin/pace-git.js, $PACE_HOME/bin/pace-gh.js, $PACE_HOME/bin/pace-issue-doc.js, $PACE_HOME/bin/pace-multica.js
- 安装源: ${SOURCE_DIR:-$ARCHIVE_URL}
- 安装版本: refs/${PACE_INSTALL_REF_TYPE}/${PACE_INSTALL_REF}
- 备份目录: ${BACKUP_DIR:-未创建（首次安装）}

说明:

- 当前安装只替换 PACE 管理的路径：skills、bin、.pace、roles
- 如果旧目录中有自定义内容，安装前备份已保存在上面的备份目录中
- 如需固定版本，可在执行前设置:
  - PACE_INSTALL_REF_TYPE=tags
  - PACE_INSTALL_REF=<tag>
  - 或直接设置 PACE_INSTALL_ARCHIVE_URL=<tarball-url>

之后可直接在任意项目根目录运行:

  node "$PACE_HOME/bin/pace-init.js" local
  node "$PACE_HOME/bin/pace-init.js" multica --repo <owner/repo> --branch <branch> --github-user <username> --git-name "<git name>" --git-email "<git email>" --issue-url "<issue url>" --issue-title "<issue title>" --issue-type <bug|feature|task> --current-role "PACE-需求接管经理"
  node "$PACE_HOME/bin/pace-git.js" status
  node "$PACE_HOME/bin/pace-gh.js" issue-read --issue 72
  node "$PACE_HOME/bin/pace-multica.js" issue-get --issue <multica-issue-id>
  node "$PACE_HOME/bin/pace-issue-doc.js" check-body --body-file /tmp/doc.md

仅在需要排查模板合并结果时，再运行:

  node "$PACE_HOME/bin/pace-merge.js" local
  node "$PACE_HOME/bin/pace-merge.js" multica
EOF
