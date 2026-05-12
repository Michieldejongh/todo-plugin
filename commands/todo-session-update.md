---
description: Verrijk bestaande sessietaak met huidige branch, plan-slug en PR
allowed-tools: Bash
---

Context ophalen:
```bash
CWD_SLUG=$(pwd | tr '/' '-')
SESSION=$(ls -t ~/.claude/projects/${CWD_SLUG}/*.jsonl 2>/dev/null | head -1 | xargs -I{} basename {} .jsonl)
BRANCH=$(git branch --show-current 2>/dev/null || echo "")
CWD=$(pwd)
node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js session-update --session "$SESSION" --branch "$BRANCH" --cwd "$CWD"
```

Toon output. Vult lege velden met huidige context; bestaande waarden blijven (gebruik `--force` als argument om wel te overschrijven).
