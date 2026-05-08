#!/usr/bin/env bash
# Idempotente setup — draait bij elke SessionStart.
# 1. Zorgt dat ~/.claude-todo/ data-directory bestaat.
# 2. Symlinkt bin/ scripts naar ~/.local/bin/ als die in PATH zit.
set -e

# 1. Data-directory
mkdir -p "${HOME}/.claude-todo"
[[ -f "${HOME}/.claude-todo/todos.json" ]] || echo '[]' > "${HOME}/.claude-todo/todos.json"

# 2. Symlink wrappers als ~/.local/bin op PATH zit (voor !-prefix in Claude Code + terminal)
if [[ ":$PATH:" == *":${HOME}/.local/bin:"* ]]; then
  mkdir -p "${HOME}/.local/bin"
  for script in "${CLAUDE_PLUGIN_ROOT}/bin"/*; do
    name=$(basename "$script")
    target="${HOME}/.local/bin/${name}"
    # Alleen overschrijven als target niet bestaat of al een plugin-symlink is
    if [[ ! -e "$target" ]] || [[ -L "$target" && "$(readlink "$target")" == "${CLAUDE_PLUGIN_ROOT}"* ]]; then
      ln -sf "$script" "$target"
      chmod +x "$script" 2>/dev/null || true
    fi
  done
fi

exit 0
