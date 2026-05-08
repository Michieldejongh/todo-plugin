---
description: Beheer persistente to-do lijst over sessies heen
allowed-tools: Bash, AskUserQuestion
argument-hint: "[add <titel> | start <id> | done <id> | note <id> [tekst] | rm <id> [--force] | edit <id> <titel> | session | session done | ui | help]"
---

Dunne orchestrator. Alle logica zit in `${CLAUDE_PLUGIN_ROOT}/scripts/todo.js`. Roep scripts aan, geen eigen redenering.

## Context (parallel, altijd)
```bash
echo "$CLAUDE_SESSION_ID"
git branch --show-current 2>/dev/null || echo ""
pwd
```
Als SESSION / BRANCH / CWD.

## Acties

**Directe passthrough** — voer uit en toon output:

| Argument | Script |
|---|---|
| `help` of `?` | `node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js help` |
| `ui` | `node ${CLAUDE_PLUGIN_ROOT}/scripts/todo-server.js &` → meld: "UI op http://localhost:3737" |
| `start <id>` | `node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js start "$ID"` |
| `done <id>` | `node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js done "$ID"` |
| `edit <id> <titel>` | `node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js edit "$ID" "$TITEL"` |
| `due <id> <YYYY-MM-DD>` | `node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js due "$ID" "$DATE"` (of `clear`) |
| `add <titel>` | `node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js add "$TITEL" --session "$SESSION" --branch "$BRANCH" --cwd "$CWD" --auto-plan` (voeg `--due YYYY-MM-DD` toe als deadline genoemd) |

**`note <id> [tekst]`** — als geen tekst: `AskUserQuestion` header "Notitie" question "Wat is de notitie?" opties ["Annuleer"]; gebruik "Other"-invoer. Dan: `node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js note "$ID" "$TEKST"`.

**`rm <id>`** — eerst: `node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js rm "$ID"`. Als exit 2 + "CONFIRM_NEEDED": `AskUserQuestion` "Bevestig" "Actieve taak verwijderen?" opties ["Ja, verwijder", "Annuleer"]. Bij Ja: herhaal met `--force`.

**Leeg** — `node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js menu-data --branch "$BRANCH"`. Parseer JSON: `overview`, `actions`, `taskOptions.{done,start,note}`. Toon overview. `AskUserQuestion` header "Actie" question "Wat wil je doen?" opties `actions`. Op keuze:
- "Taak afronden/op bezig zetten/Notitie toevoegen" → `AskUserQuestion` met top-3 uit `taskOptions.<actie>` + "Andere taak". Id = eerste token van gekozen label (of "Other"-invoer). Voer passende actie uit.
- "Nieuwe taak toevoegen" → `AskUserQuestion` "Nieuwe taak" opties ["Annuleer"]; "Other"-invoer = titel; dan `add` passthrough.

**`session`** — `node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js session-prepare "$SESSION" --branch "$BRANCH"`. JSON velden: `existing`, `autoTitle`, `plans`, `currentName`.
- Als `existing` niet leeg: stop met "Taak bestaat al voor deze sessie: `<id>` — <title>".
- Anders `AskUserQuestion` "Sessietitel" "Titel voor deze sessie?" opties [`autoTitle`, (eerste plan uit `plans` indien aanwezig), "Andere titel"]. "Other"-invoer bij "Andere titel".
- Plan = eerste slug uit `plans` als die gekozen/relevant, anders "".
- `node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js session-add "$TITEL" --session "$SESSION" --branch "$BRANCH" --cwd "$CWD" --plan "$PLAN"`.

**`session done`** — `node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js session-done --session "$SESSION"`.
- Exit 0 → toon output, klaar.
- Exit 2 + "NOT_FOUND" → `AskUserQuestion` "Geen taak voor sessie, wil je er een aanmaken?" opties ["Ja", "Nee"]. Bij Ja: "Other"-invoer als titel, dan `node ${CLAUDE_PLUGIN_ROOT}/scripts/todo.js session-done --session "$SESSION" --branch "$BRANCH" --cwd "$CWD" --title "$TITEL"`.
- Exit 2 + JSON array → `AskUserQuestion` met kandidaten; voer `done` uit op gekozen id.

## Niet herkend
"Onbekend commando. Gebruik `/todo help`."
