#!/usr/bin/env bash
# Remote installer for the sepia skill + always-on instructions — fetches
# SKILL.md, references, and the per-editor always-on files from the sepia
# server and installs into every editor dir it can find.
# Idempotent: re-running overwrites in place, never duplicates.
#
# Usage:  curl -fsSL https://sepia.fly.dev/install | bash
#         SEPIA_BASE=https://sepia.fly.dev bash <(curl -fsSL .../install)
set -euo pipefail

BASE="${SEPIA_BASE:-https://sepia.fly.dev}"

install_to() {
  local dir="$1"
  mkdir -p "$dir/references"
  curl -fsSL "$BASE/skill" -o "$dir/SKILL.md"
  curl -fsSL "$BASE/skill/references/tools.md" -o "$dir/references/tools.md"
  echo "installed → $dir"
}

# Append a section to a file idempotently (marker-based, never duplicates).
append_section() {
  local file="$1" url="$2" marker="$3"
  if [ -f "$file" ] && grep -qF "$marker" "$file"; then
    echo "already present → $file"
    return
  fi
  mkdir -p "$(dirname "$file")"
  { [ -f "$file" ] && printf '\n'; curl -fsSL "$url"; } >> "$file"
  echo "appended → $file"
}

# ── Channel 1: the Agent Skill (on-demand) ────────────────────────────────
[ -d "$HOME/.agents/skills" ] && install_to "$HOME/.agents/skills/sepia"
[ -d "$HOME/.cursor/skills" ] && install_to "$HOME/.cursor/skills/sepia"
[ -d "$HOME/.claude/skills" ] && install_to "$HOME/.claude/skills/sepia"
[ -d "$HOME/.codex/skills" ] && install_to "$HOME/.codex/skills/sepia"
[ -d "$HOME/.opencode/skills" ] && install_to "$HOME/.opencode/skills/sepia"

# ── Channel 2: always-on instructions (every session, no invocation) ───────
# VS Code Copilot — user-level prompts folder (*.instructions.md with
# applyTo '**/*' is auto-attached to every chat request).
VSCODE_PROMPTS="${VSCODE_USER_PROMPTS_FOLDER:-$HOME/.config/Code/User/prompts}"
if [ -d "$VSCODE_PROMPTS" ]; then
  curl -fsSL "$BASE/instructions/vscode" -o "$VSCODE_PROMPTS/sepia.instructions.md"
  echo "installed → $VSCODE_PROMPTS/sepia.instructions.md"
fi

# Cursor — user rules (alwaysApply: true → every session, unconditionally).
if [ -d "$HOME/.cursor" ]; then
  mkdir -p "$HOME/.cursor/rules"
  curl -fsSL "$BASE/instructions/cursor" -o "$HOME/.cursor/rules/sepia.mdc"
  echo "installed → $HOME/.cursor/rules/sepia.mdc"
fi

# Claude Code — user-global CLAUDE.md (loaded at the start of every session).
if [ -d "$HOME/.claude" ]; then
  append_section "$HOME/.claude/CLAUDE.md" "$BASE/instructions/claude" "## Sepia memory (always-on)"
fi

# AGENTS.md (Codex, Cursor, Copilot, any agentsmd-compliant agent) — install
# into the current repo's AGENTS.md if one exists, else print the snippet.
if [ -f "AGENTS.md" ]; then
  append_section "AGENTS.md" "$BASE/instructions/agents" "## Sepia memory (always-on)"
else
  echo "note: no AGENTS.md in $(pwd) — append the /instructions/agents snippet manually for repo-level agents"
fi

echo "Done. Restart your editor to pick up the skill + always-on instructions."
