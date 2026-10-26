// =========================================================================
//  드릴: 콤보 점프 · 즉흥 · 모의고사. 진행기(Runner) 하나를 같이 씁니다.
//  문항마다 질문 듣기(최대 2회) → 녹음(목표 90~150초) → 모범답변 → 끝나면 체크리스트 자기평가
// =========================================================================
const Drill = {
    itemFromEl(t, name) {
        const info = Data.el(t, name);
        const q = Data.question(info);
        const topicType = Data.topicType(t);
        return {
            key: info.key, label: `${t.name} · ${name}`, info, qEn: q.en, qKo: q.ko,
            topicName: t.name, topicType, qType: info.type || Data.guessType(info),
            hint4: topicType === '공통형', script: info.scripts[0] || null
        };
    },
    itemFromScript(s, label, qType = 'RP') {
        return { key: 'q/' + s.id, label: label || `${s.id} · ${s.title}`, qEn: Parse.hasQuestion(s) ? s.question : '', qKo: s.title, topicName: Parse.scriptTopic(s), topicType: qType === 'RP' ? 'RP' : '기타', qType, script: s };
    },
    introItem() { return { key: 'intro', label: '1번 · 자기소개', qEn: INTRO_QUESTION, qKo: '자기소개 (채점하지 않음, 30~60초)', topicName: '자기소개', topicType: '자기소개', qType: '자기소개', script: null }; },

    combosOf(type, len) {
        return Data.topics(type).flatMap(t => t.combos.map((c, ci) => ({ t, c, ci }))).filter(x => !len || x.c.length === len);
    },
    // 콤보 문항에는 콤보와 순서를 붙여 둡니다 (답한 뒤 "다음 질문 예상"에 씀)
    comboItems(t, c) { return c.map((n, pos) => ({ ...Drill.itemFromEl(t, n), t, combo: c, pos })); },
    // 이 문항 다음에 올 수 있는 질문들 (콤보의 마지막이면 null)
    nextSet(it) {
        if (!it.combo || it.pos >= it.combo.length - 1) return null;
        const tree = Data.tree(it.t), c = it.combo;
        const role = c.length === 2 ? 'p' : it.pos === 0 ? '1' : '2';
        const next = c.length === 2 ? tree.pair.get(c[0]) : it.pos === 0 ? tree.as1.get(c[0]) : tree.q3by.get(c[0] + '|' + c[1]);
        return { role, set: new Set(next || []), key: Data.forkKey(it.t, role, c[it.pos]) };
    },

    rpPick(prefix) {
        const rp = Data.rpScripts().filter(s => s.title.startsWith(prefix));
        return U.pick(rp);
    },

    buildMock() {
        const items = [Drill.introItem()];
        const survey = U.shuffle(Drill.combosOf('서베이', 3));
        const first = survey[0], second = survey.find(x => x.t !== (first && first.t)) || survey[1];
        [first, second].filter(Boolean).forEach(x => items.push(...Drill.comboItems(x.t, x.c)));
        const common3 = U.pick(Drill.combosOf('공통형', 3));
        if (common3) items.push(...Drill.comboItems(common3.t, common3.c));
        ['11번', '12번', '13번'].forEach(p => { const s = Drill.rpPick(p); if (s) items.push(Drill.itemFromScript(s, `RP ${p} · ${s.title}`)); });
        const pairs = Drill.combosOf('공통형', 2).filter(x => x.t !== (common3 && common3.t));
        const adv = U.pick(pairs.filter(x => x.c.some(n => Data.el(x.t, n).adv1415))) || U.pick(pairs);
        if (adv) items.push(...Drill.comboItems(adv.t, adv.c));
        return items.map((it, i) => ({ ...it, label: `${i + 1}번 · ${it.label.replace(/^\d+번 · /, '')}` }));
    },

    // 즉흥 문항 풀
    improvPool(kind) {
        const els = Data.topics().flatMap(t => t.chain.map(n => ({ t, n })));
        let pool = els.map(x => () => Drill.itemFromEl(x.t, x.n));
        const typeOf = x => { const i = Data.el(x.t, x.n); return i.type || Data.guessType(i); };
        if (kind === 'common') pool = els.filter(x => Data.topicType(x.t) === '공통형').map(x => () => Drill.itemFromEl(x.t, x.n));
        if (kind === 'survey') pool = els.filter(x => Data.topicType(x.t) === '서베이').map(x => () => Drill.itemFromEl(x.t, x.n));
        if (kind === 'adv') pool = els.filter(x => ['비교', '이슈'].includes(typeOf(x))).map(x => () => Drill.itemFromEl(x.t, x.n));
        if (kind === 'rp') pool = Data.rpScripts().map(s => () => Drill.itemFromScript(s));
        return pool;
    },
    // 3단계 즉흥 기본 구성: 돌발 1 + 비교·이슈 또는 RP 1 + 무작위 1
    improvMix(n) {
        if (n !== 3) return U.shuffle(Drill.improvPool('all')).slice(0, n).map(f => f());
        const a = U.pick(Drill.improvPool('common')), b = U.pick(Math.random() < 0.5 ? Drill.improvPool('adv') : Drill.improvPool('rp')), c = U.pick(Drill.improvPool('all'));
        return [a, b, c].filter(Boolean).map(f => f());
    }
};

Views.drill = (el, parts) => {
    const sub = parts[0];
    if (sub === 'cards') return Cards.render(el, parts.slice(1));
    if (sub === 'combo') return DrillViews.combo(el, parts.slice(1));
    if (sub === 'improv') return DrillViews.improv(el);
    if (sub === 'mock') return DrillViews.mock(el);
    UI.title('드릴');
    const stage = Settings.v.stage;
    const menu = [
        ['combo', 'fa-route', '콤보 점프', '시험처럼 콤보 2~3문항을 이어서 답하기', 2],
        ['improv', 'fa-bolt', '즉흥', '무작위 질문을 듣고 바로 조립하기 (돌발은 4칸 틀)', 3],
        ['cards', 'fa-layer-group', '블록 카드', '필수 표현 · 막힌 표현 · 답변 빈칸 암기', 1],
        ['mock', 'fa-stopwatch', '모의고사 15문항', '5-5 배치, 40분, 끝나고 몰아서 자기평가', 4]
    ];
    el.innerHTML = `<div class="wrap space-y-2">
        <p class="text-sm muted mb-2">지금 ${stage}단계 · ${U.esc(STAGES[stage - 1].name)}. <b>추천</b> 표시가 이 단계의 주 훈련입니다.</p>
        ${menu.map(([k, ic, t, d, st]) => `<button class="row-item" data-act="go" data-k="${k}">
            <span class="num"><i class="fas ${ic}"></i></span>
            <span class="flex-1"><span class="block font-semibold">${t} ${st === stage ? '<span class="chip chip-blue">추천</span>' : ''}</span><span class="block text-xs muted">${d}</span></span>
            <i class="fas fa-chevron-right text-gray-300"></i></button>`).join('')}
        ${Rec.supported() ? '' : '<p class="text-xs text-amber-700 mt-3">이 브라우저는 녹음을 지원하지 않아 타이머만 씁니다.</p>'}
    </div>`;
    UI.bind(el, { go: b => { location.hash = '#/drill/' + b.dataset.k; } });
};

const DrillViews = {
    combo(el, parts) {
        if (parts[0]) {
            const t = Data.topic(parts[0]);
            const c = t && (parts[1] === 'random' ? U.pick(t.combos) : t.combos[Number(parts[1])]);
            if (t && c) {
                UI.title(`콤보 · ${t.name}`, true);
                return Runner.mount(el, Drill.comboItems(t, c), { mode: 'combo', showModel: true, onExit: () => history.back() });
            }
        }
        UI.title('콤보 점프', true);
        const type = DrillViews.comboType || '서베이';
        const ts = Data.topics(type);
        const tn = DrillViews.comboTopic && Data.topic(DrillViews.comboTopic) && Data.topicType(Data.topic(DrillViews.comboTopic)) === type ? DrillViews.comboTopic : ts[0].name;
        const t = Data.topic(tn);
        el.innerHTML = `<div class="wrap">
            <div class="seg mb-3">${['서베이', '공통형'].map(x => `<button data-act="type" data-v="${x}" class="${type === x ? 'on' : ''}">${x}</button>`).join('')}</div>
            <div class="field mb-3"><select id="cTopic">${ts.map(x => `<option ${x.name === tn ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}</select></div>
            <button class="btn btn-primary w-full mb-3" data-act="any"><i class="fas fa-shuffle"></i> 아무 주제 · 아무 콤보</button>
            <div class="space-y-2">${t.combos.map((c, ci) => {
                const infos = c.map(n => Data.el(t, n));
                const ready = infos.filter(i => i.scripts.length).length;
                return `<button class="row-item" data-act="start" data-c="${ci}">
                    <span class="num">${ci + 1}</span>
                    <span class="flex-1 min-w-0"><span class="block font-semibold">${c.map(U.esc).join(' / ')}</span>
                    <span class="block text-xs muted">위치 ${infos.map(i => i.locusNo).join('→')} · 모범답변 ${ready}/${c.length}</span></span>
                    <i class="fas fa-play text-blue-500"></i></button>`;
            }).join('')}</div></div>`;
        el.querySelector('#cTopic').onchange = e => { DrillViews.comboTopic = e.target.value; DrillViews.combo(el, []); };
        UI.bind(el, {
            type: b => { DrillViews.comboType = b.dataset.v; DrillViews.comboTopic = null; DrillViews.combo(el, []); },
            start: b => { TTS.unlock(); location.hash = `#/drill/combo/${encodeURIComponent(t.name)}/${b.dataset.c}`; },
            any: () => { TTS.unlock(); const x = U.pick(Drill.combosOf(type)); location.hash = `#/drill/combo/${encodeURIComponent(x.t.name)}/${x.ci}`; }
        });
    },

    improv(el) {
        UI.title('즉흥', true);
        const kinds = [['mix', '3단계 구성'], ['all', '전체'], ['common', '돌발만'], ['survey', '서베이만'], ['adv', '비교·이슈'], ['rp', 'RP']];
        let kind = DrillViews.improvKind || 'mix', n = DrillViews.improvN || 3;
        const draw = () => {
            el.innerHTML = `<div class="wrap">
                <div class="card mb-3 text-sm">질문만 보고 바로 답합니다. 돌발은 <b>4칸 틀</b>(일반 묘사 → 나의 습관 → 과거 비교 → 문제·기억)로 조립하고, 막히면 필러로 이어 가세요.</div>
                <div class="sec-title">문항 풀</div>
                <div class="seg mb-3">${kinds.map(([k, t]) => `<button data-act="kind" data-k="${k}" class="${kind === k ? 'on' : ''}">${t}</button>`).join('')}</div>
                <div class="sec-title">문항 수</div>
                <div class="seg mb-4">${[1, 3, 5].map(x => `<button data-act="n" data-n="${x}" class="${n === x ? 'on' : ''}">${x}개</button>`).join('')}</div>
                <button class="btn btn-primary w-full" data-act="start"><i class="fas fa-bolt"></i> 시작</button>
            </div>`;
        };
        UI.bind(el, {
            kind: b => { kind = DrillViews.improvKind = b.dataset.k; draw(); },
            n: b => { n = DrillViews.improvN = Number(b.dataset.n); draw(); },
            start: () => {
                TTS.unlock();
                const items = kind === 'mix' ? Drill.improvMix(n) : U.shuffle(Drill.improvPool(kind)).slice(0, n).map(f => f());
                if (!items.length) { UI.toast('문항이 없습니다'); return; }
                Runner.mount(el, items, { mode: 'improv', showModel: true, onExit: () => DrillViews.improv(el) });
            }
        });
        draw();
    },

    mock(el) {
        UI.title('모의고사', true);
        el.innerHTML = `<div class="wrap"><div class="card">
            <div class="font-bold text-lg mb-2">15문항 · 40분 · 5-5 배치</div>
            <table class="text-sm w-full mb-4"><tbody>
                <tr><td class="py-1 pr-2 muted">1번</td><td>자기소개 (채점 제외)</td></tr>
                <tr><td class="py-1 pr-2 muted">2~4, 5~7번</td><td>서베이 콤보 2개</td></tr>
                <tr><td class="py-1 pr-2 muted">8~10번</td><td>돌발 콤보</td></tr>
                <tr><td class="py-1 pr-2 muted">11~13번</td><td>롤플레이 (11 질문하기 · 12 대안 제시 · 13 관련 경험)</td></tr>
                <tr><td class="py-1 pr-2 muted">14~15번</td><td>돌발 14·15번 세트 (비교·이슈)</td></tr>
            </tbody></table>
            <p class="text-xs muted mb-4">번호별 배치는 공식 문서가 아닌 통설을 따릅니다. 질문은 최대 2번 들을 수 있고, 모범답변은 끝날 때까지 보이지 않습니다.</p>
            <button class="btn btn-primary w-full" data-act="start"><i class="fas fa-play"></i> 시작</button>
        </div></div>`;
        UI.bind(el, { start: () => { TTS.unlock(); Runner.mount(el, Drill.buildMock(), { mode: 'mock', showModel: false, totalSec: MOCK_TOTAL_SEC, onExit: () => { location.hash = '#/records'; } }); } });
    }
};

// ---------------- 진행기 ----------------
const Runner = {
    mount(el, items, opts = {}) {
        UI.busy = true;
        const started = Date.now();
        const sessionTag = U.uid();
        const results = items.map(() => ({ rec: null, durationSec: 0, listens: 0 }));
        let i = 0, showModel = false, showKo = false, timer = null, stopwatchStart = 0, finished = false;

        const remaining = () => opts.totalSec ? opts.totalSec - (Date.now() - started) / 1000 : null;
        const recording = () => Rec.isRecording() || stopwatchStart > 0;
        const clearTimer = () => { if (timer) clearInterval(timer); timer = null; };
        UI.onTeardown(() => { clearTimer(); });

        const tick = () => {
            const tEl = el.querySelector('#rTimer');
            if (tEl && recording()) {
                const sec = Rec.isRecording() ? Rec.elapsed() : (Date.now() - stopwatchStart) / 1000;
                tEl.textContent = U.fmtSec(sec); tEl.className = 'timer ' + UI.durClass(sec);
            }
            const r = remaining(), rEl = el.querySelector('#rRemain');
            if (rEl && r !== null) { rEl.textContent = U.fmtSec(r); if (r <= 0 && !finished) { UI.toast('40분이 지났습니다. 자기평가로 넘어갑니다'); stopAndFinish(); } }
        };
        const ensureTimer = () => { if (!timer) timer = setInterval(tick, 250); };

        const speakQuestion = () => {
            const it = items[i];
            if (!it.qEn) return;
            if (opts.mode === 'mock' && results[i].listens >= 2) { UI.toast('질문은 두 번까지 들을 수 있습니다'); return; }
            results[i].listens++;
            TTS.play(it.qEn, 'once', { title: it.label });
            draw();
        };

        const draw = () => {
            UI.sayMap.clear();
            const it = items[i], r = results[i];
            const rem = remaining();
            const kw = it.info && it.info.K ? it.info.K.split(',').map(s => s.trim()).filter(Boolean) : [];
            el.innerHTML = `<div class="wrap space-y-3">
                <div class="flex items-center justify-between text-sm">
                    <span class="font-bold">${i + 1} / ${items.length}</span>
                    ${rem !== null ? `<span class="chip"><i class="fas fa-hourglass-half"></i> <span id="rRemain">${U.fmtSec(rem)}</span></span>` : ''}
                    <button class="btn btn-gray text-xs" data-act="quit">그만하기</button>
                </div>
                <div class="bar"><span style="width:${Math.round(i / items.length * 100)}%"></span></div>
                <div class="card">
                    <div class="flex items-center gap-2 mb-2 flex-wrap"><span class="text-xs muted">${U.esc(it.label)}</span>${it.qType && it.qType !== '자기소개' ? U.typeChip(it.qType) : ''}</div>
                    ${it.qEn ? `<p class="text-lg font-medium mb-3 ${opts.mode === 'mock' && !showKo ? 'blur-sm select-none' : ''}" id="qText">${U.esc(it.qEn)}</p>` : `<p class="text-lg font-medium mb-2">${U.esc(it.qKo)}</p><p class="text-xs muted mb-3">영어 질문이 없는 문항이라 한국어로 보여 줍니다</p>`}
                    <div class="flex flex-wrap gap-2">
                        ${it.qEn ? `<button class="btn btn-soft text-sm" data-act="listen"><i class="fas fa-volume-high"></i> 질문 듣기 ${opts.mode === 'mock' ? `(${r.listens}/2)` : ''}</button>` : ''}
                        ${it.qEn ? `<button class="btn btn-gray text-sm" data-act="ko">${opts.mode === 'mock' ? (showKo ? '질문 가리기' : '질문 보기') : (showKo ? '한국어 닫기' : '한국어 보기')}</button>` : ''}
                    </div>
                    ${showKo && it.qEn && opts.mode !== 'mock' ? `<p class="text-sm muted mt-2">${U.esc(it.qKo)}</p>` : ''}
                </div>
                ${it.hint4 ? `<details class="card text-sm"><summary class="font-semibold cursor-pointer">4칸 틀 힌트</summary><div class="grid grid-cols-2 gap-2 mt-2">${FOUR_SLOT.map(f => `<div class="reveal"><b>${f.name}</b><div class="text-xs muted">${U.esc(f.hint)}</div></div>`).join('')}</div></details>` : ''}
                ${opts.mode !== 'mock' && it.info && kw.length ? `<details class="card text-sm"><summary class="font-semibold cursor-pointer">답변 키워드 (막히면)</summary>
                    <div class="flex flex-wrap gap-1 mt-2">${kw.map(k => `<span class="chip chip-blue">${U.esc(k)}</span>`).join('')}</div></details>` : ''}
                <div class="card text-center">
                    ${recording() ? `<div class="flex items-center justify-center gap-2 mb-1"><span class="rec-dot"></span><span class="text-sm muted">${Rec.isRecording() ? '녹음 중' : '시간 재는 중'}</span></div>
                        <div id="rTimer" class="timer under">0:00</div>
                        <div class="text-xs muted mb-3">목표 ${U.fmtSec(ANSWER_TARGET.min)}~${U.fmtSec(ANSWER_TARGET.max)}</div>
                        <button class="btn btn-red w-full" data-act="stop"><i class="fas fa-stop"></i> 답변 끝</button>`
                    : r.done ? `<div class="mb-2">답변 ${UI.durChip(r.durationSec)}</div>
                        ${r.rec && r.rec.blob ? `<audio controls src="${UI.audioUrl(r.rec.blob)}" class="w-full mb-3"></audio>` : ''}
                        <div class="grid grid-cols-2 gap-2"><button class="btn btn-gray" data-act="again">다시 답하기</button>
                        <button class="btn btn-primary" data-act="next">${i < items.length - 1 ? '다음 문항' : '자기평가로'} <i class="fas fa-chevron-right"></i></button></div>`
                    : `<button class="btn btn-red w-full py-4 text-lg" data-act="record"><i class="fas fa-microphone"></i> ${Rec.supported() ? '녹음하며 답하기' : '타이머 시작'}</button>
                        ${Rec.supported() ? '<button class="btn btn-gray w-full mt-2 text-sm" data-act="watch">녹음 없이 시간만 재기</button>' : ''}
                        ${opts.mode !== 'mock' ? '<button class="btn btn-gray w-full mt-2 text-sm" data-act="skip">건너뛰기</button>' : ''}`}
                </div>
                ${r.done && !recording() ? predictHtml(it, r) : ''}
                ${opts.showModel && r.done && !recording() ? `<button class="btn btn-soft w-full" data-act="model">${showModel ? '모범답변 닫기' : '모범답변 보기'}</button>
                    ${showModel ? `<div class="card">${it.script ? UI.answerHtml(it.script) : '<p class="missing">연결된 모범답변이 없습니다</p>'}</div>` : ''}` : ''}
            </div>`;
            if (recording() || remaining() !== null) ensureTimer();
            tick();
        };

        // 답한 뒤 "다음 질문 예상" (설정에서 끌 수 있음). 시험장에서 할 일을 그대로 연습합니다
        const predictHtml = (it, r) => {
            const ns = Settings.v.predictInDrill === false ? null : Drill.nextSet(it);
            if (!ns) return '';
            const p = r.pred || (r.pred = { sel: new Set(), grade: null });
            const fork = Data.forks(it.t).find(f => f.key === ns.key);
            return `<div class="card">
                <div class="text-sm font-semibold mb-2">다음 질문 예상 <span class="muted font-normal">(가능한 것 모두)</span></div>
                ${Predict.chips(it.t, it.info.name, p.sel, p.grade && ns.set)}
                ${p.grade ? `<div class="mt-2">${Predict.revealCard(fork || { info: it.info, role: ns.role, scene: '' }, ns.set, p.grade)}</div>`
                    : `<button class="btn btn-soft w-full mt-2 text-sm" data-act="pcheck" ${p.sel.size ? '' : 'disabled'}>예상 확인</button>`}
            </div>`;
        };

        const stopAndFinish = async () => {
            if (Rec.isRecording()) await stopRecording(); else if (stopwatchStart) stopWatch();
            finish();
        };

        const stopRecording = async () => {
            const res = await Rec.stop();
            if (!res) return;
            const it = items[i];
            const rec = await Rec.save({ mode: opts.mode, itemKey: it.key, label: it.label, topicName: it.topicName, topicType: it.topicType, qType: it.qType, sessionTag }, res);
            results[i].rec = rec; results[i].durationSec = rec.durationSec; results[i].done = true;
        };
        const stopWatch = () => { results[i].durationSec = Math.round((Date.now() - stopwatchStart) / 1000); results[i].done = true; stopwatchStart = 0; };

        const go = (delta) => {
            TTS.stop(false);
            i += delta; showModel = false; showKo = false;
            if (i >= items.length) { finish(); return; }
            draw();
            if (Settings.v.autoQuestion && items[i].qEn && results[i].listens === 0) speakQuestion();
        };

        const finish = () => {
            if (finished) return; finished = true;
            clearTimer(); TTS.stop(false);
            Review.mount(el, items, results, { ...opts, started, sessionTag });
        };

        UI.bind(el, {
            listen: speakQuestion,
            ko: () => { showKo = !showKo; draw(); },
            record: async () => {
                if (!Rec.supported()) { stopwatchStart = Date.now(); draw(); return; }
                try { await Rec.start(); draw(); }
                catch (e) { UI.toast('마이크를 쓸 수 없어 시간만 잽니다: ' + e.message); stopwatchStart = Date.now(); draw(); }
            },
            watch: () => { TTS.stop(false); stopwatchStart = Date.now(); draw(); },
            stop: async () => { if (Rec.isRecording()) await stopRecording(); else stopWatch(); draw(); },
            again: () => { results[i].durationSec = 0; results[i].rec = null; results[i].done = false; draw(); },
            next: () => go(1),
            skip: () => go(1),
            chip: b => { const p = results[i].pred; if (!p || p.grade) return; const n = b.dataset.n; p.sel.has(n) ? p.sel.delete(n) : p.sel.add(n); draw(); },
            pcheck: async () => {
                const ns = Drill.nextSet(items[i]), p = results[i].pred;
                if (!ns || !p) return;
                p.grade = Predict.judge(p.sel, ns.set);
                draw();
                SRS.grade(ns.key, p.grade).catch(e => console.error('채점 저장 실패', e));
            },
            model: () => { showModel = !showModel; draw(); },
            quit: async () => {
                if (!await UI.confirm('그만하기', '지금까지 답한 문항만 자기평가하고 끝낼까요?', '그만하기')) return;
                stopAndFinish();
            }
        });
        draw();
        if (Settings.v.autoQuestion && items[0].qEn) speakQuestion();
    }
};

// ---------------- 자기평가 ----------------
const Review = {
    mount(el, items, results, opts) {
        UI.busy = true;
        UI.title('자기평가', true);
        const done = items.map((it, i) => ({ it, r: results[i] })).filter(x => x.r.done);
        const checks = done.map(() => AL_CHECKLIST.map(() => false));
        const stars = done.map(() => false);
        UI.sayMap.clear();
        el.innerHTML = `<div class="wrap space-y-3">
            <div class="card text-sm">녹음을 들으며 항목마다 해당하는 것만 체크하세요. 이 점수로 단계 통과 여부와 유형별 약점을 계산합니다.</div>
            ${done.length ? done.map(({ it, r }, k) => `<div class="card">
                <div class="flex items-center justify-between gap-2 mb-1"><span class="font-semibold text-sm">${U.esc(it.label)}</span>${UI.durChip(r.durationSec)}</div>
                ${it.qEn ? `<p class="text-xs muted mb-2">${U.esc(it.qEn)}</p>` : ''}
                ${r.rec && r.rec.blob ? `<audio controls src="${UI.audioUrl(r.rec.blob)}" class="w-full mb-2"></audio>` : ''}
                ${AL_CHECKLIST.map((c, ci) => `<label class="check-row text-sm"><input type="checkbox" data-k="${k}" data-c="${ci}"> <span>${U.esc(c)}</span></label>`).join('')}
                <div class="flex justify-between items-center mt-2">
                    <button class="btn btn-gray text-xs" data-act="star" data-k="${k}"><i class="far fa-star"></i> 보관</button>
                    ${it.script ? `<button class="btn btn-soft text-xs" data-act="model" data-k="${k}">모범답변</button>` : ''}
                </div>
                <div id="model-${k}"></div>
            </div>`).join('') : '<div class="card missing">답한 문항이 없습니다</div>'}
            <button class="btn btn-primary w-full" data-act="save">저장하고 끝내기</button>
        </div>`;
        el.scrollTop = 0;
        el.querySelectorAll('input[type=checkbox]').forEach(cb => cb.onchange = () => { checks[cb.dataset.k][cb.dataset.c] = cb.checked; });
        UI.bind(el, {
            star: b => { const k = b.dataset.k; stars[k] = !stars[k]; b.innerHTML = `<i class="${stars[k] ? 'fas' : 'far'} fa-star"></i> ${stars[k] ? '보관함' : '보관'}`; },
            model: b => { const box = el.querySelector('#model-' + b.dataset.k); box.innerHTML = box.innerHTML ? '' : `<div class="mt-3">${UI.answerHtml(done[b.dataset.k].it.script)}</div>`; },
            save: async () => {
                const entries = [];
                for (let k = 0; k < done.length; k++) {
                    const { it, r } = done[k];
                    const score = checks[k].filter(Boolean).length;
                    if (r.rec) { r.rec.checklist = checks[k]; r.rec.starred = stars[k]; await DB.put('recordings', r.rec); }
                    entries.push({ recId: r.rec ? r.rec.id : null, label: it.label, qType: it.qType, topicType: it.topicType, durationSec: r.durationSec, checklist: checks[k], score });
                }
                const scored = entries.filter(e => e.qType !== '자기소개');
                const session = {
                    date: U.today(), startedAt: opts.started, mode: opts.mode, minutes: Math.round((Date.now() - opts.started) / 6000) / 10,
                    items: entries, avgScore: scored.length ? Math.round(scored.reduce((a, e) => a + e.score, 0) / scored.length * 10) / 10 : 0,
                    complete: opts.mode !== 'mock' || entries.length >= 12
                };
                session.id = await DB.put('sessions', session);
                UI.busy = false;
                UI.toast('저장했습니다');
                if (opts.onFinish) opts.onFinish(session);
                else if (opts.onExit) opts.onExit(session);
                else history.back();
            }
        });
    }
};
