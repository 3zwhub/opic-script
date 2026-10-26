// =========================================================================
//  블록 카드: 필수 표현 · 내가 막힌 표현 · 답변 문장 암기(빈칸/첫 글자/문장 키워드/키워드/연결)
// =========================================================================
const Stuck = {
    KEY: 'opicTrainer.stuck',
    list() { return U.lsGet(this.KEY, []); },
    add(en, ko = '') {
        const l = this.list(); const item = { key: 'stuck/' + U.uid(), en: en.trim(), ko: ko.trim(), topic: '내가 막힌 표현', at: U.today() };
        if (!item.en) return null;
        l.push(item); U.lsSet(this.KEY, l); return item;
    },
    remove(key) { U.lsSet(this.KEY, this.list().filter(x => x.key !== key)); }
};

const Cards = {
    render(el, parts) {
        if (parts[0] === 'answer') return Cards.renderAnswer(el, parts[1]);
        if (parts[0] === 'deck') return Cards.runDeck(el, parts[1]);
        UI.title('블록 카드', true);
        const exprKeys = Data.expressions.map(x => x.key), stuck = Stuck.list();
        const exprDue = SRS.dueKeys(exprKeys).length, exprNew = exprKeys.filter(k => !SRS.get(k)).length;
        const stuckDue = SRS.dueKeys(stuck.map(x => x.key)).length;
        const f = Data.activeFile();
        const topics = [...new Set(f.scripts.map(Parse.scriptTopic))];
        el.innerHTML = `<div class="wrap">
            <div class="sec-title" style="margin-top:0">표현 카드 (한국어 → 영어로 말하기)</div>
            <div class="space-y-2">
                <button class="row-item" data-act="deck" data-d="expr"><span class="num"><i class="fas fa-layer-group"></i></span>
                    <span class="flex-1"><span class="block font-semibold">필수 표현 ${exprKeys.length}개</span><span class="block text-xs muted">복습 ${exprDue} · 새 표현 ${exprNew} (한 번에 새 표현 15개까지)</span></span></button>
                <button class="row-item" data-act="deck" data-d="stuck"><span class="num"><i class="fas fa-triangle-exclamation"></i></span>
                    <span class="flex-1"><span class="block font-semibold">내가 막힌 표현 ${stuck.length}개</span><span class="block text-xs muted">복습 ${stuckDue} · 녹음 점검 후 '기록' 단계에서 추가됩니다</span></span></button>
            </div>
            <div class="card mt-2">
                <div class="text-sm font-semibold mb-2">막힌 표현 직접 추가</div>
                <div class="field mb-2"><input id="stEn" placeholder="영어 표현 (예: It totally slipped my mind)"></div>
                <div class="flex gap-2"><div class="field flex-1"><input id="stKo" placeholder="뜻 (선택)"></div><button class="btn btn-primary" data-act="addStuck">추가</button></div>
            </div>
            <div class="sec-title">답변 문장 암기 (빈칸 · 첫 글자 · 문장 키워드 · 연결)</div>
            <div class="field mb-2"><select id="ansTopic">${topics.map(t => `<option ${Cards.lastTopic === t ? 'selected' : ''}>${U.esc(t)}</option>`).join('')}</select></div>
            <div class="space-y-2" id="ansList"></div>
        </div>`;
        const drawList = () => {
            const t = el.querySelector('#ansTopic').value; Cards.lastTopic = t;
            el.querySelector('#ansList').innerHTML = f.scripts.filter(s => Parse.scriptTopic(s) === t).map(s => `
                <button class="row-item" data-act="answer" data-q="${U.esc(s.id)}"><span class="num">${U.esc(s.id.replace(/^Q0*/, ''))}</span>
                <span class="flex-1 min-w-0 font-semibold truncate">${U.esc(s.title)}</span><i class="fas fa-chevron-right text-gray-300"></i></button>`).join('');
        };
        el.querySelector('#ansTopic').onchange = drawList; drawList();
        UI.bind(el, {
            deck: b => { location.hash = '#/drill/cards/deck/' + b.dataset.d; },
            answer: b => { location.hash = '#/drill/cards/answer/' + b.dataset.q; },
            addStuck: () => {
                const it = Stuck.add(el.querySelector('#stEn').value, el.querySelector('#stKo').value);
                if (it) { UI.toast('추가했습니다'); Cards.render(el, []); }
            }
        });
    },

    runDeck(el, deck) {
        const src = deck === 'stuck' ? Stuck.list() : Data.expressions;
        UI.title(deck === 'stuck' ? '내가 막힌 표현' : '필수 표현', true);
        const due = U.shuffle(src.filter(x => SRS.dueKeys([x.key]).length));
        const fresh = src.filter(x => !SRS.get(x.key)).slice(0, deck === 'stuck' ? 50 : 15);
        const queue = [...due, ...fresh];
        if (!queue.length) { el.innerHTML = '<div class="wrap"><div class="card">오늘 볼 카드가 없습니다.</div></div>'; return; }
        UI.busy = true;
        let i = 0, shown = false; const started = Date.now();
        const draw = () => {
            UI.sayMap.clear();
            const c = queue[i];
            el.innerHTML = `<div class="wrap space-y-3">
                <div class="bar"><span style="width:${Math.round(i / queue.length * 100)}%"></span></div>
                <div class="text-xs muted">${i + 1}/${queue.length} · ${U.esc(c.topic)}${c.group ? ' · ' + U.esc(c.group) : ''} · ${SRS.get(c.key) ? '복습' : '새 카드'}</div>
                <div class="card text-center py-8"><div class="text-2xl font-bold">${U.esc(c.ko || '(뜻 없음)')}</div>
                    <div class="text-sm muted mt-2">영어로 소리 내어 말한 뒤 확인하세요</div></div>
                ${shown ? `<div class="card text-center"><div class="text-xl font-semibold mb-2">${U.esc(c.en)}</div>
                    <button class="btn btn-soft text-sm" ${UI.say(c.en)}><i class="fas fa-volume-high"></i> 듣기</button></div>
                    <div class="grid grid-cols-3 gap-2"><button class="btn btn-green" data-act="g" data-g="good">기억남</button><button class="btn btn-soft" data-act="g" data-g="hard">헷갈림</button><button class="btn btn-gray" data-act="g" data-g="again">모름</button></div>`
                : '<button class="btn btn-primary w-full" data-act="show">확인</button>'}
            </div>`;
        };
        UI.bind(el, {
            show: () => { shown = true; draw(); const t = queue[i].en; if (t) TTS.play(t, 'once'); },
            g: async b => {
                await SRS.grade(queue[i].key, b.dataset.g);
                if (b.dataset.g === 'again') queue.push(queue[i]);   // 모르면 이번 묶음 끝에 한 번 더
                i++; shown = false;
                if (i >= queue.length) {
                    UI.busy = false;
                    await DB.put('sessions', { date: U.today(), startedAt: started, mode: 'cards', minutes: Math.round((Date.now() - started) / 6000) / 10, count: i });
                    el.innerHTML = `<div class="wrap"><div class="card text-center"><div class="font-bold text-lg mb-2">카드 ${i}장 끝</div><button class="btn btn-primary" data-act="back">돌아가기</button></div></div>`;
                    UI.bind(el, { back: () => history.back() });
                } else draw();
            }
        });
        draw();
    },

    // 답변 문장 암기: 읽기가 아니라 꺼내기(인출) 연습
    renderAnswer(el, qid) {
        const s = Data.byKey.get(qid);
        UI.title(s ? s.title : '답변', true);
        if (!s) { el.innerHTML = '<div class="wrap"><p class="missing">답변을 찾을 수 없습니다</p></div>'; return; }
        const linked = [];
        Data.topics().forEach(t => t.chain.forEach(n => { const i = Data.el(t, n); if (i.answer.refs.includes(qid)) linked.push(i); }));
        let mode = Cards.mode || 'blank', seed = 0, focus = null;
        const STOP = new Set('the a an and or but so to of in on at for with is are was were be been it this that my your i you we they he she as by from have has had do did not very really just also there their then than'.split(' '));
        const tokenize = text => text.split(/(\s+)/);
        const info = Kw.forScript(s);
        const draw = () => {
            UI.sayMap.clear();
            const sents = U.sentences(s.answer);
            let k = 0;
            const body = sents.map((sent, si) => {
                let html;
                if (mode === 'full') html = U.esc(sent);
                else if (mode === 'first') html = tokenize(sent).map(w => /\s/.test(w) || !w ? w : U.esc(w.replace(/^(\W*)(\w)(\w*)(.*)$/, (m, a, b, c, d) => a + b + c.replace(/\w/g, '_') + d))).join('');
                else html = tokenize(sent).map(w => {
                    const core = w.replace(/\W/g, '');
                    if (/\s/.test(w) || core.length < 4 || STOP.has(core.toLowerCase())) return U.esc(w);
                    k++;
                    return (k + seed) % 3 === 0 ? `<span class="blank" data-act="reveal">${U.esc(w)}</span>` : U.esc(w);
                }).join('');
                return `<span class="sentence" ${mode === 'full' || mode === 'first' ? UI.say(sent, '') : ''}><span class="sentence-num">${U.circled(si + 1)}</span>${html}</span>`;
            }).join('');
            const kw = (s.keywords || linked.map(i => i.K).filter(Boolean).join(', ')).split(',').map(x => x.trim()).filter(Boolean);
            const hasSentKw = info.sents.some(x => x.kws.length);
            let main;
            if (mode === 'keys') main = `${kw.length ? `<div class="flex flex-wrap gap-1 mb-3">${kw.map(x => `<span class="chip chip-blue">${U.esc(x)}</span>`).join('')}</div>` : '<p class="missing mb-3">키워드가 없습니다</p>'}
                           <p class="text-sm muted">키워드만 보고 소리 내어 답한 뒤, '전체'에서 확인하세요.</p>`;
            else if (mode === 'sent') main = !hasSentKw ? '<p class="missing">이 답변에는 문장 키워드가 없습니다</p>' : `
                <div class="flex items-center gap-2 mb-2"><p class="text-sm muted flex-1">키워드를 누르면 그 문장을 읽어 줍니다.</p>
                    <button class="btn btn-gray text-sm" data-act="hideSent">${Cards.hideSent ? '문장 보기' : '문장 가리기'}</button></div>
                <div>${info.sents.map((x, si) => { const sa = UI.say(x.text, ''); const id = sa.match(/data-say="([^"]+)"/)[1]; return `<div class="kw-row" data-say-row="${id}">
                    <span class="sentence-num">${U.circled(si + 1)}</span><div class="min-w-0 flex-1">
                    ${x.kws.length ? `<div class="flex flex-wrap gap-1 mb-1">${x.kws.map(w => `<button class="chip chip-blue kw-chip" ${sa}>${U.esc(w)}</button>`).join('')}</div>` : `<button class="chip kw-chip" ${sa}>문장 듣기</button>`}
                    <div class="kw-text ${Cards.hideSent ? 'hidden' : ''}" data-act="peek">${Cards.markKw(x.text, x.kws)}</div></div></div>`; }).join('')}</div>`;
            else if (mode === 'map') main = info.edges.length ? Cards.kwMap(info, focus) : '<p class="missing">이 답변에는 키워드 연결이 없습니다</p>';
            else main = `<div class="answer-text">${body}</div>`;
            el.innerHTML = `<div class="wrap space-y-3">
                <div class="seg">${[['blank', '빈칸'], ['first', '첫 글자'], ['sent', '문장 키워드'], ['keys', '키워드만'], ['map', '연결'], ['full', '전체']].map(([v, t]) => `<button data-act="mode" data-m="${v}" class="${mode === v ? 'on' : ''}">${t}</button>`).join('')}</div>
                <div class="card">
                    ${Parse.hasQuestion(s) ? `<div class="flex gap-2 items-start mb-3"><button class="icon-btn flex-shrink-0" style="width:32px;height:32px" ${UI.say(s.question)}><i class="fas fa-volume-high"></i></button><p class="text-sm">${U.esc(s.question)}</p></div>` : ''}
                    ${linked.length ? `<div class="text-xs muted mb-2">궁전: ${linked.map(i => `${U.esc(i.topic.name)} · ${U.esc(i.name)}${i.symbol ? ' 🔹' + U.esc(i.symbol) : ''}`).join(' / ')}</div>` : ''}
                    ${main}
                </div>
                <div class="flex gap-2">
                    ${mode === 'blank' ? '<button class="btn btn-gray text-sm" data-act="reshuffle">다른 빈칸</button><button class="btn btn-gray text-sm" data-act="showAll">빈칸 모두 보기</button>' : ''}
                    <button class="btn btn-soft text-sm" ${UI.say(s.answer, 'fas fa-play')}><i class="fas fa-play"></i> 전체 듣기</button>
                </div>
            </div>`;
        };
        UI.bind(el, {
            mode: b => { mode = Cards.mode = b.dataset.m; focus = null; TTS.stop(false); draw(); },
            reveal: b => b.classList.add('shown'),
            reshuffle: () => { seed = (seed + 1) % 3; draw(); },
            showAll: () => el.querySelectorAll('.blank').forEach(b => b.classList.add('shown')),
            hideSent: () => { Cards.hideSent = !Cards.hideSent; draw(); },
            peek: b => { if (Cards.hideSent) b.classList.toggle('hidden'); },
            kw: b => { focus = focus === b.dataset.kw ? null : b.dataset.kw; draw(); }
        });
        draw();
    },

    // 문장 속 키워드에 표시 (대소문자·따옴표 차이는 무시하고 찾음)
    markKw(text, kws) {
        const low = text.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[—–]/g, '-');
        const ranges = kws.map(k => { const q = Kw.norm(k), i = low.indexOf(q); return i < 0 ? null : [i, i + q.length]; }).filter(Boolean).sort((a, b) => a[0] - b[0]);
        let out = '', pos = 0;
        ranges.forEach(([a, b]) => { if (a < pos) return; out += U.esc(text.slice(pos, a)) + '<mark class="kw-mark">' + U.esc(text.slice(a, b)) + '</mark>'; pos = b; });
        return out + U.esc(text.slice(pos));
    },

    REL_COLOR: { 이유: '#d97706', 결과: '#16a34a', 대조: '#e11d48', 구체화: '#2563eb', 위치: '#7c3aed', 같은: '#64748b' },

    // 연결 지도: 키워드를 문장 순서대로 세로로 놓고, 의미 관계를 왼쪽 호로 잇습니다
    kwMap(info, focus) {
        const nodes = [];
        info.sents.forEach((x, si) => x.kws.forEach(k => { if (!nodes.some(n => Kw.norm(n.k) === Kw.norm(k))) nodes.push({ k, si }); }));
        const idx = new Map(nodes.map((n, i) => [Kw.norm(n.k), i]));
        const RH = 30, TOP = 16, AX = 132, H = TOP * 2 + RH * Math.max(0, nodes.length - 1);
        const W = AX + 20 + Math.max(...nodes.map(n => n.k.length)) * 6.9 + 6;
        const y = i => TOP + i * RH, f = focus && Kw.norm(focus);
        const near = new Set(f ? [f] : []);
        info.edges.forEach(([a, b]) => { if (Kw.norm(a) === f) near.add(Kw.norm(b)); if (Kw.norm(b) === f) near.add(Kw.norm(a)); });
        let bands = '';
        for (let i = 0, start = 0; i <= nodes.length; i++) {
            if (i < nodes.length && nodes[i].si === nodes[start].si) continue;
            if (nodes[start].si % 2) bands += `<rect x="${AX - 6}" y="${y(start) - RH / 2}" width="${W - AX + 6}" height="${(i - start) * RH}" fill="#eff6ff"/>`;
            start = i;
        }
        const edges = info.edges.map(([a, b, r]) => {
            const i = idx.get(Kw.norm(a)), j = idx.get(Kw.norm(b));
            const y1 = y(Math.min(i, j)), y2 = y(Math.max(i, j)), dx = Math.min(AX - 12, 14 + Math.abs(i - j) * 11);
            const hot = f && (Kw.norm(a) === f || Kw.norm(b) === f);
            return `<path d="M${AX},${y1} C${AX - dx},${y1} ${AX - dx},${y2} ${AX},${y2}" fill="none" stroke="${Cards.REL_COLOR[r]}" stroke-width="2" ${r === '같은' ? 'stroke-dasharray="4 4"' : ''} opacity="${f && !hot ? 0.15 : 1}"><title>${U.esc(a)} — ${r} — ${U.esc(b)}</title></path>`;
        }).join('');
        const rows = nodes.map((n, i) => {
            const dim = f && !near.has(Kw.norm(n.k)) ? 0.25 : 1, first = !i || nodes[i - 1].si !== n.si;
            return `<g data-act="kw" data-kw="${U.esc(n.k)}" style="cursor:pointer" opacity="${dim}"><rect x="${AX - 8}" y="${y(i) - RH / 2}" width="${W - AX + 8}" height="${RH}" fill="transparent"/>
                <circle cx="${AX}" cy="${y(i)}" r="5" fill="#2563eb" stroke="#fff" stroke-width="2"/>
                <text x="${AX + 14}" y="${y(i) + 4.5}" font-size="13" fill="#1f2937" font-weight="${Kw.norm(n.k) === f ? 700 : 400}">${U.esc(n.k)}</text></g>
                ${first ? `<text x="${AX - 10}" y="${y(i) + 4}" font-size="11" fill="#9ca3af" text-anchor="end" opacity="${f ? 0 : 1}">${U.circled(n.si + 1)}</text>` : ''}`;
        }).join('');
        const legend = Object.entries(Cards.REL_COLOR).map(([r, c]) => `<span class="inline-flex items-center gap-1"><i style="display:inline-block;width:16px;height:0;border-top:3px ${r === '같은' ? 'dashed' : 'solid'} ${c}"></i>${r}</span>`).join('');
        let detail = '<p class="text-sm muted">키워드를 누르면 연결된 키워드와 원래 문장이 나옵니다.</p>';
        if (f) {
            const n = nodes[idx.get(f)], sent = info.sents[n.si].text;
            const rels = info.edges.filter(([a, b]) => Kw.norm(a) === f || Kw.norm(b) === f);
            detail = `<div class="reveal space-y-2">
                <div class="flex items-center gap-2"><span class="font-bold flex-1">${U.esc(n.k)} <span class="text-xs muted font-normal">문장 ${U.circled(n.si + 1)}</span></span>
                    <button class="btn btn-soft text-sm" ${UI.say(sent)}><i class="fas fa-volume-high"></i> 문장 듣기</button></div>
                <p class="text-sm">${Cards.markKw(sent, [n.k])}</p>
                <div class="space-y-1">${rels.map(([a, b, r]) => { const out = Kw.norm(a) === f, o = out ? b : a; return `<div class="flex items-center gap-2 text-sm flex-wrap">
                    <span class="chip" style="background:${Cards.REL_COLOR[r]};color:#fff;border-color:transparent">${r}</span>
                    <button class="chip" data-act="kw" data-kw="${U.esc(o)}">${U.esc(o)}</button><span class="text-xs muted">${out ? '이 키워드에서 이어짐' : '이 키워드로 이어짐'}</span></div>`; }).join('')}</div></div>`;
        }
        return `<div class="flex flex-wrap gap-x-3 gap-y-1 text-xs muted mb-2">${legend}</div>
            <div class="kw-map"><svg width="${Math.ceil(W)}" height="${H}" viewBox="0 0 ${Math.ceil(W)} ${H}" role="img" aria-label="키워드 연결 지도">${bands}${edges}${rows}</svg></div>
            <div class="mt-3">${detail}</div>
            <details class="mt-3"><summary class="text-sm muted cursor-pointer">연결 전체를 글로 보기 (${info.edges.length}개)</summary>
                <div class="space-y-1 mt-2 text-sm">${info.edges.map(([a, b, r]) => `<div>${U.esc(a)} <span class="chip" style="background:${Cards.REL_COLOR[r]};color:#fff;border-color:transparent">${r}</span> ${U.esc(b)}</div>`).join('')}</div></details>`;
    }
};
