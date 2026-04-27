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
MANIFEST_PATH=""
NEW_MANIFEST_PATH=""
ACTIVE_MANIFEST_PATH=""
LEGACY_MANIFEST_PATH=""
LEGACY_REMOVED_PATHS=(
  ".pace/config.multica.yaml"
  "bin/pace-gh.js"
  "bin/pace-issue-doc.js"
  "bin/pace-multica.js"
  "roles/templates/closeout-archive-comment.template.md"
  "roles/templates/closeout-verify-comment.template.md"
  "roles/templates/delivery-final-comment.template.md"
  "roles/templates/dispatch-final-comment.template.md"
  "roles/templates/github-config-check.template.md"
  "roles/templates/github-init-params-request.template.md"
  "roles/templates/github-issue-comment.template.md"
  "roles/templates/init-final-comment.template.md"
  "roles/templates/issue-intake-final-comment.template.md"
  "roles/templates/phase-final-comment.template.md"
  "roles/templates/stage-log-sync-comment.template.md"
  "roles/templates/tracking-block.template.md"
  "roles/交付经理.md"
  "roles/初始化经理.md"
  "roles/调度经理.md"
  "roles/阶段经理.md"
  "roles/需求接管经理.md"
  "roles/验收归档经理.md"
)

cleanup() {
  if [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
  fi
}

trap cleanup EXIT

ensure_tmp_dir() {
  if [[ -z "$TMP_DIR" || ! -d "$TMP_DIR" ]]; then
    TMP_DIR="$(mktemp -d)"
  fi
}

prepare_manifest() {
  ensure_tmp_dir
  NEW_MANIFEST_PATH="$TMP_DIR/pace-install-manifest.new"
  : > "$NEW_MANIFEST_PATH"
}

normalize_rel_path() {
  local rel="$1"
  rel="${rel#./}"
  rel="${rel#/}"
  printf '%s\n' "$rel"
}

record_managed_path() {
  local rel
  rel="$(normalize_rel_path "$1")"
  local manifest_file="${2:-$NEW_MANIFEST_PATH}"
  [[ -n "$rel" ]] || return
  printf '%s\n' "$rel" >> "$manifest_file"
}

collect_managed_tree() {
  local src="$1"
  local dest_rel
  local manifest_file="${3:-$NEW_MANIFEST_PATH}"
  dest_rel="$(normalize_rel_path "$2")"

  if [[ -L "$src" ]]; then
    if [[ -n "$dest_rel" ]]; then
      record_managed_path "$dest_rel" "$manifest_file"
    fi
    return
  fi

  if [[ -d "$src" ]]; then
    [[ -n "$dest_rel" ]] && record_managed_path "$dest_rel" "$manifest_file"
    while IFS= read -r entry; do
      [[ -n "$entry" ]] || continue
      local suffix="${entry#$src/}"
      if [[ -n "$dest_rel" ]]; then
        record_managed_path "$dest_rel/$suffix" "$manifest_file"
      else
        record_managed_path "$suffix" "$manifest_file"
      fi
    done < <(find "$src" -mindepth 1 \( -type d -o -type f -o -type l \) | LC_ALL=C sort)
    return
  fi

  if [[ -e "$src" && -n "$dest_rel" ]]; then
    record_managed_path "$dest_rel" "$manifest_file"
  fi
}

finalize_manifest() {
  local manifest_file="${1:-$NEW_MANIFEST_PATH}"
  LC_ALL=C sort -u "$manifest_file" -o "$manifest_file"
}

append_legacy_removed_paths() {
  local manifest_file="$1"
  local rel
  for rel in "${LEGACY_REMOVED_PATHS[@]}"; do
    record_managed_path "$rel" "$manifest_file"
  done
}

prepare_existing_manifest() {
  if [[ -f "$MANIFEST_PATH" ]]; then
    ACTIVE_MANIFEST_PATH="$MANIFEST_PATH"
    return 0
  fi

  ensure_tmp_dir
  LEGACY_MANIFEST_PATH="$TMP_DIR/pace-install-manifest.legacy"
  cp "$NEW_MANIFEST_PATH" "$LEGACY_MANIFEST_PATH"
  append_legacy_removed_paths "$LEGACY_MANIFEST_PATH"
  finalize_manifest "$LEGACY_MANIFEST_PATH"
  ACTIVE_MANIFEST_PATH="$LEGACY_MANIFEST_PATH"
}

manifest_has_path() {
  local rel
  rel="$(normalize_rel_path "$1")"
  [[ -f "$ACTIVE_MANIFEST_PATH" ]] || return 1
  grep -Fqx -- "$rel" "$ACTIVE_MANIFEST_PATH"
}

manifest_has_descendant() {
  local rel
  rel="$(normalize_rel_path "$1")"
  [[ -f "$ACTIVE_MANIFEST_PATH" ]] || return 1
  grep -Fq -- "$rel/" "$ACTIVE_MANIFEST_PATH"
}

cleanup_removed_managed_paths() {
  [[ -f "$ACTIVE_MANIFEST_PATH" ]] || return 0

  while IFS= read -r rel; do
    [[ -n "$rel" ]] || continue
    if grep -Fqx -- "$rel" "$NEW_MANIFEST_PATH"; then
      continue
    fi

    local target="$PACE_HOME/$rel"
    if [[ -L "$target" || -f "$target" ]]; then
      rm -f "$target"
      continue
    fi
    if [[ -d "$target" ]]; then
      rmdir "$target" 2>/dev/null || true
    fi
  done < <(awk 'NF { print length($0) "\t" $0 }' "$ACTIVE_MANIFEST_PATH" | LC_ALL=C sort -rn | cut -f2-)
}

ensure_safe_file_destination() {
  local dest="$1"
  local dest_rel
  dest_rel="$(normalize_rel_path "${dest#"$PACE_HOME"/}")"

  if [[ -L "$dest" ]]; then
    rm -f "$dest"
    return 0
  fi
  if [[ ! -d "$dest" ]]; then
    return 0
  fi

  if ! manifest_has_path "$dest_rel"; then
    echo "安装失败：目标路径已是未托管目录，不能直接替换为文件: $dest_rel" >&2
    exit 1
  fi

  while IFS= read -r entry; do
    [[ -n "$entry" ]] || continue
    local suffix="${entry#$dest/}"
    if ! manifest_has_path "$dest_rel/$suffix"; then
      echo "安装失败：目录转文件会覆盖未托管内容，请先迁移或删除: $dest_rel/$suffix" >&2
      exit 1
    fi
  done < <(find "$dest" -mindepth 1 \( -type d -o -type f -o -type l \) | LC_ALL=C sort)

  rm -rf "$dest"
}

ensure_safe_directory_destination() {
  local dest="$1"
  local dest_rel
  dest_rel="$(normalize_rel_path "${dest#"$PACE_HOME"/}")"

  if [[ -L "$dest" ]]; then
    rm -f "$dest"
    return 0
  fi
  if [[ ! -e "$dest" || -d "$dest" ]]; then
    return 0
  fi

  if ! manifest_has_path "$dest_rel"; then
    echo "安装失败：目标路径已是未托管文件，不能直接替换为目录: $dest_rel" >&2
    exit 1
  fi
  if manifest_has_descendant "$dest_rel"; then
    echo "安装失败：文件转目录会覆盖现有文件，请先迁移或删除: $dest_rel" >&2
    exit 1
  fi

  rm -f "$dest"
}

sync_managed_entry() {
  local src="$1"
  local dest="$2"

  mkdir -p "$(dirname "$dest")"

  if [[ -d "$src" ]]; then
    ensure_safe_directory_destination "$dest"
    mkdir -p "$dest"
    rsync -a "$src/" "$dest/"
    return
  fi

  ensure_safe_file_destination "$dest"
  cp -a "$src" "$dest"
}

write_manifest() {
  if [[ -L "$MANIFEST_PATH" ]]; then
    echo "安装失败：manifest 路径不能是符号链接: $MANIFEST_PATH" >&2
    exit 1
  fi
  cp "$NEW_MANIFEST_PATH" "$MANIFEST_PATH"
}

chmod_if_present() {
  local target="$1"
  if [[ -e "$target" ]]; then
    chmod +x "$target"
  fi
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
MANIFEST_PATH="$PACE_HOME/.pace-install-manifest.txt"
ACTIVE_BIN_PATHS=(
  "pace-merge.js"
  "pace-init.js"
  "pace-workflow.js"
  "pace-git.js"
  "lib"
)

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
prepare_manifest

for entry in "$SKILLS_SRC"/*; do
  [[ -e "$entry" ]] || continue
  collect_managed_tree "$entry" "$(basename "$entry")"
done

collect_managed_tree "$PACE_CONFIG_SRC" ".pace"
for bin_path in "${ACTIVE_BIN_PATHS[@]}"; do
  if [[ -e "$PACE_BIN_SRC/$bin_path" ]]; then
    collect_managed_tree "$PACE_BIN_SRC/$bin_path" "bin/$bin_path"
  fi
done
collect_managed_tree "$PACE_ROLES_SRC" "roles"
finalize_manifest
prepare_existing_manifest
cleanup_removed_managed_paths

for entry in "$SKILLS_SRC"/*; do
  [[ -e "$entry" ]] || continue
  sync_managed_entry "$entry" "$PACE_HOME/$(basename "$entry")"
done

sync_managed_entry "$PACE_CONFIG_SRC" "$PACE_HOME/.pace"
ensure_safe_directory_destination "$PACE_HOME/bin"
mkdir -p "$PACE_HOME/bin"
for bin_path in "${ACTIVE_BIN_PATHS[@]}"; do
  if [[ -e "$PACE_BIN_SRC/$bin_path" ]]; then
    sync_managed_entry "$PACE_BIN_SRC/$bin_path" "$PACE_HOME/bin/$bin_path"
  fi
done
sync_managed_entry "$PACE_ROLES_SRC" "$PACE_HOME/roles"
write_manifest
chmod_if_present "$PACE_HOME/bin/pace-merge.js"
chmod_if_present "$PACE_HOME/bin/pace-init.js"
chmod_if_present "$PACE_HOME/bin/pace-workflow.js"
chmod_if_present "$PACE_HOME/bin/pace-git.js"

cat <<EOF
PACE 已安装到:

- Skills: $PACE_HOME
- Scripts: $PACE_HOME/bin/pace-merge.js, $PACE_HOME/bin/pace-init.js, $PACE_HOME/bin/pace-workflow.js, $PACE_HOME/bin/pace-git.js
- 安装源: ${SOURCE_DIR:-$ARCHIVE_URL}
- 安装版本: refs/${PACE_INSTALL_REF_TYPE}/${PACE_INSTALL_REF}
- 备份目录: ${BACKUP_DIR:-未创建（首次安装）}

说明:

- 当前安装会按 manifest 维护 PACE 托管条目，只删除“上一次安装由 PACE 创建、这一次源码里已不存在”的路径
- 未被 manifest 记录的未知自定义内容会保留；同名路径若会触发目录/文件类型冲突，安装会直接失败
- 首次升级到 manifest 模式时，会基于当前托管清单和已知历史托管路径清理旧残留，不会把整棵旧目录都当成托管内容
- 如果托管路径发生目录/文件类型冲突且会覆盖未托管内容，安装会直接失败，而不是静默删除
- 安装前备份已保存在上面的备份目录中
- 如需固定版本，可在执行前设置:
  - PACE_INSTALL_REF_TYPE=tags
  - PACE_INSTALL_REF=<tag>
  - 或直接设置 PACE_INSTALL_ARCHIVE_URL=<tarball-url>

之后可直接在任意项目根目录运行:

  node "$PACE_HOME/bin/pace-init.js" local
  node "$PACE_HOME/bin/pace-workflow.js" route --json
  node "$PACE_HOME/bin/pace-git.js" status

仅在需要排查模板合并结果时，再运行:

  node "$PACE_HOME/bin/pace-merge.js" local
EOF
