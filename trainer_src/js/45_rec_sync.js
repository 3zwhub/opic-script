// =========================================================================
//  녹음 (MediaRecorder → IndexedDB). 30일 · 최대 300개, 별표는 보존
// =========================================================================
const Rec = {
    stream: null, mr: null, chunks: [], startedAt: 0, mime: '',

    supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); },

    async start() {
        if (!this.supported()) throw new Error('이 브라우저는 녹음을 지원하지 않습니다');
        TTS.stop(false);
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
        this.mime = types.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
        this.mr = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime } : undefined);
        this.chunks = [];
        this.mr.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
        this.mr.start(1000);
        this.startedAt = performance.now();
    },

    elapsed() { return this.mr && this.mr.state === 'recording' ? (performance.now() - this.startedAt) / 1000 : 0; },
    isRecording() { return !!(this.mr && this.mr.state === 'recording'); },

    stop() {
        return new Promise(res => {
            if (!this.mr || this.mr.state === 'inactive') { res(null); return; }
            const durationSec = (performance.now() - this.startedAt) / 1000;
            this.mr.onstop = () => {
                const blob = new Blob(this.chunks, { type: this.mime || 'audio/webm' });
                this.release();
                res({ blob, durationSec, mime: this.mime });
            };
            this.mr.stop();
        });
    },

    cancel() { if (this.mr && this.mr.state !== 'inactive') { this.mr.onstop = () => this.release(); this.mr.stop(); } else this.release(); },
    release() { if (this.stream) this.stream.getTracks().forEach(t => t.stop()); this.stream = null; this.mr = null; this.chunks = []; },

    async save(meta, result) {
        const rec = {
            createdAt: Date.now(), date: U.today(), starred: false, checklist: null,
            durationSec: Math.round(result.durationSec), mime: result.mime, blob: result.blob, ...meta
        };
        rec.id = await DB.put('recordings', rec);
        return rec;
    },

    async prune() {
        const all = await DB.all('recordings');
        const cutoff = Date.now() - RECORDING_KEEP_DAYS * 864e5;
        let removed = 0;
        for (const r of all) if (!r.starred && r.createdAt < cutoff) { await DB.del('recordings', r.id); removed++; }
        const left = (await DB.all('recordings')).filter(r => !r.starred).sort((a, b) => a.createdAt - b.createdAt);
        while (left.length > RECORDING_MAX) { await DB.del('recordings', left.shift().id); removed++; }
        return removed;
    }
};

// =========================================================================
//  클라우드 동기화 (내용만). 기존 앱과 같은 방 코드·경로를 써서 답변 파일을 공유합니다.
//  콤보 데이터는 기존 앱이 읽지 않도록 별도 컬렉션(room_<코드>__trainer)에 둡니다.
// =========================================================================
const Sync = {
    id: '', fs: null, db: null, user: null, unsubs: [], status: 'off', lastError: '',

    init() {
        this.id = U.lsGet(LS.syncId, null) ?? (localStorage.getItem('scriptBrowserSyncId') || '');
        if (this.id) this.connect();
    },

    async connect() {
        this.status = 'connecting'; UI.refreshSyncBadge();
        try {
            const [appMod, authMod, fs] = await Promise.all([
                import(`${FIREBASE_SDK}/firebase-app.js`),
                import(`${FIREBASE_SDK}/firebase-auth.js`),
                import(`${FIREBASE_SDK}/firebase-firestore.js`)
            ]);
            this.fs = fs;
            const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(USER_FIREBASE_CONFIG);
            const auth = authMod.getAuth(app);
            this.db = fs.getFirestore(app);
            await authMod.signInAnonymously(auth);
            authMod.onAuthStateChanged(auth, user => { this.user = user; if (user) this.listen(); });
        } catch (e) {
            console.error('동기화 연결 실패', e);
            this.status = 'error'; this.lastError = e.message; UI.refreshSyncBadge();
        }
    },

    setRoom(code) {
        this.id = code.trim(); U.lsSet(LS.syncId, this.id);
        this.unsubs.forEach(u => u()); this.unsubs = [];
        Data.setCloudFiles([]);
        if (!this.id) { this.status = 'off'; UI.refreshSyncBadge(); return; }
        if (this.user) this.listen(); else this.connect();
    },

    filesCol() { return this.fs.collection(this.db, 'artifacts', SYNC_APP_ID, 'public', 'data', 'room_' + this.id); },
    combosDoc() { return this.fs.doc(this.db, 'artifacts', SYNC_APP_ID, 'public', 'data', 'room_' + this.id + '__trainer', 'combos'); },

    listen() {
        if (!this.user || !this.id || !this.fs) return;
        this.unsubs.forEach(u => u()); this.unsubs = [];
        this.unsubs.push(this.fs.onSnapshot(this.filesCol(), snap => {
            const files = []; snap.forEach(d => { const v = d.data(); if (v && Array.isArray(v.scripts)) files.push(v); });
            files.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            Data.setCloudFiles(files);
            this.status = 'on'; UI.refreshSyncBadge(); UI.onDataChanged('files');
        }, err => { this.status = 'error'; this.lastError = err.message; UI.refreshSyncBadge(); }));

        this.unsubs.push(this.fs.onSnapshot(this.combosDoc(), d => {
            if (!d.exists()) {
                // 방에 콤보가 아직 없으면 이 기기의 것을 올립니다
                this.pushCombos(Data.combosText(), Data.combosUpdatedAt || Date.now());
                return;
            }
            const v = d.data();
            if (v && v.text && (v.updatedAt || 0) > (Data.combosUpdatedAt || 0)) {
                Data.replaceCombosText(v.text, true, v.updatedAt);
                UI.onDataChanged('combos');
                UI.toast('다른 기기에서 바꾼 콤보 데이터를 불러왔습니다');
            } else if ((v.updatedAt || 0) < (Data.combosUpdatedAt || 0)) {
                this.pushCombos(Data.combosText(), Data.combosUpdatedAt);
            }
        }, err => console.warn('콤보 동기화 오류 (방 규칙이 막고 있을 수 있음)', err)));
    },

    async pushFile(file) {
        if (!this.user || !this.id || !this.fs) { UI.toast('동기화가 꺼져 있어 저장하지 못했습니다'); return; }
        const { origin, ...plain } = file;
        try { await this.fs.setDoc(this.fs.doc(this.filesCol(), file.fileId), plain); }
        catch (e) { console.error(e); UI.toast('클라우드 저장 실패: ' + e.message); }
    },
    async deleteFile(fileId) {
        if (!this.user || !this.fs) return;
        try { await this.fs.deleteDoc(this.fs.doc(this.filesCol(), fileId)); } catch (e) { console.error(e); }
    },
    async pushCombos(text, at) {
        if (!this.user || !this.id || !this.fs) return;
        try { await this.fs.setDoc(this.combosDoc(), { text, updatedAt: at }); }
        catch (e) { console.warn('콤보 업로드 실패', e); }
    }
};
