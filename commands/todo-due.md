---
description: Deadline zetten (YYYY-MM-DD of clear)
allowed-tools: Bash
argument-hint: <id> <YYYY-MM-DD|clear>
---

Parseer $ARGUMENTS: eerste woord = ID, tweede = DATE.

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js due "$ID" "$DATE"
```
Toon output.
