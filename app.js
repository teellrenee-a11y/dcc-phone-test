'use strict';
/* Module 1 phone test. All answers stay in this phone's localStorage until the user sends or downloads them.
   No server, no network calls, no trackers. */
const KEY = 'm1phone.v1';
const RENEE = 'teellrenee@gmail.com';
const SUBJECT = 'Module 1 phone test results';
const MAILTO_MAX = 50000; // encoded body length; iPhone Mail and Gmail open links this long
const SPEC = window.SPEC, GUIDE = window.GUIDE;
const FINISH = { id: 'finish', title: 'Review and send', blocks: [] };
const SCREENS = SPEC.concat([FINISH]);

let st = load();
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch (e) { return fresh(); } }
function fresh() { return { v: 1, a: {}, screen: 0, started: null, updated: null }; }
function save() {
  st.updated = new Date().toISOString();
  if (!st.started) st.started = st.updated;
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { toast('Could not save on this phone'); }
}

function get(k) { return st.a[k]; }
function set(k, v) { if (v === '' || v == null || v === false) delete st.a[k]; else st.a[k] = v; save(); }

/* ---------- branching ---------- */
const START = 's1t1';
const WHO = ['One parent', 'Both parents', 'Another relative (aunt, uncle, grandparent)', 'Someone else (friend, person you care for)'];
function whoFor() {
  const a = st.a;
  if (a.who) return a.who;
  const legacy = a[START + 'r0.p1.0'];
  return legacy === 'One parent' ? WHO[0] : legacy === 'Both parents' ? WHO[1] : '';
}
function isParent() { const w = whoFor(); return w === WHO[0] || w === WHO[1] || w === ''; }
function isOther() { return !isParent(); }
function flags() {
  const a = st.a, w = whoFor();
  if (isOther()) {
    const m = a.pmarried;
    return { who: w || '(not chosen)', both: m === 'Yes', spouse: m === 'Yes', living: 'Yes', married: m === 'Yes' ? 'Yes' : (m || 'No'), household: 'Yes' };
  }
  return {
    who: w || '(not chosen)',
    both: w === WHO[1],
    spouse: false,
    living: a[START + 'r1.p1.0'],
    married: a[START + 'r2.p1.0'],
    household: a[START + 'r3.p1.0'],
  };
}
function names() {
  const a = st.a, n1 = (a.name1 || a['s2t1r0.p1.0'] || '').trim(), n2 = (a.name2 || a['s2t1r0.p2.0'] || '').trim();
  if (isOther()) return [n1 || 'this person', n2 || 'their spouse'];
  if (whoFor() === WHO[0]) return [n1 || 'this person', n2 || 'Parent 2'];
  return [n1 || 'Parent 1', n2 || 'Parent 2'];
}
function cap(x) { return x.charAt(0).toUpperCase() + x.slice(1); }
function esc(x) { return String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
/* Personalize built-in wording: Parent 1/2 become the names; for non-parents, parent wording becomes neutral. */
function pz(t, html) {
  if (!t) return t;
  let [n1, n2] = names();
  if (html) { n1 = esc(n1); n2 = esc(n2); }
  t = t.replace(/Parent 1: ________/g, n1).replace(/Parent 2: ________/g, n2)
       .replace(/Parent 1/g, n1).replace(/Parent 2/g, n2);
  if (isOther()) {
    const pairs = [[/your parent or parents don't/gi, 'this person doesn\'t'], [/the parent's/g, 'this person\'s'], [/the parent has/g, 'this person has'], [/the parent will/g, 'this person will'], [/your parent or parents/gi, 'this person'], [/My parent or parents were/g, 'The person (or couple) was'], [/each parent's name/g, 'each name'],
      [/your parents/gi, 'this person'], [/each parent/g, 'each person'], [/this parent/g, 'this person'], [/which parent/g, 'which person'],
      [/one or both parents/g, 'one person or a couple'], [/for one parent; allow more for two/g, 'for one person; allow more for a couple'],
      [/both parents at once/g, 'both spouses at once'], [/Both parents living/g, 'Both spouses living'], [/doing one parent/g, 'doing one person'],
      [/the parents/g, 'this person'], [/living parents?/g, 'living person'], [/parents/g, 'people'], [/parent/g, 'person']];
    for (const [a, b] of pairs) t = t.replace(a, b);
  }
  return t;
}
function showCouples() { const f = flags(); if (f.spouse) return true; return f.both && f.married !== 'No' && f.married !== 'Divorced/separated'; }
function showShort(row) {
  const f = flags();
  if (!row.short || !f.both) return false;
  if (/^Joint/.test(row.short)) return f.married !== 'No' && f.married !== 'Divorced/separated';
  return true;
}
function rowVisible(row) {
  if (row.id === START + 'r0') return false; // replaced by "Who are you planning for?"
  if (row.id.startsWith(START)) return flags().both && isParent();
  return !row.couples || showCouples();
}
function partVisible(row, part, i) {
  // "Parent 2 state" on the Start screen is hidden when only one parent is selected
  if (!flags().both && /^Parent 2/.test(part.label)) return false;
  return true;
}

/* ---------- safety warning ---------- */
const WARN = "Please don't enter account numbers or passwords.";
function risky(text, phoneish) {
  if (!text) return false;
  const digits = text.match(/\d+/g) || [];
  if (!phoneish && digits.some(d => d.length >= 8)) return true;
  // grouped numbers like 1234 5678 9012 or 1234-5678
  const grouped = (text.match(/(?:\d[\s-]?){8,}/g) || []).map(s => s.replace(/\D/g, ''));
  if (grouped.some(d => d.length >= (phoneish ? 12 : 8))) return true;
  return /\b(password|passwd|pin|pins|pin#|pin number)\b/i.test(text);
}

/* ---------- DOM helpers ---------- */
function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'html') e.innerHTML = v; else if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== null && v !== undefined) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1600); }

/* Display-only wording for saved option values (values stay the same so saved answers keep working). */
const CHIP_LABEL = { 'Has their own': 'Has a separate one', "Only if a doctor says they can't manage": "Only if a doctor says this parent can't manage" };
function chips(key, opts) {
  const box = el('div', { class: 'chips', role: 'group' });
  opts.forEach(o => {
    const b = el('button', { type: 'button', class: 'chip' + (/^(Unsure|\?)$/.test(o) ? ' unsure' : ''), 'aria-pressed': String(get(key) === o),
      onclick: () => { set(key, get(key) === o ? '' : o); [...box.children].forEach(c => c.setAttribute('aria-pressed', String(get(key) === c.dataset.v))); } }, o === '?' ? '? (Unsure)' : (CHIP_LABEL[o] ? pz(CHIP_LABEL[o]) : o));
    b.dataset.v = o; box.append(b);
  });
  return box;
}
function textInput(key, label, opts = {}) {
  const phoneish = /phone/i.test(label) || /phone/i.test(opts.rowLabel || '') && !/device/i.test(opts.rowLabel || '');
  const multi = opts.multi;
  const inp = el(multi ? 'textarea' : 'input', { type: multi ? null : (/^Phone$/.test(label) ? 'tel' : 'text'), 'aria-label': label || opts.rowLabel || 'Answer',
    autocomplete: 'off', autocapitalize: 'sentences', spellcheck: 'true', placeholder: opts.ph || 'Type here, or tap Unsure' });
  const isDate = /^Date of this sitting$/i.test(label || '');
  if (isDate) {
    inp.setAttribute('type', 'date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(get(key) || '')) { const d = new Date(); set(key, `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); }
  }
  inp.value = get(key) || '';
  const w = el('div', { class: 'warn', role: 'alert', hidden: '' }, WARN + ' Write Have or Don\'t have instead.');
  const check = () => { w.hidden = isDate || !risky(inp.value, phoneish); };
  inp.addEventListener('input', () => { set(key, inp.value); check(); });
  check();
  const u = key + '.u';
  const ub = el('button', { type: 'button', class: 'chip unsure', 'aria-pressed': String(!!get(u)),
    onclick: () => { set(u, !get(u)); ub.setAttribute('aria-pressed', String(!!get(u))); } }, 'Unsure');
  return el('div', { class: 'part' }, label ? el('div', { class: 'plabel' }, label) : null, el('div', { class: 'textrow' }, inp, ub), w);
}
function partsUI(row, who, parts) {
  return parts.map((p, i) => {
    if (!partVisible(row, p, i)) return null;
    const key = `${row.id}.${who}.${i}`;
    if (p.t === 'choice') return el('div', { class: 'part' }, p.label ? el('div', { class: 'plabel' }, pz(p.label)) : null, chips(key, p.opts));
    return textInput(key, pz(p.label), { rowLabel: row.plain, multi: /describe|Anything|Where any|Other emails/.test(row.plain) });
  });
}
function add(node, ...kids) { node.append(...kids.filter(k => k != null)); return node; }
function rowCard(row, two) {
  const [n1, n2] = names(), f = flags();
  const card = el('div', { class: 'card' }, el('div', { class: 'q', html: pz(row.label, true) }));
  if (!two) { add(card, ...partsUI(row, 'p1', row.p1)); return card; }
  add(card, f.both ? el('div', { class: 'who' }, cap(n1)) : null, ...partsUI(row, 'p1', row.p1));
  if (!f.both) return card;
  card.append(el('div', { class: 'who p2' }, cap(n2)));
  const p2box = add(el('div', {}), ...partsUI(row, 'p2', row.p2 || []));
  if (showShort(row)) {
    const k = row.id + '.p2.short';
    const note = el('div', { class: 'shortnote' });
    const sb = el('button', { type: 'button', class: 'chip short', 'aria-pressed': String(!!get(k)) }, pz(row.short));
    const sync = () => { const on = !!get(k); sb.setAttribute('aria-pressed', String(on)); p2box.hidden = on || !(row.p2 || []).length;
      note.textContent = on ? `Marked "${pz(row.short)}". Nothing to retype.` : ((row.p2 || []).length ? '' : 'Tap if the answer is the same for both.'); };
    sb.addEventListener('click', () => { set(k, !get(k)); sync(); });
    card.append(sb, note); sync();
  } else if (!(row.p2 || []).length) {
    // P2 cell is only a shortcut that is hidden (e.g. not married): give P2 the same question
    add(p2box, ...partsUI(row, 'p2', row.p1));
  }
  card.append(p2box);
  return card;
}

/* ---------- screens ---------- */
let cur = Math.min(st.screen || 0, SCREENS.length - 1);
let resumeOffered = false;
function render() {
  const s = SCREENS[cur], m = document.getElementById('screen');
  m.innerHTML = '';
  document.getElementById('progress').style.width = Math.round(cur / (SCREENS.length - 1) * 100) + '%';
  document.getElementById('steplabel').textContent = `Screen ${cur + 1} of ${SCREENS.length}`;
  m.append(el('h1', {}, s.id === 's1' ? 'Start here: who this packet covers' : pz(s.title)));
  if (cur === 0) welcomeTop(m);
  if (s === FINISH) finishScreen(m);
  if (s.id === 's1') whoTop(m);
  for (const b of s.blocks) {
    if (b.type === 'para') m.append(el('p', { class: b.cls, html: pz(b.html, true) }));
    else if (b.type === 'sub') m.append(el('h2', {}, pz(b.text)));
    else if (b.type === 'guide') m.append(el('p', { class: 'self', html: pz(b.html, true) }), ...b.refs.map(r => el('button', { type: 'button', class: 'guidelink', onclick: () => openGuide(r) }, 'See guide ' + r + ' \u2197')));
    else if (b.type === 'field') m.append(el('div', { class: 'card' }, textInput(b.id, b.label, { multi: b.multi, ph: 'Type here, or tap Unsure' })));
    else if (b.type === 'check') {
      const k = b.id; m.append(el('div', { class: 'card' }, chips(k, ['Read', 'Unsure'])));
    } else if (b.type === 'table') for (const r of b.rows) if (rowVisible(r)) m.append(rowCard(r, b.two));
  }
  if (s.id === 's1') startNotes(m);
  m.append(el('p', { class: 'saved' }, 'Answers save on this phone automatically. You can stop any time and come back.'));
  document.getElementById('backBtn').disabled = cur === 0;
  const nb = document.getElementById('nextBtn');
  nb.hidden = s === FINISH; nb.textContent = cur === SCREENS.length - 2 ? 'Review and send' : (cur === 0 ? 'Start' : 'Next');
  st.screen = cur; save();
  window.scrollTo(0, 0);
}
function welcomeTop(m) {
  if (Object.keys(st.a).length && !resumeOffered) {
    const when = st.updated ? new Date(st.updated).toLocaleString() : '';
    m.append(el('div', { class: 'banner' }, el('p', {}, el('strong', {}, 'Welcome back. '), `Your answers are saved on this phone (last change ${when}).`),
      el('button', { type: 'button', class: 'btn primary big', id: 'resumeBtn', onclick: () => { resumeOffered = true; go(st.lastScreen || 1); } }, 'Resume where I left off'),
      el('button', { type: 'button', class: 'btn danger big', onclick: clearAll }, 'Start over (clear answers)')));
  }
  m.append(el('div', { class: 'note' }, el('p', {}, el('strong', {}, 'Private test. '),
    'Your answers stay on this phone until you choose to send them to Renee at the end. Renee will delete the results once she has reviewed them.')));
}
function whoTop(m) {
  m.append(el('div', { class: 'card', id: 'whoCard' }, el('div', { class: 'q' }, 'Who are you planning for?'), chips('who', WHO)));
  const w = whoFor();
  if (!w) return;
  const both = w === WHO[1];
  const nameBox = el('div', { class: 'card', id: 'nameCard' }, el('div', { class: 'q' }, both ? "The parents' names" : "This person's name"),
    textInput('name1', both ? 'First parent\'s name' : 'Name', { ph: 'For example, Aunt Mary' }));
  if (both) nameBox.append(textInput('name2', 'Second parent\'s name', { ph: 'Type a name' }));
  m.append(nameBox);
  if (isOther()) {
    m.append(el('div', { class: 'card', id: 'marriedCard' }, el('div', { class: 'q' }, 'Is this person married?'), chips('pmarried', ['Yes', 'No', 'Unsure'])));
    if (st.a.pmarried === 'Yes') m.append(el('div', { class: 'card' }, textInput('name2', "Spouse's name", { ph: 'Type a name' })));
  }
}
function startNotes(m) {
  const f = flags();
  if (isOther()) {
    m.append(el('p', { class: 'self' }, f.spouse ? `You'll see an area for ${names()[0]} and one for ${names()[1]} on each screen, plus a few questions for couples.` : 'Questions are for this one person. Spouse and couple questions are hidden.'));
    return;
  }
  if (!whoFor()) { m.append(el('p', { class: 'self' }, 'Choose who you are planning for to continue.')); return; }
  if (f.living === 'No') m.append(el('div', { class: 'note' }, 'This packet is for living parents. If a parent has died, tell Renee; the after-death walkthrough is the better fit for that parent. You can still continue for the living parent by choosing "One parent".'));
  m.append(el('p', { class: 'self' }, f.both ? 'You\'ll see an area for each parent on each screen.' : 'Only one parent: second-parent areas are hidden.'));
}
function go(i) {
  if (cur !== 0 || i !== 0) st.lastScreen = i;
  cur = Math.max(0, Math.min(SCREENS.length - 1, i)); render();
  document.getElementById('screen').focus({ preventScroll: true });
}
document.getElementById('backBtn').onclick = () => go(cur - 1);
document.getElementById('nextBtn').onclick = () => go(cur + 1);
// re-render the Start screen when its answers change so notes follow the choice
document.getElementById('screen').addEventListener('click', e => {
  if (SCREENS[cur].id === 's1' && e.target.classList.contains('chip') && !e.target.closest('.textrow')) { const y = window.scrollY; render(); window.scrollTo(0, y); }
});

/* ---------- guide ---------- */
function buildGuide() {
  const g = document.getElementById('guideBody');
  g.append(el('h1', {}, 'Module 1 Reference Guide'), el('p', { class: 'self' }, 'Optional reading. Information for the family, not legal or tax advice.'));
  const toc = el('div', { class: 'toc' });
  GUIDE.forEach(s => toc.append(el('a', { href: '#g' + s.id, onclick: e => { e.preventDefault(); scrollGuide(s.id); } }, s.title)));
  g.append(toc);
  GUIDE.forEach(s => { const sec = el('section', {}); sec.append(el('h2', { id: 'g' + s.id }, s.title)); const body = el('div', { html: s.html }); sec.append(body); g.append(sec); });
}
let guideFrom = 0;
function scrollGuide(id) { const t = document.getElementById('g' + id); if (t) t.scrollIntoView(); }
function openGuide(id) { guideFrom = window.scrollY; const gd = document.getElementById('guide'); gd.hidden = false; gd.scrollTop = 0; if (id) scrollGuide(id); }
document.getElementById('guideBtn').onclick = () => openGuide();
document.getElementById('guideBack').onclick = () => { document.getElementById('guide').hidden = true; window.scrollTo(0, guideFrom); };

/* ---------- summary ---------- */
function cellText(row, who) {
  const parts = who === 'p2' && !(row.p2 || []).length ? row.p1 : (row[who] || []);
  if (who === 'p2' && st.a[row.id + '.p2.short'] && showShort(row)) return pz(row.short);
  const out = [];
  parts.forEach((p, i) => {
    if (!partVisible(row, p, i)) return;
    const k = `${row.id}.${who}.${i}`; let v = st.a[k] || '';
    if (st.a[k + '.u']) v = v ? v + ' (Unsure)' : 'Unsure';
    if (v === '?') v = 'Unsure';
    if (v) out.push(p.label ? `${pz(p.label)}: ${v}` : v);
  });
  return out.join('; ') || '(blank)';
}
function collect() {
  const f = flags(), [n1, n2] = names(), secs = [];
  for (const s of SPEC) {
    const items = [];
    for (const b of s.blocks) {
      if (b.type === 'field') items.push({ q: pz(b.label), p1: (st.a[b.id] || '') + (st.a[b.id + '.u'] ? ' (Unsure)' : '') || '(blank)', single: true });
      if (b.type === 'check') items.push({ q: pz('A note for the parents (R7)'), p1: st.a[b.id] || '(blank)', single: true });
      if (b.type === 'table') for (const r of b.rows) if (rowVisible(r)) items.push(b.two && f.both ? { q: pz(r.plain), p1: cellText(r, 'p1'), p2: cellText(r, 'p2') } : { q: pz(r.plain), p1: cellText(r, 'p1'), single: !b.two });
    }
    if (s.id === 's1') {
      const [x1, x2] = [st.a.name1 || '', st.a.name2 || ''];
      items.unshift({ q: 'Who are you planning for?', p1: whoFor() || '(blank)', single: true },
        { q: 'Name', p1: x1 + (f.both && x2 ? ' and ' + x2 : '') || '(blank)', single: true });
      if (isOther()) items.splice(2, 0, { q: 'Is this person married?', p1: st.a.pmarried || '(blank)', single: true });
    }
    if (items.length) secs.push({ title: s.id === 's1' ? 'Start here: who this packet covers' : pz(s.title), items });
  }
  return { who: whoFor(), both: f.both, n1, n2, secs };
}
function wrap(t, w) { const out = []; for (const para of String(t).split('\n')) { let line = ''; for (const word of para.split(' ')) { if ((line + ' ' + word).trim().length > w) { if (line) out.push(line); line = word; while (line.length > w) { out.push(line.slice(0, w)); line = line.slice(w); } } else line = (line + ' ' + word).trim(); } out.push(line); } return out; }
function summaryText() {
  const d = collect(), W = 36, L = [];
  L.push('MODULE 1 PHONE TEST RESULTS (planning ahead)');
  L.push('Planning for: ' + (d.who || '(not chosen)'));
  L.push('Information for the family. Not a will. Not tax advice. Not legal advice.');
  L.push('Created: ' + new Date().toLocaleString() + (st.started ? '   Started: ' + new Date(st.started).toLocaleString() : ''));
  L.push(d.both ? `Names: ${d.n1}    ${d.n2}` : `Name: ${d.n1} (one person)`);
  L.push('Renee will delete these results once she has reviewed them.');
  for (const s of d.secs) {
    L.push('', '=== ' + s.title.toUpperCase() + ' ===');
    if (d.both && s.items.some(i => !i.single)) L.push(pad(d.n1.toUpperCase(), W) + ' | ' + d.n2.toUpperCase());
    for (const it of s.items) {
      L.push('', '* ' + it.q);
      if (it.single || !d.both) { wrap(it.p1, 2 * W).forEach(x => L.push('  ' + x)); continue; }
      const a = wrap(it.p1, W), b = wrap(it.p2, W);
      for (let i = 0; i < Math.max(a.length, b.length); i++) L.push(pad(a[i] || '', W) + ' | ' + (b[i] || ''));
    }
  }
  return L.join('\n') + '\n';
}
function pad(s, w) { return s + ' '.repeat(Math.max(0, w - s.length)); }
function resultsJSON() { return JSON.stringify({ format: 'm1phone.v2', planningFor: whoFor(), created: new Date().toISOString(), started: st.started, flags: flags(), names: names(), summary: collect(), raw: st.a }, null, 2); }
function scoreLines() {
  const sc = SPEC.find(s => /scorecard/i.test(s.title)); const L = [];
  for (const b of sc.blocks) { if (b.type === 'table') b.rows.forEach(r => L.push(`- ${pz(r.plain)}: ${cellText(r, 'p1')}`)); if (b.type === 'field') L.push(`- ${pz(b.label)}: ${st.a[b.id] || '(blank)'}`); }
  return L.join('\n');
}
function mailtoHref() {
  const full = summaryText();
  let body = full;
  if (encodeURIComponent(body).length > MAILTO_MAX) {
    body = `Hi Renee,\n\nPlanning for: ${whoFor() || '(not chosen)'} (${names().join(' / ')})\n\nMy Module 1 phone test answers are too long for an email link, so please see attached file (Module-1-phone-test-results.txt). I'll attach it to this email from my Downloads/Files.\n\nScorecard:\n${scoreLines()}\n`;
    while (encodeURIComponent(body).length > MAILTO_MAX) body = body.slice(0, -40);
  }
  return `mailto:${RENEE}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(body)}`;
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function finishScreen(m) {
  const d = collect();
  m.append(el('p', {}, 'Here is everything you entered. Use Back to fix anything. Then send it to Renee.'));
  const txtName = 'Module-1-phone-test-results.txt', jsonName = 'Module-1-phone-test-results.json';
  const files = () => [new File([summaryText()], txtName, { type: 'text/plain' }), new File([resultsJSON()], jsonName, { type: 'application/json' })];
  let canFiles = false;
  try { canFiles = !!(navigator.share && navigator.canShare && navigator.canShare({ files: files() })); } catch (e) { canFiles = false; }
  const fits = encodeURIComponent(summaryText()).length <= MAILTO_MAX;
  const shareText = 'Please send to ' + RENEE + '. My Module 1 answers are attached.';
  if (canFiles) {
    m.append(el('div', { class: 'note' }, 'Tap "Send my answers to Renee". Your answers are already attached. Pick Mail (or Gmail), put ' + RENEE + ' in the To line, and tap Send.'));
    m.append(el('button', { type: 'button', class: 'btn primary big', id: 'shareBtn', onclick: () => navigator.share({ title: SUBJECT, text: shareText, files: files() }).then(() => toast('Sent to the share sheet')).catch(() => {}) }, 'Send my answers to Renee'));
    m.append(el('a', { class: 'btn big', id: 'mailBtn', href: mailtoHref(), role: 'button' }, 'Or email them instead'));
  } else if (fits) {
    m.append(el('div', { class: 'note' }, 'Tap "Send my answers to Renee". An email opens with all your answers already in it. Just tap Send.'));
    m.append(el('a', { class: 'btn primary big', id: 'mailBtn', href: mailtoHref(), role: 'button' }, 'Send my answers to Renee'));
  } else {
    m.append(el('div', { class: 'note', id: 'attachNote' }, 'Your answers are too long to fit in an email by themselves. Step 1: tap "Download results file". Step 2: tap "Email to Renee" and attach that file from your Downloads or Files.'));
    m.append(el('a', { class: 'btn primary big', id: 'mailBtn', href: mailtoHref(), role: 'button' }, 'Email to Renee'));
  }
  m.append(el('button', { type: 'button', class: 'btn big', id: 'dlTxt', onclick: () => download(txtName, summaryText(), 'text/plain;charset=utf-8') }, 'Download results file (.txt)'));
  m.append(el('button', { type: 'button', class: 'btn big', id: 'dlJson', onclick: () => download(jsonName, resultsJSON(), 'application/json') }, 'Download data file (.json, for Renee)'));
  m.append(el('p', { class: 'self' }, 'Sends to ' + RENEE + '. Renee will delete the results once she has reviewed them.'));
  const t = el('table', { class: 'sumtbl', id: 'summary' });
  if (d.both) t.append(el('tr', {}, el('th', {}, cap(d.n1)), el('th', {}, cap(d.n2))));
  for (const s of d.secs) {
    t.append(el('tr', { class: 'sec' }, el('td', { colspan: d.both ? 2 : 1 }, s.title)));
    for (const it of s.items) {
      t.append(el('tr', { class: 'rowq' }, el('td', { colspan: d.both ? 2 : 1 }, it.q)));
      t.append(it.single || !d.both ? el('tr', {}, el('td', { colspan: d.both ? 2 : 1 }, it.p1)) : el('tr', {}, el('td', {}, it.p1), el('td', {}, it.p2)));
    }
  }
  m.append(el('h2', {}, 'Your answers'), t);
  m.append(el('details', {}, el('summary', {}, 'Plain-text version'), el('pre', { id: 'plaintext' }, summaryText())));
  m.append(el('h2', {}, 'After sending'), el('button', { type: 'button', class: 'btn danger big', id: 'clearBtn', onclick: clearAll }, 'Clear my answers from this phone'));
}
function clearAll() {
  if (!confirm('Clear all answers from this phone? This cannot be undone. (Download or send first if you haven\'t.)')) return;
  localStorage.removeItem(KEY); st = fresh(); resumeOffered = true; cur = 0; render(); toast('Answers cleared from this phone');
}

buildGuide();
if (Object.keys(st.a).length) cur = 0; // reopen: offer Resume on the welcome screen
render();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('sw.js').catch(() => {});
