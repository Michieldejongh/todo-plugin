#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const PORT = 3737;
const DATA_FILE = process.env.TODO_DATA_FILE
  || path.join(os.homedir(), '.claude-todo', 'todos.json');

function readTodos() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return []; }
}
function writeTodos(todos) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(todos, null, 2) + '\n');
}

const HTML = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Todo</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #f5f5f4;
    --surface: #ffffff;
    --border: #e5e5e5;
    --text: #1c1917;
    --muted: #78716c;
    --accent: #1d4ed8;
    --accent-hover: #1e40af;
    --danger: #dc2626;
    --bezig: #d97706;
    --open: #6b7280;
    --done: #16a34a;
    --tag-bg: #f1f5f9;
    --edit-outline: #93c5fd;
  }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); font-size: 14px; line-height: 1.5; }

  header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 14px 24px; display: flex; align-items: center; gap: 16px; }
  header h1 { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
  header .count { font-size: 12px; color: var(--muted); }
  header button.add-btn { margin-left: auto; background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 6px 14px; font-size: 13px; font-weight: 500; cursor: pointer; }
  header button.add-btn:hover { background: var(--accent-hover); }

  .add-form { background: var(--surface); border-bottom: 1px solid var(--border); padding: 12px 24px; display: none; gap: 8px; }
  .add-form.open { display: flex; }
  .add-form input { flex: 1; border: 1px solid var(--border); border-radius: 6px; padding: 7px 10px; font-size: 14px; outline: none; }
  .add-form input:focus { border-color: var(--accent); }
  .add-form button { padding: 7px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid var(--border); background: var(--surface); }
  .add-form button.save { background: var(--accent); color: #fff; border-color: var(--accent); }
  .add-form button.save:hover { background: var(--accent-hover); }

  main { padding: 20px 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 1200px; }
  @media (max-width: 800px) { main { grid-template-columns: 1fr; } }

  .col { display: flex; flex-direction: column; gap: 8px; }
  .col-header { display: flex; align-items: center; gap: 8px; padding: 0 2px 4px; }
  .col-header h2 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .col-header .badge { font-size: 11px; background: var(--border); border-radius: 99px; padding: 1px 7px; color: var(--muted); font-weight: 500; }
  .col-bezig .col-header h2 { color: var(--bezig); }
  .col-open  .col-header h2 { color: var(--open); }
  .col-done  .col-header h2 { color: var(--done); }

  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 6px; transition: box-shadow 0.1s, opacity 0.15s; opacity: 0.55; }
  .card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.07); opacity: 1; }
  .card.hot { opacity: 1; border-color: #cbd5e1; box-shadow: 0 1px 3px rgba(29,78,216,0.08); }
  .card.hot:hover { box-shadow: 0 4px 12px rgba(29,78,216,0.12); }
  .card.dimmed { opacity: 0.45; }
  .card.dimmed:hover { opacity: 0.85; }

  /* contenteditable shared style */
  [contenteditable] { outline: none; border-radius: 3px; }
  [contenteditable]:focus { box-shadow: 0 0 0 2px var(--edit-outline); background: #f8faff; }
  [contenteditable]:empty:before { content: attr(data-placeholder); color: var(--muted); pointer-events: none; }

  .card-title { font-weight: 500; font-size: 13.5px; line-height: 1.4; word-break: break-word; padding: 1px 3px; cursor: text; }

  .card-meta { font-size: 11.5px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
  .tag { background: var(--tag-bg); border-radius: 4px; padding: 1px 6px; white-space: nowrap; cursor: text; }
  .tag-label { font-size: 10px; opacity: 0.6; margin-right: 2px; }
  .tag-add { background: transparent; border: 1px dashed var(--border); border-radius: 4px; padding: 1px 6px; font-size: 11.5px; color: var(--muted); cursor: pointer; white-space: nowrap; }
  .tag-add:hover { border-color: var(--accent); color: var(--accent); }

  .due-tag { background: var(--tag-bg); border-radius: 4px; padding: 0 6px; display: inline-flex; align-items: center; gap: 4px; }
  .due-tag input[type=date] { border: none; background: transparent; font: inherit; font-size: 11.5px; color: var(--text); padding: 1px 0; outline: none; color-scheme: light; cursor: pointer; }
  .due-tag input[type=date]:focus { box-shadow: 0 0 0 2px var(--edit-outline); border-radius: 3px; }
  .due-tag.overdue { background: #fef2f2; color: var(--danger); }
  .due-tag.overdue input[type=date] { color: var(--danger); }
  .due-tag.soon { background: #fef3c7; color: #92400e; }
  .due-tag.soon input[type=date] { color: #92400e; }
  .due-clear { cursor: pointer; opacity: 0.5; font-size: 11px; padding: 0 2px; }
  .due-clear:hover { opacity: 1; color: var(--danger); }

  .plan-open { text-decoration: none; color: var(--accent); font-size: 11px; padding: 0 4px; border-radius: 3px; margin-left: 3px; }
  .plan-open:hover { background: #eff6ff; }

  .pr-refresh { cursor: pointer; opacity: 0.5; font-size: 11px; padding: 0 4px; margin-left: 3px; border-radius: 3px; }
  .pr-refresh:hover { opacity: 1; background: #eff6ff; color: var(--accent); }

  .due-empty { padding: 1px 4px; cursor: pointer; background: transparent; border: 1px dashed var(--border); }
  .due-empty:hover { border-color: var(--accent); }
  .due-empty input[type=date] { width: 0; padding: 0; opacity: 0; position: absolute; pointer-events: none; }
  .cal-icon { font-size: 12px; line-height: 1; cursor: pointer; opacity: 0.65; }
  .due-empty:hover .cal-icon { opacity: 1; }

  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 100; }
  .modal { background: var(--surface); border-radius: 10px; padding: 20px 22px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-width: 420px; width: 90%; }
  .modal h3 { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
  .modal p { font-size: 13px; color: var(--muted); margin-bottom: 14px; word-break: break-word; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
  .modal-actions button { padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid var(--border); background: var(--surface); }
  .modal-actions button.danger { background: var(--danger); color: #fff; border-color: var(--danger); }
  .modal-actions button.danger:hover { background: #b91c1c; }

  .notes { border-top: 1px solid var(--border); padding-top: 6px; display: flex; flex-direction: column; gap: 5px; }
  .note-row { display: flex; align-items: flex-start; gap: 6px; }
  .note-date { font-size: 11px; color: var(--muted); opacity: 0.7; white-space: nowrap; padding-top: 1px; flex-shrink: 0; }
  .note-text { font-size: 12px; color: var(--muted); flex: 1; padding: 1px 3px; cursor: text; word-break: break-word; }
  .note-del { font-size: 11px; color: var(--danger); cursor: pointer; padding: 1px 4px; border-radius: 3px; flex-shrink: 0; line-height: 1.4; }
  .note-del:hover { background: #fef2f2; }
.add-note-row { display: flex; gap: 6px; margin-top: 2px; }
  .add-note-row input { flex: 1; border: 1px solid var(--border); border-radius: 5px; padding: 4px 8px; font-size: 12px; outline: none; }
  .add-note-row input:focus { border-color: var(--accent); }
  .add-note-row button { padding: 4px 10px; font-size: 12px; border-radius: 5px; border: 1px solid var(--border); cursor: pointer; background: var(--surface); }

  .card-actions { display: flex; gap: 6px; margin-top: 2px; }
  .card-actions button { font-size: 11.5px; padding: 3px 10px; border-radius: 5px; border: 1px solid var(--border); cursor: pointer; background: var(--surface); color: var(--text); flex: 1; }
  .card-actions button:hover { background: var(--bg); }
  .card-actions button.promote { border-color: var(--accent); color: var(--accent); }
  .card-actions button.promote:hover { background: #eff6ff; }
  .card-actions button.demote { color: var(--muted); }
  .card-actions button.danger { color: var(--danger); border-color: transparent; flex: none; padding: 3px 8px; }
  .card-actions button.danger:hover { background: #fef2f2; }
  .done-date { font-size: 11px; color: var(--done); font-weight: 500; }
  .empty { font-size: 12.5px; color: var(--muted); text-align: center; padding: 16px; border: 1px dashed var(--border); border-radius: 8px; }
</style>
</head>
<body>
<header>
  <h1>Todo</h1>
  <span class="count" id="count"></span>
  <button class="add-btn" onclick="toggleForm()">+ Nieuwe taak</button>
</header>
<div class="add-form" id="addForm">
  <input id="newTitle" placeholder="Taak omschrijving..." onkeydown="if(event.key==='Enter')saveNew(); if(event.key==='Escape')toggleForm();" />
  <button class="save" onclick="saveNew()">Toevoegen</button>
  <button onclick="toggleForm()">Annuleer</button>
</div>
<main>
  <div class="col col-open">
    <div class="col-header"><h2>Open</h2><span class="badge" id="cnt-open">0</span></div>
    <div id="col-open"></div>
  </div>
  <div class="col col-bezig">
    <div class="col-header"><h2>Bezig</h2><span class="badge" id="cnt-bezig">0</span></div>
    <div id="col-bezig"></div>
  </div>
  <div class="col col-done">
    <div class="col-header"><h2>Afgerond (7d)</h2><span class="badge" id="cnt-done">0</span></div>
    <div id="col-done"></div>
  </div>
</main>
<script>
const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.getDate() + ' ' + MONTHS[d.getMonth()];
}

let todos = [];

async function load(skipRender) {
  const r = await fetch('/api/todos');
  todos = await r.json();
  if (!skipRender) render();
}

async function api(method, path, body) {
  const r = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(await r.text());
  todos = await r.json();
  render();
}

// Prevent newlines in single-line contenteditable fields
function noNewline(e) {
  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  if (e.key === 'Escape') { e.target.blur(); }
}

// Save a contenteditable field on blur; revert if empty
function ceField(el, id, field, original) {
  el.dataset.original = original;
  el.addEventListener('keydown', noNewline);
  el.addEventListener('focus', () => { el.dataset.original = el.textContent.trim(); });
  el.addEventListener('blur', () => {
    const val = el.textContent.trim();
    if (val === el.dataset.original) return;  // no change
    if (!val && field === 'title') { el.textContent = el.dataset.original; return; }  // title required
    api('PATCH', '/api/todos/' + id, { [field]: val });
  });
}

function toggleForm() {
  const f = document.getElementById('addForm');
  f.classList.toggle('open');
  if (f.classList.contains('open')) document.getElementById('newTitle').focus();
}

async function saveNew() {
  const title = document.getElementById('newTitle').value.trim();
  if (!title) return;
  document.getElementById('newTitle').value = '';
  document.getElementById('addForm').classList.remove('open');
  await api('POST', '/api/todos', { title });
}

async function setStatus(id, status) { await api('PATCH', '/api/todos/' + id, { status }); }

function confirmDelete(task) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = \`
      <div class="modal" role="dialog" aria-modal="true">
        <h3>Taak verwijderen?</h3>
        <p></p>
        <div class="modal-actions">
          <button class="cancel">Annuleer</button>
          <button class="danger">Verwijder</button>
        </div>
      </div>\`;
    backdrop.querySelector('p').textContent = task.title;
    const close = (ok) => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      resolve(ok);
    };
    const onKey = e => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    backdrop.querySelector('.cancel').onclick = () => close(false);
    backdrop.querySelector('.danger').onclick = () => close(true);
    backdrop.onclick = e => { if (e.target === backdrop) close(false); };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(backdrop);
    backdrop.querySelector('.danger').focus();
  });
}

async function deleteTask(id) {
  const task = todos.find(t => t.id === id);
  if (!task) return;
  const ok = await confirmDelete(task);
  if (!ok) return;
  await api('DELETE', '/api/todos/' + id);
}

async function addNote(id, inputEl) {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';
  await api('PATCH', '/api/todos/' + id, { note: text });
}

async function deleteNote(id, idx) {
  await api('PATCH', '/api/todos/' + id, { deleteNoteIndex: idx });
}

function makeCard(t, opts = {}) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = t.id;

  // Title — contenteditable
  const titleEl = document.createElement('div');
  titleEl.className = 'card-title';
  titleEl.contentEditable = 'true';
  titleEl.setAttribute('data-placeholder', 'Taaknaam...');
  titleEl.textContent = t.title;
  ceField(titleEl, t.id, 'title', t.title);
  card.appendChild(titleEl);

  // Meta tags — editable fields
  const meta = document.createElement('div');
  meta.className = 'card-meta';

  function makeTag(labelText, field, value) {
    const wrap = document.createElement('span');
    wrap.className = 'tag';
    wrap.title = field + ': ' + (value || '(leeg)');

    const lbl = document.createElement('span');
    lbl.className = 'tag-label';
    lbl.textContent = labelText;
    wrap.appendChild(lbl);

    const val = document.createElement('span');
    val.contentEditable = 'true';
    val.setAttribute('data-placeholder', '—');
    val.textContent = value || '';
    ceField(val, t.id, field, value || '');
    wrap.appendChild(val);
    return wrap;
  }

  // Branch tag — editable + clickable PR link + refresh button
  {
    const wrap = document.createElement('span');
    wrap.className = 'tag';
    wrap.title = t.prUrl ? 'PR: ' + t.prUrl : 'Branch (klik ⟳ om PR te detecteren)';

    const lbl = document.createElement('span');
    lbl.className = 'tag-label';
    lbl.textContent = 'branch:';
    wrap.appendChild(lbl);

    const val = document.createElement('span');
    val.contentEditable = 'true';
    val.setAttribute('data-placeholder', '—');
    val.textContent = t.gitBranch || '';
    ceField(val, t.id, 'gitBranch', t.gitBranch || '');
    wrap.appendChild(val);

    if (t.prUrl) {
      const prLink = document.createElement('a');
      prLink.className = 'plan-open';
      prLink.textContent = '↗';
      prLink.href = t.prUrl;
      prLink.target = '_blank';
      prLink.rel = 'noopener';
      prLink.title = 'Open PR: ' + t.prUrl;
      wrap.appendChild(prLink);
    } else if (t.gitBranch) {
      const refresh = document.createElement('span');
      refresh.className = 'pr-refresh';
      refresh.textContent = '⟳';
      refresh.title = 'PR detecteren via gh';
      refresh.onclick = async () => {
        refresh.textContent = '…';
        try {
          const r = await fetch('/api/todos/' + t.id + '/refresh-pr', { method: 'POST' });
          if (r.ok) { todos = await r.json(); render(); }
          else refresh.textContent = '⟳';
        } catch { refresh.textContent = '⟳'; }
      };
      wrap.appendChild(refresh);
    }

    meta.appendChild(wrap);
  }

  // Plan tag — editable + clickable open icon
  {
    const wrap = document.createElement('span');
    wrap.className = 'tag';
    wrap.title = t.planSlug ? 'Klik op ↗ om plan te openen' : 'Plan-slug toevoegen';

    const lbl = document.createElement('span');
    lbl.className = 'tag-label';
    lbl.textContent = 'plan:';
    wrap.appendChild(lbl);

    const val = document.createElement('span');
    val.contentEditable = 'true';
    val.setAttribute('data-placeholder', '—');
    val.textContent = t.planSlug || '';
    ceField(val, t.id, 'planSlug', t.planSlug || '');
    wrap.appendChild(val);

    if (t.planSlug) {
      const openLink = document.createElement('a');
      openLink.className = 'plan-open';
      openLink.textContent = '↗';
      openLink.href = '#';
      openLink.title = 'Open ~/.claude/plans/' + t.planSlug + '.md';
      openLink.onclick = async (e) => {
        e.preventDefault();
        try {
          const r = await fetch('/api/open-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: t.planSlug }),
          });
          if (!r.ok) openLink.textContent = '!';
        } catch { openLink.textContent = '!'; }
      };
      wrap.appendChild(openLink);
    }

    meta.appendChild(wrap);
  }

  // Session title — editable; session id shown as tooltip
  if (t.sessionId) {
    const wrap = document.createElement('span');
    wrap.className = 'tag';
    wrap.title = 'sessionId: ' + t.sessionId;

    const lbl = document.createElement('span');
    lbl.className = 'tag-label';
    lbl.textContent = 'sessie:';
    wrap.appendChild(lbl);

    const val = document.createElement('span');
    val.contentEditable = 'true';
    val.setAttribute('data-placeholder', t.sessionId.slice(0, 7));
    val.textContent = t.sessionTitle || '';
    ceField(val, t.id, 'sessionTitle', t.sessionTitle || '');
    wrap.appendChild(val);
    meta.appendChild(wrap);
  }

  // Due date — HTML5 date picker; empty = calendar icon only
  const dueWrap = document.createElement('span');
  dueWrap.className = 'tag due-tag';
  const today = new Date(); today.setHours(0,0,0,0);

  const dueInp = document.createElement('input');
  dueInp.type = 'date';
  dueInp.value = t.dueDate || '';
  dueInp.addEventListener('change', () => {
    api('PATCH', '/api/todos/' + t.id, { dueDate: dueInp.value || null });
  });

  if (t.dueDate) {
    const dd = new Date(t.dueDate + 'T00:00:00');
    const diffDays = Math.floor((dd - today) / 86400000);
    if (diffDays < 0) dueWrap.classList.add('overdue');
    else if (diffDays <= 2) dueWrap.classList.add('soon');
    dueWrap.title = 'Uiterste datum: ' + t.dueDate;

    const dueLbl = document.createElement('span');
    dueLbl.className = 'tag-label';
    dueLbl.textContent = 'deadline:';
    dueWrap.appendChild(dueLbl);
    dueWrap.appendChild(dueInp);

    const clr = document.createElement('span');
    clr.className = 'due-clear';
    clr.textContent = '×';
    clr.title = 'Datum verwijderen';
    clr.onclick = () => api('PATCH', '/api/todos/' + t.id, { dueDate: null });
    dueWrap.appendChild(clr);
  } else {
    // Empty state: only a calendar icon that triggers the picker
    dueWrap.classList.add('due-empty');
    dueWrap.title = 'Deadline toevoegen';

    const cal = document.createElement('span');
    cal.className = 'cal-icon';
    cal.textContent = '📅';
    cal.onclick = () => {
      if (typeof dueInp.showPicker === 'function') dueInp.showPicker();
      else dueInp.focus();
    };
    dueWrap.appendChild(cal);
    dueWrap.appendChild(dueInp);
  }
  meta.appendChild(dueWrap);

  card.appendChild(meta);

  // Done date
  if (t.status === 'done' && t.completedAt) {
    const d = document.createElement('div');
    d.className = 'done-date';
    d.textContent = 'Afgerond ' + fmtDate(t.completedAt);
    card.appendChild(d);
  }

  // Notes — each note text is contenteditable, with delete button
  if (t.notes?.length) {
    const notesWrap = document.createElement('div');
    notesWrap.className = 'notes';
    t.notes.forEach((n, idx) => {
      const row = document.createElement('div');
      row.className = 'note-row';

      const dateSpan = document.createElement('span');
      dateSpan.className = 'note-date';
      dateSpan.textContent = fmtDate(n.timestamp) + ' —';
      row.appendChild(dateSpan);

      const textEl = document.createElement('span');
      textEl.className = 'note-text';
      textEl.contentEditable = 'true';
      textEl.setAttribute('data-placeholder', 'Notitie...');
      textEl.textContent = n.text;
      // notes use index-based patch
      textEl.dataset.original = n.text;
      textEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); textEl.blur(); }
        if (e.key === 'Escape') textEl.blur();
      });
      textEl.addEventListener('focus', () => { textEl.dataset.original = textEl.textContent.trim(); });
      textEl.addEventListener('blur', () => {
        const val = textEl.textContent.trim();
        if (val === textEl.dataset.original) return;
        api('PATCH', '/api/todos/' + t.id, { noteIndex: idx, noteText: val });
      });
      row.appendChild(textEl);

      if (!n.text.trim()) {
        const delBtn = document.createElement('span');
        delBtn.className = 'note-del';
        delBtn.textContent = '×';
        delBtn.title = 'Verwijder lege notitie';
        delBtn.onclick = () => deleteNote(t.id, idx);
        row.appendChild(delBtn);
      }

      notesWrap.appendChild(row);
    });
    card.appendChild(notesWrap);
  }

  // Add note input
  const noteRow = document.createElement('div');
  noteRow.className = 'add-note-row';
  const noteInp = document.createElement('input');
  noteInp.placeholder = 'Notitie toevoegen...';
  noteInp.addEventListener('keydown', e => { if (e.key === 'Enter') addNote(t.id, noteInp); });
  const noteBtn = document.createElement('button');
  noteBtn.textContent = '+';
  noteBtn.title = 'Notitie toevoegen';
  noteBtn.onclick = () => addNote(t.id, noteInp);
  noteRow.appendChild(noteInp);
  noteRow.appendChild(noteBtn);
  card.appendChild(noteRow);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  if (opts.canPromote) {
    const btn = document.createElement('button');
    btn.className = 'promote';
    btn.textContent = opts.promoteLabel;
    btn.onclick = () => setStatus(t.id, opts.promoteStatus);
    actions.appendChild(btn);
  }
  if (opts.canDemote) {
    const btn = document.createElement('button');
    btn.className = 'demote';
    btn.textContent = opts.demoteLabel;
    btn.onclick = () => setStatus(t.id, opts.demoteStatus);
    actions.appendChild(btn);
  }
  const del = document.createElement('button');
  del.className = 'danger';
  del.textContent = 'Verwijder';
  del.onclick = () => deleteTask(t.id);
  actions.appendChild(del);
  card.appendChild(actions);

  return card;
}

// Sort: earlier deadlines first; tasks without deadline go to bottom
function byDueDate(a, b) {
  const da = a.dueDate || '';
  const db = b.dueDate || '';
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return da.localeCompare(db);
}

function urgencyClass(t, col) {
  if (col === 'done') return 'dimmed';
  if (col === 'bezig') return 'hot';
  // Open: hot if deadline vandaag/morgen/verstreken (< overmorgen)
  if (col === 'open' && t.dueDate) {
    const today = new Date(); today.setHours(0,0,0,0);
    const dd = new Date(t.dueDate + 'T00:00:00');
    const diffDays = Math.floor((dd - today) / 86400000);
    if (diffDays < 2) return 'hot';
  }
  return '';  // normaal gedimmed (default .card opacity)
}

function render() {
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const bezig = todos.filter(t => t.status === 'in_progress').sort(byDueDate);
  const open  = todos.filter(t => t.status === 'pending').sort(byDueDate);
  const done  = todos.filter(t => t.status === 'done' && (t.completedAt || '') > cutoff)
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));

  document.getElementById('cnt-bezig').textContent = bezig.length;
  document.getElementById('cnt-open').textContent  = open.length;
  document.getElementById('cnt-done').textContent  = done.length;
  document.getElementById('count').textContent = (bezig.length + open.length) + ' actief';

  function fill(colId, items, opts, colKey) {
    const col = document.getElementById(colId);
    const ae = document.activeElement;
    const focusedCard = ae?.isContentEditable ? ae.closest('.card') : null;
    const focusedId = focusedCard?.dataset.id;
    col.innerHTML = '';
    items.forEach(t => {
      let card;
      if (t.id === focusedId) {
        card = focusedCard;
      } else {
        card = makeCard(t, opts);
      }
      // Reset en zet urgency-class
      card.classList.remove('hot', 'dimmed');
      const uc = urgencyClass(t, colKey);
      if (uc) card.classList.add(uc);
      col.appendChild(card);
    });
    if (!items.length) {
      const e = document.createElement('div');
      e.className = 'empty';
      e.textContent = 'Geen taken';
      col.appendChild(e);
    }
  }

  fill('col-bezig', bezig, {
    canPromote: true, promoteLabel: 'Afronden',          promoteStatus: 'done',
    canDemote:  true, demoteLabel:  'Terug naar open',   demoteStatus:  'pending',
  }, 'bezig');
  fill('col-open', open, {
    canPromote: true, promoteLabel: 'Op bezig zetten',   promoteStatus: 'in_progress',
  }, 'open');
  fill('col-done', done, {
    canDemote:  true, demoteLabel:  'Heropenen',         demoteStatus:  'pending',
  }, 'done');
}

load();
setInterval(() => { if (!document.activeElement?.isContentEditable) load(); }, 10000);
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  // Refresh PR URL for a task (calls gh pr view)
  const refreshPrMatch = url.pathname.match(/^\/api\/todos\/(.+)\/refresh-pr$/);
  if (refreshPrMatch && req.method === 'POST') {
    const id = decodeURIComponent(refreshPrMatch[1]);
    try {
      const todos = readTodos();
      const task = todos.find(t => t.id === id);
      if (!task) { res.writeHead(404); res.end('Not found'); return; }
      let prUrl = '';
      if (task.gitBranch && task.cwd) {
        try {
          prUrl = execSync(
            `gh pr view ${JSON.stringify(task.gitBranch)} --json url -q .url 2>/dev/null`,
            { cwd: task.cwd, encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }
          ).trim();
        } catch {}
      }
      task.prUrl = prUrl;
      writeTodos(todos);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(readTodos()));
    } catch (e) {
      res.writeHead(500); res.end(e.message);
    }
    return;
  }

  // Open plan file with default macOS editor
  if (url.pathname === '/api/open-plan' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { slug } = JSON.parse(body);
        if (!slug || !/^[a-zA-Z0-9_-]+$/.test(slug)) {
          res.writeHead(400); res.end('Invalid slug');
          return;
        }
        const planPath = path.join(os.homedir(), '.claude', 'plans', slug + '.md');
        if (!fs.existsSync(planPath)) {
          res.writeHead(404); res.end('Plan not found');
          return;
        }
        execSync(`open ${JSON.stringify(planPath)}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ opened: planPath }));
      } catch (e) {
        res.writeHead(500); res.end(e.message);
      }
    });
    return;
  }

  if (url.pathname === '/api/todos') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(readTodos()));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', d => body += d);
      req.on('end', () => {
        try {
          const { title } = JSON.parse(body);
          const todos = readTodos();
          const crypto = require('crypto');
          const now = new Date();
          const pad = n => String(n).padStart(2, '0');
          const date = `${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}`;
          const time = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
          const rand = crypto.randomBytes(4).toString('hex').slice(0, 5);
          const task = {
            id: `t_${date}_${time}_${rand}`,
            title, status: 'pending',
            createdAt: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
            startedAt: null, completedAt: null,
            sessionId: '', gitBranch: '', cwd: '', planSlug: '',
            notes: [],
          };
          todos.push(task);
          writeTodos(todos);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(readTodos()));
        } catch (e) {
          res.writeHead(400); res.end(e.message);
        }
      });
      return;
    }
  }

  const patchMatch = url.pathname.match(/^\/api\/todos\/(.+)$/);
  if (patchMatch) {
    const id = decodeURIComponent(patchMatch[1]);
    if (req.method === 'PATCH') {
      let body = '';
      req.on('data', d => body += d);
      req.on('end', () => {
        try {
          const patch = JSON.parse(body);
          const todos = readTodos();
          const task = todos.find(t => t.id === id);
          if (!task) { res.writeHead(404); res.end('Not found'); return; }
          const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
          if (patch.title        !== undefined) task.title        = patch.title;
          if (patch.gitBranch    !== undefined) task.gitBranch    = patch.gitBranch;
          if (patch.planSlug     !== undefined) task.planSlug     = patch.planSlug;
          if (patch.cwd          !== undefined) task.cwd          = patch.cwd;
          if (patch.sessionTitle !== undefined) task.sessionTitle = patch.sessionTitle;
          if (patch.dueDate      !== undefined) task.dueDate      = patch.dueDate || null;
          if (patch.prUrl        !== undefined) task.prUrl        = patch.prUrl || '';
          if (patch.status !== undefined) {
            task.status = patch.status;
            if (patch.status === 'in_progress' && !task.startedAt) task.startedAt = nowIso();
            if (patch.status === 'done') task.completedAt = nowIso();
            if (patch.status === 'pending') { task.startedAt = null; task.completedAt = null; }
          }
          if (patch.note !== undefined) {
            task.notes.push({ timestamp: nowIso(), text: patch.note });
          }
          if (patch.noteIndex !== undefined && patch.noteText !== undefined) {
            if (task.notes[patch.noteIndex]) task.notes[patch.noteIndex].text = patch.noteText;
          }
          if (patch.deleteNoteIndex !== undefined) {
            task.notes.splice(patch.deleteNoteIndex, 1);
          }
          writeTodos(todos);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(readTodos()));
        } catch (e) {
          res.writeHead(400); res.end(e.message);
        }
      });
      return;
    }
    if (req.method === 'DELETE') {
      const todos = readTodos();
      const idx = todos.findIndex(t => t.id === id);
      if (idx === -1) { res.writeHead(404); res.end('Not found'); return; }
      todos.splice(idx, 1);
      writeTodos(todos);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(readTodos()));
      return;
    }
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Todo UI op http://localhost:${PORT}`);
  try { execSync(`open http://localhost:${PORT}`); } catch {}
});

process.on('SIGINT', () => { console.log('\nServer gestopt.'); process.exit(0); });
