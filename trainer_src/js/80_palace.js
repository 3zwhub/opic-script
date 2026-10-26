// =========================================================================
//  궁전: 시험 중 "지금 질문 다음에 무슨 질문이 올지" 떠올리기 위한 체계
//  1층 공통 규칙 · 2층 주제별 갈림길(방 = 주제, 위치 = 질문, 기호 + 가리키는 장면) · 3층 신호어
//  예측할 지점은 둘뿐: 1번째 → 2번째, 2번째 → 3번째 (3번째 뒤에는 주제가 바뀜). 2문항 콤보는 14번 → 15번
// =========================================================================
const STREET = '동네 길';

const RULE_HTML = `
    <div class="font-bold mb-1">1층 · 공통 규칙 (모든 주제, 처음 보는 돌발에도)</div>
    <ol class="list-decimal pl-5 text-sm space-y-1">
        <li><b>묘사로 연다</b> → 2번째는 <b>루틴</b>(평소 하는 일) 또는 바로 <b>과거·비교·경험</b></li>
        <li>2번째가 루틴이면 → 3번째는 <b>과거·비교</b> 또는 <b>경험</b></li>
        <li>2번째가 과거·비교면 → 3번째는 <b>경험</b>(최근·기억·문제)</li>
        <li><b>14번이 변화·비교</b>면 → 15번은 <b>이슈·우려·뉴스</b></li>
    </ol>
    <p class="text-xs muted mt-2">콤보 3문항짜리 86개 중 84개가 이 순서를 지킵니다. 규칙으로 '종류'를 좁히고, 갈림길 장면으로 '구체적인 질문'을 떠올립니다.</p>`;

const Palace = {
    // 주제 순서는 combos.txt에 적힌 순서를 그대로 따릅니다
    houseTopics() { return Data.topics('서베이'); },
    forkStats(t) {
        const keys = Data.forks(t).map(f => f.key);
        return { total: keys.length, known: keys.filter(k => SRS.mastered(k)).length, due: SRS.dueKeys(keys).length, fresh: keys.filter(k => !SRS.get(k)).length };
    },
    dueForks() { const t = U.today(); return Data.allForks().filter(f => { const c = SRS.get(f.key); return c && c.due <= t; }); },
    roleBadges(t, name, tree) {
        const r = Data.roles(t, name, tree);
        if (!r.length) return '<span class="chip">끝</span>';
        return r.map(x => `<span class="chip ${x.role === 'p' ? 'chip-red' : 'chip-blue'}">${Data.roleLabel(x.role)}</span>`).join(' ');
    },
    // 콤보 지도: 경로가 정확하도록 (1번째, 2번째) 쌍으로 3번째를 계산합니다
    treeHtml(t) {
        const tree = Data.tree(t);
        const sym = n => { const i = Data.el(t, n); return i.symbol ? `<span class="muted text-xs"> · ${U.esc(i.symbol)}</span>` : ''; };
        const node = (n, cls = '') => `<span class="tnode ${cls}">${U.esc(n)}${sym(n)}</span>`;
        const triples = [...tree.as1.entries()].map(([q1, q2s]) => `
            <div class="mb-3">${node(q1, 'q1')}
                <div class="tkids">${q2s.map(q2 => `<div class="mt-1">${node(q2)}
                    <div class="tkids">${(tree.q3by.get(q1 + '|' + q2) || []).map(q3 => `<div class="mt-1">${node(q3, 'q3')}</div>`).join('')}</div></div>`).join('')}
                </div></div>`).join('');
        const pairs = [...tree.pair.entries()].map(([a, bs]) => `<div class="mt-1">${node(a, 'q14')} <span class="muted">→</span> ${bs.map(b => node(b, 'q3')).join(' ')}</div>`).join('');
        return `${triples || '<p class="missing text-sm">3문항 콤보 없음</p>'}${pairs ? `<div class="sec-title">14 → 15번 (2문항 콤보)</div>${pairs}` : ''}`;
    }
};

Views.palace = (el, parts) => {
    if (parts[0] === 'game') return PalaceGame.render(el, parts[1]);
    if (parts[0] === 'walk') return Palace.routeWalk(el, parts[1]);
    if (parts[0] === 'predict') return Predict.start(el, parts[1], parts[2] || 'cards');
    if (parts[0] === STREET) return Palace.renderStreet(el);
    if (parts[0]) return Palace.renderTopic(el, parts[0]);

    UI.title('기억의 궁전');
    const survey = Palace.houseTopics(), common = Data.topics('공통형');
    const due = Palace.dueForks().length;
    const sumStats = ts => ts.reduce((a, t) => { const s = Palace.forkStats(t); a.total += s.total; a.known += s.known; return a; }, { total: 0, known: 0 });
    const ss = sumStats(survey), cs = sumStats(common);
    el.innerHTML = `<div class="wrap">
        <div class="card mb-3 flex items-center gap-3">
            <div class="flex-1"><div class="font-bold">복습할 갈림길 ${due}개</div><div class="text-xs muted">"이 질문 다음엔?"을 잊기 직전에 다시 묻습니다</div></div>
            <button class="btn btn-primary" data-act="due" ${due ? '' : 'disabled'}>복습</button>
        </div>
        <button class="row-item mb-3" data-act="game"><span class="num"><i class="fas fa-gamepad"></i></span>
            <span class="flex-1"><span class="block font-semibold">궁전 게임</span><span class="block text-xs muted">방·동네 길을 걸으며 기호를 보고, 다음 질문 후보를 맞힙니다</span></span><i class="fas fa-chevron-right text-gray-300"></i></button>
        <details class="card mb-3"><summary class="font-semibold cursor-pointer">1층 공통 규칙 보기</summary><div class="mt-2">${RULE_HTML}</div></details>
        <div class="grid grid-cols-2 gap-2 mb-1">
            <button class="btn btn-soft text-sm" data-act="flow" data-s="*survey"><i class="fas fa-route"></i> 서베이 콤보 흐름</button>
            <button class="btn btn-soft text-sm" data-act="flow" data-s="*common"><i class="fas fa-route"></i> 돌발 콤보 흐름</button>
        </div>
        <div class="sec-title">집 · 서베이 ${survey.length}개 방 · 갈림길 숙련 ${ss.known}/${ss.total}</div>
        <div class="space-y-2">${survey.map((t, ti) => {
            const s = Palace.forkStats(t);
            return `<button class="row-item" data-act="topic" data-t="${U.esc(t.name)}">
                <span class="num">${ti + 1}</span>
                <span class="flex-1 min-w-0"><span class="block font-semibold">${U.esc(Data.place(t))} · ${U.esc(t.name)}</span>
                <span class="block text-xs muted">질문 ${t.chain.length} · 갈림길 ${s.total} · 숙련 ${s.known}${s.due ? ` · <b class="text-amber-600">복습 ${s.due}</b>` : ''}</span>
                <span class="bar mt-1"><span style="width:${s.total ? Math.round(s.known / s.total * 100) : 0}%"></span></span></span>
                <i class="fas fa-chevron-right text-gray-300"></i></button>`;
        }).join('')}</div>
        <div class="sec-title">동네 길 · 돌발 ${common.length}곳 · 갈림길 숙련 ${cs.known}/${cs.total}</div>
        <button class="row-item" data-act="street">
            <span class="num"><i class="fas fa-road"></i></span>
            <span class="flex-1"><span class="block font-semibold">돌발 주제 ${common.length}개</span>
            <span class="block text-xs muted">가구 → 재활용 → 산업 → … → 가족/친구</span></span>
            <i class="fas fa-chevron-right text-gray-300"></i></button>
    </div>`;
    UI.bind(el, {
        game: () => { TTS.unlock(); location.hash = '#/palace/game'; },
        due: () => { TTS.unlock(); location.hash = '#/palace/predict/*due/cards'; },
        flow: b => { TTS.unlock(); location.hash = `#/palace/predict/${b.dataset.s}/flow`; },
        topic: b => { location.hash = '#/palace/' + encodeURIComponent(b.dataset.t); },
        street: () => { location.hash = '#/palace/' + encodeURIComponent(STREET); }
    });
};

Palace.renderStreet = (el) => {
    UI.title(STREET, true);
    const ts = Data.topics('공통형');
    el.innerHTML = `<div class="wrap space-y-2">${ts.map((t, ti) => {
        const s = Palace.forkStats(t), pairs = Data.tree(t).pair.size;
        return `<button class="row-item" data-act="topic" data-t="${U.esc(t.name)}">
            <span class="num">${ti + 1}</span>
            <span class="flex-1 min-w-0"><span class="block font-semibold">${U.esc(t.name)} ${pairs ? `<span class="chip chip-red">14·15번 ${pairs}</span>` : ''}</span>
            <span class="block text-xs muted truncate">${U.esc(Data.place(t))} · 질문 ${t.chain.length} · 갈림길 ${s.total} · 숙련 ${s.known}${s.due ? ` · 복습 ${s.due}` : ''}</span></span>
            <i class="fas fa-chevron-right text-gray-300"></i></button>`;
    }).join('')}</div>`;
    UI.bind(el, { topic: b => { location.hash = '#/palace/' + encodeURIComponent(b.dataset.t); } });
};

Palace.renderTopic = (el, name) => {
    const t = Data.topic(name);
    UI.title(name, true);
    if (!t) { el.innerHTML = '<div class="wrap"><p class="missing">주제를 찾을 수 없습니다</p></div>'; return; }
    const tree = Data.tree(t);
    const s = Palace.forkStats(t);
    const infos = t.chain.map(n => Data.el(t, n));
    el.innerHTML = `<div class="wrap">
        <div class="card mb-3">
            <div class="text-sm muted">${U.esc(Data.topicType(t))} · ${U.esc(Data.place(t))}</div>
            <div class="font-bold text-lg mb-2">${U.esc(t.name)} · 질문 ${t.chain.length} · 갈림길 ${s.total}</div>
            <div class="grid grid-cols-3 gap-2">
                <button class="btn btn-soft text-sm" data-act="walk">경로 걷기</button>
                <button class="btn btn-primary text-sm" data-act="cards">갈림길 ${s.due ? `복습 ${s.due}` : '맞히기'}</button>
                <button class="btn btn-soft text-sm" data-act="flow">콤보 흐름</button>
            </div>
            <button class="btn btn-soft text-sm w-full mt-2" data-act="game"><i class="fas fa-gamepad"></i> 궁전 게임으로 걷기</button>
        </div>
        <div class="sec-title">콤보 지도 (1번째 → 2번째 → 3번째)</div>
        <div class="card">${Palace.treeHtml(t)}</div>
        <div class="sec-title">방 안의 위치 (걷는 순서 = 사슬)</div>
        <div class="space-y-2">${infos.map(i => {
            const roles = Data.roles(t, i.name, tree);
            const scenes = roles.map(r => {
                const sc = (r.role === '1' && i.scene1) || (r.role === '2' && i.scene2) || i.scene;
                return `<div class="text-xs mt-1">${Palace.statusDot(Data.forkKey(t, r.role, i.name))} <b>${Data.roleLabel(r.role)}</b> → ${r.next.map(U.esc).join(' / ')}${sc ? `<div class="scene mt-1">🎬 ${U.esc(sc)}</div>` : '<span class="missing"> 장면 미작성</span>'}</div>`;
            }).join('');
            return `<div class="row-item" style="align-items:flex-start">
                <span class="num">${i.locusNo}</span>
                <span class="flex-1 min-w-0">
                    <span class="block font-semibold">${U.esc(i.name)} ${Palace.roleBadges(t, i.name, tree)}</span>
                    <span class="block text-xs muted">${i.symbol ? '🔹 ' + U.esc(i.symbol) : '<span class="missing">기호 미작성</span>'}${i.locus ? ' · 📍 ' + U.esc(i.locus) : ''}</span>
                    ${i.link ? `<span class="block text-xs mt-1 link-text">🔗 ${U.esc(i.link)}</span>` : ''}
                    ${i.signal ? `<span class="block text-xs muted">🎧 "${U.esc(i.signal)}"</span>` : ''}
                    ${scenes}
                </span>
                <button class="icon-btn" data-act="edit" data-n="${U.esc(i.name)}" aria-label="편집"><i class="fas fa-pen"></i></button>
            </div>`;
        }).join('')}</div>
    </div>`;
    UI.bind(el, {
        walk: () => { location.hash = `#/palace/walk/${encodeURIComponent(t.name)}`; },
        cards: () => { TTS.unlock(); location.hash = `#/palace/predict/${encodeURIComponent(t.name)}/cards`; },
        flow: () => { TTS.unlock(); location.hash = `#/palace/predict/${encodeURIComponent(t.name)}/flow`; },
        game: () => { TTS.unlock(); location.hash = `#/palace/game/${encodeURIComponent(t.name)}`; },
        edit: b => ElementEditor.open(t, b.dataset.n, () => Palace.renderTopic(el, name))
    });
};

Palace.statusDot = (key) => {
    const s = SRS.status(key);
    const map = { new: ['#d1d5db', '새것'], learning: ['#60a5fa', '익히는 중'], due: ['#f59e0b', '복습할 때'], known: ['#16a34a', '숙련'] };
    const [c, tt] = map[s];
    return `<span title="${tt}" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${c}"></span>`;
};

// ---------------- 경로 걷기 (처음 외울 때): 위치 → 질문·기호·신호 → 가리키는 장면 ----------------
Palace.routeWalk = (el, name) => {
    const t = Data.topic(name);
    UI.title(t ? `${Data.place(t)} · 걷기` : '걷기', true);
    if (!t) { el.innerHTML = '<div class="wrap"><p class="missing">주제를 찾을 수 없습니다</p></div>'; return; }
    const tree = Data.tree(t);
    let i = 0, stage = 0;
    const draw = () => {
        UI.sayMap.clear();
        const info = Data.el(t, t.chain[i]), roles = Data.roles(t, info.name, tree);
        const q = Data.question(info);
        el.innerHTML = `<div class="wrap space-y-3">
            <div class="bar"><span style="width:${Math.round(i / t.chain.length * 100)}%"></span></div>
            <div class="card"><div class="text-xs muted mb-1">${U.esc(Data.place(t))} · ${i + 1}/${t.chain.length}</div>
                <div class="flex items-center gap-3"><span class="num" style="min-width:44px;height:44px;font-size:1.2rem">${info.locusNo}</span>
                <div class="flex-1"><div class="text-lg font-bold">${info.locus ? '📍 ' + U.esc(info.locus) : `위치 ${info.locusNo}`}</div>
                ${stage === 0 ? '<div class="text-sm muted">여기에 놓인 기호와 질문을 떠올린 뒤 공개하세요</div>' : ''}</div></div></div>
            ${stage >= 1 ? `<div class="card">
                <div class="flex items-center gap-2 flex-wrap mb-1"><span class="text-xl font-bold">${U.esc(info.name)}</span>${Palace.roleBadges(t, info.name, tree)}</div>
                <div class="text-sm">${info.symbol ? '🔹 ' + U.esc(info.symbol) : '<span class="missing">기호 미작성</span>'}</div>
                ${info.link ? `<div class="link-box mt-2">🔗 ${U.esc(info.link)}</div>` : ''}
                ${info.signal ? `<div class="text-sm muted">🎧 "${U.esc(info.signal)}"</div>` : ''}
                ${q.en ? `<div class="flex gap-2 items-start mt-2"><button class="icon-btn flex-shrink-0" style="width:32px;height:32px" ${UI.say(q.en)}><i class="fas fa-volume-high"></i></button><p class="text-sm">${U.esc(q.en)}</p></div>` : `<p class="text-sm muted mt-2">${U.esc(q.ko)}</p>`}
            </div>` : ''}
            ${stage >= 2 ? (roles.length ? roles.map(r => {
                const sc = (r.role === '1' && info.scene1) || (r.role === '2' && info.scene2) || info.scene;
                return `<div class="card"><div class="text-sm font-semibold mb-1">${Data.roleLabel(r.role)} 질문으로 나오면 → ${r.next.map(U.esc).join(' / ')}</div>
                    ${sc ? `<div class="scene">🎬 ${U.esc(sc)}</div>` : '<p class="missing text-sm">장면 미작성</p>'}</div>`;
            }).join('') : '<div class="card text-sm">마지막에만 나오는 질문입니다. 답한 뒤에는 주제가 바뀝니다.</div>') : ''}
            <div class="flex gap-2">
                ${stage < 2 ? `<button class="btn btn-primary flex-1" data-act="more">공개 (${stage + 1}/2)</button>` : `<button class="btn btn-primary flex-1" data-act="next">${i < t.chain.length - 1 ? '다음 위치' : '다 걸었습니다'}</button>`}
                <button class="btn btn-gray" data-act="prev" ${i === 0 ? 'disabled' : ''}>이전</button>
                <button class="btn btn-gray" data-act="edit" aria-label="편집"><i class="fas fa-pen"></i></button>
            </div>
        </div>`;
        el.scrollTop = 0;
    };
    UI.bind(el, {
        more: () => { stage++; draw(); },
        prev: () => { i--; stage = 2; draw(); },
        next: () => {
            if (i < t.chain.length - 1) { i++; stage = 0; draw(); return; }
            el.innerHTML = `<div class="wrap"><div class="card text-center"><div class="font-bold text-lg mb-3">${U.esc(t.name)} 방을 다 걸었습니다</div>
                <div class="grid grid-cols-2 gap-2"><button class="btn btn-primary" data-act="cards">갈림길 맞히기</button><button class="btn btn-gray" data-act="back">돌아가기</button></div></div></div>`;
        },
        cards: () => { TTS.unlock(); location.hash = `#/palace/predict/${encodeURIComponent(t.name)}/cards`; },
        back: () => history.back(),
        edit: () => ElementEditor.open(t, t.chain[i], draw)
    });
    draw();
};

// ---------------- 다음 질문 맞히기 ----------------
const Predict = {
    scopeTopics(scope) {
        if (scope === '*survey') return Data.topics('서베이');
        if (scope === '*common') return Data.topics('공통형');
        if (scope && scope[0] !== '*') { const t = Data.topic(scope); return t ? [t] : []; }
        return Data.topics();
    },
    start(el, scope, mode) {
        const topics = Predict.scopeTopics(scope);
        UI.title(mode === 'flow' ? '콤보 흐름' : (scope === '*due' ? '갈림길 복습' : '다음 질문 맞히기'), true);
        if (mode === 'flow') return Predict.flow(el, topics);
        let forks = scope === '*due' ? Palace.dueForks() : topics.flatMap(t => Data.forks(t));
        return Predict.cards(el, forks, { scope });
    },

    // 같은 주제의 질문 칩 (지금 질문 제외, 사슬 순서)
    chips(t, current, sel, reveal) {
        return `<div class="flex flex-wrap gap-2">${t.chain.filter(n => n !== current).map(n => {
            let cls = sel.has(n) ? 'chip-blue' : '';
            if (reveal) {
                const ok = reveal.has(n);
                cls = ok && sel.has(n) ? 'chip-green' : ok ? 'chip-amber' : sel.has(n) ? 'chip-red' : '';
            }
            return `<button class="chip ${cls}" style="padding:6px 12px;font-size:.9rem" data-act="chip" data-n="${U.esc(n)}" ${reveal ? 'disabled' : ''}>${reveal && reveal.has(n) && !sel.has(n) ? '＋ ' : ''}${U.esc(n)}</button>`;
        }).join('')}</div>`;
    },
    judge(sel, correct) {
        const hit = [...sel].filter(n => correct.has(n)).length;
        if (hit === correct.size && sel.size === correct.size) return 'good';
        return hit > 0 ? 'hard' : 'again';
    },
    questionCard(info, roleText, extra = '') {
        const q = Data.question(info);
        return `<div class="card">
            <div class="text-xs muted mb-1">${U.esc(info.topic.name)} · ${roleText}</div>
            <div class="text-xl font-bold mb-2">${U.esc(info.name)}</div>
            ${extra}
            ${q.en ? `<div class="flex gap-2 items-start"><button class="icon-btn flex-shrink-0" style="width:32px;height:32px" ${UI.say(q.en)}><i class="fas fa-volume-high"></i></button><p class="text-sm">${U.esc(q.en)}</p></div>` : `<p class="text-sm muted">${U.esc(q.ko)}</p>`}
        </div>`;
    },
    revealCard(fork, correct, grade) {
        const g = { good: ['chip-green', '정확'], hard: ['chip-amber', '일부만'], again: ['chip-red', '놓침'] }[grade];
        return `<div class="card space-y-2">
            <div class="flex items-center gap-2"><span class="chip ${g[0]}">${g[1]}</span><span class="text-sm">다음 후보: <b>${[...correct].map(U.esc).join(' / ')}</b></span></div>
            ${fork.info.symbol ? `<div class="text-sm">🔹 ${U.esc(fork.info.symbol)}</div>` : ''}
            ${fork.info.link ? `<div class="link-box text-sm">🔗 ${U.esc(fork.info.link)}</div>` : ''}
            ${fork.scene ? `<div class="scene text-sm">🎬 ${U.esc(fork.scene)}</div>` : '<p class="missing text-sm">장면 미작성 — 연필 버튼으로 써 두면 다음부터 떠올리기 쉽습니다</p>'}
            <p class="text-xs muted">${U.esc(Data.ruleHint(fork.info.type, fork.role))}</p>
        </div>`;
    },

    // 카드 모드: 갈림길 하나씩 (복습할 것 → 새것 순서)
    cards(el, forks, opts = {}) {
        const due = U.shuffle(forks.filter(f => SRS.dueKeys([f.key]).length));
        const fresh = forks.filter(f => !SRS.get(f.key)).slice(0, opts.newLimit || 12);
        // 복습 일정과 상관없이 전부 연습할 때는 받은 목록 그대로
        const queue = opts.practiceAll ? [...forks] : opts.scope === '*due' ? due : [...due, ...fresh];
        if (!queue.length) {
            el.innerHTML = `<div class="wrap"><div class="card">지금 볼 갈림길이 없습니다. ${forks.length ? '모두 복습 일정 전입니다.' : ''}</div>
                ${forks.length ? '<button class="btn btn-soft w-full mt-3" data-act="all">그래도 전부 연습하기</button>' : ''}</div>`;
            UI.bind(el, { all: () => Predict.cards(el, U.shuffle(forks), { practiceAll: true, onDone: opts.onDone }) });
            return;
        }
        UI.busy = true;
        const started = Date.now();
        let i = 0, sel = new Set(), revealed = null, ctxFirst = null;
        const results = [];
        const draw = () => {
            UI.sayMap.clear();
            const f = queue[i];
            // 3번째 후보가 1번째 질문에 따라 달라지는 경우: 1번째를 하나 정해서 보여 줍니다
            if (f.byFirst.length && !ctxFirst) ctxFirst = U.pick(f.byFirst);
            const correct = new Set(ctxFirst ? ctxFirst.next : f.next);
            const extra = ctxFirst ? `<p class="text-sm mb-2">1번째 질문은 <b>${U.esc(ctxFirst.first)}</b>였습니다</p>` : '';
            el.innerHTML = `<div class="wrap space-y-3">
                <div class="bar"><span style="width:${Math.round(i / queue.length * 100)}%"></span></div>
                <div class="text-xs muted">${i + 1}/${queue.length} · ${SRS.get(f.key) ? '복습' : '새 갈림길'}</div>
                ${Predict.questionCard(f.info, `이 주제의 ${Data.roleLabel(f.role)} 질문으로 나왔습니다`, extra)}
                <div class="card"><div class="text-sm font-semibold mb-2">다음에 올 수 있는 질문을 모두 고르세요</div>
                    ${Predict.chips(f.t, f.name, sel, revealed && correct)}</div>
                ${revealed ? Predict.revealCard(f, correct, revealed) + `<button class="btn btn-primary w-full" data-act="next">${i < queue.length - 1 ? '다음' : '끝'}</button>`
                    : `<div class="grid grid-cols-3 gap-2"><button class="btn btn-primary col-span-2" data-act="check" ${sel.size ? '' : 'disabled'}>확인</button><button class="btn btn-gray" data-act="dunno">모름</button></div>`}
                ${revealed ? '' : '<button class="btn btn-gray w-full text-sm" data-act="edit"><i class="fas fa-pen"></i> 이 위치 편집</button>'}
            </div>`;
            el.scrollTop = 0;
        };
        const doReveal = async (grade) => {
            const f = queue[i];
            const correct = new Set(ctxFirst ? ctxFirst.next : f.next);
            revealed = grade || Predict.judge(sel, correct);
            results.push(revealed);
            draw();   // 공개는 바로, 복습 일정 저장은 뒤에서
            SRS.grade(f.key, revealed).catch(e => console.error('채점 저장 실패', e));
        };
        UI.bind(el, {
            chip: b => { if (revealed) return; const n = b.dataset.n; sel.has(n) ? sel.delete(n) : sel.add(n); draw(); },
            check: () => doReveal(),
            dunno: () => doReveal('again'),
            edit: () => ElementEditor.open(queue[i].t, queue[i].name, draw),
            next: () => {
                TTS.stop(false);
                if (revealed === 'again') queue.push(queue[i]);   // 놓친 것은 이번 묶음 끝에 한 번 더
                i++; sel = new Set(); revealed = null; ctxFirst = null;
                if (i < queue.length) { draw(); return; }
                UI.busy = false;
                const c = g => results.filter(x => x === g).length;
                DB.put('sessions', { date: U.today(), startedAt: started, mode: 'predict', minutes: Math.round((Date.now() - started) / 6000) / 10, count: results.length }).catch(console.error);
                el.innerHTML = `<div class="wrap"><div class="card text-center"><div class="font-bold text-lg mb-2">갈림길 ${results.length}개 끝</div>
                    <div class="grid grid-cols-3 gap-2 mb-4 text-sm"><div class="reveal"><b class="text-green-600 text-lg">${c('good')}</b><br>정확</div><div class="reveal"><b class="text-amber-600 text-lg">${c('hard')}</b><br>일부만</div><div class="reveal"><b class="text-lg">${c('again')}</b><br>놓침</div></div>
                    <button class="btn btn-primary" data-act="done">${opts.onDone ? '다음 단계로' : '끝내기'}</button></div></div>`;
            },
            done: () => opts.onDone ? opts.onDone(results) : history.back()
        });
        draw();
    },

    // 콤보 흐름 모드: 실제 콤보 하나를 따라가며 매 질문마다 다음을 예측
    flow(el, topics, opts = {}) {
        const pool = topics.flatMap(t => t.combos.map(c => ({ t, c })));
        if (!pool.length) { el.innerHTML = '<div class="wrap"><p class="missing">콤보가 없습니다</p></div>'; return; }
        UI.busy = true;
        const started = Date.now();
        let combo = null, i = 0, sel = new Set(), revealed = null, count = 0;
        const newCombo = () => { combo = U.pick(pool); i = 0; sel = new Set(); revealed = null; };
        const draw = (speak) => {
            UI.sayMap.clear();
            const { t, c } = combo;
            const tree = Data.tree(t);
            const info = Data.el(t, c[i]);
            const last = i === c.length - 1;
            const role = c.length === 2 ? 'p' : (i === 0 ? '1' : '2');
            const correct = last ? null : new Set(c.length === 2 ? tree.pair.get(c[0]) : i === 0 ? tree.as1.get(c[0]) : tree.q3by.get(c[0] + '|' + c[1]));
            const posText = c.length === 2 ? (i === 0 ? '14번' : '15번') : `${i + 1}번째`;
            const fork = last ? null : Data.forks(t).find(f => f.role === role && f.name === c[i]);
            el.innerHTML = `<div class="wrap space-y-3">
                <div class="flex items-center justify-between text-sm"><span class="font-bold">${U.esc(t.name)} · ${U.esc(Data.place(t))}</span><span class="muted">${posText} / ${c.length}문항 콤보</span></div>
                <div class="text-xs muted">지나온 질문: ${c.slice(0, i).map(U.esc).join(' → ') || '(첫 질문)'}</div>
                ${Predict.questionCard(info, `${posText} 질문`)}
                ${last ? `<div class="card text-center"><p class="mb-3">콤보 끝 — 다음은 <b>새 주제</b>입니다</p>
                        <div class="grid grid-cols-2 gap-2"><button class="btn btn-primary" data-act="again">다음 콤보</button><button class="btn btn-gray" data-act="quit">그만</button></div></div>`
                : `<div class="card"><div class="text-sm font-semibold mb-2">다음 질문은? (가능한 것 모두)</div>${Predict.chips(t, c[i], sel, revealed && correct)}</div>
                   ${revealed ? Predict.revealCard(fork, correct, revealed) + `<div class="card text-sm">실제 다음 질문: <b>${U.esc(c[i + 1])}</b></div>
                        <button class="btn btn-primary w-full" data-act="go">다음 질문 듣기</button>`
                   : `<div class="grid grid-cols-3 gap-2"><button class="btn btn-primary col-span-2" data-act="check" ${sel.size ? '' : 'disabled'}>확인</button><button class="btn btn-gray" data-act="dunno">모름</button></div>`}`}
            </div>`;
            el.scrollTop = 0;
            const q = Data.question(info);
            if (speak && Settings.v.autoQuestion && q.en) TTS.play(q.en, 'once', { title: info.name });
        };
        const reveal = async grade => {
            const { t, c } = combo, tree = Data.tree(t);
            const role = c.length === 2 ? 'p' : (i === 0 ? '1' : '2');
            const correct = new Set(c.length === 2 ? tree.pair.get(c[0]) : i === 0 ? tree.as1.get(c[0]) : tree.q3by.get(c[0] + '|' + c[1]));
            revealed = grade || Predict.judge(sel, correct);
            // 3번째 후보가 1번째에 따라 달라지는 갈림길은 이 경로의 정답으로 채점합니다
            count++;
            draw();
            SRS.grade(Data.forkKey(t, role, c[i]), revealed).catch(e => console.error('채점 저장 실패', e));
        };
        UI.bind(el, {
            chip: b => { if (revealed) return; const n = b.dataset.n; sel.has(n) ? sel.delete(n) : sel.add(n); draw(); },
            check: () => reveal(),
            dunno: () => reveal('again'),
            go: () => { TTS.stop(false); i++; sel = new Set(); revealed = null; draw(true); },
            again: () => { TTS.stop(false); newCombo(); draw(true); },
            quit: () => {
                UI.busy = false;
                DB.put('sessions', { date: U.today(), startedAt: started, mode: 'predict', minutes: Math.round((Date.now() - started) / 6000) / 10, count }).catch(console.error);
                if (opts.onDone) opts.onDone(); else history.back();
            }
        });
        newCombo(); draw(true);
    }
};
