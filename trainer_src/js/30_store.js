// =========================================================================
//  저장소
//  - Data: 내용 데이터(콤보, 답변 파일, 표현). localStorage + 클라우드 동기화 대상
//  - DB:   진도 데이터(카드, 녹음, 세션). IndexedDB, 기기별 저장
//  - SRS:  간격 반복 계산
// =========================================================================
const LS = {
    combos: 'opicTrainer.combosText', combosAt: 'opicTrainer.combosUpdatedAt', seedHash: 'opicTrainer.seedHash',
    files: 'opicTrainer.files', active: 'opicTrainer.activeFile',
    settings: 'opicTrainer.settings', syncId: 'opicTrainer.syncId'
};

// 문장 키워드: 키워드_문장.txt 의 문장 번호를 내장 답변의 문장 내용에 묶어 둡니다.
// 그래서 다른 답변 파일이라도 같은 문장이면 키워드가 보이고, 문장을 고치면 그 문장의 키워드만 빠집니다.
const Kw = {
    byId: new Map(),      // 'Q001' → { sent: Map(문장 → [키워드]), edges }
    any: new Map(),       // 문장 → [키워드] (번호가 다른 스크립트용)
    byAnswer: new Map(),  // 답변 전체 → 'Q001' (답변이 똑같은 Q002 등)

    norm(s) { return String(s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[—–]/g, '-').replace(/\s+/g, ' ').trim(); },

    init(seedScripts, text) {
        this.byId.clear(); this.any.clear(); this.byAnswer.clear();
        const blocks = Parse.sentKeywords(text);
        seedScripts.forEach(s => {
            const a = this.norm(s.answer);
            if (a && !this.byAnswer.has(a)) this.byAnswer.set(a, s.id);
            const b = blocks[s.id]; if (!b) return;
            const sents = U.sentences(s.answer), sent = new Map();
            Object.entries(b.lines).forEach(([n, kws]) => {
                const t = sents[n - 1]; if (!t) return;
                sent.set(this.norm(t), kws);
                if (!this.any.has(this.norm(t))) this.any.set(this.norm(t), kws);
            });
            this.byId.set(s.id, { sent, edges: b.edges });
            if (a && this.byAnswer.get(a) !== s.id && !blocks[this.byAnswer.get(a)]) this.byAnswer.set(a, s.id);
        });
    },

    // { sents: [{ text, kws }], edges: [[A, B, 관계]] } — 키워드는 지금 문장에 실제로 있는 것만
    forScript(s) {
        const block = this.byId.get(s.id) || this.byId.get(this.byAnswer.get(this.norm(s.answer)));
        const sents = U.sentences(s.answer).map(text => {
            const n = this.norm(text);
            const kws = ((block && block.sent.get(n)) || this.any.get(n) || []).filter(k => n.includes(this.norm(k)));
            return { text, kws };
        });
        const have = new Set(sents.flatMap(x => x.kws.map(k => this.norm(k))));
        const edges = block ? block.edges.filter(([a, b]) => have.has(this.norm(a)) && have.has(this.norm(b))) : [];
        return { sents, edges };
    }
};

const Data = {
    model: null, combosUpdatedAt: 0,
    files: [],            // [{ fileId, fileName, scripts, updatedAt, origin: 'builtin'|'local'|'cloud' }]
    cloudFiles: [],
    activeFileId: 'builtin',
    byKey: new Map(),     // 'Q001' → 스크립트 (훈련에 쓰는 답변 파일 기준)
    expressions: [],

    seed(id) { const el = document.getElementById(id); return el ? el.textContent : ''; },

    init() {
        const text = localStorage.getItem(LS.combos);
        this.combosUpdatedAt = U.lsGet(LS.combosAt, 0);
        // 내장본(빌드할 때 넣은 combos.txt)이 바뀌었는지 확인합니다
        const seedText = this.seed('seed-combos'), seedHash = U.hash(seedText), prevSeed = U.lsGet(LS.seedHash, null);
        this.seedChanged = false;
        if (prevSeed !== seedHash) {
            if (text !== null && text !== seedText) this.seedChanged = true;   // 앱에서 고친 내용이 있음 → 오늘 화면에서 물어봄
            else if (prevSeed) { this.combosUpdatedAt = Date.now(); U.lsSet(LS.combosAt, this.combosUpdatedAt); }   // 고친 것 없음 → 새 내장본이 클라우드의 옛것보다 앞서도록
            if (!this.seedChanged) U.lsSet(LS.seedHash, seedHash);
        }
        this.model = Parse.combos(text !== null && this.seedChanged ? text : (text !== null && prevSeed === seedHash ? text : seedText));

        const saved = U.lsGet(LS.files, null);
        if (Array.isArray(saved) && saved.length) {
            this.files = saved.filter(f => f.origin !== 'cloud');
        } else {
            this.files = [];
        }
        const seedScripts = Parse.scripts(this.seed('seed-answers'));
        const builtin = this.files.find(f => f.origin === 'builtin');
        if (!builtin) {
            this.files.unshift({ fileId: 'builtin', fileName: '일반_260727_1_edited.txt', scripts: seedScripts, updatedAt: 0, origin: 'builtin' });
        } else {
            // 예전에 저장된 내장본: 키워드(K)가 비어 있는 스크립트만 새 내장본의 키워드로 채웁니다
            const seedK = new Map(seedScripts.map(s => [s.id, s.keywords]));
            builtin.scripts.forEach(s => { if (!s.keywords && seedK.get(s.id)) s.keywords = seedK.get(s.id); });
        }
        Kw.init(seedScripts, this.seed('seed-keywords'));
        this.activeFileId = U.lsGet(LS.active, 'builtin');
        // 표현 모음도 combos.txt의 주제 순서로 정렬 (같은 주제 안에서는 원래 순서 유지)
        const rank = name => { const i = this.model.topics.findIndex(t => t.name === name); return i < 0 ? 999 : i; };
        this.expressions = Parse.expressions(this.seed('seed-expressions')).map((x, i) => ({ x, i }))
            .sort((a, b) => rank(a.x.topic) - rank(b.x.topic) || a.i - b.i).map(o => o.x);
        this.reindex();
    },

    allFiles() { return [...this.files, ...this.cloudFiles]; },
    file(id) { return this.allFiles().find(f => f.fileId === id); },
    activeFile() { return this.file(this.activeFileId) || this.files[0]; },

    reindex() {
        this.byKey = new Map();
        const f = this.activeFile();
        (f ? f.scripts : []).forEach(s => { if (s.key || s.id) this.byKey.set(s.key || s.id, s); });
    },

    saveFiles() {
        U.lsSet(LS.files, this.files);
        U.lsSet(LS.active, this.activeFileId);
    },

    setActiveFile(id) { this.activeFileId = id; this.saveFiles(); this.reindex(); },

    setCloudFiles(list) {
        this.cloudFiles = list.map(f => ({ ...f, origin: 'cloud', scripts: (f.scripts || []).map(s => ({ ...s, key: s.key || s.id })) }));
        this.reindex();
    },

    // 파일 하나가 바뀌었을 때: 로컬이면 저장, 클라우드면 업로드
    commitFile(file) {
        file.updatedAt = Date.now();
        if (file.origin === 'cloud') Sync.pushFile(file); else this.saveFiles();
        if (file.fileId === this.activeFileId) this.reindex();
    },

    // ---------------- 콤보 ----------------
    saveCombos(fromCloud = false, at = Date.now()) {
        const text = Parse.serializeCombos(this.model);
        localStorage.setItem(LS.combos, text);
        this.combosUpdatedAt = at; U.lsSet(LS.combosAt, at);
        if (!fromCloud) Sync.pushCombos(text, at);
        return text;
    },
    replaceCombosText(text, fromCloud = false, at = Date.now()) {
        const model = Parse.combos(text);
        if (!model.topics.length) return { ok: false, errors: ['주제(== 줄)를 찾지 못했습니다'] };
        this.model = model;
        this.saveCombos(fromCloud, at);
        return { ok: true, errors: model.errors };
    },
    combosText() { return Parse.serializeCombos(this.model); },
    // 새 내장본을 적용하거나(apply) 지금 것을 유지(keep)하고 안내를 닫습니다
    resolveSeed(apply) {
        if (apply) this.replaceCombosText(this.seed('seed-combos'));
        U.lsSet(LS.seedHash, U.hash(this.seed('seed-combos')));
        this.seedChanged = false;
    },

    topics(type) { return this.model.topics.filter(t => !type || this.topicType(t) === type); },
    topic(name) { return this.model.topics.find(t => t.name === name); },
    topicType(t) { return Parse.field(t, '유형') || '서베이'; },
    place(t) { return Parse.field(t, '장소') || '(장소 미정)'; },

    elKey(t, name) { return `el/${t.name}/${name}`; },
    stopKey(t) { return `stop/${t.name}`; },

    el(t, name) {
        const e = t.elements[name] || { name, fields: [] };
        const f = k => Parse.field(e, k);
        const answer = Parse.answerRefs(f('답변'));
        const idx = t.chain.indexOf(name);
        const locusRaw = f('위치');
        const lm = locusRaw.match(/^(\d+)\.\s*(.*)$/);
        return {
            topic: t, name, key: this.elKey(t, name), index: idx,
            type: f('유형'), answer, answerRaw: f('답변'),
            locusNo: lm ? Number(lm[1]) : idx + 1, locus: lm ? lm[2] : locusRaw,
            symbol: f('기호'), link: f('연결'), signal: f('신호'), scene: f('장면'), scene1: f('장면1'), scene2: f('장면2'),
            K: f('K'), memo: f('메모'), orig: f('원문'), level: f('난이도'),
            scripts: answer.refs.map(r => this.byKey.get(r)).filter(Boolean),
            adv1415: /1[45]번 출제/.test(f('메모'))
        };
    },

    // ---------------- 갈림길 트리 (콤보 줄에서 매번 계산, 따로 저장하지 않음) ----------------
    // as1: 3문항 콤보 첫 질문 → 둘째 후보 / as2: 둘째 질문 → 셋째 후보 / pair: 2문항(14·15번) 첫 질문 → 둘째
    // q3by: 둘째 질문의 셋째 후보가 첫 질문에 따라 달라지는 경우를 위한 상세 (첫|둘째 → 셋째 후보)
    tree(t) {
        const order = n => { const i = t.chain.indexOf(n); return i < 0 ? 999 : i; };
        const add = (m, k, v) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(v); };
        const as1 = new Map(), as2 = new Map(), pair = new Map(), q3by = new Map();
        t.combos.forEach(c => {
            if (c.length === 3) { add(as1, c[0], c[1]); add(as2, c[1], c[2]); add(q3by, c[0] + '|' + c[1], c[2]); }
            else if (c.length === 2) add(pair, c[0], c[1]);
        });
        const sort = m => new Map([...m.entries()].sort((a, b) => order(a[0]) - order(b[0])).map(([k, v]) => [k, [...v].sort((a, b) => order(a) - order(b))]));
        return { as1: sort(as1), as2: sort(as2), pair: sort(pair), q3by: sort(q3by) };
    },

    // 노드가 맡는 역할들: [{ role: '1'|'2'|'p', next: [...] }]
    roles(t, name, tree = this.tree(t)) {
        const r = [];
        if (tree.as1.has(name)) r.push({ role: '1', next: tree.as1.get(name) });
        if (tree.as2.has(name)) r.push({ role: '2', next: tree.as2.get(name) });
        if (tree.pair.has(name)) r.push({ role: 'p', next: tree.pair.get(name) });
        return r;
    },
    roleLabel(role) { return { '1': '1번째', '2': '2번째', 'p': '14번' }[role]; },
    forkKey(t, role, name) { return `fork/${t.name}/${role}/${name}`; },

    // 갈림길 카드: 다음 질문이 있는 (노드, 역할) 하나가 카드 하나
    forks(t) {
        const tree = this.tree(t), out = [];
        t.chain.forEach(name => this.roles(t, name, tree).forEach(({ role, next }) => {
            const info = this.el(t, name);
            // 역할이 둘이고 다음 후보가 다르면 장면1/장면2, 아니면 장면
            const scene = (role === '1' && info.scene1) || (role === '2' && info.scene2) || info.scene || info.scene1 || info.scene2;
            const byFirst = role === '2' ? [...tree.q3by.entries()].filter(([k]) => k.split('|')[1] === name).map(([k, v]) => ({ first: k.split('|')[0], next: v })) : [];
            out.push({ key: this.forkKey(t, role, name), t, name, role, next, scene, info, byFirst: byFirst.length > 1 && new Set(byFirst.map(x => x.next.join())).size > 1 ? byFirst : [] });
        }));
        return out;
    },
    allForks(type) { return this.topics(type).flatMap(t => this.forks(t)); },

    // 1층 공통 규칙으로 본 다음 질문 종류 (콤보 113개 중 84/86이 이 순서를 지킴)
    ruleHint(type, role) {
        if (role === 'p') return '공통 규칙: 비교·변화 다음에는 이슈·우려·뉴스';
        if (role === '1') return '공통 규칙: 묘사 다음에는 루틴(평소 하는 일) 또는 과거·비교·경험';
        if (type === '루틴') return '공통 규칙: 루틴 다음에는 과거·비교 또는 경험';
        return '공통 규칙: 과거·비교 다음에는 경험(최근·기억·문제)';
    },

    // 질문 문장: 연결된 답변의 영어 질문 → 교재 원문 → 주제·요소 이름 순서로 고릅니다
    question(info) {
        const s = info.scripts.find(x => Parse.hasQuestion(x));
        const ko = info.orig ? info.orig.split('||')[0].trim() : (info.scripts[0] ? info.scripts[0].title : `${info.topic.name} · ${info.name}`);
        return { en: s ? s.question : '', ko };
    },

    updateEl(t, name, values) {
        const e = t.elements[name] || (t.elements[name] = { name, fields: [] });
        if (!t.elOrder.includes(name)) t.elOrder.push(name);
        const order = ['유형', '답변', '위치', '기호', '연결', '신호', '장면', '장면1', '장면2', 'K', '메모'];
        Object.entries(values).forEach(([k, v]) => {
            const before = order.slice(0, order.indexOf(k));
            Parse.setField(e, k, v, before);
        });
        this.saveCombos();
    },
    updateTopicField(t, key, value) { Parse.setField(t, key, value, ['유형']); this.saveCombos(); },

    // 질문 유형이 비어 있는 요소(대부분 돌발)는 원문 표현으로 추정합니다
    guessType(info) {
        if (info.type) return info.type;
        const s = (info.orig || '') + ' ' + info.name;
        if (/비교|변화|과거.?현재|달라/.test(s)) return '비교';
        if (/뉴스|이슈|우려|걱정|문제점|사건|추세|트렌드/.test(s)) return '이슈';
        if (/경험|기억|최근|처음|어릴|추억|에피소드|계기/.test(s)) return '경험';
        if (/루틴|습관|하는 ?일|평소|방법|사용/.test(s)) return '루틴';
        return '묘사';
    },

    rpScripts() {
        return [...this.byKey.values()].filter(s => /^RP/i.test(s.category));
    }
};

// ---------------- IndexedDB (실패하면 메모리로 동작) ----------------
const DB = {
    db: null, mem: { cards: new Map(), recordings: new Map(), sessions: new Map() }, seq: 1,
    STORES: ['cards', 'recordings', 'sessions'],
    async open() {
        try {
            this.db = await new Promise((res, rej) => {
                const r = indexedDB.open('opicTrainer', 1);
                r.onupgradeneeded = () => {
                    const d = r.result;
                    if (!d.objectStoreNames.contains('cards')) d.createObjectStore('cards', { keyPath: 'key' });
                    if (!d.objectStoreNames.contains('recordings')) d.createObjectStore('recordings', { keyPath: 'id', autoIncrement: true });
                    if (!d.objectStoreNames.contains('sessions')) d.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
                };
                r.onsuccess = () => res(r.result);
                r.onerror = () => rej(r.error);
            });
        } catch (e) {
            console.warn('IndexedDB를 쓸 수 없어 메모리에 저장합니다 (새로고침하면 사라짐)', e);
            this.db = null;
        }
        return !!this.db;
    },
    _req(store, mode, fn) {
        return new Promise((res, rej) => {
            const tx = this.db.transaction(store, mode);
            const r = fn(tx.objectStore(store));
            tx.oncomplete = () => res(r ? r.result : undefined);
            tx.onerror = () => rej(tx.error);
        });
    },
    async put(store, val) {
        if (!this.db) {
            const kp = store === 'cards' ? 'key' : 'id';
            if (val[kp] === undefined) val[kp] = this.seq++;
            this.mem[store].set(val[kp], val); return val[kp];
        }
        return this._req(store, 'readwrite', s => s.put(val));
    },
    async get(store, key) {
        if (!this.db) return this.mem[store].get(key);
        return this._req(store, 'readonly', s => s.get(key));
    },
    async del(store, key) {
        if (!this.db) { this.mem[store].delete(key); return; }
        return this._req(store, 'readwrite', s => s.delete(key));
    },
    async all(store) {
        if (!this.db) return [...this.mem[store].values()];
        return this._req(store, 'readonly', s => s.getAll());
    },
    async clear(store) {
        if (!this.db) { this.mem[store].clear(); return; }
        return this._req(store, 'readwrite', s => s.clear());
    }
};

// ---------------- 간격 반복 ----------------
// 기억남: 레벨 +1 / 헷갈림: 내일 다시 / 모름: 오늘 다시. 레벨별 간격은 SRS_INTERVALS(1·2·4·7·14일)
const SRS = {
    cards: new Map(),
    async load() { (await DB.all('cards')).forEach(c => this.cards.set(c.key, c)); },
    get(k) { return this.cards.get(k); },
    status(k) {
        const c = this.cards.get(k);
        if (!c) return 'new';
        if (c.due <= U.today()) return 'due';
        return (c.streak || 0) >= 2 ? 'known' : 'learning';
    },
    mastered(k) { const c = this.cards.get(k); return !!(c && (c.streak || 0) >= 2); },
    async grade(k, g) {
        const today = U.today();
        const c = this.cards.get(k) || { key: k, level: 0, streak: 0, due: today, history: [] };
        if (g === 'good') { c.level = Math.min(c.level + 1, SRS_INTERVALS.length - 1); c.streak = (c.streak || 0) + 1; c.due = U.today(SRS_INTERVALS[c.level]); }
        else if (g === 'hard') { c.level = Math.max(1, c.level); c.streak = 0; c.due = U.today(1); }
        else { c.level = 0; c.streak = 0; c.due = today; }
        c.last = today;
        c.history = [...(c.history || []), { d: today, g }].slice(-30);
        this.cards.set(k, c);
        await DB.put('cards', c);
        return c;
    },
    dueKeys(keys) { const t = U.today(); return keys.filter(k => { const c = this.cards.get(k); return c && c.due <= t; }); },
    allDue() { const t = U.today(); return [...this.cards.values()].filter(c => c.due <= t).map(c => c.key); }
};

const Settings = {
    v: null,
    load() {
        this.v = Object.assign({ engine: 'edge', rate: '1', voices: {}, stage: 1, autoQuestion: true }, U.lsGet(LS.settings, {}));
        // 기존 앱에서 고른 엔진·성우를 이어받습니다
        if (!localStorage.getItem(LS.settings)) {
            const oldEngine = localStorage.getItem('scriptBrowserEngine');
            if (oldEngine) this.v.engine = oldEngine;
            ['edge', 'browser'].forEach(e => { const v = localStorage.getItem('scriptBrowserVoice_' + e); if (v) this.v.voices[e] = v; });
        }
        if (this.v.engine !== 'browser') this.v.engine = 'edge';   // 없어진 엔진(gemini 등)을 골라 뒀던 경우
    },
    save() { U.lsSet(LS.settings, this.v); },
    set(k, val) { this.v[k] = val; this.save(); }
};
