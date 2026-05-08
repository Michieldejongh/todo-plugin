---
description: Huidige Claude sessie als taak toevoegen
allowed-tools: Bash, AskUserQuestion
---

Context ophalen:
```bash
CWD_SLUG=$(pwd | tr '/' '-')
SESSION=$(ls -t ~/.claude/projects/${CWD_SLUG}/*.jsonl 2>/dev/null | head -1 | xargs -I{} basename {} .jsonl)
BRANCH=$(git branch --show-current 2>/dev/null || echo "")
CWD=$(pwd)
node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js session-prepare "$SESSION" --branch "$BRANCH"
```

JSON output: `existing`, `autoTitle`, `plans`, `currentName`.

- Als `existing` niet leeg: stop met "Taak bestaat al voor deze sessie: `<id>` — <title>".
- Anders `AskUserQuestion` "Sessietitel" "Titel voor deze sessie?" opties [`autoTitle`, (eerste plan indien aanwezig), "Andere titel"]. "Other"-invoer bij "Andere titel".

PLAN = eerste slug als die gekozen, anders "". TITEL = gekozen optie of Other-invoer.

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js session-add "$TITEL" --session "$SESSION" --branch "$BRANCH" --cwd "$CWD" --plan "$PLAN"
```
Toon output.
