// =========================================================================
//  설정 (기존 스크립트 브라우저와 같은 값)
// =========================================================================
const USER_FIREBASE_CONFIG = {
    apiKey: "AIzaSyCpbhk4d6EtSh7p-nQ8z88WQyIukqtYSMQ",
    authDomain: "scriptbrowser-fd181.firebaseapp.com",
    projectId: "scriptbrowser-fd181",
    storageBucket: "scriptbrowser-fd181.firebasestorage.app",
    messagingSenderId: "282301386111",
    appId: "1:282301386111:web:774389b7cc453e14a05e4a",
    measurementId: "G-8L7P4P2FMT"
};
const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/11.6.1";
const SYNC_APP_ID = 'script-browser-app';   // 기존 앱과 같은 경로를 써야 파일이 공유됩니다

// Cloudflare Worker (TTS 중계 서버). 끝에 / 는 빼주세요.
const TTS_PROXY_URL = "https://tts-proxy.sleepingwalk.workers.dev";
const TTS_PROXY_TOKEN = "";

const EDGE_VOICES = [
    { id: "en-US-AvaMultilingualNeural", label: "Ava · 미국 여성 (밝음, 기본)" },
    { id: "en-US-AriaNeural", label: "Aria · 미국 여성 (차분)" },
    { id: "en-US-JennyNeural", label: "Jenny · 미국 여성 (친근)" },
    { id: "en-US-MichelleNeural", label: "Michelle · 미국 여성 (또렷)" },
    { id: "en-US-EmmaMultilingualNeural", label: "Emma · 미국 여성 (자연스러움)" },
    { id: "en-US-GuyNeural", label: "Guy · 미국 남성 (표준)" },
    { id: "en-US-ChristopherNeural", label: "Christopher · 미국 남성 (중저음)" },
    { id: "en-US-AndrewMultilingualNeural", label: "Andrew · 미국 남성 (편안)" },
    { id: "en-US-BrianMultilingualNeural", label: "Brian · 미국 남성 (뉴스톤)" },
    { id: "en-GB-SoniaNeural", label: "Sonia · 영국 여성" },
    { id: "en-GB-LibbyNeural", label: "Libby · 영국 여성 (young)" },
    { id: "en-GB-RyanNeural", label: "Ryan · 영국 남성" },
    { id: "en-AU-NatashaNeural", label: "Natasha · 호주 여성" },
    { id: "en-AU-WilliamNeural", label: "William · 호주 남성" },
    { id: "en-CA-ClaraNeural", label: "Clara · 캐나다 여성" },
    { id: "en-IN-NeerjaNeural", label: "Neerja · 인도 여성" }
];
const EDGE_PITCH = "+0Hz";
const CHAIN_GAP_MS = 500;

// 미리 만든 음성(mp3) 폴더. 앱 주소 기준 상대 경로이며 trainer_src/tts_build.py 가 채웁니다.
// 문장마다 파일 하나(이름 = 문장 내용의 해시)라서 스크립트를 고치면 바뀐 문장만 새로 만들면 됩니다.
const TTS_STATIC_BASE = "tts/";
const TTS_LIVE_TIMEOUT_MS = 8000;   // 실시간 TTS 응답을 기다리는 최대 시간
const TTS_SAMPLE = "I live in a three-bedroom apartment, and my room has a fantastic view of the river.";

// 훈련 설계값 (설계안 문서 기준)
const SRS_INTERVALS = [0, 1, 2, 4, 7, 14];          // 레벨별 다음 복습까지 일수
const ANSWER_TARGET = { min: 90, max: 150 };        // 문항당 목표 답변 시간(초)
const RECORDING_KEEP_DAYS = 30;
const RECORDING_MAX = 300;
const MOCK_TOTAL_SEC = 40 * 60;
const INTRO_QUESTION = "Let's start the interview now. Tell me a little bit about yourself.";

const AL_CHECKLIST = [
    '과거 서술의 시제가 끝까지 유지됐다',
    '시작·전개·마무리가 있는 문단이었다',
    '1분 30초 이상 멈추지 않고 말했다 (막히면 필러로 이어감)',
    'RP 12번: 대안을 2~3개 냈다 (해당 없으면 체크)',
    '14~15번: 의견에 이유·예시·반대 관점이 붙었다 (해당 없으면 체크)'
];

const FOUR_SLOT = [
    { name: '① 일반 묘사', hint: 'In my country, ... / These days, most people ...' },
    { name: '② 나의 습관', hint: 'As for me, I usually ... / Personally, ...' },
    { name: '③ 과거 비교', hint: 'Back when I was a kid, ... / Compared to the past, ...' },
    { name: '④ 문제·기억', hint: 'I remember one time when ... / What happened was ...' }
];

const STAGES = [
    { n: 1, name: '콤보 지도', desc: '서베이 콤보의 갈림길("이 질문 다음엔?")을 궁전에 올리고 바로 떠올린다', gate: '서베이 갈림길 90% 이상을 2회 연속 정확히 맞힘' },
    { n: 2, name: '변형', desc: '서베이 콤보를 키워드만 보고 이어 말한다', gate: '서베이 답변 녹음 최근 5개가 모두 90초 이상' },
    { n: 3, name: '즉흥', desc: '돌발·RP·비교·이슈 질문을 듣고 바로 조립한다', gate: '돌발 녹음 최근 5개 중 4개가 90초 이상 + 시제 유지' },
    { n: 4, name: '실전 모의', desc: '주 1회 15문항 모의고사, 평일은 즉흥 유지', gate: '모의고사 2회 연속 체크리스트 평균 4/5 이상' }
];
