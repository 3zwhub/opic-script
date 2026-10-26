opic_trainer.html 소스

- shell.html: 화면 틀과 CSS
- js/*.js: 파일 이름 순서대로 합쳐집니다 (00 설정 → 10 유틸 → 20 파서 → 30 저장소 → 40 TTS → 45 녹음·동기화 → 60 화면 공통 → 70 자료실 → 80 궁전 → 81 궁전 게임 → 82 카드 → 85 드릴 → 88 오늘·기록 → 95 시작 → 99 자체 점검)
- build.py: 위 파일들과 프로젝트 폴더의 combos.txt, 일반_260727_1_edited.txt, 표현_모음.txt, 키워드_문장.txt를 넣어 opic_trainer.html 하나로 만듭니다.

다시 만들기 (프로젝트 폴더에서):
    python -I trainer_src/build.py .

combos.txt만 바뀐 경우에는 다시 만들 필요 없이 앱의 설정 > combos.txt 가져오기로 반영할 수 있습니다.
자체 점검: opic_trainer.html?selftest=1 로 열면 결과가 화면에 나옵니다.

미리 만든 음성 (Edge TTS mp3)
- 앱은 Edge 음성을 '미리 만든 mp3 → 실시간 Worker → 내장 음성' 순서로 씁니다.
- 문장마다 mp3 하나, 파일 이름은 문장 내용의 해시입니다. 스크립트를 고치면 바뀐 문장만 새로 만들면 되고,
  아직 안 만든 문장은 앱이 알아서 실시간/내장 음성으로 읽습니다.
- 처음 한 번: pip install edge-tts

스크립트를 바꾼 뒤 (프로젝트 폴더에서):
    python -I trainer_src/build.py .
    python trainer_src/tts_build.py .
  → docs 폴더(index.html + tts/)를 커밋하고 git push 하면 GitHub Pages 에 배포됨

앱에서 직접 올린 답변 파일·막힌 표현까지 넣으려면:
  앱 설정 > '음성 문장 목록 내보내기' → tts_texts.json 을 받아서
    python trainer_src/tts_build.py . tts_texts.json
  (재생하다 mp3가 없던 문장도 이 목록에 자동으로 들어갑니다)

옵션: --voice en-US-JennyNeural (다른 성우) / --prune (목록에 없는 mp3 정리)

키워드 (답변 문장 암기 화면)
- 스크립트 전체 키워드: 일반_260727_1_edited.txt 의 각 답변 끝 'K:' 줄 (앱 '키워드만' 보기, 자료실에서 고칠 수 있음)
- 문장별 키워드와 연결: 키워드_문장.txt
    == Q001
    3: 키워드 | 키워드          ← 3번째 문장(③)의 키워드. 그 문장에 실제로 있는 구절이어야 표시됨
    연결: A > B | 관계          ← B가 A의 이유/결과/대조/구체화/위치/같은
  답변이 똑같은 스크립트(Q002 = Q001 등)는 원본 블록을 함께 씁니다.
- 앱 '문장 키워드' 보기에서 키워드를 누르면 그 문장을 읽고, '첫 글자' 보기에서도 문장을 누르면 읽습니다.
- 고친 뒤에는 build.py 로 다시 만들고, 자체 점검(?selftest=1)의 '문장 키워드' 항목으로 확인합니다.
