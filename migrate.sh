#!/usr/bin/env bash
# Eenmalige migratie van oude hand-geïnstalleerde todo-setup naar plugin-layout.
# Draai pas nadat je het plugin-pakket hebt geïnstalleerd via /plugin install.
set -e

echo "Migratie: oude todo-setup → plugin-layout"
echo ""

# 1. Verplaats bestaande data (alleen als oude locatie data bevat)
if [[ -f "${HOME}/.claude/todo-data/todos.json" ]]; then
  mkdir -p "${HOME}/.claude-todo"
  if [[ -f "${HOME}/.claude-todo/todos.json" ]]; then
    echo "! ${HOME}/.claude-todo/todos.json bestaat al — skip data move."
  else
    mv "${HOME}/.claude/todo-data/todos.json" "${HOME}/.claude-todo/todos.json"
    echo "✓ Data verplaatst naar ~/.claude-todo/todos.json"
  fi
fi

# 2. Verwijder oude data-directory
if [[ -d "${HOME}/.claude/todo-data" ]]; then
  rm -rf "${HOME}/.claude/todo-data"
  echo "✓ Oude ~/.claude/todo-data/ verwijderd"
fi

# 3. Verwijder oude slash commands
removed_cmds=0
for f in "${HOME}"/.claude/commands/todo*.md; do
  [[ -e "$f" ]] || continue
  rm -f "$f"
  ((removed_cmds++))
done
[[ $removed_cmds -gt 0 ]] && echo "✓ ${removed_cmds} oude slash commands verwijderd uit ~/.claude/commands/"

# 4. Verwijder oude bin wrappers (worden opnieuw gesymlinkt door SessionStart hook)
removed_bins=0
for f in "${HOME}"/.local/bin/todo "${HOME}"/.local/bin/todo-*; do
  [[ -e "$f" ]] || continue
  rm -f "$f"
  ((removed_bins++))
done
[[ $removed_bins -gt 0 ]] && echo "✓ ${removed_bins} oude bin wrappers verwijderd uit ~/.local/bin/"

echo ""
echo "Migratie klaar. Herstart je Claude Code sessie zodat de SessionStart hook draait."
echo "Daarna: /todo om te verifiëren."
