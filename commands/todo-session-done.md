---
description: Taak van huidige Claude sessie afronden
allowed-tools: Bash, AskUserQuestion
---

```bash
CWD_SLUG=$(pwd | tr '/' '-')
SESSION=$(ls -t ~/.claude/projects/${CWD_SLUG}/*.jsonl 2>/dev/null | head -1 | xargs -I{} basename {} .jsonl)
node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js session-done --session "$SESSION"
```

Exit 0 → toon output, klaar.
Exit 2 + "NOT_FOUND" → `AskUserQuestion` "Geen taak voor sessie, wil je er een aanmaken?" opties ["Ja", "Nee"]. Bij Ja: "Other"-invoer als titel, herhaal met `--title "$TITEL" --branch "$BRANCH" --cwd "$CWD"`.
Exit 2 + JSON array → `AskUserQuestion` met kandidaten; voer `done` uit op gekozen id.
