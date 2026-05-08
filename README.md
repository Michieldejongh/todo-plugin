# todo — persistent to-do lijst voor Claude Code

Persistent to-do systeem dat werkt over Claude Code sessies heen. Interactieve HTML UI, automatische koppeling aan git-branch, Claude-plan en GitHub PR.

## Installatie

Binnen Claude Code:
```
/plugin marketplace add michieldejongh/todo-plugin
/plugin install todo@todo-marketplace
```

Herstart je sessie. De `SessionStart` hook maakt automatisch `~/.claude-todo/` aan en symlinkt de `bin/` scripts naar `~/.local/bin/` (als die in je `PATH` zit).

## Gebruik

**Slash commands** (Tab na `/todo` voor picker):

| Command | Beschrijving |
|---|---|
| `/todo` | Interactief overzicht + actie-keuze |
| `/todo-ui` | Open HTML frontend op http://localhost:3737 |
| `/todo-add <titel>` | Nieuwe taak (auto branch/plan/PR-detectie) |
| `/todo-start <id>` | Taak op "bezig" zetten |
| `/todo-done <id>` | Taak afronden |
| `/todo-note <id> [tekst]` | Notitie toevoegen |
| `/todo-edit <id> <titel>` | Titel aanpassen |
| `/todo-due <id> <YYYY-MM-DD>` | Deadline zetten (of `clear`) |
| `/todo-rm <id>` | Verwijderen (bevestigt bij actieve taken) |
| `/todo-session` | Huidige Claude-sessie als taak toevoegen |
| `/todo-session-done` | Taak van huidige sessie afronden |
| `/todo-ids` | Compacte ID-lijst (kopieerhulp) |

**Bash wrappers** (via `!` prefix in Claude Code of direct in terminal):

```
!todo                 # overzicht
!todo-add "feature X"
!todo-done t_2026
!todo-ui
```

Zelfde namen als de slash commands, zonder de leading slash.

## Features

- **Globale lijst** — één `todos.json`, gedeeld tussen alle projecten/sessies
- **Auto-detectie** — nieuwe taken krijgen huidige branch, Claude-plan-slug (als recent gewijzigd), en PR-URL (via `gh pr view`)
- **HTML UI** — drie kolommen Open/Bezig/Afgerond, inline bewerkbaar via `contenteditable`, HTML5 date picker voor deadlines, klikbare `↗` naar PR en plan
- **Sessie-koppeling** — `/todo-session` leest de eerste echte user-prompt als auto-titel, schrijft ook naar `~/.claude/sessions/<pid>.json` zodat Claude Code de sessie herkent onder die naam
- **ID prefix/suffix matching** — `t_2026` of de 5-char suffix volstaat als het uniek is

## Data-locatie

- Data: `~/.claude-todo/todos.json` (overleeft plugin-updates)
- Override met env var: `TODO_DATA_FILE=/andere/path.json`

## Ontwikkeling

Plugin structuur:
```
.claude-plugin/plugin.json        manifest
commands/                         slash commands (12)
scripts/todo.js                   CLI logica
scripts/todo-server.js            HTTP server + inline HTML
bin/                              shell wrappers (14)
hooks/hooks.json                  SessionStart hook
install-bin.sh                    idempotente setup
migrate.sh                        migratie van oude hand-installatie
```

Handmatig testen zonder Claude Code:
```bash
node scripts/todo.js help
node scripts/todo.js list --branch main
node scripts/todo-server.js        # opent :3737
```

## Migratie vanaf hand-installatie

Als je eerder een oudere hand-installatie had in `~/.claude/commands/todo*.md` en `~/.claude/todo-data/`:

```bash
bash ~/.claude/plugins/cache/todo-marketplace/todo/<version>/migrate.sh
```

Dit verplaatst `~/.claude/todo-data/todos.json` naar `~/.claude-todo/todos.json` en ruimt oude bestanden op.

## Licentie

MIT
