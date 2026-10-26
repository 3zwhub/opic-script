// =========================================================================
//  궁전 게임: 방(서베이)·동네 길(공통형)을 걸으며 기호를 보고, 다음 질문 후보를 맞힙니다
//  데이터는 combos.txt(위치·기호·연결·장면·콤보) + 답변 파일 + 키워드_문장.txt 에서 그때그때 만듭니다
//  주소: #/palace/game/<주제>
// =========================================================================
const PalaceGame = (() => {
const esc = U.esc;
// 기호 그림 문자 ('집'은 직접 그린 그림을 씀). 새 기호를 쓰면 여기에 하나 추가하면 됩니다
const EMOJI = {"레코드판 진열장": "💿", "커다란 헤드폰": "🎧", "낡은 장난감 피아노": "🎹", "콘서트 야광봉": "🎇", "저울 위 두 장의 악보": "🎼", "최신 무선 이어폰": "🎵", "접힌 국내 지도": "🗺️", "반쯤 싼 여행 가방": "🧳", "금 간 스노볼": "🔮", "낡은 폴라로이드 카메라": "📸", "내려간 톨게이트 차단기": "🚧", "걱정 인형": "🪆", "외국 도시 그림엽서": "🏙️", "빵빵한 관광 배낭": "🎒", "빨간 첫 여권": "📕", "분실 캐리어 꼬리표": "🏷️", "에펠탑 열쇠고리": "🗼", "단체 관광 가이드 깃발": "🚩", "낡은 종이 비행기표": "🎫", "초대 손님 명단": "📜", "보드게임 상자": "🎲", "찢어진 휴가 달력": "📅", "깜짝 선물 상자": "🎁", "옛날 비디오테이프": "📼", "비타민 병": "💊", "영화 포스터 묶음": "🎭", "커다란 팝콘 통": "🍿", "구겨진 영화표": "🎟️", "명작 DVD 케이스": "💿", "배우 사인 색지": "✍️", "흑백 필름 릴": "🎞️", "만화 말풍선 쿠션": "💬", "TV 리모컨": "🕹️", "움푹 꺼진 소파 쿠션": "🛋️", "낡은 브라운관 TV": "📺", "캐릭터 피규어": "🧸", "만화 스티커 앨범": "📒", "황금 영화 트로피": "🏆", "스트리밍 셋톱박스": "📡", "백화점 쇼핑백": "🛍️", "장보기 목록 메모": "📝", "구멍가게 사탕병": "🍬", "단골 가게 적립 카드": "💳", "구겨진 환불 영수증": "🧾", "새 셔츠 가격표": "👕", "택배 상자 탑": "📦", "1위 왕관 팻말": "👑", "원목 흔들의자": "🪑", "소파 위 담요": "🛌", "어린 시절 이층침대": "🛏️", "부러진 의자 다리": "🪚", "색색의 분리수거함": "♻️", "찌그러진 페트병": "🧴", "우유팩 저금통": "🥛", "옛날 고물상 리어카": "🛒", "찢어진 쓰레기봉투": "🗑️", "분리수거 트럭": "🚛", "둘둘 만 신문": "📰", "환경 캠페인 어깨띠": "🎗️", "환경 속보 TV 화면": "🌍", "거대한 공장 굴뚝": "🏭", "번쩍이는 회사 로고 간판": "🏢", "찌그러졌다 펴진 트로피": "🏆", "대기업 사원증 목걸이": "🪪", "거대한 말굽 자석": "🧲", "밑줄 가득한 자격증 문제집": "📚", "학원가의 토익 책 더미": "📖", "3년 전 업계 신문": "📰", "반품 딱지 붙은 신상 게임기": "🎮", "누렇게 바랜 5년 전 이력서": "📄", "인파 몰린 박람회 부스": "🎪", "단골집 나무 간판": "🪧", "향신료 카레 냄비": "🍛", "외국 식당 영수증": "🧾", "은색 수저통": "🥢", "깜빡이는 진동벨": "🔔", "식당 어린이 의자": "🪑", "배달 오토바이 헬멧": "⛑️", "랩 씌운 짜장면 그릇": "🍜", "생일파티 피자 상자 탑": "🍕", "샐러드 메뉴판": "🥗", "프랜차이즈 로고 스티커": "🏷️", "옛날 경양식 돈가스 접시": "🍽️", "별점 리뷰 팻말": "⭐", "현미 도시락 배달통": "🍱", "배달 앱 아이콘 가득한 휴대폰": "📱", "동네 축제 현수막": "🎏", "행사 무대 마이크": "🎤", "뒤집힌 우산": "☂️", "파티룸 미러볼": "🪩", "크리스마스 고깔모자": "🥳", "풍선 펌프": "🎈", "흑백 돌잔치 사진": "👶", "회의용 의사봉": "🔨", "마을회관 확성기": "📢", "주차 위반 딱지": "🅿️", "싱싱한 브로콜리 다발": "🥦", "유기농 마트 카트": "🛒", "엄마의 녹즙기": "🥤", "샐러드 도시락통": "🥗", "펄펄 끓는 김치찌개 뚝배기": "🍲", "편의점 삼각김밥": "🍙", "식탁 위 깨진 접시": "🍽️", "신선식품 택배 상자": "📦", "세균 그림 신문 1면": "🦠", "브로콜리 한 송이": "🥦", "조깅 운동화": "👟", "옛날 바늘 체중계": "⚖️", "유기농 장바구니": "🧺", "칸칸이 나뉜 식판": "🍱", "마라톤 완주 메달": "🏅", "새로 산 요가 매트": "🧘", "비타민 알약 통": "💊", "울퉁불퉁 근육 마네킹": "💪", "뉴스 앵커 마이크": "🎙️", "국민체조 카세트테이프": "📼", "금연 표지판": "🚭", "입체 산맥 지도": "🏔️", "등산 스틱": "🦯", "어린 시절 조개 양동이": "🐚", "소풍 돗자리": "🧺", "산 정상 기념 깃발": "🚩", "이웃나라 전통 인형": "🎎", "공원 배드민턴 라켓": "🏸", "10년치 탁상 달력": "📆", "악수하는 두 나라 국기": "🤝", "낡은 조약 두루마리": "📜", "붐비는 PC방": "🖥️", "스티커 붙은 내 노트북": "💻", "삐삐거리는 전화 모뎀": "📠", "황금 북마크 별": "🌟", "포스트잇 붙은 보고서": "🗂️", "빨간 재생 버튼": "▶️", "충전 케이블 꽂힌 휴대폰": "🔌", "피아노 치는 고양이 인형": "🐱", "어제 날짜의 일력 한 장": "📅", "자물쇠 채운 웹캠": "🔒", "할머니의 큰 글씨 폰": "👵", "반짝이는 카메라 렌즈": "📷", "앱 아이콘 가득한 홈 화면": "📱", "낡은 폴더폰": "📞", "부풀어 오른 배터리": "🔋", "수다 말풍선 스티커": "💬", "꼬인 이어폰 줄": "🎧", "오래된 음성 메시지 테이프": "📼", "가격표 붙은 새 폰 상자": "📦", "타임캡슐 속 구형 스마트폰": "⏳", "고개 숙인 청소년 동상": "🗿", "거리 가득 메운 전광판": "🌆", "손때 묻은 내 노트북": "💻", "브라운관 컴퓨터 모니터": "🖥️", "연기 나는 멀티탭": "🔌", "사계절 그림 달력": "🗓️", "창문에 붙은 온도계": "🌡️", "바람에 뒤집힌 우산": "☂️", "어릴 적 눈사람 사진": "⛄", "만원 버스 손잡이": "🚌", "내 교통카드": "💳", "녹슨 세발자전거": "🚲", "펑크 난 타이어": "🛞", "거리의 마네킹 행렬": "🧍", "내가 아끼는 청재킷": "🧥", "통 넓은 옛날 나팔바지": "👖", "영수증 붙은 새 운동화": "👟", "단골 가게 쇼핑백": "🛍️", "탈의실 커튼": "🪞", "길모퉁이 은행 간판": "🏦", "대기 번호표 한 장": "🎫", "어릴 적 돼지 저금통": "🐷", "카드 삼킨 ATM": "🏧", "회전문 달린 호텔 모형": "🏨", "황금 객실 카드키": "🔑", "바닷가 리조트 엽서": "🏖️", "구겨진 체크아웃 영수증": "🧾", "치과 진료 예약 카드": "🦷", "동그라미 친 탁상 달력": "📆", "어린이용 곰돌이 반창고": "🩹", "튀어오르는 깜짝 상자": "🎁", "공원 잔디밭 돗자리": "🧺", "뒤집힌 모래시계": "⏳", "찢어진 영화표 반쪽": "🎟️", "보드게임 주사위": "🎲", "귀성길 고속도로 표지판": "🛣️", "말랑한 송편 반죽": "🍡", "빳빳한 세뱃돈 봉투": "🧧", "소파 위 TV 리모컨": "📺", "빨간 날 가득한 달력": "📅", "터질 듯한 쓰레기봉투": "🗑️", "단짝 친구 얼굴 액자": "🖼️", "묵직한 볼링공": "🎳", "방금 뽑은 폴라로이드 사진": "📸", "생일 고깔모자": "🥳", "친구 집 초인종": "🔔", "손님용 털 슬리퍼": "🥿", "할머니댁 사탕 단지": "🍬", "두 인형 올린 양팔 저울": "⚖️", "커다란 말풍선 쿠션": "💬"};

// ---------- 아이소메트릭 도구 ----------
const S = 24, OX = 220, OY = 236;
const iso = (x, y, z = 0) => [OX + (x - y) * S * 0.866, OY + (x + y) * S * 0.5 - z * S];
const pt = p => p.map(v => v.toFixed(1)).join(',');
const poly = (pts, fill, cls = '') => `<polygon points="${pts.map(p => pt(iso(...p))).join(' ')}" style="fill:${fill}" class="${cls}"/>`;
function box(x, y, z, dx, dy, dz, fill) {
  return poly([[x, y, z + dz], [x + dx, y, z + dz], [x + dx, y + dy, z + dz], [x, y + dy, z + dz]], fill) +
    poly([[x + dx, y, z], [x + dx, y + dy, z], [x + dx, y + dy, z + dz], [x + dx, y, z + dz]], fill, 'sh-r') +
    poly([[x, y + dy, z], [x + dx, y + dy, z], [x + dx, y + dy, z + dz], [x, y + dy, z + dz]], fill, 'sh-l');
}
const lw = (y, z, w, h, fill, cls = '') => poly([[0.02, y, z], [0.02, y + w, z], [0.02, y + w, z + h], [0.02, y, z + h]], fill, cls);
const rw = (x, z, w, h, fill, cls = '') => poly([[x, 0.02, z], [x + w, 0.02, z], [x + w, 0.02, z + h], [x, 0.02, z + h]], fill, cls);
const ring = (cx, cy, cz, r, plane, fill, n = 20) => poly([...Array(n)].map((_, i) => { const a = i / n * Math.PI * 2, c = Math.cos(a) * r, s = Math.sin(a) * r; return plane === 'floor' ? [cx + c, cy + s, cz] : plane === 'L' ? [cx, cy + c, cz + s] : [cx + c, cy, cz + s]; }), fill);
const line = (a, b, stroke, w = 2) => `<line x1="${iso(...a)[0]}" y1="${iso(...a)[1]}" x2="${iso(...b)[0]}" y2="${iso(...b)[1]}" style="stroke:${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;
const tint = (v, h, p = 22) => `color-mix(in srgb, var(${v}) ${100 - p}%, hsl(${h} 70% 55%))`;
// 벽면 사각형: plane L(x=0, 가로축 y) / R(y=0, 가로축 x)
const wrect = (pl, c, z, w, h, fill, cls = '') => pl === 'L' ? lw(c - w / 2, z, w, h, fill, cls) : rw(c - w / 2, z, w, h, fill, cls);
const wpt = (pl, c, z) => pl === 'L' ? [0.05, c, z] : [c, 0.05, z];

// ---------- 거실(집): 직접 그린 그림 ----------
function homeArt() {
  let s = '';
  s += poly([[0, 0, 0], [0, 10, 0], [0, 10, 9], [0, 0, 9]], 'var(--wall-l)') + poly([[0, 0, 0], [10, 0, 0], [10, 0, 9], [0, 0, 9]], 'var(--wall-r)') + poly([[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]], 'var(--floor)');
  for (let i = 1; i < 10; i++) s += line([i, 0, 0], [i, 10, 0], 'var(--floor-line)', 1);
  s += poly([[2.6, 2.2, 0], [9.2, 2.2, 0], [9.2, 7.4, 0], [2.6, 7.4, 0]], 'var(--rug)');
  s += lw(7.6, 0, 2.1, 6.4, 'var(--wood)') + lw(7.85, 0.3, 1.6, 5.8, 'var(--wood)', 'sh-l') + ring(0.05, 9.2, 3.0, 0.15, 'L', 'var(--glow)') + lw(6.85, 3.8, 0.45, 0.7, 'var(--paper)');
  s += box(0.2, 2.7, 0, 1.2, 3.8, 1.3, 'var(--wood)') + lw(2.9, 2.0, 3.4, 2.3, 'var(--dark)') + lw(3.05, 2.15, 3.1, 2.0, 'var(--glass)', 'sh-l');
  s += box(1.0, 0.02, 6.9, 2.6, 0.6, 1.1, 'var(--paper)') + line([1.2, 0.62, 7.1], [3.4, 0.62, 7.1], 'var(--metal)', 1.5);
  s += rw(3.9, 3.0, 2.5, 3.8, 'var(--paper)') + rw(4.1, 3.2, 2.1, 3.4, 'var(--glass)') + line([5.15, 0.03, 3.2], [5.15, 0.03, 6.6], 'var(--paper)', 3) + line([4.1, 0.03, 4.9], [6.2, 0.03, 4.9], 'var(--paper)', 3);
  s += ring(7.4, 0.03, 7.5, 0.65, 'R', 'var(--paper)') + ring(7.4, 0.04, 7.5, 0.5, 'R', 'var(--glass)') + line([7.4, 0.05, 7.5], [7.4, 0.05, 7.85], 'var(--dark)', 2) + line([7.4, 0.05, 7.5], [7.65, 0.05, 7.5], 'var(--dark)', 2);
  s += rw(6.7, 4.1, 1.3, 1.7, 'var(--wood)') + rw(6.82, 4.25, 1.06, 1.4, 'var(--paper)') + box(8.6, 0.05, 0, 1.3, 0.9, 6.4, 'var(--wood)');
  [1.6, 3.2, 4.8].forEach(z => { s += line([8.6, 0.95, z], [9.9, 0.95, z], 'var(--dark)', 1.5); });
  [[0.1, 'var(--sofa)'], [1.7, 'var(--cushion)'], [3.3, 'var(--rug)'], [4.9, 'var(--bad)']].forEach(([z, c]) => { for (let k = 0; k < 4; k++) s += poly([[8.7 + k * 0.3, 0.95, z + 0.1], [8.9 + k * 0.3, 0.95, z + 0.1], [8.9 + k * 0.3, 0.95, z + 1.3], [8.7 + k * 0.3, 0.95, z + 1.3]], c, k % 2 ? 'sh-l' : ''); });
  s += box(6.9, 0.7, 0, 0.8, 0.8, 1.0, 'var(--wood)');
  [[7.3, 1.1, 1.9, 0.55], [7.0, 1.0, 2.5, 0.45], [7.6, 1.2, 2.6, 0.45], [7.3, 1.1, 3.1, 0.4]].forEach(([x, y, z, r]) => { const [cx, cy] = iso(x, y, z); s += `<ellipse cx="${cx}" cy="${cy}" rx="${r * S}" ry="${r * S * 0.8}" style="fill:var(--good)" opacity=".85"/>`; });
  s += box(3.6, 3.4, 0.6, 2.0, 2.4, 0.25, 'var(--wood)') + box(3.7, 5.6, 0, 0.15, 0.15, 0.6, 'var(--wood)') + box(5.4, 5.6, 0, 0.15, 0.15, 0.6, 'var(--wood)');
  s += box(6.6, 2.6, 0, 1.8, 4.0, 1.0, 'var(--sofa)') + box(7.8, 2.6, 1.0, 0.6, 4.0, 1.5, 'var(--sofa)') + box(6.6, 2.6, 1.0, 1.2, 0.4, 0.6, 'var(--sofa)') + box(6.6, 6.2, 1.0, 1.2, 0.4, 0.6, 'var(--sofa)') + box(7.25, 5.2, 1.0, 0.5, 1.0, 1.0, 'var(--cushion)');
  s += box(5.6, 9.3, 0, 1.0, 0.5, 0.7, 'var(--metal)') + ring(6.1, 8.5, 0.05, 0.6, 'floor', 'var(--dark)') + ring(6.1, 8.5, 0.25, 0.6, 'floor', 'var(--metal)') + ring(6.1, 8.5, 0.27, 0.18, 'floor', 'var(--glow)');
  [[8.2, 7.6], [9.8, 7.6], [8.2, 8.9], [9.8, 8.9]].forEach(([x, y]) => { s += line([x, y, 0], [x, y, 2.4], 'var(--metal)', 2); });
  s += line([8.2, 7.6, 2.4], [9.8, 7.6, 2.4], 'var(--metal)') + line([8.2, 8.9, 2.4], [9.8, 8.9, 2.4], 'var(--metal)');
  [[8.4, 'var(--paper)'], [8.9, 'var(--cushion)'], [9.4, 'var(--rug)']].forEach(([x, c]) => { s += poly([[x, 7.6, 2.4], [x + 0.35, 7.6, 2.4], [x + 0.35, 8.9, 1.5], [x, 8.9, 1.5]], c, 'sh-l'); });
  return s;
}
const HOME_LOCI = { 1: [0.05, 7.07, 4.15], 2: [7.0, 3.0, 1.05], 3: [7.5, 5.7, 2.05], 4: [4.6, 4.6, 0.9], 5: [0.1, 4.6, 3.15], 6: [2.3, 0.4, 7.45], 7: [5.15, 0.05, 5.6], 8: [7.3, 1.1, 3.4], 9: [7.4, 0.1, 8.55], 10: [7.35, 0.1, 4.95], 11: [9.25, 0.95, 2.4], 12: [9.0, 8.25, 2.6], 13: [6.1, 9.4, 0.8] };
const G = 'var(--glow)', D = 'var(--dark)', P = 'var(--paper)', M = 'var(--metal)';
const HOME_ICON = {
  '현관 열쇠': `<circle cx="-9" cy="-6" r="8" fill="none" stroke="${G}" stroke-width="5"/><path d="M-2 -2 L14 12" stroke="${G}" stroke-width="5" stroke-linecap="round"/><path d="M8 7 l-4 4 M12 10 l-4 4" stroke="${G}" stroke-width="4"/>`,
  '벽시계': `<circle r="16" fill="${P}" stroke="${G}" stroke-width="4"/><path d="M0 0 V-10 M0 0 L8 4" stroke="${D}" stroke-width="3" stroke-linecap="round"/><circle r="2" fill="${D}"/>`,
  '빛바랜 가족사진': `<g transform="rotate(-8)"><rect x="-16" y="-13" width="32" height="26" rx="2" fill="${G}"/><rect x="-12" y="-9" width="24" height="18" fill="#d9c49b"/><circle cx="-4" cy="-2" r="3" fill="#8a7353"/><circle cx="5" cy="-1" r="3" fill="#8a7353"/><path d="M-10 9 q6 -8 10 0 q4 -8 10 0" fill="#8a7353"/></g>`,
  '페인트 롤러': `<rect x="-15" y="-15" width="26" height="10" rx="4" fill="${G}"/><path d="M11 -10 h5 v9 h-14 v8" fill="none" stroke="${D}" stroke-width="3"/><rect x="-1" y="7" width="6" height="11" rx="2" fill="${D}"/>`,
  '치킨 상자': `<path d="M-16 -2 L16 -2 L13 16 L-13 16 Z" fill="${G}"/><path d="M-16 -2 L-10 -12 L10 -12 L16 -2" fill="#f6c977"/><ellipse cx="-2" cy="-8" rx="7" ry="5" fill="#b0652e"/><path d="M4 -8 l7 -4" stroke="${P}" stroke-width="3" stroke-linecap="round"/><text y="11" text-anchor="middle" font-size="8" font-weight="700" fill="${D}">CHICKEN</text>`,
  '물 새는 파이프': `<path d="M-17 -12 H6 V2" fill="none" stroke="${M}" stroke-width="8"/><rect x="0" y="0" width="12" height="5" fill="${D}"/><path d="M6 8 q-4 6 0 8 q4 -2 0 -8" fill="#4aa3df"/><path d="M-2 14 q-3 4 0 6 q3 -2 0 -6" fill="#4aa3df"/><path d="M13 12 q-3 4 0 6 q3 -2 0 -6" fill="#4aa3df"/>`,
  '깨진 유리컵': `<path d="M-11 -14 H11 L8 12 H-8 Z" fill="#cfe7f5" stroke="${G}" stroke-width="2.5"/><path d="M-3 -14 L2 -4 L-4 2 L3 12" fill="none" stroke="${D}" stroke-width="2"/><path d="M12 14 l6 -2 l-2 5 Z M-15 15 l5 -3 l0 5 Z" fill="${G}"/>`,
  '아버지의 공구함': `<rect x="-17" y="-4" width="34" height="18" rx="3" fill="${G}"/><path d="M-8 -4 V-11 H8 V-4" fill="none" stroke="${D}" stroke-width="3"/><rect x="-17" y="2" width="34" height="3" fill="${D}" opacity=".4"/><path d="M-12 -14 l6 6" stroke="${M}" stroke-width="4" stroke-linecap="round"/>`,
  '부동산 전단지': `<g transform="rotate(6)"><rect x="-13" y="-17" width="26" height="34" rx="2" fill="${P}" stroke="${G}" stroke-width="2.5"/><path d="M-7 -2 L0 -9 L7 -2 V6 H-7 Z" fill="${G}"/><path d="M-8 10 H8 M-8 13 H4" stroke="${D}" stroke-width="2"/></g>`,
  '타워크레인': `<path d="M-6 18 V-14 M-6 -14 H18 M-6 -14 H-16 M-6 -8 L8 -14" stroke="${G}" stroke-width="4" fill="none"/><path d="M14 -14 V2" stroke="${D}" stroke-width="2"/><path d="M11 2 h6 v4 h-6 z" fill="${D}"/><rect x="-18" y="-13" width="6" height="6" fill="${D}"/>`,
  '치솟는 집값 그래프': `<path d="M-16 -16 V16 H17" fill="none" stroke="${D}" stroke-width="3"/><path d="M-12 10 L-4 4 L2 7 L13 -11" fill="none" stroke="${G}" stroke-width="4" stroke-linejoin="round"/><path d="M8 -12 L15 -14 L14 -6 Z" fill="${G}"/>`,
  '빨래 바구니': `<path d="M-15 -2 H15 L11 16 H-11 Z" fill="${G}"/><path d="M-12 4 H12 M-11 10 H11" stroke="${D}" stroke-width="1.5" opacity=".5"/><path d="M-10 -2 q4 -12 12 -8 q6 -6 9 8" fill="${P}"/>`,
  '로봇청소기': `<ellipse cx="0" cy="4" rx="17" ry="9" fill="${D}"/><ellipse cx="0" cy="0" rx="17" ry="9" fill="${G}"/><ellipse cx="0" cy="-2" rx="6" ry="3" fill="${D}"/><circle cx="9" cy="2" r="1.6" fill="${P}"/>`,
};

// ---------- 다른 주제: 방·거리 틀 + 위치 이름에 맞는 소품 ----------
// 구역 12개 = 걷는 순서. 구역마다 벽 자리(w)와 바닥 자리(f)
const ZONES = [
  { w: ['L', 8.5], f: [1.9, 8.1] }, { w: ['L', 6.1], f: [1.9, 5.8] }, { w: ['L', 3.7], f: [1.9, 3.5] }, { w: ['L', 1.4], f: [1.8, 1.7] },
  { w: ['R', 2.8], f: [3.4, 1.9] }, { w: ['R', 5.2], f: [5.6, 1.9] }, { w: ['R', 7.6], f: [7.8, 1.9] },
  { f: [8.4, 4.1] }, { f: [8.4, 6.6] }, { f: [6.6, 7.7] }, { f: [4.2, 7.7] }, { f: [4.9, 4.9] },
];
const KIND = [
  ['stall', /문구점|진열대|좌판|가판|매대|꽂이/], ['door', /문(?!구)|입구|현관|중문|정문|회전문/], ['window', /창|쇼윈도|진열장|유리/],
  ['sign', /간판|게시판|광고판|현수막|전광판|안내판|표지|이정표|달력|일력|포스터/], ['mirror', /거울/],
  ['shelf', /선반|책장|찬장|약장|이불장|옷장|서랍|행거|수납/],
  ['seat', /의자|소파|벤치|평상|침대|매트/], ['table', /탁자|테이블|책상|식탁|계산대|카운터|프런트|창구|접수대|시연대|배식대|수리대|화장대|협탁|탁/],
  ['pole', /가로등|전봇대|기둥|게양대|스피커|확성기|시계탑|충전기|정류장|분수대|아치|조형물|표지석|굴뚝|커튼봉|지붕/], ['plant', /화분|잔디|정원/],
  ['steps', /계단|둑길|전망대/], ['appliance', /냉장고|세탁기|전자레인지|가스레인지|싱크대|욕조|세면대|TV|콘센트|ATM|기계|인화기|보관함|쓰레기|수거함|오토바이|차량|트럭|도로/],
];
const WALL_KINDS = ['door', 'window', 'sign', 'mirror', 'shelf'];
const kindOf = locus => (KIND.find(([, re]) => re.test(locus)) || ['box'])[0];
function hueOf(name) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }

function layout(els) {
  const n = els.length, used = new Set(), out = {};
  els.forEach((e, i) => {
    const k = kindOf(e.locus), wantWall = WALL_KINDS.includes(k);
    const z0 = Math.floor(i * ZONES.length / n);
    const order = [...ZONES.keys()].filter(z => z >= z0).concat([...ZONES.keys()].filter(z => z < z0).reverse());
    for (const z of order) {
      const Z = ZONES[z], tryList = wantWall ? ['w', 'f'] : ['f', 'w'];
      const pick = tryList.find(t => Z[t] && !used.has(z + t));
      if (pick) { used.add(z + pick); out[e.no] = { zone: z, at: pick, kind: k, Z }; return; }
    }
  });
  return out;
}

function propArt(slot, hue) {
  const { at, kind, Z } = slot, acc = `hsl(${hue} 55% 52%)`;
  if (at === 'w') {
    const [pl, c] = Z.w;
    if (kind === 'door') return { s: wrect(pl, c, 0, 2.0, 5.6, 'var(--wood)') + wrect(pl, c, 0.3, 1.5, 5.0, 'var(--wood)', 'sh-l') + ring(...wpt(pl, c + 0.55, 2.8), 0.14, pl, 'var(--glow)'), m: wpt(pl, c, 3.4) };
    if (kind === 'window') return { s: wrect(pl, c, 2.4, 2.6, 3.0, 'var(--paper)') + wrect(pl, c, 2.6, 2.2, 2.6, 'var(--glass)') + line(wpt(pl, c, 2.6), wpt(pl, c, 5.2), 'var(--paper)', 3) + line(wpt(pl, c - 1.1, 3.9), wpt(pl, c + 1.1, 3.9), 'var(--paper)', 3), m: wpt(pl, c, 3.9) };
    if (kind === 'sign') return { s: wrect(pl, c, 3.8, 2.4, 1.6, acc) + line(wpt(pl, c - 0.8, 4.8), wpt(pl, c + 0.8, 4.8), 'var(--paper)', 3) + line(wpt(pl, c - 0.8, 4.3), wpt(pl, c + 0.4, 4.3), 'var(--paper)', 3), m: wpt(pl, c, 4.6) };
    if (kind === 'mirror') return { s: wrect(pl, c, 2.6, 1.6, 2.6, 'var(--paper)') + wrect(pl, c, 2.75, 1.3, 2.3, 'var(--glass)') + line(wpt(pl, c - 0.4, 3.2), wpt(pl, c + 0.2, 4.4), 'var(--paper)', 2), m: wpt(pl, c, 3.9) };
    // 선반(벽에 붙은 장)
    const b = pl === 'L' ? box(0.02, c - 1.0, 2.6, 0.6, 2.0, 0.25, 'var(--wood)') + box(0.02, c - 1.0, 4.0, 0.6, 2.0, 0.25, 'var(--wood)') + box(0.1, c - 0.8, 2.85, 0.3, 0.3, 0.8, acc) + box(0.1, c + 0.2, 4.25, 0.3, 0.5, 0.6, 'var(--cushion)')
                         : box(c - 1.0, 0.02, 2.6, 2.0, 0.6, 0.25, 'var(--wood)') + box(c - 1.0, 0.02, 4.0, 2.0, 0.6, 0.25, 'var(--wood)') + box(c - 0.8, 0.1, 2.85, 0.3, 0.3, 0.8, acc) + box(c + 0.2, 0.1, 4.25, 0.5, 0.3, 0.6, 'var(--cushion)');
    return { s: b, m: wpt(pl, c, 3.7) };
  }
  const [x, y] = Z.f;
  switch (kind) {
    case 'seat': return { s: box(x - 0.8, y - 0.5, 0, 1.6, 1.0, 0.8, 'var(--sofa)') + box(x - 0.8, y - 0.5, 0.8, 0.35, 1.0, 0.9, 'var(--sofa)'), m: [x, y, 1.3] };
    case 'table': return { s: box(x - 0.9, y - 0.6, 1.0, 1.8, 1.2, 0.2, 'var(--wood)') + box(x - 0.8, y + 0.4, 0, 0.15, 0.15, 1.0, 'var(--wood)') + box(x + 0.65, y + 0.4, 0, 0.15, 0.15, 1.0, 'var(--wood)'), m: [x, y, 1.5] };
    case 'stall': return { s: box(x - 0.9, y - 0.6, 0, 1.8, 1.2, 1.0, 'var(--wood)') + box(x - 0.7, y - 0.4, 1.0, 0.4, 0.4, 0.3, acc) + box(x + 0.1, y - 0.3, 1.0, 0.4, 0.4, 0.4, 'var(--cushion)') + poly([[x - 1.1, y - 0.8, 2.6], [x + 1.1, y - 0.8, 2.6], [x + 1.1, y + 0.8, 2.1], [x - 1.1, y + 0.8, 2.1]], acc, 'sh-r'), m: [x, y, 2.0] };
    case 'pole': return { s: box(x - 0.1, y - 0.1, 0, 0.2, 0.2, 3.2, 'var(--metal)') + box(x - 0.45, y - 0.45, 3.2, 0.9, 0.9, 0.35, acc), m: [x, y, 2.4] };
    case 'plant': { let s = box(x - 0.4, y - 0.4, 0, 0.8, 0.8, 0.8, 'var(--wood)'); [[0, 0, 1.4, 0.5], [-0.3, 0, 1.9, 0.4], [0.3, 0.1, 2.0, 0.4]].forEach(([dx, dy, z, r]) => { const [cx, cy] = iso(x + dx, y + dy, z); s += `<ellipse cx="${cx}" cy="${cy}" rx="${r * S}" ry="${r * S * 0.8}" style="fill:var(--good)" opacity=".85"/>`; }); return { s, m: [x, y, 1.2] }; }
    case 'steps': return { s: box(x - 0.9, y - 0.9, 0, 1.8, 1.8, 0.35, 'var(--metal)') + box(x - 0.9, y - 0.9, 0.35, 1.2, 1.8, 0.35, 'var(--metal)') + box(x - 0.9, y - 0.9, 0.7, 0.6, 1.8, 0.35, 'var(--metal)'), m: [x, y, 1.2] };
    case 'appliance': return { s: box(x - 0.6, y - 0.6, 0, 1.2, 1.2, 1.8, 'var(--paper)') + poly([[x + 0.6, y - 0.4, 0.4], [x + 0.6, y + 0.4, 0.4], [x + 0.6, y + 0.4, 1.4], [x + 0.6, y - 0.4, 1.4]], 'var(--dark)'), m: [x, y, 1.9] };
    default:
      if (WALL_KINDS.includes(kind)) return { s: box(x - 0.08, y - 0.08, 0, 0.16, 0.16, 2.2, 'var(--metal)') + poly([[x - 0.1, y - 0.9, 2.0], [x - 0.1, y + 0.9, 2.0], [x - 0.1, y + 0.9, 3.2], [x - 0.1, y - 0.9, 3.2]], kind === 'window' ? 'var(--glass)' : acc), m: [x, y, 2.6] };
      return { s: box(x - 0.5, y - 0.5, 0, 1.0, 1.0, 1.0, 'var(--paper)') + box(x - 0.35, y - 0.35, 1.0, 0.7, 0.7, 0.15, acc), m: [x, y, 1.2] };
  }
}

function roomArtFor(t) {
  const hue = hueOf(t.name);
  let s = '';
  if (t.kind === '서베이') {
    s += poly([[0, 0, 0], [0, 10, 0], [0, 10, 9], [0, 0, 9]], tint('--wall-l', hue)) + poly([[0, 0, 0], [10, 0, 0], [10, 0, 9], [0, 0, 9]], tint('--wall-r', hue)) + poly([[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]], 'var(--floor)');
    for (let i = 1; i < 10; i++) s += line([i, 0, 0], [i, 10, 0], 'var(--floor-line)', 1);
    s += poly([[3.2, 3.2, 0], [7.4, 3.2, 0], [7.4, 6.6, 0], [3.2, 6.6, 0]], tint('--rug', hue, 35));
    s += line([0, 0, 8.6], [0, 10, 8.6], 'var(--paper)', 2) + line([0, 0, 8.6], [10, 0, 8.6], 'var(--paper)', 2);
  } else {
    // 동네 길: 보도블록 + 앞쪽 차도, 뒤쪽은 가게 건물 두 줄
    s += poly([[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]], 'var(--pave)');
    for (let i = 1; i < 10; i++) s += line([i, 0, 0], [i, 8.6, 0], 'var(--floor-line)', 0.7) + line([0, i * 0.86, 0], [10, i * 0.86, 0], 'var(--floor-line)', 0.7);
    s += poly([[0, 8.7, 0], [10, 8.7, 0], [10, 10, 0], [0, 10, 0]], 'var(--road)');
    for (let i = 0.5; i < 10; i += 1.6) s += line([i, 9.35, 0.01], [i + 0.8, 9.35, 0.01], 'var(--paper)', 2);
    s += poly([[0, 0, 0], [0, 10, 0], [0, 10, 9], [0, 0, 9]], tint('--brick', hue, 15)) + poly([[0, 0, 0], [10, 0, 0], [10, 0, 9], [0, 0, 9]], tint('--brick', hue + 40, 15));
    for (let c = 1.2; c < 10; c += 2.4) { s += lw(c - 0.7, 6.4, 1.4, 1.5, 'var(--glass)') + rw(c - 0.7, 6.4, 1.4, 1.5, 'var(--glass)'); }
    s += line([0, 0, 5.9], [0, 10, 5.9], 'var(--paper)', 3) + line([0, 0, 5.9], [10, 0, 5.9], 'var(--paper)', 3);
  }
  return s;
}

// ---------- 주제 데이터 ----------
function buildTopic(name) {
  const t = Data.topic(name); if (!t) return null;
  const els = t.chain.map((n, i) => {
    const info = Data.el(t, n);
    let link = info.link || '', why = '';
    const m = link.match(/^(.*)\s\(([^()]*)\)\s*$/); if (m) { link = m[1].trim(); why = m[2].trim(); }
    const scenes = [info.scene, info.scene1, info.scene2].filter(Boolean).map(v => {
      const [txt, nx = ''] = v.split('→');
      return { t: txt.trim(), next: nx.replace(/\(.*?\)/g, '').split('/').map(x => x.trim()).filter(x => t.chain.includes(x)) };
    });
    const s = info.scripts[0];
    const q = Data.question(info).en;
    return { name: n, type: info.type, no: info.locusNo || i + 1, locus: info.locus || `위치 ${i + 1}`, symbol: info.symbol, emoji: EMOJI[info.symbol] || '❔',
      link, why, signal: info.signal, scenes, q: info.answer.partial ? '' : q, refs: info.answer.refs, partial: info.answer.partial,
      sents: s ? Kw.forScript(s).sents.map(x => ({ t: x.text, k: x.kws })) : [] };
  });
  return { name, kind: Data.topicType(t), place: Data.place(t), chain: t.chain, combos: t.combos, els };
}

// ---------- 상태 ----------
const KEY = 'opicTrainer.palaceGame.';
const store = { get: (k, d) => U.lsGet(KEY + k, d), set: (k, v) => U.lsSet(KEY + k, v) };
let T, EL, tree, POS, ART, root, svg, panel, storyEl;
const st = { mode: 'walk', visited: new Set(), cur: null, combosDone: new Set(), streak: 0, best: 0, quiz: null };
const save = () => { store.set('mode', st.mode); store.set('topic', T.name); store.set('t.' + T.name + '.visited', [...st.visited]); store.set('t.' + T.name + '.combos', [...st.combosDone]); store.set('best', st.best); };

function loadTopic(name) {
  T = buildTopic(name);
  EL = Object.fromEntries(T.els.map(e => [e.name, e]));
  tree = { as1: {}, q3by: {}, pair: {} };
  const add = (m, k, v) => { (m[k] = m[k] || []).includes(v) || m[k].push(v); };
  T.combos.forEach(c => { if (c.length === 3) { add(tree.as1, c[0], c[1]); add(tree.q3by, c[0] + '|' + c[1], c[2]); } else add(tree.pair, c[0], c[1]); });
  if (T.name === '집' && T.els.every(e => HOME_LOCI[e.no])) { POS = HOME_LOCI; ART = homeArt(); }
  else {
    const slots = layout(T.els), hue = hueOf(T.name), props = []; POS = {};
    T.els.forEach(e => { const p = propArt(slots[e.no], hue); POS[e.no] = p.m; props.push({ s: `<g><title>${e.no}. ${esc(e.locus)}</title>${p.s}</g>`, d: slots[e.no].at === 'w' ? -1 : p.m[0] + p.m[1] }); });
    props.sort((a, b) => a.d - b.d);
    ART = roomArtFor(T) + props.map(p => p.s).join('');
  }
  st.visited = new Set(store.get('t.' + T.name + '.visited', [])); st.combosDone = new Set(store.get('t.' + T.name + '.combos', []));
  st.cur = null; st.quiz = null;
}
const candidates = (combo, step) => (combo.length === 3 ? (step === 0 ? tree.as1[combo[0]] : tree.q3by[combo[0] + '|' + combo[1]]) : tree.pair[combo[0]]) || [];
const nextsOf = e => [...new Set(e.scenes.flatMap(s => s.next))];
const pos = no => iso(...POS[no]);
const byNo = no => T.els.find(e => e.no === no);
const isHome = () => T.name === '집';
const homeIcon = e => isHome() && HOME_ICON[e.symbol];
const iconInner = e => homeIcon(e) ? `<g transform="scale(.93)">${HOME_ICON[e.symbol]}</g>` : `<text>${e.emoji}</text>`;
const iconHtml = e => homeIcon(e) ? `<svg viewBox="-20 -20 40 40" aria-hidden="true">${HOME_ICON[e.symbol]}</svg>` : `<span aria-hidden="true">${e.emoji}</span>`;
const say = text => { if (text) TTS.play(text, 'once', { title: T.name }); };

// ---------- 방 그리기 ----------
function drawRoom(opts = {}) {
  const { classes = {}, symbols = [], ghosts = [], beams = [], popId = null, mini = [] } = opts;
  let s = ART;
  s += `<polyline class="pg-path" points="${T.els.map(e => e.no).sort((a, b) => a - b).map(n => { const l = POS[n]; return pt(iso(l[0], l[1], 0.02)); }).join(' ')}"/>`;
  beams.forEach(([a, b]) => { const [x1, y1] = pos(a), [x2, y2] = pos(b); s += `<path class="pg-beam" d="M${x1},${y1} Q${(x1 + x2) / 2},${Math.min(y1, y2) - 60} ${x2},${y2}"/>`; });
  T.els.forEach(e => {
    const [x, y] = pos(e.no);
    const inner = mini.includes(e.no) && !symbols.includes(e.no)
      ? `<circle class="ring" cx="${x}" cy="${y}" r="14"/>${homeIcon(e) ? `<g transform="translate(${x},${y}) scale(.5)">${HOME_ICON[e.symbol]}</g>` : `<text class="emo" x="${x}" y="${y + 1}">${e.emoji}</text>`}
         <circle cx="${x + 12}" cy="${y - 11}" r="7.5" style="fill:var(--accent)" stroke="#fff" stroke-width="1.5"/><text x="${x + 12}" y="${y - 10.5}" style="fill:#fff;font-size:9px">${e.no}</text>`
      : `<circle class="ring" cx="${x}" cy="${y}" r="12"/><text x="${x}" y="${y + 0.5}">${e.no}</text>`;
    s += `<g class="pg-locus ${classes[e.no] || ''}" data-no="${e.no}" tabindex="0" role="button" aria-label="${e.no}번 ${esc(e.locus)}"><title>${e.no}. ${esc(e.locus)}</title>
      <circle class="pulse" cx="${x}" cy="${y}" r="13"/><circle cx="${x}" cy="${y}" r="22" fill="transparent"/>${inner}</g>`;
  });
  [...ghosts.map(n => [n, true]), ...symbols.map(n => [n, false])].forEach(([no, ghost]) => {
    const e = byNo(no), [x, y] = pos(no);
    s += `<g class="pg-sym ${ghost ? 'ghost' : ''} ${popId === no ? 'pop' : ''}"><g transform="translate(${x},${y - 40})">
      <path class="bubble" d="M-24 -22 h48 a6 6 0 0 1 6 6 v32 a6 6 0 0 1 -6 6 h-18 l-6 8 l-6 -8 h-18 a6 6 0 0 1 -6 -6 v-32 a6 6 0 0 1 6 -6 z"/>
      <g transform="translate(0,-1)">${iconInner(e)}</g></g></g>`;
  });
  svg.innerHTML = s;
}

// ---------- 패널 조각 ----------
function keywordBlock(e) {
  if (!e.sents.length) return '<p class="pg-hint">연결된 모범답변이 없습니다.</p>';
  return `<details class="pg-kws"><summary>답변 키워드 (${e.refs[0]}${e.partial ? ', 일부만 맞는 답변' : ''})</summary><div class="pg-sents">
    ${e.sents.map((x, i) => { const sa = UI.say(x.t, ''); return `<div class="pg-sent"><span class="n">${i + 1}</span><div class="flex flex-wrap gap-1">${(x.k.length ? x.k : ['문장 듣기']).map(k => `<button class="chip chip-blue kw-chip" ${sa}>${esc(k)}</button>`).join('')}</div></div>`; }).join('')}
  </div></details>`;
}
function questionBlock(e, showSignal = true) {
  const q = e.q;
  const text = q ? esc(q).replace(new RegExp(esc(e.signal).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), m => `<span class="pg-signal">${m}</span>`) : `… <span class="pg-signal">${esc(e.signal)}</span> …`;
  return `<p class="pg-q">${text}</p><div class="flex flex-wrap items-center gap-2"><button class="btn btn-soft text-sm" ${UI.say(q || e.signal)}><i class="fas fa-volume-high"></i> 질문 듣기</button>${showSignal ? `<span class="pg-hint">신호: <b>${esc(e.signal)}</b></span>` : ''}</div>`;
}
const nxtLabel = n => `${EL[n].no}. ${esc(EL[n].symbol)}`;
const sceneBlock = e => e.scenes.length
  ? e.scenes.map(sc => `<div class="scene text-sm">🎬 ${esc(sc.t)}<div class="pg-hint mt-1">→ 다음 후보: ${sc.next.map(nxtLabel).join(' · ')}</div></div>`).join('')
  : '<div class="scene text-sm">이 질문은 콤보의 마지막으로 나옵니다.</div>';
const linkCard = e => `<div class="pg-link">
    <div class="pg-link-head"><span class="place">📍 ${e.no}. ${esc(e.locus)}</span><span class="pg-hint">+</span><span class="obj">${esc(e.symbol)}</span></div>
    <div class="flex items-center gap-3"><div class="pg-badge">${iconHtml(e)}</div><p>${e.link ? esc(e.link) : '<span class="missing">연결 서술 미작성 (궁전 탭 연필 버튼으로 쓸 수 있음)</span>'}</p></div>
    ${e.why ? `<div class="pg-hint">왜 이 질문? ${esc(e.why)}</div>` : ''}</div>`;

function drawHeader() {
  root.querySelector('.pg-sub').textContent = `${T.kind} · ${T.place} · 위치 ${T.els.length}곳 · 콤보 ${T.combos.length}개`;
  root.querySelector('.pg-stats').innerHTML = `<span class="pg-stat">걸은 위치 <b>${st.visited.size}</b>/${T.els.length}</span><span class="pg-stat">완성한 콤보 <b>${st.combosDone.size}</b>/${T.combos.length}</span><span class="pg-stat">연속 정답 <b>${st.streak}</b> · 최고 ${st.best}</span>`;
  root.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === st.mode));
  root.querySelectorAll('.pg-pick').forEach(b => {
    b.classList.toggle('on', b.dataset.t === T.name);
    const t = Data.topic(b.dataset.t);
    b.classList.toggle('done', !!t && store.get('t.' + t.name + '.combos', []).length >= t.combos.length);
  });
}

// ---------- ① 걷기 ----------
const nextNo = () => { for (const e of T.els) if (!st.visited.has(e.no)) return e.no; return null; };
function renderWalk(pop) {
  UI.sayMap.clear();
  const nx = nextNo(), classes = {};
  st.visited.forEach(n => classes[n] = 'visited');
  if (nx) classes[nx] = (classes[nx] || '') + ' next';
  const cur = st.cur ? byNo(st.cur) : null;
  if (cur) classes[cur.no] += ' current';
  const nexts = cur ? nextsOf(cur).map(n => EL[n].no) : [];
  drawRoom({ classes, symbols: cur ? [cur.no] : [], mini: [...st.visited], beams: nexts.map(n => [cur.no, n]), popId: pop, ghosts: nexts });
  drawStory(cur ? cur.no : null);
  if (!cur) {
    panel.innerHTML = `<span class="pg-eyebrow">① 걷기 · 사슬 순서대로</span>
      <h2 class="pg-title">${nx ? `${nx}번 위치부터 걸어 보세요` : `${T.els.length}곳을 모두 걸었습니다`}</h2>
      <p class="pg-hint">${nx ? `빛나는 ${nx}번(${esc(byNo(nx).locus)})을 누르면 그 자리에 기호가 나타나고, 기호가 다음에 올 수 있는 질문 쪽으로 빛을 쏩니다.` : '이제 ② 다음 질문 맞히기에서 콤보를 맞혀 보세요.'}</p>
      ${nx ? '' : '<div class="flex gap-2"><button class="btn btn-primary text-sm" data-act="toQuiz">② 다음 질문 맞히기</button><button class="btn btn-gray text-sm" data-act="resetWalk">처음부터 다시 걷기</button></div>'}`;
    return;
  }
  const nn = nextNo();
  panel.innerHTML = `<span class="pg-eyebrow">${cur.no} / ${T.els.length} · ${esc(cur.type)} 질문 · ${esc(cur.name)}</span>
    <h2 class="pg-title">${cur.no}. ${esc(cur.locus)}</h2>
    ${linkCard(cur)}${questionBlock(cur)}${sceneBlock(cur)}${keywordBlock(cur)}
    <div>${nn ? `<button class="btn btn-primary text-sm" data-act="walkNext">다음: ${nn}. ${esc(byNo(nn).locus)}</button>` : '<button class="btn btn-primary text-sm" data-act="toQuiz">사슬 완주! ② 다음 질문 맞히기</button>'}</div>`;
}
function walkTo(no) {
  const nx = nextNo();
  if (!st.visited.has(no) && no !== nx) { flash(no, 'shake'); UI.toast(`순서대로 걸어요. 다음은 ${nx}번 ${byNo(nx).locus}입니다.`); return; }
  const fresh = !st.visited.has(no);
  st.visited.add(no); st.cur = no; save(); drawHeader(); renderWalk(fresh ? no : null);
}

// ---------- ② 다음 질문 맞히기 ----------
function newCombo() {
  const all = T.combos.map((c, i) => i), left = all.filter(i => !st.combosDone.has(i)), pool = left.length ? left : all;
  const idx = pool[Math.floor(Math.random() * pool.length)];
  st.quiz = { idx, combo: T.combos[idx], step: 0, phase: 'find', misses: 0, found: [], picks: new Set(), result: null };
}
function renderQuiz(pop) {
  UI.sayMap.clear();
  if (!st.quiz) newCombo();
  const z = st.quiz, e = EL[z.combo[z.step]], classes = {}, found = z.found.map(n => EL[n].no);
  let beams = [], ghosts = [];
  found.forEach(n => classes[n] = 'right');
  if (z.phase === 'find' && z.misses >= 2) classes[e.no] = 'cand';
  if (z.phase === 'predict') z.picks.forEach(n => classes[n] = 'picked');
  if (z.phase === 'checked') {
    const cand = candidates(z.combo, z.step).map(n => EL[n].no);
    cand.forEach(n => classes[n] = z.picks.has(n) ? 'right' : 'missed');
    z.picks.forEach(n => { if (!cand.includes(n)) classes[n] = 'wrong'; });
    beams = cand.map(n => [e.no, n]); ghosts = cand.filter(n => !found.includes(n));
  }
  const last = found.length ? found[found.length - 1] : null;
  drawRoom({ classes, symbols: z.phase === 'find' ? [] : (last ? [last] : []), mini: found, beams, ghosts, popId: pop });
  drawStory(z.phase === 'find' ? null : last);
  const head = `<span class="pg-eyebrow">② 콤보 ${z.idx + 1} · 질문 ${Math.min(z.step + 1, z.combo.length)} / ${z.combo.length}</span>`;
  const trail = `<div class="flex flex-wrap items-center gap-1">${z.combo.map((n, i) => `<span class="chip ${i < z.found.length ? 'chip-blue' : ''}">${i < z.found.length ? `${EL[n].no}. ${esc(EL[n].symbol)}` : `질문 ${i + 1}`}</span>`).join('<span class="pg-hint">→</span>')}</div>`;
  if (z.phase === 'find') {
    panel.innerHTML = `${head}${trail}<h2 class="pg-title">이 질문의 기호는 어디에 있나요?</h2>${questionBlock(e, false)}
      <p class="pg-hint">방에서 이 질문의 기호가 놓인 번호를 누르세요.${z.misses ? ` 틀린 횟수 ${z.misses}` : ''}${z.misses >= 2 ? ' · 정답 위치가 깜빡입니다.' : ''}</p>
      ${z.result ? `<div class="pg-msg bad">${z.result}</div>` : ''}`;
  } else if (z.phase === 'predict') {
    const cand = candidates(z.combo, z.step);
    panel.innerHTML = `${head}${trail}<div class="pg-msg good">정답! ${e.no}. ${esc(e.locus)} · <b>${esc(e.symbol)}</b></div>${linkCard(e)}
      <h2 class="pg-title">다음에 나올 수 있는 질문은?</h2>
      <p class="pg-hint">기호가 얽히는 장면을 떠올리며, 다음 후보 위치 <b>${cand.length}곳</b>을 방에서 골라 주세요. 다시 누르면 취소됩니다.</p>
      <div class="flex gap-2"><button class="btn btn-primary text-sm" data-act="check" ${z.picks.size ? '' : 'disabled'}>확인 (${z.picks.size}곳 고름)</button><button class="btn btn-gray text-sm" data-act="giveUp">모르겠어요</button></div>${keywordBlock(e)}`;
  } else if (z.phase === 'checked') {
    const cand = candidates(z.combo, z.step).map(n => EL[n].no), hit = cand.filter(n => z.picks.has(n)).length, extra = [...z.picks].filter(n => !cand.includes(n)).length;
    panel.innerHTML = `${head}${trail}<div class="pg-msg ${hit === cand.length && !extra ? 'good' : 'info'}">후보 ${cand.length}곳 중 ${hit}곳 맞힘${extra ? ` · 후보가 아닌 곳 ${extra}곳` : ''}</div>
      ${sceneBlock(e)}<p class="pg-hint">실제 시험에서는 이 중 하나가 나옵니다. 이번 콤보의 다음 질문을 들어 보세요.</p>
      <div><button class="btn btn-primary text-sm" data-act="nextQ">다음 질문 듣기 (질문 ${z.step + 2})</button></div>`;
  } else {
    st.combosDone.add(z.idx); save(); drawHeader();
    panel.innerHTML = `${head}${trail}<div class="pg-msg good"><b>콤보 완성!</b> ${z.combo.map(n => esc(EL[n].symbol)).join(' → ')}</div>${linkCard(e)}
      <p class="pg-hint">각 질문의 키워드를 보며 말로 이어 보세요.</p>${z.combo.map(n => keywordBlock(EL[n])).join('')}
      <div><button class="btn btn-primary text-sm" data-act="newCombo">${st.combosDone.size >= T.combos.length ? `${T.combos.length}개 모두 완성 · 다시 섞기` : '다른 콤보'}</button></div>`;
  }
}
function quizTap(no) {
  const z = st.quiz, e = EL[z.combo[z.step]];
  if (z.phase === 'find') {
    if (no === e.no) {
      z.found.push(e.name); st.streak++; st.best = Math.max(st.best, st.streak); save(); drawHeader();
      z.phase = z.step < z.combo.length - 1 ? 'predict' : 'done'; z.picks = new Set(); z.result = null; renderQuiz(no);
    } else { z.misses++; st.streak = 0; drawHeader(); z.result = `${no}번(${esc(byNo(no).symbol)})이 아닙니다.`; renderQuiz(); flash(no, 'wrong shake'); }
  } else if (z.phase === 'predict') {
    if (z.found.some(n => EL[n].no === no)) return;
    z.picks.has(no) ? z.picks.delete(no) : z.picks.add(no); renderQuiz();
  }
}

// ---------- 옆 목록: 한 바퀴 이야기 ----------
function drawStory(activeNo) {
  storyEl.innerHTML = T.els.map(e => {
    const locked = st.mode === 'walk' && !st.visited.has(e.no) && e.no !== nextNo();
    return `<li class="pg-item ${e.no === activeNo ? 'on' : ''} ${locked ? 'locked' : ''}" data-story="${e.no}">
      <span class="si">${iconHtml(e)}</span><div class="st">${e.no}. ${esc(e.locus)} <span>+ ${esc(e.symbol)} · ${esc(e.name)}</span></div>
      <p>${esc(e.link)}</p>
      ${e.scenes.length ? e.scenes.map(sc => `<div class="to">장면: ${esc(sc.t)} → <b>${sc.next.map(nxtLabel).join(' · ')}</b></div>`).join('') : '<div class="to">콤보의 마지막 질문 (다음 후보 없음)</div>'}</li>`;
  }).join('');
  root.querySelector('.pg-combos').innerHTML = `<b>콤보 ${T.combos.length}개</b>` + T.combos.map((c, i) =>
    `<div class="${st.combosDone.has(i) ? 'done' : ''}">${st.combosDone.has(i) ? '✓' : '·'} ${c.map(n => esc(EL[n].symbol)).join(' → ')} <span class="pg-hint">(${c.map(esc).join(' / ')})</span></div>`).join('');
  const on = storyEl.querySelector('.on');
  if (on) storyEl.scrollTo({ top: on.offsetTop - storyEl.offsetTop - 8, behavior: 'smooth' });
}

function flash(no, cls) { const g = svg.querySelector(`.pg-locus[data-no="${no}"]`); if (!g) return; g.classList.add(...cls.split(' ')); setTimeout(() => g.classList.remove(...cls.split(' ')), 600); }
const ACT = {
  walkNext: () => { const n = nextNo(); if (n) walkTo(n); },
  toQuiz: () => setMode('quiz'),
  resetWalk: () => { st.visited.clear(); st.cur = null; save(); draw(); },
  check: () => { st.quiz.phase = 'checked'; renderQuiz(); },
  giveUp: () => { st.quiz.picks = new Set(); st.quiz.phase = 'checked'; st.streak = 0; drawHeader(); renderQuiz(); },
  nextQ: () => { const z = st.quiz; z.step++; z.phase = 'find'; z.misses = 0; z.result = null; renderQuiz(); const e = EL[z.combo[z.step]]; if (Settings.v.autoQuestion) say(e.q || e.signal); },
  newCombo: () => { if (st.combosDone.size >= T.combos.length) st.combosDone.clear(); newCombo(); renderQuiz(); },
};
function draw() { drawHeader(); st.mode === 'walk' ? renderWalk() : renderQuiz(); }
function setMode(m) { st.mode = m; save(); draw(); }

function render(el, name) {
  const topics = Data.topics();
  if (!topics.length) { el.innerHTML = '<div class="wrap"><p class="missing">주제가 없습니다</p></div>'; return; }
  const want = name && Data.topic(name) ? name : (Data.topic(store.get('topic', '')) ? store.get('topic', '') : topics[0].name);
  st.mode = store.get('mode', 'walk'); st.best = store.get('best', 0); st.streak = 0;
  loadTopic(want);
  UI.title(`궁전 게임 · ${T.name}`, true);
  const mk = t => `<button class="pg-pick" data-t="${esc(t.name)}">${esc(t.name)}${Data.topicType(t) === '서베이' ? `<small>${esc(Data.place(t))}</small>` : ''}</button>`;
  el.innerHTML = `<div class="pg">
    <div class="pg-top"><div><div class="pg-sub"></div></div><div class="pg-stats"></div></div>
    <nav class="pg-picker" aria-label="주제 고르기">
      <div class="pg-row"><span>서베이 · 방</span>${Data.topics('서베이').map(mk).join('')}</div>
      <div class="pg-row"><span>공통형 · 길</span>${Data.topics('공통형').map(mk).join('')}</div>
    </nav>
    <div class="pg-modes" role="tablist" aria-label="게임 단계"><button data-mode="walk">① 걷기</button><button data-mode="quiz">② 다음 질문 맞히기</button></div>
    <div class="pg-stage">
      <div class="pg-room"><div class="pg-room-label"><b>${esc(T.kind === '서베이' ? T.place : T.place.replace(/\s*\(.*\)/, ''))}</b><span>${esc(T.name)}</span></div>
        <svg viewBox="0 0 440 488" role="img" aria-label="방 그림. 번호를 누르면 그 위치로 갑니다"></svg>
        <div class="pg-legend"><span><i style="background:var(--accent)"></i>들른 위치</span><span><i style="background:var(--glow)"></i>다음·후보</span><span><i style="background:var(--good)"></i>정답</span></div></div>
      <section class="pg-panel" aria-live="polite"></section>
      <aside class="pg-story" aria-label="전체 연결 이야기"><h2>${esc(T.kind === '서베이' ? T.place : '동네 길')} 한 바퀴 이야기</h2>
        <p class="pg-hint">위치 + 기호 → 장면 → 다음 후보 순서입니다. 누르면 그 위치를 엽니다.</p>
        <ol class="pg-list"></ol><div class="pg-combos"></div></aside>
    </div></div>`;
  root = el.querySelector('.pg'); svg = root.querySelector('svg'); panel = root.querySelector('.pg-panel'); storyEl = root.querySelector('.pg-list');
  svg.addEventListener('click', e => { const g = e.target.closest('.pg-locus'); if (g) onLocus(+g.dataset.no); });
  svg.addEventListener('keydown', e => { const g = e.target.closest('.pg-locus'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onLocus(+g.dataset.no); } });
  root.querySelector('.pg-picker').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) location.replace('#/palace/game/' + encodeURIComponent(b.dataset.t)); });
  root.querySelector('.pg-modes').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); });
  panel.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a && ACT[a.dataset.act]) ACT[a.dataset.act](a); });
  storyEl.addEventListener('click', ev => {
    const it = ev.target.closest('[data-story]'); if (!it) return;
    const no = +it.dataset.story;
    if (st.mode === 'walk') walkTo(no); else { const e = byNo(no); UI.toast(`${no}. ${e.locus} + ${e.symbol}`); }
  });
  save(); draw();
  const on = root.querySelector('.pg-pick.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
}
function onLocus(no) { st.mode === 'walk' ? walkTo(no) : quizTap(no); }

return { render, buildTopic, _state: st, _layout: layout };
})();

