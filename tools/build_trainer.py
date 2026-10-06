# Сборка data/trainer.js из tools/trainer/glossary.txt и tools/trainer/systems.txt: python3 tools/build_trainer.py
import json,os,re
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
lists=[];cur=None
for line in open(os.path.join(HERE,'trainer','glossary.txt'),encoding='utf8'):
    line=line.rstrip('\n')
    if not line.strip() or line.startswith('# '): continue
    if line.startswith('## '):
        p=[x.strip() for x in line[3:].split('|')]
        cur={'id':'g%d'%(len(lists)+1),'group':p[0],'title':p[1],'labelA':p[2] if len(p)>2 else 'Латынь','labelB':p[3] if len(p)>3 else 'Перевод','items':[]}
        lists.append(cur); continue
    a,b=[x.strip() for x in line.split(' | ',1)]
    cur['items'].append([a,b])
systems=[];cur=None
for line in open(os.path.join(HERE,'trainer','systems.txt'),encoding='utf8'):
    line=line.rstrip('\n')
    if not line.strip() or line.startswith('# '): continue
    if line.startswith('## '):
        cur={'id':'s%d'%(len(systems)+1),'title':line[3:].strip(),'rows':[]}; systems.append(cur); continue
    c=[x.strip() for x in line.split('|')]
    c+=['']*(6-len(c))
    cur['rows'].append(c[:6])
data={'lists':lists,'systems':systems,'columns':['Русское название','Латинское название','Греческий эквивалент','Воспаление по-латински','Воспаление по-русски','Прочие термины']}
open(os.path.join(ROOT,'data','trainer.js'),'w',encoding='utf8').write('/* Данные тренажёра (генерируется tools/build_trainer.py). Источник: Глоссарий СБМК по дисциплине «Основы латинского языка с медицинской терминологией» (2026) и таблицы систем органов. */\nwindow.TRAINER_DATA = '+json.dumps(data,ensure_ascii=False)+';\n')
print(len(lists),'lists',sum(len(l['items']) for l in lists),'items;',len(systems),'systems',sum(len(s['rows']) for s in systems),'rows')
