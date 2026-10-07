/* Грамматика: правила чтения и ударения (Глоссарий СБМК, таблицы №1–3),
   тренажёр ударений и проверка ударения в любом слове. Движок — js/stress.js */
(function () {
  'use strict';
  const S = window.Stress;
  if (!S) return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const root = () => $('#gr-root');

  /* ---------- Слова для тренажёра ----------
     Знак ¯ (ā) или ˘ (ă) ставится только там, где долготу нельзя определить по правилам положения и суффиксов. */
  const GROUPS = [
    { id: 'two', title: 'Двусложные слова', rule: 'ударение на первом слоге' },
    { id: 'diph', title: 'Дифтонг во 2-м слоге от конца', rule: 'слог долгий' },
    { id: 'cc', title: 'Перед двумя согласными', rule: 'слог долгий' },
    { id: 'xz', title: 'Перед x и z', rule: 'слог долгий' },
    { id: 'suf-long', title: 'Долгие суффиксы (-āl-, -ār-, -āt-, -īn-, -īv-, -ōs-, -ūr-, -ūt-, -itis, -oma)', rule: 'слог долгий' },
    { id: 'vv', title: 'Гласный перед гласным', rule: 'слог краткий' },
    { id: 'mcl', title: 'Немой + плавный (b, p, t, d, c, g + l, r)', rule: 'слог краткий' },
    { id: 'suf-short', title: 'Краткие суффиксы (-ĭc-, -ĭd-, -ĭl-, -ŏl-, -ŭl-, -cŭl-)', rule: 'слог краткий' },
    { id: 'nat', title: 'Долгота и краткость по природе (знаки ¯ и ˘), диграфы ch, ph, rh, th', rule: 'по знаку в словаре' }
  ];
  const W = {
    two: 'vena|вена; herba|трава; dosis|доза; radix|корень; aqua|вода; hepar|печень; cito|быстро; Mentha|мята; auris|ухо; lingua|язык; costa|ребро; herpes|лишай',
    diph: 'lagoena|бутыль; diaeta|диета; Althaea|алтей; peritonaeum|брюшина; diarrhoea|понос; dysmenorrhoea|дисменорея; Crataegus|боярышник',
    cc: 'linimentum|жидкая мазь; tabuletta|таблетка; unguentum|мазь; medicamentum|лекарство; Belladonna|красавка; extractum|экстракт; decoctum|отвар; emulsum|эмульсия; argentum|серебро; Chamomilla|ромашка; Eucalyptus|эвкалипт',
    xz: 'reflexus|отражённый; oryza|рис; Glycyrrhiza|солодка; complexus|сложный',
    'suf-long': 'tinctura|настойка; mixtura|микстура; palatinus|нёбный; aquosus|водный; gastritis|гастрит; carcinoma|рак; sclerosis|склероз; vitaminum|витамин; Glycerinum|глицерин; Novocainum|новокаин; nasalis|носовой; vulgaris|обыкновенный; destillatus|дистиллированный; laxativus|слабительный; acutus|острый; cholelithiasis|желчнокаменная болезнь; hepatitis|гепатит; glaucoma|глаукома; depuratus|очищенный',
    vv: 'solutio|раствор; arteria|артерия; oleum|масло; cranium|череп; folium|лист; Salvia|шалфей; Tilia|липа; combustio|ожог; Convallaria|ландыш; pneumonia|пневмония; tachycardia|тахикардия; anaemia|анемия; suppositorium|свеча; chloroformium|хлороформ; Hippophaë|облепиха; osseus|костный; Aloë|алоэ',
    mcl: 'vertebra|позвонок; palpebra|веко; cerebrum|большой мозг; ephedra|эфедра; multiplex|множественный',
    'suf-short': 'liquidus|жидкий; phaseolus|фасоль; musculus|мышца; Calendula|календула; Frangula|крушина; Foeniculum|укроп; corpusculum|тельце; globulus|шарик; volatilis|летучий; solubilis|растворимый; frigidus|холодный; medicus|врачебный; Hypericum|зверобой; boricus|борный',
    nat: 'albūmen|белок; lamĭna|пластинка; Valeriāna|валериана; Plantāgo|подорожник; Urtīca|крапива; Equisētum|хвощ; spirĭtus|спирт; Ricĭnus|клещевина; amy̆lum|крахмал; camphŏra|камфора; infūsum|настой; Taraxăcum|одуванчик; quadrĭceps|четырёхглавый; acĭdum|кислота; oesophăgus|пищевод; stomăchus|желудок; nephrolĭthus|почечный камень; paraly̆sis|паралич; abdōmen|живот; forāmen|отверстие; Papāver|мак; Junipĕrus|можжевельник; systēma|система'
  };
  const WORDS = [];
  Object.keys(W).forEach(g => W[g].split(/;\s*/).forEach(x => { const [w, ru] = x.split('|'); WORDS.push({ w: w.normalize('NFC'), ru, g }); }));
  WORDS.forEach(x => { x.a = S.analyze(x.w); x.core = true; });

  /* Частые слова, где суффиксное правило не работает (корень, а не суффикс) — долгота по природе */
  const NAT = 'urtīca vesīca formīca lorīca lectīca trigemĭnus geminus|gemĭnus lamĭna pagĭna femĭna machĭna sarcĭna febrīlis senīlis juvenīlis virīlis puerīlis civīlis subtīlis hostīlis infantīlis sterĭlis trachēa glutēus peronēus chorēa'
    .split(' ').reduce((m, x) => { const [k, v] = x.includes('|') ? x.split('|') : [S.plain(x), x]; m[k] = v.normalize('NFC'); return m; }, {});
  function natForm(word) {
    const k = S.plain(word).toLowerCase(), v = NAT[k];
    if (!v || S.plain(word) !== word) return word;
    return word[0] === word[0].toUpperCase() ? v[0].toUpperCase() + v.slice(1) : v;
  }

  /* Слова из общего словаря переводчика: берём только те, где правило даёт однозначный ответ */
  const DICT = [];
  (function () {
    const T = window.Translator; if (!T || !T.entries) return;
    const seen = new Set(WORDS.map(x => S.plain(x.w).toLowerCase()));
    const ruClean = r => { r = String(r).replace(/^\s*(глаг|прил|сущ|нареч|предл|мест|числ)\.\s*[;,]?\s*/i, '').split(/[;(]/)[0].trim(); if (r.length > 40) r = r.slice(0, 40).replace(/,[^,]*$/, '').trim(); return r; };
    const groupFor = (a, w) => {
      if (a.n < 2 || !a.certain) return null;
      if (a.code === 'two') return 'two';
      if (a.code === 'nat-long' || a.code === 'nat-short') return 'nat';
      if (a.code === 'suf') {
        const lw = w.toLowerCase();
        if (/īn-/.test(a.rule) && !/inum$/.test(lw)) return null;      // geminus, lamina, pagina — ненадёжно
        if (/ĭc-/.test(a.rule) && /ic(a|ae)$/.test(lw)) return null;   // Urtica, vesica — корень, а не суффикс
        if (/ĭl-/.test(a.rule) && !/bil(is|e)$/.test(lw)) return null; // febrilis, senilis — долгие
        return a.idx === a.n - 2 ? 'suf-long' : 'suf-short';
      }
      return ['diph', 'cc', 'xz', 'vv', 'mcl'].includes(a.code) ? a.code : null;
    };
    T.entries.forEach(e => {
      let w = String(e.la || '').normalize('NFC').trim();
      if (!/^[A-Za-zāēīōūȳăĕĭŏŭëäöü]{4,}$/.test(w)) return;
      const k = S.plain(w).toLowerCase(); if (seen.has(k)) return;
      if (/^[A-Z]{2}/.test(w)) return;
      w = natForm(w);
      const a = S.analyze(w), g = groupFor(a, w);
      const ru = ruClean(e.ru || '');
      if (!g || !ru) return;
      seen.add(k); DICT.push({ w, ru, g, a });
    });
  })();

  /* ---------- настройки ---------- */
  const LS = 'sbmk-stress-v1';
  const st = Object.assign({ groups: GROUPS.map(g => g.id), count: 20, nums: true, dict: true }, load());
  function load() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(LS, JSON.stringify({ groups: st.groups, count: st.count, nums: st.nums, dict: st.dict })); } catch (e) { /* */ } }
  let view = 'rules', session = null;

  function nav() {
    const items = [['rules', 'Правила'], ['train', 'Тренажёр ударений'], ['check', 'Проверить слово']];
    return '<div class="gr-nav">' + items.map(([k, t]) => '<button class="tm' + (view === k ? ' on' : '') + '" data-gv="' + k + '">' + t + '</button>').join('') + '</div>';
  }
  function render() {
    if (view === 'rules') renderRules();
    else if (view === 'check') renderCheck();
    else if (session && session.i < session.deck.length) renderQ();
    else if (session) renderRes();
    else renderSetup();
    $$('[data-gv]').forEach(b => b.onclick = () => { view = b.dataset.gv; if (session && session.i >= session.deck.length) session = null; render(); });
  }

  /* ---------- слова со слогами и ударением ---------- */
  function sylHtml(word, opt) {
    opt = opt || {};
    const a = S.analyze(word);
    const n = a.syl.length;
    if (opt.noStress) a.idx = -1;
    return '<span class="syl-word">' + a.syl.map((s, i) => '<span class="syl-s' + (i === a.idx ? ' st' : '') + '">' + esc(i === a.idx ? S.accentSyl(s) : S.plain(s)) + (opt.nums ? '<sub>' + (n - i) + '</sub>' : '') + '</span>').join('<span class="syl-d">-</span>') + '</span>';
  }
  const ex = (w, nums) => '<i class="gr-ex' + (window.Speech && Speech.ok ? ' say-ex' : '') + '" data-say="' + esc(w) + '" data-lang="la" title="Прослушать">' + sylHtml(w, { nums: nums !== false }) + '</i>';

  /* ---------- Правила ---------- */
  function renderRules() {
    let h = nav();
    h += '<div class="prose gr-prose">';
    h += '<h2>Ударение в латинском языке</h2>' +
      '<div class="gr-rules"><div class="gr-rule"><b>1</b><div>Ударение <u>никогда не ставится на последний слог</u>.</div></div>' +
      '<div class="gr-rule"><b>2</b><div>В <b>двусложных</b> словах ударение всегда на <b>первом</b> слоге: ' + ex('vena') + ', ' + ex('herba') + ', ' + ex('dosis') + '.</div></div>' +
      '<div class="gr-rule"><b>3</b><div>В словах из <b>трёх и более</b> слогов всё решает <b>2-й слог от конца</b>: если он <b>долгий</b> — ударение на нём, если <b>краткий</b> — на 3-м слоге от конца. ' + ex('linimentum') + ' (2-й слог долгий), ' + ex('arteria') + ' (2-й слог краткий).</div></div></div>' +
      '<p class="muted small">Слоги считают <b>с конца</b> слова — цифры под слогами показывают номер слога от конца, как в таблице глоссария. В слове столько слогов, сколько в нём гласных и дифтонгов.</p>';

    h += '<h3>Долгота и краткость 2-го слога от конца</h3><p class="muted small">Таблица №3 глоссария СБМК.</p>' +
      '<div class="grid2 gr-two"><div class="tr-card"><h4 class="gr-h good">Слог долгий (ударный)</h4><ol class="gr-list">' +
      '<li><b>Дифтонг</b> ae, oe, au, eu: ' + ex('lagoena') + ', ' + ex('diaeta') + '</li>' +
      '<li>Гласный перед <b>двумя или группой согласных</b>: ' + ex('linimentum') + ', ' + ex('tabuletta') + '</li>' +
      '<li>Гласный перед буквами <b>x</b> и <b>z</b> (это двойные согласные [кс], [дз]): ' + ex('reflexus') + ', ' + ex('oryza') + '</li>' +
      '<li>Гласный под знаком <b>природной (исторической) долготы</b> ¯: ' + ex('albūmen') + '</li>' +
      '<li><b>Суффиксы</b> -āl-, -ār-, -āt-, -īn-, -īv-, -ōs-, -ūr-, -ūt-, а также <b>-itis</b>, <b>-oma</b>: ' + ex('tinctura') + ', ' + ex('palatinus') + ', ' + ex('aquosus') + ', ' + ex('gastritis') + '</li>' +
      '</ol></div><div class="tr-card"><h4 class="gr-h bad">Слог краткий (безударный)</h4><ol class="gr-list">' +
      '<li>Гласный <b>перед другим гласным</b> (в т. ч. перед h): ' + ex('arteria') + ', ' + ex('solutio') + '</li>' +
      '<li>Гласный перед сочетанием <b>b, p, t, d, c, g + l, r</b> («немой + плавный»): ' + ex('ephedra') + ', ' + ex('multiplex') + '</li>' +
      '<li>Перед <b>диграфами ch, ph, rh, th</b> — они обозначают один звук и долготы не дают: ' + ex('oesophăgus') + ', ' + ex('stomăchus') + '</li>' +
      '<li>Гласный под знаком <b>природной краткости</b> ˘: ' + ex('lamĭna') + '</li>' +
      '<li><b>Суффиксы</b> -ĭc-, -ĭd-, -ĭl-, -ŏl-, -ŭl-, -cŭl-: ' + ex('liquidus') + ', ' + ex('phaseolus') + ', ' + ex('musculus') + '</li>' +
      '</ol></div></div>' +
      '<p class="muted small">Если ни одно правило не подходит (после гласного одна согласная, суффикса нет), долготу узнают по словарю — там над гласным стоит знак ¯ или ˘. Поэтому в тренажёре такие слова даны со знаком: <i>Valeriāna</i>, <i>spirĭtus</i>.</p>';

    if (window.Speech && Speech.ok) h += '<p class="gr-saynote">' + Speech.ICON + ' Нажмите на любой латинский пример на этой странице, чтобы услышать, как он читается.</p>';
    h += '<h3>Таблица №1. Алфавит</h3><div class="tr-scroll"><table class="tr-table gr-table"><thead><tr><th>Буква</th><th>Название</th><th>Произношение</th><th>Когда</th></tr></thead><tbody>' + ALPHABET.map(r => '<tr><td class="la">' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>').join('') + '</tbody></table></div>';
    h += '<h3>Таблица №2. Дифтонги, диграфы, буквосочетания</h3><div class="tr-scroll"><table class="tr-table gr-table"><thead><tr><th>Сочетание</th><th>Произношение</th><th>Условие</th><th>Пример</th></tr></thead><tbody>' + DIGR.map(r => '<tr><td class="la">' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td class="la">' + (window.Speech && Speech.ok ? r[3].replace(/([A-Za-zÀ-ž]+)(?= \[)/g, w => '<span class="say-ex" data-say="' + w + '" data-lang="la" title="Прослушать">' + w + '</span>') : r[3]) + '</td></tr>').join('') + '</tbody></table></div>';
    h += '<p class="muted small">Источник: Глоссарий СБМК по дисциплине «Основы латинского языка с медицинской терминологией» (2026), таблицы №1–3.</p></div>';
    h += '<div class="tr-bar gr-static"><button class="btn" data-gv="train">Потренироваться ставить ударения →</button></div>';
    root().innerHTML = h;
  }
  const ALPHABET = [
    ['Aa', 'а', '[а]', 'всегда'], ['Bb', 'бэ', '[б]', 'всегда'], ['Cc', 'цэ', '[ц]<br>[к]', 'перед <b>e, i, y, ae, oe</b><br>в остальных случаях'], ['Dd', 'дэ', '[д]', 'всегда'],
    ['Ee', 'э', '[э]', 'всегда'], ['Ff', 'эф', '[ф]', 'всегда'], ['Gg', 'гэ', '[г]', 'всегда'], ['Hh', 'ха', 'как нем. h (лёгкий выдох)', 'всегда'], ['Ii', 'и', '[и]', 'всегда'],
    ['Jj', 'йот', '[й]', 'всегда'], ['Kk', 'ка', '[к]', 'всегда'], ['Ll', 'эль', '[л’] [ль]', 'всегда'], ['Mm', 'эм', '[м]', 'всегда'], ['Nn', 'эн', '[н]', 'всегда'],
    ['Oo', 'о', '[о]', 'всегда'], ['Pp', 'пэ', '[п]', 'всегда'], ['Qq', 'ку', '[кв]', 'в сочетании <b>qu</b>'], ['Rr', 'эр', '[р]', 'всегда'],
    ['Ss', 'эс', '[з]<br>[с]', '1) между гласными; 2) между гласным и <b>m, n</b><br>в остальных случаях'], ['Tt', 'тэ', '[т]', 'всегда'], ['Uu', 'у', '[у]', 'всегда'],
    ['Vv', 'вэ', '[в]', 'всегда'], ['Xx', 'икс', '[кс]', 'всегда'], ['Yy', 'ипсилон', '[и]', 'всегда'], ['Zz', 'зэта', '[з]', 'всегда (кроме <i>Zincum</i> — [ц]инк)']
  ];
  const DIGR = [
    ['ae', '[э]', 'всегда', 'diaeta [э]'], ['aë', '[аэ]', 'с точками — раздельно', 'aër [аэ]'], ['oe', '[э]', 'всегда', 'Foeniculum [э]'], ['oë', '[оэ]', 'с точками — раздельно', 'dyspnoë [оэ]'],
    ['au', '[ау]', 'всегда', 'auris [ау]'], ['eu', '[эу]', 'всегда (дифтонг)', 'pleuritis [эу]'], ['eu', '[э-у]', 'на стыке суффикса и окончания (два слога)', 'osseus [э-у]'],
    ['ch', '[х]', 'всегда', 'chorda [х]'], ['ph', '[ф]', 'всегда', 'Phosphorus [ф]'], ['rh', '[р]', 'всегда', 'rhizoma [р]'], ['th', '[т]', 'всегда', 'thorax [т]'],
    ['qu', '[кв]', 'всегда', 'quadriceps [кв]'], ['ngu', '[нгу]<br>[нгв]', 'перед согласным<br>перед гласным', 'lingula [нгу]<br>lingua [нгв]'],
    ['ti', '[ти]<br>[ци]', 'после s, x и перед согласным<br>перед гласным', 'ostium [ти]<br>operatio [ци]']
  ];

  /* ---------- Тренажёр: настройки ---------- */
  function all() { return st.dict ? WORDS.concat(DICT) : WORDS; }
  function pool() { return all().filter(x => st.groups.includes(groupOf(x))); }
  function groupOf(x) { return x.g; }
  function renderSetup() {
    let h = nav() + '<p class="lead">Нажмите на слог, на который падает ударение. Если ошибётесь, тренажёр покажет, куда правильно поставить ударение и по какому правилу.</p>';
    h += '<div class="tr-group"><div class="tr-gh"><h3>Правила</h3><button class="link" id="gr-all">выбрать все / снять</button></div><div class="tr-checks">' +
      GROUPS.map(g => '<label class="tr-check"><input type="checkbox" data-gg="' + g.id + '"' + (st.groups.includes(g.id) ? ' checked' : '') + '><span>' + esc(g.title) + ' <em>' + all().filter(x => x.g === g.id).length + '</em><br><small class="muted">' + esc(g.rule) + '</small></span></label>').join('') + '</div></div>';
    h += '<div class="tr-card tr-settings"><div class="tr-row"><span>Сколько слов</span><div class="tr-seg gr-seg">' +
      [10, 20, 40, 0].map(c => '<label><input type="radio" name="gr-c" value="' + c + '"' + (st.count === c ? ' checked' : '') + '> ' + (c ? c : 'все выбранные') + '</label>').join('') + '</div></div>' +
      '<div class="tr-row"><span>Какие слова</span><label class="tr-pill"><input type="checkbox" id="gr-dict"' + (st.dict ? ' checked' : '') + '> добавить слова из словаря переводчика (+' + DICT.length + ')</label></div>' +
      '<div class="tr-row"><span>Подсказка</span><label class="tr-pill"><input type="checkbox" id="gr-nums"' + (st.nums ? ' checked' : '') + '> номера слогов от конца</label></div></div>';
    h += '<div class="tr-bar"><span id="gr-sel"></span><button class="btn" id="gr-start">Начать</button></div>';
    root().innerHTML = h;
    const upd = () => { const n = pool().length; $('#gr-sel').textContent = 'Выбрано слов: ' + n; $('#gr-start').disabled = !n; };
    $$('[data-gg]').forEach(c => c.onchange = () => { st.groups = $$('[data-gg]').filter(x => x.checked).map(x => x.dataset.gg); save(); upd(); });
    $('#gr-all').onclick = () => { st.groups = st.groups.length === GROUPS.length ? [] : GROUPS.map(g => g.id); save(); renderSetup(); };
    $$('[name=gr-c]').forEach(r => r.onchange = () => { st.count = +r.value; save(); });
    $('#gr-nums').onchange = e => { st.nums = e.target.checked; save(); };
    $('#gr-dict').onchange = e => { st.dict = e.target.checked; save(); renderSetup(); };
    $('#gr-start').onclick = () => start(pool());
    upd();
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function start(list) {
    let deck = shuffle(list.slice());
    if (st.count && deck.length > st.count) deck = deck.slice(0, st.count);
    session = { deck, i: 0, log: [], answered: false };
    render();
  }

  /* ---------- Тренажёр: вопрос ---------- */
  function renderQ() {
    const s = session, x = s.deck[s.i], a = x.a, n = a.syl.length;
    const ok = s.log.filter(l => l.ok).length;
    let h = nav() + '<div class="tr-prog"><div style="width:' + (100 * s.i / s.deck.length) + '%"></div></div>' +
      '<div class="tr-meta"><span>' + (s.i + 1) + ' / ' + s.deck.length + '</span><span>верно: ' + ok + ' · ошибок: ' + (s.log.length - ok) + '</span></div>' +
      '<div class="tr-card tr-q"><div class="tr-label">Где ударение?</div><div class="tr-src">' + esc(x.ru) + '</div>' +
      '<div class="syl-row" id="gr-syl">' + a.syl.map((sy, i) => '<button class="syl" data-i="' + i + '">' + esc(sy) + (st.nums ? '<sub>' + (n - i) + '</sub>' : '') + '</button>').join('') + '</div>' +
      '<div id="gr-fb"></div></div>' +
      '<div class="tr-bar"><button class="btn ghost" id="gr-stop">Закончить</button></div>';
    root().innerHTML = h;
    $$('#gr-syl .syl').forEach(b => b.onclick = () => answer(+b.dataset.i));
    $('#gr-stop').onclick = () => { s.deck = s.deck.slice(0, s.i); render(); };
    bindNav();
  }
  function bindNav() { $$('[data-gv]').forEach(b => b.onclick = () => { view = b.dataset.gv; if (session && session.i >= session.deck.length) session = null; render(); }); }
  function mistakeHint(a, pick) {
    const n = a.syl.length, fromEnd = n - pick; // 1 = последний
    if (fromEnd === 1) return 'Вы поставили ударение на последний слог, а на последний слог в латыни ударение не падает.';
    if (fromEnd > 3) return 'Ударение не может стоять дальше 3-го слога от конца.';
    if (n === 2) return '';
    if (fromEnd === 2) return 'Вы выбрали 2-й слог от конца, но он краткий, поэтому ударение уходит на 3-й слог от конца.';
    if (fromEnd === 3) return 'Вы выбрали 3-й слог от конца, но 2-й слог от конца долгий, поэтому ударение на нём.';
    return '';
  }
  function answer(pick) {
    const s = session; if (s.answered) return;
    s.answered = true;
    const x = s.deck[s.i], a = x.a, good = pick === a.idx;
    s.log.push({ x, ok: good, pick });
    $$('#gr-syl .syl').forEach((b, i) => { b.disabled = true; if (i === a.idx) b.classList.add('ok'); if (i === pick && !good) b.classList.add('bad'); });
    const fb = $('#gr-fb');
    fb.className = 'tr-fb ' + (good ? 'good' : 'bad');
    fb.innerHTML = (good ? '✓ Верно: ' : '✗ Неверно. Правильно: ') + '<b class="gr-ans">' + esc(S.accented(x.w, a)) + '</b> <span class="muted">(' + esc(a.syl.map(S.plain).join('-')) + ')</span>' +
      (window.Speech ? ' ' + Speech.trHtml(x.w) + Speech.btn(x.w, 'la') : '') +
      (!good && mistakeHint(a, pick) ? '<div class="gr-hint">' + esc(mistakeHint(a, pick)) + '</div>' : '') +
      '<div class="gr-why"><b>Почему:</b><ol>' + a.steps.map(t => '<li>' + esc(t) + '</li>').join('') + '</ol></div>' +
      '<button class="btn" id="gr-next">Дальше →</button><div class="muted small">Enter — дальше</div>';
    $('#gr-next').onclick = next; $('#gr-next').focus();
  }
  function next() { session.i++; session.answered = false; render(); }

  /* ---------- Тренажёр: итоги ---------- */
  function renderRes() {
    const s = session, total = s.log.length, ok = s.log.filter(l => l.ok).length, pct = total ? Math.round(100 * ok / total) : 0;
    const bad = s.log.filter(l => !l.ok);
    let h = nav() + '<div class="tr-card tr-res"><div class="tr-score"><b>' + pct + '%</b><span>' + ok + ' из ' + total + ' верно</span></div>';
    const byG = new Map();
    s.log.forEach(l => { const g = byG.get(l.x.g) || { n: 0, bad: 0 }; g.n++; if (!l.ok) g.bad++; byG.set(l.x.g, g); });
    if (byG.size > 1) h += '<h4>По правилам</h4><ul class="tr-srcs">' + [...byG.entries()].sort((a, b) => b[1].bad / b[1].n - a[1].bad / a[1].n).map(([k, v]) => '<li><span>' + esc(GROUPS.find(g => g.id === k).title) + '</span><span class="bar"><i style="width:' + Math.round(100 * (v.n - v.bad) / v.n) + '%"></i></span><b>' + Math.round(100 * (v.n - v.bad) / v.n) + '%</b></li>').join('') + '</ul>';
    if (bad.length) h += '<h4>Ошибки (' + bad.length + ')</h4><table class="tr-table"><thead><tr><th>Слово</th><th>Правильно</th><th>Ваш ответ</th><th>Правило</th></tr></thead><tbody>' +
      bad.map(l => '<tr><td class="la">' + esc(S.plain(l.x.w)) + '<div class="muted small">' + esc(l.x.ru) + '</div></td><td class="la"><b>' + esc(S.accented(l.x.w, l.x.a)) + '</b></td><td class="bad-ans">' + esc(S.accented(l.x.w, Object.assign({}, l.x.a, { idx: l.pick }))) + '</td><td class="small">' + esc(ruleText(l.x.a)) + '</td></tr>').join('') + '</tbody></table>';
    else if (total) h += '<p>Без ошибок — отлично!</p>';
    h += '</div><div class="tr-bar">' + (bad.length ? '<button class="btn" id="gr-again-bad">Повторить ошибки</button>' : '') + '<button class="btn ghost" id="gr-again">Ещё раз</button><button class="btn ghost" id="gr-new">Другие правила</button></div>';
    root().innerHTML = h;
    bindNav();
    const rb = $('#gr-again-bad'); if (rb) rb.onclick = () => start(bad.map(l => l.x));
    $('#gr-again').onclick = () => start(pool());
    $('#gr-new').onclick = () => { session = null; render(); };
  }
  function ruleText(a) {
    if (a.code === 'two' || a.code === 'one') return a.rule + ' — ударение на первом слоге';
    return '2-й слог от конца ' + (a.idx === a.syl.length - 2 ? 'долгий' : 'краткий') + ': ' + a.rule;
  }

  /* ---------- Проверить слово ---------- */
  let checkVal = 'linimentum';
  function renderCheck() {
    let h = nav() + '<div class="tr-card gr-check"><label class="tr-label" for="gr-in">Введите латинское слово</label>' +
      '<form id="gr-form" autocomplete="off"><input id="gr-in" class="tr-in la" spellcheck="false" autocapitalize="off" value="' + esc(checkVal) + '" placeholder="например, tinctura"></form>' +
      '<p class="muted small">Знаки долготы можно поставить так: ā, ē, ī, ō, ū (долгий), ă, ĕ, ĭ, ŏ, ŭ (краткий). Без знака сайт применяет правила положения и суффиксов.</p><div id="gr-out"></div></div>';
    root().innerHTML = h;
    bindNav();
    const inp = $('#gr-in');
    const run = () => { checkVal = inp.value; $('#gr-out').innerHTML = checkHtml(inp.value.trim()); };
    inp.addEventListener('input', run);
    $('#gr-form').onsubmit = e => { e.preventDefault(); run(); };
    run();
  }
  function checkHtml(w) {
    if (!w || !/[a-zA-Zāēīōūȳăĕĭŏŭ]/.test(w)) return '';
    const words = w.split(/\s+/).filter(Boolean).slice(0, 6);
    return words.map(word => {
      // если слово есть в тренажёре со знаком долготы — берём его (Valeriana → Valeriāna)
      const known = WORDS.find(x => S.plain(x.w).toLowerCase() === S.plain(word).toLowerCase());
      if (known && known.w !== word) word = known.w;
      else word = natForm(word);
      const a = S.analyze(word);
      let h = '<div class="gr-res"><div class="gr-big">' + (a.certain ? esc(S.accented(word, a)) : esc(S.accented(word, a)) + ' <span class="muted">или</span> ' + esc(S.accented(word, Object.assign({}, a, { idx: a.alt })))) + '</div>' +
        '<div class="gr-sylline">' + sylHtml(word, { nums: true, noStress: !a.certain }) + '</div>' +
        (window.Speech ? '<div class="gr-say">Читается: ' + Speech.trHtml(word) + Speech.btn(word, 'la') + '</div>' : '') +
        '<ol class="gr-steps">' + a.steps.map(t => '<li>' + esc(t) + '</li>').join('') + '</ol>';
      if (a.code === 'suf') h += '<p class="muted small">Правило суффиксов действует, только если это действительно суффикс, а не часть корня. Проверьте по словарю.</p>';
      return h + '</div>';
    }).join('');
  }

  /* ---------- запуск ---------- */
  function init() {
    if (!root()) return;
    render();
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter' || view !== 'train' || !session || !session.answered) return;
      if ($('#p-gram') && $('#p-gram').hidden) return;
      ev.preventDefault(); next();
    });
  }
  window.Grammar = { WORDS, DICT, GROUPS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
