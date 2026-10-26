// =========================================================================
//  자료실: 답변 파일(기존 스크립트 브라우저) · 콤보 데이터 · 표현
// =========================================================================
const Lib = { search: '', fileId: null, ttsMode: 'once', range: {} };

Views.library = (el, parts) => {
    const sub = parts[0] || 'answers';
    if (sub === 'script') return Lib.renderScript(el, parts[1], parts[2]);
    if (sub === 'topic') return Lib.renderTopic(el, parts[1]);
    UI.title('자료실');
    const tabs = [['answers', '답변 파일'], ['combos', '콤보 데이터'], ['expr', '표현']];
    el.innerHTML = `<div class="wrap">
        <div class="seg mb-4">${tabs.map(([k, t]) => `<button data-act="tab" data-k="${k}" class="${sub === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <div id="libBody"></div></div>`;
    UI.bind(el.querySelector('.seg'), { tab: b => { location.hash = '#/library/' + b.dataset.k; } });
    const body = el.querySelector('#libBody');
    if (sub === 'combos') Lib.renderCombos(body);
    else if (sub === 'expr') Lib.renderExpr(body);
    else Lib.renderFiles(body);
};

// ---------------- 답변 파일 ----------------
Lib.currentFile = () => Data.file(Lib.fileId) || Data.activeFile();

Lib.renderFiles = (body) => {
    const files = Data.allFiles();
    const f = Lib.currentFile(); Lib.fileId = f ? f.fileId : null;
    const originLabel = { builtin: '내장', local: '이 기기', cloud: '클라우드' };
    const q = Lib.search.toLowerCase();
    const list = f ? f.scripts.filter(s => !q || [s.id, s.category, s.title, s.question, s.answer].some(v => (v || '').toLowerCase().includes(q))) : [];
    body.innerHTML = `
        <div class="card mb-3">
            <div class="field mb-2"><label>파일</label>
                <select id="libFile">${files.map(x => `<option value="${U.esc(x.fileId)}" ${f && x.fileId === f.fileId ? 'selected' : ''}>[${originLabel[x.origin]}] ${U.esc(x.fileName)}${x.fileId === Data.activeFileId ? ' ★훈련용' : ''}</option>`).join('')}</select>
            </div>
            <div class="flex flex-wrap gap-2">
                <button class="btn btn-soft text-sm" data-act="useFile" ${f && f.fileId === Data.activeFileId ? 'disabled' : ''}><i class="fas fa-star"></i> 훈련에 이 파일 사용</button>
                <label class="btn btn-gray text-sm cursor-pointer"><i class="fas fa-upload"></i> 업로드<input type="file" accept=".txt" id="libUpload" class="hidden"></label>
                <button class="btn btn-gray text-sm" data-act="download"><i class="fas fa-download"></i> 다운로드</button>
                <button class="btn btn-gray text-sm" data-act="newScript"><i class="fas fa-plus"></i> 새 스크립트</button>
                ${f && f.origin !== 'builtin' ? `<button class="btn btn-gray text-sm text-red-600" data-act="delFile"><i class="fas fa-trash"></i> 파일 삭제</button>` : ''}
            </div>
            <p class="text-xs muted mt-2">훈련(궁전·드릴)은 ★훈련용 파일의 답변을 씁니다. 동기화 방에 연결하면 기존 앱의 파일도 여기에 나타납니다 (설정 ⚙).</p>
        </div>
        <div class="field mb-3"><input id="libSearch" placeholder="검색 (제목·질문·답변)" value="${U.esc(Lib.search)}"></div>
        <div class="text-xs muted mb-2">${list.length}개</div>
        <div class="space-y-2" id="libList">${list.map(s => `
            <button class="row-item" data-act="open" data-u="${U.esc(s.uuid)}">
                <span class="num">${U.esc((s.id || '').replace(/^Q0*/, ''))}</span>
                <span class="flex-1 min-w-0">
                    <span class="block text-xs muted">${U.esc(s.category)} · ${U.esc(s.id)}</span>
                    <span class="block font-semibold truncate">${U.esc(s.title)}</span>
                </span>
                <i class="fas fa-chevron-right text-gray-300"></i>
            </button>`).join('') || '<p class="missing">스크립트가 없습니다</p>'}</div>`;

    body.querySelector('#libFile').onchange = e => { Lib.fileId = e.target.value; Lib.renderFiles(body); };
    const search = body.querySelector('#libSearch');
    search.oninput = () => { Lib.search = search.value; clearTimeout(Lib._t); Lib._t = setTimeout(() => { Lib.renderFiles(body); const s = body.querySelector('#libSearch'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 250); };
    body.querySelector('#libUpload').onchange = async e => {
        const file = e.target.files[0]; if (!file) return;
        const scripts = Parse.scripts(await U.readFile(file));
        if (!scripts.length) { UI.toast("스크립트를 찾지 못했습니다. 헤더는 '분류-Q번호-제목: 질문' 모양이어야 합니다"); return; }
        const nf = { fileId: 'file-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), fileName: file.name, scripts, updatedAt: Date.now() };
        if (Sync.user && Sync.id) { nf.origin = 'cloud'; Data.cloudFiles.unshift(nf); Sync.pushFile(nf); }
        else { nf.origin = 'local'; Data.files.push(nf); Data.saveFiles(); }
        Lib.fileId = nf.fileId; UI.toast(`${scripts.length}개 스크립트를 올렸습니다`); Lib.renderFiles(body);
    };
    UI.bind(body, {
        open: b => { location.hash = `#/library/script/${encodeURIComponent(f.fileId)}/${encodeURIComponent(b.dataset.u)}`; },
        useFile: () => { Data.setActiveFile(f.fileId); UI.toast('훈련에 이 파일을 씁니다'); Lib.renderFiles(body); },
        download: () => { if (f) U.download(f.fileName, Parse.serializeScripts(f.scripts)); },
        newScript: () => Lib.insertScript(f, f.scripts.length),
        delFile: async () => {
            if (!await UI.confirm('파일 삭제', `'${f.fileName}' 파일을 삭제할까요?`, '삭제', true)) return;
            if (f.origin === 'cloud') { Sync.deleteFile(f.fileId); Data.cloudFiles = Data.cloudFiles.filter(x => x.fileId !== f.fileId); }
            else { Data.files = Data.files.filter(x => x.fileId !== f.fileId); }
            if (Data.activeFileId === f.fileId) Data.activeFileId = 'builtin';
            Data.saveFiles(); Data.reindex(); Lib.fileId = null; Lib.renderFiles(body);
        }
    });
};

Lib.nextQ = (file) => {
    const max = Math.max(0, ...file.scripts.map(s => parseInt((s.id || '').replace(/\D/g, ''), 10) || 0));
    return 'Q' + String(max + 1).padStart(3, '0');
};

Lib.insertScript = (file, at, base) => {
    const id = Lib.nextQ(file);
    const s = { uuid: U.uid(), key: id, category: base ? base.category : '기본01', id, title: '새 스크립트', question: '', answer: '', keywords: '' };
    file.scripts.splice(at, 0, s);
    Data.commitFile(file);
    location.hash = `#/library/script/${encodeURIComponent(file.fileId)}/${encodeURIComponent(s.uuid)}`;
    setTimeout(() => Lib.editScript(file, s), 50);
};

// 스크립트 상세: TTS 연속 재생 중에도 화면만 바꿀 수 있게 해시 이동 없이 다시 그립니다
Lib.renderScript = (el, fileId, uuid) => {
    const file = Data.file(fileId);
    if (!file) { el.innerHTML = '<div class="wrap"><p class="missing">파일을 찾을 수 없습니다</p></div>'; UI.title('자료실', true); return; }
    Lib.fileId = file.fileId;
    const range = Lib.range[file.fileId] || (Lib.range[file.fileId] = { start: 1, end: file.scripts.length });
    let cur = file.scripts.find(s => s.uuid === uuid) || file.scripts[0];

    const draw = () => {
        const i = file.scripts.indexOf(cur), n = file.scripts.length;
        UI.title(cur ? cur.title : '스크립트', true);
        UI.sayMap.clear();
        const ranged = ['range', 'random'].includes(Lib.ttsMode);
        el.innerHTML = `<div class="wrap">
            <div class="flex items-center justify-between mb-3">
                <button class="btn btn-gray text-sm" data-act="nav" data-d="-1" ${i <= 0 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i> 이전</button>
                <span class="text-sm font-bold muted">${i + 1} / ${n}</span>
                <button class="btn btn-gray text-sm" data-act="nav" data-d="1" ${i >= n - 1 ? 'disabled' : ''}>다음 <i class="fas fa-chevron-right"></i></button>
            </div>
            <div class="card">
                <div class="flex items-start justify-between gap-2 mb-3">
                    <div><span class="chip chip-blue">${U.esc(cur.category)}</span> <span class="text-sm muted font-mono">${U.esc(cur.id)}</span>
                        <h2 class="text-xl font-bold mt-1">${U.esc(cur.title)}</h2></div>
                    <button class="btn btn-gray text-sm flex-shrink-0" data-act="edit"><i class="fas fa-pen"></i> 수정</button>
                </div>
                <div class="sec-title" style="margin-top:4px">QUESTION</div>
                <p class="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-3">${Parse.hasQuestion(cur) ? U.esc(cur.question) : '<span class="missing">영어 질문 없음</span>'}</p>
                <div class="flex flex-wrap items-center gap-2 bg-gray-50 border rounded-xl p-2 mb-3">
                    <select id="ttsMode" class="text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg py-1.5 px-2">
                        ${[['once', '1번 읽기'], ['repeat', '현재 항목 반복'], ['continuous', '이후 항목 연속'], ['range', '구간 순서대로 반복'], ['random', '구간 랜덤 반복']].map(([v, t]) => `<option value="${v}" ${Lib.ttsMode === v ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                    <button class="btn btn-green text-sm" data-act="play" id="libPlay"><i class="fas fa-play"></i> 재생</button>
                    <button class="btn btn-red text-sm" data-act="stop"><i class="fas fa-stop"></i></button>
                </div>
                <div class="${ranged ? '' : 'hidden'} flex flex-wrap items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 mb-3 text-sm">
                    <span class="font-bold text-indigo-700">반복 구간</span>
                    <input id="rStart" type="number" min="1" max="${n}" value="${range.start}" class="w-16 text-center border rounded-md py-1">
                    ~ <input id="rEnd" type="number" min="1" max="${n}" value="${range.end}" class="w-16 text-center border rounded-md py-1">
                    <button class="btn btn-gray text-xs" data-act="rFrom">시작＝현재</button>
                    <button class="btn btn-gray text-xs" data-act="rTo">끝＝현재</button>
                    <button class="btn btn-gray text-xs" data-act="rAll">전체</button>
                </div>
                ${UI.answerHtml(cur, { showQuestion: false })}
            </div>
            <div class="grid grid-cols-2 gap-2 mt-3">
                <button class="btn btn-gray text-sm" data-act="insert" data-o="0"><i class="fas fa-arrow-up"></i> 위에 새로</button>
                <button class="btn btn-gray text-sm" data-act="insert" data-o="1"><i class="fas fa-arrow-down"></i> 아래에 새로</button>
                <button class="btn btn-gray text-sm" data-act="move" data-d="-1" ${i <= 0 ? 'disabled' : ''}>▲ 위로 이동</button>
                <button class="btn btn-gray text-sm" data-act="move" data-d="1" ${i >= n - 1 ? 'disabled' : ''}>▼ 아래로 이동</button>
            </div>
        </div>`;
        history.replaceState(null, '', `#/library/script/${encodeURIComponent(file.fileId)}/${encodeURIComponent(cur.uuid)}`);
        el.querySelector('#ttsMode').onchange = e => { Lib.ttsMode = e.target.value; TTS.stop(false); draw(); };
        const rs = el.querySelector('#rStart'), re = el.querySelector('#rEnd');
        rs.onchange = () => { range.start = Number(rs.value) || 1; fixRange(); };
        re.onchange = () => { range.end = Number(re.value) || 1; fixRange(); };
        syncPlayIcon(TTS.state);
    };
    const fixRange = () => {
        const n = file.scripts.length;
        range.start = Math.min(Math.max(range.start, 1), n); range.end = Math.min(Math.max(range.end, 1), n);
        if (range.start > range.end) [range.start, range.end] = [range.end, range.start];
        draw();
    };
    const syncPlayIcon = state => {
        const b = el.querySelector('#libPlay'); if (!b) return;
        const mine = TTS.ctx && TTS.ctx.lib;
        b.innerHTML = mine && state === 'loading' ? '<span class="spinner"></span>' : mine && state === 'playing' ? '<i class="fas fa-volume-high"></i> 재생 중' : '<i class="fas fa-play"></i> 재생';
    };
    UI.onTeardown(TTS.on(syncPlayIcon));

    const pickNext = mode => {
        const n = file.scripts.length, i = file.scripts.indexOf(cur);
        const lo = range.start - 1, hi = range.end - 1;
        let next = null;
        if (mode === 'continuous') next = i < n - 1 ? file.scripts[i + 1] : null;
        else if (mode === 'range') next = file.scripts[(i < lo || i >= hi) ? lo : i + 1];
        else if (mode === 'random') {
            let j = i;
            if (hi === lo) j = lo; else for (let k = 0; k < 12 && j === i; k++) j = lo + Math.floor(Math.random() * (hi - lo + 1));
            next = file.scripts[j];
        }
        return next ? { text: next.answer, script: next } : null;
    };
    const ctx = () => ({
        lib: true, title: cur.title, artist: `${cur.category} · ${cur.id}`, pickNext,
        onNext: item => { cur = item.script; draw(); TTS.ctx && (TTS.ctx.title = cur.title); },
        onSkip: d => { const j = file.scripts.indexOf(cur) + d; if (file.scripts[j]) { cur = file.scripts[j]; draw(); TTS.play(cur.answer, Lib.ttsMode, ctx()); } }
    });

    UI.bind(el, {
        nav: b => { TTS.stop(false); const j = file.scripts.indexOf(cur) + Number(b.dataset.d); if (file.scripts[j]) { cur = file.scripts[j]; draw(); el.scrollTop = 0; } },
        play: () => {
            const i = file.scripts.indexOf(cur);
            if (['range', 'random'].includes(Lib.ttsMode) && (i + 1 < range.start || i + 1 > range.end)) { cur = file.scripts[range.start - 1]; draw(); }
            TTS.play(cur.answer, Lib.ttsMode, ctx());
        },
        stop: () => TTS.stop(false),
        rFrom: () => { range.start = file.scripts.indexOf(cur) + 1; fixRange(); },
        rTo: () => { range.end = file.scripts.indexOf(cur) + 1; fixRange(); },
        rAll: () => { range.start = 1; range.end = file.scripts.length; fixRange(); },
        edit: () => Lib.editScript(file, cur, s => { cur = s; draw(); }),
        insert: b => Lib.insertScript(file, file.scripts.indexOf(cur) + Number(b.dataset.o), cur),
        move: b => {
            const i = file.scripts.indexOf(cur), j = i + Number(b.dataset.d);
            if (j < 0 || j >= file.scripts.length) return;
            [file.scripts[i], file.scripts[j]] = [file.scripts[j], file.scripts[i]];
            Data.commitFile(file); draw();
        }
    });
    draw();
};

Lib.editScript = (file, s, onSaved) => {
    UI.modal(`
        <h3 class="text-lg font-bold mb-3">스크립트 수정</h3>
        <div class="grid grid-cols-3 gap-2 mb-2">
            <div class="field"><label>분류</label><input id="eCat" value="${U.esc(s.category)}"></div>
            <div class="field"><label>Q번호</label><input id="eId" value="${U.esc(s.id)}"></div>
            <div class="field"><label>제목</label><input id="eTitle" value="${U.esc(s.title)}"></div>
        </div>
        <div class="field mb-2"><label>질문</label><textarea id="eQ" rows="2">${U.esc(s.question)}</textarea></div>
        <div class="field mb-2"><label>키워드 (쉼표로 구분)</label><input id="eK" value="${U.esc(s.keywords)}"></div>
        <div class="field mb-3"><label>답변</label><textarea id="eA" rows="9">${U.esc(s.answer)}</textarea></div>
        <p class="text-xs muted mb-3">Q번호는 combos.txt의 '답변:'과 연결되는 키라서 자동으로 다시 매기지 않습니다.</p>
        <div class="flex justify-between gap-2">
            <button class="btn btn-gray text-red-600" data-x="del"><i class="fas fa-trash"></i> 삭제</button>
            <div class="flex gap-2"><button class="btn btn-gray" data-x="cancel">취소</button><button class="btn btn-primary" data-x="save">저장</button></div>
        </div>`, (m, close) => {
        const v = id => m.querySelector('#' + id).value.trim();
        m.onclick = async e => {
            const b = e.target.closest('[data-x]'); if (!b) return;
            if (b.dataset.x === 'cancel') close();
            if (b.dataset.x === 'save') {
                const id = v('eId').toUpperCase();
                if (!/^Q\d{2,4}$/.test(id)) { UI.toast('Q번호는 Q001 같은 모양이어야 합니다'); return; }
                if (file.scripts.some(x => x !== s && x.id === id)) { UI.toast(`${id}는 이미 있습니다`); return; }
                Object.assign(s, { category: v('eCat') || '기본01', id, key: id, title: v('eTitle'), question: v('eQ'), keywords: v('eK'), answer: m.querySelector('#eA').value.trim() });
                Data.commitFile(file); close(); UI.toast('저장했습니다'); if (onSaved) onSaved(s);
            }
            if (b.dataset.x === 'del') {
                if (!await UI.confirm('스크립트 삭제', `${s.id} ${s.title}을(를) 삭제할까요?`, '삭제', true)) return;
                file.scripts.splice(file.scripts.indexOf(s), 1); Data.commitFile(file); close();
                location.hash = '#/library/answers';
            }
        };
    });
};

// ---------------- 콤보 데이터 ----------------
Lib.renderCombos = (body) => {
    const groups = [['서베이', '집 궁전'], ['공통형', '동네 길']];
    const errs = Data.model.errors || [];
    body.innerHTML = `
        <div class="card mb-3">
            <p class="text-sm mb-3">원본은 <b>combos.txt</b> 형식 그대로입니다. 여기서 고친 내용은 내보내기로 파일에 반영할 수 있습니다.</p>
            <div class="flex flex-wrap gap-2">
                <button class="btn btn-gray text-sm" data-act="export"><i class="fas fa-download"></i> combos.txt 내보내기</button>
                <label class="btn btn-gray text-sm cursor-pointer"><i class="fas fa-upload"></i> 가져오기<input type="file" accept=".txt" id="cImport" class="hidden"></label>
            </div>
            ${errs.length ? `<div class="mt-3 text-sm text-amber-700"><b>확인할 것 ${errs.length}건</b><ul class="list-disc pl-5">${errs.slice(0, 10).map(e => `<li>${U.esc(e)}</li>`).join('')}</ul></div>` : ''}
        </div>
        ${groups.map(([type, label]) => {
            const ts = Data.topics(type);
            return `<div class="sec-title">${type} · ${label} (${ts.length})</div><div class="space-y-2">${ts.map(t => {
                const infos = t.chain.map(n => Data.el(t, n));
                const fk = Data.forks(t), scene = `${fk.filter(f => f.scene).length}/${fk.length}`, ans = infos.filter(i => i.scripts.length).length;
                return `<button class="row-item" data-act="topic" data-t="${U.esc(t.name)}">
                    <span class="flex-1 min-w-0"><span class="block font-semibold">${U.esc(t.name)}</span>
                    <span class="block text-xs muted truncate">${U.esc(Data.place(t))} · 요소 ${t.chain.length} · 콤보 ${t.combos.length} · 장면 ${scene} · 답변 ${ans}</span></span>
                    <i class="fas fa-chevron-right text-gray-300"></i></button>`;
            }).join('')}</div>`;
        }).join('')}`;
    body.querySelector('#cImport').onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        const r = Data.replaceCombosText(await U.readFile(f));
        UI.toast(r.ok ? '가져왔습니다' : '가져오기 실패: ' + r.errors[0]); Lib.renderCombos(body);
    };
    UI.bind(body, {
        export: () => U.download('combos.txt', Data.combosText()),
        topic: b => { location.hash = '#/library/topic/' + encodeURIComponent(b.dataset.t); }
    });
};

Lib.renderTopic = (el, name) => {
    const t = Data.topic(name);
    UI.title(name || '주제', true);
    if (!t) { el.innerHTML = '<div class="wrap"><p class="missing">주제를 찾을 수 없습니다</p></div>'; return; }
    const infos = t.chain.map(n => Data.el(t, n));
    const no = n => { const i = infos.find(x => x.name === n); return i ? i.locusNo : '?'; };
    el.innerHTML = `<div class="wrap">
        <div class="card mb-3">
            <div class="flex items-center gap-2 mb-2"><span class="chip ${Data.topicType(t) === '서베이' ? 'chip-blue' : 'chip-amber'}">${U.esc(Data.topicType(t))}</span>
            ${Parse.field(t, '출처') ? `<span class="text-xs muted">${U.esc(Parse.field(t, '출처'))}</span>` : ''}</div>
            <div class="flex gap-2 items-end">
                <div class="field flex-1"><label>궁전 장소</label><input id="tPlace" value="${U.esc(Parse.field(t, '장소'))}"></div>
                <button class="btn btn-primary" data-act="savePlace">저장</button>
            </div>
        </div>
        <div class="sec-title">사슬 (외울 순서 = 동선)</div>
        <div class="space-y-2">${infos.map(i => `
            <div class="row-item">
                <span class="num">${i.locusNo}</span>
                <span class="flex-1 min-w-0">
                    <span class="block font-semibold">${U.esc(i.name)} ${U.typeChip(i.type || Data.guessType(i))} ${i.adv1415 ? '<span class="chip chip-red">14·15</span>' : ''}</span>
                    <span class="block text-xs muted truncate">${i.locus ? '📍 ' + U.esc(i.locus) : '<span class="missing">위치 미작성</span>'} · ${i.scripts.length ? i.scripts.map(s => U.esc(s.id)).join(', ') : '<span class="missing">답변 없음</span>'}</span>
                    <span class="block text-xs truncate">${i.symbol ? '🔹 ' + U.esc(i.symbol) : '<span class="missing">기호 미작성</span>'}${i.signal ? ' · 🎧 ' + U.esc(i.signal) : ''}</span>
                    ${[i.scene, i.scene1, i.scene2].filter(Boolean).map(s => `<span class="block text-xs truncate">🎬 ${U.esc(s)}</span>`).join('')}
                </span>
                <button class="icon-btn" data-act="edit" data-n="${U.esc(i.name)}" aria-label="편집"><i class="fas fa-pen"></i></button>
            </div>`).join('')}</div>
        <div class="sec-title">콤보 (시험에서 연달아 나오는 묶음)</div>
        <div class="card text-sm space-y-1">${t.combos.map(c => `<div class="flex justify-between gap-2"><span>${c.map(U.esc).join(' / ')}</span><span class="muted font-mono">${c.map(no).join(' → ')}</span></div>`).join('')}</div>
    </div>`;
    UI.bind(el, {
        savePlace: () => { Data.updateTopicField(t, '장소', el.querySelector('#tPlace').value.trim()); UI.toast('저장했습니다'); },
        edit: b => ElementEditor.open(t, b.dataset.n, () => Lib.renderTopic(el, name))
    });
};

// 요소 편집기 (궁전·자료실에서 같이 씁니다)
const ElementEditor = {
    open(t, name, onSaved) {
        const i = Data.el(t, name);
        const types = ['', '묘사', '루틴', '경험', '비교', '이슈'];
        const roles = Data.roles(t, name);
        // 역할이 둘 이상이고 다음 후보가 다르면 장면을 나눠서 받습니다
        const split = roles.length > 1 && new Set(roles.map(r => r.next.join())).size > 1;
        const sceneField = (id, label, val) => `<div class="field mb-2"><label>${label}</label><textarea id="${id}" rows="2" placeholder="이 질문의 기호가 다음 후보들의 기호와 얽히는 한 장면">${U.esc(val)}</textarea></div>`;
        const roleText = r => `${Data.roleLabel(r.role)} → ${r.next.join(' / ')}`;
        UI.modal(`
            <h3 class="text-lg font-bold mb-1">${U.esc(t.name)} · ${U.esc(name)}</h3>
            ${i.orig ? `<p class="text-sm muted mb-2">교재 원문: ${U.esc(i.orig)} ${i.level ? '· ' + U.esc(i.level) : ''}</p>` : ''}
            <p class="text-sm mb-3">${roles.length ? roles.map(r => `<span class="chip chip-blue">${U.esc(roleText(r))}</span>`).join(' ') : '<span class="chip">마지막에만 나옴 (장면 불필요)</span>'}</p>
            <div class="grid grid-cols-4 gap-2 mb-2">
                <div class="field"><label>위치 번호</label><input id="xNo" type="number" min="1" value="${i.locusNo}"></div>
                <div class="field col-span-3"><label>위치 (방 안의 실제 물건·자리)</label><input id="xLocus" value="${U.esc(i.locus)}" placeholder="예: 소파 위 쿠션"></div>
            </div>
            <div class="grid grid-cols-2 gap-2 mb-2">
                <div class="field"><label>기호 (이 질문을 뜻하는 물건)</label><input id="xSym" value="${U.esc(i.symbol)}" placeholder="예: 벽시계"></div>
                <div class="field"><label>신호어 (영어 질문 속 단서)</label><input id="xSig" value="${U.esc(i.signal)}" placeholder="예: as a child"></div>
            </div>
            <div class="field mb-2"><label>연결 (위치와 기호를 한 그림으로 묶는 서술)</label><textarea id="xLink" rows="2" placeholder="예: 소파 위 쿠션을 들추자 그 밑에 빛바랜 가족사진이 깔려 있다">${U.esc(i.link)}</textarea></div>
            ${!roles.length ? '' : split
                ? sceneField('xSc1', `장면 · ${U.esc(roleText(roles.find(r => r.role === '1') || roles[0]))}`, i.scene1 || i.scene) + sceneField('xSc2', `장면 · ${U.esc(roleText(roles.find(r => r.role === '2') || roles[1]))}`, i.scene2)
                : sceneField('xSc', `가리키는 장면 · ${U.esc(roles.map(roleText).join(' · '))}`, i.scene || i.scene1 || i.scene2)}
            <div class="field mb-2"><label>영어 키워드 (쉼표)</label><input id="xK" value="${U.esc(i.K)}"></div>
            <div class="grid grid-cols-2 gap-2 mb-2">
                <div class="field"><label>답변 Q번호</label><input id="xAns" value="${U.esc(i.answerRaw)}" placeholder="Q001, Q002 / 일부 Q003"></div>
                <div class="field"><label>질문 유형</label><select id="xType">${types.map(x => `<option value="${x}" ${i.type === x ? 'selected' : ''}>${x || '(미지정)'}</option>`).join('')}</select></div>
            </div>
            <div class="field mb-4"><label>메모</label><input id="xMemo" value="${U.esc(i.memo)}"></div>
            <div class="flex justify-end gap-2"><button class="btn btn-gray" data-x="0">취소</button><button class="btn btn-primary" data-x="1">저장</button></div>
        `, (m, close) => {
            m.onclick = e => {
                const b = e.target.closest('[data-x]'); if (!b) return;
                if (b.dataset.x === '1') {
                    const v = id => { const x = m.querySelector('#' + id); return x ? x.value.trim() : null; };
                    const locus = v('xLocus');
                    const values = {
                        유형: v('xType'), 답변: v('xAns'),
                        위치: locus ? `${v('xNo') || i.locusNo}. ${locus}` : '',
                        기호: v('xSym'), 연결: v('xLink'), 신호: v('xSig'), K: v('xK'), 메모: v('xMemo')
                    };
                    if (v('xSc') !== null) values['장면'] = v('xSc');
                    if (v('xSc1') !== null) { values['장면1'] = v('xSc1'); values['장면2'] = v('xSc2'); if (i.scene) values['장면'] = ''; }
                    Data.updateEl(t, name, values);
                    UI.toast('저장했습니다');
                    if (onSaved) onSaved();
                }
                close();
            };
        });
    }
};

// ---------------- 표현 ----------------
Lib.renderExpr = (body) => {
    const q = (Lib.exprSearch || '').toLowerCase();
    const list = Data.expressions.filter(x => !q || (x.en + ' ' + x.ko + ' ' + x.topic).toLowerCase().includes(q));
    const byTopic = {}; list.forEach(x => (byTopic[x.topic] = byTopic[x.topic] || []).push(x));
    body.innerHTML = `
        <div class="field mb-3"><input id="exSearch" placeholder="표현 검색" value="${U.esc(Lib.exprSearch || '')}"></div>
        <p class="text-xs muted mb-2">교재 14개 주제의 필수 표현 ${Data.expressions.length}개. 드릴 > 블록 카드에서 외울 수 있습니다.</p>
        ${Object.entries(byTopic).map(([t, xs]) => `<div class="sec-title">${U.esc(t)} (${xs.length})</div>
            <div class="card text-sm space-y-1">${xs.map(x => `<div class="flex items-center gap-2"><button class="icon-btn" style="width:32px;height:32px" ${UI.say(x.en)}><i class="fas fa-volume-high"></i></button><span class="font-medium">${U.esc(x.en)}</span><span class="muted">${U.esc(x.ko)}</span></div>`).join('')}</div>`).join('')}`;
    const s = body.querySelector('#exSearch');
    s.oninput = () => { Lib.exprSearch = s.value; clearTimeout(Lib._t2); Lib._t2 = setTimeout(() => { Lib.renderExpr(body); const x = body.querySelector('#exSearch'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 250); };
};
