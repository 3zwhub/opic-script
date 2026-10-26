// =========================================================================
//  진도 계산 · 오늘(루틴) · 기록
// =========================================================================
const Progress = {
    async load() {
        const sessions = (await DB.all('sessions')).sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
        const items = sessions.flatMap(s => (s.items || []).map(it => ({ ...it, date: s.date, at: s.startedAt, mode: s.mode })));
        return { sessions, items };
    },
    // 1단계 기준: 서베이 갈림길 카드 ("이 질문 다음엔?")
    surveyKeys() { return Data.allForks('서베이').map(f => f.key); },

    gate(stage, p) {
        if (stage === 1) {
            const keys = this.surveyKeys(), m = keys.filter(k => SRS.mastered(k)).length;
            return { ok: m / keys.length >= 0.9, ratio: m / keys.length, text: `서베이 갈림길 숙련 ${m}/${keys.length}` };
        }
        if (stage === 2) {
            const last = p.items.filter(x => x.topicType === '서베이').slice(-5);
            const good = last.filter(x => x.durationSec >= ANSWER_TARGET.min).length;
            return { ok: last.length === 5 && good === 5, ratio: good / 5, text: `최근 서베이 답변 5개 중 90초 이상 ${good}개` };
        }
        if (stage === 3) {
            const last = p.items.filter(x => x.topicType === '공통형').slice(-5);
            const good = last.filter(x => x.durationSec >= ANSWER_TARGET.min && x.checklist && x.checklist[0]).length;
            return { ok: last.length === 5 && good >= 4, ratio: Math.min(good / 4, 1), text: `최근 돌발 답변 5개 중 90초 이상 + 시제 유지 ${good}개 (4개 필요)` };
        }
        const mocks = p.sessions.filter(s => s.mode === 'mock' && s.complete).slice(-2);
        const good = mocks.filter(s => s.avgScore >= 4).length;
        return { ok: mocks.length === 2 && good === 2, ratio: good / 2, text: `최근 모의고사 2회 중 평균 4/5 이상 ${good}회` };
    },

    streak(p) {
        const days = new Set(p.sessions.map(s => s.date));
        let n = 0, off = days.has(U.today()) ? 0 : -1;
        while (days.has(U.today(off - n))) n++;
        return n;
    },
    minutes(p, days) {
        const from = U.today(-(days - 1));
        return Math.round(p.sessions.filter(s => s.date >= from).reduce((a, s) => a + (s.minutes || 0), 0));
    },
    byType(p) {
        const out = {};
        p.items.filter(x => x.qType && x.qType !== '자기소개').forEach(x => {
            const o = out[x.qType] || (out[x.qType] = { n: 0, score: 0, dur: 0 });
            o.n++; o.score += x.score || 0; o.dur += x.durationSec || 0;
        });
        return Object.entries(out).map(([type, o]) => ({ type, n: o.n, score: o.score / o.n, dur: o.dur / o.n })).sort((a, b) => a.score - b.score);
    }
};

// ---------------- 오늘 ----------------
Views.today = async (el, parts) => {
    if (parts[0] === 'routine') return Routine.mount(el, Number(parts[1]) || 25);
    UI.title('오늘');
    el.innerHTML = '<div class="wrap"><span class="spinner dark"></span></div>';
    const p = await Progress.load();
    const stage = Settings.v.stage, g = Progress.gate(stage, p);
    const palaceDue = Palace.dueForks().length;
    const cardDue = SRS.dueKeys([...Data.expressions.map(x => x.key), ...Stuck.list().map(x => x.key)]).length;
    const surveyInfos = Data.topics('서베이').flatMap(t => t.chain.map(n => Data.el(t, n)));
    const surveyForks = Data.allForks('서베이');
    const noLocus = surveyInfos.filter(i => !i.locus).length, noScene = surveyForks.filter(f => !f.scene).length, noAns = surveyInfos.filter(i => !i.scripts.length).length;
    const todayMin = Progress.minutes(p, 1), isWeekend = [0, 6].includes(new Date().getDay());
    if (UI.parseHash().tab !== 'today') return;   // 그 사이 다른 화면으로 이동했으면 그리지 않음

    el.innerHTML = `<div class="wrap space-y-3">
        ${Data.seedChanged ? `<div class="card" style="border-color:#fbbf24;background:#fffbeb">
            <div class="font-bold mb-1">새 콤보 데이터가 들어왔습니다</div>
            <p class="text-sm mb-3">앱을 새로 받으면서 내장 콤보 데이터(순서·갈림길 장면 등)가 바뀌었습니다. 이 기기에는 앱에서 고친 콤보가 있어 지금은 그것을 쓰고 있습니다.</p>
            <div class="grid grid-cols-3 gap-2">
                <button class="btn btn-gray text-sm" data-act="seedExport">내 것 내보내기</button>
                <button class="btn btn-primary text-sm" data-act="seedApply">새 데이터 적용</button>
                <button class="btn btn-gray text-sm" data-act="seedKeep">지금 것 유지</button>
            </div>
        </div>` : ''}
        <div class="card">
            <div class="flex items-center justify-between mb-1"><span class="chip chip-blue">${stage}단계 · ${U.esc(STAGES[stage - 1].name)}</span><span class="text-xs muted">${STAGES.map(s => s.n <= stage ? '●' : '○').join(' ')}</span></div>
            <p class="text-sm mb-3">${U.esc(STAGES[stage - 1].desc)}</p>
            <div class="text-xs muted mb-1">통과 기준: ${U.esc(STAGES[stage - 1].gate)}</div>
            <div class="bar mb-1"><span style="width:${Math.round(g.ratio * 100)}%"></span></div>
            <div class="text-xs">${U.esc(g.text)}</div>
            ${g.ok ? (stage < 4 ? `<button class="btn btn-green w-full mt-3" data-act="up">통과! ${stage + 1}단계로 올라가기</button>` : '<div class="mt-3 font-bold text-green-700">시험 접수 기준을 달성했습니다 🎉</div>') : ''}
        </div>

        <div class="card">
            <div class="font-bold mb-1">오늘의 루틴</div>
            <p class="text-xs muted mb-3">복습 → 말하기 → 점검 → 기록. 바쁜 날은 10분만 해도 연속으로 칩니다.${stage === 4 && isWeekend ? ' 주말이니 모의고사를 권합니다.' : ''}</p>
            <div class="grid grid-cols-2 gap-2">
                <button class="btn btn-primary" data-act="routine" data-m="25"><i class="fas fa-play"></i> 25분</button>
                <button class="btn btn-soft" data-act="routine" data-m="10">10분 최소</button>
            </div>
            ${stage === 4 ? '<button class="btn btn-gray w-full mt-2" data-act="mock"><i class="fas fa-stopwatch"></i> 모의고사 15문항</button>' : ''}
        </div>

        <div class="grid grid-cols-3 gap-2 text-center">
            <div class="card" style="padding:12px"><div class="text-2xl font-bold">${Progress.streak(p)}</div><div class="text-xs muted">연속 일수</div></div>
            <div class="card" style="padding:12px"><div class="text-2xl font-bold">${todayMin}</div><div class="text-xs muted">오늘 분</div></div>
            <div class="card" style="padding:12px"><div class="text-2xl font-bold">${Progress.minutes(p, 7)}</div><div class="text-xs muted">7일 분</div></div>
        </div>

        <div class="card">
            <div class="font-bold mb-2">복습할 것</div>
            <div class="grid grid-cols-2 gap-2">
                <button class="btn btn-soft" data-act="palaceDue" ${palaceDue ? '' : 'disabled'}><i class="fas fa-code-branch"></i> 갈림길 ${palaceDue}</button>
                <button class="btn btn-soft" data-act="cards" ${cardDue ? '' : 'disabled'}><i class="fas fa-layer-group"></i> 표현 ${cardDue}</button>
            </div>
        </div>

        ${noLocus || noScene || noAns ? `<div class="card text-sm">
            <div class="font-bold mb-1">채워야 할 데이터 (서베이 ${surveyInfos.length}개 요소)</div>
            <ul class="list-disc pl-5 muted">
                ${noLocus ? `<li>방 안의 실제 위치(물건) 미작성 ${noLocus}개 — 기호를 놓을 자리</li>` : ''}
                ${noScene ? `<li>갈림길 장면 미작성 ${noScene}개</li>` : ''}
                ${noAns ? `<li>모범답변 미연결 ${noAns}개</li>` : ''}
            </ul>
            <button class="btn btn-gray text-sm mt-2" data-act="data">자료실 > 콤보 데이터에서 채우기</button>
        </div>` : ''}
    </div>`;
    UI.bind(el, {
        seedExport: () => U.download('combos_내가_고친것.txt', Data.combosText()),
        seedApply: async () => {
            if (!await UI.confirm('새 콤보 데이터 적용', '앱에서 고친 위치·기호·장면이 새 데이터로 바뀝니다. 필요하면 먼저 "내 것 내보내기"를 누르세요.', '적용', true)) return;
            Data.resolveSeed(true); UI.toast('새 콤보 데이터를 적용했습니다'); UI.render();
        },
        seedKeep: () => { Data.resolveSeed(false); UI.toast('지금 데이터를 계속 씁니다'); UI.render(); },
        up: () => { Settings.set('stage', stage + 1); UI.toast(`${stage + 1}단계로 올라갔습니다`); UI.render(); },
        routine: b => { TTS.unlock(); location.hash = '#/today/routine/' + b.dataset.m; },
        mock: () => { location.hash = '#/drill/mock'; },
        palaceDue: () => { TTS.unlock(); location.hash = '#/palace/predict/*due/cards'; },
        cards: () => { location.hash = '#/drill/cards'; },
        data: () => { location.hash = '#/library/combos'; }
    });
};

// ---------------- 루틴 ----------------
const Routine = {
    mount(el, len) {
        UI.title(`${len}분 루틴`, true);
        UI.busy = true;
        const stage = Settings.v.stage;
        const started = Date.now();
        const steps = [
            { name: '복습', min: 5, run: Routine.review },
            { name: '말하기', min: len === 25 ? 12 : 5, run: (box, next) => Routine.speak(box, next, stage, len) },
            ...(len === 25 ? [{ name: '기록', min: 2, run: Routine.note }] : [])
        ];
        let si = 0, stepStart = Date.now(), timer = null;
        el.innerHTML = `<div class="wrap" style="padding-bottom:0"><div class="card" style="padding:10px 12px">
            <div class="flex items-center gap-2 text-xs" id="rtSteps"></div>
            <div class="flex items-center justify-between mt-1"><span class="font-bold" id="rtName"></span><span class="chip" id="rtClock"></span>
            <button class="btn btn-gray text-xs" id="rtSkip">다음 단계 ▶</button></div></div></div><div id="rtBody"></div>`;
        const body = el.querySelector('#rtBody');
        const head = () => {
            el.querySelector('#rtSteps').innerHTML = steps.map((s, k) => `<span class="${k === si ? 'font-bold text-blue-600' : k < si ? 'text-green-600' : 'muted'}">${k < si ? '✓ ' : ''}${s.name} ${s.min}분</span>`).join('<span class="muted">→</span>');
            el.querySelector('#rtName').textContent = steps[si] ? steps[si].name : '끝';
        };
        const tick = () => {
            const s = steps[si]; if (!s) return;
            const left = s.min * 60 - (Date.now() - stepStart) / 1000;
            const c = el.querySelector('#rtClock'); if (!c) return;
            c.textContent = left >= 0 ? `남은 ${U.fmtSec(left)}` : `권장 시간 +${U.fmtSec(-left)}`;
            c.className = left >= 0 ? 'chip' : 'chip chip-amber';
        };
        timer = setInterval(tick, 500);
        UI.onTeardown(() => clearInterval(timer));
        const next = async () => {
            TTS.stop(false);
            si++; stepStart = Date.now();
            if (si >= steps.length) {
                clearInterval(timer); UI.busy = false;
                await DB.put('sessions', { date: U.today(), startedAt: started, mode: 'routine' + len, minutes: 0, totalMinutes: Math.round((Date.now() - started) / 60000) });
                el.innerHTML = `<div class="wrap"><div class="card text-center"><div class="text-3xl mb-2">✅</div><div class="font-bold text-lg mb-1">오늘 루틴 끝</div>
                    <div class="text-sm muted mb-4">${Math.round((Date.now() - started) / 60000)}분</div><button class="btn btn-primary" id="rtDone">오늘 화면으로</button></div></div>`;
                el.querySelector('#rtDone').onclick = () => { location.hash = '#/today'; };
                return;
            }
            head(); tick();
            steps[si].run(body, next);
            UI.busy = true;
        };
        el.querySelector('#rtSkip').onclick = () => { if (Rec.isRecording()) Rec.cancel(); next(); };
        head(); tick();
        steps[0].run(body, next);
    },

    review(box, next) {
        const due = Palace.dueForks().slice(0, 15);
        if (due.length) { Predict.cards(box, due, { scope: '*due', onDone: next }); return; }
        const exprDue = SRS.dueKeys([...Data.expressions.map(x => x.key), ...Stuck.list().map(x => x.key)]).length;
        box.innerHTML = `<div class="wrap"><div class="card text-center"><p class="mb-3">복습할 갈림길이 없습니다.${exprDue ? ` 표현 카드 ${exprDue}장이 남아 있습니다.` : ''}</p>
            <button class="btn btn-primary" id="rvNext">말하기로</button></div></div>`;
        box.querySelector('#rvNext').onclick = next;
    },

    speak(box, next, stage, len) {
        const count = len === 25 ? 3 : 1;
        const run = items => Runner.mount(box, items, { mode: 'routine', showModel: true, onExit: next, onFinish: next });
        if (stage === 1) {
            // 아직 안 배운 갈림길이 있는 첫 방(동선 순서)을 골라 갈림길을 익히고, 그 방의 콤보 하나를 답해 봅니다
            const t = Palace.houseTopics().find(x => Data.forks(x).some(f => !SRS.get(f.key))) || U.pick(Data.topics('서베이'));
            const fresh = Data.forks(t).filter(f => !SRS.get(f.key)).slice(0, len === 25 ? 6 : 3);
            const thenSpeak = () => { const c = U.pick(t.combos.filter(x => x.length === 3)) || t.combos[0]; run(len === 25 ? Drill.comboItems(t, c) : Drill.comboItems(t, c).slice(0, 1)); };
            if (fresh.length) { Predict.cards(box, fresh, { newLimit: fresh.length, onDone: thenSpeak }); return; }
            thenSpeak();
            return;
        }
        if (stage === 2) {
            const x = U.pick(Drill.combosOf('서베이', len === 25 ? 3 : 0).length ? Drill.combosOf('서베이', len === 25 ? 3 : 0) : Drill.combosOf('서베이'));
            run(len === 25 ? Drill.comboItems(x.t, x.c) : [Drill.itemFromEl(x.t, x.c[0])]);
            return;
        }
        run(len === 25 ? Drill.improvMix(3) : [U.pick(Drill.improvPool('common'))()]);
    },

    note(box, next) {
        box.innerHTML = `<div class="wrap"><div class="card">
            <div class="font-bold mb-1">막힌 표현 적기</div>
            <p class="text-xs muted mb-2">방금 녹음에서 막히거나 한국어로 떠오른 표현을 한 줄에 하나씩 적으세요. '영어 = 뜻' 형식이면 뜻도 저장됩니다. 블록 카드에서 복습합니다.</p>
            <div class="field mb-3"><textarea id="ntText" rows="5" placeholder="It slipped my mind = 깜빡했다&#10;be swamped with = ~로 정신없이 바쁘다"></textarea></div>
            <button class="btn btn-primary w-full" id="ntSave">저장하고 끝내기</button></div></div>`;
        box.querySelector('#ntSave').onclick = () => {
            const lines = box.querySelector('#ntText').value.split('\n').map(l => l.trim()).filter(Boolean);
            lines.forEach(l => { const [en, ko] = l.split('='); Stuck.add(en || '', ko || ''); });
            if (lines.length) UI.toast(`막힌 표현 ${lines.length}개를 카드에 추가했습니다`);
            next();
        };
    }
};

// ---------------- 기록 ----------------
Views.records = async (el) => {
    UI.title('기록');
    el.innerHTML = '<div class="wrap"><span class="spinner dark"></span></div>';
    const p = await Progress.load();
    const recs = (await DB.all('recordings')).sort((a, b) => b.createdAt - a.createdAt);
    if (UI.parseHash().tab !== 'records') return;
    const types = Progress.byType(p);
    const keys = Progress.surveyKeys(), mastered = keys.filter(k => SRS.mastered(k)).length;
    const modeLabel = { palace: '궁전 산책', cards: '블록 카드', combo: '콤보 점프', improv: '즉흥', mock: '모의고사', routine: '루틴 말하기', routine25: '25분 루틴', routine10: '10분 루틴' };
    const shown = recs.slice(0, 40);
    el.innerHTML = `<div class="wrap space-y-3">
        <div class="grid grid-cols-2 gap-2 text-center">
            <div class="card" style="padding:12px"><div class="text-2xl font-bold">${Progress.streak(p)}일</div><div class="text-xs muted">연속 훈련</div></div>
            <div class="card" style="padding:12px"><div class="text-2xl font-bold">${Progress.minutes(p, 7)}분</div><div class="text-xs muted">최근 7일</div></div>
            <div class="card" style="padding:12px"><div class="text-2xl font-bold">${Math.round(mastered / keys.length * 100)}%</div><div class="text-xs muted">서베이 요소 숙련 (${mastered}/${keys.length})</div></div>
            <div class="card" style="padding:12px"><div class="text-2xl font-bold">${p.items.length}</div><div class="text-xs muted">답한 문항</div></div>
        </div>

        <div class="card">
            <div class="font-bold mb-2">단계 통과 기준</div>
            ${STAGES.map(s => { const g = Progress.gate(s.n, p); return `<div class="flex items-start gap-2 text-sm mb-2"><span>${g.ok ? '✅' : s.n === Settings.v.stage ? '⏳' : '▫️'}</span><span class="flex-1"><b>${s.n}단계 ${U.esc(s.name)}</b><br><span class="text-xs muted">${U.esc(g.text)}</span></span></div>`; }).join('')}
        </div>

        <div class="card">
            <div class="font-bold mb-1">유형별 체크리스트 점수</div>
            <p class="text-xs muted mb-3">AL은 모든 문항에서 수준을 유지해야 합니다. 평균보다 가장 약한 유형이 등급을 정합니다.</p>
            ${types.length ? types.map((x, k) => `<div class="mb-2">
                <div class="flex justify-between text-sm"><span>${U.typeChip(x.type)} ${k === 0 && types.length > 1 ? '<b class="text-red-600 text-xs">가장 약함</b>' : ''}</span><span class="muted text-xs">${x.n}문항 · 평균 ${U.fmtSec(x.dur)}</span></div>
                <div class="flex items-center gap-2"><div class="bar flex-1"><span style="width:${x.score / 5 * 100}%"></span></div><span class="text-sm font-bold">${x.score.toFixed(1)}/5</span></div></div>`).join('') : '<p class="missing text-sm">아직 자기평가한 답변이 없습니다</p>'}
        </div>

        <div class="card">
            <div class="font-bold mb-2">최근 훈련</div>
            ${p.sessions.slice(-12).reverse().map(s => `<div class="flex justify-between text-sm py-1 border-b border-gray-100"><span>${U.esc(s.date)} · ${U.esc(modeLabel[s.mode] || s.mode)}</span><span class="muted">${s.totalMinutes || s.minutes || 0}분${s.avgScore ? ` · ${s.avgScore}/5` : ''}${s.count ? ` · ${s.count}개` : ''}</span></div>`).join('') || '<p class="missing text-sm">기록이 없습니다</p>'}
        </div>

        <div class="card">
            <div class="font-bold mb-1">녹음 (${recs.length}개)</div>
            <p class="text-xs muted mb-2">${RECORDING_KEEP_DAYS}일이 지나거나 ${RECORDING_MAX}개를 넘으면 오래된 것부터 지웁니다. 별표는 보존합니다.</p>
            ${shown.map(r => `<div class="py-2 border-b border-gray-100" data-rid="${r.id}">
                <div class="flex items-center gap-2 text-sm">
                    <button class="icon-btn" style="width:32px;height:32px" data-act="star" data-id="${r.id}"><i class="${r.starred ? 'fas text-amber-500' : 'far'} fa-star"></i></button>
                    <span class="flex-1 min-w-0 truncate">${U.esc(r.label || '')}</span>
                    ${UI.durChip(r.durationSec || 0)}
                    ${r.checklist ? `<span class="chip">${r.checklist.filter(Boolean).length}/5</span>` : ''}
                </div>
                <div class="flex items-center gap-2 mt-1 pl-10">
                    <span class="text-xs muted flex-1">${U.esc(r.date)} · ${U.esc(modeLabel[r.mode] || r.mode || '')}</span>
                    <button class="btn btn-soft text-xs" data-act="play" data-id="${r.id}"><i class="fas fa-play"></i></button>
                    <button class="btn btn-gray text-xs" data-act="del" data-id="${r.id}"><i class="fas fa-trash"></i></button>
                </div>
                <div class="pl-10" id="pl-${r.id}"></div>
            </div>`).join('') || '<p class="missing text-sm">녹음이 없습니다</p>'}
        </div>
    </div>`;
    const find = id => recs.find(r => r.id === Number(id));
    UI.bind(el, {
        play: b => {
            const r = find(b.dataset.id), box = el.querySelector('#pl-' + b.dataset.id);
            if (!r || !r.blob) { UI.toast('오디오가 없습니다'); return; }
            box.innerHTML = `<audio controls autoplay src="${UI.audioUrl(r.blob)}" class="w-full mt-1"></audio>`;
        },
        star: async b => {
            const r = find(b.dataset.id); r.starred = !r.starred; await DB.put('recordings', r);
            b.innerHTML = `<i class="${r.starred ? 'fas text-amber-500' : 'far'} fa-star"></i>`;
        },
        del: async b => {
            if (!await UI.confirm('녹음 삭제', '이 녹음을 지울까요?', '삭제', true)) return;
            await DB.del('recordings', Number(b.dataset.id)); el.querySelector(`[data-rid="${b.dataset.id}"]`).remove();
        }
    });
};
