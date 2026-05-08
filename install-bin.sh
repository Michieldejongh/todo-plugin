#!/usr/bin/env bash
# Idempotente setup — draait bij elke SessionStart.
# 1. Zorgt dat ~/.claude-todo/ data-directory bestaat.
# 2. Symlinkt bin/ scripts naar ~/.local/bin/ als die in PATH zit.
set -e

# Fallback: als CLAUDE_PLUGIN_ROOT niet gezet is (handmatige aanroep),
# gebruik de directory waar dit script staat.
if [[ -z "${CLAUDE_PLUGIN_ROOT:-}" ]]; then
  CLAUDE_PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

# 1. Data-directory
mkdir -p "${HOME}/.claude-todo"
[[ -f "${HOME}/.claude-todo/todos.json" ]] || echo '[]' > "${HOME}/.claude-todo/todos.json"

# 2. Symlink wrappers als ~/.local/bin op PATH zit (voor !-prefix in Claude Code + terminal)
if [[ ":$PATH:" == *":${HOME}/.local/bin:"* ]]; then
  mkdir -p "${HOME}/.local/bin"
  if [[ -d "${CLAUDE_PLUGIN_ROOT}/bin" ]]; then
    for script in "${CLAUDE_PLUGIN_ROOT}/bin"/*; do
      [[ -e "$script" ]] || continue
      name=$(basename "$script")
      target="${HOME}/.local/bin/${name}"
      # Alleen overschrijven als target niet bestaat of al een plugin-symlink is
      if [[ ! -e "$target" ]] || [[ -L "$target" && "$(readlink "$target")" == *"/todo/"* ]]; then
        ln -sf "$script" "$target"
        chmod +x "$script" 2>/dev/null || true
      fi
    done
  fi
fi

exit 0
