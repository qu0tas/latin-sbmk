# Озвучка фраз из texts.json голосом Silero TTS (kseniya) → audio/xx/<fnv1a>.mp3 и data/audio.js
# 1) node tools/audio/collect.js   2) pip install torch numpy; скачать https://models.silero.ai/models/tts/ru/v4_ru.pt в tools/audio/
# 3) python3 tools/audio/gen.py    — уже готовые файлы пропускаются, озвучиваются только новые слова (нужен ffmpeg)
import torch, json, subprocess, numpy as np, os, time
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'audio')
torch.set_num_threads(os.cpu_count() or 2)
texts = json.load(open(os.path.join(HERE, 'texts.json'), encoding='utf8'))
def fnv(s):
    h = 0x811c9dc5
    for ch in s:
        h ^= ord(ch); h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h
todo = [(k, v) for k, v in sorted(texts.items()) if not os.path.exists(os.path.join(OUT, fnv(k)[:2], fnv(k) + '.mp3'))]
print('новых фраз:', len(todo))
if todo:
    m = torch.package.PackageImporter(os.path.join(HERE, 'v4_ru.pt')).load_pickle('tts_models', 'model')
    t0 = time.time()
    for n, (key, txt) in enumerate(todo, 1):
        h = fnv(key); d = os.path.join(OUT, h[:2]); os.makedirs(d, exist_ok=True)
        try:
            a = m.apply_tts(text=txt, speaker='kseniya', sample_rate=24000, put_accent=('+' not in txt), put_yo=('+' not in txt)).numpy()
        except Exception as e:
            print('ошибка:', key, e); continue
        i = np.where(np.abs(a) > 0.01)[0]
        if len(i): a = a[max(0, i[0] - 1200): i[-1] + 2400]
        pcm = (np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes()
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', '-', '-b:a', '40k', os.path.join(d, h + '.mp3')], input=pcm, check=True)
        if n % 200 == 0: print(n, '/', len(todo), round(time.time() - t0), 'с')
# удаляем записи фраз, которых больше нет в списке (изменилась транскрипция или слово удалено)
need = {fnv(k) for k in texts}
for d in os.listdir(OUT) if os.path.isdir(OUT) else []:
    for f in os.listdir(os.path.join(OUT, d)):
        if f.endswith('.mp3') and f[:-4] not in need: os.remove(os.path.join(OUT, d, f))
# индекс записей для сайта: только те фразы, что есть в texts.json и уже озвучены
keys = sorted(fnv(k) for k in texts if os.path.exists(os.path.join(OUT, fnv(k)[:2], fnv(k) + '.mp3')))
open(os.path.join(ROOT, 'data', 'audio.js'), 'w', encoding='utf8').write('/* Индекс записей диктора (генерируется tools/audio/gen.py): FNV-1a хэши фраз по 8 символов */\nwindow.AUDIO_INDEX = "' + ''.join(keys) + '";\n')
print('в индексе записей:', len(keys))
