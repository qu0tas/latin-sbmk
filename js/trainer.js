/* Тренажёр: выбор тем → изучение списков → тренировка с проверкой ответов */
(function () {
  'use strict';
  const D = window.TRAINER_DATA;
  if (!D) return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const COLS = D.columns; // 0 рус, 1 лат, 2 греч, 3 воспал. лат, 4 воспал. рус, 5 прочие
  const LS = 'sbmk-trainer-v1';
  const st = Object.assign({ lists: [], systems: [], sysCols: [1, 2, 3], reps: 3, dir: 'ru2la', feedback: 'now', hideA: false, hideB: false }, load());
  let session = null;

  function load() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(LS, JSON.stringify({ lists: st.lists, systems: st.systems, sysCols: st.sysCols, reps: st.reps, dir: st.dir, feedback: st.feedback, hideA: st.hideA, hideB: st.hideB })); } catch (e) { /* */ } }

  /* ---------- нормализация и проверка ответа ---------- */
  function variants(s) { // "haem(o); haemat" → [haemo, haem, haemat]; "a(n)" → [an, a]
    const out = new Set();
    String(s).split(/\s*;\s*|\s+или\s+/).forEach(part => {
      part = part.trim(); if (!part) return;
      out.add(part.replace(/[()]/g, ''));
      out.add(part.replace(/\([^)]*\)/g, ''));
      const m = part.match(/^(.+?)\s+\(([^)]+)\)\s*$/); if (m) out.add(m[2]); // ana (aa) → aa
    });
    return [...out].filter(Boolean);
  }
  const normLa = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/j/g, 'i').replace(/y/g, 'i').replace(/ae/g, 'e').replace(/oe/g, 'e')
    .replace(/[«»"“”'.!?]/g, '').replace(/[–—-]/g, ' ').replace(/\s*,\s*/g, ',').replace(/\s+/g, ' ').trim();
  const normRu = s => s.toLowerCase().replace(/ё/g, 'е').replace(/[«»"“”'.!?]/g, '').replace(/[–—-]/g, ' ').replace(/\s+/g, ' ').trim();
  function laAnswers(a) { // принимаем полную форму и словарную форму без грамматики
    const res = new Set();
    variants(a).forEach(v => {
      res.add(normLa(v));
      const head = v.split(/,/)[0]; res.add(normLa(head));
      if (/^[A-Za-z]+(\s+[A-Za-z]+)?$/.test(head.trim())) res.add(normLa(head));
    });
    return [...res].filter(Boolean);
  }
  function ruAnswers(b) {
    const res = new Set();
    const noPar = b.replace(/\([^)]*\)/g, ' ');
    res.add(normRu(b)); res.add(normRu(noPar)); res.add(normRu(b.replace(/[()]/g, '')));
    noPar.split(/[,;:]|\s\d\)\s?|^\d\)\s?|\s=\s?/).forEach(p => { const n = normRu(p.replace(/^\s*\d\)\s*/, '')); if (n.length > 2 && !/^(ая|ое|яя|ее|ой|ий)$/.test(n)) res.add(n); });
    // «водный, ая, ое» → «водный»
    return [...res].filter(Boolean);
  }
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    const m = []; for (let i = 0; i <= a.length; i++) { m[i] = [i]; }
    for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  }
  function check(card, input) {
    const n = card.lang === 'la' ? normLa(input) : normRu(input);
    if (!n) return { ok: false, close: false };
    const acc = card.lang === 'la' ? laAnswers(card.answer) : ruAnswers(card.answer);
    if (acc.includes(n)) return { ok: true };
    const close = acc.some(x => x.length >= 4 && lev(x, n) === 1);
    return { ok: false, close };
  }

  /* ---------- карточки ---------- */
  function buildCards() {
    const cards = [];
    st.lists.forEach(id => {
      const L = D.lists.find(l => l.id === id); if (!L) return;
      const isAbbr = /сокращ/i.test(L.labelA);
      L.items.forEach(([a, b], i) => {
        const key = id + ':' + i;
        const toLa = { key, src: L.title, q: b, qLabel: isAbbr ? 'Полная форма → сокращение' : 'Напишите по-латински', answer: a, lang: 'la', show: a };
        const toRu = { key, src: L.title, q: a, qLabel: isAbbr ? 'Напишите полную форму' : 'Напишите перевод', answer: b, lang: isAbbr ? 'la' : 'ru', show: b };
        if (isAbbr) { cards.push(toRu); return; }
        const dir = st.dir === 'mix' ? (Math.random() < 0.5 ? 'ru2la' : 'la2ru') : st.dir;
        cards.push(dir === 'ru2la' ? toLa : toRu);
      });
    });
    st.systems.forEach(id => {
      const S = D.systems.find(s => s.id === id); if (!S) return;
      S.rows.forEach((r, i) => {
        st.sysCols.forEach(c => {
          if (!r[c]) return;
          const key = id + ':' + i + ':' + c;
          const toVal = { key, src: S.title, q: r[0], qLabel: COLS[c], answer: r[c], lang: c === 4 || c === 5 ? 'ru' : 'la', show: r[c] };
          const toRu = { key, src: S.title, q: r[c], qLabel: COLS[c] + ' → русское название', answer: r[0], lang: 'ru', show: r[0] };
          const dir = st.dir === 'mix' ? (Math.random() < 0.5 ? 'ru2la' : 'la2ru') : st.dir;
          cards.push(dir === 'la2ru' && c !== 4 && c !== 5 ? toRu : toVal);
        });
      });
    });
    return cards;
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function makeDeck(cards, reps) {
    let deck = [];
    for (let r = 0; r < reps; r++) {
      const round = shuffle(cards.map(c => Object.assign({}, c)));
      if (deck.length && round.length > 1 && round[0].key === deck[deck.length - 1].key) round.push(round.shift());
      deck = deck.concat(round);
    }
    return deck;
  }

  /* ---------- экраны ---------- */
  const root = () => $('#tr-root');
  function stepBar(n) {
    const names = ['Выбор тем', 'Изучение', 'Тренировка', 'Итоги'];
    return '<ol class="tr-steps">' + names.map((s, i) => '<li class="' + (i === n ? 'on' : i < n ? 'done' : '') + '">' + (i + 1) + '. ' + s + '</li>').join('') + '</ol>';
  }
  function screenSelect() {
    session = null;
    const groups = [...new Set(D.lists.map(l => l.group))];
    let h = stepBar(0) + '<p class="lead">Отметьте темы, которые задали учить, и нажмите «Далее». Слова идут в том же порядке, что и в глоссарии.</p>';
    groups.forEach(g => {
      const ls = D.lists.filter(l => l.group === g);
      h += '<div class="tr-group"><div class="tr-gh"><h3>' + esc(g) + '</h3><button class="link tr-all" data-g="' + esc(g) + '">выбрать все / снять</button></div><div class="tr-checks">' +
        ls.map(l => '<label class="tr-check"><input type="checkbox" data-list="' + l.id + '"' + (st.lists.includes(l.id) ? ' checked' : '') + '><span>' + esc(l.title) + ' <em>' + l.items.length + '</em></span></label>').join('') + '</div></div>';
    });
    h += '<div class="tr-group"><div class="tr-gh"><h3>Системы органов</h3><button class="link tr-all" data-g="__sys">выбрать все / снять</button></div><div class="tr-checks">' +
      D.systems.map(s => '<label class="tr-check"><input type="checkbox" data-sys="' + s.id + '"' + (st.systems.includes(s.id) ? ' checked' : '') + '><span>' + esc(s.title) + ' <em>' + s.rows.length + '</em></span></label>').join('') + '</div>' +
      '<div class="tr-sub">Что спрашивать по системам: ' + [1, 2, 3, 4, 5].map(c => '<label class="tr-pill"><input type="checkbox" data-col="' + c + '"' + (st.sysCols.includes(c) ? ' checked' : '') + '> ' + esc(COLS[c]) + '</label>').join('') + '</div></div>';
    h += '<div class="tr-bar"><span id="tr-sel"></span><button class="btn" id="tr-next">Далее →</button></div>';
    root().innerHTML = h;
    const upd = () => {
      st.lists = $$('[data-list]').filter(x => x.checked).map(x => x.dataset.list);
      st.systems = $$('[data-sys]').filter(x => x.checked).map(x => x.dataset.sys);
      st.sysCols = $$('[data-col]').filter(x => x.checked).map(x => +x.dataset.col);
      save();
      const n = st.lists.reduce((s, id) => s + D.lists.find(l => l.id === id).items.length, 0) + st.systems.reduce((s, id) => s + D.systems.find(x => x.id === id).rows.length, 0);
      $('#tr-sel').textContent = (st.lists.length + st.systems.length) ? 'Выбрано: ' + (st.lists.length + st.systems.length) + ' (' + n + ' слов/строк)' : 'Ничего не выбрано';
      $('#tr-next').disabled = !(st.lists.length + st.systems.length);
    };
    $$('input[type=checkbox]', root()).forEach(x => x.onchange = upd);
    $$('.tr-all').forEach(b => b.onclick = () => {
      const boxes = b.dataset.g === '__sys' ? $$('[data-sys]') : $$('[data-list]').filter(x => D.lists.find(l => l.id === x.dataset.list).group === b.dataset.g);
      const all = boxes.every(x => x.checked); boxes.forEach(x => x.checked = !all); upd();
    });
    $('#tr-next').onclick = screenStudy;
    upd();
  }
  function cell(txt, hidden) { return '<td class="' + (hidden ? 'tr-h' : '') + '" title="' + (hidden ? 'Нажмите, чтобы подсмотреть' : '') + '">' + esc(txt || '') + '</td>'; }
  function screenStudy() {
    let h = stepBar(1) + '<div class="tr-tools"><label class="tr-pill"><input type="checkbox" id="tr-hideA"' + (st.hideA ? ' checked' : '') + '> Скрыть латинские слова</label>' +
      '<label class="tr-pill"><input type="checkbox" id="tr-hideB"' + (st.hideB ? ' checked' : '') + '> Скрыть русский перевод</label><span class="muted small">Скрытое слово можно подсмотреть, нажав на него.</span></div>';
    st.lists.forEach(id => {
      const L = D.lists.find(l => l.id === id);
      h += '<div class="tr-list"><h3>' + esc(L.title) + '</h3><table class="tr-table"><thead><tr><th>№</th><th>' + esc(L.labelA) + '</th><th>' + esc(L.labelB) + '</th></tr></thead><tbody>' +
        L.items.map(([a, b], i) => '<tr><td class="n">' + (i + 1) + '</td>' + cell(a, st.hideA).replace('<td', '<td data-k="A"') + cell(b, st.hideB).replace('<td', '<td data-k="B"') + '</tr>').join('') + '</tbody></table></div>';
    });
    st.systems.forEach(id => {
      const S = D.systems.find(s => s.id === id);
      h += '<div class="tr-list"><h3>' + esc(S.title) + '</h3><div class="tr-scroll"><table class="tr-table sys"><thead><tr><th>№</th>' + COLS.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' +
        S.rows.map((r, i) => '<tr><td class="n">' + (i + 1) + '</td>' + r.map((v, c) => { const isRu = c === 0 || c === 4 || c === 5; const hid = isRu ? st.hideB : st.hideA; return cell(v, hid && v).replace('<td', '<td data-k="' + (isRu ? 'B' : 'A') + '"'); }).join('') + '</tr>').join('') + '</tbody></table></div></div>';
    });
    h += '<div class="tr-bar"><button class="btn ghost" id="tr-back">← К выбору тем</button><button class="btn" id="tr-go">Тренировка →</button></div>';
    root().innerHTML = h;
    const apply = () => {
      st.hideA = $('#tr-hideA').checked; st.hideB = $('#tr-hideB').checked; save();
      $$('.tr-table td[data-k]').forEach(td => { const hid = td.dataset.k === 'A' ? st.hideA : st.hideB; td.classList.toggle('tr-h', hid && !!td.textContent); td.classList.remove('peek'); });
    };
    $('#tr-hideA').onchange = apply; $('#tr-hideB').onchange = apply;
    root().onclick = e => { const td = e.target.closest('td.tr-h'); if (td) td.classList.toggle('peek'); };
    $('#tr-back').onclick = screenSelect;
    $('#tr-go').onclick = screenSettings;
    window.scrollTo({ top: 0 });
  }
  function screenSettings() {
    root().onclick = null;
    const nCards = buildCards().length;
    let h = stepBar(2) + '<div class="tr-card tr-settings"><h3>Настройки тренировки</h3>' +
      '<div class="tr-row"><label for="tr-reps">Сколько раз повторить весь список</label><div class="tr-reps"><input type="range" id="tr-reps" min="1" max="20" value="' + st.reps + '"><b id="tr-reps-v">' + st.reps + '</b></div></div>' +
      '<div class="tr-row"><span>Что писать</span><div class="tr-seg">' +
      [['ru2la', 'Вижу русский — пишу латынь'], ['la2ru', 'Вижу латынь — пишу перевод'], ['mix', 'Вперемешку']].map(([v, t]) => '<label><input type="radio" name="tr-dir" value="' + v + '"' + (st.dir === v ? ' checked' : '') + '> ' + t + '</label>').join('') + '</div></div>' +
      '<div class="tr-row"><span>Проверка</span><div class="tr-seg">' +
      [['now', 'Показывать правильный ответ сразу'], ['end', 'Указать на ошибки после прохождения']].map(([v, t]) => '<label><input type="radio" name="tr-fb" value="' + v + '"' + (st.feedback === v ? ' checked' : '') + '> ' + t + '</label>').join('') + '</div></div>' +
      '<p class="muted small" id="tr-total"></p>' +
      '<p class="muted small">Латынь можно писать без грамматики: <i>aqua</i> вместо <i>aqua, ae, f</i>. Регистр, ё/е, j/i и ae/e не важны. Для перевода достаточно одного из значений.</p></div>' +
      '<div class="tr-bar"><button class="btn ghost" id="tr-back">← К спискам</button><button class="btn" id="tr-start">Начать</button></div>';
    root().innerHTML = h;
    const total = () => { $('#tr-total').textContent = 'Всего заданий: ' + nCards * st.reps + ' (' + nCards + ' × ' + st.reps + ')'; };
    $('#tr-reps').oninput = e => { st.reps = +e.target.value; $('#tr-reps-v').textContent = st.reps; total(); save(); };
    $$('[name=tr-dir]').forEach(r => r.onchange = () => { st.dir = r.value; save(); });
    $$('[name=tr-fb]').forEach(r => r.onchange = () => { st.feedback = r.value; save(); });
    $('#tr-back').onclick = screenStudy;
    $('#tr-start').onclick = () => startSession(null);
    total();
  }
  function startSession(onlyKeys) {
    let cards = buildCards();
    if (onlyKeys) cards = cards.filter(c => onlyKeys.has(c.key));
    if (!cards.length) { screenSelect(); return; }
    session = { deck: makeDeck(cards, st.reps), i: 0, log: [], feedback: st.feedback, waiting: false };
    screenQuestion();
  }
  function screenQuestion() {
    const s = session, c = s.deck[s.i];
    const ok = s.log.filter(x => x.ok).length;
    let h = stepBar(2) + '<div class="tr-prog"><div style="width:' + (100 * s.i / s.deck.length) + '%"></div></div>' +
      '<div class="tr-meta"><span>' + (s.i + 1) + ' / ' + s.deck.length + '</span>' + (s.feedback === 'now' ? '<span>верно: ' + ok + ' · ошибок: ' + (s.log.length - ok) + '</span>' : '<span>ответы проверим в конце</span>') + '</div>' +
      '<div class="tr-card tr-q"><div class="tr-src">' + esc(c.src) + '</div><div class="tr-label">' + esc(c.qLabel) + '</div><div class="tr-word">' + esc(c.q) + '</div>' +
      '<form id="tr-form" autocomplete="off"><input id="tr-in" class="tr-in ' + (c.lang === 'la' ? 'la' : '') + '" placeholder="' + (c.lang === 'la' ? 'по-латински…' : 'по-русски…') + '" autocapitalize="off" spellcheck="false">' +
      '<button class="btn" type="submit">Проверить</button></form><div id="tr-fb"></div></div>' +
      '<div class="tr-bar"><button class="btn ghost" id="tr-skip">Не знаю</button><button class="btn ghost" id="tr-stop">Закончить</button></div>';
    root().innerHTML = h;
    const inp = $('#tr-in'); inp.focus();
    $('#tr-form').onsubmit = e => { e.preventDefault(); if (s.waiting) next(); else answer(inp.value); };
    $('#tr-skip').onclick = () => { if (s.waiting) next(); else answer(''); };
    $('#tr-stop').onclick = () => { s.deck = s.deck.slice(0, s.i); screenResults(); };
  }
  function answer(val) {
    const s = session, c = s.deck[s.i];
    const r = check(c, val);
    const rec = { key: c.key, card: c, input: val.trim(), ok: r.ok };
    s.log.push(rec);
    if (s.feedback === 'end') { next(); return; }
    s.waiting = true;
    const fb = $('#tr-fb');
    fb.className = 'tr-fb ' + (r.ok ? 'good' : 'bad');
    fb.innerHTML = r.ok ? '✓ Верно! <span class="muted">' + esc(c.show) + '</span>'
      : (val.trim() ? (r.close ? '≈ Почти — проверьте написание. ' : '✗ Неверно. ') : 'Правильный ответ: ') + '<b>' + esc(c.show) + '</b>' + (val.trim() ? ' <button class="link" id="tr-accept">мой ответ тоже верный — засчитать</button>' : '');
    fb.innerHTML += '<div class="muted small">Enter — дальше</div>';
    const acc = $('#tr-accept'); if (acc) acc.onclick = () => { rec.ok = true; rec.accepted = true; next(); };
    $('#tr-in').readOnly = true; $('#tr-form button').textContent = 'Дальше →'; $('#tr-form button').focus();
  }
  function next() {
    const s = session; s.waiting = false; s.i++;
    if (s.i >= s.deck.length) screenResults(); else screenQuestion();
  }
  function screenResults() {
    const s = session; const log = s.log;
    const total = log.length, ok = log.filter(x => x.ok).length;
    const pct = total ? Math.round(100 * ok / total) : 0;
    const by = new Map();
    log.forEach(x => { const o = by.get(x.key) || { card: x.card, n: 0, bad: 0, wrong: [] }; o.n++; if (!x.ok) { o.bad++; if (x.input) o.wrong.push(x.input); } by.set(x.key, o); });
    const prob = [...by.values()].filter(o => o.bad).sort((a, b) => b.bad / b.n - a.bad / a.n || b.bad - a.bad);
    const bySrc = new Map();
    [...by.values()].forEach(o => { const t = bySrc.get(o.card.src) || { n: 0, bad: 0 }; t.n += o.n; t.bad += o.bad; bySrc.set(o.card.src, t); });
    const grade = pct >= 90 ? 'Отлично!' : pct >= 75 ? 'Хорошо' : pct >= 50 ? 'Нужно подучить' : 'Стоит повторить списки ещё раз';
    let h = stepBar(3) + '<div class="tr-card tr-res"><div class="tr-score"><b>' + pct + '%</b><span>' + ok + ' из ' + total + ' верно · ' + grade + '</span></div>';
    if (bySrc.size > 1) h += '<h4>По темам</h4><ul class="tr-srcs">' + [...bySrc.entries()].sort((a, b) => b[1].bad / b[1].n - a[1].bad / a[1].n).map(([k, v]) => '<li><span>' + esc(k) + '</span><span class="bar"><i style="width:' + Math.round(100 * (v.n - v.bad) / v.n) + '%"></i></span><b>' + Math.round(100 * (v.n - v.bad) / v.n) + '%</b></li>').join('') + '</ul>';
    if (prob.length) {
      h += '<h4>Что подучить (' + prob.length + ')</h4><table class="tr-table"><thead><tr><th>Задание</th><th>Правильно</th><th>Ваши ответы</th><th>Ошибок</th></tr></thead><tbody>' +
        prob.map(o => '<tr><td>' + esc(o.card.q) + '<div class="muted small">' + esc(o.card.qLabel) + '</div></td><td><b>' + esc(o.card.show) + '</b></td><td class="bad-ans">' + (o.wrong.length ? esc([...new Set(o.wrong)].join(', ')) : '<span class="muted">—</span>') + '</td><td>' + o.bad + ' из ' + o.n + '</td></tr>').join('') + '</tbody></table>';
    } else if (total) h += '<p class="tr-fb good">Ошибок нет — всё выучено! 🎉</p>';
    h += '</div><div class="tr-bar">' + (prob.length ? '<button class="btn" id="tr-redo">Тренировать только ошибки</button>' : '') + '<button class="btn ghost" id="tr-again">Пройти заново</button><button class="btn ghost" id="tr-sel">К выбору тем</button></div>';
    root().innerHTML = h;
    if (prob.length) $('#tr-redo').onclick = () => startSession(new Set(prob.map(o => o.card.key)));
    $('#tr-again').onclick = () => startSession(null);
    $('#tr-sel').onclick = screenSelect;
    window.scrollTo({ top: 0 });
  }

  window.Trainer = { start: () => { if (!session) screenSelect(); }, _check: check, _build: buildCards, _st: st };
  document.addEventListener('DOMContentLoaded', () => { if ($('#tr-root')) screenSelect(); });
  if (document.readyState !== 'loading' && $('#tr-root')) screenSelect();
})();
