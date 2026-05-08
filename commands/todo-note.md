---
description: Notitie toevoegen aan taak
allowed-tools: Bash, AskUserQuestion
argument-hint: <id> [tekst]
---

Parseer $ARGUMENTS: eerste woord = ID, rest = TEKST.

Als TEKST leeg: `AskUserQuestion` header "Notitie" question "Wat is de notitie?" opties ["Annuleer"]; gebruik "Other"-invoer als TEKST.

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js note "$ID" "$TEKST"
```
Toon output.
