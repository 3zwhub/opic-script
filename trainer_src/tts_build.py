"""미리 만든 음성(mp3) 만들기: 문장마다 mp3 하나, 이름은 문장 내용의 해시.
스크립트를 고친 뒤 다시 돌리면 새로 생긴 문장만 만듭니다 (이미 있는 파일은 건너뜀).

사용 (프로젝트 폴더에서, 먼저 python -I trainer_src/build.py . 로 앱을 빌드):
    python trainer_src/tts_build.py .                       내장 답변·표현 문장
    python trainer_src/tts_build.py . tts_texts.json ...    + 앱 설정에서 내보낸 목록(내가 올린 답변 파일 등)
옵션:
    --voice en-US-JennyNeural   만들 성우 (여러 번 가능). 없으면 내보낸 목록의 성우, 그것도 없으면 Ava
    --prune                    지금 목록에 없는 mp3 지우기 (내보낸 목록을 빠짐없이 넣었을 때만)
    --no-builtin               내장 문장을 빼고 내보낸 목록만

결과: <프로젝트>/netlify_site/ (index.html + tts/) → 이 폴더를 Netlify 에 그대로 올립니다.
필요: pip install edge-tts
"""
import argparse, asyncio, hashlib, html, json, os, re, shutil, subprocess, sys, tempfile, unicodedata
from pathlib import Path

DEFAULT_VOICE = 'en-US-AvaMultilingualNeural'
TRAILING_SILENCE_MS = 400   # 문장 끝 쉼. 이어 붙여 재생할 때 문장 사이·항목 사이 간격이 됩니다
EDGE_FRAME_HEADER = bytes.fromhex('fff364c4')
CONCURRENCY = 4
EDGE_PATHS = [
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
]


# 40_tts.js 의 TtsStatic.norm / key 와 똑같아야 합니다
def norm(text):
    return re.sub(r'[\s\ufeff]+', ' ', unicodedata.normalize('NFC', text)).strip()


def sentence_key(sentence):
    return hashlib.sha1(norm(sentence).encode('utf-8')).hexdigest()[:20]


def builtin_export(app_html):
    """빌드된 앱을 헤드리스 Edge 로 열어 ?ttsexport 결과(내장 데이터 기준 문장 목록)를 받습니다."""
    edge = next((p for p in EDGE_PATHS if os.path.exists(p)), None) or shutil.which('msedge')
    if not edge:
        raise SystemExit('Microsoft Edge 를 찾지 못했습니다. --no-builtin 으로 내보낸 목록만 쓰세요.')
    with tempfile.TemporaryDirectory() as prof:
        out = subprocess.run(
            [edge, '--headless=new', '--disable-gpu', '--no-first-run', f'--user-data-dir={prof}',
             '--virtual-time-budget=20000', '--dump-dom', app_html.resolve().as_uri() + '?ttsexport=1'],
            capture_output=True, timeout=120).stdout.decode('utf-8', 'replace')
    m = re.search(r'<pre id="ttsexport">(.*?)</pre>', out, re.S)
    if not m:
        raise SystemExit('앱에서 문장 목록을 받지 못했습니다. 먼저 build.py 로 다시 빌드했는지 확인하세요.')
    return json.loads(html.unescape(m.group(1)))


def load_export(path):
    with open(path, encoding='utf-8-sig') as f:
        data = json.load(f)
    if data.get('kind') != 'tts-texts':
        raise SystemExit(f'{path}: 앱의 "음성 문장 목록 내보내기" 파일이 아닙니다')
    return data


def silence_frames(ms):
    """Edge 출력(MPEG-2 Layer III 24kHz 48kbps 모노, 프레임 144바이트 = 24ms)과 같은 형식의 무음 프레임.
    본문이 0 이면(데이터 길이 0) 디코더가 무음으로 읽습니다. (서버가 SSML <break> 를 거부해서 직접 붙입니다)"""
    return (EDGE_FRAME_HEADER + bytes(140)) * round(ms / 24)


async def synth_all(jobs, edge_tts):
    sem = asyncio.Semaphore(CONCURRENCY)
    done = failed = 0

    async def one(voice, sentence, dst):
        nonlocal done, failed
        async with sem:
            for attempt in range(3):
                try:
                    audio = bytearray()
                    async for chunk in edge_tts.Communicate(sentence, voice).stream():
                        if chunk['type'] == 'audio':
                            audio += chunk['data']
                    if len(audio) < 500 or audio[:4] != EDGE_FRAME_HEADER:
                        raise RuntimeError(f'예상과 다른 오디오 ({len(audio)}바이트, 머리 {audio[:4].hex()})')
                    tmp = dst.with_suffix('.part')
                    tmp.write_bytes(audio + silence_frames(TRAILING_SILENCE_MS))
                    tmp.replace(dst)
                    done += 1
                    if done % 50 == 0:
                        print(f'  {done}/{len(jobs)}')
                    return
                except Exception as e:
                    if attempt == 2:
                        failed += 1
                        print(f'  실패: {sentence[:60]!r} ({e})')
                    else:
                        await asyncio.sleep(2 * (attempt + 1))

    await asyncio.gather(*(one(*j) for j in jobs))
    return done, failed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('exports', nargs='*')
    ap.add_argument('--voice', action='append')
    ap.add_argument('--prune', action='store_true')
    ap.add_argument('--no-builtin', action='store_true')
    args = ap.parse_args()

    project = Path(args.project)
    app_html = project / 'opic_trainer.html'
    site = project / 'netlify_site'
    tts_dir = site / 'tts'

    exports = [load_export(p) for p in args.exports]
    sources = ([] if args.no_builtin else [builtin_export(app_html)]) + exports
    sentences = {}
    for src in sources:
        for s in src['sentences']:
            n = norm(s)
            if n:
                sentences.setdefault(sentence_key(n), n)
    voices = args.voice or sorted({e['voice'] for e in exports if e.get('voice')}) or [DEFAULT_VOICE]
    print(f'문장 {len(sentences)}개 · 성우 {", ".join(voices)}')

    jobs = []
    for voice in voices:
        vdir = tts_dir / voice
        vdir.mkdir(parents=True, exist_ok=True)
        for k, s in sentences.items():
            dst = vdir / f'{k}.mp3'
            if not dst.exists():
                jobs.append((voice, s, dst))
    print(f'새로 만들 파일 {len(jobs)}개')

    if jobs:
        try:
            import edge_tts
        except ImportError:
            raise SystemExit('edge-tts 가 없습니다: pip install edge-tts')
        done, failed = asyncio.run(synth_all(jobs, edge_tts))
        print(f'만듦 {done}개, 실패 {failed}개' + (' (다시 실행하면 실패한 것만 이어서 만듭니다)' if failed else ''))

    manifest = {'version': 1, 'voices': {}}
    for vdir in sorted(p for p in tts_dir.iterdir() if p.is_dir()):
        for part in vdir.glob('*.part'):
            part.unlink()
        if args.prune:
            stale = [f for f in vdir.glob('*.mp3') if f.stem not in sentences]
            for f in stale:
                f.unlink()
            if stale:
                print(f'{vdir.name}: 목록에 없는 파일 {len(stale)}개 지움')
        keys = sorted(f.stem for f in vdir.glob('*.mp3'))
        if keys:
            manifest['voices'][vdir.name] = keys
    with open(tts_dir / 'manifest.json', 'w', encoding='utf-8', newline='\n') as f:
        json.dump(manifest, f, separators=(',', ':'))

    shutil.copyfile(app_html, site / 'index.html')
    shutil.copyfile(app_html, site / 'opic_trainer.html')
    size = sum(f.stat().st_size for f in tts_dir.rglob('*.mp3'))
    print(f'완료: {site} (mp3 {sum(len(v) for v in manifest["voices"].values())}개, {size / 1048576:.1f}MB)')
    print('이 폴더를 Netlify 에 올리세요 (Deploys → 폴더 끌어다 놓기).')


if __name__ == '__main__':
    main()
