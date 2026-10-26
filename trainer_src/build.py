"""opic_trainer.html 빌드: shell.html + js/*.js + 데이터 4개(원문 그대로) → 파일 하나.
사용: python -I build.py <project_dir>
"""
import glob, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = sys.argv[1]

def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read().replace('\r\n', '\n')

shell = read(os.path.join(HERE, 'shell.html'))
js = '\n'.join(read(p) for p in sorted(glob.glob(os.path.join(HERE, 'js', '*.js'))))

seeds = []
for sid, name in [('seed-combos', 'combos.txt'), ('seed-answers', '일반_260727_1_edited.txt'), ('seed-expressions', '표현_모음.txt'), ('seed-keywords', '키워드_문장.txt')]:
    text = read(os.path.join(PROJECT, name))
    if '</script' in text.lower():
        raise SystemExit(f'{name}에 </script 가 있어 넣을 수 없습니다')
    seeds.append(f'<script type="text/plain" id="{sid}">\n{text}</script>')

if '</script' in js.lower():
    raise SystemExit('JS 안에 </script 문자열이 있습니다')

out = shell.replace('<!--SEED-->', '<!-- 내장 데이터 (빌드할 때 프로젝트 폴더의 파일을 그대로 넣음) -->\n' + '\n'.join(seeds))
out = out.replace('<!--SCRIPT-->', '<script>\n"use strict";\n' + js + '\n</script>')
dst = os.path.join(PROJECT, 'opic_trainer.html')
with open(dst, 'w', encoding='utf-8', newline='\n') as f:
    f.write(out)
print('written', dst, len(out) // 1024, 'KB', out.count('\n') + 1, 'lines')
