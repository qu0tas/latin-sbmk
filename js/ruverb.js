/* Русские глагольные формы для перевода латинских глаголов с учётом их формы:
   повелительное наклонение (Misce! — Смешай!), сослагательное в рецептах (Misceatur — Смешать),
   настоящее время (miscet — смешивает), страдательный залог (miscetur — смешивается). */
(function (global) {
  'use strict';
  const norm = s => String(s).toLowerCase().replace(/ё/g, 'е');
  // Совершенный вид, которым в рецептах и упражнениях переводят повелительное и сослагательное наклонение
  const PERF = {
    misceo: 'смешать', do: 'выдать', signo: 'обозначить', recipio: 'взять', colo: 'процедить', refrigero: 'охладить',
    repeto: 'повторить', steriliso: 'простерилизовать', paro: 'приготовить', praeparo: 'приготовить', filtro: 'профильтровать',
    solvo: 'растворить', tero: 'растереть', verto: 'перевернуть', obduco: 'покрыть оболочкой', addo: 'добавить',
    infundo: 'налить', exsicco: 'высушить', contundo: 'истолочь', concido: 'изрезать', divido: 'разделить', exprimo: 'выжать',
    extraho: 'извлечь', extendo: 'намазать', pono: 'положить', tingo: 'смочить', noto: 'заметить', macero: 'вымочить',
    formo: 'образовать', servo: 'сохранить', praescribo: 'прописать', corrigo: 'исправить', colligo: 'собрать', dignosco: 'распознать', nosco: 'познать', ausculto: 'выслушать'
  };
  // [1 л. ед., 2 л. ед., 3 л. мн., повелит.] или [6 форм наст. вр., повелит.] — неправильные и трудные глаголы (по окончанию слова)
  const IRR = {
    'пить': ['пью', 'пьешь', 'пьют', 'пей'], 'налить': ['налью', 'нальешь', 'нальют', 'налей'], 'кричать': ['кричу', 'кричишь', 'кричат', 'кричи'],
    'молчать': ['молчу', 'молчишь', 'молчат', 'молчи'], 'дышать': ['дышу', 'дышишь', 'дышат', 'дыши'], 'спать': ['сплю', 'спишь', 'спят', 'спи'],
    'держать': ['держу', 'держишь', 'держат', 'держи'], 'бороть': ['борю', 'борешь', 'борют', 'бори'], 'резать': ['режу', 'режешь', 'режут', 'режь'],
    'стоять': ['стою', 'стоишь', 'стоят', 'стой'], 'толочь': ['толку', 'толчешь', 'толкут', 'толки'], 'расти': ['расту', 'растешь', 'растут', 'расти'],
    'цвести': ['цвету', 'цветешь', 'цветут', 'цвети'], 'висеть': ['вишу', 'висишь', 'висят', 'виси'], 'видеть': ['вижу', 'видишь', 'видят', 'смотри'],
    'смотреть': ['смотрю', 'смотришь', 'смотрят', 'смотри'], 'вертеть': ['верчу', 'вертишь', 'вертят', 'верти'], 'растереть': ['разотру', 'разотрешь', 'разотрут', 'разотри'],
    'тереть': ['тру', 'трешь', 'трут', 'три'], 'мыть': ['мою', 'моешь', 'моют', 'мой'], 'писать': ['пишу', 'пишешь', 'пишут', 'пиши'],
    'класть': ['кладу', 'кладешь', 'кладут', 'клади'], 'брать': ['беру', 'берешь', 'берут', 'бери'], 'собрать': ['соберу', 'соберешь', 'соберут', 'собери'],
    'взять': ['возьму', 'возьмешь', 'возьмут', 'возьми'], 'жить': ['живу', 'живешь', 'живут', 'живи'], 'звать': ['зову', 'зовешь', 'зовут', 'зови'],
    'прятать': ['прячу', 'прячешь', 'прячут', 'прячь'], 'надеять': ['надею', 'надеешь', 'надеют', 'надей'], 'мазать': ['мажу', 'мажешь', 'мажут', 'мажь'],
    'выжать': ['выжму', 'выжмешь', 'выжмут', 'выжми'], 'извлечь': ['извлеку', 'извлечешь', 'извлекут', 'извлеки'], 'крыть': ['крою', 'кроешь', 'кроют', 'крой'],
    'дать': ['дам', 'дашь', 'даст', 'дадим', 'дадите', 'дадут', 'дай'], 'быть': ['есть', 'есть', 'есть', 'есть', 'есть', 'есть', 'будь'],
    'гнуть': ['гну', 'гнешь', 'гнут', 'гни'], 'хотеть': ['хочу', 'хочешь', 'хочет', 'хотим', 'хотите', 'хотят', 'хоти']
  };
  const PREF = /^(вы|при|от|ото|пере|за|из|ис|изо|раз|рас|разо|по|про|с|со|на|об|обо|до|у|в|во|вз|воз|под|подо|над|пред)$/;
  // основное значение для перевода, если первое значение словаря менее употребительно в медицине
  const IPF = { sumo: 'принимать' };
  // глаголы на -ить с ударением на основе: повелит. на -ь (приготовь, обозначь)
  const IMP_SOFT = /(готовить|значить|метить|бавить|править|ставить|бросить|чистить)$/;
  function irr(base) {
    for (const k of Object.keys(IRR).sort((a, b) => b.length - a.length)) {
      const pre = base.slice(0, base.length - k.length);
      if (base.endsWith(k) && (!pre || PREF.test(pre))) { // только с приставкой: вы-дать, из-резать, но не па-дать, слу-жить
        const v = IRR[k];
        const f = v.map(x => pre + x);
        if (f.length === 4) { const t = f[1].replace(/шь$/, ''); return { pres: [f[0], f[1], t + 'т', t + 'м', t + 'те', f[2]], imp: f[3] }; }
        return { pres: f.slice(0, 6), imp: f[6] };
      }
    }
    return null;
  }
  function soften1(st) { // чередование в 1 л. ед. ч. глаголов на -ить
    if (/ст$/.test(st)) return st.slice(0, -2) + 'щ';
    if (/зд$/.test(st)) return st.slice(0, -2) + 'зж';
    if (/д$/.test(st)) return st.slice(0, -1) + 'ж';
    if (/т$/.test(st)) return st.slice(0, -1) + 'ч';
    if (/с$/.test(st)) return st.slice(0, -1) + 'ш';
    if (/з$/.test(st)) return st.slice(0, -1) + 'ж';
    if (/[бпвмф]$/.test(st)) return st + 'л';
    return st;
  }
  const HUSH = /[жшчщ]$/;
  function conjBase(base) {
    const r = irr(base); if (r) return r;
    let m;
    if ((m = base.match(/^(.*)овать$/)) || (m = base.match(/^(.*[жшчщц])евать$/))) { const s = m[1] + 'у'; return { pres: [s + 'ю', s + 'ешь', s + 'ет', s + 'ем', s + 'ете', s + 'ют'], imp: s + 'й' }; }
    if ((m = base.match(/^(.*)авать$/))) { const s = m[1] + 'а'; return { pres: [s + 'ю', s + 'ешь', s + 'ет', s + 'ем', s + 'ете', s + 'ют'], imp: m[1] + 'авай' }; }
    if ((m = base.match(/^(.*[ая])ть$/)) || (m = base.match(/^(.*е)ть$/))) { const s = m[1]; return { pres: [s + 'ю', s + 'ешь', s + 'ет', s + 'ем', s + 'ете', s + 'ют'], imp: s + 'й' }; }
    if ((m = base.match(/^(.*)нуть$/))) { const s = m[1] + 'н'; return { pres: [s + 'у', s + 'ешь', s + 'ет', s + 'ем', s + 'ете', s + 'ут'], imp: s + 'и' }; }
    if ((m = base.match(/^(.*)ить$/))) {
      const st = m[1];
      if (/[аеиоуыэюя]$/.test(st)) return { pres: [st + 'ю', st + 'ишь', st + 'ит', st + 'им', st + 'ите', st + 'ят'], imp: st + 'й' };
      const s1 = soften1(st);
      return { pres: [s1 + (HUSH.test(s1) ? 'у' : 'ю'), st + 'ишь', st + 'ит', st + 'им', st + 'ите', st + (HUSH.test(st) ? 'ат' : 'ят')], imp: st + (IMP_SOFT.test(base) ? 'ь' : 'и') };
    }
    return null;
  }
  const cache = new Map();
  /* sense: «смешивать», «учиться», «покрывать оболочкой», «быть здоровым» */
  function conjugate(sense) {
    sense = norm(sense).trim();
    if (cache.has(sense)) return cache.get(sense);
    const words = sense.split(/\s+/);
    const head = words[0], tail = words.slice(1).join(' ');
    let res = null;
    if (/(ть|ти|чь)(ся|сь)?$/.test(head)) {
      const refl = /(ся|сь)$/.test(head);
      const base = refl ? head.slice(0, -2) : head;
      const c = conjBase(base);
      if (c) {
        const R = w => !refl ? w : w + (/[аеиоуыэюя]$/.test(w) ? 'сь' : 'ся');
        const add = w => tail ? w + ' ' + tail : w;
        const pres = c.pres.map(R);
        const impPl = c.imp + 'те';
        res = {
          inf: sense,
          pres: pres.map(add),
          imp: base === 'быть' && /^(здоровым|должным)$/.test(tail) ? (tail === 'здоровым' ? ['будь здоров', 'будьте здоровы'] : ['будь должен', 'будьте должны']) : [add(R(c.imp)), add(R(impPl))],
          pass: [add(c.pres[2] + 'ся'), add(c.pres[5] + 'ся')],
          part: base === 'быть' ? null : add(R(c.pres[5].replace(/т$/, 'щий')).replace(/щийсь$/, 'щийся')),
          be: base === 'быть'
        };
      }
    }
    cache.set(sense, res);
    return res;
  }
  /* Перевод латинской формы: e — словарная статья, vf — {mood, pass, p, n}, sense — русское значение */
  function translate(laLemma, sense, vf, opts) {
    opts = opts || {};
    const perf = PERF[norm(laLemma)];
    sense = IPF[norm(laLemma)] || sense;
    const ipf = conjugate(sense), pf = perf ? conjugate(perf) : null;
    const n = vf.n === 'pl' ? 1 : 0;
    const idx = (vf.p ? vf.p - 1 : 2) + (vf.n === 'pl' ? 3 : 0);
    if (!ipf) return null;
    switch (vf.mood) {
      case 'inf': return sense;
      case 'imp':
        if (opts.neg) return 'не ' + ipf.imp[n]; // noli + инфинитив
        return (pf || ipf).imp[n];
      case 'conj':
        if (vf.pass) return perf || sense; // Misceatur. Detur. — Смешать. Выдать.
        if (ipf.be) return 'пусть ' + (vf.n === 'pl' ? 'будут ' : 'будет ') + sense.split(/\s+/).slice(1).join(' ');
        return 'пусть ' + (pf || ipf).pres[idx];
      case 'part': return ipf.part || sense;
      default:
        if (vf.pass) return ipf.pass[n];
        if (ipf.be) return sense;
        return ipf.pres[idx];
    }
  }
  /* Все русские формы глагола — для перевода с русского: [{ru, vf, perf}] */
  function ruForms(laLemma, sense) {
    const out = [];
    const perf = PERF[norm(laLemma)];
    if (IPF[norm(laLemma)]) out.push(...ruForms('', IPF[norm(laLemma)]));
    [[sense, false], [perf, true]].forEach(([s, isPf]) => {
      if (!s) return;
      const c = conjugate(s); if (!c) return;
      out.push({ ru: norm(s), vf: { mood: 'inf', pass: false, p: 0, n: 'sg' }, perf: isPf });
      c.imp.forEach((w, i) => out.push({ ru: norm(w), vf: { mood: 'imp', pass: false, p: 2, n: i ? 'pl' : 'sg' }, perf: isPf }));
      if (!c.be && (!isPf || !perf || norm(perf) !== norm(sense))) c.pres.forEach((w, i) => out.push({ ru: norm(w), vf: { mood: 'ind', pass: false, p: i % 3 + 1, n: i > 2 ? 'pl' : 'sg' }, perf: isPf }));
      if (!isPf) c.pass.forEach((w, i) => out.push({ ru: norm(w), vf: { mood: 'ind', pass: true, p: 3, n: i ? 'pl' : 'sg' }, perf: false }));
    });
    return out;
  }
  const FORM_RU = vf => vf.mood === 'inf' ? 'инфинитив' : vf.mood === 'imp' ? 'повелит. накл., ' + (vf.n === 'pl' ? 'мн. ч.' : 'ед. ч.')
    : (vf.mood === 'conj' ? 'сослагат. накл., ' : 'наст. вр., ') + (vf.pass ? 'страд. залог, ' : '') + vf.p + ' л. ' + (vf.n === 'pl' ? 'мн. ч.' : 'ед. ч.');
  global.RuVerb = { IPF, conjugate, translate, ruForms, PERF, FORM_RU };
})(typeof window !== 'undefined' ? window : globalThis);
