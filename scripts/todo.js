#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const DATA_FILE = process.env.TODO_DATA_FILE
  || path.join(os.homedir(), '.claude-todo', 'todos.json');
const PLANS_DIR = path.join(os.homedir(), '.claude', 'plans');
const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions');

// Lookup PR URL for a given branch in a given cwd. Returns '' if no PR or gh fails.
function detectPrUrl(branch, cwd) {
  if (!branch || !cwd) return '';
  try {
    const { execSync } = require('child_process');
    const out = execSync(
      `gh pr view ${JSON.stringify(branch)} --json url -q .url 2>/dev/null`,
      { cwd, encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }
    );
    return out.trim();
  } catch { return ''; }
}

// Find the session JSON file for a given sessionId, return parsed object or null
function findSessionFile(sessionId) {
  try {
    const files = fs.readdirSync(SESSIONS_DIR);
    for (const f of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8'));
        if (data.sessionId === sessionId) return { file: path.join(SESSIONS_DIR, f), data };
      } catch {}
    }
  } catch {}
  return null;
}

// Write the name field into the session JSON file
function setSessionName(sessionId, name) {
  const found = findSessionFile(sessionId);
  if (!found) return false;
  found.data.name = name;
  fs.writeFileSync(found.file, JSON.stringify(found.data));
  return true;
}

// Read the current name from the session JSON file
function getSessionName(sessionId) {
  const found = findSessionFile(sessionId);
  return found?.data?.name || '';
}

function readTodos() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return []; }
}

function writeTodos(todos) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(todos, null, 2) + '\n');
}

function genId() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const date = `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  const rand = crypto.randomBytes(4).toString('hex').slice(0, 5);
  return `t_${date}_${time}_${rand}`;
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function findTask(todos, fragment) {
  const matches = todos.filter(t =>
    t.id.startsWith(fragment) || t.id.endsWith(fragment) || t.id.includes(fragment)
  );
  if (matches.length === 0) { console.error(`Geen taak gevonden voor "${fragment}"`); process.exit(1); }
  if (matches.length > 1) {
    console.error(`Meerdere taken gevonden:\n${matches.map(t => `  ${t.id}  ${t.title}`).join('\n')}`);
    process.exit(1);
  }
  return matches[0];
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const m = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  return `${d.getDate()} ${m[d.getMonth()]}`;
}

function formatOverview(todos, currentBranch) {
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const bezig = todos.filter(t => t.status === 'in_progress');
  const open  = todos.filter(t => t.status === 'pending');
  const klaar = todos.filter(t => t.status === 'done' && t.completedAt > cutoff);

  const byBranch = branch => (a, b) =>
    (a.gitBranch === branch ? 0 : 1) - (b.gitBranch === branch ? 0 : 1);

  bezig.sort((a, b) => byBranch(currentBranch)(a, b) || (b.startedAt||'').localeCompare(a.startedAt||''));
  open.sort((a, b)  => byBranch(currentBranch)(a, b) || (b.createdAt||'').localeCompare(a.createdAt||''));
  klaar.sort((a, b) => (b.completedAt||'').localeCompare(a.completedAt||''));

  function fmtTask(t) {
    const mark = t.gitBranch === currentBranch ? '* ' : '  ';
    const shortId = t.id.slice(0, 20);
    let s = `${mark}${shortId}  ${t.title}`;
    const meta = [];
    if (t.gitBranch) meta.push(`Branch: ${t.gitBranch}`);
    if (t.sessionId) meta.push(`Sessie: ${t.sessionId.slice(0, 8)}`);
    if (meta.length) s += `\n    ${meta.join('  |  ')}`;
    if (t.notes?.length) {
      const last = t.notes[t.notes.length - 1];
      s += `\n    Notitie (${formatDate(last.timestamp)}): ${last.text}`;
    }
    return s;
  }

  const sec = (title, items, fmt) =>
    `## ${title} (${items.length})\n` + (items.length ? items.map(fmt).join('\n\n') + '\n' : '  (geen)\n');

  return [
    sec('Bezig', bezig, fmtTask),
    sec('Open', open, fmtTask),
    sec('Afgerond afgelopen 7 dagen', klaar, t =>
      `  ${t.id.slice(0, 20)}  ${t.title}  (${formatDate(t.completedAt)})`),
  ].join('\n');
}

// --- commands ---

const [,, cmd, ...args] = process.argv;

function argVal(flag) {
  const i = args.indexOf(flag);
  return i > -1 ? args[i + 1] || '' : '';
}

switch (cmd) {

  case 'list': {
    const branch = argVal('--branch');
    console.log(formatOverview(readTodos(), branch));
    break;
  }

  case 'menu-data': {
    const branch = argVal('--branch');
    const todos = readTodos();
    const overview = formatOverview(todos, branch);
    const hasIP = todos.some(t => t.status === 'in_progress');
    const hasPending = todos.some(t => t.status === 'pending');
    const hasIPonBranch = todos.some(t => t.status === 'in_progress' && t.gitBranch === branch);

    let actions;
    if (hasIP) actions = ['Taak afronden', 'Nieuwe taak toevoegen', 'Taak op bezig zetten', 'Notitie toevoegen'];
    else if (!hasIPonBranch && hasPending) actions = ['Taak op bezig zetten', 'Nieuwe taak toevoegen', 'Taak afronden', 'Notitie toevoegen'];
    else actions = ['Nieuwe taak toevoegen', 'Taak op bezig zetten', 'Taak afronden', 'Notitie toevoegen'];

    const byBranch = (a, b) => (a.gitBranch === branch ? 0 : 1) - (b.gitBranch === branch ? 0 : 1);
    const top3 = (filter) => todos.filter(filter).sort(byBranch).slice(0, 3)
      .map(t => ({ id: t.id, label: `${t.id.slice(0, 20)}  ${t.title}${t.gitBranch !== branch ? ` [${t.gitBranch}]` : ''}` }));

    console.log(JSON.stringify({
      overview,
      actions: actions.slice(0, 4),
      taskOptions: {
        done:  top3(t => t.status === 'in_progress'),
        start: top3(t => t.status === 'pending'),
        note:  top3(t => t.status !== 'done'),
      },
    }));
    break;
  }

  case 'add': {
    const flagStart = args.findIndex(a => a.startsWith('--'));
    const title = (flagStart > -1 ? args.slice(0, flagStart) : args).join(' ');
    const todos = readTodos();

    // Auto-detect plan if --plan not provided and --auto-plan flag set
    let planSlug = argVal('--plan');
    if (!planSlug && args.includes('--auto-plan')) {
      try {
        const cutoff = Date.now() - 30 * 60 * 1000;
        const plans = fs.readdirSync(PLANS_DIR)
          .filter(f => f.endsWith('.md') && fs.statSync(path.join(PLANS_DIR, f)).mtimeMs > cutoff)
          .sort((a, b) => fs.statSync(path.join(PLANS_DIR, b)).mtimeMs - fs.statSync(path.join(PLANS_DIR, a)).mtimeMs);
        if (plans.length === 1) planSlug = plans[0].replace(/\.md$/, '');
        // Multiple plans: do nothing (ambiguous), keep empty
      } catch {}
    }

    const dueDate = argVal('--due') || null;
    const branch = argVal('--branch');
    const cwd = argVal('--cwd');
    const task = {
      id: genId(), title,
      status: 'pending',
      createdAt: nowIso(), startedAt: null, completedAt: null,
      sessionId: argVal('--session'),
      gitBranch: branch,
      cwd,
      planSlug,
      prUrl: detectPrUrl(branch, cwd),
      dueDate,
      notes: [],
    };
    todos.push(task);
    writeTodos(todos);
    console.log(`Taak aangemaakt: \`${task.id}\` — ${title}${planSlug ? ` (plan: ${planSlug})` : ''}${dueDate ? ` (deadline: ${dueDate})` : ''}`);
    break;
  }

  case 'start': {
    const todos = readTodos();
    const task = findTask(todos, args[0]);
    if (task.status === 'in_progress') { console.log(`Al bezig: ${task.title}`); break; }
    task.status = 'in_progress';
    task.startedAt = nowIso();
    writeTodos(todos);
    console.log(`Bezig: ${task.title}`);
    break;
  }

  case 'done': {
    const todos = readTodos();
    const task = findTask(todos, args[0]);
    if (task.status === 'done') { console.log(`Al afgerond: ${task.title}`); break; }
    task.status = 'done';
    task.completedAt = nowIso();
    writeTodos(todos);
    console.log(`Afgerond: ${task.title}`);
    break;
  }

  case 'note': {
    const todos = readTodos();
    const task = findTask(todos, args[0]);
    const text = args.slice(1).filter(a => !a.startsWith('--')).join(' ');
    if (!text) { console.log('NEEDS_TEXT'); process.exit(2); }
    task.notes.push({ timestamp: nowIso(), text });
    writeTodos(todos);
    console.log(`Notitie toegevoegd aan: ${task.title}`);
    break;
  }

  case 'rm': {
    const todos = readTodos();
    const task = findTask(todos, args[0]);
    // Soft-delete active tasks (require --force); allow done tasks without force
    if (task.status !== 'done' && !args.includes('--force')) {
      console.log(`CONFIRM_NEEDED: actieve taak "${task.title}" — gebruik --force om te verwijderen`);
      process.exit(2);
    }
    todos.splice(todos.indexOf(task), 1);
    writeTodos(todos);
    console.log(`Verwijderd: ${task.title}`);
    break;
  }

  case 'edit': {
    const todos = readTodos();
    const task = findTask(todos, args[0]);
    const newTitle = args.slice(1).join(' ');
    task.title = newTitle;
    writeTodos(todos);
    console.log(`Bijgewerkt: ${newTitle}`);
    break;
  }

  case 'refresh-pr': {
    const todos = readTodos();
    const task = findTask(todos, args[0]);
    const url = detectPrUrl(task.gitBranch, task.cwd);
    task.prUrl = url;
    writeTodos(todos);
    console.log(url ? `PR gekoppeld: ${url}` : `Geen PR gevonden voor branch ${task.gitBranch}`);
    break;
  }

  case 'due': {
    const todos = readTodos();
    const task = findTask(todos, args[0]);
    const date = args[1];
    if (!date || date === 'clear' || date === 'none') {
      task.dueDate = null;
      writeTodos(todos);
      console.log(`Deadline verwijderd: ${task.title}`);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      task.dueDate = date;
      writeTodos(todos);
      console.log(`Deadline gezet op ${date}: ${task.title}`);
    } else {
      console.error(`Ongeldige datum: ${date} (gebruik YYYY-MM-DD of "clear")`);
      process.exit(1);
    }
    break;
  }

  case 'detect-plan': {
    const cutoff = Date.now() - 30 * 60 * 1000;
    try {
      const slugs = fs.readdirSync(PLANS_DIR)
        .filter(f => f.endsWith('.md'))
        .filter(f => fs.statSync(path.join(PLANS_DIR, f)).mtimeMs > cutoff)
        .sort((a, b) =>
          fs.statSync(path.join(PLANS_DIR, b)).mtimeMs -
          fs.statSync(path.join(PLANS_DIR, a)).mtimeMs)
        .map(f => f.replace(/\.md$/, ''));
      console.log(JSON.stringify(slugs));
    } catch { console.log('[]'); }
    break;
  }

  case 'session-title': {
    const sessionId = args[0];
    try {
      const dirs = fs.readdirSync(PROJECTS_DIR);
      for (const dir of dirs) {
        const file = path.join(PROJECTS_DIR, dir, `${sessionId}.jsonl`);
        if (!fs.existsSync(file)) continue;
        const raw = fs.readFileSync(file, 'utf8').slice(0, 8192);
        for (const line of raw.split('\n').filter(Boolean)) {
          try {
            const entry = JSON.parse(line);
            if (entry.type !== 'user') continue;
            const content = typeof entry.message?.content === 'string'
              ? entry.message.content
              : Array.isArray(entry.message?.content)
                ? entry.message.content.map(c => c.text || '').join('')
                : '';
            const trimmed = content.trim();
            if (!trimmed) continue;
            // Skip alle meta-tags (local-command-*, system-reminder, bash-input, etc)
            if (trimmed.startsWith('<')) continue;
            // Skip slash commands
            if (/^\//.test(trimmed)) continue;
            console.log(trimmed.slice(0, 80).replace(/\n/g, ' '));
            process.exit(0);
          } catch {}
        }
      }
    } catch {}
    console.log('');
    break;
  }

  case 'session-check': {
    const sessionId = args[0];
    const existing = readTodos().filter(t => t.sessionId === sessionId);
    console.log(JSON.stringify(existing));
    break;
  }

  // Returns everything needed to drive /todo session in one call
  case 'session-prepare': {
    const sessionId = args[0];
    const branch = argVal('--branch');
    const todos = readTodos();

    // existing tasks for this session (empty sessionId never matches)
    const existing = sessionId ? todos.filter(t => t.sessionId === sessionId) : [];

    // auto-title from transcript
    let autoTitle = '';
    try {
      const dirs = fs.readdirSync(PROJECTS_DIR);
      outer: for (const dir of dirs) {
        const file = path.join(PROJECTS_DIR, dir, `${sessionId}.jsonl`);
        if (!fs.existsSync(file)) continue;
        const raw = fs.readFileSync(file, 'utf8').slice(0, 8192);
        for (const line of raw.split('\n').filter(Boolean)) {
          try {
            const entry = JSON.parse(line);
            if (entry.type !== 'user') continue;
            const content = typeof entry.message?.content === 'string'
              ? entry.message.content
              : Array.isArray(entry.message?.content)
                ? entry.message.content.map(c => c.text || '').join('')
                : '';
            const trimmed = content.trim();
            if (!trimmed) continue;
            // Skip alle meta-tags (local-command-*, system-reminder, bash-input, etc)
            if (trimmed.startsWith('<')) continue;
            // Skip slash commands
            if (/^\//.test(trimmed)) continue;
            autoTitle = trimmed.slice(0, 80).replace(/\n/g, ' ');
            break outer;
          } catch {}
        }
      }
    } catch {}
    if (!autoTitle) autoTitle = `Sessie ${sessionId.slice(0, 8)} op ${branch}`;

    // recent plans
    let plans = [];
    try {
      const cutoff = Date.now() - 30 * 60 * 1000;
      plans = fs.readdirSync(PLANS_DIR)
        .filter(f => f.endsWith('.md') && fs.statSync(path.join(PLANS_DIR, f)).mtimeMs > cutoff)
        .sort((a, b) => fs.statSync(path.join(PLANS_DIR, b)).mtimeMs - fs.statSync(path.join(PLANS_DIR, a)).mtimeMs)
        .map(f => f.replace(/\.md$/, ''));
    } catch {}

    const currentName = getSessionName(sessionId);
    console.log(JSON.stringify({ existing, autoTitle, plans, currentName }));
    break;
  }

  // Verrijk de actieve sessietaak met huidige branch, plan-slug en PR.
  // Schrijft alleen als de bestaande waarde leeg is óf --force is meegegeven.
  case 'session-update': {
    const sessionId = argVal('--session');
    const branch = argVal('--branch');
    const cwd = argVal('--cwd');
    const planArg = argVal('--plan');  // expliciete override; lege string blijft leeg
    const force = args.includes('--force');
    if (!sessionId) {
      console.error('Sessie-id ontbreekt (--session)');
      process.exit(1);
    }
    const todos = readTodos();
    // Pak de meest recente niet-afgeronde taak voor deze sessie; als alleen done bestaat: die.
    const all = todos.filter(t => t.sessionId === sessionId);
    if (!all.length) { console.log('NOT_FOUND'); process.exit(2); }
    const active = all.filter(t => t.status !== 'done');
    const task = (active.length ? active : all)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];

    const updates = [];
    const setField = (field, value) => {
      if (!value) return;
      if (force || !task[field]) {
        if (task[field] === value) return;
        task[field] = value;
        updates.push(`${field}=${value}`);
      }
    };
    setField('gitBranch', branch);
    setField('cwd', cwd);

    // Plan: --plan "" expliciet betekent "leeg laten / niet aanraken"; zonder flag autodetect
    if (planArg) {
      setField('planSlug', planArg);
    } else if (force || !task.planSlug) {
      try {
        const cutoff = Date.now() - 30 * 60 * 1000;
        const plans = fs.readdirSync(PLANS_DIR)
          .filter(f => f.endsWith('.md') && fs.statSync(path.join(PLANS_DIR, f)).mtimeMs > cutoff)
          .sort((a, b) => fs.statSync(path.join(PLANS_DIR, b)).mtimeMs - fs.statSync(path.join(PLANS_DIR, a)).mtimeMs);
        if (plans.length === 1) setField('planSlug', plans[0].replace(/\.md$/, ''));
      } catch {}
    }

    // PR: detect via gh als we branch+cwd hebben en (force of nog leeg)
    const effBranch = task.gitBranch;
    const effCwd = task.cwd;
    if (effBranch && effCwd && (force || !task.prUrl)) {
      const url = detectPrUrl(effBranch, effCwd);
      if (url && url !== task.prUrl) {
        task.prUrl = url;
        updates.push(`prUrl=${url}`);
      }
    }

    writeTodos(todos);
    if (!updates.length) console.log(`Geen wijzigingen voor: ${task.title}`);
    else console.log(`Bijgewerkt (${task.id} — ${task.title}): ${updates.join(', ')}`);
    break;
  }

  case 'session-add': {
    const flagStart = args.findIndex(a => a.startsWith('--'));
    const title = (flagStart > -1 ? args.slice(0, flagStart) : args).join(' ');
    const sessionId = argVal('--session');
    const branch = argVal('--branch');
    const cwd = argVal('--cwd');
    const ts = nowIso();
    const task = {
      id: genId(), title,
      status: 'in_progress',
      createdAt: ts, startedAt: ts, completedAt: null,
      sessionId,
      sessionTitle: title,
      gitBranch: branch,
      cwd,
      planSlug: argVal('--plan'),
      prUrl: detectPrUrl(branch, cwd),
      notes: [{ timestamp: ts, text: 'Aangemaakt vanuit lopende sessie.' }],
    };
    const todos = readTodos();
    todos.push(task);
    writeTodos(todos);
    setSessionName(sessionId, title);
    console.log(`Sessie toegevoegd als taak: \`${task.id}\` — ${title}`);
    break;
  }

  case 'session-done': {
    const sessionId = argVal('--session');
    const todos = readTodos();
    const matches = todos.filter(t => t.sessionId === sessionId && t.status !== 'done');
    const fallbackTitle = argVal('--title');

    if (matches.length === 0) {
      if (fallbackTitle) {
        // Auto-create a done task with provided title
        const ts = nowIso();
        const task = {
          id: genId(), title: fallbackTitle,
          status: 'done',
          createdAt: ts, startedAt: ts, completedAt: ts,
          sessionId,
          sessionTitle: fallbackTitle,
          gitBranch: argVal('--branch'),
          cwd: argVal('--cwd'),
          planSlug: '',
          notes: [],
        };
        todos.push(task);
        writeTodos(todos);
        console.log(`Afgerond (nieuw): ${fallbackTitle}`);
      } else {
        console.log('NOT_FOUND');
        process.exit(2);
      }
    } else if (matches.length === 1) {
      matches[0].status = 'done';
      matches[0].completedAt = nowIso();
      writeTodos(todos);
      console.log(`Afgerond: ${matches[0].title}`);
    } else {
      console.log(JSON.stringify(matches.map(t => ({ id: t.id, label: `${t.id.slice(0,20)}  ${t.title}` }))));
      process.exit(2);
    }
    break;
  }

  case 'ids': {
    const branch = argVal('--branch');
    const todos = readTodos();
    const active = todos.filter(t => t.status !== 'done');
    const byBranch = (a, b) => (a.gitBranch === branch ? 0 : 1) - (b.gitBranch === branch ? 0 : 1);
    const byStatus = (a, b) => (a.status === 'in_progress' ? 0 : 1) - (b.status === 'in_progress' ? 0 : 1);
    active.sort((a, b) => byBranch(a, b) || byStatus(a, b));
    for (const t of active) {
      const marker = t.status === 'in_progress' ? '▶' : '○';
      const branchMark = t.gitBranch === branch ? '*' : ' ';
      console.log(`${marker} ${branchMark} ${t.id}  ${t.title.slice(0, 60)}`);
    }
    if (!active.length) console.log('(geen actieve taken)');
    break;
  }

  case 'help': {
    console.log(`SLASH COMMANDS (Tab na /todo voor picker):
  /todo                          — interactief overzicht + actie-keuze
  /todo-ui                       — open HTML frontend (http://localhost:3737)
  /todo-add <titel>              — nieuwe taak (auto branch/plan/PR-detectie)
  /todo-start <id>               — taak op "bezig" zetten
  /todo-done <id>                — taak afronden
  /todo-note <id> [tekst]        — notitie toevoegen (vraagt als leeg)
  /todo-rm <id>                  — taak verwijderen (bevestiging bij actief)
  /todo-edit <id> <titel>        — taaknaam aanpassen
  /todo-due <id> <YYYY-MM-DD>    — deadline zetten ("clear" om te verwijderen)
  /todo-session                  — huidige Claude sessie als taak toevoegen
  /todo-session-update           — bestaande sessietaak verrijken met branch/plan/PR
  /todo-session-done             — taak van huidige sessie afronden
  /todo-ids                      — compacte ID-lijst (▶ bezig, ○ open, * huidige branch)

DIRECT SCRIPT (node ~/.claude/todo-data/todo.js <cmd>):
  list --branch <x>              — volledige 3-secties overzicht
  menu-data --branch <x>         — JSON overview+acties voor interactieve menu
  ids --branch <x>               — compacte ID-lijst
  session-prepare <id>           — JSON: existing + autoTitle + plans
  session-add/session-done       — sessie-gekoppelde acties
  refresh-pr <id>                — PR-URL opnieuw detecteren via gh
  detect-plan                    — JSON array van recent-gewijzigde plan-slugs

ID-matching: prefix of suffix volstaat, bv. "t_2026" of de 5-char suffix.
Data: ~/.claude/todo-data/todos.json (globaal, gedeeld tussen alle sessies).
UI:   http://localhost:3737 (start via /todo-ui).`);
    break;
  }

  default:
    console.error(`Onbekend commando: ${cmd}`);
    process.exit(1);
}
