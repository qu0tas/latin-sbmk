# Сборка data/dictionary.js из текстовых файлов: python3 tools/build.py
import json,re,glob,os
HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.dirname(HERE)
out=[]
for f in sorted(glob.glob(os.path.join(HERE,'raw','*.txt'))):
    page=int(re.search(r'p(\d+)',os.path.basename(f)).group(1) if re.search(r'p(\d+)',os.path.basename(f)) else 0)
    for line in open(f,encoding='utf8'):
        line=line.strip()
        if not line: continue
        left,ru=line.split(' — ',1)
        left=left.strip(); ru=ru.strip()
        # split lemma and grammar: lemma is before first ", " followed by '-' or a genitive word
        m=re.match(r'^(.+?),\s*(.+)$',left)
        if m and (m.group(2).startswith('-') or re.match(r'^[a-z]+is?, [mfn]',m.group(2)) ):
            la,gr=m.group(1),m.group(2)
        else:
            la,gr=left,''
        base=os.path.basename(f)
        extra={}
        if base.startswith('s_abbr'):  # рецептурные сокращения: «Rp. — Recipe — возьми»
            la,gr=left,''; extra={'abbr':True}
        elif base.startswith('s_aphor'):  # афоризмы: перевод целиком, без деления по запятым
            la,gr=left,''; extra={'whole':True}
        elif base.startswith('s_') and ',' in la and ' ' in la:  # «misce, ut fiat pasta» — перевод целиком
            extra={'whole':True}
        if page: src='Кравченко, словарь, с. %d'%page
        elif base.startswith('g_'): src='Городкова, словарь'
        elif base.startswith('s_abbr'): src='Глоссарий СБМК, рецептурные сокращения'
        elif base.startswith('s_aphor'): src='Глоссарий СБМК, афоризмы'
        elif base.startswith('s_'): src='Глоссарий СБМК'
        else: src='Дополнения'
        e={'la':la,'gr':gr,'ru':ru,'src':src}; e.update(extra)
        out.append(e)
idx={e['la'].lower():e for e in out}
tables=[]
for l in open(os.path.join(HERE,'tables.txt'),encoding='utf8'):
    if l.startswith('#') or not l.strip(): continue
    sec,ru,la,el,note=[x.strip() for x in l.rstrip('\n').split('|')]
    tables.append({'sec':sec,'ru':ru,'la':la,'el':el,'note':note})
elements=[]
for l in open(os.path.join(HERE,'elements.txt'),encoding='utf8'):
    if l.startswith('#') or not l.strip(): continue
    t,el,ru=[x.strip() for x in l.split('|')]
    elements.append({'type':t,'el':el,'ru':ru})
data={'entries':out,'tables':tables,'elements':elements,'missingPages':[]}
js='/* Данные словаря. Источники: В.И. Кравченко «Латинский язык для медицинских колледжей и училищ», латинско-русский словарь (с. 327–363), и таблицы терминоэлементов; Ю.И. Городкова «Латинский язык (для медицинских и фармацевтических колледжей и училищ)», КНОРУС, 2017, латинско-русский словарь (с. 221–244) — слова, отсутствующие у Кравченко; Глоссарий СБМК (2026) — слова, сокращения и афоризмы, которых нет в учебниках.\n   Формат записи: la — словарная форма, gr — грамматика (окончание род. п., род / формы прилагательного), ru — перевод, src — источник. */\nwindow.LATIN_DICT = '+json.dumps(data,ensure_ascii=False,indent=0)+';\n'
open(os.path.join(ROOT,'data','dictionary.js'),'w',encoding='utf8').write(js)
print(len(out),len(tables),len(elements))
missing=[t for t in tables if t['la'] and t['la'].lower() not in idx]
print('table lat not in dict:',[t['la'] for t in missing])
