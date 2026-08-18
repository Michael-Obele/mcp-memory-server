#!/usr/bin/env bash
# Installs the sepia skill into every editor dir it can find.
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

[ -d "$HOME/.agents/skills" ] && install_to "$HOME/.agents/skills/sepia"
[ -d "$HOME/.cursor/skills" ] && install_to "$HOME/.cursor/skills/sepia"
[ -d "$HOME/.claude/skills" ] && install_to "$HOME/.claude/skills/sepia"
[ -d "$HOME/.codex/skills" ] && install_to "$HOME/.codex/skills/sepia"
[ -d "$HOME/.opencode/skills" ] && install_to "$HOME/.opencode/skills/sepia"

echo "Done. Restart your editor to pick up the skill."
