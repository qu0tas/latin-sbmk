/* Системы органов: атлас (схемы + реальные объекты), таблица терминов, словообразование, устная сдача */
(function () {
  'use strict';
  const SD = window.SYSTEMS_DATA, TD = window.TRAINER_DATA;
  if (!SD) return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'sbmk-systems-v1';
  const st = Object.assign({ sys: 's1', view: 'atlas', img: 0, mode: 'study', z: 1, hints: false, oral: { atlas: true, table: true, wf: true, n: 20 } }, load());
  function load() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(LS, JSON.stringify({ sys: st.sys, view: st.view, img: st.img, mode: st.mode, hints: st.hints, oral: st.oral })); } catch (e) { /* */ } }
  const sysById = id => SD.find(s => s.id === id) || SD[0];
  const tableOf = id => TD && TD.systems ? TD.systems.find(s => s.id === id) : null;
  const SP = () => window.Speech && window.Speech.ok ? window.Speech : null;
  const sayable = a => { const t = SP() ? SP().cleanLa(a) : ''; return !!t && /^[A-Za-z ]+$/.test(t) && t.replace(/\s/g, '').length > 1; };
  const sayBtn = a => (SP() && a && a !== '—' && sayable(a.split(';')[0]) ? SP().btn(a.split(';')[0].trim(), 'la', 'sm') : '');
  const trs = a => (SP() && a && a !== '—' && sayable(a.split(';')[0]) ? '<div class="sy-trs">' + SP().trHtml(a.split(';')[0].trim()) + '</div>' : '');
  const check = (card, val) => (window.Trainer && window.Trainer._check ? window.Trainer._check(card, val) : { ok: val.trim().toLowerCase() === String(card.answer).toLowerCase() });
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const root = () => $('#sy-root');
  const KIND = { schema: 'Учебная схема', real: 'Реальный объект' };

  /* ---------- общий каркас ---------- */
  function show() { if (!root()) return; if (!root().dataset.ready) { root().dataset.ready = 1; } render(); }
  function render() {
    const S = sysById(st.sys);
    if (st.img >= S.images.length) st.img = 0;
    let h = '<div class="sy-head"><div class="sy-sys" role="tablist">' + SD.map(s => '<button class="sy-chip' + (s.id === S.id ? ' on' : '') + '" data-sys="' + s.id + '"><span aria-hidden="true">' + s.icon + '</span>' + esc(s.title) + '</button>').join('') + '</div>' +
      '<div class="sy-views" role="tablist">' + [['atlas', 'Атлас'], ['table', 'Таблица'], ['wf', 'Словообразование'], ['oral', 'Устная сдача']].map(([v, t]) => '<button class="sy-vt' + (st.view === v ? ' on' : '') + '" data-view="' + v + '">' + t + '</button>').join('') + '</div></div>' +
      '<div id="sy-body"></div>';
    root().innerHTML = h;
    $$('[data-sys]', root()).forEach(b => b.onclick = () => { st.sys = b.dataset.sys; st.img = 0; save(); oral = null; render(); });
    $$('[data-view]', root()).forEach(b => b.onclick = () => { st.view = b.dataset.view; save(); render(); });
    const ch = $('.sy-chip.on', root()), bar = $('.sy-sys', root()); if (ch && bar) bar.scrollLeft = ch.offsetLeft - bar.offsetLeft - 20;
    ({ atlas: renderAtlas, table: renderTable, wf: renderWF, oral: renderOral })[st.view]();
  }

  /* ---------- атлас ---------- */
  let sel = null, answers = {}, findT = null, findScore = { ok: 0, n: 0 };
  function stageHtml(I, opt) {
    // opt: { masks: bool, pts: 'dots'|'nums'|'none'|'one', one: idx, cls }
    const ar = I.w / I.h;
    let h = '<div class="sy-stage' + (opt.cls ? ' ' + opt.cls : '') + '" style="--ar:' + ar.toFixed(4) + ';--z:' + (opt.z || 1) + '">' +
      '<img src="' + I.src + '" alt="' + esc(I.title) + '" draggable="false" width="' + I.w + '" height="' + I.h + '">' +
      '<div class="sy-dim"></div>';
    if (opt.masks) {
      I.masks.forEach(m => { h += '<div class="sy-mask big" style="left:' + m[0] + '%;top:' + m[1] + '%;width:' + m[2] + '%;height:' + m[3] + '%"></div>'; });
      I.spots.forEach((p, i) => { if (p.box) h += '<div class="sy-mask" data-m="' + i + '" style="left:' + p.box[0] + '%;top:' + p.box[1] + '%;width:' + p.box[2] + '%;height:' + p.box[3] + '%"><span>' + (opt.pts === 'nums' ? i + 1 : '?') + '</span></div>'; });
    }
    if (opt.pts !== 'none') I.spots.forEach((p, i) => {
      if (opt.pts === 'one' && i !== opt.one) return;
      h += '<button class="sy-pt' + (opt.pts === 'one' ? ' on solo' : '') + '" data-i="' + i + '" style="left:' + p.x + '%;top:' + p.y + '%" aria-label="' + (opt.pts === 'dots' ? esc(p.ru) : 'Структура ' + (i + 1)) + '"><span>' + (opt.pts === 'nums' ? i + 1 : '') + '</span></button>';
    });
    return h + '</div>';
  }
  function dimAt(stage, p) {
    const d = $('.sy-dim', stage); if (!d) return;
    if (!p) { d.style.background = ''; d.classList.remove('on'); return; }
    d.classList.add('on');
    d.style.background = 'radial-gradient(circle at ' + p.x + '% ' + p.y + '%, transparent 0, transparent 7%, rgba(8,18,24,.5) 15%)';
  }
  function uniq(spots) { const m = new Map(); spots.forEach((p, i) => { const k = p.ru; if (!m.has(k)) m.set(k, { p, idx: [] }); m.get(k).idx.push(i); }); return [...m.values()]; }
  function rowFor(S, p) { const T = tableOf(S.id); if (!T) return null; const k = (p.row || p.ru).toLowerCase(); return T.rows.find(r => r[0].toLowerCase() === k) || null; }
  function infoHtml(S, p) {
    const r = rowFor(S, p);
    let h = '<div class="sy-info-n">' + esc(p.ru) + '</div><dl class="sy-dl">' +
      '<dt>Латинский</dt><dd class="la">' + esc(p.la) + ' ' + sayBtn(p.la) + trs(p.la) + '</dd>' +
      '<dt>Греческий</dt><dd class="la">' + esc(p.gr) + '</dd>';
    if (r) {
      if (r[3]) h += '<dt>Воспаление</dt><dd><i>' + esc(r[3]) + '</i>' + (r[4] ? ' — ' + esc(r[4]) : '') + '</dd>';
      if (r[5]) h += '<dt>Прочие термины</dt><dd>' + esc(r[5]) + '</dd>';
    }
    return h + '</dl>';
  }
  function renderAtlas() {
    const S = sysById(st.sys), I = S.images[st.img];
    sel = null; answers = {}; findT = null; findScore = { ok: 0, n: 0 };
    const masks = st.mode !== 'study' || st.hideLabels;
    let h = '<div class="sy-imgs">' + S.images.map((im, i) => '<button class="sy-th' + (i === st.img ? ' on' : '') + '" data-img="' + i + '"><img src="' + im.src + '" alt="" loading="lazy"><span><b>' + KIND[im.kind] + '</b>' + esc(im.title) + '</span></button>').join('') + '</div>' +
      '<div class="sy-modes">' + [['study', 'Изучение', 'с подписями'], ['check', 'Самопроверка', 'подписи скрыты'], ['find', 'Покажи структуру', 'как на сдаче']].map(([v, t, s]) => '<button class="sy-mode' + (st.mode === v ? ' on' : '') + '" data-mode="' + v + '"><b>' + t + '</b><span>' + s + '</span></button>').join('') + '</div>' +
      '<div class="sy-main"><div class="sy-viewer" id="sy-viewer"><div class="sy-tools"><button class="sy-tb" data-z="-" aria-label="Уменьшить">−</button><span class="sy-zv" id="sy-zv">100%</span><button class="sy-tb" data-z="+" aria-label="Увеличить">+</button><button class="sy-tb" data-z="0" aria-label="Сбросить масштаб">1:1</button><button class="sy-tb wide" id="sy-full"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><span>На весь экран</span></button>' +
      (I.full ? '<a class="sy-tb wide" href="' + I.full + '" target="_blank" rel="noopener">Исходник</a>' : '') + '</div>' +
      (st.mode === 'find' ? '<div class="sy-banner" id="sy-banner"></div>' : '') + '<div class="sy-scroll" id="sy-scroll">' + stageHtml(I, { masks, pts: st.mode === 'study' ? 'dots' : st.mode === 'check' ? 'nums' : (st.hints ? 'dots' : 'none'), z: st.z }) + '</div>' +
      '<div class="sy-cap">' + (I.kind === 'real' ? 'Фото наглядного пособия из кабинета. ' + (/номерами/.test(I.title) ? 'Номера на плакате — без расшифровки; отмечены только структуры, которые узнаются однозначно.' : 'Отмечены структуры, которые узнаются однозначно.') : 'Учебная схема. В режимах самопроверки печатные подписи закрыты.') + ' Колесо мыши с Ctrl или кнопки «+/−» — увеличение, перетаскивание — сдвиг.</div></div>' +
      '<aside class="sy-side" id="sy-side"></aside></div>';
    $('#sy-body').innerHTML = h;
    $$('[data-img]').forEach(b => b.onclick = () => { st.img = +b.dataset.img; save(); renderAtlas(); });
    $$('[data-mode]').forEach(b => b.onclick = () => { st.mode = b.dataset.mode; save(); renderAtlas(); });
    setupZoom();
    const stage = $('.sy-stage', $('#sy-scroll'));
    if (st.mode === 'study') sideStudy(S, I, stage);
    else if (st.mode === 'check') sideCheck(S, I, stage);
    else sideFind(S, I, stage);
  }
  function highlight(stage, I, idxs, on) {
    $$('.sy-pt', stage).forEach(b => b.classList.toggle('hl', on && idxs.includes(+b.dataset.i)));
    dimAt(stage, on && idxs.length === 1 ? I.spots[idxs[0]] : null);
  }
  function sideStudy(S, I, stage) {
    const side = $('#sy-side');
    const groups = uniq(I.spots);
    side.innerHTML = '<div class="sy-card" id="sy-info"><div class="muted">Наведите или нажмите на точку на изображении или на название в списке — структура подсветится.</div></div>' +
      '<label class="tr-pill sy-hide"><input type="checkbox" id="sy-hidelab"' + (st.hideLabels ? ' checked' : '') + '> Закрыть печатные подписи</label>' +
      '<div class="sy-list">' + groups.map((g, k) => '<button class="sy-li" data-g="' + k + '"><span>' + esc(g.p.ru) + '</span><i>' + esc(g.p.la !== '—' ? g.p.la : g.p.gr) + '</i></button>').join('') + '</div>';
    const pick = (idxs, pin) => {
      const p = I.spots[idxs[0]];
      $('#sy-info').innerHTML = infoHtml(S, p) + (idxs.length > 1 ? '<div class="muted small">На изображении отмечено в ' + idxs.length + ' местах.</div>' : '');
      highlight(stage, I, idxs, true);
      $$('.sy-li', side).forEach(b => b.classList.toggle('on', groups[+b.dataset.g].idx.join() === idxs.join()));
      if (pin) sel = idxs;
    };
    const unpick = () => { if (sel) pick(sel); else { highlight(stage, I, [], false); $$('.sy-li', side).forEach(b => b.classList.remove('on')); } };
    $$('.sy-li', side).forEach(b => {
      const g = groups[+b.dataset.g];
      b.onmouseenter = () => pick(g.idx); b.onmouseleave = unpick; b.onfocus = () => pick(g.idx);
      b.onclick = () => { pick(g.idx, true); scrollToSpot(I.spots[g.idx[0]]); };
    });
    $$('.sy-pt', stage).forEach(b => {
      const i = +b.dataset.i, g = groups.find(x => x.idx.includes(i));
      b.onmouseenter = () => pick(g.idx); b.onmouseleave = unpick;
      b.onclick = e => { e.stopPropagation(); pick(g.idx, true); };
    });
    $('#sy-hidelab').onchange = e => { st.hideLabels = e.target.checked; renderAtlas(); };
  }
  function cardFor(p, S) {
    const ru = [p.ru.replace(/\s+—\s+/g, '; ').replace(/[()]/g, ';'), p.row].join('; ');
    const la = [p.la, p.gr].filter(x => x && x !== '—' && !/^-/.test(x)).join('; ').replace(/,\s*/g, '; ');
    return { ru: { lang: 'ru', answer: ru, q: p.ru }, la: { lang: 'la', answer: la || '—', q: p.ru } };
  }
  function checkSpot(p, val) {
    const c = cardFor(p);
    const isLa = /^[a-z\s().,;-]+$/i.test(val.trim());
    const r = check(isLa ? c.la : c.ru, val);
    return r;
  }
  function sideCheck(S, I, stage) {
    const side = $('#sy-side');
    const total = I.spots.length;
    const prog = () => { const ok = Object.values(answers).filter(x => x === 'ok').length; return '<div class="sy-prog"><div style="width:' + (100 * ok / total) + '%"></div></div><div class="muted small">Верно: ' + ok + ' из ' + total + ' · ошибок: ' + Object.values(answers).filter(x => x === 'bad').length + '</div>'; };
    const base = () => { side.innerHTML = '<div class="sy-card"><b>Самопроверка</b><p class="muted small">Подписи закрыты. Нажмите на номер на изображении и напишите название — по-латински, по-гречески или по-русски.</p><div id="sy-progbox">' + prog() + '</div><div class="sy-btns"><button class="btn ghost sm" id="sy-reset">Начать заново</button><button class="btn ghost sm" id="sy-revall">Показать все ответы</button></div></div><div id="sy-ask"></div>'; bind(); };
    const bind = () => {
      $('#sy-reset').onclick = () => renderAtlas();
      $('#sy-revall').onclick = () => { $$('.sy-mask', stage).forEach(m => m.classList.add('open')); $('#sy-ask').innerHTML = '<div class="sy-card"><ol class="sy-anslist">' + I.spots.map(p => '<li><b>' + esc(p.ru) + '</b> — <i>' + esc(p.la) + '</i>' + (p.gr !== '—' ? ', <i>' + esc(p.gr) + '</i>' : '') + '</li>').join('') + '</ol></div>'; };
    };
    const ask = i => {
      const p = I.spots[i]; sel = [i];
      highlight(stage, I, [i], true);
      $('#sy-ask').innerHTML = '<div class="sy-card sy-q"><div class="sy-qn">№ ' + (i + 1) + '</div><div class="muted small">Как называется отмеченная структура?</div>' +
        '<form id="sy-f" autocomplete="off"><input class="tr-in" id="sy-in" placeholder="название…" autocapitalize="off" spellcheck="false"><button class="btn" type="submit">Проверить</button></form>' +
        '<div class="sy-btns"><button class="link" id="sy-show">Показать ответ</button><button class="link" id="sy-nx">Следующая →</button></div><div id="sy-fb"></div></div>';
      const inp = $('#sy-in'); if (matchMedia('(hover:hover)').matches) inp.focus();
      if (matchMedia('(max-width:980px)').matches) $('#sy-ask').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const reveal = ok => {
        const m = $('.sy-mask[data-m="' + i + '"]', stage); if (m) m.classList.add('open');
        $('#sy-fb').innerHTML = '<div class="tr-fb ' + (ok ? 'good' : 'bad') + '">' + (ok ? '✓ Верно!' : (inp.value.trim() ? '✗ Неверно.' : 'Ответ:')) + '</div>' + infoHtml(S, p);
        answers[i] = ok ? 'ok' : 'bad';
        const b = $('.sy-pt[data-i="' + i + '"]', stage); if (b) { b.classList.remove('ok', 'bad'); b.classList.add(ok ? 'ok' : 'bad'); }
        $('#sy-progbox').innerHTML = prog();
      };
      $('#sy-f').onsubmit = e => { e.preventDefault(); if (!inp.value.trim()) return; reveal(checkSpot(p, inp.value).ok); };
      $('#sy-show').onclick = () => reveal(false);
      $('#sy-nx').onclick = () => { const order = I.spots.map((_, k) => (i + 1 + k) % total); const n = order.find(k => !answers[k]); if (n != null) ask(n); };
    };
    base();
    $$('.sy-pt', stage).forEach(b => b.onclick = e => { e.stopPropagation(); ask(+b.dataset.i); });
    $$('.sy-pt', stage).forEach(b => { b.onmouseenter = () => b.classList.add('hl'); b.onmouseleave = () => { if (!sel || sel[0] !== +b.dataset.i) b.classList.remove('hl'); }; });
  }
  function sideFind(S, I, stage) {
    const side = $('#sy-side');
    const groups = uniq(I.spots);
    let queue = shuffle(groups.slice()), cur = null, done = false;
    const head = () => '<div class="sy-card"><b>Покажи структуру</b><p class="muted small">Как на устной сдаче: прочитайте название и нажмите на это место на изображении.</p>' +
      '<label class="tr-pill"><input type="checkbox" id="sy-hints"' + (st.hints ? ' checked' : '') + '> Подсказка: показать точки</label><div class="muted small sy-score">Найдено: ' + findScore.ok + ' из ' + findScore.n + '</div></div><div id="sy-task"></div>';
    side.innerHTML = head();
    $('#sy-hints').onchange = e => { st.hints = e.target.checked; save(); renderAtlas(); };
    const nextTask = () => {
      done = false; highlight(stage, I, [], false); $$('.sy-pt', stage).forEach(b => b.classList.remove('ok', 'bad', 'on', 'solo'));
      $$('.sy-hit', stage).forEach(x => x.remove());
      if (!queue.length) { $('#sy-banner').innerHTML = '<b>Готово!</b> Найдено ' + findScore.ok + ' из ' + findScore.n; $('#sy-task').innerHTML = '<div class="sy-card"><div class="tr-fb good">Все структуры пройдены: ' + findScore.ok + ' из ' + findScore.n + '.</div><button class="btn" id="sy-again">Ещё раз</button></div>'; $('#sy-again').onclick = () => renderAtlas(); return; }
      cur = queue.shift();
      $('#sy-task').innerHTML = '<div class="sy-card sy-q"><div class="muted small">Покажите на изображении:</div><div class="sy-target">' + esc(cur.p.ru) + '</div><div class="la sy-target-la">' + esc(cur.p.la !== '—' ? cur.p.la : cur.p.gr) + '</div><div class="sy-btns"><button class="link" id="sy-give">Не знаю — показать</button><button class="link" id="sy-skip">Пропустить</button></div><div id="sy-fb"></div></div>';
      $('#sy-banner').innerHTML = '<span class="muted small">Покажите:</span> <b>' + esc(cur.p.ru) + '</b> <i class="la">' + esc(cur.p.la !== '—' ? cur.p.la : cur.p.gr) + '</i>';
      $('#sy-give').onclick = () => resolve(null);
      $('#sy-skip').onclick = () => { queue.push(cur); nextTask(); };
    };
    const showSpots = (idxs, cls) => idxs.forEach(i => {
      let b = $('.sy-pt[data-i="' + i + '"]', stage);
      if (!b) { b = document.createElement('button'); b.className = 'sy-pt'; b.dataset.i = i; b.style.left = I.spots[i].x + '%'; b.style.top = I.spots[i].y + '%'; b.innerHTML = '<span></span>'; b.classList.add('sy-hit'); stage.appendChild(b); }
      b.classList.add(cls, 'hl');
    });
    const resolve = (hit) => {
      if (done) { nextTask(); return; }
      done = true; findScore.n++;
      const ok = hit != null && cur.idx.includes(hit);
      if (ok) findScore.ok++;
      showSpots(cur.idx, 'ok');
      if (hit != null && !ok) showSpots([hit], 'bad');
      dimAt(stage, cur.idx.length === 1 ? I.spots[cur.idx[0]] : null);
      $$('.sy-mask', stage).forEach(m => { if (cur.idx.includes(+m.dataset.m)) m.classList.add('open'); });
      $('#sy-fb').innerHTML = '<div class="tr-fb ' + (ok ? 'good' : 'bad') + '">' + (ok ? '✓ Верно!' : hit != null ? '✗ Это: <b>' + esc(I.spots[hit].ru) + '</b>. Правильное место подсвечено зелёным.' : 'Правильное место подсвечено зелёным.') + '</div>' + infoHtml(S, cur.p) + '<button class="btn" id="sy-nt">Дальше →</button>';
      $('#sy-banner').innerHTML = (ok ? '<b class="sy-mark good">✓ Верно:</b> ' : '<b class="sy-mark bad">✗ Правильное место — зелёное:</b> ') + esc(cur.p.ru) + ' <button class="btn sm" id="sy-nt2">Дальше →</button>';
      $('#sy-nt2').onclick = nextTask;
      $('#sy-nt').onclick = nextTask; $('.sy-score', side).textContent = 'Найдено: ' + findScore.ok + ' из ' + findScore.n;
    };
    stage.addEventListener('click', e => {
      if (stage.dataset.dragged === '1') return;
      if (done) return;
      const r = stage.getBoundingClientRect();
      const x = 100 * (e.clientX - r.left) / r.width, y = 100 * (e.clientY - r.top) / r.height;
      let best = -1, bd = 1e9;
      I.spots.forEach((p, i) => { const dx = (p.x - x) * r.width / 100, dy = (p.y - y) * r.height / 100, d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = i; } });
      const lim = Math.max(28, r.width * 0.06);
      if (bd > lim * 1.6) { flash(stage, x, y); $('#sy-banner').innerHTML = '<span class="muted small">Здесь нет отмеченной структуры — точнее.</span> <b>' + esc(cur.p.ru) + '</b>'; $('#sy-fb').innerHTML = '<div class="muted small">Здесь нет отмеченной структуры — попробуйте точнее.</div>'; return; }
      resolve(best);
    });
    nextTask();
  }
  function flash(stage, x, y) { const d = document.createElement('div'); d.className = 'sy-tap'; d.style.left = x + '%'; d.style.top = y + '%'; stage.appendChild(d); setTimeout(() => d.remove(), 600); }
  function scrollToSpot(p) {
    const sc = $('#sy-scroll'); if (!sc || st.z <= 1) return;
    const stg = $('.sy-stage', sc);
    sc.scrollTo({ left: stg.offsetWidth * p.x / 100 - sc.clientWidth / 2, top: stg.offsetHeight * p.y / 100 - sc.clientHeight / 2, behavior: 'smooth' });
  }
  function setupZoom() {
    const sc = $('#sy-scroll'), stage = $('.sy-stage', sc), viewer = $('#sy-viewer');
    const setZ = (z, cx, cy) => {
      z = Math.max(1, Math.min(4, z));
      const ox = sc.scrollLeft + (cx == null ? sc.clientWidth / 2 : cx), oy = sc.scrollTop + (cy == null ? sc.clientHeight / 2 : cy);
      const k = z / st.z; st.z = z;
      stage.style.setProperty('--z', z); viewer.classList.toggle('zoomed', z > 1);
      sc.scrollLeft = ox * k - (cx == null ? sc.clientWidth / 2 : cx); sc.scrollTop = oy * k - (cy == null ? sc.clientHeight / 2 : cy);
      $('#sy-zv').textContent = Math.round(z * 100) + '%';
    };
    st.z = 1; setZ(1);
    $$('[data-z]', viewer).forEach(b => b.onclick = () => setZ(b.dataset.z === '+' ? st.z * 1.5 : b.dataset.z === '-' ? st.z / 1.5 : 1));
    sc.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); const r = sc.getBoundingClientRect(); setZ(st.z * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    // перетаскивание при увеличении (обработчики окна — одни на всю страницу, см. ниже)
    sc.addEventListener('pointerdown', e => { if (st.z <= 1 || e.pointerType === 'touch') return; drag = { sc, stage, x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop }; stage.dataset.dragged = '0'; });
    // двойной клик — увеличить в точке
    sc.addEventListener('dblclick', e => { const r = sc.getBoundingClientRect(); setZ(st.z >= 3 ? 1 : st.z * 2, e.clientX - r.left, e.clientY - r.top); });
    $('#sy-full').onclick = () => { const on = !viewer.classList.contains('full'); viewer.classList.toggle('full', on); document.body.classList.toggle('sy-noscroll', on); $('#sy-full span').textContent = on ? 'Свернуть' : 'На весь экран'; };
    if (matchMedia('(max-width:720px)').matches) $('.sy-cap', viewer).insertAdjacentHTML('beforeend', ' На телефоне удобнее «На весь экран» и увеличение.');
  }
  let drag = null;
  window.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 5) { drag.stage.dataset.dragged = '1'; drag.sc.classList.add('grab'); } drag.sc.scrollLeft = drag.l - dx; drag.sc.scrollTop = drag.t - dy; });
  window.addEventListener('pointerup', () => { if (!drag) return; const d = drag; drag = null; d.sc.classList.remove('grab'); setTimeout(() => { d.stage.dataset.dragged = '0'; }, 0); });
  document.addEventListener('keydown', e => { const v = $('#sy-viewer.full'); if (e.key === 'Escape' && v) $('#sy-full').click(); });

  /* ---------- таблица ---------- */
  function renderTable() {
    const S = sysById(st.sys), T = tableOf(S.id);
    if (!T) { $('#sy-body').innerHTML = '<p class="muted">Таблица не найдена.</p>'; return; }
    const cols = TD.columns;
    const hid = st.tHide || {};
    let h = '<div class="sy-card sy-ttools"><span class="muted small">Скрыть столбец для самопроверки (скрытое можно подсмотреть нажатием):</span> ' + cols.map((c, i) => i ? '<label class="tr-pill"><input type="checkbox" data-hc="' + i + '"' + (hid[i] ? ' checked' : '') + '> ' + esc(c) + '</label>' : '').join('') + '</div>' +
      '<div class="tr-scroll"><table class="tr-table sys sy-table"><thead><tr><th>№</th>' + cols.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' +
      T.rows.map((r, i) => '<tr><td class="n">' + (i + 1) + '</td>' + r.map((v, c) => '<td data-c="' + c + '" class="' + (hid[c] && v ? 'tr-h' : '') + (c === 1 || c === 2 || c === 3 ? ' la' : '') + '">' + esc(v) + (c === 1 ? ' ' + sayBtn(v) : '') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' +
      '<p class="muted small">Таблица — из пособия по ОП.07. Её же можно тренировать во вкладке «Тренажёр» → «Системы органов».</p>';
    $('#sy-body').innerHTML = h;
    $$('[data-hc]').forEach(x => x.onchange = () => { st.tHide = Object.assign({}, st.tHide, { [x.dataset.hc]: x.checked }); renderTable(); });
    $('#sy-body').onclick = e => { const td = e.target.closest('td.tr-h'); if (td) td.classList.toggle('peek'); };
  }

  /* ---------- словообразование ---------- */
  function partsHtml(q) {
    return '<div class="sy-parts">' + q.parts.map(([e, m]) => '<span class="sy-part"><i>' + esc(e) + '</i><small>' + esc(m) + '</small></span>').join('<span class="sy-plus">+</span>') + '</div>' + (q.note ? '<div class="muted small">' + esc(q.note) + '</div>' : '');
  }
  function renderWF() {
    const S = sysById(st.sys);
    let h = '<div class="sy-card sy-wfhead"><div><b>Словообразование: ' + esc(S.title) + '</b><p class="muted small">Как на сдаче: прочитайте вопрос и образуйте термин из терминоэлементов. После ответа — правильный термин и его состав.</p></div>' +
      '<div class="sy-btns"><label class="tr-pill"><input type="checkbox" id="sy-wfall"> Показать все ответы</label><button class="btn ghost sm" id="sy-wftr">Тренировать в тренажёре →</button></div></div>' +
      '<div class="sy-wf">' + S.wf.map((q, i) => '<div class="sy-wfq" data-q="' + i + '"><div class="sy-wfn">' + (i + 1) + '</div><div class="sy-wfb"><div class="sy-wft">' + esc(q.q) + '?</div>' +
        '<form class="sy-wff" autocomplete="off"><input class="tr-in la" placeholder="термин по-латински…" autocapitalize="off" spellcheck="false"><button class="btn sm" type="submit">Проверить</button><button class="link" type="button" data-show>ответ</button></form><div class="sy-wfa"></div></div></div>').join('') + '</div>';
    $('#sy-body').innerHTML = h;
    const reveal = (box, q, ok, typed) => {
      box.closest('.sy-wfq').classList.remove('ok', 'bad'); if (typed) box.closest('.sy-wfq').classList.add(ok ? 'ok' : 'bad');
      box.innerHTML = (typed ? '<span class="sy-mark ' + (ok ? 'good' : 'bad') + '">' + (ok ? '✓ Верно' : '✗ Неверно') + '</span> ' : '') + '<b class="la">' + esc(q.a.split(';')[0]) + '</b> ' + sayBtn(q.a) + trs(q.a) + partsHtml(q);
    };
    $$('.sy-wfq').forEach(el => {
      const q = S.wf[+el.dataset.q], f = $('form', el), inp = $('input', f), box = $('.sy-wfa', el);
      f.onsubmit = e => { e.preventDefault(); if (!inp.value.trim()) return; reveal(box, q, check({ lang: 'la', answer: q.a, q: q.q }, inp.value).ok, true); };
      $('[data-show]', f).onclick = () => reveal(box, q, false, false);
    });
    $('#sy-wfall').onchange = e => $$('.sy-wfq').forEach(el => { const box = $('.sy-wfa', el); if (e.target.checked) reveal(box, S.wf[+el.dataset.q], false, false); else { box.innerHTML = ''; el.classList.remove('ok', 'bad'); } });
    $('#sy-wftr').onclick = () => { if (window.Trainer && window.Trainer.preselectWF) window.Trainer.preselectWF(S.id); const t = $('.tab[data-tab="train"]'); if (t) t.click(); };
  }

  /* ---------- устная сдача ---------- */
  let oral = null;
  function oralDeck(S) {
    const cards = [];
    if (st.oral.atlas) S.images.forEach((I, ii) => uniq(I.spots).forEach(g => cards.push({ t: 'img', ii, i: g.idx[Math.floor(Math.random() * g.idx.length)], key: 'a' + ii + ':' + g.p.ru, p: g.p })));
    const T = tableOf(S.id);
    if (st.oral.table && T) T.rows.forEach((r, i) => cards.push({ t: 'row', r, key: 'r' + i }));
    if (st.oral.wf) S.wf.forEach((q, i) => cards.push({ t: 'wf', q, key: 'w' + i }));
    return shuffle(cards).slice(0, st.oral.n > 0 ? st.oral.n : cards.length);
  }
  function renderOral() {
    const S = sysById(st.sys);
    if (oral && oral.sys === S.id && oral.i < oral.deck.length) return oralCard();
    if (oral && oral.sys === S.id && oral.i >= oral.deck.length) return oralResults();
    const counts = { atlas: S.images.reduce((n, I) => n + uniq(I.spots).length, 0), table: (tableOf(S.id) || { rows: [] }).rows.length, wf: S.wf.length };
    $('#sy-body').innerHTML = '<div class="sy-card sy-oral-set"><h3>Устная сдача: ' + esc(S.title) + '</h3>' +
      '<p class="muted">Вопрос или изображение → ответьте вслух сами → откройте правильный ответ и честно отметьте, знали ли вы его. Подписи и подсказки скрыты до проверки.</p>' +
      '<div class="sy-oral-opts">' + [['atlas', 'Показать структуру на изображении', counts.atlas], ['table', 'Назвать термины из таблицы (лат. и греч.)', counts.table], ['wf', 'Вопросы по словообразованию', counts.wf]].map(([k, t, n]) => '<label class="tr-pill"><input type="checkbox" data-o="' + k + '"' + (st.oral[k] ? ' checked' : '') + '> ' + t + ' <em>' + n + '</em></label>').join('') + '</div>' +
      '<div class="tr-row"><label for="sy-on">Сколько вопросов</label><div class="tr-reps"><input type="range" id="sy-on" min="5" max="60" step="5" value="' + Math.min(60, st.oral.n) + '"><b id="sy-onv">' + st.oral.n + '</b></div></div>' +
      '<div class="tr-bar"><span class="muted small" id="sy-osum"></span><button class="btn" id="sy-ogo">Начать сдачу</button></div></div>';
    const upd = () => { const n = (st.oral.atlas ? counts.atlas : 0) + (st.oral.table ? counts.table : 0) + (st.oral.wf ? counts.wf : 0); $('#sy-osum').textContent = 'Доступно вопросов: ' + n; $('#sy-ogo').disabled = !n; };
    $$('[data-o]').forEach(x => x.onchange = () => { st.oral[x.dataset.o] = x.checked; save(); upd(); });
    $('#sy-on').oninput = e => { st.oral.n = +e.target.value; $('#sy-onv').textContent = st.oral.n; save(); };
    $('#sy-ogo').onclick = () => { oral = { sys: S.id, deck: oralDeck(S), i: 0, log: [] }; oralCard(); };
    upd();
  }
  function oralQ(S, c) {
    if (c.t === 'img') {
      const I = S.images[c.ii];
      return { label: 'Назовите отмеченную структуру (по-русски, по-латински и греческий элемент)', body: '<div class="sy-oral-img">' + stageHtml(I, { masks: true, pts: 'one', one: c.i, cls: 'oral' }) + '</div>', ans: infoHtml(S, c.p), after: st => { $$('.sy-mask', st).forEach(m => { if (+m.dataset.m === c.i) m.classList.add('open'); }); } };
    }
    if (c.t === 'row') {
      const r = c.r, cols = TD.columns;
      return { label: 'Назовите латинское название и греческий эквивалент' + (r[3] ? ', образуйте название воспаления' : ''), body: '<div class="sy-oral-word">' + esc(r[0]) + '</div>',
        ans: '<dl class="sy-dl">' + r.map((v, k) => k && v ? '<dt>' + esc(cols[k]) + '</dt><dd' + (k <= 3 ? ' class="la"' : '') + '>' + esc(v) + (k === 1 ? ' ' + sayBtn(v) : '') + '</dd>' : '').join('') + '</dl>' };
    }
    return { label: 'Словообразование: как называется…', body: '<div class="sy-oral-word">' + esc(c.q.q) + '?</div>', ans: '<div class="sy-oral-term la">' + esc(c.q.a.split(';')[0]) + ' ' + sayBtn(c.q.a) + '</div>' + trs(c.q.a) + partsHtml(c.q) };
  }
  function oralCard() {
    const S = sysById(st.sys), c = oral.deck[oral.i], Q = oralQ(S, c);
    const ok = oral.log.filter(x => x.ok).length;
    $('#sy-body').innerHTML = '<div class="tr-prog"><div style="width:' + (100 * oral.i / oral.deck.length) + '%"></div></div><div class="tr-meta"><span>' + (oral.i + 1) + ' / ' + oral.deck.length + '</span><span>знал: ' + ok + ' · не знал: ' + (oral.log.length - ok) + '</span></div>' +
      '<div class="sy-card sy-oral"><div class="tr-label">' + esc(Q.label) + '</div>' + Q.body + '<div id="sy-oans" class="sy-oans" hidden>' + Q.ans + '</div>' +
      '<div class="tr-bar" id="sy-obar"><button class="btn" id="sy-orev">Показать ответ</button><button class="btn ghost" id="sy-ostop">Закончить</button></div></div>';
    $('#sy-orev').onclick = () => {
      $('#sy-oans').hidden = false; setTimeout(() => $('#sy-oans').scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30); if (Q.after) Q.after($('.sy-stage', $('#sy-body')) || document.body);
      $('#sy-obar').innerHTML = '<span class="muted small">Вы ответили правильно?</span><button class="btn bad" id="sy-ono">✗ Не знал</button><button class="btn" id="sy-oyes">✓ Знал</button>';
      const go = v => { oral.log.push({ c, ok: v }); oral.i++; if (oral.i >= oral.deck.length) oralResults(); else oralCard(); };
      $('#sy-oyes').onclick = () => go(true); $('#sy-ono').onclick = () => go(false);
    };
    $('#sy-ostop').onclick = () => { oral.deck = oral.deck.slice(0, oral.i); oralResults(); };
    window.scrollTo({ top: Math.min(window.scrollY, root().offsetTop - 70) });
  }
  function oralResults() {
    const S = sysById(st.sys), log = oral.log, ok = log.filter(x => x.ok).length, pct = log.length ? Math.round(100 * ok / log.length) : 0;
    const bad = log.filter(x => !x.ok);
    const name = c => c.t === 'img' ? c.p.ru + ' — ' + c.p.la : c.t === 'row' ? c.r[0] + ' — ' + (c.r[1] || c.r[2]) : c.q.q + ' — ' + c.q.a.split(';')[0];
    const kind = c => c.t === 'img' ? 'изображение' : c.t === 'row' ? 'таблица' : 'словообразование';
    $('#sy-body').innerHTML = '<div class="sy-card tr-res"><div class="tr-score"><b>' + pct + '%</b><span>' + ok + ' из ' + log.length + ' · ' + (pct === 100 ? 'система сдана! 🎉' : pct >= 80 ? 'почти готово' : 'нужно повторить') + '</span></div>' +
      (bad.length ? '<h4>Повторить (' + bad.length + ')</h4><ul class="sy-badlist">' + bad.map(x => '<li><span class="muted small">' + kind(x.c) + '</span> ' + esc(name(x.c)) + '</li>').join('') + '</ul>' : '') +
      '<p class="muted small">Система считается сданной, если все термины названы правильно (с точной постановкой ударения) и правильно образованы термины по словообразованию.</p></div>' +
      '<div class="tr-bar">' + (bad.length ? '<button class="btn" id="sy-obad">Повторить ошибки</button>' : '') + '<button class="btn ghost" id="sy-onew">Новая сдача</button></div>';
    if (bad.length) $('#sy-obad').onclick = () => { oral = { sys: S.id, deck: shuffle(bad.map(x => x.c)), i: 0, log: [] }; oralCard(); };
    $('#sy-onew').onclick = () => { oral = null; renderOral(); };
  }

  window.Systems = { show, _st: st };
  const boot = () => { if (location.hash === '#sys') show(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
