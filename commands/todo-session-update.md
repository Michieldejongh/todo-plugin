---
description: Verrijk bestaande sessietaak met huidige branch, plan-slug en PR
allowed-tools: Bash, AskUserQuestion
---

```bash
CWD=$(pwd)
CWD_SLUG=$(echo "$CWD" | tr '/' '-')
SESSION=$(ls -t ~/.claude/projects/${CWD_SLUG}/*.jsonl 2>/dev/null | head -1 | xargs -I{} basename {} .jsonl 2>/dev/null)
BRANCH=$(git branch --show-current 2>/dev/null || echo "")

if [[ -z "$SESSION" ]]; then
  echo "GEEN_SESSIE"
  exit 2
fi

OUTPUT=$(node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js session-update --session "$SESSION" --branch "$BRANCH" --cwd "$CWD" 2>&1)
CODE=$?
echo "EXIT:$CODE"
echo "$OUTPUT"
```

Verwerk de output:
- Als output `GEEN_SESSIE` bevat: meld "Geen actieve sessie gevonden." en stop.
- Als `EXIT:0` en output een update beschrijft: toon de update en stop.
- Als `EXIT:0` en output "Geen wijzigingen": toon dat en stop.
- Als `EXIT:2` en output `NOT_FOUND`: gebruik `AskUserQuestion` (header: "Geen taak", question: "Er is nog geen taak voor deze sessie. Wil je er één aanmaken?", opties: ["Ja, maak taak aan", "Nee"]). Bij "Ja": voer `/todo-session` uit door de volledige instructies van dat command te volgen (session-prepare → AskUserQuestion → session-add).
