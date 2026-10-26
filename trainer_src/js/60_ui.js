// =========================================================================
//  화면 공통: 라우터, 토스트, 모달, 설정, 답변 패널
// =========================================================================
const Views = {};

const UI = {
    el: null, teardowns: [], urls: [], busy: false, sayMap: new Map(), saySeq: 0,

    init() {
        this.el = document.getElementById('view');
        document.getElementById('tabbar').onclick = e => {
            const b = e.target.closest('[data-tab]'); if (!b) return;
            if (UI.busy && !confirm('진행 중인 훈련을 멈추고 이동할까요?')) return;
            UI.busy = false;
            location.hash = '#/' + b.dataset.tab;
        };
        document.getElementById('backBtn').onclick = () => {
            if (UI.busy && !confirm('진행 중인 훈련을 멈추고 나갈까요?')) return;
            UI.busy = false; history.back();
        };
        document.getElementById('settingsBtn').onclick = () => UI.openSettings();
        document.getElementById('ttsStopTop').onclick = () => TTS.stop(false);
        window.addEventListener('hashchange', () => this.render());

        // 전역: [data-say] 버튼은 등록된 문장을 읽습니다 (같은 버튼을 다시 누르면 정지)
        document.addEventListener('click', e => {
            const b = e.target.closest('[data-say]'); if (!b) return;
            e.preventDefault();
            const id = b.dataset.say;
            if (TTS.state !== 'idle' && TTS.ctx && TTS.ctx.sayId === id) { TTS.stop(false); return; }
            const text = this.sayMap.get(id); if (!text) return;
            TTS.play(text, 'once', { sayId: id, title: text.slice(0, 40) });
        });
        TTS.on(state => {
            document.querySelectorAll('[data-say]').forEach(b => {
                const active = state !== 'idle' && TTS.ctx && TTS.ctx.sayId === b.dataset.say;
                b.classList.toggle('playing', active && (b.classList.contains('sentence') || b.classList.contains('kw-chip')));
                const icon = b.querySelector(':scope > i'); if (!icon) return;
                icon.className = active ? (state === 'loading' ? 'fas fa-spinner fa-spin' : 'fas fa-stop') : (b.dataset.icon || 'fas fa-volume-high');
            });
            // 키워드 칩으로 재생할 때 그 문장 줄 전체도 표시합니다
            document.querySelectorAll('[data-say-row]').forEach(r => r.classList.toggle('playing', state !== 'idle' && !!TTS.ctx && TTS.ctx.sayId === r.dataset.sayRow));
        });
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') TTS.recover(); });
        window.addEventListener('focus', () => TTS.recover());
    },

    // 읽을 문장을 등록하고 버튼 속성을 돌려줍니다
    say(text, icon = 'fas fa-volume-high') {
        const id = 's' + (++this.saySeq); this.sayMap.set(id, text);
        return `data-say="${id}" data-icon="${icon}"`;
    },

    parseHash() {
        const h = decodeURIComponent((location.hash || '#/today').slice(2));
        const parts = h.split('/').filter(Boolean);
        return { tab: parts[0] || 'today', parts: parts.slice(1) };
    },

    render() {
        this.teardown();
        const { tab, parts } = this.parseHash();
        document.querySelectorAll('#tabbar [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
        const fn = Views[tab] || Views.today;
        this.el.scrollTop = 0;
        const fail = e => { console.error(e); this.el.innerHTML = `<div class="wrap"><div class="card text-red-600">화면을 그리지 못했습니다: ${U.esc(e.message)}</div></div>`; };
        try { return Promise.resolve(fn(this.el, parts)).catch(fail); }
        catch (e) { fail(e); return Promise.resolve(); }
    },

    title(text, back = false) {
        document.getElementById('pageTitle').textContent = text;
        document.getElementById('backBtn').classList.toggle('hidden', !back);
    },

    onTeardown(fn) { this.teardowns.push(fn); },
    teardown() {
        this.teardowns.splice(0).forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
        this.urls.splice(0).forEach(u => URL.revokeObjectURL(u));
        this.sayMap.clear();
        if (Rec.isRecording()) Rec.cancel();
        TTS.stop(false);
        this.busy = false;
    },

    audioUrl(blob) { const u = URL.createObjectURL(blob); this.urls.push(u); return u; },

    // 다른 기기에서 데이터가 바뀌었을 때: 훈련 중이 아니면 지금 화면을 다시 그립니다
    onDataChanged() { if (!this.busy && !document.querySelector('.modal')) this.render(); },

    // 화면 안의 [data-act] 버튼을 한곳에서 처리합니다
    bind(root, handlers) {
        root.onclick = e => {
            const b = e.target.closest('[data-act]'); if (!b || !root.contains(b)) return;
            const fn = handlers[b.dataset.act]; if (fn) fn(b, e);
        };
    },

    toast(msg) {
        const t = document.getElementById('toast');
        t.textContent = msg; t.classList.add('show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
    },

    modal(html, onMount) {
        const root = document.getElementById('modalRoot');
        const bg = document.createElement('div'); bg.className = 'modal-bg';
        bg.innerHTML = `<div class="modal" role="dialog">${html}</div>`;
        root.appendChild(bg);
        const close = () => bg.remove();
        bg.addEventListener('click', e => { if (e.target === bg) close(); });
        if (onMount) onMount(bg.querySelector('.modal'), close);
        return close;
    },

    confirm(title, msg, okText = '확인', danger = false) {
        return new Promise(res => {
            this.modal(`
                <h3 class="text-lg font-bold mb-2">${U.esc(title)}</h3>
                <p class="text-sm text-gray-600 mb-5 whitespace-pre-line">${U.esc(msg)}</p>
                <div class="flex justify-end gap-2">
                    <button class="btn btn-gray" data-r="0">취소</button>
                    <button class="btn ${danger ? 'btn-red' : 'btn-primary'}" data-r="1">${U.esc(okText)}</button>
                </div>`, (m, close) => {
                m.onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; close(); res(b.dataset.r === '1'); };
            });
        });
    },

    refreshSyncBadge() {
        const b = document.getElementById('syncBadge'); if (!b) return;
        const map = { off: ['오프라인', 'chip'], connecting: ['연결 중', 'chip chip-amber'], on: [Sync.id, 'chip chip-blue'], error: ['오류', 'chip chip-red'] };
        const [text, cls] = map[Sync.status] || map.off;
        b.className = cls; b.textContent = text;
    },

    // ---------------- 설정 ----------------
    openSettings() {
        const s = Settings.v;
        const engineOpts = [['edge', 'Edge TTS (미리 만든 음성 우선)'],['browser', '내장 음성']];
        const voiceHtml = engine => voiceOptions(engine).map(o => `<option value="${U.esc(o.value)}" ${o.value === currentVoice(engine) ? 'selected' : ''}>${U.esc(o.text)}</option>`).join('') || '<option value="">음성 없음</option>';
        this.modal(`
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-bold">설정</h3>
                <button class="icon-btn" data-close><i class="fas fa-xmark"></i></button>
            </div>
            <div class="sec-title" style="margin-top:0">음성 (TTS)</div>
            <div class="grid grid-cols-2 gap-3">
                <div class="field"><label>엔진</label><select id="setEngine">${engineOpts.map(([v, t]) => `<option value="${v}" ${s.engine === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
                <div class="field"><label>속도</label><select id="setRate">${['0.7', '0.85', '1', '1.15'].map(r => `<option value="${r}" ${s.rate === r ? 'selected' : ''}>${r}x</option>`).join('')}</select></div>
                <div class="field col-span-2"><label>성우</label><select id="setVoice">${voiceHtml(s.engine)}</select></div>
            </div>
            <label class="flex items-center gap-2 mt-3 text-sm"><input type="checkbox" id="setAutoQ" ${s.autoQuestion ? 'checked' : ''}> 문항이 나오면 질문을 자동으로 읽기</label>
            <label class="flex items-center gap-2 mt-2 text-sm"><input type="checkbox" id="setPredict" ${s.predictInDrill !== false ? 'checked' : ''}> 드릴에서 답한 뒤 "다음 질문 예상" 단계 넣기</label>
            <button class="btn btn-soft mt-3 w-full" id="setTest"><i class="fas fa-play"></i> 음성 테스트</button>
            <p class="text-xs muted mt-2" id="setTtsStatic">미리 만든 음성 확인 중…</p>
            <button class="btn btn-gray mt-2 w-full text-sm" id="setTtsExport"><i class="fas fa-file-export"></i> 음성 문장 목록 내보내기 (mp3 만들기용)</button>

            <div class="sec-title">동기화 (내용만: 답변 파일 · 콤보 데이터)</div>
            <div class="flex items-center gap-2 mb-2 text-sm">상태: <span id="syncBadge" class="chip">오프라인</span></div>
            <div class="flex gap-2">
                <div class="field flex-1"><input id="setRoom" placeholder="방 코드 (기존 앱과 같은 코드)" value="${U.esc(Sync.id)}"></div>
                <button class="btn btn-primary" id="setRoomBtn">연결</button>
            </div>
            <p class="text-xs muted mt-1">진도·녹음은 이 기기에만 저장됩니다.</p>

            <div class="sec-title">커리큘럼 단계</div>
            <div class="field"><select id="setStage">${STAGES.map(st => `<option value="${st.n}" ${s.stage === st.n ? 'selected' : ''}>${st.n}단계 · ${st.name}</option>`).join('')}</select></div>
            <p class="text-xs muted mt-1">보통은 통과 기준을 달성하면 '오늘' 화면에서 올라갑니다. 여기서는 직접 바꿀 수 있습니다.</p>

            <div class="sec-title">데이터</div>
            <div class="grid grid-cols-2 gap-2">
                <button class="btn btn-gray" id="setExport"><i class="fas fa-download"></i> combos.txt 내보내기</button>
                <label class="btn btn-gray cursor-pointer"><i class="fas fa-upload"></i> combos.txt 가져오기<input type="file" accept=".txt" id="setImport" class="hidden"></label>
                <button class="btn btn-gray" id="setResetCombos">콤보 내장본으로</button>
                <button class="btn btn-gray text-red-600" id="setResetProgress">진도 초기화</button>
            </div>
            <p class="text-xs muted mt-2" id="setStorageInfo"></p>
        `, (m, close) => {
            this.refreshSyncBadge();
            const $ = id => m.querySelector('#' + id);
            m.querySelector('[data-close]').onclick = close;
            $('setEngine').onchange = () => { Settings.set('engine', $('setEngine').value); TTS.stop(false); $('setVoice').innerHTML = voiceHtml(Settings.v.engine); };
            $('setVoice').onchange = () => { Settings.v.voices[Settings.v.engine] = $('setVoice').value; Settings.save(); TTS.stop(false); showStatic(); };
            $('setRate').onchange = () => { Settings.set('rate', $('setRate').value); TTS.stop(false); };
            $('setAutoQ').onchange = () => Settings.set('autoQuestion', $('setAutoQ').checked);
            $('setPredict').onchange = () => Settings.set('predictInDrill', $('setPredict').checked);
            $('setTest').onclick = () => TTS.play(TTS_SAMPLE, 'once');
            const showStatic = () => TtsStatic.status(currentVoice('edge')).then(r => {
                const el = $('setTtsStatic'); if (!el) return;
                if (!r.available) { el.textContent = '미리 만든 음성: 없음 (Netlify 주소로 열었을 때만 쓰입니다)'; return; }
                const name = currentVoice('edge').replace(/^en-\w+-|Neural$/g, '');
                el.textContent = r.ready
                    ? `미리 만든 음성(${name}): ${r.ready}/${r.total} 문장 준비됨${r.ready < r.total ? ' · 스크립트가 바뀌었다면 목록을 내보내 mp3를 새로 만드세요' : ''}`
                    : `미리 만든 음성: 이 성우(${name})는 아직 없습니다`;
            });
            showStatic();
            $('setTtsExport').onclick = () => { U.download('tts_texts.json', JSON.stringify(TtsStatic.exportData(), null, 1)); this.toast('tts_texts.json을 저장했습니다'); };
            $('setRoomBtn').onclick = () => { Sync.setRoom($('setRoom').value); this.toast(Sync.id ? `'${Sync.id}' 방에 연결합니다` : '동기화를 껐습니다'); };
            $('setStage').onchange = () => { Settings.set('stage', Number($('setStage').value)); this.render(); };
            $('setExport').onclick = () => U.download('combos.txt', Data.combosText());
            $('setImport').onchange = async e => {
                const f = e.target.files[0]; if (!f) return;
                const r = Data.replaceCombosText(await U.readFile(f));
                if (!r.ok) { this.toast('가져오기 실패: ' + r.errors[0]); return; }
                this.toast(r.errors.length ? `가져왔습니다 (확인할 것 ${r.errors.length}건, 자료실 > 콤보 데이터 참고)` : 'combos.txt를 가져왔습니다');
                close(); this.render();
            };
            $('setResetCombos').onclick = async () => {
                if (!await this.confirm('콤보 내장본으로 되돌리기', '앱에서 입력한 위치·장면·키워드가 모두 사라집니다. 먼저 내보내기를 권합니다.', '되돌리기', true)) return;
                Data.replaceCombosText(Data.seed('seed-combos')); close(); this.render(); this.toast('내장본으로 되돌렸습니다');
            };
            $('setResetProgress').onclick = async () => {
                if (!await this.confirm('진도 초기화', '복습 일정, 훈련 기록, 녹음이 모두 지워집니다. 되돌릴 수 없습니다.', '모두 지우기', true)) return;
                await DB.clear('cards'); await DB.clear('sessions'); await DB.clear('recordings'); SRS.cards.clear();
                close(); this.render(); this.toast('진도를 초기화했습니다');
            };
            if (navigator.storage && navigator.storage.estimate) {
                navigator.storage.estimate().then(est => { $('setStorageInfo').textContent = `이 기기 사용량: 약 ${Math.round((est.usage || 0) / 1048576)}MB · 녹음은 ${RECORDING_KEEP_DAYS}일 · 최대 ${RECORDING_MAX}개 보관 (별표는 보존)`; });
            }
        });
    },

    // ---------------- 답변 패널 (문장 단위 TTS) ----------------
    answerHtml(script, { showQuestion = true, showKeywords = true } = {}) {
        if (!script) return '<p class="missing">연결된 모범답변이 없습니다</p>';
        const sents = U.sentences(script.answer);
        const kw = (script.keywords || '').split(',').map(k => k.trim()).filter(Boolean);
        return `
            ${showQuestion ? `<div class="text-xs muted mb-1">${U.esc(script.id)} · ${U.esc(script.title)}</div>
            ${Parse.hasQuestion(script) ? `<p class="font-medium mb-3">${U.esc(script.question)}</p>` : ''}` : ''}
            ${showKeywords && kw.length ? `<div class="flex flex-wrap gap-1 mb-3">${kw.map(k => `<span class="chip">${U.esc(k)}</span>`).join('')}</div>` : ''}
            <div class="flex items-center gap-2 mb-2">
                <button class="btn btn-soft text-sm" ${this.say(script.answer, 'fas fa-play')}><i class="fas fa-play"></i> 전체 듣기</button>
                <span class="text-xs muted">문장을 누르면 그 문장만 읽습니다</span>
            </div>
            <div class="answer-text">${sents.map((s, i) => `<span class="sentence" ${this.say(s, '')}><span class="sentence-num">${U.circled(i + 1)}</span>${U.esc(s)}</span>`).join('')}</div>`;
    },

    // 녹음 길이 표시용 색
    durClass(sec) { return sec < ANSWER_TARGET.min ? 'under' : sec <= ANSWER_TARGET.max ? 'good' : 'over'; },
    durChip(sec) {
        const c = this.durClass(sec);
        return `<span class="chip ${c === 'good' ? 'chip-green' : c === 'over' ? 'chip-amber' : ''}">${U.fmtSec(sec)}</span>`;
    }
};
