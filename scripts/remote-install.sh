#!/usr/bin/env bash
# Remote installer for the sepia skill + always-on instructions — fetches
# SKILL.md, references, and the per-editor always-on files from the sepia
# server and installs into every editor dir it can find.
# Idempotent: re-running overwrites in place, never duplicates.
#
# Usage:  curl -fsSL https://sepia.fly.dev/install | bash
#         SEPIA_BASE=https://sepia.fly.dev bash <(curl -fsSL .../install)
#         SEPIA_TOKEN=your_token bash <(curl -fsSL .../install)  # also patch MCP configs
set -euo pipefail

BASE="${SEPIA_BASE:-https://sepia.fly.dev}"
TOKEN="${SEPIA_TOKEN:-${MCP_BEARER_TOKEN:-}}"
SCOPE="${SEPIA_SCOPE:-both}" # both | global | repo — "global" = user-level only, one-and-done

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
  if ! curl -fsSL "$url" -o /tmp/_sepia_append 2>/dev/null; then
    echo "warn: could not fetch $url — server may not be updated yet, skipping $file"
    return
  fi
  if [ -f "$file" ]; then
    printf '\n' >> "$file"
    cat /tmp/_sepia_append >> "$file"
  else
    cat /tmp/_sepia_append > "$file"
  fi
  echo "appended → $file"
}

safe_fetch() {
  local url="$1" dest="$2"
  if ! curl -fsSL "$url" -o "$dest" 2>/dev/null; then
    echo "warn: could not fetch $url — server may not be updated yet, skipping $dest"
    return 1
  fi
  echo "installed → $dest"
  return 0
}

# ── Channel 1: the Agent Skill (on-demand) ────────────────────────────────
# Install into every known skills location (user-level). Create the dir if the
# parent exists, so first-time users get it without manual mkdir.
for base in "$HOME/.agents/skills" "$HOME/.cursor/skills" "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.opencode/skills"; do
  if [ -d "$(dirname "$base")" ]; then
    install_to "$base/sepia"
  fi
done
# Also try project-local .opencode/skills if we're inside a repo
[ -d ".opencode" ] && install_to ".opencode/skills/sepia"

# ── Channel 2: always-on instructions (every session, no invocation) ───────
# This is the channel that MAKES agents remember — skills are on-demand, these
# are injected into EVERY chat automatically.

# VS Code Copilot — file-based instructions with applyTo: "**"
if [ "$SCOPE" != "repo" ]; then
  VSCODE_PROMPTS="${VSCODE_USER_PROMPTS_FOLDER:-$HOME/.config/Code/User/prompts}"
  if [ -d "$VSCODE_PROMPTS" ] || [ -d "$HOME/.config/Code" ]; then
    mkdir -p "$VSCODE_PROMPTS"
    safe_fetch "$BASE/instructions/vscode" "$VSCODE_PROMPTS/sepia.instructions.md" || true
  fi
fi
# Workspace: .github/instructions (preferred) — auto-attached via applyTo "**"
if [ "$SCOPE" != "global" ]; then
  if [ -d ".github" ] || [ -f "AGENTS.md" ] || git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    mkdir -p ".github/instructions"
    safe_fetch "$BASE/instructions/vscode" ".github/instructions/sepia.instructions.md" || true
  fi
fi

# Cursor — user rules (alwaysApply: true → every session, unconditionally).
if [ "$SCOPE" != "repo" ]; then
  if [ -d "$HOME/.cursor" ] || [ -d ".cursor" ]; then
    mkdir -p "$HOME/.cursor/rules"
    safe_fetch "$BASE/instructions/cursor" "$HOME/.cursor/rules/sepia.mdc" || true
  fi
fi
if [ "$SCOPE" != "global" ]; then
  if [ -d ".cursor" ] || git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    mkdir -p ".cursor/rules"
    safe_fetch "$BASE/instructions/cursor" ".cursor/rules/sepia.mdc" || true
  fi
fi

# Claude Code — user-global CLAUDE.md (loaded at the start of every session).
if [ -d "$HOME/.claude" ]; then
  append_section "$HOME/.claude/CLAUDE.md" "$BASE/instructions/claude" "## Sepia memory (always-on)"
fi

# AGENTS.md (Codex, Cursor, Copilot, OpenCode, generic agentsmd) — repo + global
if [ "$SCOPE" != "global" ]; then
  if [ -f "AGENTS.md" ]; then
    append_section "AGENTS.md" "$BASE/instructions/agents" "## Sepia memory (always-on)"
  else
    echo "note: no AGENTS.md in $(pwd) — will create one"
    append_section "AGENTS.md" "$BASE/instructions/agents" "## Sepia memory (always-on)"
  fi
fi
# Global AGENTS.md for OpenCode/Codex user-level
if [ "$SCOPE" != "repo" ]; then
  for f in "$HOME/.config/opencode/AGENTS.md" "$HOME/.codex/AGENTS.md" "$HOME/AGENTS.md"; do
    if [ -d "$(dirname "$f")" ]; then
      append_section "$f" "$BASE/instructions/agents" "## Sepia memory (always-on)"
    fi
  done
fi

# OpenCode — dedicated always-on file (also respects AGENTS.md)
if [ -d "$HOME/.config/opencode" ] || [ -f "opencode.json" ] || [ -f "opencode.jsonc" ]; then
  mkdir -p "$HOME/.config/opencode"
  safe_fetch "$BASE/instructions/opencode" "$HOME/.config/opencode/sepia.md" || true
  [ -f "opencode.json" ] && echo "hint: opencode also reads ./AGENTS.md — already installed"
fi

# Zed — context_servers + always-on via AGENTS.md (Zed reads AGENTS.md too)
if [ -d "$HOME/.config/zed" ] || command -v zed >/dev/null 2>&1; then
  mkdir -p "$HOME/.config/zed"
  safe_fetch "$BASE/instructions/zed" "$HOME/.config/zed/sepia.md" || true
  if [ -f "$HOME/.config/zed/settings.json" ]; then
    echo "hint: add sepia to context_servers in ~/.config/zed/settings.json (see https://sepia.fly.dev — Dashboard → Install)"
  else
    echo "hint: create ~/.config/zed/settings.json with context_servers.sepia (see Dashboard → Install)"
  fi
fi

# ── Channel 3: MCP configs (optional, if SEPIA_TOKEN provided) ─────────────
# Patches editor MCP JSON files idempotently; otherwise just prints the snippet.
if [ -n "$TOKEN" ]; then
  echo "patching MCP configs with provided token…"
  # Use python3 for JSON patching (available in most installs, including this image)
  python3 - "$TOKEN" "$BASE" << 'PY'
import json, os, pathlib, sys
token = sys.argv[1]
base = sys.argv[2]
mcp_url = f"{base}/mcp"
sepia_remote = {
    "type": "http",
    "url": mcp_url,
    "headers": {"Authorization": f"Bearer {token}"}
}
# opencode.json variants: "mcp" (v1) or "mcp.servers" (v2)
for p in [pathlib.Path.home()/".config/opencode/opencode.json", pathlib.Path("opencode.json"), pathlib.Path("opencode.jsonc")]:
    if p.exists():
        try:
            txt = p.read_text()
            data = json.loads(txt)
            if "mcp" not in data:
                data["mcp"] = {}
            # v2 uses mcp.servers
            if "servers" in data["mcp"]:
                data["mcp"]["servers"]["sepia"] = {**sepia_remote, "enabled": True}
            else:
                data["mcp"]["sepia"] = {**sepia_remote, "enabled": True}
            p.write_text(json.dumps(data, indent=2) + "\n")
            print(f"patched → {p}")
        except Exception as e:
            print(f"skip {p}: {e}", file=sys.stderr)
# VS Code .vscode/mcp.json
for p in [pathlib.Path(".vscode/mcp.json"), pathlib.Path.home()/".config/Code/User/mcp.json"]:
    if p.parent.exists():
        try:
            data = json.loads(p.read_text()) if p.exists() else {}
            data.setdefault("servers", {})["sepia"] = sepia_remote
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(json.dumps(data, indent=2) + "\n")
            print(f"patched → {p}")
        except Exception as e:
            print(f"skip {p}: {e}", file=sys.stderr)
PY
fi

echo ""
echo "Done. Installed (scope: $SCOPE):"
echo "  • Skill:        SKILL.md → .agents/.cursor/.claude/.codex/.opencode (user + project)"
if [ "$SCOPE" != "repo" ]; then
  echo "  • VS Code:      ~/.config/Code/User/prompts/sepia.instructions.md (global, one-and-done)"
  echo "  • Cursor:       ~/.cursor/rules/sepia.mdc (global)"
  echo "  • Claude:       ~/.claude/CLAUDE.md"
  echo "  • AGENTS.md:    ~/.config/opencode/AGENTS.md + ~/.codex/AGENTS.md (global)"
  echo "  • OpenCode:     ~/.config/opencode/sepia.md (global)"
  echo "  • Zed:          ~/.config/zed/sepia.md (global) + context_servers"
fi
if [ "$SCOPE" != "global" ]; then
  echo "  • Repo:         .github/instructions/sepia.instructions.md + .cursor/rules/sepia.mdc + ./AGENTS.md (commit to git for team)"
fi
if [ -z "$TOKEN" ]; then
  echo ""
  echo "Next: set SEPIA_TOKEN and re-run to auto-patch MCP configs, or copy configs from:"
  echo "  https://sepia.fly.dev  → Dashboard → Install (or /app/connect)"
fi
echo "Restart your editor to pick up the skill + always-on instructions."
