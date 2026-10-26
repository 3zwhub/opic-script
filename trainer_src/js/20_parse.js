// =========================================================================
//  파서: combos.txt / 답변 스크립트 txt / 표현 모음
// =========================================================================
const Parse = {
    // ---------------- combos.txt ----------------
    // 모델: { preamble: [줄], topics: [Topic] }
    // Topic: { name, fields: [[키, 값]], chain: [], combos: [[]], elements: { 이름: Element }, elOrder: [], pre: [주석 줄] }
    // Element: { name, fields: [[키, 값]] }   필드 순서를 그대로 보존해 내보낼 때 원본 모양을 유지합니다
    combos(text) {
        const lines = String(text || '').replace(/\r/g, '').split('\n');
        const model = { preamble: [], topics: [], errors: [] };
        let topic = null, el = null, pendingComments = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].replace(/\s+$/, '');
            if (!topic && !line.startsWith('== ')) { model.preamble.push(line); continue; }

            if (line.startsWith('== ')) {
                const parts = line.slice(3).split(' | ');
                topic = { name: parts[0].trim(), fields: [], chain: [], combos: [], elements: {}, elOrder: [], pre: pendingComments };
                parts.slice(1).forEach(p => {
                    const k = p.indexOf(':');
                    if (k > 0) topic.fields.push([p.slice(0, k).trim(), p.slice(k + 1).trim()]);
                });
                pendingComments = []; el = null;
                if (model.topics.some(t => t.name === topic.name)) model.errors.push(`${i + 1}줄: 주제 '${topic.name}'가 두 번 나옵니다`);
                model.topics.push(topic);
                continue;
            }
            if (!line.trim()) { el = null; continue; }
            if (line.trim().startsWith('#')) { pendingComments.push(line); el = null; continue; }

            if (line.startsWith('사슬:')) { topic.chain = line.slice(3).split('>').map(s => s.trim()).filter(Boolean); el = null; continue; }
            if (line.startsWith('콤보:')) { topic.combos.push(line.slice(3).split('/').map(s => s.trim()).filter(Boolean)); el = null; continue; }
            if (line.startsWith('- ')) {
                const name = line.slice(2).trim();
                el = { name, fields: [] };
                topic.elements[name] = el; topic.elOrder.push(name);
                continue;
            }
            const m = line.match(/^\s{2,}([^:]+):\s?(.*)$/);
            if (m && el) { el.fields.push([m[1].trim(), m[2].trim()]); continue; }
            model.errors.push(`${i + 1}줄을 해석하지 못했습니다: ${line.slice(0, 40)}`);
        }
        // 마지막 주제 뒤에 남은 주석은 그 주제에 붙여 둡니다
        if (pendingComments.length && topic) topic.post = pendingComments;

        // 검증: 콤보 요소가 사슬에 있는지, 사슬 요소에 블록이 없으면 빈 블록을 만듭니다
        model.topics.forEach(t => {
            t.combos.forEach(c => c.forEach(e => {
                if (!t.chain.includes(e)) model.errors.push(`${t.name}: 콤보 요소 '${e}'가 사슬에 없습니다`);
            }));
            t.chain.forEach(e => {
                if (!t.elements[e]) { t.elements[e] = { name: e, fields: [] }; t.elOrder.push(e); }
            });
        });
        return model;
    },

    serializeCombos(model) {
        const out = [...model.preamble];
        while (out.length && out[out.length - 1] === '') out.pop();
        model.topics.forEach(t => {
            out.push('');
            if (t.pre && t.pre.length) { t.pre.forEach(l => out.push(l)); out.push(''); }
            out.push('== ' + [t.name, ...t.fields.map(([k, v]) => `${k}: ${v}`)].join(' | '));
            out.push('사슬: ' + t.chain.join(' > '));
            t.combos.forEach(c => out.push('콤보: ' + c.join(' / ')));
            const blocks = t.elOrder.filter(n => t.elements[n] && t.elements[n].fields.length);
            if (blocks.length) {
                out.push('');
                blocks.forEach(n => {
                    out.push('- ' + n);
                    t.elements[n].fields.forEach(([k, v]) => out.push(`  ${k}:${v ? ' ' + v : ''}`));
                });
            }
            if (t.post && t.post.length) { out.push(''); t.post.forEach(l => out.push(l)); }
        });
        return out.join('\n') + '\n';
    },

    field(obj, key) { const f = obj.fields.find(([k]) => k === key); return f ? f[1] : ''; },
    setField(obj, key, value, afterKeys = []) {
        const f = obj.fields.find(([k]) => k === key);
        if (f) { f[1] = value; return; }
        if (!value) return;
        // 정해진 순서(유형, 답변, 위치, 기호, 신호, 장면, K, 메모)에 맞는 자리에 끼워 넣습니다
        let idx = obj.fields.length;
        for (const k of afterKeys) { const j = obj.fields.findIndex(([x]) => x === k); if (j > -1) idx = j + 1; }
        obj.fields.splice(Math.min(idx, obj.fields.length), 0, [key, value]);
    },

    // '답변: 일부 Q003' / 'Q010, Q011' / '없음' → { refs, partial }
    answerRefs(value) {
        const refs = (String(value || '').match(/Q\d{2,4}/g) || []);
        return { refs, partial: /일부/.test(value || ''), none: !refs.length };
    },

    // ---------------- 답변 스크립트 txt ----------------
    // 헤더는 반드시 '분류-Q번호-제목: 질문' 모양이어야 합니다 (본문 속 'xxx: yyy' 문장을 헤더로 오인하지 않게)
    HEADER_RE: /^(.+?)-(Q\d{2,4})-([^:]*):\s*(.*)$/,
    scripts(text) {
        const out = [];
        let cur = null, inAnswer = false;
        String(text || '').replace(/\r/g, '').split('\n').forEach(raw => {
            const line = raw.trim();
            if (!line) return;
            const lower = line.toLowerCase();
            if (lower.startsWith('a:') || lower.startsWith('answer:')) {
                if (cur) { inAnswer = true; cur.answer += (cur.answer ? '\n' : '') + line.slice(line.indexOf(':') + 1).trim(); }
                return;
            }
            if (lower.startsWith('k:') || lower.startsWith('keywords:')) {
                if (cur) { inAnswer = false; cur.keywords = line.slice(line.indexOf(':') + 1).trim(); }
                return;
            }
            const m = line.match(Parse.HEADER_RE);
            if (m) {
                if (cur) out.push(cur);
                cur = { uuid: U.uid(), key: m[2], category: m[1].trim(), id: m[2], title: m[3].trim(), question: m[4].trim(), answer: '', keywords: '' };
                inAnswer = false;
                return;
            }
            if (cur && inAnswer) cur.answer += (cur.answer ? '\n' : '') + line;
        });
        if (cur) out.push(cur);
        return out;
    },

    serializeScripts(scripts) {
        return scripts.map(s => `${s.category}-${s.id}-${s.title}: ${s.question}\nA: ${s.answer}\n${s.keywords ? 'K: ' + s.keywords + '\n' : ''}`).join('\n');
    },

    hasQuestion(s) { return !!(s && s.question && !/^(question\.?|q\.?)$/i.test(s.question.trim())); },
    scriptTopic(s) { return (s.category || '').replace(/\d+$/, '').trim(); },

    // ---------------- 표현 모음 ----------------
    expressions(text) {
        const out = []; let topic = '', group = '';
        String(text || '').replace(/\r/g, '').split('\n').forEach(line => {
            if (line.startsWith('== ')) { topic = line.slice(3).replace(/\s*\(.*$/, '').trim(); return; }
            const g = line.match(/^\s+\[(.+)\]\s*$/);
            if (g) { group = g[1]; return; }
            const m = line.match(/^\s+(.+?)\s+—\s+(.+)$/);
            if (m && topic) out.push({ key: `expr/${topic}/${m[1]}`, topic, group, en: m[1], ko: m[2] });
        });
        return out;
    },

    // ---------------- 문장 키워드 (키워드_문장.txt) ----------------
    // '== Q001' / '3: 키워드 | 키워드' (문장 번호) / '연결: A > B | 관계'  →  { Q001: { lines: { 3: [..] }, edges: [[A, B, 관계]] } }
    KW_RELS: ['이유', '결과', '대조', '구체화', '위치', '같은'],
    sentKeywords(text) {
        const out = {}; let cur = null;
        String(text || '').replace(/\r/g, '').split('\n').forEach(raw => {
            const line = raw.trim();
            if (!line || line.startsWith('#')) return;
            const h = line.match(/^== (Q\d{2,4})$/);
            if (h) { cur = out[h[1]] = { lines: {}, edges: [] }; return; }
            if (!cur) return;
            const e = line.match(/^연결:\s*(.+?)\s+>\s+(.+?)\s*\|\s*(\S+)$/);
            if (e) { if (Parse.KW_RELS.includes(e[3])) cur.edges.push([e[1].trim(), e[2].trim(), e[3]]); return; }
            const n = line.match(/^(\d+):\s*(.*)$/);
            if (n) cur.lines[Number(n[1])] = n[2].split('|').map(s => s.trim()).filter(Boolean);
        });
        return out;
    }
};
