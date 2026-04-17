#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob

# PACE - Plan, Act, Check, Evolve
# Claude Code & Codex CLI Skills 安装脚本

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="$SCRIPT_DIR/skills"

usage() {
    echo "PACE Skills 安装工具"
    echo ""
    echo "用法: ./install.sh [选项]"
    echo ""
    echo "选项:"
    echo "  --local      安装到当前项目的 .claude/skills/ (Claude Code)"
    echo "  --global     安装到 ~/.claude/skills/ (Claude Code 全局)"
    echo "  --codex      安装到当前项目的 .agents/skills/ (Codex CLI)"
    echo "  --target <path>  安装到指定目录"
    echo "  --uninstall   卸载 PACE skills"
    echo "  --help       显示此帮助"
    echo ""
    echo "示例:"
    echo "  ./install.sh                # 安装到当前项目 (Claude Code)"
    echo "  ./install.sh --global       # 全局安装 (Claude Code)"
    echo "  ./install.sh --codex        # 安装到当前项目 (Codex CLI)"
    echo "  ./install.sh --uninstall    # 卸载"
}

uninstall() {
    local dir="$1"
    echo "从 $dir 卸载 PACE skills..."
    local count=0
    for skill_dir in "$dir"/*/; do
        if [ -d "$skill_dir" ]; then
            local name
            name="$(basename "$skill_dir")"
            if [ -f "$skill_dir/SKILL.md" ]; then
                rm -rf "$skill_dir"
                echo "  已移除: $name"
                count=$((count + 1))
            fi
        fi
    done
    if [ "$count" -eq 0 ]; then
        echo "  未找到已安装的 PACE skills"
    else
        echo "  共移除 $count 个 skills"
    fi
}

install() {
    local dir="$1"

    mkdir -p "$dir"

    local count=0
    for skill_dir in "$SKILLS_DIR"/*/; do
        if [ -d "$skill_dir" ]; then
            local name
            name="$(basename "$skill_dir")"
            cp -r "$skill_dir" "$dir/$name"
            echo "  已安装: $name"
            count=$((count + 1))
        fi
    done

    echo ""
    echo "安装完成! 共 $count 个 skills → $dir"
    echo ""
    echo "使用方式:"
    echo "  在 Claude Code 中输入 /pace:config 初始化配置"
    echo "  然后输入 /pace:bootstrap 开始项目"
}

case "${1:-}" in
    --local)
        install "$(pwd)/.claude/skills"
        ;;
    --global)
        install "$HOME/.claude/skills"
        ;;
    --codex)
        install "$(pwd)/.agents/skills"
        ;;
    --target)
        if [ -z "${2:-}" ]; then
            echo "错误: --target 需要指定路径"
            exit 1
        fi
        install "$2"
        ;;
    --uninstall)
        uninstall "$(pwd)/.claude/skills"
        uninstall "$HOME/.claude/skills"
        uninstall "$(pwd)/.agents/skills"
        ;;
    --help|-h|"")
        usage
        ;;
    *)
        echo "未知选项: $1"
        usage
        exit 1
        ;;
esac
