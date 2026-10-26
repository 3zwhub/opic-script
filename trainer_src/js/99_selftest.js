// =========================================================================
//  자체 점검: 주소 뒤에 ?selftest=1 을 붙여 열면 실행됩니다
// =========================================================================
const SelfTest = {
    async run() {
        const results = [];
        const check = (name, cond, detail = '') => results.push({ name, ok: !!cond, detail: String(detail) });
        const recOnly = new URLSearchParams(location.search).get('selftest') === 'rec';
        const tryCheck = async (name, fn) => { if (recOnly && !/^녹음/.test(name)) return; document.title = 'RUNNING ' + name; try { const r = await fn(); check(name, r === undefined ? true : r[0], r === undefined ? '' : r[1]); } catch (e) { check(name, false, e.stack || e.message); } };

        await tryCheck('combos 파싱: 주제·요소·콤보 수', () => {
            const m = Parse.combos(Data.seed('seed-combos'));
            const sum = type => { const ts = m.topics.filter(t => (Parse.field(t, '유형') || '서베이') === type); return [ts.length, ts.reduce((a, t) => a + t.chain.length, 0), ts.reduce((a, t) => a + t.combos.length, 0)].join('/'); };
            const s = sum('서베이'), c = sum('공통형');
            return [s === '8/60/38' && c === '20/150/75' && m.errors.length === 0, `서베이 ${s}, 공통형 ${c}, 오류 ${m.errors.length} ${m.errors.slice(0, 3).join(' | ')}`];
        });
        await tryCheck('combos 사슬 = 콤보에서 처음 나온 순서', () => {
            const m = Parse.combos(Data.seed('seed-combos'));
            const bad = m.topics.filter(t => { const seen = []; t.combos.flat().forEach(e => { if (!seen.includes(e)) seen.push(e); }); return seen.join('>') !== t.chain.join('>'); });
            return [!bad.length, bad.map(t => t.name).join(',')];
        });
        await tryCheck('combos 내보내기 왕복 (내용 보존 + 두 번째부터 동일)', () => {
            const seed = Data.seed('seed-combos');
            const a = Parse.serializeCombos(Parse.combos(seed));
            const b = Parse.serializeCombos(Parse.combos(a));
            const m1 = Parse.combos(seed), m2 = Parse.combos(a);
            const same = JSON.stringify(m1.topics.map(t => [t.name, t.fields, t.chain, t.combos, t.elOrder.map(n => t.elements[n].fields)])) ===
                JSON.stringify(m2.topics.map(t => [t.name, t.fields, t.chain, t.combos, t.elOrder.map(n => t.elements[n].fields)]));
            const seedLines = seed.replace(/\r/g, '').split('\n').filter(l => l.trim()), outLines = a.split('\n').filter(l => l.trim());
            const missing = seedLines.filter(l => !outLines.includes(l));
            return [same && a === b && missing.length === 0, `동일=${same}, 안정=${a === b}, 원본에만 있는 줄 ${missing.length}개 ${missing.slice(0, 3).join(' | ')}`];
        });
        await tryCheck('답변 txt 파싱: 163개, Q번호 중복 없음', () => {
            const s = Parse.scripts(Data.seed('seed-answers'));
            const ids = new Set(s.map(x => x.id));
            const emptyQ = s.filter(x => !Parse.hasQuestion(x)).length;
            return [s.length === 163 && ids.size === 163, `${s.length}개, 고유 ${ids.size}, 질문 없음 ${emptyQ}, 마지막 ${s[s.length - 1] && s[s.length - 1].id}`];
        });
        await tryCheck('답변 본문 속 "xxx: yyy" 문장을 헤더로 오인하지 않음', () => {
            const s = Parse.scripts('집01-Q001-제목: Question?\nA: First line.\nThe key negotiables: price and time.\n집02-Q002-제목2: Q2?\nA: Two.');
            return [s.length === 2 && s[0].answer.includes('negotiables: price'), JSON.stringify(s.map(x => x.id))];
        });
        await tryCheck('요소 → 모범답변 연결 (집/집 → Q001)', () => {
            const t = Data.topic('집'); const i = Data.el(t, '집');
            return [i.scripts.length === 1 && i.scripts[0].id === 'Q001' && Data.question(i).en.length > 10 && i.locusNo === 1, `${i.scripts.map(s => s.id)} 위치 ${i.locusNo} ${i.locus}`];
        });
        await tryCheck('궁전 위치·연결 서술: 모든 주제 채움, 걷기 화면에 표시', async () => {
            const miss = Data.topics().flatMap(t => t.chain.filter(n => { const i = Data.el(t, n); return !i.link || !i.locus; }).map(n => t.name + '/' + n));
            history.replaceState(null, '', '#/palace/walk/' + encodeURIComponent('집')); await UI.render();
            UI.el.querySelector('[data-act="more"]').click(); await new Promise(r => setTimeout(r, 30));
            const shown = !!UI.el.querySelector('.link-box');
            UI.teardown();
            return [!miss.length && shown, `없음 ${miss.join(',')} · 걷기 표시 ${shown}`];
        });
        await tryCheck('서베이 요소 답변 연결 수', () => {
            const infos = Data.topics('서베이').flatMap(t => t.chain.map(n => Data.el(t, n)));
            const linked = infos.filter(i => i.scripts.length).length;
            return [infos.length === 60, `60개 중 연결 ${linked}개`];
        });
        await tryCheck('표현 모음 파싱', () => [Data.expressions.length > 200, `${Data.expressions.length}개, 주제 ${new Set(Data.expressions.map(x => x.topic)).size}`]);
        await tryCheck('문장 분할 (Mr. / 3.5 보호)', () => {
            const s = U.sentences('Mr. Kim is 3.5 meters tall. Wow! Is it true?');
            return [s.length === 3 && s[0] === 'Mr. Kim is 3.5 meters tall.', JSON.stringify(s)];
        });
        // 기대값은 trainer_src/tts_build.py 의 sentence_key 로 계산한 값입니다 (둘이 다르면 미리 만든 음성을 못 찾음)
        await tryCheck('미리 만든 음성 파일 이름 = tts_build.py 와 같음', async () => {
            const a = await TtsStatic.key("Let's start the interview now.");
            const b = await TtsStatic.key('  Café  au\nlait — it’s “fine”.﻿  ');
            return [a === '689cf689606fc1a6342e' && b === '625527ec51745dcf5245', `${a} ${b}`];
        });
        await tryCheck('음성 문장 목록: 답변·표현·자기소개 질문 포함, 중복 없음', () => {
            const all = TtsStatic.allSentences();
            const s = Data.files[0].scripts.find(x => Parse.hasQuestion(x));
            const want = [...U.sentences(s.answer), ...U.sentences(s.question), ...U.sentences(INTRO_QUESTION), ...U.sentences(Data.expressions[0].en)].map(x => TtsStatic.norm(x));
            return [want.every(x => all.includes(x)) && new Set(all).size === all.length, `${all.length}문장`];
        });
        await tryCheck('HTML 이스케이프', () => [!U.esc('<img src=x onerror=alert(1)>"\'').includes('<'), U.esc('<b>')]);
        await tryCheck('간격 반복: 기억남 2회 → 숙련, 모름 → 오늘', async () => {
            const k = 'selftest/card';
            const c1 = await SRS.grade(k, 'good'); const d1 = c1.due;
            const c2 = await SRS.grade(k, 'good'); const d2 = c2.due; const m = SRS.mastered(k);
            const c3 = await SRS.grade(k, 'again');
            const ok = d1 === U.today(1) && d2 === U.today(2) && m && c3.due === U.today() && !SRS.mastered(k);
            await DB.del('cards', k); SRS.cards.delete(k);
            return [ok, `1차 ${d1}, 2차 ${d2}, 숙련 ${m}, 모름 후 ${c3.due}`];
        });
        await tryCheck('IndexedDB 저장·삭제', async () => {
            const id = await DB.put('sessions', { date: U.today(), mode: 'selftest' });
            const got = await DB.get('sessions', id); await DB.del('sessions', id);
            return [!!got && got.mode === 'selftest', `IndexedDB 사용 ${!!DB.db}, id ${id}`];
        });
        await tryCheck('모든 화면 그리기 (오류 없음)', async () => {
            const errs = [];
            const routes = ['#/today', '#/palace', '#/palace/' + encodeURIComponent('집'), '#/palace/' + encodeURIComponent('동네 길'), '#/palace/walk/' + encodeURIComponent('집'), '#/palace/predict/' + encodeURIComponent('집') + '/cards', '#/palace/predict/*survey/flow', '#/palace/predict/*due/cards', '#/drill', '#/drill/combo', '#/drill/improv', '#/drill/cards', '#/drill/mock', '#/records', '#/library', '#/library/combos', '#/library/expr', '#/library/topic/' + encodeURIComponent('집'), '#/library/topic/' + encodeURIComponent('휴일')];
            for (const r of routes) {
                history.replaceState(null, '', r); await UI.render();
                if (/화면을 그리지 못했습니다/.test(UI.el.textContent)) errs.push(r + ': ' + UI.el.textContent.slice(0, 120));
            }
            const f = Data.activeFile();
            history.replaceState(null, '', `#/library/script/${f.fileId}/${f.scripts[0].uuid}`); await UI.render();
            if (!/Q001/.test(UI.el.textContent)) errs.push('스크립트 상세에 Q001이 없음');
            UI.teardown();
            return [!errs.length, errs.join(' || ')];
        });
        await tryCheck('스크립트 키워드(K): 답변 있는 스크립트 모두 채움', () => {
            const s = Parse.scripts(Data.seed('seed-answers')).filter(x => x.answer);
            const empty = s.filter(x => !x.keywords);
            return [!empty.length, `${s.length}개 중 비어 있음 ${empty.length} ${empty.slice(0, 5).map(x => x.id).join(',')}`];
        });
        await tryCheck('문장 키워드: 문장 안에 있음 · 연결 끝이 키워드 · 같은 답변 공유', () => {
            const blocks = Parse.sentKeywords(Data.seed('seed-keywords'));
            const seed = Parse.scripts(Data.seed('seed-answers'));
            const bad = []; let kws = 0, edges = 0;
            Object.entries(blocks).forEach(([id, b]) => {
                const sc = seed.find(x => x.id === id); if (!sc) { bad.push(id + ' 스크립트 없음'); return; }
                const sents = U.sentences(sc.answer), have = new Set();
                Object.entries(b.lines).forEach(([n, ks]) => ks.forEach(k => { kws++; have.add(Kw.norm(k)); if (!sents[n - 1] || !Kw.norm(sents[n - 1]).includes(Kw.norm(k))) bad.push(`${id}:${n} ${k}`); }));
                b.edges.forEach(([a, c]) => { edges++; if (!have.has(Kw.norm(a)) || !have.has(Kw.norm(c))) bad.push(`${id} 연결 ${a} > ${c}`); });
            });
            const q1 = Kw.forScript(seed.find(x => x.id === 'Q001')), q2 = Kw.forScript(seed.find(x => x.id === 'Q002'));
            const share = q1.edges.length > 5 && q2.edges.length === q1.edges.length && q1.sents.every(x => x.kws.length);
            return [!bad.length && kws > 2000 && share, `블록 ${Object.keys(blocks).length}, 키워드 ${kws}, 연결 ${edges}, Q001 연결 ${q1.edges.length} / Q002 ${q2.edges.length}, 문제 ${bad.slice(0, 5).join(' | ')}`];
        });
        await tryCheck('답변 암기 화면: 문장 키워드·첫 글자 재생, 연결 지도', async () => {
            const errs = [], keep = Cards.mode;
            const at = async m => { Cards.mode = m; history.replaceState(null, '', '#/drill/cards/answer/Q004'); await UI.render(); return UI.el; };
            let v = await at('sent');
            const chip = v.querySelector('.kw-chip[data-say]'), row = chip && chip.closest('[data-say-row]');
            if (!chip || !row || row.dataset.sayRow !== chip.dataset.say || UI.sayMap.get(chip.dataset.say) !== U.sentences(Data.byKey.get('Q004').answer)[0]) errs.push('문장 키워드 칩이 그 문장을 읽지 않음');
            if (!v.querySelector('.kw-mark')) errs.push('문장 속 키워드 표시 없음');
            v = await at('first');
            if (v.querySelectorAll('.sentence[data-say]').length !== U.sentences(Data.byKey.get('Q004').answer).length) errs.push('첫 글자 문장에 재생 연결 안 됨');
            v = await at('map');
            if (!v.querySelector('.kw-map svg path') || !v.querySelector('[data-act="kw"]')) errs.push('연결 지도 없음');
            v.querySelector('[data-act="kw"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            if (!v.querySelector('.reveal [data-say]')) errs.push('키워드를 눌러도 문장 듣기가 안 나옴');
            v = await at('keys');
            if (v.querySelector('.missing')) errs.push('키워드만 화면이 비어 있음');
            Cards.mode = keep; UI.teardown();
            return [!errs.length, errs.join(' || ')];
        });
        if (typeof SelfTest.extra === 'function') await SelfTest.extra(tryCheck, check);

        const pass = results.every(r => r.ok);
        document.title = pass ? 'SELFTEST PASS' : 'SELFTEST FAIL';
        const pre = document.createElement('pre'); pre.id = 'selftest';
        pre.textContent = JSON.stringify({ pass, results }, null, 1);
        document.getElementById('view').innerHTML = ''; document.getElementById('view').appendChild(pre);
    }
};
