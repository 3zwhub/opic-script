// =========================================================================
//  시작
// =========================================================================
['today', 'palace', 'drill', 'records'].forEach(tab => {
    if (!Views[tab]) Views[tab] = (el) => { UI.title('OPIc 트레이너'); el.innerHTML = '<div class="wrap"><div class="card muted">준비 중인 화면입니다</div></div>'; };
});

const App = {
    async start() {
        Settings.load();
        Data.init();
        // tts_build.py 가 헤드리스 Edge 로 열어 내장 답변·표현의 문장 목록을 가져갑니다
        if (new URLSearchParams(location.search).has('ttsexport')) {
            const pre = document.createElement('pre'); pre.id = 'ttsexport';
            pre.textContent = JSON.stringify(TtsStatic.exportData());
            document.body.replaceChildren(pre); document.title = 'TTSEXPORT READY';
            return;
        }
        UI.init();
        await DB.open();
        await SRS.load();
        // 예전 궁전(요소 위치·정류장) 카드는 새 체계(갈림길 카드)와 뜻이 달라 지웁니다
        for (const k of [...SRS.cards.keys()].filter(k => /^(el|stop)\//.test(k))) { SRS.cards.delete(k); await DB.del('cards', k); }
        Rec.prune().catch(e => console.warn('녹음 정리 실패', e));
        if (window.speechSynthesis) { window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged = () => {}; }
        if (new URLSearchParams(location.search).has('selftest')) { await SelfTest.run(); return; }
        Sync.init();
        UI.render();
    }
};
window.addEventListener('DOMContentLoaded', () => App.start().catch(e => {
    console.error(e);
    document.getElementById('view').innerHTML = `<div class="wrap"><div class="card text-red-600">앱을 시작하지 못했습니다: ${U.esc(e.message)}</div></div>`;
}));
