---
description: Compacte lijst van alle actieve taak-IDs (kopieerhulp)
allowed-tools: Bash
---

```bash
BRANCH=$(git branch --show-current 2>/dev/null || echo "")
node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js ids --branch "$BRANCH"
```

Toon output. Legenda: `▶` = bezig, `○` = open, `*` = huidige branch.
