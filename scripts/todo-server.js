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

  header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 12px 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  @media (min-width: 640px) { header { padding: 14px 24px; gap: 16px; } }
  header h1 { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
  header .count { font-size: 12px; color: var(--muted); }
  header button.add-btn { background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 6px 14px; font-size: 13px; font-weight: 500; cursor: pointer; }
  header button.add-btn:hover { background: var(--accent-hover); }

  /* Search — gecentreerd in topbar met icon, shrinkbaar */
  .search-wrap { position: relative; flex: 1; max-width: 480px; margin: 0 auto; display: flex; align-items: center; }
  .search-wrap svg { position: absolute; left: 10px; width: 16px; height: 16px; color: #94a3b8; pointer-events: none; }
  .search-wrap input { width: 100%; padding: 7px 34px 7px 32px; font: inherit; font-size: 13px; color: #0f172a; background: var(--bg); border-radius: 8px; border: none; box-shadow: inset 0 0 0 1px #cbd5e1; outline: none; transition: box-shadow 0.12s; }
  .search-wrap input::placeholder { color: #94a3b8; }
  .search-wrap input:focus { box-shadow: inset 0 0 0 2px var(--accent); background: var(--surface); }
  .search-wrap .search-clear { position: absolute; right: 6px; background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 16px; line-height: 1; padding: 4px; border-radius: 4px; display: none; }
  .search-wrap .search-clear:hover { color: var(--danger); background: #fef2f2; }
  .search-wrap.has-value .search-clear { display: block; }
  @media (max-width: 640px) {
    .search-wrap { order: 3; flex-basis: 100%; max-width: none; margin: 0; }
  }

  .add-form { background: var(--surface); border-bottom: 1px solid var(--border); padding: 10px 16px; display: none; gap: 8px; flex-wrap: wrap; }
  @media (min-width: 640px) { .add-form { padding: 12px 24px; flex-wrap: nowrap; } }
  .add-form.open { display: flex; }
  .add-form input { flex: 1; border: 1px solid var(--border); border-radius: 6px; padding: 7px 10px; font-size: 14px; outline: none; }
  .add-form input:focus { border-color: var(--accent); }
  .add-form button { padding: 7px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid var(--border); background: var(--surface); }
  .add-form button.save { background: var(--accent); color: #fff; border-color: var(--accent); }
  .add-form button.save:hover { background: var(--accent-hover); }

  /* Layout — Tailwind breakpoints (sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536)
     Mobile-first: 1 kolom. md: 2 kolommen. lg: 3 kolommen. 2xl: breder centraal. */
  main {
    padding: 16px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    max-width: 1280px;
    margin: 0 auto;
  }
  @media (min-width: 640px)  { main { padding: 20px 24px; gap: 18px; } }
  @media (min-width: 768px)  { main { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (min-width: 1024px) { main { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; padding: 24px 28px; } }
  @media (min-width: 1536px) { main { max-width: 1536px; gap: 24px; padding: 28px 32px; } }

  .col { display: flex; flex-direction: column; gap: 14px; }
  .col-body { display: flex; flex-direction: column; gap: 12px; }
  .col-header { display: flex; align-items: center; gap: 10px; padding-bottom: 14px; border-bottom: 1px solid #e5e7eb; cursor: pointer; user-select: none; transition: border-color 0.15s; }
  .col-header:hover { border-color: #cbd5e1; }
  .col-header h2 { font-size: 15px; font-weight: 600; color: #0f172a; letter-spacing: -0.01em; }
  .col-header .badge {
    display: inline-flex; align-items: center;
    font-size: 11px; font-weight: 600;
    border-radius: 999px; padding: 2px 9px;
    background: #f1f5f9; color: #475569;
    box-shadow: inset 0 0 0 1px rgba(71,85,105,0.14);
    line-height: 1.3;
  }
  .col-header .caret { font-size: 11px; color: #94a3b8; transition: transform 0.15s; margin-left: 2px; }
  .col.collapsed .col-header { border-bottom-color: transparent; }
  .col.collapsed .caret { transform: rotate(-90deg); }
  .col.collapsed .col-body { display: none; }

  /* Per-kolom kleurverschillen — heading-dot voor kleur-accent */
  .col-header h2::before { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 999px; margin-right: 9px; vertical-align: 1px; }
  .col-open  .col-header h2::before { background: #64748b; }
  .col-bezig .col-header h2::before { background: var(--bezig); }
  .col-done  .col-header h2::before { background: var(--done); }
  .col-bezig .col-header .badge { background: #eff6ff; color: #1d4ed8; box-shadow: inset 0 0 0 1px rgba(29,78,216,0.16); }
  .col-done  .col-header .badge { background: #ecfdf5; color: #047857; box-shadow: inset 0 0 0 1px rgba(4,120,87,0.16); }

  /* Card — Tailwind Plus divide-y container */
  .card { background: var(--surface); border-radius: 10px; display: flex; flex-direction: column; box-shadow: 0 1px 2px rgba(15,23,42,0.05), 0 0 0 1px rgba(15,23,42,0.05); transition: box-shadow 0.15s, opacity 0.15s; opacity: 0.55; overflow: hidden; }
  .card:hover { box-shadow: 0 4px 14px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.08); opacity: 1; }
  .card.hot { opacity: 1; box-shadow: 0 1px 3px rgba(29,78,216,0.10), 0 0 0 1px rgba(29,78,216,0.18); }
  .card.hot:hover { box-shadow: 0 6px 18px rgba(29,78,216,0.15), 0 0 0 1px rgba(29,78,216,0.25); }
  .card.dimmed { opacity: 0.45; }
  .card.dimmed:hover { opacity: 0.85; }

  /* Drie secties: header (compact), body (ruim), footer (compact) — gescheiden door divide-y */
  .card-header { padding: 10px 14px; }
  .card-body { padding: 14px; display: flex; flex-direction: column; gap: 11px; }
  .card-footer { padding: 0; }
  .card-section + .card-section { border-top: 1px solid #e5e7eb; }
  @media (min-width: 640px) {
    .card-header { padding: 12px 16px; }
    .card-body { padding: 16px; gap: 12px; }
  }

  /* contenteditable shared style */
  [contenteditable] { outline: none; border-radius: 3px; }
  [contenteditable]:focus { box-shadow: 0 0 0 2px var(--edit-outline); background: #f8faff; }
  [contenteditable]:empty:before { content: attr(data-placeholder); color: var(--muted); pointer-events: none; }

  .card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .card-title { font-weight: 800; font-size: 14px; line-height: 1.4; word-break: break-word; padding: 1px 3px; cursor: text; color: #0f172a; flex: 1; min-width: 0; }

  /* Status pill (shrink-0 naast titel) */
  .status-pill { flex-shrink: 0; display: inline-flex; align-items: center; border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 600; white-space: nowrap; line-height: 1.4; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.06); }
  .status-pill.status-bezig { background: #eff6ff; color: #1d4ed8; box-shadow: inset 0 0 0 1px rgba(29,78,216,0.20); }
  .status-pill.status-open { background: #f1f5f9; color: #475569; box-shadow: inset 0 0 0 1px rgba(71,85,105,0.20); }
  .status-pill.status-urgent { background: #fef3c7; color: #92400e; box-shadow: inset 0 0 0 1px rgba(146,64,14,0.20); }
  .status-pill.status-overdue { background: #fef2f2; color: #b91c1c; box-shadow: inset 0 0 0 1px rgba(185,28,28,0.20); }
  .status-pill.status-done { background: #ecfdf5; color: #047857; box-shadow: inset 0 0 0 1px rgba(4,120,87,0.20); }

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

  @keyframes save-flash {
    0%   { background: #d1fae5; box-shadow: 0 0 0 2px #10b981; }
    60%  { background: #d1fae5; box-shadow: 0 0 0 2px #10b981; }
    100% { background: transparent; box-shadow: 0 0 0 0 transparent; }
  }
  .note-row.saved-flash { animation: save-flash 900ms ease-out; border-radius: 4px; }

  /* Notes — timeline style met verticale lijn en dots */
  .notes { padding-top: 4px; display: flex; flex-direction: column; gap: 0; }
  .note-row { position: relative; display: flex; gap: 10px; padding-bottom: 14px; }
  .note-row:last-child { padding-bottom: 0; }
  .note-row::before { content: ''; position: absolute; left: 11px; top: 0; bottom: 0; width: 1px; background: #e2e8f0; }
  .note-row:last-child::before { display: none; }
  .note-dot { position: relative; z-index: 1; flex-shrink: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: var(--surface); }
  .note-dot::after { content: ''; width: 7px; height: 7px; border-radius: 50%; background: #f1f5f9; box-shadow: 0 0 0 2px #cbd5e1; }
  .note-body { flex: 1; min-width: 0; display: flex; gap: 8px; align-items: flex-start; padding: 1px 0; }
  .note-text { font-size: 12px; color: #64748b; flex: 1; cursor: text; word-break: break-word; line-height: 1.5; padding: 1px 3px; }
  .note-date { font-size: 11px; color: #94a3b8; white-space: nowrap; flex-shrink: 0; padding-top: 1px; }
  .note-del { font-size: 11px; color: var(--danger); cursor: pointer; padding: 1px 4px; border-radius: 3px; flex-shrink: 0; line-height: 1.4; }
  .note-del:hover { background: #fef2f2; }

  /* Add-note form — textarea met inset-ring en focus-ring, knop rechtsonder */
  /* Add-note form — compact single-line; klappt uit bij focus */
  .add-note-form { position: relative; margin-top: 6px; }
  .add-note-form textarea {
    display: block; width: 100%; resize: none;
    background: transparent; color: #0f172a;
    padding: 7px 12px; font: inherit; font-size: 13px; line-height: 1.5;
    border: none; border-radius: 8px;
    box-shadow: inset 0 0 0 1px #cbd5e1; outline: none;
    height: 34px; transition: box-shadow 0.12s, height 0.15s, padding 0.15s;
    overflow: hidden;
  }
  .add-note-form textarea::placeholder { color: #94a3b8; }
  .add-note-form.expanded textarea,
  .add-note-form textarea:focus {
    box-shadow: inset 0 0 0 2px var(--accent);
    height: 72px;
    padding-bottom: 34px;
    overflow: auto;
  }
  .add-note-form .add-note-submit {
    position: absolute; right: 6px; bottom: 6px;
    border-radius: 6px; background: var(--surface); color: #0f172a;
    font-size: 12px; font-weight: 600; padding: 4px 10px;
    box-shadow: inset 0 0 0 1px #cbd5e1; cursor: pointer; border: none;
    opacity: 0; transform: translateY(4px); pointer-events: none;
    transition: opacity 0.12s, transform 0.12s;
  }
  .add-note-form.expanded .add-note-submit {
    opacity: 1; transform: translateY(0); pointer-events: auto;
  }
  .add-note-form .add-note-submit:hover { background: #f8fafc; }

  /* Card footer — compacte divided action bar */
  .card-footer { display: flex; position: relative; }
  .card-footer button { flex: 1; background: transparent; border: none; padding: 9px 6px; font-size: 12px; font-weight: 600; color: #0f172a; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
  .card-footer button:not(:last-child) { border-right: 1px solid #e5e7eb; }
  .card-footer button:hover { background: #f8fafc; }
  .card-footer button .chev { color: #94a3b8; font-size: 14px; line-height: 1; font-weight: 400; }
  .card-footer button.promote { color: var(--accent); }
  .card-footer button.promote:hover { background: #eff6ff; }
  .card-footer button.promote .chev { color: var(--accent); opacity: 0.7; }
  .card-footer button.demote { color: #64748b; }
  .card-footer button.kebab { flex: 0 0 auto; padding: 9px 12px; color: #64748b; font-size: 18px; line-height: 1; }
  .card-footer button.kebab:hover { background: #f8fafc; color: #0f172a; }
  @media (min-width: 640px) {
    .card-footer button { padding: 10px 8px; font-size: 12.5px; }
    .card-footer button.kebab { padding: 10px 14px; font-size: 18px; }
  }

  /* Kebab menu popover */
  .kebab-menu { position: absolute; right: 6px; bottom: calc(100% + 4px); background: var(--surface); border-radius: 8px; box-shadow: 0 8px 24px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.08); padding: 4px; min-width: 150px; z-index: 20; }
  .kebab-menu button { display: flex; width: 100%; align-items: center; gap: 8px; background: transparent; border: none; padding: 8px 10px; font-size: 13px; border-radius: 5px; cursor: pointer; color: #0f172a; text-align: left; }
  .kebab-menu button:hover { background: #f8fafc; }
  .kebab-menu button.danger { color: var(--danger); }
  .kebab-menu button.danger:hover { background: #fef2f2; }
  .done-date { font-size: 11px; color: var(--done); font-weight: 500; }
  .empty { font-size: 12.5px; color: var(--muted); text-align: center; padding: 16px; border: 1px dashed var(--border); border-radius: 8px; }
</style>
</head>
<body>
<header>
  <h1>Todo</h1>
  <span class="count" id="count"></span>
  <div class="search-wrap" id="searchWrap">
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clip-rule="evenodd" fill-rule="evenodd" />
    </svg>
    <input id="searchInput" type="search" placeholder="Zoek in titel, notitie, branch..." aria-label="Zoek taken" autocomplete="off" />
    <button class="search-clear" id="searchClear" aria-label="Wis zoekopdracht" type="button">×</button>
  </div>
  <button class="add-btn" onclick="toggleForm()">+ Nieuwe taak</button>
</header>
<div class="add-form" id="addForm">
  <input id="newTitle" placeholder="Taak omschrijving..." onkeydown="if(event.key==='Enter')saveNew(); if(event.key==='Escape')toggleForm();" />
  <button class="save" onclick="saveNew()">Toevoegen</button>
  <button onclick="toggleForm()">Annuleer</button>
</div>
<main>
  <div class="col col-open" data-col="open">
    <div class="col-header"><h2>Open</h2><span class="badge" id="cnt-open">0</span><span class="caret">▼</span></div>
    <div class="col-body" id="col-open"></div>
  </div>
  <div class="col col-bezig" data-col="bezig">
    <div class="col-header"><h2>Bezig</h2><span class="badge" id="cnt-bezig">0</span><span class="caret">▼</span></div>
    <div class="col-body" id="col-bezig"></div>
  </div>
  <div class="col col-done" data-col="done">
    <div class="col-header"><h2>Afgerond (7d)</h2><span class="badge" id="cnt-done">0</span><span class="caret">▼</span></div>
    <div class="col-body" id="col-done"></div>
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
// Concept-tekst per taak voor het "notitie toevoegen" veld — overleeft re-renders
const noteDrafts = {};
// { taskId, noteIndex } — de notitie die zojuist gesaved werd (voor animation)
let justSavedNote = null;
// Zoekterm — persisteert over re-renders
let searchQuery = '';

function matchesSearch(task) {
  if (!searchQuery) return true;
  const q = searchQuery.toLowerCase();
  const fields = [
    task.title, task.sessionTitle, task.gitBranch, task.planSlug,
    ...(task.notes || []).map(n => n.text),
  ];
  return fields.some(f => f && f.toLowerCase().includes(q));
}

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
  delete noteDrafts[id];

  // Optimistic update: toon de notitie direct
  const task = todos.find(t => t.id === id);
  if (task) {
    task.notes = task.notes || [];
    task.notes.push({ timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), text });
    render();
  }

  // Sync met server op de achtergrond. Pas ná bevestiging: flash-animation.
  try {
    const r = await fetch('/api/todos/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: text }),
    });
    if (r.ok) {
      todos = await r.json();
      // Markeer laatste notitie van deze taak voor flash-animation
      const savedTask = todos.find(t => t.id === id);
      if (savedTask && savedTask.notes?.length) {
        justSavedNote = { taskId: id, noteIndex: savedTask.notes.length - 1 };
        render();
        setTimeout(() => {
          if (justSavedNote && justSavedNote.taskId === id) {
            justSavedNote = null;
          }
        }, 1000);
      } else {
        render();
      }
    }
  } catch {}
}

async function deleteNote(id, idx) {
  await api('PATCH', '/api/todos/' + id, { deleteNoteIndex: idx });
}

function makeCard(t, opts = {}) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = t.id;

  // Header-sectie (titel + pill) — compactere padding dan body
  const header = document.createElement('div');
  header.className = 'card-section card-header';

  const head = document.createElement('div');
  head.className = 'card-head';

  const titleEl = document.createElement('div');
  titleEl.className = 'card-title';
  titleEl.contentEditable = 'true';
  titleEl.setAttribute('data-placeholder', 'Taaknaam...');
  titleEl.textContent = t.title;
  ceField(titleEl, t.id, 'title', t.title);
  head.appendChild(titleEl);

  // Status pill rechts van titel
  const pill = document.createElement('span');
  pill.className = 'status-pill';
  if (t.status === 'done') {
    pill.classList.add('status-done');
    pill.textContent = 'Afgerond';
  } else if (t.status === 'in_progress') {
    pill.classList.add('status-bezig');
    pill.textContent = 'Bezig';
  } else if (t.dueDate) {
    const todayPill = new Date(); todayPill.setHours(0,0,0,0);
    const ddP = new Date(t.dueDate + 'T00:00:00');
    const diffP = Math.floor((ddP - todayPill) / 86400000);
    if (diffP < 0) { pill.classList.add('status-overdue'); pill.textContent = 'Overdue'; }
    else if (diffP < 2) { pill.classList.add('status-urgent'); pill.textContent = diffP === 0 ? 'Vandaag' : 'Morgen'; }
    else { pill.classList.add('status-open'); pill.textContent = 'Open'; }
  } else {
    pill.classList.add('status-open');
    pill.textContent = 'Open';
  }
  head.appendChild(pill);
  header.appendChild(head);
  card.appendChild(header);

  // Body-sectie (meta-tags + notities + add-form)
  const body = document.createElement('div');
  body.className = 'card-section card-body';
  card.appendChild(body);

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

  body.appendChild(meta);

  // Done date (alleen subtiele indicator; status staat al in de pill)
  if (t.status === 'done' && t.completedAt) {
    const d = document.createElement('div');
    d.className = 'done-date';
    d.textContent = 'Afgerond op ' + fmtDate(t.completedAt);
    body.appendChild(d);
  }

  // Notes — timeline met dot per item
  if (t.notes?.length) {
    const notesWrap = document.createElement('div');
    notesWrap.className = 'notes';
    t.notes.forEach((n, idx) => {
      const row = document.createElement('div');
      row.className = 'note-row';
      if (justSavedNote && justSavedNote.taskId === t.id && justSavedNote.noteIndex === idx) {
        row.classList.add('saved-flash');
      }

      // Dot-marker links
      const dot = document.createElement('div');
      dot.className = 'note-dot';
      row.appendChild(dot);

      // Body: tekst + datum rechts
      const noteBody = document.createElement('div');
      noteBody.className = 'note-body';

      const textEl = document.createElement('span');
      textEl.className = 'note-text';
      textEl.contentEditable = 'true';
      textEl.setAttribute('data-placeholder', 'Notitie...');
      textEl.textContent = n.text;
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
      noteBody.appendChild(textEl);

      const dateSpan = document.createElement('time');
      dateSpan.className = 'note-date';
      dateSpan.textContent = fmtDate(n.timestamp);
      noteBody.appendChild(dateSpan);

      if (!n.text.trim()) {
        const delBtn = document.createElement('span');
        delBtn.className = 'note-del';
        delBtn.textContent = '×';
        delBtn.title = 'Verwijder lege notitie';
        delBtn.onclick = () => deleteNote(t.id, idx);
        noteBody.appendChild(delBtn);
      }

      row.appendChild(noteBody);
      notesWrap.appendChild(row);
    });
    body.appendChild(notesWrap);
  }

  // Add-note form: compact single-line, klapt uit bij klik/focus
  const addForm = document.createElement('div');
  addForm.className = 'add-note-form';
  const noteInp = document.createElement('textarea');
  noteInp.rows = 1;
  noteInp.placeholder = 'Notitie toevoegen...';
  noteInp.value = noteDrafts[t.id] || '';
  // Start uitgeklapt als er al draft-tekst is
  if (noteDrafts[t.id]) addForm.classList.add('expanded');
  noteInp.addEventListener('focus', () => addForm.classList.add('expanded'));
  noteInp.addEventListener('blur', () => {
    if (!noteInp.value.trim()) addForm.classList.remove('expanded');
  });
  noteInp.addEventListener('input', () => { noteDrafts[t.id] = noteInp.value; });
  noteInp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(t.id, noteInp); }
    if (e.key === 'Escape') { noteInp.blur(); }
  });
  const noteBtn = document.createElement('button');
  noteBtn.type = 'button';
  noteBtn.className = 'add-note-submit';
  noteBtn.textContent = 'Voeg toe';
  noteBtn.title = 'Notitie toevoegen (of Enter)';
  // mousedown voorkomt dat textarea blur voordat de klik verwerkt is
  noteBtn.addEventListener('mousedown', e => e.preventDefault());
  noteBtn.onclick = () => addNote(t.id, noteInp);
  addForm.appendChild(noteInp);
  addForm.appendChild(noteBtn);
  body.appendChild(addForm);

  // Action buttons (footer — eigen card-section voor divide-y lijn)
  const actions = document.createElement('div');
  actions.className = 'card-section card-footer';

  function makeActionBtn({ label, chevLeft, chevRight, className, onClick }) {
    const btn = document.createElement('button');
    if (className) btn.className = className;
    if (chevLeft) {
      const c = document.createElement('span');
      c.className = 'chev'; c.textContent = '‹'; btn.appendChild(c);
    }
    const txt = document.createElement('span');
    txt.textContent = label;
    btn.appendChild(txt);
    if (chevRight) {
      const c = document.createElement('span');
      c.className = 'chev'; c.textContent = '›'; btn.appendChild(c);
    }
    btn.onclick = onClick;
    return btn;
  }

  // opts.buttons = [{ label, chevLeft, chevRight, className, onClick }]
  (opts.buttons || []).forEach(b => actions.appendChild(makeActionBtn(b)));

  // Kebab altijd als laatste
  const kebab = document.createElement('button');
  kebab.className = 'kebab';
  kebab.textContent = '⋯';
  kebab.title = 'Meer acties';
  kebab.onclick = (e) => {
    e.stopPropagation();
    // Toggle menu
    const existing = actions.querySelector('.kebab-menu');
    if (existing) { existing.remove(); return; }
    const menu = document.createElement('div');
    menu.className = 'kebab-menu';
    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = 'Verwijderen';
    delBtn.onclick = () => { menu.remove(); deleteTask(t.id); };
    menu.appendChild(delBtn);
    actions.appendChild(menu);
    const close = (ev) => {
      if (!menu.contains(ev.target) && ev.target !== kebab) {
        menu.remove();
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  };
  actions.appendChild(kebab);

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
  const bezig = todos.filter(t => t.status === 'in_progress' && matchesSearch(t)).sort(byDueDate);
  const open  = todos.filter(t => t.status === 'pending' && matchesSearch(t)).sort(byDueDate);
  const done  = todos.filter(t => t.status === 'done' && (t.completedAt || '') > cutoff && matchesSearch(t))
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));

  document.getElementById('cnt-bezig').textContent = bezig.length;
  document.getElementById('cnt-open').textContent  = open.length;
  document.getElementById('cnt-done').textContent  = done.length;
  document.getElementById('count').textContent = (bezig.length + open.length) + ' actief';

  function fill(colId, items, opts, colKey) {
    const col = document.getElementById(colId);
    // Preserve kaart als EENIG element focus heeft binnen de kaart
    // (contenteditable, <input> voor notities, <input type=date>, etc.)
    const ae = document.activeElement;
    const focusedCard = ae && ae !== document.body ? ae.closest('.card') : null;
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

  // Gemeenschappelijke knop-definities per kolom. Volgorde = linker→rechts in footer.
  // (makeCard voegt de kebab automatisch als laatste toe.)
  fill('col-open', open, {
    buttons: [
      { label: 'Op bezig zetten', chevRight: true, className: 'promote',
        onClick: (ev) => { const card = ev?.currentTarget?.closest('.card'); setStatus(card?.dataset.id || '', 'in_progress'); } },
    ],
  }, 'open');

  fill('col-bezig', bezig, {
    buttons: [
      { label: 'Terug naar open', chevLeft: true, className: 'demote',
        onClick: (ev) => { const card = ev?.currentTarget?.closest('.card'); setStatus(card?.dataset.id || '', 'pending'); } },
      { label: 'Afronden', chevRight: true, className: 'promote',
        onClick: (ev) => { const card = ev?.currentTarget?.closest('.card'); setStatus(card?.dataset.id || '', 'done'); } },
    ],
  }, 'bezig');

  fill('col-done', done, {
    buttons: [
      { label: 'Heropenen', chevLeft: true, className: 'demote',
        onClick: (ev) => { const card = ev?.currentTarget?.closest('.card'); setStatus(card?.dataset.id || '', 'pending'); } },
    ],
  }, 'done');
}

// Init collapsible columns. Default: done-kolom dicht.
(function initCollapse() {
  document.querySelectorAll('.col').forEach(col => {
    const key = 'todo-col-' + col.dataset.col + '-collapsed';
    const stored = localStorage.getItem(key);
    const isCollapsed = stored === null ? col.dataset.col === 'done' : stored === '1';
    col.classList.toggle('collapsed', isCollapsed);
    col.querySelector('.col-header').addEventListener('click', () => {
      const nowCollapsed = !col.classList.contains('collapsed');
      col.classList.toggle('collapsed', nowCollapsed);
      localStorage.setItem(key, nowCollapsed ? '1' : '0');
    });
  });
})();

// Search — live filter. Bij actieve zoekopdracht klappen alle kolommen open.
(function initSearch() {
  const input = document.getElementById('searchInput');
  const wrap = document.getElementById('searchWrap');
  const clear = document.getElementById('searchClear');
  const onChange = () => {
    searchQuery = input.value.trim();
    wrap.classList.toggle('has-value', !!searchQuery);
    if (searchQuery) {
      // Forceer alle kolommen open zodat matches in Afgerond zichtbaar zijn
      document.querySelectorAll('.col').forEach(c => c.classList.remove('collapsed'));
    } else {
      // Terug naar opgeslagen voorkeur
      document.querySelectorAll('.col').forEach(col => {
        const key = 'todo-col-' + col.dataset.col + '-collapsed';
        const stored = localStorage.getItem(key);
        const isCollapsed = stored === null ? col.dataset.col === 'done' : stored === '1';
        col.classList.toggle('collapsed', isCollapsed);
      });
    }
    render();
  };
  input.addEventListener('input', onChange);
  input.addEventListener('keydown', e => { if (e.key === 'Escape') { input.value = ''; onChange(); input.blur(); } });
  clear.addEventListener('click', () => { input.value = ''; onChange(); input.focus(); });
  // Cmd/Ctrl+K focus het zoekveld
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); input.focus(); input.select(); }
  });
})();

load();
// Pauzeer auto-refresh zolang gebruiker in een veld staat te typen (binnen kaart of add-form)
setInterval(() => {
  const ae = document.activeElement;
  if (!ae || ae === document.body) return load();
  const tag = ae.tagName;
  const typingInCard = ae.closest && (ae.closest('.card') || ae.closest('.add-form') || ae.closest('.search-wrap'));
  if ((tag === 'INPUT' || tag === 'TEXTAREA' || ae.isContentEditable) && typingInCard) return;
  load();
}, 10000);
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
