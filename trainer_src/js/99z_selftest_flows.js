// 자체 점검: 드릴 흐름 (클릭을 흉내 냅니다)
SelfTest.extra = async (tryCheck) => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const waitFor = async (cond, tries = 60) => { for (let k = 0; k < tries && !cond(); k++) await wait(50); return cond(); };
    const click = async (root, act, extra = '') => {
        const b = root.querySelector(`[data-act="${act}"]${extra}`);
        if (!b) throw new Error(`버튼 없음: ${act}${extra} / 있는 버튼: ${[...root.querySelectorAll('[data-act]')].map(x => x.dataset.act).join(',')} / 화면: ${root.textContent.replace(/\s+/g, ' ').slice(0, 300)}`);
        b.click(); await wait(60);
    };

    await tryCheck('모의고사 15문항 구성 (5-5 배치)', () => {
        const m = Drill.buildMock();
        const rp = m.slice(10, 13).every(x => x.topicType === 'RP');
        const survey = m.slice(1, 7).every(x => x.topicType === '서베이');
        const common = m.slice(7, 10).every(x => x.topicType === '공통형') && m.slice(13, 15).every(x => x.topicType === '공통형');
        return [m.length === 15 && m[0].key === 'intro' && rp && survey && common, `${m.length}문항 / ${m.map(x => x.topicType).join(',')}`];
    });
    await tryCheck('즉흥 3단계 구성: 돌발 1 + 비교·이슈/RP 1 + 무작위 1', () => {
        const m = Drill.improvMix(3);
        return [m.length === 3 && m[0].topicType === '공통형', m.map(x => `${x.topicType}:${x.qType}`).join(', ')];
    });
    await tryCheck('진행기 → 자기평가 → 세션 저장 (녹음 없이 시간만)', async () => {
        const box = document.createElement('div'); document.body.appendChild(box);
        const t = Data.topic('집');
        let saved = null;
        const autoQ = Settings.v.autoQuestion; Settings.v.autoQuestion = false;
        Runner.mount(box, Drill.comboItems(t, t.combos[0]).slice(0, 2), { mode: 'selftest', showModel: true, onFinish: s => { saved = s; } });
        for (let k = 0; k < 2; k++) {
            await click(box, Rec.supported() ? 'watch' : 'record');
            await click(box, 'stop');
            if (k === 0) { await click(box, 'model'); if (!/전체 듣기/.test(box.textContent)) throw new Error('모범답변이 안 보임'); }
            await click(box, 'next');
        }
        box.querySelector('input[data-k="0"][data-c="0"]').click();
        await click(box, 'save'); await waitFor(() => saved, 300);
        Settings.v.autoQuestion = autoQ;
        box.remove();
        const ok = saved && saved.items.length === 2 && saved.items[0].checklist[0] === true && saved.items[0].score === 1;
        if (saved) await DB.del('sessions', saved.id);
        return [ok, saved ? `문항 ${saved.items.length}, 첫 문항 점수 ${saved.items[0].score}, 라벨 ${saved.items[0].label}` : '저장 안 됨'];
    });
    await tryCheck('주제 순서 (서베이 8 · 돌발 20 · 동네 길 번호 · 표현 모음)', () => {
        const s = Data.topics('서베이').map(t => t.name).join(','), c = Data.topics('공통형').map(t => t.name).join(',');
        const S = '집,음악,국내여행,해외여행,집휴가,영화,TV,쇼핑';
        const C = '가구,재활용,산업,음식점,모임,식품(추정),건강,지형,인터넷,전화기,기술,날씨,교통,패션,은행,호텔,예약,자유시간,휴일,가족친구';
        const places = Data.topics('공통형').every((t, i) => Data.place(t).startsWith(`동네 길 ${i + 1} `));
        const exprTopics = [...new Set(Data.expressions.map(x => x.topic))].join(',');
        const exprOk = exprTopics === C.split(',').filter(n => exprTopics.split(',').includes(n)).join(',');
        const palaceOk = Palace.houseTopics().map(t => t.name).join(',') === S;
        return [s === S && c === C && places && exprOk && palaceOk, `서베이 ${s} | 돌발 ${c} | 길 번호 ${places} | 표현 ${exprTopics}`];
    });
    await tryCheck('갈림길 트리 계산 (집, 경로 기준)', () => {
        const t = Data.topic('집'), tr = Data.tree(t);
        const j = x => (x || []).join(',');
        const ok = j(tr.as1.get('집')) === '일과,예전집,문제들' && j(tr.q3by.get('집|일과')) === '예전집,문제들'
            && j(tr.q3by.get('집|예전집')) === '변화,추억' && j(tr.q3by.get('집|문제들')) === '문제1' && j(tr.pair.get('부모')) === '집구하기'
            && Data.roles(t, '변화').length === 0;
        return [ok, `집→${j(tr.as1.get('집'))} | 예전집→${j(tr.q3by.get('집|예전집'))} | 부모→${j(tr.pair.get('부모'))}`];
    });
    await tryCheck('갈림길 카드 수와 장면 데이터 (장면의 → 후보 = 트리)', () => {
        const s = Data.allForks('서베이'), c = Data.allForks('공통형');
        const bad = [...s, ...c].filter(f => {
            if (!f.scene) return true;
            const got = f.scene.split('→').pop().replace(/\(.*?\)\s*$/, '').split('/').map(x => x.trim()).filter(Boolean);
            return got.join(',') !== f.next.join(',');
        }).map(f => `${f.t.name}/${f.name}/${f.role}`);
        const shop = Data.roles(Data.topic('쇼핑'), '루틴').map(r => r.role).join('');
        return [s.length === 41 && c.length === 103 && !bad.length && shop === '12', `서베이 ${s.length}, 돌발 ${c.length}, 장면 문제 ${bad.length}건 ${bad.slice(0, 5).join(' ')} · 쇼핑 루틴 역할 ${shop}`];
    });
    await tryCheck('다음 질문 맞히기: 칩 선택 → 확인 → 정확 채점 → 다음 복습 내일', async () => {
        const box = document.createElement('div'); document.body.appendChild(box);
        const t = Data.topic('집'), f = Data.forks(t).find(x => x.name === '집' && x.role === '1');
        let done = false;
        Predict.cards(box, [f], { newLimit: 5, onDone: () => { done = true; } });
        for (const n of ['일과', '예전집', '문제들']) await click(box, 'chip', `[data-n="${n}"]`);
        await click(box, 'check');
        await waitFor(() => /정확/.test(box.textContent));
        const graded = /정확/.test(box.textContent), sawScene = /열쇠로 문을 열자/.test(box.textContent);
        const card = SRS.get(f.key);
        await click(box, 'next'); await waitFor(() => /갈림길 1개 끝/.test(box.textContent));
        await click(box, 'done');
        const ok = graded && sawScene && card && card.due === U.today(1) && done;
        await DB.del('cards', f.key); SRS.cards.delete(f.key);
        UI.busy = false; box.remove();
        return [ok, `정확 ${graded}, 장면 ${sawScene}, 다음 복습 ${card && card.due}, 끝 콜백 ${done}`];
    });
    await tryCheck('콤보 흐름: 예측 → 공개 → 실제 다음 질문 → 콤보 끝', async () => {
        const box = document.createElement('div'); document.body.appendChild(box);
        const autoQ = Settings.v.autoQuestion; Settings.v.autoQuestion = false;
        Predict.flow(box, [Data.topic('기술')]);
        let steps = 0;
        while (!/콤보 끝/.test(box.textContent) && steps < 4) {
            const chip = box.querySelector('[data-act="chip"]'); chip.click(); await wait(40);
            await click(box, 'check'); await waitFor(() => /실제 다음 질문/.test(box.textContent));
            await click(box, 'go'); steps++;
        }
        const ended = /콤보 끝/.test(box.textContent);
        for (const k of [...SRS.cards.keys()].filter(k => k.startsWith('fork/기술/'))) { await DB.del('cards', k); SRS.cards.delete(k); }
        Settings.v.autoQuestion = autoQ; UI.busy = false; box.remove();
        return [ended && steps >= 1, `예측 ${steps}회, 끝 ${ended}`];
    });
    await tryCheck('드릴에서 답한 뒤 다음 질문 예상', async () => {
        const box = document.createElement('div'); document.body.appendChild(box);
        const t = Data.topic('집'), c = t.combos[0];   // 집 / 일과 / 예전집
        const autoQ = Settings.v.autoQuestion; Settings.v.autoQuestion = false;
        Runner.mount(box, Drill.comboItems(t, c), { mode: 'selftest', showModel: true, onFinish: () => {} });
        await click(box, Rec.supported() ? 'watch' : 'record'); await click(box, 'stop');
        const shown = /다음 질문 예상/.test(box.textContent);
        for (const n of ['일과', '예전집', '문제들']) await click(box, 'chip', `[data-n="${n}"]`);
        await click(box, 'pcheck'); await waitFor(() => /정확/.test(box.textContent));
        const ok = shown && /정확/.test(box.textContent);
        const k = Data.forkKey(t, '1', '집'); await DB.del('cards', k); SRS.cards.delete(k);
        Rec.cancel(); Settings.v.autoQuestion = autoQ; UI.busy = false; box.remove();
        return [ok, `예상 칸 ${shown}, 채점 ${/정확/.test(box.textContent)}`];
    });
    // 녹음은 실제 시간이 흘러야 해서 가상 시간 headless 실행에서는 건너뜁니다 (?selftest=rec 로 따로 실행)
    if (new URLSearchParams(location.search).get('selftest') === 'rec') await tryCheck('녹음: 마이크 → Blob → IndexedDB 저장·삭제', async () => {
        if (!Rec.supported()) return [false, '녹음 미지원'];
        await Rec.start(); await wait(1200);
        const res = await Rec.stop();
        const rec = await Rec.save({ mode: 'selftest', label: 'selftest' }, res);
        const got = await DB.get('recordings', rec.id);
        await DB.del('recordings', rec.id);
        return [res.blob.size > 0 && got && got.blob && got.blob.size === res.blob.size, `형식 ${res.mime}, ${res.blob.size}바이트, 저장본 ${got && got.blob && got.blob.size}`];
    });
    await tryCheck('요소 편집 → combos 텍스트 반영 → 되돌리기', () => {
        const before = Data.combosText();
        const t = Data.topic('음악');
        Data.updateEl(t, '장르', { 위치: '1. 책상 스피커', 기호: '테스트 기호', K: 'pop, jazz' });
        const txt = Data.combosText();
        const block = txt.slice(txt.indexOf('- 장르\n'), txt.indexOf('- 루틴\n', txt.indexOf('- 장르\n')));
        const keys = block.split('\n').slice(1).map(l => l.trim().split(':')[0]).filter(Boolean);
        const ok = keys.join(',') === '유형,답변,위치,기호,연결,신호,장면,K' && /위치: 1\. 책상 스피커/.test(block) && Data.el(t, '장르').symbol === '테스트 기호';
        Data.replaceCombosText(before);
        return [ok && Data.combosText() === before, ok ? '형식 정상' : block];
    });
    await tryCheck('궁전 게임: 모든 주제 그림·위치, 걷기, 맞히기 흐름', async () => {
        const errs = [];
        for (const t of Data.topics()) {
            history.replaceState(null, '', '#/palace/game/' + encodeURIComponent(t.name)); await UI.render();
            const n = UI.el.querySelectorAll('.pg-locus').length;
            if (n !== t.chain.length) errs.push(`${t.name} 위치 ${n}/${t.chain.length}`);
        }
        history.replaceState(null, '', '#/palace/game/' + encodeURIComponent('집')); await UI.render();
        const st = PalaceGame._state, keep = { mode: st.mode, visited: [...st.visited] };
        UI.el.querySelector('[data-mode="walk"]').click(); st.visited.clear();
        UI.el.querySelector('[data-act="walkNext"], .pg-locus[data-no="1"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        if (!UI.el.querySelector('.pg-link') || !/스위치/.test(UI.el.querySelector('.pg-link').textContent)) errs.push('걷기: 1번 연결 카드 없음');
        UI.el.querySelector('[data-mode="quiz"]').click();
        const z = st.quiz, first = Data.el(Data.topic('집'), z.combo[0]).locusNo;
        UI.el.querySelector(`.pg-locus[data-no="${first}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        if (!['predict', 'done'].includes(st.quiz.phase)) errs.push('맞히기: 정답을 눌러도 다음 단계로 안 감 ' + st.quiz.phase);
        if (!UI.el.querySelector('.pg-sym')) errs.push('맞히기: 기호 말풍선 없음');
        const kw = UI.el.querySelector('.pg-panel .kw-chip[data-say]');
        if (kw && !UI.sayMap.get(kw.dataset.say)) errs.push('키워드 칩에 문장 재생 연결 안 됨');
        st.mode = keep.mode; st.visited = new Set(keep.visited); U.lsSet('opicTrainer.palaceGame.t.집.visited', keep.visited); U.lsSet('opicTrainer.palaceGame.mode', keep.mode);
        UI.teardown();
        return [!errs.length, errs.join(' || ')];
    });
};
