#!/usr/bin/env bash
# Remote installer for the sepia skill — fetches SKILL.md + references from
# the sepia server and installs into every editor skill dir it can find.
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

[ -d "$HOME/.agents/skills" ] && install_to "$HOME/.agents/skills/sepia"
[ -d "$HOME/.cursor/skills" ] && install_to "$HOME/.cursor/skills/sepia"
[ -d "$HOME/.claude/skills" ] && install_to "$HOME/.claude/skills/sepia"
[ -d "$HOME/.codex/skills" ] && install_to "$HOME/.codex/skills/sepia"
[ -d "$HOME/.opencode/skills" ] && install_to "$HOME/.opencode/skills/sepia"

echo "Done. Restart your editor to pick up the skill."
