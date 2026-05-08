---
description: Nieuwe to-do taak aanmaken
allowed-tools: Bash
argument-hint: <titel>
---

Context parallel: `echo "$CLAUDE_SESSION_ID"`, `git branch --show-current 2>/dev/null || echo ""`, `pwd` → SESSION/BRANCH/CWD.

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js add "$ARGUMENTS" --session "$SESSION" --branch "$BRANCH" --cwd "$CWD" --auto-plan
```
Toon output.
