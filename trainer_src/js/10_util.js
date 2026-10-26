// =========================================================================
//  공통 유틸
// =========================================================================
const U = {
    esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    uid() {
        return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    },
    today(offsetDays = 0) {
        const d = new Date(); d.setDate(d.getDate() + offsetDays);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    daysBetween(a, b) {   // 'YYYY-MM-DD' 두 개의 날짜 차이
        return Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
    },
    fmtSec(sec) {
        sec = Math.max(0, Math.round(sec));
        return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    },
    shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
        return a;
    },
    hash(s) {   // 내장 데이터가 바뀌었는지 알아보는 용도의 짧은 해시
        let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
        return (h >>> 0).toString(36) + '-' + s.length;
    },
    pick(arr) { return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; },
    // 문장 분할: Mr./Dr./3.5/e.g. 같은 곳에서 자르지 않습니다
    sentences(text) {
        if (!text) return [];
        const protectedText = text
            .replace(/\b(Mr|Mrs|Ms|Dr|St|vs|etc|e\.g|i\.e)\./gi, m => m.replace(/\./g, '\u0000'))
            .replace(/(\d)\.(\d)/g, '$1\u0000$2');
        const parts = protectedText.match(/[^.?!\n]+(?:[.?!]+["'’”]?|\n|$)/g) || [protectedText];
        return parts.map(s => s.replace(/\u0000/g, '.').trim()).filter(Boolean);
    },
    circled(n) { return n <= 20 ? String.fromCharCode(9311 + n) : `(${n})`; },
    download(filename, text) {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    readFile(file) {
        return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file, 'UTF-8'); });
    },
    lsGet(key, fallback) {
        try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    lsSet(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { console.error('localStorage 저장 실패', e); return false; }
    },
    // 질문 유형 → 화면 표시용 색
    typeChip(type) {
        const map = { '묘사': 'chip', '루틴': 'chip', '경험': 'chip-blue', '비교': 'chip-amber', '이슈': 'chip-red' };
        return type ? `<span class="chip ${map[type] || ''}">${U.esc(type)}</span>` : '';
    }
};
