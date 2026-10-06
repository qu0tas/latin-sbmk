/* Морфология: склонение и спряжение латинских слов из словаря,
   распознавание словоформ, русский стеммер (Snowball) и определение падежа. */
(function (global) {
  'use strict';

  /* ---------- Нормализация ---------- */
  function normLa(s) {
    return String(s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/æ/g, 'ae').replace(/œ/g, 'oe')
      .replace(/j/g, 'i').replace(/[«»"“”„'’]/g, '').trim();
  }
  function normRu(s) {
    return String(s).toLowerCase().replace(/ё/g, 'е').trim();
  }

  const CASES = ['nom', 'gen', 'dat', 'acc', 'abl'];
  const CASE_RU = { nom: 'Nom. — им. п.', gen: 'Gen. — род. п.', dat: 'Dat. — дат. п.', acc: 'Acc. — вин. п.', abl: 'Abl. — твор./предл. п.' };
  const CASE_SHORT = { nom: 'им. п.', gen: 'род. п.', dat: 'дат. п.', acc: 'вин. п.', abl: 'абл. (твор./предл.)' };
  const NUM_RU = { sg: 'ед. ч.', pl: 'мн. ч.' };
  const GEN_RU = { m: 'м. р.', f: 'ж. р.', n: 'ср. р.' };
  const VOWELS = 'aeiouy';

  /* Присоединение окончания родительного падежа к словарной форме.
     abdomen + -inis → abdominis, venter + -tris → ventris, regio + -onis → regionis */
  function joinEnding(nom, end) {
    if (!end) return nom;
    const low = nom.toLowerCase();
    const e = end.toLowerCase();
    if (VOWELS.includes(e[0])) {
      if (/ior$/.test(low) && e === 'ius') return nom.slice(0, -2) + 'us';
      if (/(ae|oe)$/.test(low)) return nom.slice(0, -2) + end;
      return nom.replace(/[aeiouy][^aeiouy]*$/i, '') + end;
    }
    const idx = low.lastIndexOf(e[0]);
    if (idx > 0) return nom.slice(0, idx) + end;
    return nom.replace(/[aeiouy][^aeiouy]*$/i, '') + end;
  }

  function splitGr(gr) {
    return gr.split(/,\s*/).map(s => s.trim()).filter(Boolean);
  }

  function emptyPar() { const p = {}; CASES.forEach(c => p[c] = { sg: [], pl: [] }); return p; }
  function put(p, c, n, ...forms) { forms.forEach(f => { if (f && !p[c][n].includes(f)) p[c][n].push(f); }); }

  function countSyl(w) { const m = w.toLowerCase().replace(/ae|oe|au|eu/g, 'a').match(/[aeiouy]/g); return m ? m.length : 0; }

  /* ---------- Существительные ---------- */
  function nounParadigm(la, genFull, gender, plOnly) {
    const p = emptyPar();
    const g = genFull.toLowerCase();
    const nomL = la.toLowerCase();
    let decl, stem;
    if (plOnly) {
      decl = plOnly;
      if (decl === 1 || decl === 2 || decl === 5) stem = genFull.slice(0, -4);
      else if (/ium$/.test(g)) stem = genFull.slice(0, -3);
      else stem = genFull.slice(0, -2);
      const P = 'pl';
      if (decl === 1) { put(p, 'nom', P, stem + 'ae'); put(p, 'gen', P, stem + 'arum'); put(p, 'dat', P, stem + 'is'); put(p, 'acc', P, stem + 'as'); put(p, 'abl', P, stem + 'is'); }
      if (decl === 2) { const n = gender === 'n'; put(p, 'nom', P, n ? stem + 'a' : stem + 'i'); put(p, 'gen', P, stem + 'orum'); put(p, 'dat', P, stem + 'is'); put(p, 'acc', P, n ? stem + 'a' : stem + 'os'); put(p, 'abl', P, stem + 'is'); }
      if (decl === 5) { put(p, 'nom', P, stem + 'es'); put(p, 'gen', P, stem + 'erum'); put(p, 'dat', P, stem + 'ebus'); put(p, 'acc', P, stem + 'es'); put(p, 'abl', P, stem + 'ebus'); }
      if (decl === 3) { const n = gender === 'n'; const ium = /ium$/.test(g); put(p, 'nom', P, la); put(p, 'gen', P, genFull); put(p, 'dat', P, stem + 'ibus'); put(p, 'acc', P, la); put(p, 'abl', P, stem + 'ibus'); if (n && ium) {} }
      return { decl, stem, p, plOnly: true };
    }
    if (/ae$/.test(g)) {
      decl = 1; stem = genFull.slice(0, -2);
      if (/e$/.test(nomL) || /es$/.test(nomL)) { // греческие существительные 1 скл.
        put(p, 'nom', 'sg', la); put(p, 'gen', 'sg', stem + 'es', stem + 'ae'); put(p, 'dat', 'sg', stem + 'ae'); put(p, 'acc', 'sg', stem + 'en', stem + 'am'); put(p, 'abl', 'sg', stem + 'e', stem + 'a');
      } else {
        put(p, 'nom', 'sg', la); put(p, 'gen', 'sg', stem + 'ae'); put(p, 'dat', 'sg', stem + 'ae'); put(p, 'acc', 'sg', stem + 'am'); put(p, 'abl', 'sg', stem + 'a');
      }
      put(p, 'nom', 'pl', stem + 'ae'); put(p, 'gen', 'pl', stem + 'arum'); put(p, 'dat', 'pl', stem + 'is'); put(p, 'acc', 'pl', stem + 'as'); put(p, 'abl', 'pl', stem + 'is');
    } else if (/es$/.test(g) && /e$/.test(nomL)) {
      decl = 1; stem = genFull.slice(0, -2);
      put(p, 'nom', 'sg', la); put(p, 'gen', 'sg', stem + 'es', stem + 'ae'); put(p, 'dat', 'sg', stem + 'ae'); put(p, 'acc', 'sg', stem + 'en', stem + 'am'); put(p, 'abl', 'sg', stem + 'e', stem + 'a');
      put(p, 'nom', 'pl', stem + 'ae'); put(p, 'gen', 'pl', stem + 'arum'); put(p, 'dat', 'pl', stem + 'is'); put(p, 'acc', 'pl', stem + 'as'); put(p, 'abl', 'pl', stem + 'is');
    } else if (/ei$/.test(g)) {
      decl = 5; stem = genFull.slice(0, -2);
      put(p, 'nom', 'sg', la); put(p, 'gen', 'sg', stem + 'ei'); put(p, 'dat', 'sg', stem + 'ei'); put(p, 'acc', 'sg', stem + 'em'); put(p, 'abl', 'sg', stem + 'e');
      put(p, 'nom', 'pl', stem + 'es'); put(p, 'gen', 'pl', stem + 'erum'); put(p, 'dat', 'pl', stem + 'ebus'); put(p, 'acc', 'pl', stem + 'es'); put(p, 'abl', 'pl', stem + 'ebus');
    } else if (/us$/.test(g) && /(us|u)$/.test(nomL) && g !== nomL + 'is') {
      decl = 4; stem = genFull.slice(0, -2);
      if (gender === 'n') {
        put(p, 'nom', 'sg', la); put(p, 'gen', 'sg', stem + 'us'); put(p, 'dat', 'sg', stem + 'u'); put(p, 'acc', 'sg', la); put(p, 'abl', 'sg', stem + 'u');
        put(p, 'nom', 'pl', stem + 'ua'); put(p, 'gen', 'pl', stem + 'uum'); put(p, 'dat', 'pl', stem + 'ibus'); put(p, 'acc', 'pl', stem + 'ua'); put(p, 'abl', 'pl', stem + 'ibus');
      } else {
        put(p, 'nom', 'sg', la); put(p, 'gen', 'sg', stem + 'us'); put(p, 'dat', 'sg', stem + 'ui'); put(p, 'acc', 'sg', stem + 'um'); put(p, 'abl', 'sg', stem + 'u');
        put(p, 'nom', 'pl', stem + 'us'); put(p, 'gen', 'pl', stem + 'uum'); put(p, 'dat', 'pl', stem + 'ibus'); put(p, 'acc', 'pl', stem + 'us'); put(p, 'abl', 'pl', stem + 'ibus');
      }
    } else if (/i$/.test(g) && !/is$/.test(g)) {
      decl = 2; stem = genFull.slice(0, -1);
      if (gender === 'n') {
        put(p, 'nom', 'sg', la); put(p, 'gen', 'sg', stem + 'i'); put(p, 'dat', 'sg', stem + 'o'); put(p, 'acc', 'sg', la); put(p, 'abl', 'sg', stem + 'o');
        put(p, 'nom', 'pl', stem + 'a'); put(p, 'gen', 'pl', stem + 'orum'); put(p, 'dat', 'pl', stem + 'is'); put(p, 'acc', 'pl', stem + 'a'); put(p, 'abl', 'pl', stem + 'is');
      } else {
        put(p, 'nom', 'sg', la); put(p, 'gen', 'sg', stem + 'i'); put(p, 'dat', 'sg', stem + 'o'); put(p, 'acc', 'sg', stem + 'um'); put(p, 'abl', 'sg', stem + 'o');
        put(p, 'nom', 'pl', stem + 'i'); put(p, 'gen', 'pl', stem + 'orum'); put(p, 'dat', 'pl', stem + 'is'); put(p, 'acc', 'pl', stem + 'os'); put(p, 'abl', 'pl', stem + 'is');
      }
    } else {
      decl = 3; stem = genFull.replace(/is$/i, '');
      const neut = gender === 'n';
      const neutI = neut && /(e|al|ar)$/.test(nomL);
      const greekSis = /sis$/.test(nomL) && /sis$/.test(g);
      const pariSyl = !neut && /(is|es)$/.test(nomL) && countSyl(la) === countSyl(genFull);
      const twoCons = countSyl(la) === 1 && /[^aeiouy][^aeiouy]$/.test(stem.toLowerCase());
      const iumPl = neutI || pariSyl || twoCons;
      const pureI = greekSis || /^(tussis|pelvis|febris|sitis|securis)$/.test(nomL);
      put(p, 'nom', 'sg', la); put(p, 'gen', 'sg', genFull); put(p, 'dat', 'sg', stem + 'i');
      if (neut) put(p, 'acc', 'sg', la);
      else if (pureI) put(p, 'acc', 'sg', stem + 'im', stem + 'em');
      else put(p, 'acc', 'sg', stem + 'em');
      if (neutI || pureI) put(p, 'abl', 'sg', stem + 'i', stem + 'e'); else put(p, 'abl', 'sg', stem + 'e');
      if (pariSyl && !pureI) put(p, 'abl', 'sg', stem + 'i');
      if (neut) { put(p, 'nom', 'pl', stem + (neutI ? 'ia' : 'a')); put(p, 'acc', 'pl', stem + (neutI ? 'ia' : 'a')); }
      else { put(p, 'nom', 'pl', stem + 'es'); put(p, 'acc', 'pl', stem + 'es'); }
      put(p, 'gen', 'pl', stem + (iumPl ? 'ium' : 'um')); if (!iumPl && pariSyl) put(p, 'gen', 'pl', stem + 'ium');
      put(p, 'dat', 'pl', stem + 'ibus'); put(p, 'abl', 'pl', stem + 'ibus');
      if (nomL === 'vas') { p.gen.pl = [stem + 'orum']; p.dat.pl = [stem + 'is']; p.abl.pl = [stem + 'is']; }
    }
    return { decl, stem, p };
  }

  /* ---------- Прилагательные ---------- */
  function adj12(la, fem) { // -us/-er, -a, -um
    const stem = fem.slice(0, -1);
    const m = nounParadigm(la, stem + 'i', 'm').p;
    const f = nounParadigm(fem, stem + 'ae', 'f').p;
    const n = nounParadigm(stem + 'um', stem + 'i', 'n').p;
    return { type: 'adj12', stem, m, f, n, neut: stem + 'um', fem };
  }
  function adj3(la, neutNom, stem, opts) { // 3 скл.: -is/-e, одно окончание, сравнительная степень
    const comp = opts && opts.comp;
    const mk = (nom, g) => {
      const p = emptyPar();
      put(p, 'nom', 'sg', nom); put(p, 'gen', 'sg', stem + 'is'); put(p, 'dat', 'sg', stem + 'i');
      put(p, 'acc', 'sg', g === 'n' ? nom : stem + 'em');
      if (comp) put(p, 'abl', 'sg', stem + 'e'); else put(p, 'abl', 'sg', stem + 'i', stem + 'e');
      const pl = g === 'n' ? stem + (comp ? 'a' : 'ia') : stem + 'es';
      put(p, 'nom', 'pl', pl); put(p, 'acc', 'pl', pl);
      put(p, 'gen', 'pl', stem + (comp ? 'um' : 'ium')); put(p, 'dat', 'pl', stem + 'ibus'); put(p, 'abl', 'pl', stem + 'ibus');
      return p;
    };
    const femNom = (opts && opts.fem) || la;
    return { type: comp ? 'comp' : 'adj3', stem, m: mk(la, 'm'), f: mk(femNom, 'f'), n: mk(neutNom, 'n'), neut: neutNom, fem: femNom };
  }

  /* ---------- Глаголы ---------- */
  function verbForms(la, inf) {
    const l = la.toLowerCase();
    let conj, stem;
    if (/are$/.test(inf)) { conj = 1; stem = la.replace(/o$/, ''); }
    else if (/ire$/.test(inf)) { conj = 4; stem = la.replace(/io$/, ''); }
    else if (/eo$/.test(l)) { conj = 2; stem = la.replace(/eo$/, ''); }
    else if (/io$/.test(l)) { conj = 5; stem = la.replace(/io$/, ''); }
    else { conj = 3; stem = la.replace(/o$/, ''); }
    const F = [];
    const add = (form, label) => F.push({ form, label });
    if (conj === 1) {
      add(stem + 'are', 'инфинитив'); ['o', 'as', 'at', 'amus', 'atis', 'ant'].forEach((e, i) => add(stem + e, 'наст. вр., ' + PERS[i]));
      add(stem + 'a', 'повелит. накл., ед. ч.'); add(stem + 'ate', 'повелит. накл., мн. ч.');
      ['em', 'es', 'et', 'emus', 'etis', 'ent'].forEach((e, i) => add(stem + e, 'сослагат. накл., ' + PERS[i]));
      add(stem + 'atur', 'наст. вр., страд. залог, 3 л. ед. ч.'); add(stem + 'antur', 'наст. вр., страд. залог, 3 л. мн. ч.');
      add(stem + 'etur', 'сослагат. накл., страд. залог, 3 л. ед. ч.'); add(stem + 'entur', 'сослагат. накл., страд. залог, 3 л. мн. ч.');
      add(stem + 'ans', 'причастие наст. вр.');
    } else if (conj === 2) {
      add(stem + 'ere', 'инфинитив'); ['eo', 'es', 'et', 'emus', 'etis', 'ent'].forEach((e, i) => add(stem + e, 'наст. вр., ' + PERS[i]));
      add(stem + 'e', 'повелит. накл., ед. ч.'); add(stem + 'ete', 'повелит. накл., мн. ч.');
      ['eam', 'eas', 'eat', 'eamus', 'eatis', 'eant'].forEach((e, i) => add(stem + e, 'сослагат. накл., ' + PERS[i]));
      add(stem + 'etur', 'наст. вр., страд. залог, 3 л. ед. ч.'); add(stem + 'entur', 'наст. вр., страд. залог, 3 л. мн. ч.');
      add(stem + 'eatur', 'сослагат. накл., страд. залог, 3 л. ед. ч.'); add(stem + 'eantur', 'сослагат. накл., страд. залог, 3 л. мн. ч.');
      add(stem + 'ens', 'причастие наст. вр.');
    } else if (conj === 4 || conj === 5) {
      const i4 = conj === 4;
      add(stem + (i4 ? 'ire' : 'ere'), 'инфинитив'); ['io', 'is', 'it', 'imus', 'itis', 'iunt'].forEach((e, i) => add(stem + e, 'наст. вр., ' + PERS[i]));
      add(stem + (i4 ? 'i' : 'e'), 'повелит. накл., ед. ч.'); add(stem + (i4 ? 'ite' : 'ite'), 'повелит. накл., мн. ч.');
      ['iam', 'ias', 'iat', 'iamus', 'iatis', 'iant'].forEach((e, i) => add(stem + e, 'сослагат. накл., ' + PERS[i]));
      add(stem + 'itur', 'наст. вр., страд. залог, 3 л. ед. ч.'); add(stem + 'iuntur', 'наст. вр., страд. залог, 3 л. мн. ч.');
      add(stem + 'iatur', 'сослагат. накл., страд. залог, 3 л. ед. ч.'); add(stem + 'iantur', 'сослагат. накл., страд. залог, 3 л. мн. ч.');
      add(stem + 'iens', 'причастие наст. вр.');
    } else {
      add(stem + 'ere', 'инфинитив'); ['o', 'is', 'it', 'imus', 'itis', 'unt'].forEach((e, i) => add(stem + e, 'наст. вр., ' + PERS[i]));
      add(stem + 'e', 'повелит. накл., ед. ч.'); add(stem + 'ite', 'повелит. накл., мн. ч.');
      ['am', 'as', 'at', 'amus', 'atis', 'ant'].forEach((e, i) => add(stem + e, 'сослагат. накл., ' + PERS[i]));
      add(stem + 'itur', 'наст. вр., страд. залог, 3 л. ед. ч.'); add(stem + 'untur', 'наст. вр., страд. залог, 3 л. мн. ч.');
      add(stem + 'atur', 'сослагат. накл., страд. залог, 3 л. ед. ч.'); add(stem + 'antur', 'сослагат. накл., страд. залог, 3 л. мн. ч.');
      add(stem + 'ens', 'причастие наст. вр.');
    }
    return { conj, forms: F };
  }
  const PERS = ['1 л. ед. ч.', '2 л. ед. ч.', '3 л. ед. ч.', '1 л. мн. ч.', '2 л. мн. ч.', '3 л. мн. ч.'];

  /* ---------- Анализ словарной статьи ---------- */
  const PREP_CASE = { a: ['abl'], ab: ['abl'], prae: ['abl'], apud: ['acc'], extra: ['acc'], infra: ['acc'], intra: ['acc'], supra: ['acc'], ad: ['acc'], ante: ['acc'], contra: ['acc'], inter: ['acc'], per: ['acc'], post: ['acc'], cum: ['abl'], sine: ['abl'], pro: ['abl'], e: ['abl'], ex: ['abl'], de: ['abl'], in: ['abl', 'acc'], sub: ['abl', 'acc'] };

  function analyzeEntry(e) {
    const la = e.la.replace(/[«»]/g, '').trim();
    const gr = (e.gr || '').trim();
    const info = { pos: 'other', la, gr };
    if (/^предл\./.test(e.ru)) { info.pos = 'prep'; info.forms = la.split(/,\s*/); info.governs = PREP_CASE[normLa(info.forms[0])] || []; return info; }
    if (/\s/.test(la)) { info.pos = 'phrase'; return info; }
    if (!gr) {
      if (/^нар\./.test(e.ru)) { info.pos = 'adv'; return info; }
      if (/нескл\./.test(e.ru)) { info.pos = 'indecl'; return info; }
      // формы без грамматики (из таблиц) — склоняем по типичному окончанию
      const l = la.toLowerCase();
      let guess = null;
      if (/um$/.test(l)) guess = [la.slice(0, -2) + 'i', 'n'];
      else if (/a$/.test(l) && !/ma$/.test(l)) guess = [la.slice(0, -1) + 'ae', 'f'];
      else if (/(us)$/.test(l)) guess = [la.slice(0, -2) + 'i', 'm'];
      else if (/e$/.test(l) && /(oe|le)$/.test(l)) guess = [la.slice(0, -1) + 'es', 'f'];
      if (guess && e.src && /Таблиц/.test(e.src)) {
        const np = nounParadigm(la, guess[0], guess[1]);
        Object.assign(info, { pos: 'noun', gender: guess[1], genders: [guess[1]], genFull: guess[0], decl: np.decl, par: np.p, guessed: true });
        return info;
      }
      info.pos = 'indecl'; return info;
    }
    const t = splitGr(gr);
    // глаголы
    if (t.length === 1 && /^-(are|ere|ire)$/.test(t[0])) {
      const v = verbForms(la, t[0].slice(1));
      Object.assign(info, { pos: 'verb', inf: la.replace(/(e?o)$/i, '') + t[0].slice(1), conj: v.conj, vforms: v.forms });
      return info;
    }
    const genders = t.filter(x => /^[mfn]$/.test(x));
    const rest = t.filter(x => !/^[mfn]$/.test(x));
    if (genders.length) { // существительное
      const gpart = rest[0];
      const genFull = gpart.startsWith('-') ? joinEnding(la, gpart.slice(1)) : gpart;
      const plOnly = isPluralLemma(la, genFull);
      const np = nounParadigm(la, genFull, genders[0], plOnly);
      Object.assign(info, { pos: 'noun', gender: genders[0], genders, genFull, decl: np.decl, par: np.p, plOnly: !!plOnly });
      return info;
    }
    // прилагательные
    if (rest.length === 2 && /is$/i.test(rest[0]) && /e$/i.test(rest[1])) { // acer, acris, acre
      const fem = rest[0].startsWith('-') ? joinEnding(la, rest[0].slice(1)) : rest[0];
      const neut = rest[1].startsWith('-') ? joinEnding(la, rest[1].slice(1)) : rest[1];
      Object.assign(info, { pos: 'adj' }, adj3(la, neut, fem.replace(/is$/i, ''), { fem }));
      return info;
    }
    if (rest.length === 2) {
      const fem = joinEnding(la, rest[0].slice(1));
      Object.assign(info, { pos: 'adj' }, adj12(la, fem));
      return info;
    }
    if (rest.length === 1) {
      const r = rest[0];
      if (r === '-e') { const stem = la.replace(/is$/i, ''); Object.assign(info, { pos: 'adj' }, adj3(la, stem + 'e', stem)); return info; }
      if (/or$/i.test(la) && /^-(ius|us|jus)$/.test(r)) { const neut = joinEnding(la, r.slice(1)); Object.assign(info, { pos: 'adj' }, adj3(la, neut, la, { comp: true })); return info; }
      const genFull = joinEnding(la, r.slice(1));
      const stem = genFull.replace(/is$/i, '');
      Object.assign(info, { pos: 'adj' }, adj3(la, la, stem));
      info.genFull = genFull;
      return info;
    }
    info.pos = 'indecl';
    return info;
  }
  function isPluralLemma(la, genFull) {
    const l = la.toLowerCase(), g = genFull.toLowerCase();
    if (/orum$/.test(g) && /(i|a)$/.test(l)) return 2;
    if (/arum$/.test(g) && /ae$/.test(l)) return 1;
    if (/erum$/.test(g) && /es$/.test(l)) return 5;
    if (/um$/.test(g) && /(es|a)$/.test(l)) return 3;
    return 0;
  }

  /* Все словоформы статьи: [{form, desc}] */
  function allForms(info) {
    const out = [];
    const addPar = (par, gender) => {
      CASES.forEach(c => ['sg', 'pl'].forEach(n => par[c][n].forEach(f => out.push({ form: f, c, n, g: gender }))));
    };
    if (info.pos === 'noun') addPar(info.par, null);
    else if (info.pos === 'adj') { addPar(info.m, 'm'); addPar(info.f, 'f'); addPar(info.n, 'n'); }
    else if (info.pos === 'verb') info.vforms.forEach(v => out.push({ form: v.form, verb: v.label }));
    else if (info.pos === 'prep') info.forms.forEach(f => out.push({ form: f }));
    else out.push({ form: info.la });
    return out;
  }

  function describeForm(f) {
    if (f.verb) return f.verb;
    if (!f.c) return '';
    return CASE_SHORT[f.c] + ', ' + NUM_RU[f.n] + (f.g ? ', ' + GEN_RU[f.g] : '');
  }

  /* ---------- Русский стеммер (Snowball) ---------- */
  const RV = /^(.*?[аеиоуыэюя])(.*)$/;
  const PERF = /((ив|ивши|ившись|ыв|ывши|ывшись)|((?<=[ая])(в|вши|вшись)))$/;
  const REFL = /(с[яь])$/;
  const ADJ = /(ее|ие|ые|ое|ими|ыми|ей|ий|ый|ой|ем|им|ым|ом|его|ого|ему|ому|их|ых|ую|юю|ая|яя|ою|ею)$/;
  const PART = /((ивш|ывш|ующ)|((?<=[ая])(ем|нн|вш|ющ|щ)))$/;
  const VERB = /((ила|ыла|ена|ейте|уйте|ите|или|ыли|ей|уй|ил|ыл|им|ым|ен|ило|ыло|ено|ят|ует|уют|ит|ыт|ены|ить|ыть|ишь|ую|ю)|((?<=[ая])(ла|на|ете|йте|ли|й|л|ем|н|ло|но|ет|ют|ны|ть|ешь|нно)))$/;
  const NOUN = /(а|ев|ов|ие|ье|е|иями|ями|ами|еи|ии|и|ией|ей|ой|ий|й|иям|ям|ием|ем|ам|ом|о|у|ах|иях|ях|ы|ь|ию|ью|ю|ия|ья|я)$/;
  const DERIV = /[^аеиоуыэюя][аеиоуыэюя]+[^аеиоуыэюя]+[аеиоуыэюя].*(?<=о)сть?$/;
  function stemRu(word) {
    word = normRu(word);
    const m = RV.exec(word);
    if (!m) return word;
    const pre = m[1]; let rv = m[2];
    let t = rv.replace(PERF, '');
    if (t === rv) {
      rv = rv.replace(REFL, '');
      t = rv.replace(ADJ, '');
      if (t !== rv) { rv = t.replace(PART, ''); }
      else { t = rv.replace(VERB, ''); rv = (t === rv) ? rv.replace(NOUN, '') : t; }
    } else rv = t;
    rv = rv.replace(/и$/, '');
    if (DERIV.test(rv)) rv = rv.replace(/ость?$/, '');
    t = rv.replace(/ь$/, '');
    if (t === rv) { rv = rv.replace(/(ейше|ейш)$/, '').replace(/нн$/, 'н'); } else rv = t;
    return pre + rv;
  }

  /* ---------- Определение падежа русского слова ---------- */
  const RU_ADJ_END = /((ый|ий|ой|ая|яя|ое|ее|ые)|[кгхжшщчн]ие)$/;
  function isRuAdj(w) { w = normRu(w); return RU_ADJ_END.test(w) && !/(ние|тие|ье)$/.test(w); }

  // Возвращает список вариантов [{c, n}] по сравнению с исходной (словарной) формой
  function ruNounCase(input, dict) {
    const w = normRu(input), d = normRu(dict);
    if (w === d) return [{ c: 'nom', n: 'sg' }];
    const end = (re) => re.test(w);
    const dA = /[ая]$/.test(d);          // кость? нет — существительные на -а/-я
    const dSoft = /ь$/.test(d);
    const dO = /[ое]$/.test(d);
    // множественное число
    if (end(/(ами|ями)$/)) return [{ c: 'abl', n: 'pl' }];
    if (end(/(ах|ях)$/)) return [{ c: 'abl', n: 'pl' }];
    if (end(/(ам|ям)$/)) return [{ c: 'dat', n: 'pl' }];
    if (end(/(ов|ев|ёв)$/)) return [{ c: 'gen', n: 'pl' }];
    if (dA) {
      if (end(/(ы|и)$/)) return [{ c: 'gen', n: 'sg' }, { c: 'nom', n: 'pl' }];
      if (end(/(у|ю)$/)) return [{ c: 'acc', n: 'sg' }];
      if (end(/(ой|ей|ою|ею)$/)) return [{ c: 'abl', n: 'sg' }];
      if (end(/е$/)) return [{ c: 'abl', n: 'sg' }, { c: 'dat', n: 'sg' }];
      if (w.length < d.length) return [{ c: 'gen', n: 'pl' }]; // кислот, вен
    }
    if (dSoft) {
      if (end(/и$/)) return [{ c: 'gen', n: 'sg' }, { c: 'nom', n: 'pl' }];
      if (end(/ью$/)) return [{ c: 'abl', n: 'sg' }];
      if (end(/ей$/)) return [{ c: 'gen', n: 'pl' }];
      if (end(/я$/)) return [{ c: 'gen', n: 'sg' }];
      if (end(/ю$/)) return [{ c: 'dat', n: 'sg' }];
      if (end(/(ем|ём)$/)) return [{ c: 'abl', n: 'sg' }];
      if (end(/е$/)) return [{ c: 'abl', n: 'sg' }];
    }
    if (dO) {
      if (end(/[ая]$/)) return [{ c: 'gen', n: 'sg' }, { c: 'nom', n: 'pl' }];
      if (end(/[ую]$/)) return [{ c: 'dat', n: 'sg' }];
      if (end(/(ом|ем)$/)) return [{ c: 'abl', n: 'sg' }];
      if (end(/и$/)) return [{ c: 'abl', n: 'sg' }]; // в сердце? (ии — в кровотечении)
      if (w.length < d.length) return [{ c: 'gen', n: 'pl' }];
    }
    // мужской род на согласный / -й
    if (end(/[ая]$/)) return [{ c: 'gen', n: 'sg' }];
    if (end(/[ую]$/)) return [{ c: 'dat', n: 'sg' }];
    if (end(/(ом|ем|ём)$/)) return [{ c: 'abl', n: 'sg' }];
    if (end(/е$/)) return [{ c: 'abl', n: 'sg' }];
    if (end(/(ы|и)$/)) return [{ c: 'nom', n: 'pl' }];
    if (end(/ей$/)) return [{ c: 'gen', n: 'pl' }];
    return [{ c: 'nom', n: 'sg' }];
  }
  function ruAdjCase(input) {
    const w = normRu(input);
    if (/(ый|ий|ой|ая|яя|ое|ее)$/.test(w) && !/(ой|ей)$/.test(w)) return [{ c: 'nom', n: 'sg' }];
    if (/(ого|его)$/.test(w)) return [{ c: 'gen', n: 'sg' }];
    if (/(ому|ему)$/.test(w)) return [{ c: 'dat', n: 'sg' }];
    if (/(ую|юю)$/.test(w)) return [{ c: 'acc', n: 'sg' }];
    if (/(ым|им|ом|ем)$/.test(w)) return [{ c: 'abl', n: 'sg' }];
    if (/(ой|ей|ою|ею)$/.test(w)) return [{ c: 'gen', n: 'sg' }, { c: 'abl', n: 'sg' }, { c: 'nom', n: 'sg' }];
    if (/(ые|ие)$/.test(w)) return [{ c: 'nom', n: 'pl' }];
    if (/(ых|их)$/.test(w)) return [{ c: 'gen', n: 'pl' }];
    if (/(ыми|ими)$/.test(w)) return [{ c: 'abl', n: 'pl' }];
    return [];
  }


  /* ---------- Русские окончания для перевода с латыни ---------- */
  // мужской род на -ь (основа косвенных падежей)
  const MASC_SOFT = { 'аэрозоль': 'аэрозол', 'вращатель': 'вращател', 'гребень': 'гребн', 'деготь': 'дегт', 'день': 'дн', 'камень': 'камн', 'кашель': 'кашл', 'корень': 'корн', 'локоть': 'локт', 'ноготь': 'ногт', 'пластырь': 'пластыр', 'пузырь': 'пузыр', 'разгибатель': 'разгибател', 'ревень': 'ревен', 'сгибатель': 'сгибател', 'стержень': 'стержн', 'уголь': 'угл', 'удерживатель': 'удерживател', 'фенхель': 'фенхел', 'червь': 'черв' };
  const FLEET = { 'рот': 'рт', 'лоб': 'лб', 'сон': 'сн', 'лёд': 'льд', 'лед': 'льд', 'мох': 'мх' };
  function ruGender(w) {
    w = normRu(w);
    if (/(а|я)$/.test(w)) return /^(мужчина|юноша)$/.test(w) ? 'm' : 'f';
    if (/(о|е)$/.test(w)) return 'n';
    if (/ь$/.test(w)) return MASC_SOFT[w] || w === 'путь' ? 'm' : 'f';
    return 'm';
  }
  const HUSH = /[гкхжшщч]$/, SIB = /[жшщчц]$/;
  const syl = w => (w.match(/[аеёиоуыэюя]/g) || []).length;
  function hardStem(w) { // беглые гласные: позвонок → позвонк, палец → пальц, рот → рт
    if (FLEET[w]) return FLEET[w];
    if (syl(w) >= 2 && /[^аеиоуыэюя](о|е|ё)к$/.test(w)) return w.slice(0, -2) + 'к';
    if (syl(w) >= 2 && /лец$/.test(w)) return w.slice(0, -3) + 'льц';
    if (syl(w) >= 2 && /[^аеиоуыэюя]ец$/.test(w)) return w.slice(0, -2) + 'ц';
    return w;
  }
  // c: nom, gen, dat, acc, ins, prep
  function ruNounForm(w, c, n) {
    w = normRu(w);
    if (c === 'nom' && n === 'sg') return w;
    const g = ruGender(w);
    let st, type;
    if (/ия$/.test(w)) { st = w.slice(0, -2); type = 'ija'; }
    else if (/а$/.test(w)) { st = w.slice(0, -1); type = 'a'; }
    else if (/я$/.test(w)) { st = w.slice(0, -1); type = 'ja'; }
    else if (/ие$/.test(w)) { st = w.slice(0, -2); type = 'ie'; }
    else if (/о$/.test(w)) { st = w.slice(0, -1); type = 'o'; }
    else if (/е$/.test(w)) { st = w.slice(0, -1); type = SIB.test(w.slice(0, -1)) ? 'o' : 'e'; }
    else if (/ь$/.test(w)) { if (g === 'm') { st = MASC_SOFT[w] || w.slice(0, -1); type = w === 'путь' ? 'f' : 'ms'; } else { st = w.slice(0, -1); type = 'f'; } }
    else if (/ий$/.test(w)) { st = w.slice(0, -2); type = 'ij'; }
    else if (/й$/.test(w)) { st = w.slice(0, -1); type = 'j'; }
    else if (/[бвгджзклмнпрстфхцчшщ]$/.test(w)) { st = hardStem(w); type = 'm'; }
    else return null;
    const hush = HUSH.test(st), sib = SIB.test(st);
    const y = hush ? 'и' : 'ы';
    const T = {
      a: { gen: st + y, dat: st + 'е', acc: st + 'у', ins: st + (sib ? 'ей' : 'ой'), prep: st + 'е', pl: { nom: st + y, dat: st + 'ам', acc: st + y, ins: st + 'ами', prep: st + 'ах' } },
      ja: { gen: st + 'и', dat: st + 'е', acc: st + 'ю', ins: st + 'ей', prep: st + 'е', pl: { nom: st + 'и', dat: st + 'ям', acc: st + 'и', ins: st + 'ями', prep: st + 'ях' } },
      ija: { gen: st + 'ии', dat: st + 'ии', acc: st + 'ию', ins: st + 'ией', prep: st + 'ии', pl: { nom: st + 'ии', gen: st + 'ий', dat: st + 'иям', acc: st + 'ии', ins: st + 'иями', prep: st + 'иях' } },
      ie: { gen: st + 'ия', dat: st + 'ию', acc: w, ins: st + 'ием', prep: st + 'ии', pl: { nom: st + 'ия', gen: st + 'ий', dat: st + 'иям', acc: st + 'ия', ins: st + 'иями', prep: st + 'иях' } },
      o: { gen: st + 'а', dat: st + 'у', acc: w, ins: st + (/о$/.test(w) ? 'ом' : 'ем'), prep: st + 'е', pl: { nom: st + 'а', dat: st + 'ам', acc: st + 'а', ins: st + 'ами', prep: st + 'ах' } },
      e: { gen: st + 'я', dat: st + 'ю', acc: w, ins: st + 'ем', prep: st + 'е', pl: { nom: st + 'я', dat: st + 'ям', acc: st + 'я', ins: st + 'ями', prep: st + 'ях' } },
      f: { gen: st + 'и', dat: st + 'и', acc: w, ins: st + 'ью', prep: st + 'и', pl: { nom: st + 'и', gen: st + 'ей', dat: st + (sib ? 'ам' : 'ям'), acc: st + 'и', ins: st + (sib ? 'ами' : 'ями'), prep: st + (sib ? 'ах' : 'ях') } },
      ms: { gen: st + 'я', dat: st + 'ю', acc: w, ins: st + 'ем', prep: st + 'е', pl: { nom: st + 'и', gen: st + 'ей', dat: st + 'ям', acc: st + 'и', ins: st + 'ями', prep: st + 'ях' } },
      ij: { gen: st + 'ия', dat: st + 'ию', acc: w, ins: st + 'ием', prep: st + 'ии', pl: { nom: st + 'ии', gen: st + 'иев', dat: st + 'иям', acc: st + 'ии', ins: st + 'иями', prep: st + 'иях' } },
      j: { gen: st + 'я', dat: st + 'ю', acc: w, ins: st + 'ем', prep: st + 'е', pl: { nom: st + 'и', gen: st + 'ев', dat: st + 'ям', acc: st + 'и', ins: st + 'ями', prep: st + 'ях' } },
      m: { gen: st + 'а', dat: st + 'у', acc: w, ins: st + (sib ? 'ем' : 'ом'), prep: st + 'е', pl: { nom: st + y, gen: st + (/[жшщч]$/.test(st) ? 'ей' : (sib ? 'ев' : 'ов')), dat: st + 'ам', acc: st + y, ins: st + 'ами', prep: st + 'ах' } }
    }[type];
    if (n === 'pl') {
      if (c === 'gen' && !T.pl.gen) { // род. п. мн. ч. для -а/-о: кислот, вен (без беглых гласных)
        if ((type === 'a' || type === 'o') && !/[^аеиоуыэюяй][^аеиоуыэюяй]$/.test(st)) return st;
        return null;
      }
      return T.pl[c] || null;
    }
    return T[c] || null;
  }
  const ADJ_T = {
    hard: { m: ['ый', 'ого', 'ому', 'ый', 'ым', 'ом'], f: ['ая', 'ой', 'ой', 'ую', 'ой', 'ой'], n: ['ое', 'ого', 'ому', 'ое', 'ым', 'ом'], pl: ['ые', 'ых', 'ым', 'ые', 'ыми', 'ых'] },
    hardO: { m: ['ой', 'ого', 'ому', 'ой', 'ым', 'ом'], f: ['ая', 'ой', 'ой', 'ую', 'ой', 'ой'], n: ['ое', 'ого', 'ому', 'ое', 'ым', 'ом'], pl: ['ые', 'ых', 'ым', 'ые', 'ыми', 'ых'] },
    soft: { m: ['ий', 'его', 'ему', 'ий', 'им', 'ем'], f: ['яя', 'ей', 'ей', 'юю', 'ей', 'ей'], n: ['ее', 'его', 'ему', 'ее', 'им', 'ем'], pl: ['ие', 'их', 'им', 'ие', 'ими', 'их'] },
    velar: { m: ['ий', 'ого', 'ому', 'ий', 'им', 'ом'], f: ['ая', 'ой', 'ой', 'ую', 'ой', 'ой'], n: ['ое', 'ого', 'ому', 'ое', 'им', 'ом'], pl: ['ие', 'их', 'им', 'ие', 'ими', 'их'] },
    velarO: { m: ['ой', 'ого', 'ому', 'ой', 'им', 'ом'], f: ['ая', 'ой', 'ой', 'ую', 'ой', 'ой'], n: ['ое', 'ого', 'ому', 'ое', 'им', 'ом'], pl: ['ие', 'их', 'им', 'ие', 'ими', 'их'] },
    hush: { m: ['ий', 'его', 'ему', 'ий', 'им', 'ем'], f: ['ая', 'ей', 'ей', 'ую', 'ей', 'ей'], n: ['ее', 'его', 'ему', 'ее', 'им', 'ем'], pl: ['ие', 'их', 'им', 'ие', 'ими', 'их'] },
    hushO: { m: ['ой', 'ого', 'ому', 'ой', 'им', 'ом'], f: ['ая', 'ой', 'ой', 'ую', 'ой', 'ой'], n: ['ое', 'ого', 'ому', 'ое', 'им', 'ом'], pl: ['ие', 'их', 'им', 'ие', 'ими', 'их'] }
  };
  const RU_CI = { nom: 0, gen: 1, dat: 2, acc: 3, ins: 4, prep: 5 };
  function ruAdjForm(w, g, c, n) {
    w = normRu(w);
    const m = w.match(/^(.*?)(ый|ий|ой|ая|яя|ое|ее|ые|ие)$/);
    if (!m || RU_CI[c] == null) return null;
    const st = m[1], end = m[2];
    let t;
    if (/[гкх]$/.test(st)) t = end === 'ой' ? 'velarO' : 'velar';
    else if (/[жшщч]$/.test(st)) t = (end === 'ой' || end === 'ое' && false) ? 'hushO' : (/(ий|ее|ие)$/.test(end) ? 'hush' : (end === 'ой' ? 'hushO' : 'hush'));
    else if (/(ий|яя|ее|ие)$/.test(end) && /н$/.test(st)) t = 'soft';
    else t = end === 'ой' ? 'hardO' : 'hard';
    return st + ADJ_T[t][n === 'pl' ? 'pl' : g][RU_CI[c]];
  }
  // Склонение короткого русского значения (1–3 слова)
  function ruPhraseForm(sense, c, n, forceGender) {
    if (RU_CI[c] == null) return null;
    if (c === 'nom' && n === 'sg' && !forceGender) return sense;
    const words = sense.split(/\s+/);
    if (words.length > 3 || /[()«»]/.test(sense) || /-/.test(sense)) return null;
    const nounW = words.find(x => !isRuAdj(x));
    const g = forceGender || (nounW ? ruGender(nounW) : 'm');
    const out = words.map(x => isRuAdj(x) ? ruAdjForm(x, g, c, n) : (forceGender ? x : ruNounForm(x, c, n)));
    return out.some(x => x == null) ? null : out.join(' ');
  }
  // какой русский падеж требует русский предлог
  const RU_PREP_CASE = { 'без': 'gen', 'для': 'gen', 'против': 'gen', 'от': 'gen', 'из': 'gen', 'до': 'gen', 'после': 'gen', 'около': 'gen', 'вокруг': 'gen', 'у': 'gen', 'с': 'ins', 'со': 'ins', 'перед': 'ins', 'между': 'ins', 'под': 'ins', 'над': 'ins', 'за': 'ins', 'в': 'prep', 'во': 'prep', 'на': 'prep', 'о': 'prep', 'при': 'prep', 'к': 'dat', 'ко': 'dat', 'по': 'dat', 'через': 'acc', 'посредством': 'gen' };
  global.Morph = { normLa, normRu, joinEnding, analyzeEntry, allForms, describeForm, stemRu, ruNounCase, ruAdjCase, isRuAdj, ruGender, ruNounForm, ruAdjForm, ruPhraseForm, RU_PREP_CASE, CASES, CASE_RU, CASE_SHORT, NUM_RU, GEN_RU, PREP_CASE };
})(typeof window !== 'undefined' ? window : globalThis);
