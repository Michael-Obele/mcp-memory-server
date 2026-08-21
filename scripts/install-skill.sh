#!/usr/bin/env bash
# Installs the sepia skill + always-on instruction files into every editor
# dir it can find.
#
# Two channels:
#   1. The Agent Skill (SKILL.md) — on-demand: the editor lists it, the model
#      loads it when relevant.
#   2. Always-on instructions (always-on/) — injected into EVERY session by
#      the editor's own instruction system (VS Code prompts, Cursor rules,
#      Claude Code CLAUDE.md). Skills alone don't cut it: every platform
#      loads skill bodies only on demand.
#
# Idempotent: re-running overwrites in place, never duplicates.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/../skills/sepia" && pwd)"

if [ ! -f "$SRC/SKILL.md" ]; then
  echo "error: $SRC/SKILL.md not found" >&2
  exit 1
fi

install_to() {
  mkdir -p "$1"
  cp -R "$SRC/." "$1/"
  echo "installed → $1"
}

# Append a section to a file idempotently (marker-based, never duplicates).
append_section() {
  local file="$1" section="$2" marker="$3"
  if [ -f "$file" ] && grep -qF "$marker" "$file"; then
    echo "already present → $file"
    return
  fi
  mkdir -p "$(dirname "$file")"
  { [ -f "$file" ] && printf '\n'; cat "$section"; } >> "$file"
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
  cp "$SRC/always-on/vscode.instructions.md" "$VSCODE_PROMPTS/sepia.instructions.md"
  echo "installed → $VSCODE_PROMPTS/sepia.instructions.md"
fi

# Cursor — user rules (alwaysApply: true → every session, unconditionally).
if [ -d "$HOME/.cursor" ]; then
  mkdir -p "$HOME/.cursor/rules"
  cp "$SRC/always-on/cursor.mdc" "$HOME/.cursor/rules/sepia.mdc"
  echo "installed → $HOME/.cursor/rules/sepia.mdc"
fi

# Claude Code — user-global CLAUDE.md (loaded at the start of every session).
if [ -d "$HOME/.claude" ]; then
  append_section "$HOME/.claude/CLAUDE.md" "$SRC/always-on/claude.md" "## Sepia memory (always-on)"
fi

# AGENTS.md (Codex, Cursor, Copilot, any agentsmd-compliant agent) — install
# into the current repo's AGENTS.md if one exists, else print the snippet.
if [ -f "AGENTS.md" ]; then
  append_section "AGENTS.md" "$SRC/always-on/agents.md" "## Sepia memory (always-on)"
else
  echo "note: no AGENTS.md in $(pwd) — append skills/sepia/always-on/agents.md manually for repo-level agents"
fi

echo "Done. Restart your editor to pick up the skill + always-on instructions."
