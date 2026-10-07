/* Произношение: латинское слово → русская транскрипция по правилам чтения (Глоссарий СБМК, таблицы №1–2)
   + озвучка встроенным русским голосом устройства (Web Speech API). Без сервера и сторонних сервисов. */
(function () {
  'use strict';
  const S = window.Stress;
  const ACC = '\u0301';
  const V = 'aeiouyëäöü';
  const isV = c => !!c && V.includes(c);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SOFT = { a: 'я', o: 'ё', u: 'ю', e: 'е', i: 'и', y: 'и', 'ë': 'е', 'ä': 'я', 'ö': 'ё', 'ü': 'ю' };

  /* слово со знаками долготы, если оно есть в списках сайта (Valeriana → Valeriāna) */
  let marked = null;
  function markedForm(w) {
    if (!marked) {
      marked = new Map();
      const G = window.Grammar;
      if (G) (G.WORDS || []).concat(G.DICT || []).forEach(x => { if (S && S.plain(x.w) !== x.w) marked.set(S.plain(x.w).toLowerCase(), x.w); });
    }
    const lw = w.toLowerCase();
    let m = marked.get(lw);
    if (!m) { // другая форма того же слова: Valerianae → Valeriān + ae
      for (let k = 1; k <= 4 && !m; k++) {
        const stem = lw.slice(0, -k); if (stem.length < 4) break;
        for (const [pl, mk] of marked) {
          const e = pl.match(/(us|um|a|is|es|e|i|on|er|en|o|x)$/);
          if (e && pl.slice(0, -e[0].length) === stem) { const ms = S.plain(mk.slice(0, -e[0].length)).toLowerCase() === stem ? mk.slice(0, -e[0].length) : null; if (ms) m = ms + lw.slice(stem.length); break; }
        }
      }
    }
    if (!m) return w;
    return /^[A-Z]/.test(w) ? m[0].toUpperCase() + m.slice(1) : m;
  }

  /* индекс буквы ударного гласного в слове (без знаков долготы) или -1, если ударение по правилам не определить */
  function stressIndex(word, p) {
    if (!S) return -1;
    const a = S.analyze(word);
    if (!a.certain) return -1;
    const syl = a.syl.map(s => S.plain(s).toLowerCase());
    if (syl.join('') !== p) return -1;
    let pos = 0; for (let i = 0; i < a.idx; i++) pos += syl[i].length;
    const s = syl[a.idx];
    for (let j = 0; j < s.length; j++) {
      const c = s[j], at = pos + j;
      if (!isV(c)) continue;
      if (c === 'u' && (p[at - 1] === 'q' || (p[at - 1] === 'g' && p[at - 2] === 'n')) && isV(p[at + 1])) continue; // qu, ngu
      if (c === 'i' && (at === 0 || isV(p[at - 1])) && isV(p[at + 1]) && j < s.length - 1) continue;          // i как [й]
      return at;
    }
    return -1;
  }

  function word(w0) {
    if (!/[A-Za-z]/.test(w0)) return { text: w0, say: w0, certain: true };
    const w = markedForm(w0);
    const p = (S ? S.plain(w) : w).toLowerCase().replace(/æ/g, 'ae').replace(/œ/g, 'oe');
    if (p === 'zincum') return { text: 'ци́нкум', say: 'ци́нкум', certain: true };
    const st = p.replace(/[^aeiouyëäöü]|(?<=[aeo])[eu]/g, '').length > 1 ? stressIndex(w, p) : -1;
    const out = []; // {s, v} — v: индекс гласной буквы источника, к которой относится кусок
    for (let i = 0; i < p.length;) {
      const c = p[i], n = p[i + 1], n2 = p[i + 2], prev = p[i - 1];
      const put = (s, len, v) => { out.push({ s, v: v == null ? (isV(c) ? i : -1) : v }); i += len; };
      if (c === 'a' && n === 'e') { put('э', 2); continue; }
      if (c === 'o' && n === 'e') { put('э', 2); continue; }
      if (c === 'a' && n === 'u') { out.push({ s: 'а', v: i }); out.push({ s: 'у', v: -1 }); i += 2; continue; }
      if (c === 'a' || c === 'ä') { put('а', 1); continue; }
      if (c === 'e' || c === 'ë') { put('э', 1); continue; }
      if (c === 'o' || c === 'ö') { put('о', 1); continue; }
      if (c === 'u' || c === 'ü') { put('у', 1); continue; }
      if (c === 'y') { put('и', 1); continue; }
      if (c === 'i') { put((i === 0 || isV(prev)) && isV(n) ? 'й' : 'и', 1, (i === 0 || isV(prev)) && isV(n) ? -1 : i); continue; }
      if (c === 'j') { put('й', 1, -1); continue; }
      if (c === 'l') {
        if (isV(n)) {
          if ((n === 'a' || n === 'o') && n2 === 'e') { put('ле', 3, i + 1); continue; }
          put('л' + SOFT[n], 2, i + 1); continue;
        }
        put(n === 'l' ? 'л' : 'ль', 1, -1); continue;
      }
      if (c === 'c') {
        if (n === 'h') { put('х', 2, -1); continue; }
        put('eiyëy'.includes(n || '#') || ((n === 'a' || n === 'o') && n2 === 'e') ? 'ц' : 'к', 1, -1); continue;
      }
      if (c === 'p' && n === 'h') { put('ф', 2, -1); continue; }
      if (c === 'r' && n === 'h') { put('р', 2, -1); continue; }
      if (c === 't' && n === 'h') { put('т', 2, -1); continue; }
      if (c === 't') { put(n === 'i' && isV(n2) && !'stx'.includes(prev || '#') ? 'ц' : 'т', 1, -1); continue; }
      if (c === 'q') { put(n === 'u' ? 'кв' : 'к', n === 'u' ? 2 : 1, -1); continue; }
      if (c === 'g' && n === 'u' && prev === 'n' && isV(n2)) { put('гв', 2, -1); continue; }
      if (c === 's') { put(isV(prev) && (isV(n) || n === 'm' || n === 'n') ? 'з' : 'с', 1, -1); continue; }
      const MAP = { b: 'б', d: 'д', f: 'ф', g: 'г', h: 'х', k: 'к', m: 'м', n: 'н', p: 'п', r: 'р', v: 'в', w: 'в', x: 'кс', z: 'з' };
      put(MAP[c] != null ? MAP[c] : c, 1, -1);
    }
    let text = '', say = '';
    out.forEach(o => {
      let s = o.s;
      const stressed = st >= 0 && o.v === st;
      if (stressed) {
        if (s.includes('ё')) { text += s; say += s; return; }
        const k = s.search(/[аэеиоуыяюё]/);
        s = k >= 0 ? s.slice(0, k + 1) + ACC + s.slice(k + 1) : s;
        text += s; say += s;
      } else {
        text += s;
        say += s.replace('ё', 'ьо'); // безударное «лё» голос читает как «льо»
      }
    });
    if (/^[A-Z]/.test(w0)) { text = text[0].toUpperCase() + text.slice(1); say = say[0].toUpperCase() + say.slice(1); }
    return { text, say, certain: st >= 0 || p.replace(/[^aeiouy]/g, '').length <= 1 };
  }
  function tr(latin) {
    const parts = String(latin).split(/([A-Za-zÀ-ÿĀ-žȳ\u0304\u0306]+)/);
    let text = '', say = '', certain = true;
    parts.forEach((t, i) => {
      if (i % 2) { const r = word(t); text += r.text; say += r.say; certain = certain && r.certain; }
      else { text += t; say += t.replace(/[()]/g, ' '); }
    });
    return { text: text.trim(), say: say.replace(/\s+/g, ' ').trim(), certain };
  }

  /* ---------- голос ---------- */
  const synth = window.speechSynthesis;
  const ok = !!(synth && window.SpeechSynthesisUtterance) || typeof Audio !== 'undefined';
  const hasSynth = !!(synth && window.SpeechSynthesisUtterance);
  let voice = null;
  function pickVoice() {
    if (!hasSynth) return null;
    const vs = synth.getVoices().filter(v => /^ru/i.test(v.lang));
    voice = vs.find(v => /natural|online/i.test(v.name)) || vs.find(v => /google/i.test(v.name)) || vs.find(v => /milena|yuri|katya|irina|svetlana|dariya/i.test(v.name)) || vs[0] || null;
    return voice;
  }
  if (hasSynth) { pickVoice(); if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice); else synth.onvoiceschanged = pickVoice; }
  function cleanRu(t) { return String(t).split(/;|\s\d\)\s?/)[0].replace(/\([^)]*\)/g, ' ').replace(/^\s*\d\)\s*/, '').replace(/\s+/g, ' ').trim(); }
  function cleanLa(t) { return String(t).split(/;/)[0].split(/,\s*(?=-|[a-z]+,|[mfn]\b|um\b|a\b|e\b|i\b|ae\b|is\b|us\b)/)[0].replace(/\([^)]*\)/g, ' ').trim(); }
  /* ---------- записи диктора (Silero TTS, голос kseniya) ----------
     audio/xx/<fnv1a>.mp3, где ключ — та же строка, которую получил бы голос устройства */
  let IDX = null;
  function idx() { if (!IDX) { IDX = new Set(); const s = window.AUDIO_INDEX || ''; for (let i = 0; i < s.length; i += 8) IDX.add(s.slice(i, i + 8)); } return IDX; }
  function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); }
  function clip(t) { const h = fnv(t); return idx().has(h) ? 'audio/' + h.slice(0, 2) + '/' + h + '.mp3' : null; }
  const player = typeof Audio !== 'undefined' ? new Audio() : null;
  let queue = [];
  function playQueue(urls) {
    queue = urls.slice();
    const nextClip = () => { const u = queue.shift(); if (!u) return; player.src = u; player.play().catch(() => {}); };
    player.onended = () => setTimeout(nextClip, 120);
    nextClip();
  }
  function stop() { if (player) { queue = []; player.pause(); } if (hasSynth) synth.cancel(); }
  function recorded(text, lang, whole) {
    if (!player || !window.AUDIO_INDEX) return null;
    if (lang !== 'la') { const u = clip(whole ? text : cleanRu(text)); return u ? [u] : null; }
    const one = clip(tr(whole ? text : cleanLa(text)).say); if (one) return [one];
    // фраза целиком не записана — собираем из отдельных слов (tinctura + Valerianae)
    const src = whole ? text : cleanLa(text);
    const words = src.split(/[\s,;]+/).filter(w => /[A-Za-z]/.test(w));
    if (words.length < 2 || words.length > 12) return null;
    const urls = words.map(w => clip(tr(cleanLa(w)).say));
    return urls.every(Boolean) ? urls : null;
  }
  function say(text, lang, opt) {
    const whole = !!(opt && opt.whole);
    stop();
    const rec = recorded(text, lang, whole);
    if (rec) { playQueue(rec); return true; }
    if (!hasSynth) { toast('Для этого текста нет записи, а голос в этом браузере недоступен'); return false; }
    if (!voice) pickVoice();
    const t = lang === 'la' ? tr(whole ? text : cleanLa(text)).say : (whole ? text : cleanRu(text));
    if (!t) return false;
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'ru-RU'; if (voice) u.voice = voice;
    u.rate = (opt && opt.rate) || (lang === 'la' ? 0.8 : 0.95);
    synth.speak(u);
    if (!voice && !say.warned) { say.warned = true; setTimeout(() => { if (!pickVoice()) toast('На устройстве не найден русский голос — произношение может быть неточным. Его можно установить в настройках «Синтез речи».'); }, 400); }
    return true;
  }
  function toast(msg) {
    let t = document.getElementById('say-toast');
    if (!t) { t = document.createElement('div'); t.id = 'say-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toast.tm); toast.tm = setTimeout(() => t.classList.remove('on'), 4000);
  }

  const ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
  function btn(text, lang, cls) {
    if (!ok) return '';
    return '<button type="button" class="say' + (cls ? ' ' + cls : '') + '" data-say="' + esc(text) + '" data-lang="' + (lang || 'la') + '" title="Прослушать" aria-label="Прослушать">' + ICON + '</button>';
  }
  function trHtml(latin) {
    const r = tr(cleanLa(latin));
    return '<span class="trs" title="' + (r.certain ? 'Произношение по правилам чтения' : 'Ударение по правилам определить нельзя — смотрите знак долготы в словаре') + '">[' + esc(r.text) + ']</span>';
  }

  // клики по кнопкам и примерам с data-say (в фазе перехвата, чтобы не открывались карточки словаря)
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-say]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    let text = b.dataset.say;
    if (b.dataset.sayFrom) { // текст берётся из поля: весь ввод или латинский результат перевода
      const el = document.querySelector(b.dataset.sayFrom);
      text = !el ? '' : el.tagName === 'TEXTAREA' ? el.value : [...el.querySelectorAll('.tw.ok')].map(x => x.textContent).join(' ');
      if (!text.trim()) { toast('Сначала введите текст'); return; }
      text = text.replace(/\n+/g, ', ');
    }
    say(text, b.dataset.lang || 'la', { whole: !!b.dataset.sayFrom });
    b.classList.add('playing'); setTimeout(() => b.classList.remove('playing'), 900);
  }, true);

  function init() {
    if (!ok) return;
    const add = (host, before, from, title) => {
      if (!host || host.querySelector('.say-io')) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'say say-io'; b.dataset.say = ''; b.dataset.lang = 'la'; b.dataset.sayFrom = from; b.title = title; b.setAttribute('aria-label', title);
      b.innerHTML = ICON;
      host.insertBefore(b, before ? host.querySelector(before) : null);
    };
    add(document.querySelector('#p-la .io-h'), '.photo-btn, .clear', '#la-in', 'Прослушать латинский текст');
    add(document.querySelector('#p-ru .io-actions'), '.swap', '#ru-out', 'Прослушать перевод');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.Speech = { ok, tr, say, stop, fnv, btn, trHtml, cleanLa, cleanRu, ICON, toast };
})();
