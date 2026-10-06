/* Ударение в латинских словах: деление на слоги, долгота предпоследнего слога и объяснение.
   Правила — по таблице «Долгота и краткость слога» Глоссария СБМК.
   Знаки над гласными в данных: ā ē ī ō ū ȳ (или макрон U+0304) — долгий по природе, ă ĕ ĭ ŏ ŭ y̆ (бревис U+0306) — краткий по природе. */
(function (global) {
  'use strict';
  const V = 'aeiouy';
  const MUTA = ['b', 'p', 't', 'd', 'c', 'g', 'ph', 'ch', 'th'];
  const LIQ = ['l', 'r'];
  const DIGRAPHS = ['ch', 'ph', 'rh', 'th'];

  /* буквы со знаками долготы/краткости */
  function letters(word) {
    const s = String(word).normalize('NFD');
    const out = [];
    for (const ch of s) {
      if (ch === '\u0304') { if (out.length) out[out.length - 1].mark = 'long'; continue; }
      if (ch === '\u0306') { if (out.length) out[out.length - 1].mark = 'short'; continue; }
      if (ch === '\u0308') { if (out.length) out[out.length - 1].dia = true; continue; }
      if (/[\u0300-\u036f]/.test(ch)) continue; // прочие знаки (в т. ч. ударение) игнорируем
      out.push({ ch: ch.toLowerCase(), orig: ch, mark: null, dia: false });
    }
    out.forEach(l => { l.orig = l.orig + (l.mark === 'long' ? '\u0304' : l.mark === 'short' ? '\u0306' : '') + (l.dia ? '\u0308' : ''); });
    return out.filter(l => /[a-zæœ]/.test(l.ch)).flatMap(l => l.ch === 'æ' ? [{ ...l, ch: 'a', orig: 'a' }, { ...l, ch: 'e', orig: 'e' }] : l.ch === 'œ' ? [{ ...l, ch: 'o', orig: 'o' }, { ...l, ch: 'e', orig: 'e' }] : [l]);
  }

  /* токены: гласные (с дифтонгами) и согласные (с диграфами, qu, gu) */
  function tokens(word) {
    const L = letters(word);
    const t = [];
    const isV = i => L[i] && V.includes(L[i].ch);
    for (let i = 0; i < L.length; i++) {
      const c = L[i].ch, n = L[i + 1] && L[i + 1].ch;
      const txt = k => L.slice(i, i + k).map(x => x.orig).join('');
      // qu — один согласный звук [кв]
      if (c === 'q' && n === 'u') { t.push({ v: false, s: txt(2), k: 'qu' }); i++; continue; }
      // ngu перед гласным — [нгв]: u не образует слога
      if (c === 'g' && n === 'u' && i > 0 && L[i - 1].ch === 'n' && isV(i + 2)) { t.push({ v: false, s: txt(2), k: 'gu' }); i++; continue; }
      // диграфы ch, ph, rh, th — один звук
      if (n && DIGRAPHS.includes(c + n)) { t.push({ v: false, s: txt(2), k: 'dg', d: c + n }); i++; continue; }
      if (c === 'j' || (c === 'i' && i === 0 && isV(1))) { t.push({ v: false, s: L[i].orig, k: 'j' }); continue; }
      if (V.includes(c)) {
        // дифтонги ae, oe, au, eu (кроме aë, oë и -eus/-eum на стыке суффикса и окончания)
        const pair = c + (n || '');
        const rest = L.slice(i + 2).map(x => x.ch).join('');
        if (n && !L[i + 1].dia && ['ae', 'oe', 'au', 'eu'].includes(pair) && !(pair === 'eu' && /^[sm]$/.test(rest))) {
          t.push({ v: true, s: txt(2), diph: pair, mark: L[i].mark || L[i + 1].mark }); i++; continue;
        }
        t.push({ v: true, s: L[i].orig, ch: c, mark: L[i].mark });
        continue;
      }
      t.push({ v: false, s: L[i].orig, k: c === 'x' ? 'x' : c === 'z' ? 'z' : 'c', ch: c });
    }
    return t;
  }
  const cname = c => (c.k === 'dg' ? c.d : c.k === 'qu' ? 'qu' : c.k === 'gu' ? 'gu' : c.ch || c.s.toLowerCase());
  const isMcl = (a, b) => MUTA.includes(cname(a)) && LIQ.includes(cname(b));

  /* деление на слоги */
  function syllabify(word) {
    const t = tokens(word);
    const nuc = []; t.forEach((x, i) => { if (x.v) nuc.push(i); });
    if (!nuc.length) return { syl: [{ text: word, nucleus: null, after: [] }], t };
    const bounds = []; // индекс токена, с которого начинается слог
    bounds.push(0);
    for (let k = 1; k < nuc.length; k++) {
      const a = nuc[k - 1], b = nuc[k];
      const cl = t.slice(a + 1, b); // согласные между гласными
      let start;
      if (cl.length === 0) start = b;
      else if (cl.length === 1) start = b - 1;
      else if (isMcl(cl[cl.length - 2], cl[cl.length - 1]) || (cname(cl[cl.length - 2]) === 'f' && LIQ.includes(cname(cl[cl.length - 1])))) start = b - 2;
      else start = b - 1;
      bounds.push(start);
    }
    const syl = [];
    for (let k = 0; k < nuc.length; k++) {
      const from = bounds[k], to = k + 1 < nuc.length ? bounds[k + 1] : t.length;
      const toks = t.slice(from, to);
      const after = t.slice(nuc[k] + 1, k + 1 < nuc.length ? nuc[k + 1] : t.length);
      syl.push({ text: toks.map(x => x.s).join(''), nucleus: t[nuc[k]], after, nextIsVowel: k + 1 < nuc.length && after.length === 0 });
    }
    return { syl, t };
  }

  /* суффиксы из таблицы глоссария: гласный, согласный, окончание после согласного */
  const SUF = [
    ['i', 't', /^is$/, true, '-ītis', 'суффикс -itis (воспаление) долгий'],
    ['o', 'm', /^(a|atis|ata|atum|ati|ate)$/, true, '-ōma', 'суффикс -oma (опухоль) долгий'],
    ['o', 's', /^(is|us|a|um|i|ae|es)$/, true, '-ōs-', 'суффикс -ōs- долгий'],
    ['a', 'l', /^(is|e|ia|ium|es)$/, true, '-āl-', 'суффикс -āl- долгий'],
    ['a', 'r', /^(is|e|ia|ium|es)$/, true, '-ār-', 'суффикс -ār- долгий'],
    ['a', 't', /^(us|a|um|i|ae|o|as|os)$/, true, '-āt-', 'суффикс -āt- долгий'],
    ['i', 'n', /^(us|a|um|i|ae|o)$/, true, '-īn-', 'суффикс -īn- долгий'],
    ['i', 'v', /^(us|a|um|i|ae|o)$/, true, '-īv-', 'суффикс -īv- долгий'],
    ['u', 'r', /^(a|ae|am|us|um)$/, true, '-ūr-', 'суффикс -ūr- долгий'],
    ['u', 't', /^(us|a|um|i|ae)$/, true, '-ūt-', 'суффикс -ūt- долгий'],
    ['i', 'c', /^(us|a|um|i|ae|o|is|as)$/, false, '-ĭc-', 'суффикс -ĭc- краткий'],
    ['i', 'd', /^(us|a|i|ae|o)$/, false, '-ĭd-', 'суффикс -ĭd- краткий'],
    ['i', 'l', /^(is|e|ia|ium|es)$/, false, '-ĭl-', 'суффикс -ĭl- краткий'],
    ['o', 'l', /^(us|a|i|ae|o)$/, false, '-ŏl-', 'суффикс -ŏl- краткий'],
    ['u', 'l', /^(us|a|um|i|ae|o)$/, false, '-ŭl- (-cŭl-)', 'суффикс -ŭl- (-cŭl-) краткий']
  ];
  function matchSuffix(vch, tail, prevV) {
    if (vch === 'a' && tail === 'sis' && prevV === 'i') return { long: true, code: 'suf', rule: 'суффикс -iāsis', why: 'суффикс -iasis долгий' };
    for (const [v, c, re, long, suf, why] of SUF)
      if (v === vch && tail.startsWith(c) && re.test(tail.slice(c.length))) return { long, code: 'suf', rule: 'суффикс ' + suf, why };
    return null;
  }

  /* долгота предпоследнего слога */
  function penultLength(info, word) {
    const s = info.syl[info.syl.length - 2];
    const v = s.nucleus;
    const vs = plain(v.s).toLowerCase();
    const dgNote = s.after.length === 1 && s.after[0].k === 'dg' ? '; диграф ' + s.after[0].d + ' после него — это один звук, долготы по положению он не даёт' : '';
    if (v.mark === 'long') return { long: true, code: 'nat-long', rule: 'долгий по природе', why: 'гласный ' + vs + ' в слоге ' + s.text + ' долгий по природе (знак долготы ¯ в словаре)' + dgNote };
    if (v.mark === 'short') return { long: false, code: 'nat-short', rule: 'краткий по природе', why: 'гласный ' + vs + ' в слоге ' + s.text + ' краткий по природе (знак краткости ˘ в словаре)' + dgNote };
    if (v.diph) return { long: true, code: 'diph', rule: 'дифтонг', why: 'в слоге ' + s.text + ' дифтонг ' + v.diph + ', а слог с дифтонгом всегда долгий' };
    if (s.nextIsVowel) return { long: false, code: 'vv', rule: 'гласный перед гласным', why: 'гласный ' + vs + ' в слоге ' + s.text + ' стоит перед другим гласным (' + info.syl[info.syl.length - 1].nucleus.s + '), а гласный перед гласным всегда краткий' };
    const cl = s.after;
    const xz = cl.find(c => c.k === 'x' || c.k === 'z');
    if (xz) return { long: true, code: 'xz', rule: 'перед x или z', why: 'гласный ' + vs + ' стоит перед буквой ' + xz.s.toLowerCase() + '; x [кс] и z [дз] — двойные согласные, поэтому слог долгий' };
    if (cl.length === 2 && isMcl(cl[0], cl[1])) return { long: false, code: 'mcl', rule: 'немой + плавный (b, p, t, d, c, g + l, r)', why: 'после гласного ' + vs + ' стоит сочетание ' + cl.map(cname).join('') + ' (немой согласный + l или r) — оно не делает слог долгим, слог краткий' };
    if (cl.length >= 2) return { long: true, code: 'cc', rule: 'перед двумя согласными', why: 'гласный ' + vs + ' стоит перед двумя согласными (' + cl.map(c => c.s.toLowerCase()).join('-') + '), поэтому слог долгий по положению' };
    const dg = cl.length === 1 && cl[0].k === 'dg';
    // суффиксы: окончание слова после гласного предпоследнего слога
    const vi = info.t.indexOf(v);
    const tail = info.t.slice(vi + 1).map(x => x.s).join('').toLowerCase();
    const prev = info.t.slice(0, vi).reverse().find(x => x.v);
    if (!dg) { const suffix = matchSuffix(v.ch, tail, prev && prev.ch); if (suffix) return suffix; }
    return { long: null, code: dg ? 'dg' : 'unknown', rule: dg ? 'перед диграфом' : 'по природе', why: (dg ? 'после гласного ' + vs + ' стоит диграф ' + cl[0].d + ' — это один звук, он не делает слог долгим; ' : 'после гласного ' + vs + ' одна согласная; ') + 'долгота зависит от природы гласного — проверьте по словарю (знаки ¯ / ˘)' };
  }
  /* главное: ударный слог и объяснение */
  function analyze(word) {
    const info = syllabify(word);
    const n = info.syl.length;
    const res = { word, syl: info.syl.map(s => s.text), n, idx: 0, steps: [], certain: true };
    if (n === 1) { res.idx = 0; res.code = 'one'; res.rule = 'односложное слово'; res.steps.push('Слово односложное — ударение на единственном слоге.'); return res; }
    if (n === 2) { res.idx = 0; res.code = 'two'; res.rule = 'двусложное слово'; res.steps.push('В двусложных словах ударение всегда на первом слоге (на последний слог ударение в латыни не ставится).'); return res; }
    const p = penultLength(info, word);
    res.code = p.code; res.rule = p.rule; res.why = p.why;
    res.steps.push('Слогов: ' + n + '. На последний слог ударение не падает — смотрим на 2-й слог от конца (' + info.syl[n - 2].text + ').');
    if (p.long === null) {
      res.certain = false; res.idx = n - 3; res.alt = n - 2;
      res.steps.push('По правилам положения определить нельзя: ' + p.why + '.');
      res.steps.push('Если слог долгий — ударение на 2-м слоге от конца (' + info.syl[n - 2].text + '), если краткий — на 3-м (' + info.syl[n - 3].text + ').');
      return res;
    }
    res.idx = p.long ? n - 2 : n - 3;
    res.steps.push('2-й слог от конца ' + (p.long ? 'долгий' : 'краткий') + ': ' + p.why + '.');
    res.steps.push(p.long ? 'Долгий 2-й слог от конца — значит ударение на нём.' : 'Краткий 2-й слог от конца ударение не принимает — оно переходит на 3-й слог от конца (' + info.syl[n - 3].text + ').');
    return res;
  }

  /* слово с ударением: знак над гласным ударного слога */
  function accented(word, a) {
    a = a || analyze(word);
    return a.syl.map((s, i) => i === a.idx ? accentSyl(s) : plain(s)).join('');
  }
  function plain(s) { return String(s).normalize('NFD').replace(/[\u0304\u0306]/g, '').normalize('NFC'); }
  function accentSyl(s) {
    s = plain(s);
    const m = s.match(/(ae|oe|au|eu|Ae|Oe|Au|Eu)/);
    const vow = /[aeiouyAEIOUY]/;
    let pos;
    if (m && !(s.toLowerCase().startsWith('qu') && m.index === 1)) pos = /^(ae|oe)$/i.test(m[0]) ? m.index + 1 : m.index;
    else { const qu = /^(qu|gu)/i.test(s) ? 2 : 0; pos = s.slice(qu).search(vow); pos = pos < 0 ? -1 : pos + qu; }
    if (pos < 0) return s;
    return (s.slice(0, pos + 1) + '\u0301' + s.slice(pos + 1)).normalize('NFC');
  }
  global.Stress = { analyze, syllabify, accented, accentSyl, plain };
})(typeof window !== 'undefined' ? window : globalThis);
