/* Латинско-русский / русско-латинский переводчик по словарю учебника.
   Переводятся ТОЛЬКО слова, которые есть в словаре (data/dictionary.js). */
(function () {
  'use strict';
  const M = window.Morph;
  const RAW = window.LATIN_DICT;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ================= Подготовка данных ================= */
  const entries = [];
  const byLemma = new Map(); // normLa(la) -> [entry]
  function addEntry(e) {
    e.id = entries.length;
    e.info = M.analyzeEntry(e);
    entries.push(e);
    const k = M.normLa(e.la);
    if (!byLemma.has(k)) byLemma.set(k, []);
    byLemma.get(k).push(e);
    return e;
  }
  RAW.entries.forEach(e => {
    const x = Object.assign({}, e);
    if (/^e, ex$/.test(x.la)) { x.la = 'ex'; x.alt = ['e']; }
    addEntry(x);
  });
  // Таблицы: если слово уже есть в словаре — дополняем, иначе добавляем отдельной статьёй
  RAW.tables.forEach(t => {
    const latin = t.la && byLemma.get(M.normLa(t.la));
    if (latin && latin.length) {
      latin.forEach(e => { e.el = e.el || t.el; e.sec = e.sec || t.sec; e.extraRu = (e.extraRu || []).concat([t.ru]); });
    } else if (t.la) {
      addEntry({ la: t.la, gr: '', ru: t.ru + (t.note ? ' (' + t.note + ')' : ''), src: 'Таблицы: ' + t.sec, el: t.el, sec: t.sec, table: true });
    }
  });
  const elements = RAW.elements.map(x => Object.assign({}, x));
  RAW.tables.forEach(t => { if (t.el) elements.push({ type: 'root', el: t.el, ru: t.ru, la: t.la, sec: t.sec }); });

  /* ---------- Латинский индекс словоформ ---------- */
  const laIndex = new Map(); // norm form -> [{e, f}]
  function idxAdd(form, e, f) {
    const k = M.normLa(form);
    if (!k) return;
    if (!laIndex.has(k)) laIndex.set(k, []);
    const arr = laIndex.get(k);
    if (!arr.some(x => x.e === e && M.describeForm(x.f) === M.describeForm(f))) arr.push({ e, f });
  }
  const phrases = [];
  entries.forEach(e => {
    if (e.info.pos === 'phrase') {
      const words = e.la.replace(/[«»]/g, ' ').split(/\s+/).filter(Boolean).map(M.normLa);
      phrases.push({ e, words });
      return;
    }
    M.allForms(e.info).forEach(f => idxAdd(f.form, e, f));
    (e.alt || []).forEach(a => idxAdd(a, e, {}));
  });
  phrases.sort((a, b) => b.words.length - a.words.length);

  /* ---------- Русский индекс ---------- */
  function cleanRu(ru) {
    return ru.replace(/предл\.\s*с\s*(acc\.|abl\.)(\s*и\s*(acc\.|abl\.))?/g, '')
      .replace(/^(глаг|местоим|числ|союз)\.?(\s*\([^)]*\))?\s*;\s*/, '').replace(/\b(нар|нескл)\.\s*/g, '').replace(/фарм\.\s*/g, '').replace(/\(сравн\. степень\)/g, '').trim();
  }
  function senses(e) {
    const out = [];
    const base = cleanRu(e.ru);
    const paren = [];
    const main = base.replace(/\(([^)]*)\)/g, (m, p) => { paren.push(p); return ' '; });
    main.split(/[;,]/).map(s => s.trim()).filter(Boolean).forEach((s, i) => out.push({ s, prio: i }));
    (e.extraRu || []).forEach(s => out.push({ s, prio: 1 }));
    paren.forEach(p => { // синоним в скобках: «струма (зоб)», «вертел (бугор …)» — только короткие
      const t = p.trim();
      if (!/[,;]/.test(t) && t.split(/\s+/).length <= 3 && /^[а-яё -]+$/i.test(t)) out.push({ s: t, prio: 10 });
    });
    return out;
  }
  function fleeting(w) {
    if (/лец$/.test(w)) return w.replace(/лец$/, 'льц');
    if (/[^аеиоуыэюя](ец|ок|ек|ёк|ель|ень|ол)$/.test(w) && w.length > 4) return w.replace(/(е|о|ё)([кцлн]ь?)$/, '$2');
    return w;
  }
  const ruWords = s => (M.normRu(s).match(/[а-я]+(?:-[а-я]+)*/g) || []);
  const ruIndex = new Map(), ruIndexSorted = new Map(), ruElIndex = new Map();
  function ruAdd(map, key, val) { if (!map.has(key)) map.set(key, []); map.get(key).push(val); }
  entries.forEach(e => {
    senses(e).forEach(({ s, prio }) => {
      const w = ruWords(s);
      if (!w.length || w.length > 6) return;
      const st = w.map(M.stemRu);
      const val = { e, sense: s, words: w, prio: prio + (e.table ? 0.5 : 0) };
      ruAdd(ruIndex, st.join(' '), val);
      if (w.length > 1) ruAdd(ruIndexSorted, st.slice().sort().join(' '), val);
      // беглые гласные: кашель → кашля, бугорок → бугорка, палец → пальца
      const fl = w.map(x => fleeting(x));
      if (fl.some((x, i) => x !== w[i])) {
        const st2 = fl.map(M.stemRu).join(' ');
        if (st2 !== st.join(' ')) ruAdd(ruIndex, st2, val);
      }
    });
  });
  elements.forEach(el => {
    el.ru.split(/[;,]/).map(s => s.replace(/[…().]/g, '').replace(/\bо$/, '').trim()).filter(Boolean).forEach(s => {
      const w = ruWords(s); if (!w.length) return;
      ruAdd(ruElIndex, w.map(M.stemRu).join(' '), el);
    });
  });

  /* ================= Вспомогательное ================= */
  function firstSense(e) {
    const s = senses(e);
    return s.length ? s[0].s : e.ru;
  }
  function posLabel(e) {
    const i = e.info;
    const g = { m: 'м. р.', f: 'ж. р.', n: 'ср. р.' };
    switch (i.pos) {
      case 'noun': return 'сущ., ' + i.decl + ' скл., ' + (i.genders || [i.gender]).map(x => g[x]).join('/') + (i.plOnly ? ', только мн. ч.' : '') + (i.guessed ? ' (склонение по окончанию)' : '');
      case 'adj': return i.type === 'adj12' ? 'прил. 1–2 скл.' : i.type === 'comp' ? 'прил., сравн. степень (3 скл.)' : 'прил. 3 скл.';
      case 'verb': return 'глагол, ' + (i.conj === 5 ? 3 : i.conj) + ' спряж.';
      case 'prep': return 'предлог' + (i.governs.length ? ' + ' + i.governs.map(c => c === 'acc' ? 'Acc.' : 'Abl.').join(' / ') : '');
      case 'phrase': return 'словосочетание';
      case 'adv': return 'наречие';
      default: return 'неизменяемое';
    }
  }
  function lemmaHtml(e) {
    return '<span class="lemma">' + esc(e.la) + '</span>' + (e.gr ? ' <span class="gr">' + esc(e.gr) + '</span>' : '');
  }
  function srcHtml(e) { return '<span class="src">' + esc(e.src) + '</span>'; }

  /* ================= Латынь → русский ================= */
  function tokenizeLa(text) {
    const re = /[A-Za-zÀ-ÿĀ-ž]+(?:-[A-Za-zÀ-ÿĀ-ž]+)*/g;
    const out = []; let m;
    while ((m = re.exec(text))) out.push({ w: m[0], k: M.normLa(m[0]) });
    return out;
  }
  function lemmasOf(k) { return new Set((laIndex.get(k) || []).map(x => x.e.id)); }
  const END_RE = /(orum|arum|ibus|ium|um|us|ae|am|as|os|is|a|i|o|e|em|es)$/;
  function softEq(a, b) {
    if (a === b) return true;
    const la = lemmasOf(a), lb = lemmasOf(b);
    for (const x of la) if (lb.has(x)) return true;
    const sa = a.replace(END_RE, ''), sb = b.replace(END_RE, '');
    return sa.length >= 3 && sa === sb;
  }
  function matchPhraseAt(toks, i) {
    for (const p of phrases) {
      const n = p.words.length;
      if (i + n > toks.length) continue;
      let ok = true;
      for (let j = 0; j < n && ok; j++) ok = (j === 0 ? softEq(toks[i].k, p.words[0]) || toks[i].k === p.words[0] : softEq(toks[i + j].k, p.words[j]));
      if (ok) return p;
    }
    return null;
  }
  function analyzeLaWord(k) {
    const hits = laIndex.get(k) || [];
    const groups = new Map();
    hits.forEach(h => {
      if (!groups.has(h.e.id)) groups.set(h.e.id, { e: h.e, forms: [] });
      const d = M.describeForm(h.f);
      const gr = groups.get(h.e.id);
      if (d && !gr.forms.includes(d)) { gr.forms.push(d); }
      (gr.raw = gr.raw || []).push(h.f);
    });
    const arr = Array.from(groups.values());
    arr.sort((a, b) => score(b) - score(a));
    function score(g) {
      let s = 0;
      if (M.normLa(g.e.la) === k) s += 10;
      if (!g.e.table) s += 1;
      return s;
    }
    return arr;
  }
  /* Разбор по терминоэлементам (только для слов, которых нет в словаре) */
  const elPieces = [];
  elements.forEach(el => el.el.split('/').map(s => M.normLa(s.trim())).filter(s => s.length >= 2 || s === 'a').forEach(p => elPieces.push({ p, el })));
  elPieces.sort((a, b) => b.p.length - a.p.length);
  function decompose(k) {
    const n = k.length; const best = new Array(n + 1).fill(null); best[0] = [];
    for (let i = 0; i < n; i++) {
      if (!best[i]) continue;
      for (const { p, el } of elPieces) {
        if (k.startsWith(p, i)) {
          const j = i + p.length; const cand = best[i].concat([{ p, el }]);
          if (!best[j] || best[j].length > cand.length) best[j] = cand;
          for (const v of ['o', 'i']) if (k[j] === v && (!best[j + 1] || best[j + 1].length > cand.length)) best[j + 1] = cand.concat([{ p: v, link: true }]);
        }
      }
    }
    let res = best[n];
    if (!res) for (const end of ['us', 'um', 'a', 'is', 'ia', 'ae', 'i', 'e', 'on']) { if (n > end.length && best[n - end.length]) { res = best[n - end.length].concat([{ p: end, ending: true }]); break; } }
    if (!res) return null;
    const real = res.filter(x => x.el);
    if (real.length < 2) return null;
    return res.filter(x => !x.link || true);
  }

  function translateLa(text) {
    const toks = tokenizeLa(text);
    const items = [];
    for (let i = 0; i < toks.length;) {
      const p = matchPhraseAt(toks, i);
      if (p) { items.push({ type: 'phrase', words: toks.slice(i, i + p.words.length).map(t => t.w), e: p.e }); i += p.words.length; continue; }
      const an = analyzeLaWord(toks[i].k);
      if (an.length) items.push({ type: 'word', word: toks[i].w, an });
      else items.push({ type: 'unknown', word: toks[i].w, dec: decompose(toks[i].k) });
      i++;
    }
    resolveLa(items);
    return items;
  }
  /* Выбор падежа по контексту и русские окончания */
  function resolveLa(items) {
    let nouns = 0, gov = null, ruPrep = null, latPrep = null, lastNoun = null;
    const pickForm = (raw, pred) => raw.find(pred);
    const ruCaseOf = (c) => {
      if (ruPrep) {
        if (c === 'acc' && /^(in|sub)$/.test(latPrep)) return 'acc';
        return M.RU_PREP_CASE[ruPrep] || (c === 'abl' ? 'prep' : c);
      }
      return c === 'abl' ? 'ins' : c;
    };
    const RU_LABEL = { nom: 'им.', gen: 'род.', dat: 'дат.', acc: 'вин.', ins: 'твор.', prep: 'предл.' };
    items.forEach(it => {
      it.ru = null; it.pick = null;
      if (it.type === 'unknown') { gov = null; ruPrep = null; nouns++; lastNoun = null; return; }
      if (it.type === 'phrase') {
        const head = it.e.la.split(/\s+/)[0];
        const same = M.normLa(it.words[0]) === M.normLa(head);
        const hits = (laIndex.get(M.normLa(it.words[0])) || []).filter(h => h.f.c);
        let f = null;
        if (gov) f = hits.find(h => gov.includes(h.f.c));
        else if (!same && nouns > 0) f = hits.find(h => h.f.c === 'gen');
        else if (!same) f = hits.find(h => h.f.c !== 'nom') || null;
        const c = f ? f.f.c : 'nom', n = f ? f.f.n : 'sg';
        const rc = ruCaseOf(c);
        it.pick = { c, n }; it.ruC = rc;
        it.ru = M.ruPhraseForm(firstSense(it.e), rc, n) || firstSense(it.e);
        nouns++; gov = null; ruPrep = null;
        lastNoun = { it, c, n, rc, g: null, ruG: M.ruGender((firstSense(it.e).split(' ').find(w => !M.isRuAdj(w)) || '')) };
        return;
      }
      const g0 = it.an[0];
      const e = g0.e, pos = e.info.pos, raw = g0.raw || [];
      if (pos === 'prep') { gov = e.info.governs; latPrep = M.normLa(it.word); it.ru = firstSense(e); ruPrep = M.normRu(it.ru.split(/\s+/)[0]); return; }
      if (pos === 'noun') {
        let f = null;
        if (gov) f = pickForm(raw, x => gov.includes(x.c) && x.n === 'sg') || pickForm(raw, x => gov.includes(x.c));
        else if (nouns === 0) f = pickForm(raw, x => x.c === 'nom' && x.n === 'sg') || pickForm(raw, x => x.c === 'nom');
        else f = pickForm(raw, x => x.c === 'gen' && x.n === 'sg') || pickForm(raw, x => x.c === 'gen');
        f = f || raw[0] || { c: 'nom', n: 'sg' };
        const rc = ruCaseOf(f.c);
        it.pick = f; it.ruC = rc;
        const s = firstSense(e);
        it.ru = M.ruPhraseForm(s, rc, f.n) || s;
        nouns++; gov = null; ruPrep = null;
        lastNoun = { it, c: f.c, n: f.n, rc, g: e.info.gender === 'f' || e.info.gender === 'n' ? e.info.gender : 'm', ruG: M.ruGender(s.split(' ').filter(w => !M.isRuAdj(w)).pop() || s) };
        return;
      }
      if (pos === 'adj') {
        let f = null;
        if (lastNoun) f = pickForm(raw, x => x.c === lastNoun.c && x.n === lastNoun.n && (!lastNoun.g || x.g === lastNoun.g));
        f = f || pickForm(raw, x => x.c === 'nom' && x.n === 'sg') || raw[0];
        it.pick = f;
        const s = firstSense(e);
        const agree = lastNoun && f && f.c === lastNoun.c && f.n === lastNoun.n;
        it.ru = (agree && M.ruPhraseForm(s, lastNoun.rc, f.n, lastNoun.ruG)) || s;
        return;
      }
      it.ru = firstSense(e); gov = null; ruPrep = null;
    });
  }

  function renderLa(items) {
    const out = $('#la-out'), det = $('#la-details');
    if (!items.length) { out.innerHTML = '<span class="placeholder">Здесь появится перевод</span>'; det.innerHTML = ''; return; }
    out.innerHTML = items.map(it => {
      if (it.type === 'phrase') return '<span class="tw ok" data-id="' + it.e.id + '">' + esc(it.ru || firstSense(it.e)) + '</span>';
      if (it.type === 'word') return '<span class="tw ok" data-id="' + it.an[0].e.id + '">' + esc(it.ru || firstSense(it.an[0].e)) + '</span>';
      return '<span class="tw bad" title="Нет в словаре">' + esc(it.word) + '?</span>';
    }).join(' ');
    det.innerHTML = items.map(it => {
      if (it.type === 'phrase') {
        return card(it.words.join(' '), '<div class="cand">' + lemmaHtml(it.e) + ' — <b>' + esc(it.e.ru) + '</b><div class="meta">' + posLabel(it.e) + ' · ' + srcHtml(it.e) + '</div><button class="link" data-id="' + it.e.id + '">подробнее</button></div>');
      }
      if (it.type === 'word') {
        const pd = it.pick ? M.describeForm(it.pick) : '';
        return card(it.word, it.an.map((g, gi) => '<div class="cand">' + lemmaHtml(g.e) + ' — <b>' + esc(g.e.ru) + '</b>' +
          (g.forms.length ? '<div class="forms">' + g.forms.map(f => '<span class="chip' + (gi === 0 && f === pd && g.forms.length > 1 ? ' acc2' : '') + '">' + esc(f) + '</span>').join('') + '</div>' : '') +
          '<div class="meta">' + posLabel(g.e) + ' · ' + srcHtml(g.e) + (g.e.el ? ' · греч. элемент: <i>' + esc(g.e.el) + '</i>' : '') + '</div>' +
          '<button class="link" data-id="' + g.e.id + '">' + (['noun', 'adj', 'verb'].includes(g.e.info.pos) ? 'таблица форм' : 'подробнее') + '</button></div>').join(''));
      }
      let html = '<div class="cand miss">Нет в словаре учебника — слово не переведено.</div>';
      if (it.dec) {
        html += '<div class="cand hint"><div class="hint-t">Подсказка: разбор по терминоэлементам из таблиц</div>' +
          it.dec.map(x => x.el ? '<span class="chip el"><i>' + esc(x.p) + '</i> — ' + esc(x.el.ru) + '</span>' : '<span class="chip ghost">' + esc(x.p) + '</span>').join('<span class="plus">+</span>') + '</div>';
      }
      return card(it.word, html, true);
    }).join('');
  }
  function card(title, body, bad) {
    return '<div class="wcard' + (bad ? ' bad' : '') + '"><div class="wcard-h">' + esc(title) + '</div>' + body + '</div>';
  }

  /* ================= Русский → латынь ================= */
  function tokenizeRu(text) { return (M.normRu(text).match(/[а-я]+(?:-[а-я]+)*/g) || []); }
  const fmCache = new Map();
  function ruFormsOf(d) {
    if (fmCache.has(d)) return fmCache.get(d);
    const set = new Set([d]);
    try {
      ['nom', 'gen', 'dat', 'acc', 'ins', 'prep'].forEach(c => ['sg', 'pl'].forEach(n => {
        if (M.isRuAdj(d)) ['m', 'f', 'n'].forEach(g => set.add(M.ruAdjForm(d, g, c, n)));
        else set.add(M.ruNounForm(d, c, n));
      }));
    } catch (e) { /* ignore */ }
    fmCache.set(d, set); return set;
  }
  function formMatch(c, ws) {
    if (c.words.length !== ws.length) return 1;
    return ws.every((w, j) => ruFormsOf(c.words[j]).has(w)) ? 0 : 1;
  }
  function rankCands(list, inputWords) {
    const inp = inputWords.join(' ');
    const seen = new Set();
    return list.slice().sort((a, b) => {
      const pa = a.prio >= 10 ? 1 : 0, pb = b.prio >= 10 ? 1 : 0;
      if (pa !== pb) return pa - pb;
      const ea = a.words.join(' ') === inp ? 0 : 1, eb = b.words.join(' ') === inp ? 0 : 1;
      if (ea !== eb) return ea - eb;
      const fa = formMatch(a, inputWords), fb = formMatch(b, inputWords);
      if (fa !== fb) return fa - fb;
      const sa = /^Городкова/.test(a.e.src) ? 1 : 0, sb = /^Городкова/.test(b.e.src) ? 1 : 0; // основной учебник — Кравченко
      if (sa !== sb) return sa - sb;
      if (a.prio !== b.prio) return a.prio - b.prio;
      const ta = a.e.el ? 0 : 1, tb = b.e.el ? 0 : 1;
      if (ta !== tb) return ta - tb;
      return a.e.ru.length - b.e.ru.length;
    }).filter(c => { if (seen.has(c.e.id)) return false; seen.add(c.e.id); return true; });
  }
  function translateRu(text) {
    const toks = tokenizeRu(text);
    const items = [];
    for (let i = 0; i < toks.length;) {
      let found = null;
      for (let len = Math.min(6, toks.length - i); len >= 1 && !found; len--) {
        const ws = toks.slice(i, i + len);
        const st = ws.map(M.stemRu);
        let c = ruIndex.get(st.join(' '));
        if (!c && len > 1) c = ruIndexSorted.get(st.slice().sort().join(' '));
        if (c) c = c.filter(v => ws.every((w, j) => M.stemRu(w).length >= 3 || v.words.includes(w)));
        if (c && c.length) found = { words: ws, cands: rankCands(c, ws), len };
      }
      if (found) { items.push({ type: 'match', words: found.words, cands: found.cands, sel: 0 }); i += found.len; }
      else {
        const el = ruElIndex.get(M.stemRu(toks[i]));
        items.push({ type: 'unknown', word: toks[i], el: el || null }); i++;
      }
    }
    return items;
  }
  // выбор падежа/числа и согласование
  function ruCaseFor(item) {
    const c = item.cands[item.sel];
    const dictWords = c.words;
    // главное (существительное) слово в русском значении
    let hi = dictWords.findIndex(w => !M.isRuAdj(w));
    if (hi < 0) hi = dictWords.length - 1;
    const dw = dictWords[hi];
    const st = M.stemRu(dw);
    const iw = item.words.find(w => M.stemRu(w) === st) || item.words[Math.min(hi, item.words.length - 1)];
    return M.ruNounCase(iw, dw);
  }
  function latinForm(e, c, n, g) {
    const i = e.info;
    if (i.pos === 'noun') {
      const pp = i.par[c] && (i.par[c][n].length ? i.par[c][n] : i.par[c][n === 'sg' ? 'pl' : 'sg']);
      return pp && pp.length ? pp[0] : e.la;
    }
    if (i.pos === 'adj') { const par = i[g] || i.m; return (par[c][n][0]) || e.la; }
    if (i.pos === 'phrase') return phraseForm(e, c, n);
    return e.la;
  }
  function phraseForm(e, c, n) {
    if (c === 'nom' && n === 'sg') return e.la;
    const words = e.la.split(/\s+/);
    const headE = (byLemma.get(M.normLa(words[0])) || []).find(x => x.info.pos === 'noun');
    if (!headE) return e.la;
    const g = headE.info.gender;
    return words.map((w, i) => {
      if (i === 0) return latinForm(headE, c, n);
      if (/^[«A-Z]/.test(w)) return w; // несогласованное определение (род. п.) или название
      const hits = laIndex.get(M.normLa(w)) || [];
      const adj = hits.find(h => h.e.info.pos === 'adj');
      if (adj) return adj.e.info[g][c][n][0];
      return guessAdj(w, g, c, n);
    }).join(' ');
  }
  function guessAdj(w, g, c, n) {
    const m = w.match(/^(.*?)(us|um|a)$/);
    if (!m) return w;
    const stem = m[1];
    const T = { m: { nom: ['us', 'i'], gen: ['i', 'orum'], dat: ['o', 'is'], acc: ['um', 'os'], abl: ['o', 'is'] },
      f: { nom: ['a', 'ae'], gen: ['ae', 'arum'], dat: ['ae', 'is'], acc: ['am', 'as'], abl: ['a', 'is'] },
      n: { nom: ['um', 'a'], gen: ['i', 'orum'], dat: ['o', 'is'], acc: ['um', 'a'], abl: ['o', 'is'] } };
    return stem + T[g][c][n === 'sg' ? 0 : 1];
  }
  function nounGender(e) {
    const i = e.info;
    if (i.pos === 'noun') return i.gender === 'f' || i.gender === 'n' ? i.gender : 'm';
    if (i.pos === 'phrase') { const h = (byLemma.get(M.normLa(e.la.split(/\s+/)[0])) || []).find(x => x.info.pos === 'noun'); return h ? nounGender(h) : 'm'; }
    return 'm';
  }
  function buildLatin(items) {
    const isNoun = it => it.type === 'match' && ['noun', 'phrase', 'indecl'].includes(it.cands[it.sel].e.info.pos) && !(it.cands[it.sel].e.info.pos === 'indecl' && it.cands[it.sel].e.info.la.length < 3);
    const isAdj = it => it.type === 'match' && it.cands[it.sel].e.info.pos === 'adj';
    const isPrep = it => it.type === 'match' && it.cands[it.sel].e.info.pos === 'prep';
    let nounsSeen = 0;
    items.forEach((it, idx) => {
      it.lat = null; it.note = '';
      if (it.type !== 'match') { if (!M.isRuAdj(it.word) && it.word.length > 2) nounsSeen++; return; }
      const e = it.cands[it.sel].e;
      if (isNoun(it) && e.info.pos !== 'indecl') {
        const opts = ruCaseFor(it);
        let pick = opts[0];
        let prev = idx - 1; while (prev >= 0 && isAdj(items[prev])) prev--;
        if (prev >= 0 && isPrep(items[prev])) {
          const gov = items[prev].cands[items[prev].sel].e.info.governs || [];
          const acc = opts.find(o => o.c === 'acc');
          const unchanged = opts.length === 1 && opts[0].c === 'nom';
          const c = ((acc || unchanged) && gov.includes('acc')) ? 'acc' : (gov[0] || pick.c);
          pick = { c, n: (opts.find(o => o.n === 'pl') && !opts.find(o => o.n === 'sg')) ? 'pl' : pick.n };
          it.note = 'после предлога';
        } else if (nounsSeen === 0) {
          pick = opts.find(o => o.c === 'nom') || opts[0];
        } else {
          pick = opts.find(o => o.c === 'gen') || opts[0];
        }
        nounsSeen++;
        it.c = pick.c; it.n = e.info.plOnly ? 'pl' : pick.n; it.g = nounGender(e);
        it.lat = latinForm(e, it.c, it.n);
        it.opts = opts;
      }
    });
    // прилагательные согласуются с ближайшим существительным
    items.forEach((it, idx) => {
      if (!isAdj(it)) return;
      const e = it.cands[it.sel].e;
      let next = null, prev = null, head = null;
      for (let j = idx + 1; j < items.length; j++) { if (isAdj(items[j])) continue; if (isNoun(items[j]) && items[j].c) next = items[j]; break; }
      for (let j = idx - 1; j >= 0; j--) { if (isAdj(items[j])) continue; if (isNoun(items[j]) && items[j].c) prev = items[j]; break; }
      const ac = M.ruAdjCase(it.words[it.words.length - 1]);
      const fits = h => h && ac.some(o => o.c === h.c && o.n === h.n);
      head = fits(next) ? next : fits(prev) ? prev : (next || prev);
      if (head) { it.c = head.c; it.n = head.n; it.g = head.g; it.head = head; it.note = 'согласовано с ' + (head.cands[head.sel].e.la); }
      else {
        const o = M.ruAdjCase(it.words[it.words.length - 1]);
        const w = M.normRu(it.words[it.words.length - 1]);
        it.c = o.length ? o[0].c : 'nom'; it.n = o.length ? o[0].n : 'sg';
        it.g = /(ая|яя|ую|юю)$/.test(w) ? 'f' : /(ое|ее)$/.test(w) ? 'n' : 'm';
      }
      it.lat = latinForm(e, it.c, it.n, it.g);
    });
    items.forEach(it => { if (it.type === 'match' && !it.lat) it.lat = it.cands[it.sel].e.info.pos === 'verb' ? it.cands[it.sel].e.la : it.cands[it.sel].e.la.replace(/,.*$/, ''); });
    // латинский порядок: существительное, затем его определения-прилагательные
    const order = [];
    const used = new Set();
    items.forEach((it, idx) => {
      if (used.has(idx)) return;
      if (isAdj(it) && it.head) {
        const hi = items.indexOf(it.head);
        if (hi > idx) { // прилагательное стоит перед существительным — переставим
          order.push(hi); used.add(hi);
          for (let j = idx; j < hi; j++) if (isAdj(items[j]) && items[j].head === it.head) { order.push(j); used.add(j); }
          return;
        }
      }
      order.push(idx); used.add(idx);
    });
    return order.map(i => items[i]);
  }

  let ruItems = [];
  function renderRu() {
    const items = ruItems;
    const out = $('#ru-out'), det = $('#ru-details');
    if (!items.length) { out.innerHTML = '<span class="placeholder">Здесь появится перевод</span>'; det.innerHTML = ''; return; }
    const ordered = buildLatin(items);
    out.innerHTML = ordered.map(it => it.type === 'match'
      ? '<span class="tw ok" data-id="' + it.cands[it.sel].e.id + '">' + esc(it.lat) + '</span>'
      : '<span class="tw bad" title="Нет в словаре">' + esc(it.word) + '?</span>').join(' ');
    det.innerHTML = items.map((it, idx) => {
      if (it.type === 'unknown') {
        let html = '<div class="cand miss">Нет в словаре учебника — слово не переведено.</div>';
        if (it.el && it.el.length) html += '<div class="cand hint"><div class="hint-t">Есть терминоэлемент с таким значением</div>' + it.el.map(x => '<span class="chip el"><i>' + esc(x.el) + '</i> — ' + esc(x.ru) + '</span>').join(' ') + '</div>';
        return card(it.word, html, true);
      }
      const c = it.cands[it.sel];
      const e = c.e;
      let form = '';
      if (it.c && ['noun', 'adj', 'phrase'].includes(e.info.pos)) {
        form = '<div class="forms"><span class="chip acc">' + esc(it.lat) + '</span><span class="chip">' + M.CASE_SHORT[it.c] + ', ' + M.NUM_RU[it.n] + (e.info.pos === 'adj' ? ', ' + M.GEN_RU[it.g] : '') + '</span>' + (it.note ? '<span class="chip ghost">' + esc(it.note) + '</span>' : '') + '</div>';
        if (it.opts && it.opts.length > 1 && e.info.pos === 'noun') form += '<div class="meta">Возможны также: ' + it.opts.slice(1).map(o => '<i>' + esc(latinForm(e, o.c, o.n)) + '</i> (' + M.CASE_SHORT[o.c] + ', ' + M.NUM_RU[o.n] + ')').join('; ') + '</div>';
      }
      const alts = it.cands.length > 1 ? '<div class="alts">Другие варианты: ' + it.cands.map((x, j) => j === it.sel ? '' : '<button class="alt" data-item="' + idx + '" data-sel="' + j + '">' + esc(x.e.la) + '</button>').join('') + '</div>' : '';
      return card(it.words.join(' '), '<div class="cand">' + lemmaHtml(e) + ' — <b>' + esc(e.ru) + '</b>' + form +
        '<div class="meta">' + posLabel(e) + ' · ' + srcHtml(e) + '</div>' +
        '<button class="link" data-id="' + e.id + '">' + (['noun', 'adj', 'verb'].includes(e.info.pos) ? 'таблица форм' : 'подробнее') + '</button></div>' + alts);
    }).join('');
  }

  /* ================= Карточка статьи (таблица форм) ================= */
  function paradigmTable(par, title) {
    const rows = M.CASES.map(c => '<tr><th>' + M.CASE_RU[c] + '</th><td>' + esc(par[c].sg.join(', ') || '—') + '</td><td>' + esc(par[c].pl.join(', ') || '—') + '</td></tr>').join('');
    return (title ? '<h4>' + title + '</h4>' : '') + '<table class="par"><thead><tr><th>Падеж</th><th>Sing. (ед. ч.)</th><th>Plur. (мн. ч.)</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }
  function openEntry(id) {
    const e = entries[id]; if (!e) return;
    const i = e.info;
    let body = '<div class="m-head">' + lemmaHtml(e) + '</div><div class="m-ru">' + esc(e.ru) + '</div>' +
      '<div class="meta">' + posLabel(e) + ' · ' + srcHtml(e) + (e.el ? ' · греч. терминоэлемент: <i>' + esc(e.el) + '</i>' : '') + (e.sec ? ' · ' + esc(e.sec) : '') + '</div>';
    if (i.pos === 'noun') body += paradigmTable(i.par);
    if (i.pos === 'adj') {
      body += '<div class="tabs-mini">' + ['m', 'f', 'n'].map((g, k) => '<button class="tm' + (k ? '' : ' on') + '" data-g="' + g + '">' + { m: 'Masc. (м. р.)', f: 'Fem. (ж. р.)', n: 'Neutr. (ср. р.)' }[g] + '</button>').join('') + '</div>' +
        ['m', 'f', 'n'].map((g, k) => '<div class="tmp" data-g="' + g + '"' + (k ? ' hidden' : '') + '>' + paradigmTable(i[g]) + '</div>').join('');
    }
    if (i.pos === 'verb') body += '<table class="par"><tbody>' + i.vforms.map(v => '<tr><th>' + esc(v.label) + '</th><td>' + esc(v.form) + '</td></tr>').join('') + '</tbody></table>';
    if (i.guessed) body += '<p class="note">Грамматика этого слова в таблицах не указана — формы построены по типичному окончанию.</p>';
    $('#modal-body').innerHTML = body;
    $('#modal').hidden = false;
    $$('.tm', $('#modal-body')).forEach(b => b.onclick = () => {
      $$('.tm', $('#modal-body')).forEach(x => x.classList.toggle('on', x === b));
      $$('.tmp', $('#modal-body')).forEach(x => x.hidden = x.dataset.g !== b.dataset.g);
    });
  }

  /* ================= Словарь ================= */
  const sorted = entries.slice().sort((a, b) => M.normLa(a.la).localeCompare(M.normLa(b.la)));
  let dictLimit = 120;
  function renderDict() {
    const q = $('#dict-q').value.trim();
    const letter = $('#dict-letters .on') ? $('#dict-letters .on').dataset.l : '';
    let list = sorted;
    let formHits = [];
    if (q) {
      const ql = M.normLa(q), qr = M.normRu(q);
      const isRu = /[а-яё]/i.test(q);
      if (isRu) {
        const st = ruWords(q).map(M.stemRu).join(' ');
        list = sorted.filter(e => M.normRu(e.ru + ' ' + (e.extraRu || []).join(' ')).includes(qr) || (st && ruWords(e.ru).map(M.stemRu).join(' ').includes(st)));
        list.sort((a, b) => (firstSense(a).toLowerCase().startsWith(qr) ? 0 : 1) - (firstSense(b).toLowerCase().startsWith(qr) ? 0 : 1));
      } else {
        formHits = analyzeLaWord(ql).map(g => g.e);
        list = sorted.filter(e => M.normLa(e.la).includes(ql));
        list.sort((a, b) => (M.normLa(a.la).startsWith(ql) ? 0 : 1) - (M.normLa(b.la).startsWith(ql) ? 0 : 1));
        list = formHits.concat(list.filter(e => !formHits.includes(e)));
      }
    } else if (letter) list = sorted.filter(e => M.normLa(e.la)[0] === letter);
    $('#dict-count').textContent = 'Найдено: ' + list.length;
    $('#dict-list').innerHTML = list.slice(0, dictLimit).map(e =>
      '<li data-id="' + e.id + '"><div>' + lemmaHtml(e) + '</div><div class="d-ru">' + esc(e.ru) + '</div><div class="d-meta">' + esc(e.src) + '</div></li>').join('') +
      (list.length > dictLimit ? '<li class="more"><button id="dict-more">Показать ещё</button></li>' : '');
    const more = $('#dict-more'); if (more) more.onclick = () => { dictLimit += 200; renderDict(); };
  }
  function renderElements() {
    const groups = { prefix: 'Приставки', suffix: 'Терминоэлементы' };
    let html = '';
    Object.keys(groups).forEach(t => {
      html += '<h3>' + groups[t] + '</h3><div class="el-grid">' + RAW.elements.filter(x => x.type === t).map(x => '<div class="el-item"><i>' + esc(x.el) + '</i><span>' + esc(x.ru) + '</span></div>').join('') + '</div>';
    });
    const secs = [...new Set(RAW.tables.map(t => t.sec))];
    secs.forEach(s => {
      html += '<h3>' + esc(s) + '</h3><table class="par tbl"><thead><tr><th>Русский</th><th>Латинский</th><th>Греческий элемент</th><th>Примеры</th></tr></thead><tbody>' +
        RAW.tables.filter(t => t.sec === s).map(t => '<tr><td>' + esc(t.ru) + '</td><td>' + esc(t.la || '—') + '</td><td><i>' + esc(t.el || '') + '</i></td><td>' + esc(t.note || '') + '</td></tr>').join('') + '</tbody></table>';
    });
    $('#el-body').innerHTML = html;
  }

  /* ================= Интерфейс ================= */
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  function setTab(name) {
    $$('.tab').forEach(t => { t.classList.toggle('on', t.dataset.tab === name); if (t.dataset.tab === name && t.scrollIntoView) t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
    $$('.panel').forEach(p => p.hidden = p.id !== 'p-' + name);
    if (name === 'dict') renderDict();
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  }
  function init() {
    $('#stat-words').textContent = entries.length;
    $$('.tab').forEach(t => t.onclick = () => setTab(t.dataset.tab));
    const laIn = $('#la-in'), ruIn = $('#ru-in');
    const runLa = () => renderLa(translateLa(laIn.value));
    const runRu = () => { ruItems = translateRu(ruIn.value); renderRu(); };
    laIn.addEventListener('input', debounce(runLa, 150));
    ruIn.addEventListener('input', debounce(runRu, 150));
    $$('[data-ex]').forEach(b => b.onclick = () => {
      const tgt = b.closest('.panel').id === 'p-la' ? laIn : ruIn;
      tgt.value = b.dataset.ex; tgt.dispatchEvent(new Event('input'));
    });
    $$('.clear').forEach(b => b.onclick = () => { const t = b.closest('.io').querySelector('textarea'); t.value = ''; t.dispatchEvent(new Event('input')); t.focus(); });
    $$('.swap').forEach(b => b.onclick = () => {
      const fromLa = b.closest('.panel').id === 'p-la';
      const src = fromLa ? $('#la-out') : $('#ru-out');
      const txt = $$('.tw.ok', src).map(x => x.textContent).join(' ');
      setTab(fromLa ? 'ru' : 'la');
      const tgt = fromLa ? ruIn : laIn;
      if (txt) { tgt.value = txt; tgt.dispatchEvent(new Event('input')); }
    });
    $$('.copy').forEach(b => b.onclick = () => {
      const txt = b.closest('.io').querySelector('.out').innerText.trim();
      navigator.clipboard && navigator.clipboard.writeText(txt).then(() => { b.textContent = 'Скопировано'; setTimeout(() => b.textContent = 'Копировать', 1200); });
    });
    document.addEventListener('click', ev => {
      const l = ev.target.closest('[data-id]');
      if (l && (l.classList.contains('link') || l.classList.contains('tw') || l.closest('#dict-list'))) { openEntry(+l.dataset.id); return; }
      const a = ev.target.closest('.alt');
      if (a) { ruItems[+a.dataset.item].sel = +a.dataset.sel; renderRu(); return; }
      if (ev.target.closest('[data-close]') || ev.target.id === 'modal') $('#modal').hidden = true;
    });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape') $('#modal').hidden = true; });
    $('#dict-q').addEventListener('input', debounce(() => { dictLimit = 120; $$('#dict-letters button').forEach(x => x.classList.remove('on')); renderDict(); }, 150));
    const letters = [...new Set(sorted.map(e => M.normLa(e.la)[0]))].filter(Boolean);
    $('#dict-letters').innerHTML = letters.map(l => '<button data-l="' + l + '">' + l.toUpperCase() + '</button>').join('');
    $$('#dict-letters button').forEach(b => b.onclick = () => { const on = b.classList.contains('on'); $$('#dict-letters button').forEach(x => x.classList.remove('on')); if (!on) b.classList.add('on'); $('#dict-q').value = ''; dictLimit = 120; renderDict(); });
    renderElements();
    const h = location.hash.slice(1);
    setTab(['la', 'ru', 'dict', 'el', 'train', 'about'].includes(h) ? h : 'la');
    runLa(); runRu();
  }
  window.Translator = { translateLa, translateRu, buildLatin, entries, laIndex, decompose };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
