/* Тренажёр склонений: случайные существительные выбранных склонений, ответы кнопками —
   склонение, род, окончание род. п., форма нужного падежа, определение падежа по форме. */
(function () {
  'use strict';
  const T = window.Translator, M = window.Morph, D = window.TRAINER_DATA;
  if (!T || !M) return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SP = () => window.Speech && window.Speech.ok ? window.Speech : null;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rnd = a => a[Math.floor(Math.random() * a.length)];

  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
  const DECL = {
    1: { gen: '-ae', rule: 'род. п. ед. ч. на -ae', gender: 'обычно ж. р. (м. р. — слова, обозначающие мужчин: poëta, nauta)' },
    2: { gen: '-i', rule: 'род. п. ед. ч. на -i', gender: 'м. р. на -us, -er; ср. р. на -um, -on' },
    3: { gen: '-is', rule: 'род. п. ед. ч. на -is', gender: 'м., ж. и ср. р. — род нужно запоминать по словарю' },
    4: { gen: '-us', rule: 'род. п. ед. ч. на -us', gender: 'м. р. на -us; ср. р. на -u' },
    5: { gen: '-ei', rule: 'род. п. ед. ч. на -ei', gender: 'ж. р. (кроме dies — м. р.)' }
  };
  const GEN = { m: 'м. р.', f: 'ж. р.', n: 'ср. р.' };
  const GEN_LA = { m: 'masculinum', f: 'femininum', n: 'neutrum' };
  const CASES = ['nom', 'gen', 'dat', 'acc', 'abl'];
  const CASE_LA = { nom: 'Nom.', gen: 'Gen.', dat: 'Dat.', acc: 'Acc.', abl: 'Abl.' };
  const CASE_RU = { nom: 'им. п.', gen: 'род. п.', dat: 'дат. п.', acc: 'вин. п.', abl: 'твор./предл. п.' };
  const NUM_RU = { sg: 'ед. ч.', pl: 'мн. ч.' };
  const TASKS = [
    ['decl', 'Определить склонение', 'по словарной форме: vena, -ae → I'],
    ['gender', 'Выбрать род', 'm, f или n'],
    ['gen', 'Выбрать окончание род. п.', 'vena → -ae'],
    ['form', 'Поставить в падеж', 'vena → Gen. Pl. = venarum'],
    ['case', 'Определить падеж по форме', 'venarum → Gen. Pl.']
  ];
  // окончания по склонениям (шпаргалка)
  const ENDINGS = {
    1: { sg: ['-a', '-ae', '-ae', '-am', '-a'], pl: ['-ae', '-arum', '-is', '-as', '-is'] },
    2: { sg: ['-us, -er / n: -um', '-i', '-o', '-um', '-o'], pl: ['-i / n: -a', '-orum', '-is', '-os / n: -a', '-is'] },
    3: { sg: ['разные', '-is', '-i', '-em / n = Nom.', '-e (-i)'], pl: ['-es / n: -a (-ia)', '-um (-ium)', '-ibus', '-es / n: -a (-ia)', '-ibus'] },
    4: { sg: ['-us / n: -u', '-us', '-ui / n: -u', '-um / n: -u', '-u'], pl: ['-us / n: -ua', '-uum', '-ibus', '-us / n: -ua', '-ibus'] },
    5: { sg: ['-es', '-ei', '-ei', '-em', '-e'], pl: ['-es', '-erum', '-ebus', '-es', '-ebus'] }
  };

  /* ---------- слова ---------- */
  const glossary = new Set();
  if (D) D.lists.forEach(L => { if (!/сокращ/i.test(L.labelA)) L.items.forEach(([a]) => glossary.add(M.normLa(a.split(/[,;(]/)[0]).trim())); });
  const NOUNS = T.entries.filter(e => e.info && e.info.pos === 'noun' && e.info.decl && !e.info.guessed && !e.info.plOnly && e.info.par && e.info.genFull && /^[A-Za-z]+$/.test(e.la) && !e.whole && !e.abbr)
    .map(e => ({ e, la: e.la, gr: e.gr, ru: String(e.ru).split(/[;,(]/)[0].trim(), d: e.info.decl, g: e.info.gender, par: e.info.par, gl: glossary.has(M.normLa(e.la)) }))
    .filter(x => x.ru);
  // одно слово — одна лемма (os: рот / кость — разные слова, оставляем оба)
  const genShort = x => { const g = String(x.gr).split(',')[0].trim(); return g || '-' + x.e.info.genFull; };

  /* ---------- настройки ---------- */
  const LS = 'sbmk-decl-v1';
  const st = Object.assign({ decls: [1, 2], tasks: ['decl', 'gender', 'gen'], cases: ['nom', 'gen'], nums: ['sg'], src: 'gl', count: 20 }, load());
  function load() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) { /* */ } }
  function pool() {
    let p = NOUNS.filter(x => st.decls.includes(x.d));
    if (st.src === 'gl') {
      const g = p.filter(x => x.gl);
      // если в глоссарии мало слов какого-то склонения — добавляем из словаря
      const add = st.decls.flatMap(d => g.filter(x => x.d === d).length >= 8 ? [] : shuffle(p.filter(x => x.d === d && !x.gl)).slice(0, 12));
      p = g.concat(add);
    }
    return p;
  }
  const cells = () => CASES.filter(c => st.cases.includes(c)).flatMap(c => st.nums.map(n => [c, n]));

  let host = null, navHtml = '', bind = () => {}, session = null;

  /* ---------- экран настроек ---------- */
  function renderSetup() {
    const p = pool();
    let h = navHtml + '<p class="lead">Выберите склонения и типы заданий. Сайт будет давать случайные существительные, а ответ выбирается кнопками.</p>';
    h += '<div class="tr-group"><div class="tr-gh"><h3>Склонения</h3><span class="muted small">по окончанию род. п.</span></div><div class="dc-decls">' +
      [1, 2, 3, 4, 5].map(d => '<label class="dc-d"><input type="checkbox" data-dd="' + d + '"' + (st.decls.includes(d) ? ' checked' : '') + '><b>' + ROMAN[d] + '</b><span class="la">' + DECL[d].gen + '</span><small>' + NOUNS.filter(x => x.d === d).length + ' сл.</small></label>').join('') + '</div></div>';
    h += '<div class="tr-group"><div class="tr-gh"><h3>Задания</h3></div><div class="tr-checks">' +
      TASKS.map(([k, t, ex]) => '<label class="tr-check"><input type="checkbox" data-dt="' + k + '"' + (st.tasks.includes(k) ? ' checked' : '') + '><span>' + esc(t) + '<br><small class="muted">' + esc(ex) + '</small></span></label>').join('') + '</div></div>';
    const needCases = st.tasks.includes('form') || st.tasks.includes('case');
    h += '<div class="tr-card tr-settings">' +
      (needCases ? '<div class="tr-row"><span>Падежи<br><small class="muted">для заданий с формами</small></span><div class="dc-pills">' + CASES.map(c => '<label class="tr-pill"><input type="checkbox" data-dc="' + c + '"' + (st.cases.includes(c) ? ' checked' : '') + '> ' + CASE_LA[c] + ' <small class="muted">' + CASE_RU[c] + '</small></label>').join('') +
        '</div></div><div class="tr-row"><span>Число</span><div class="dc-pills">' + ['sg', 'pl'].map(n => '<label class="tr-pill"><input type="checkbox" data-dn="' + n + '"' + (st.nums.includes(n) ? ' checked' : '') + '> ' + (n === 'sg' ? 'Singularis — ед. ч.' : 'Pluralis — мн. ч.') + '</label>').join('') + '</div></div>' : '') +
      '<div class="tr-row"><span>Слова</span><div class="tr-seg">' + [['gl', 'из глоссария и тренажёра'], ['all', 'весь словарь']].map(([v, t]) => '<label><input type="radio" name="dc-src" value="' + v + '"' + (st.src === v ? ' checked' : '') + '> ' + t + '</label>').join('') + '</div></div>' +
      '<div class="tr-row"><span>Сколько заданий</span><div class="tr-seg gr-seg">' + [10, 20, 40].map(c => '<label><input type="radio" name="dc-c" value="' + c + '"' + (st.count === c ? ' checked' : '') + '> ' + c + '</label>').join('') + '</div></div></div>';
    h += cheat();
    const okSel = st.decls.length && st.tasks.length && (!needCases || cells().length);
    h += '<div class="tr-bar"><span id="dc-sel">' + (okSel ? 'Слов: ' + p.length : 'Выберите склонение, задание' + (needCases ? ' и падеж' : '')) + '</span><button class="btn" id="dc-start"' + (okSel && p.length ? '' : ' disabled') + '>Начать</button></div>';
    host.innerHTML = h; bind();
    const re = () => { save(); renderSetup(); };
    $$('[data-dd]', host).forEach(c => c.onchange = () => { st.decls = $$('[data-dd]', host).filter(x => x.checked).map(x => +x.dataset.dd); re(); });
    $$('[data-dt]', host).forEach(c => c.onchange = () => { st.tasks = $$('[data-dt]', host).filter(x => x.checked).map(x => x.dataset.dt); re(); });
    $$('[data-dc]', host).forEach(c => c.onchange = () => { st.cases = $$('[data-dc]', host).filter(x => x.checked).map(x => x.dataset.dc); re(); });
    $$('[data-dn]', host).forEach(c => c.onchange = () => { st.nums = $$('[data-dn]', host).filter(x => x.checked).map(x => x.dataset.dn); re(); });
    $$('[name=dc-src]', host).forEach(r => r.onchange = () => { st.src = r.value; re(); });
    $$('[name=dc-c]', host).forEach(r => r.onchange = () => { st.count = +r.value; save(); });
    $('#dc-start', host).onclick = () => start();
  }
  function cheat() {
    const ds = st.decls.length ? st.decls : [1, 2, 3, 4, 5];
    return '<details class="tr-card dc-cheat"' + (session ? '' : '') + '><summary><b>Шпаргалка: окончания выбранных склонений</b></summary><div class="tr-scroll"><table class="tr-table dc-end"><thead><tr><th>Падеж</th>' + ds.map(d => '<th>' + ROMAN[d] + ' скл.</th>').join('') + '</tr></thead><tbody>' +
      ['sg', 'pl'].map(n => '<tr class="dc-sub"><td colspan="' + (ds.length + 1) + '">' + (n === 'sg' ? 'Singularis — ед. ч.' : 'Pluralis — мн. ч.') + '</td></tr>' +
        CASES.map((c, i) => '<tr><th>' + CASE_LA[c] + ' <small class="muted">' + CASE_RU[c] + '</small></th>' + ds.map(d => '<td class="la">' + esc(ENDINGS[d][n][i]) + '</td>').join('') + '</tr>').join('')).join('') +
      '</tbody></table></div><p class="muted small">Склонение определяют по окончанию <b>родительного падежа единственного числа</b> в словарной форме: ' + ds.map(d => ROMAN[d] + ' — ' + DECL[d].gen).join(', ') + '.</p></details>';
  }

  /* ---------- вопросы ---------- */
  function makeQ(x, task) {
    const forms = cells().map(([c, n]) => ({ c, n, f: (x.par[c] && x.par[c][n] || [])[0] })).filter(o => o.f);
    if (task === 'decl') return { task, x, prompt: x.la + ', ' + genShort(x), hint: 'Какое это склонение?', opts: [1, 2, 3, 4, 5].map(d => ({ v: d, t: ROMAN[d] })), ok: [x.d] };
    if (task === 'gender') return { task, x, prompt: x.la + ', ' + genShort(x), hint: 'Какого рода это слово?', opts: ['m', 'f', 'n'].map(g => ({ v: g, t: g + ' — ' + GEN[g] })), ok: [x.g] };
    if (task === 'gen') return { task, x, prompt: x.la, sub: x.g + ' (' + GEN[x.g] + ')', hint: 'Какое окончание в родительном падеже ед. ч.?', opts: [1, 2, 3, 4, 5].map(d => ({ v: d, t: DECL[d].gen })), ok: [x.d] };
    if (task === 'form') {
      if (!forms.length) return null;
      const tgt = rnd(forms);
      const all = [...new Set(CASES.flatMap(c => ['sg', 'pl'].flatMap(n => x.par[c] && x.par[c][n] || [])))].filter(f => f !== tgt.f);
      const fake = [];
      const stem = x.e.info.genFull.replace(/(ae|is|us|ei|i)$/, '');
      ['a', 'ae', 'am', 'arum', 'as', 'is', 'i', 'o', 'um', 'os', 'orum', 'em', 'es', 'ibus', 'e', 'us', 'ui', 'uum', 'ei', 'erum', 'ebus'].forEach(en => { const f = stem + en; if (f !== tgt.f && !all.includes(f)) fake.push(f); });
      const opts = shuffle(shuffle(all).slice(0, 3).concat(all.length < 3 ? shuffle(fake).slice(0, 3 - all.length) : []).concat([tgt.f])).map(f => ({ v: f, t: f }));
      const ok = forms.filter(o => o.c === tgt.c && o.n === tgt.n).map(o => o.f).concat((x.par[tgt.c][tgt.n] || []));
      return { task, x, prompt: x.la + ', ' + genShort(x) + ', ' + x.g, hint: 'Поставьте в ' + CASE_LA[tgt.c] + ' ' + (tgt.n === 'sg' ? 'Sing.' : 'Plur.') + ' — ' + CASE_RU[tgt.c] + ', ' + NUM_RU[tgt.n], opts, ok, cell: [tgt.c, tgt.n], la: true };
    }
    if (task === 'case') {
      const cs = cells(); if (cs.length < 2 || !forms.length) return null;
      const tgt = rnd(forms);
      const ok = cs.filter(([c, n]) => (x.par[c] && x.par[c][n] || []).includes(tgt.f)).map(([c, n]) => c + '.' + n);
      return { task, x, prompt: tgt.f, sub: 'от ' + x.la + ', ' + genShort(x) + ', ' + x.g, hint: 'В каком падеже и числе стоит слово?' + (ok.length > 1 ? ' (подходит несколько — выберите любой)' : ''), opts: cs.map(([c, n]) => ({ v: c + '.' + n, t: CASE_LA[c] + ' ' + (n === 'sg' ? 'Sg.' : 'Pl.'), s: CASE_RU[c] + ', ' + NUM_RU[n] })), ok, form: tgt.f, la: true };
    }
    return null;
  }
  function start(words) {
    const p = words || pool(); if (!p.length) return;
    const tasks = st.tasks.filter(t => !((t === 'form' || t === 'case') && !cells().length) && !(t === 'case' && cells().length < 2));
    if (!tasks.length) return;
    const deck = []; let src = shuffle(p.slice()), guard = 0;
    while (deck.length < (words ? Math.max(words.length, 1) : st.count) && guard++ < 500) {
      if (!src.length) src = shuffle(p.slice());
      const x = src.pop(), q = makeQ(x, words ? (words.find(w => w === x) && x._task) || rnd(tasks) : rnd(tasks));
      if (q) deck.push(q);
    }
    session = { deck, i: 0, log: [], answered: false };
    renderQ();
  }

  function renderQ() {
    const s = session, q = s.deck[s.i], ok = s.log.filter(l => l.ok).length;
    const x = q.x, say = SP();
    let h = navHtml + '<div class="tr-prog"><div style="width:' + (100 * s.i / s.deck.length) + '%"></div></div>' +
      '<div class="tr-meta"><span>' + (s.i + 1) + ' / ' + s.deck.length + '</span><span>верно: ' + ok + ' · ошибок: ' + (s.log.length - ok) + '</span></div>' +
      '<div class="tr-card tr-q dc-q"><div class="tr-label">' + esc(TASKS.find(t => t[0] === q.task)[1]) + '</div>' +
      '<div class="tr-word la">' + esc(q.prompt) + (say ? ' ' + say.btn(q.task === 'case' ? q.form : x.la, 'la') : '') + '</div>' +
      (q.sub ? '<div class="dc-sub2 la">' + esc(q.sub) + '</div>' : '') +
      '<div class="tr-src">' + esc(x.ru) + '</div>' +
      '<div class="dc-hint">' + esc(q.hint) + '</div>' +
      '<div class="dc-opts' + (q.task === 'form' || q.opts.length > 5 ? ' many' : q.opts.length === 5 ? ' five' : q.opts.length === 3 ? ' three' : '') + '">' + q.opts.map((o, i) => '<button class="dc-opt' + (q.la && q.task === 'form' ? ' la' : '') + '" data-i="' + i + '"><span>' + esc(o.t) + '</span>' + (o.s ? '<small>' + esc(o.s) + '</small>' : '') + '</button>').join('') + '</div>' +
      '<div id="dc-fb"></div></div>' +
      '<div class="tr-bar"><button class="btn ghost" id="dc-stop">Закончить</button></div>';
    host.innerHTML = h; bind();
    $$('.dc-opt', host).forEach(b => b.onclick = () => answer(+b.dataset.i));
    $('#dc-stop', host).onclick = () => { s.deck = s.deck.slice(0, s.i); renderRes(); };
  }
  function paradigm(x, mark) {
    return '<div class="tr-scroll"><table class="tr-table dc-par"><thead><tr><th></th><th>Sing. — ед. ч.</th><th>Plur. — мн. ч.</th></tr></thead><tbody>' +
      CASES.map(c => '<tr><th>' + CASE_LA[c] + ' <small class="muted">' + CASE_RU[c] + '</small></th>' + ['sg', 'pl'].map(n => { const f = (x.par[c] && x.par[c][n] || []).join(', '); return '<td class="la' + (mark && mark(c, n, f) ? ' dc-hit' : '') + '">' + esc(f) + '</td>'; }).join('') + '</tr>').join('') + '</tbody></table></div>';
  }
  function explain(q) {
    const x = q.x, d = DECL[x.d];
    const base = '<b class="la">' + esc(x.la + ', ' + genShort(x) + ', ' + x.g) + '</b> — ' + ROMAN[x.d] + ' склонение (' + d.rule + '), ' + GEN[x.g] + ' (' + GEN_LA[x.g] + ').';
    if (q.task === 'decl') return base + '<div class="muted small">Склонение узнают по окончанию родительного падежа в словаре: ' + esc(genShort(x)) + ' → ' + d.gen + ' → ' + ROMAN[x.d] + ' склонение.</div>';
    if (q.task === 'gender') return base + '<div class="muted small">' + ROMAN[x.d] + ' склонение: ' + esc(d.gender) + '.</div>';
    if (q.task === 'gen') return base + '<div class="muted small">Род. п. ед. ч.: <b class="la">' + esc(x.e.info.genFull) + '</b>.</div>';
    if (q.task === 'form') return base + paradigm(x, (c, n) => c === q.cell[0] && n === q.cell[1]);
    if (q.task === 'case') return base + paradigm(x, (c, n, f) => f.split(', ').includes(q.form) && st.cases.includes(c) && st.nums.includes(n));
    return base;
  }
  function answer(i) {
    const s = session; if (s.answered) return; s.answered = true;
    const q = s.deck[s.i], o = q.opts[i], good = q.ok.includes(o.v);
    s.log.push({ q, ok: good, pick: o.t });
    $$('.dc-opt', host).forEach((b, k) => { b.disabled = true; if (q.ok.includes(q.opts[k].v)) b.classList.add('ok'); if (k === i && !good) b.classList.add('bad'); });
    const fb = $('#dc-fb', host);
    fb.className = 'tr-fb ' + (good ? 'good' : 'bad');
    const say = SP(), form = q.task === 'form' ? q.ok[0] : q.task === 'case' ? q.form : q.x.la;
    fb.innerHTML = (good ? '✓ Верно! ' : '✗ Неверно. ') + explain(q) +
      (say ? '<div class="tr-fb-say">' + say.trHtml(form) + say.btn(form, 'la') + '</div>' : '') +
      '<button class="btn" id="dc-next">Дальше →</button><div class="muted small">Enter — дальше</div>';
    $('#dc-next', host).onclick = next; $('#dc-next', host).focus();
  }
  function next() { session.i++; session.answered = false; if (session.i >= session.deck.length) renderRes(); else renderQ(); }

  function renderRes() {
    const s = session, total = s.log.length, ok = s.log.filter(l => l.ok).length, pct = total ? Math.round(100 * ok / total) : 0;
    const bad = s.log.filter(l => !l.ok);
    let h = navHtml + '<div class="tr-card tr-res"><div class="tr-score"><b>' + pct + '%</b><span>' + ok + ' из ' + total + ' верно</span></div>';
    const by = {}; s.log.forEach(l => { const k = l.q.task; by[k] = by[k] || { n: 0, bad: 0 }; by[k].n++; if (!l.ok) by[k].bad++; });
    const byD = {}; s.log.forEach(l => { const k = l.q.x.d; byD[k] = byD[k] || { n: 0, bad: 0 }; byD[k].n++; if (!l.ok) byD[k].bad++; });
    const row = (t, v) => '<li><span>' + t + '</span><span class="' + (v.bad ? 'bad' : 'good') + '">' + (v.n - v.bad) + ' / ' + v.n + '</span></li>';
    h += '<h4>По заданиям</h4><ul class="tr-srcs">' + Object.entries(by).map(([k, v]) => row(esc(TASKS.find(t => t[0] === k)[1]), v)).join('') + '</ul>';
    if (Object.keys(byD).length > 1) h += '<h4>По склонениям</h4><ul class="tr-srcs">' + Object.entries(byD).map(([k, v]) => row(ROMAN[k] + ' склонение', v)).join('') + '</ul>';
    if (bad.length) h += '<h4>Ошибки (' + bad.length + ')</h4><div class="tr-scroll"><table class="tr-table"><thead><tr><th>Задание</th><th>Правильно</th><th>Ваш ответ</th></tr></thead><tbody>' +
      bad.map(l => { const q = l.q; return '<tr><td><span class="la">' + esc(q.prompt) + '</span><div class="muted small">' + esc(q.x.ru) + ' · ' + esc(q.hint) + '</div></td><td><b>' + esc(q.opts.filter(o => q.ok.includes(o.v)).map(o => o.t).join(' / ')) + '</b></td><td class="bad-ans">' + esc(l.pick) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    else if (total) h += '<p>Без ошибок — отлично!</p>';
    h += '</div><div class="tr-bar">' + (bad.length ? '<button class="btn" id="dc-bad">Повторить ошибки</button>' : '') + '<button class="btn ghost" id="dc-again">Ещё раз</button><button class="btn ghost" id="dc-set">Настройки</button></div>';
    host.innerHTML = h; bind();
    const rb = $('#dc-bad', host);
    if (rb) rb.onclick = () => { session = { deck: shuffle(bad.map(l => makeQ(l.q.x, l.q.task) || l.q)), i: 0, log: [], answered: false }; renderQ(); };
    $('#dc-again', host).onclick = () => start();
    $('#dc-set', host).onclick = () => { session = null; renderSetup(); };
  }

  document.addEventListener('keydown', ev => {
    if (!host || !host.isConnected || !session || !session.answered || ev.key !== 'Enter') return;
    if (host.closest('[hidden]')) return;
    ev.preventDefault(); next();
  });

  window.Decl = {
    render(el, nav, bindFn) {
      host = el; navHtml = nav; bind = bindFn || (() => {});
      if (session && session.i < session.deck.length) renderQ(); else if (session) renderRes(); else renderSetup();
    },
    NOUNS
  };
})();
