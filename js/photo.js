/* Перевод по фото (тестовая функция).
   Распознавание текста — Tesseract.js (Apache-2.0), работает прямо в браузере: фото никуда не отправляется.
   Файлы библиотеки и модель латинского языка лежат в vendor/tesseract и загружаются только при первом использовании. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const T = window.Translator, M = window.Morph;
  if (!T || !M) return;
  const abs = p => new URL(p, location.href).href;
  let worker = null, loading = null, busy = false;

  /* ---------- окно ---------- */
  function ui() {
    let m = $('#photo-modal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'photo-modal'; m.className = 'modal'; m.hidden = true;
    m.innerHTML = '<div class="modal-card ph-card" role="dialog" aria-modal="true" aria-labelledby="ph-title">' +
      '<button class="modal-x" data-close aria-label="Закрыть">×</button>' +
      '<h3 id="ph-title" class="ph-title">Перевод по фото <span class="ph-beta">тестовая функция</span></h3>' +
      '<p class="ph-note">Функция пока работает в тестовом режиме. Лучше всего распознаётся <b>печатный</b> латинский текст: учебник, этикетка, напечатанный рецепт. Рукописный текст почти не распознаётся. Обязательно проверьте текст перед переводом.</p>' +
      '<label class="btn ph-pick"><input type="file" accept="image/*" id="ph-file" hidden>' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg> <span>Сфотографировать или выбрать фото</span></label>' +
      '<p class="muted small ph-tips">Советы: снимайте ровно, при хорошем свете, чтобы текст был крупным и резким. Можно заранее обрезать фото до нужного фрагмента.</p>' +
      '<div id="ph-work" hidden><img id="ph-img" alt="Выбранное фото"><div class="ph-prog"><div id="ph-bar"></div></div><div id="ph-status" class="muted small"></div></div>' +
      '<div id="ph-res" hidden><label class="tr-label" for="ph-text">Распознанный текст — исправьте, если нужно</label>' +
      '<textarea id="ph-text" spellcheck="false" rows="6"></textarea>' +
      '<div id="ph-fix" class="muted small"></div>' +
      '<div class="ph-actions"><button class="btn" id="ph-go">Перевести</button><label class="btn ghost ph-again"><input type="file" accept="image/*" id="ph-file2" hidden>Другое фото</label></div>' +
      '<details class="ph-raw"><summary class="small">Исходный текст распознавания</summary><pre id="ph-rawtext"></pre></details></div>' +
      '<p class="muted small ph-priv">Фото обрабатывается на вашем устройстве и никуда не отправляется. При первом запуске скачивается модель распознавания (около 6 МБ), потом она хранится в браузере.</p>' +
      '</div>';
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !m.hidden) close(); });
    const onFile = e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) run(f); };
    $('#ph-file', m).onchange = onFile; $('#ph-file2', m).onchange = onFile;
    $('#ph-go', m).onclick = () => {
      const txt = $('#ph-text').value.trim(); if (!txt) return;
      const tab = document.querySelector('[data-tab=la]'); if (tab) tab.click();
      const inp = $('#la-in'); inp.value = txt; inp.dispatchEvent(new Event('input', { bubbles: true }));
      close();
      setTimeout(() => { const o = document.querySelector('#p-la .out') || inp; o.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
    };
    return m;
  }
  function open() { const m = ui(); m.hidden = false; }
  function close() { const m = $('#photo-modal'); if (m) m.hidden = true; }
  function status(t, p) { $('#ph-status').textContent = t; if (p != null) $('#ph-bar').style.width = Math.round(p * 100) + '%'; }

  /* ---------- загрузка библиотеки ---------- */
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('не удалось загрузить ' + src)); document.head.appendChild(s); });
  }
  const STAGE = { 'loading tesseract core': 'Загрузка модуля распознавания', 'initializing tesseract': 'Подготовка', 'loading language traineddata': 'Загрузка модели латыни', 'loading language traineddata (from cache)': 'Загрузка модели латыни', 'initializing api': 'Подготовка', 'recognizing text': 'Распознавание текста' };
  function getWorker() {
    if (worker) return Promise.resolve(worker);
    if (loading) return loading;
    loading = (window.Tesseract ? Promise.resolve() : loadScript('vendor/tesseract/tesseract.min.js')).then(() =>
      window.Tesseract.createWorker('lat', 1, {
        workerPath: abs('vendor/tesseract/worker.min.js'),
        corePath: abs('vendor/tesseract/core'),
        langPath: abs('vendor/tesseract/lang'),
        logger: m => { if (busy) status((STAGE[m.status] || m.status) + '…', m.status === 'recognizing text' ? 0.3 + 0.7 * (m.progress || 0) : 0.3 * (m.progress || 0)); }
      })).then(w => { worker = w; return w; }).catch(e => { loading = null; throw e; });
    return loading;
  }

  /* ---------- подготовка фото: уменьшение/увеличение, оттенки серого, контраст ---------- */
  function prepare(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        $('#ph-img').src = url;
        const maxW = 2400, minW = 1400;
        let k = 1; if (img.width > maxW) k = maxW / img.width; else if (img.width < minW) k = Math.min(2, minW / img.width);
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
        const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
        let lo = 255, hi = 0; const g = new Uint8ClampedArray(p.length / 4);
        for (let i = 0, j = 0; i < p.length; i += 4, j++) { const v = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; g[j] = v; }
        const hist = new Array(256).fill(0); g.forEach(v => hist[v]++);
        let acc = 0; const n = g.length; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > n * 0.02) { lo = v; break; } }
        acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > n * 0.02) { hi = v; break; } }
        const span = Math.max(1, hi - lo);
        for (let i = 0, j = 0; i < p.length; i += 4, j++) { const v = Math.max(0, Math.min(255, (g[j] - lo) * 255 / span)); p[i] = p[i + 1] = p[i + 2] = v; }
        x.putImageData(d, 0, 0);
        res(c);
      };
      img.onerror = () => rej(new Error('не удалось открыть изображение'));
      img.src = url;
    });
  }

  /* ---------- исправление ошибок распознавания по словарю сайта ---------- */
  const keys = []; T.laIndex.forEach((v, k) => { if (/^[a-z]+$/.test(k)) keys.push(k); });
  const byLen = {}; keys.forEach(k => { (byLen[k.length] = byLen[k.length] || []).push(k); });
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < best) best = cur[j]; }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  const known = w => T.laIndex.has(M.normLa(w));
  function fixWord(w, edge) {
    if (w.length < 3 || known(w)) return { w, ok: known(w) };
    let k = M.normLa(w).replace(/0/g, 'o').replace(/1/g, 'l').replace(/5/g, 's').replace(/[^a-z]/g, '');
    const tries = [k, k.replace(/rn/g, 'm'), k.replace(/ii/g, 'u'), k.replace(/cl/g, 'd'), k.replace(/vv/g, 'w')];
    for (const t of tries) if (T.laIndex.has(t)) return { w: restoreCase(w, t), ok: true, fixed: true };
    if (edge && k.length >= 5) { // слово в начале строки могло обрезаться краем фото: «tebralis» → vertebralis
      const c = keys.filter(x => x.length > k.length && x.endsWith(k)).sort((a, b) => a.length - b.length);
      if (c.length) return { w: c[0], ok: true, fixed: true };
    }
    const max = k.length >= 8 ? 2 : k.length >= 4 ? 1 : 0;
    if (!max) return { w, ok: false };
    let best = null, bd = max + 1;
    for (let L = k.length - max; L <= k.length + max; L++) (byLen[L] || []).forEach(c => { if (bd === 0) return; const d = lev(k, c, Math.min(max, bd)); if (d < bd || (d === bd && best && c[0] === k[0] && best[0] !== k[0])) { bd = d; best = c; } });
    return best && bd <= max ? { w: restoreCase(w, best), ok: true, fixed: true } : { w, ok: false };
  }
  function restoreCase(orig, k) { return /^[A-Z]/.test(orig) ? k[0].toUpperCase() + k.slice(1) : k; }

  function clean(raw) {
    let t = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC')
      .replace(/[|]/g, 'l').replace(/[“”„«»"]/g, '')
      .replace(/(\w)[-‐‑­]\s*\n\s*(\w)/g, '$1$2')          // перенос слова: arte-\nria
      .replace(/\n\s*(?:\(?\d{0,3}\s*[).]\s*)?/g, m => m + '\u0001') // отмечаем начало строки фото
      .replace(/\s*\n\s*/g, ' ')
      .replace(/(^|[\s;,.\u0001])\(?\d{1,3}\s*[).]\s*/g, '$1\n')     // нумерация «1)», «2.»
      .replace(/\s*;\s*/g, '\n');
    let fixedN = 0;
    const lines = t.split('\n').map(line => {
      const words = line.trim().split(/\s+/).filter(Boolean);
      let okN = 0;
      const out = words.map(w => {
        const edge = w.includes('\u0001'); w = w.replace(/\u0001/g, '');
        const m = w.match(/^([^A-Za-z0-9]*)([A-Za-z0-9]+)([^A-Za-z0-9]*)$/);
        if (!m) return null;
        const r = fixWord(m[2], edge);
        if (!r.ok && r.w.length <= 2) return null;           // одиночные буквы-помехи
        if (r.ok && r.w.length >= 3) okN++; if (r.fixed) fixedN++;
        return /\d/.test(r.w) ? null : m[1].replace(/[^(]/g, '') + r.w + m[3].replace(/[^.,)!?]/g, '');
      }).filter(Boolean);
      // строки, где меньше половины слов есть в словаре (русские заголовки, мусор), убираем
      return okN && okN * 2 >= out.length ? out.join(' ').replace(/[,.]$/, '') : '';
    }).filter(Boolean);
    return { text: lines.join('\n'), fixedN };
  }

  async function run(file) {
    if (busy) return;
    busy = true;
    $('#ph-work').hidden = false; $('#ph-res').hidden = true;
    status('Подготовка фото…', 0.02);
    try {
      const canvas = await prepare(file);
      status(worker ? 'Распознавание текста…' : 'Загрузка модуля распознавания…', 0.05);
      const w = await getWorker();
      const { data } = await w.recognize(canvas);
      const raw = (data && data.text || '').trim();
      const r = clean(raw);
      $('#ph-rawtext').textContent = raw || '—';
      $('#ph-text').value = r.text;
      $('#ph-fix').textContent = r.text ? (r.fixedN ? 'Исправлено по словарю слов: ' + r.fixedN + '. ' : '') + 'Каждый термин — с новой строки.' : 'Латинский текст не найден. Попробуйте сфотографировать крупнее и ровнее.';
      $('#ph-res').hidden = false; $('#ph-work').hidden = true;
      $('#ph-go').disabled = !r.text;
    } catch (e) {
      status('Ошибка: ' + (e && e.message || e) + '. Проверьте подключение к интернету и попробуйте ещё раз.', 0);
    } finally { busy = false; }
  }

  function init() {
    const h = document.querySelector('#p-la .io-h'); if (!h || $('.photo-btn', h)) return;
    const b = document.createElement('button');
    b.className = 'photo-btn'; b.type = 'button'; b.title = 'Перевод по фото (тестовая функция)';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><span>Фото</span><em>тест</em>';
    b.onclick = open;
    h.insertBefore(b, $('.clear', h));
  }
  window.PhotoOCR = { clean, fixWord, open };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
