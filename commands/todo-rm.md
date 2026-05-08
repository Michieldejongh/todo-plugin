---
description: Taak verwijderen (bevestiging bij actieve taken)
allowed-tools: Bash, AskUserQuestion
argument-hint: <id>
---

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js rm "$ARGUMENTS"
```
Exit 2 + "CONFIRM_NEEDED" → `AskUserQuestion` "Bevestig" "Actieve taak verwijderen?" opties ["Ja, verwijder", "Annuleer"]. Bij Ja: herhaal met `--force`.
