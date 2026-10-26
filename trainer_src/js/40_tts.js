// =========================================================================
//  TTS 매니저 (기존 스크립트 브라우저에서 이식)
//  - Edge 는 미리 만든 mp3(TtsStatic) → 실시간 Worker → 내장 음성 순서로 시도합니다.
//  - Edge 실시간 호출은 Cloudflare Worker(TTS_PROXY_URL)를 거칩니다.
//  - 엔진은 'edge' | 'browser' 두 가지입니다.
//  - 화면 요소에 직접 묶여 있던 부분만 콜백(ctx)으로 바꿨습니다.
//    ctx = { pickNext(mode) → {text,...}|null, onNext(item), onDone(), title, artist, onSkip(delta) }
// =========================================================================
const TTS = {
    audioEl: null,
    lastBlobUrl: null,
    currentUtterance: null,
    playToken: 0,
    session: 0,     // 정지하거나 다른 항목을 고르면 증가 -> 연속 재생 체인이 끊김
    cache: new Map(),
    plannedNext: null,
    liveDown: {},           // 엔진 → { until, err }: 실패한 실시간 엔진은 잠시 건너뜁니다
    fallbackWarned: false,
    wantPlaying: false,
    currentAdvance: null,
    ctx: null,
    state: 'idle',
    listeners: new Set(),

    on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    emit(state) {
        this.state = state;
        this.listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
        const top = document.getElementById('ttsStopTop');
        if (top) top.classList.toggle('hidden', state === 'idle');
    },

    engine() { return Settings.v.engine || 'browser'; },

    // iOS/안드로이드는 사용자가 직접 누른 순간에만 소리를 낼 수 있습니다.
    // 오디오 엘리먼트 하나를 만들어 끝까지 재사용합니다. (중간에 새로 만들면 백그라운드에서 끊깁니다)
    unlock() {
        if (this.audioEl) return this.audioEl;
        const el = new Audio();
        el.preload = 'auto';
        el.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
        const p = el.play();
        if (p && p.then) p.then(() => { el.pause(); try { el.currentTime = 0; } catch (e) {} }).catch(() => {});
        this.audioEl = el;
        return el;
    },

    idle() {
        this.wantPlaying = false;
        this.emit('idle');
        if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = 'paused'; } catch (e) {} }
        const ctx = this.ctx; this.ctx = null;
        if (ctx && ctx.onDone) ctx.onDone();
    },

    releaseBlob() {
        if (this.lastBlobUrl) { URL.revokeObjectURL(this.lastBlobUrl); this.lastBlobUrl = null; }
    },

    stop(isInternal = false) {
        this.playToken++;   // 진행 중이던 비동기 재생을 모두 무효화
        this.session++;     // 예약된 다음 항목 재생도 취소
        if (this.audioEl) {
            this.audioEl.onended = null;
            this.audioEl.onerror = null;
            try { this.audioEl.pause(); this.audioEl.currentTime = 0; } catch (e) {}
        }
        if (window.speechSynthesis) {
            if (window.speechSynthesis.speaking || window.speechSynthesis.pending) window.speechSynthesis.cancel();
        }
        this.currentUtterance = null;
        if (!isInternal) { this.plannedNext = null; this.currentAdvance = null; this.idle(); }
    },

    /** 앱으로 돌아왔을 때 백그라운드에서 멈춰 있었다면 알아서 이어서 재생합니다. */
    recover() {
        if (!this.wantPlaying) return;
        const el = this.audioEl;
        if (!el || !el.src) return;
        if (el.ended) { if (this.currentAdvance) this.currentAdvance(); }
        else if (el.paused) { el.play().catch(() => {}); }
    },

    // 안드로이드 잠금화면 제어: 크롬이 이 탭을 '미디어 재생 중'으로 인식해 백그라운드 정지가 줄어듭니다
    updateMediaSession() {
        if (!('mediaSession' in navigator)) return;
        const ctx = this.ctx || {};
        try {
            if (window.MediaMetadata) {
                navigator.mediaSession.metadata = new MediaMetadata({ title: ctx.title || 'OPIc 트레이너', artist: ctx.artist || '', album: 'OPIc 트레이너' });
            }
            navigator.mediaSession.playbackState = 'playing';
            const bind = (action, fn) => { try { navigator.mediaSession.setActionHandler(action, fn); } catch (e) {} };
            bind('pause', () => this.stop(false));
            bind('stop', () => this.stop(false));
            bind('nexttrack', ctx.onSkip ? () => ctx.onSkip(1) : null);
            bind('previoustrack', ctx.onSkip ? () => ctx.onSkip(-1) : null);
        } catch (e) {}
    },

    // ---------------- 오디오 받아오기 (캐시 + 미리 받기) ----------------
    cacheKey(text, engine) { return `${engine}|${currentVoice(engine)}|${Settings.v.rate}|${text}`; },

    async fetchAudioBlob(text, engine) {
        if (!TTS_PROXY_URL) throw new Error("TTS_PROXY_URL에 Cloudflare Worker 주소를 넣어주세요.");
        const headers = { "Content-Type": "application/json" };
        if (TTS_PROXY_TOKEN) headers["X-Auth-Token"] = TTS_PROXY_TOKEN;

        const res = await fetchWithTimeout(TTS_PROXY_URL + "/tts", {
            method: "POST", headers,
            body: JSON.stringify({ text, voice: currentVoice('edge'), rate: edgeRateString(), pitch: EDGE_PITCH, gapMs: CHAIN_GAP_MS })
        });
        if (!res.ok) {
            let msg = "HTTP " + res.status;
            try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (e) {}
            throw Object.assign(new Error(msg), { http: res.status });
        }
        const blob = await res.blob();
        if (!blob || blob.size < 100) throw new Error("빈 오디오 응답");
        return blob;
    },

    // 실시간 엔진에서 받아옵니다. 네트워크 오류·시간 초과만 한 번 더 시도하고(서버가 거절한 건 다시 해도 같음),
    // 실패하면 3분 동안은 바로 실패로 처리해 매번 몇 초씩 기다리지 않게 합니다.
    async getAudio(text, engine) {
        const key = this.cacheKey(text, engine);
        if (this.cache.has(key)) return this.cache.get(key);
        const down = this.liveDown[engine];
        if (down && Date.now() < down.until) throw down.err;
        let blob;
        try {
            try { blob = await this.fetchAudioBlob(text, engine); }
            catch (e) { if (e.http) throw e; blob = await this.fetchAudioBlob(text, engine); }
        } catch (e) {
            this.liveDown[engine] = { until: Date.now() + 3 * 60 * 1000, err: e };
            throw e;
        }
        delete this.liveDown[engine];
        this.cache.set(key, blob);
        while (this.cache.size > 8) this.cache.delete(this.cache.keys().next().value);
        return blob;
    },

    // 고른 엔진으로 받을 수 있는 오디오: Edge 는 미리 만든 mp3가 먼저입니다 → { blob, rate } | null(미리 만든 것 없음)
    async getStatic(text, engine) {
        if (engine !== 'edge') return null;
        const blob = await TtsStatic.audio(text, currentVoice('edge')).catch(e => { console.warn('미리 만든 음성 실패', e); return null; });
        return blob ? { blob, rate: parseFloat(Settings.v.rate) || 1 } : null;
    },

    prefetch(text, engine) {
        if (!text || !text.trim()) return;
        if (engine !== 'edge') return;
        this.getStatic(text, engine).then(hit => {
            if (!hit && !this.cache.has(this.cacheKey(text, engine))) this.getAudio(text, engine).catch(() => {});
        });
    },

    // ---------------- 재생 ----------------
    // 한 번 읽고 끝나면 resolve 됩니다 (정지해도 resolve)
    say(text, ctx = {}) {
        return new Promise(res => this.play(text, 'once', { ...ctx, onDone: () => { if (ctx.onDone) ctx.onDone(); res(); } }));
    },

    play(text, mode = 'once', ctx = {}) {
        this.unlock();
        this.stop(true);
        if (this.ctx && this.ctx !== ctx && this.ctx.onDone) { const old = this.ctx; this.ctx = null; old.onDone(); }
        this.ctx = ctx;
        this.playWithMode(text, mode, this.engine());
    },

    async playWithMode(text, mode, engine, skips = 0) {
        this.stop(true);
        const ctx = this.ctx || {};
        const chaining = (mode === 'continuous' || mode === 'range' || mode === 'random');

        this.plannedNext = (chaining && ctx.pickNext) ? ctx.pickNext(mode) : null;

        if (!text || !text.trim()) {
            if (!chaining || skips > 30 || !this.plannedNext) { this.idle(); return; }
            const nxt = this.plannedNext;
            if (ctx.onNext) ctx.onNext(nxt);
            const s0 = this.session;
            setTimeout(() => { if (s0 === this.session) this.playWithMode(nxt.text, mode, engine, skips + 1); }, 200);
            return;
        }

        const token = this.playToken;
        this.emit('loading');

        const advance = () => {
            if (token !== this.playToken) return;
            if (mode === 'once') { this.idle(); return; }
            if (mode === 'repeat') {
                const s0 = this.session;
                const again = () => { if (s0 === this.session) this.playWithMode(text, mode, engine); };
                if (engine === 'browser') setTimeout(again, 600); else again();
                return;
            }
            const next = this.plannedNext;
            if (!next) { this.idle(); return; }
            if (ctx.onNext) ctx.onNext(next);
            const s0 = this.session;
            const go = () => { if (s0 === this.session) this.playWithMode(next.text, mode, engine); };
            // 내장 음성만 타이머가 필요합니다. Edge는 쉼이 오디오 안에 들어있어 곧바로 이어 붙입니다.
            if (engine === 'browser') setTimeout(go, 600); else go();
        };

        if (engine === 'browser') { this.playBrowser(text, token, advance); return; }
        await this.playRemote(text, token, engine, chaining, advance);
    },

    async playRemote(text, token, engine, chaining, advance) {
        let audio = await this.getStatic(text, engine);
        if (token !== this.playToken) return;
        if (!audio) {
            try {
                audio = { blob: await this.getAudio(text, engine), rate: 1 };   // 실시간 엔진은 속도가 오디오에 들어있음
            } catch (err) {
                if (token !== this.playToken) return;
                console.error("TTS Error:", err);
                if (!this.fallbackWarned) {
                    this.fallbackWarned = true;
                    UI.toast(`Edge 음성을 받지 못해 내장 음성으로 읽습니다 (${err.message})`);
                }
                this.playBrowser(text, token, advance);
                return;
            }
            if (token !== this.playToken) return;
        }

        const el = this.unlock();
        this.releaseBlob();
        const url = URL.createObjectURL(audio.blob);
        this.lastBlobUrl = url;
        // src 를 바꾸면 playbackRate 가 defaultPlaybackRate 로 돌아가므로 둘 다 맞춥니다 (음높이는 유지)
        el.defaultPlaybackRate = el.playbackRate = audio.rate;
        el.preservesPitch = true;

        this.wantPlaying = true;
        this.currentAdvance = advance;
        el.onended = () => { if (token === this.playToken) advance(); };
        el.onerror = () => {
            if (token !== this.playToken) return;
            if (chaining && this.plannedNext) advance(); else this.stop(false);
        };
        el.src = url;

        try {
            await el.play();
        } catch (e) {
            if (token !== this.playToken) return;
            UI.toast("재생이 차단되었습니다. 재생 버튼을 한 번 더 눌러주세요.");
            this.stop(false);
            return;
        }
        if (token !== this.playToken) return;

        this.emit('playing');
        this.updateMediaSession();
        if (this.plannedNext) this.prefetch(this.plannedNext.text, engine);
    },

    playBrowser(text, token, advance) {
        if (!window.speechSynthesis) {
            UI.toast("이 기기에서는 내장 음성 기능을 지원하지 않습니다.");
            this.stop(false); return;
        }
        // 크롬은 긴 문장 하나를 통째로 넘기면 15초쯤에서 끊깁니다. 문장 단위로 잘라 차례대로 읽습니다.
        const chunks = U.sentences(text).reduce((acc, s) => {
            if (acc.length && (acc[acc.length - 1] + " " + s).length < 200) acc[acc.length - 1] += " " + s;
            else acc.push(s);
            return acc;
        }, []);
        const voices = window.speechSynthesis.getVoices() || [];
        const wanted = currentVoice('browser');
        const voice = voices.find(v => v.voiceURI === wanted) || pickBestEnglishVoice(voices);
        const rate = parseFloat(Settings.v.rate) || 1;

        const speakAt = (i) => {
            if (token !== this.playToken) return;
            if (i >= chunks.length) { advance(); return; }
            const u = new SpeechSynthesisUtterance(chunks[i]);
            this.currentUtterance = u;   // 크롬 GC 버그 방지
            u.lang = (voice && voice.lang) || 'en-US';
            if (voice) u.voice = voice;
            u.rate = rate;
            u.onstart = () => {
                if (token !== this.playToken) return;
                this.emit('playing');
                if (i === 0) this.updateMediaSession();
            };
            u.onend = () => { if (token === this.playToken) speakAt(i + 1); };
            u.onerror = (e) => {
                if (e.error === 'interrupted' || e.error === 'canceled') return;
                console.error("내장 음성 에러:", e);
                if (token === this.playToken) speakAt(i + 1);
            };
            window.speechSynthesis.speak(u);
        };
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        this.wantPlaying = true;
        this.currentAdvance = advance;
        speakAt(0);
    }
};

// 같은 이름이라도 기기마다 품질 차이가 큽니다. Natural / Online / Neural 이 붙은 것이 신경망 음성입니다.
function voiceScore(v) {
    const n = (v.name || "") + " " + (v.voiceURI || "");
    let s = 0;
    if (/Natural|Neural|Online/i.test(n)) s += 100;
    if (/Google/i.test(n)) s += 40;
    if (/Siri|Premium|Enhanced/i.test(n)) s += 60;
    if (/Microsoft/i.test(n)) s += 20;
    if (v.lang === 'en-US' || v.lang === 'en_US') s += 10;
    if (/Aria|Jenny|Emma|Ava|Samantha/i.test(n)) s += 5;
    return s;
}
function pickBestEnglishVoice(voices) {
    const eng = voices.filter(v => (v.lang || "").toLowerCase().startsWith('en'));
    if (!eng.length) return null;
    return eng.sort((a, b) => voiceScore(b) - voiceScore(a))[0];
}
function currentVoice(engine) {
    const saved = Settings.v.voices[engine];
    if (saved) return saved;
    if (engine === 'edge') return EDGE_VOICES[0].id;
    return "";
}
function edgeRateString() {
    const r = parseFloat(Settings.v.rate) || 1;
    const pct = Math.round((r - 1) * 100);
    return (pct >= 0 ? '+' : '') + pct + '%';
}
function fetchWithTimeout(url, opts = {}, ms = TTS_LIVE_TIMEOUT_MS) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), ms);
    return fetch(url, { ...opts, signal: ac.signal })
        .catch(e => { throw e.name === 'AbortError' ? new Error(`응답 없음 (${ms / 1000}초)`) : e; })
        .finally(() => clearTimeout(timer));
}

// =========================================================================
//  미리 만든 음성 (TTS_STATIC_BASE 폴더, trainer_src/tts_build.py 가 만듦)
//  - 문장 하나 = mp3 하나, 파일 이름 = sha1(정리한 문장) 앞 20자리. tts_build.py 의 sentence_key 와 같아야 합니다.
//  - 여러 문장은 mp3 를 이어 붙여 하나로 재생합니다 (같은 형식의 mp3 프레임이라 그대로 붙음).
//  - 한 문장이라도 없으면 null → 실시간 엔진으로 넘어가고, 빠진 문장은 기록해 두었다가 '목록 내보내기'에 넣습니다.
// =========================================================================
const TtsStatic = {
    MISSING_KEY: 'opicTrainer.ttsMissing',
    CACHE: 'opic-tts-v1',
    loading: null,
    voices: new Map(),      // 성우 → Set(파일 이름)
    keys: new Map(),        // 문장 → 파일 이름

    norm(t) { return String(t || '').normalize('NFC').replace(/[\s﻿]+/g, ' ').trim(); },

    async key(sentence) {
        const n = this.norm(sentence);
        if (this.keys.has(n)) return this.keys.get(n);
        const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(n));
        const k = [...new Uint8Array(buf)].slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join('');
        this.keys.set(n, k);
        return k;
    },

    // manifest.json 을 한 번 읽습니다. 실패하면 1분 뒤 다시 시도할 수 있게 합니다.
    load() {
        if (this.loading) return this.loading;
        this.loading = (async () => {
            if (location.protocol === 'file:' || !window.crypto || !crypto.subtle) return false;
            const url = new URL(TTS_STATIC_BASE + 'manifest.json', location.href).href;
            let m = null;
            try {
                const res = await fetchWithTimeout(url, { cache: 'no-cache' }, 5000);
                if (res.ok) {
                    m = await res.clone().json();
                    if (window.caches) caches.open(this.CACHE).then(c => c.put(url, res)).catch(() => {});
                }
            } catch (e) {}
            if (!m && window.caches) {   // 오프라인: 마지막으로 받은 목록
                const hit = await caches.match(url).catch(() => null);
                if (hit) m = await hit.json().catch(() => null);
            }
            if (!m || !m.voices) { setTimeout(() => { this.loading = null; }, 60000); return false; }
            this.voices = new Map(Object.entries(m.voices).map(([v, ks]) => [v, new Set(ks)]));
            return true;
        })().catch(() => false);
        return this.loading;
    },

    async audio(text, voice) {
        if (!await this.load()) return null;
        const have = this.voices.get(voice);
        if (!have) return null;
        const sents = U.sentences(text).map(s => this.norm(s)).filter(Boolean);
        if (!sents.length) return null;
        const keys = await Promise.all(sents.map(s => this.key(s)));
        const missing = sents.filter((s, i) => !have.has(keys[i]));
        if (missing.length) { this.noteMissing(missing); return null; }
        const parts = await Promise.all(keys.map(k => this.file(voice, k)));
        return new Blob(parts, { type: 'audio/mpeg' });
    },

    // 파일 이름이 내용의 해시라 한 번 받은 파일은 바뀌지 않습니다 → 기기에 영구 보관(오프라인 재생)
    async file(voice, key) {
        const url = new URL(`${TTS_STATIC_BASE}${encodeURIComponent(voice)}/${key}.mp3`, location.href).href;
        const cache = window.caches ? await caches.open(this.CACHE).catch(() => null) : null;
        const hit = cache && await cache.match(url).catch(() => null);
        if (hit) return hit.blob();
        const res = await fetchWithTimeout(url);
        if (!res.ok) throw new Error('mp3 HTTP ' + res.status);
        if (cache) await cache.put(url, res.clone()).catch(() => {});
        return res.blob();
    },

    noteMissing(sents) {
        const list = U.lsGet(this.MISSING_KEY, []);
        const set = new Set(list);
        sents.forEach(s => { if (!set.has(s)) { set.add(s); list.push(s); } });
        U.lsSet(this.MISSING_KEY, list.slice(-3000));
    },

    // 앱이 읽을 수 있는 모든 문장 (답변 파일 전부 + 표현 + 막힌 표현 + 재생하다 빠졌던 문장)
    allSentences() {
        const texts = [INTRO_QUESTION, TTS_SAMPLE];
        Data.allFiles().forEach(f => (f.scripts || []).forEach(s => { if (Parse.hasQuestion(s)) texts.push(s.question); texts.push(s.answer); }));
        Data.expressions.forEach(x => texts.push(x.en));
        Stuck.list().forEach(x => texts.push(x.en));
        texts.push(...U.lsGet(this.MISSING_KEY, []));
        const seen = new Set();
        texts.forEach(t => U.sentences(t || '').forEach(s => { const n = this.norm(s); if (n) seen.add(n); }));
        return [...seen];
    },

    exportData() {
        return { app: 'opic-trainer', kind: 'tts-texts', version: 1, voice: currentVoice('edge'), createdAt: new Date().toISOString(), sentences: this.allSentences() };
    },

    async status(voice) {
        if (!await this.load()) return { available: false };
        const have = this.voices.get(voice) || new Set();
        const sents = this.allSentences();
        const keys = await Promise.all(sents.map(s => this.key(s)));
        return { available: true, total: sents.length, ready: keys.filter(k => have.has(k)).length };
    }
};

function voiceOptions(engine) {
    if (engine === 'edge') return EDGE_VOICES.map(v => ({ value: v.id, text: v.label }));
    if (!window.speechSynthesis) return [];
    const voices = (window.speechSynthesis.getVoices() || []).filter(v => (v.lang || "").toLowerCase().startsWith('en'));
    voices.sort((a, b) => voiceScore(b) - voiceScore(a));
    return voices.map(v => ({ value: v.voiceURI, text: (voiceScore(v) >= 60 ? '★ ' : '') + v.name }));
}
