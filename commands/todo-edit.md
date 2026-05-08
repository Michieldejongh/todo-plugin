---
description: Taaknaam aanpassen
allowed-tools: Bash
argument-hint: <id> <nieuwe titel>
---

Parseer $ARGUMENTS: eerste woord = ID, rest = TITEL.

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js edit "$ID" "$TITEL"
```
Toon output.
