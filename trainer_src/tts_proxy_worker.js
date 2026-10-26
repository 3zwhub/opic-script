/**
 * ============================================================
 *  TTS Proxy Worker  (Cloudflare Workers)
 * ------------------------------------------------------------
 *  POST /tts     -> Edge(Read Aloud) 음성을 MP3로 반환
 *  GET  /debug   -> Edge 연결 진단 (?text=...&voice=...)
 *  GET  /        -> 상태 확인
 *
 *  브라우저에서 Edge TTS에 직접 붙으면 403이 납니다.
 *  Origin / User-Agent 같은 헤더는 브라우저 JS가 못 바꾸고,
 *  Sec-MS-GEC(시간 기반 토큰)도 붙여야 하기 때문입니다.
 *  이 Worker가 그 두 가지를 대신 처리합니다.
 *
 *  2026-10: MS가 토큰을 v2(변형 SHA-256 + CS64, "16hex-64hex")로 바꾸고
 *  Sec-MS-GEC-Version 앞자리를 2로, muid 쿠키를 요구하게 되어 이에 맞췄습니다.
 *  (edge-tts 7.3.1 의 src/edge_tts/drm.py 를 그대로 옮김)
 * ============================================================
 */

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WIN_EPOCH = 11644473600n; // 1601-01-01 ~ 1970-01-01 (초)

// ⚠️ MS가 Edge 릴리스마다 이 버전을 올립니다. 언젠가 403이 다시 나면
//    https://github.com/rany2/edge-tts/blob/master/src/edge_tts/constants.py
//    의 CHROMIUM_FULL_VERSION, SEC_MS_GEC_VERSION 과 drm.py 가 바뀌었는지 확인하세요.
const CHROMIUM_FULL_VERSION = "143.0.3650.75";
const CHROMIUM_MAJOR = CHROMIUM_FULL_VERSION.split(".")[0];
const SEC_MS_GEC_VERSION = `2-${CHROMIUM_FULL_VERSION}`;
const BASE_HOST = "speech.platform.bing.com/consumer/speech/synthesize/readaloud";

const WSS_HEADERS = {
  Pragma: "no-cache",
  "Cache-Control": "no-cache",
  Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ` +
    `Chrome/${CHROMIUM_MAJOR}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR}.0.0.0`,
};

const MAX_CHARS = 1800;   // 한 번의 연결로 보낼 최대 글자 수
const WS_TIMEOUT = 30000; // ms

/* ---------------------------- 유틸 ---------------------------- */

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
    "Access-Control-Max-Age": "86400",
    ...extra,
  };
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ------------------- Sec-MS-GEC v2 토큰 ------------------- */
// 32비트 부호 없는 정수 연산: 곱셈은 Math.imul, 결과는 >>> 0 으로 2^32 나머지를 취합니다.

const SHA_IV = [0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19];
const SHA_STATE = [0xFD9FBEA2, 0x91243CE7, 0xBE499094, 0xCD2E1E0A, 0x6C006F49, 0x04BD35AB, 0xFEB0A7E4, 0x03EFFBD2];
const SHA_SCHEDULE = [0xEB24BF9E, 0x1558691F, 0xA0C09EE2, 0x0CFA32BA, 0xA622EE8C, 0xD1DD9491, 0xC0DD25A0, 0xF9E70AB6, 0xF0C31573, 0x7058CE4E, 0x7188E606, 0x00E5AB33, 0xD258B060, 0x72766564];
const SHA_K = [0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5, 0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3, 0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174, 0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC, 0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA, 0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7, 0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967, 0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13, 0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85, 0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3, 0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070, 0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5, 0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3, 0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208, 0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2];
const SHA_ADJ = 0xC9DC06A7;
const SHA_K_BLOCK = [...SHA_K.slice(0, 14), SHA_ADJ, ...SHA_K.slice(15)];
const SHA_SIGMA0_ADJ = 0x059C0B80;
const SHA_SIGMA1_ADJ = 0x000B92C0;
const CS64_COEF = [[0xE82E91B1, 0xB32700D0], [0x44DE24C6, 0x88DFF51D], [0x3BEB65BC, 0x29514038], [0xC89C5933, 0xB328CBDF], [0x8D1EC211, 0xD405B4D5], [0x314EF5D5, 0x26E55F3C], [0xE92491B1, 0x607801C6], [0xF0A5B9D5, 0x82B2C1FB], [0x06064CF3, 0xFA51A3DA], [0xDA79FA60, 0x207CC464], [0xBED20560, 0x3C3C74F3], [0x89F9C9F8, 0xD2D14B61], [0x35FA38C6, 0xBB04A2C1], [0xCB49E3C6, 0xC5626167]];
const CS64_FACTOR = 0x82893933;
const CS64_ADJ0 = 0xF2F90B1A;
const CS64_ADJ1 = 0x0B1A0000;

const rotr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;
const rol16 = (x) => ((x << 16) | (x >>> 16)) >>> 0;
const bswap = (x) => (((x & 0xff) << 24) | ((x & 0xff00) << 8) | ((x >>> 8) & 0xff00) | (x >>> 24)) >>> 0;
const sigma0 = (x) => (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) >>> 0;
const sigma1 = (x) => (rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10)) >>> 0;
const hex8 = (x) => x.toString(16).toUpperCase().padStart(8, "0");

function shaExpand(w, from) {
  for (let i = from; i < 64; i++) w[i] = (sigma1(w[i - 2]) + w[i - 7] + sigma0(w[i - 15]) + w[i - 16]) >>> 0;
}

function shaRounds(state, w, first = 0) {
  const k = first === 14 ? SHA_K_BLOCK : SHA_K;
  let [a, b, c, d, e, f, g, h] = state;
  for (let i = first; i < 64; i++) {
    const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + (g ^ (e & (f ^ g))) + k[i] + w[i]) >>> 0;
    const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) | (c & (a | b)))) >>> 0;
    h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
  }
  return [a, b, c, d, e, f, g, h];
}

// 토큰 문자열 앞 7바이트로 첫 블록 중간 상태를 만듭니다
function shaInit(d) {
  const w = new Array(14).fill(0);
  w.push(((d[0] << 16) | (d[1] << 8) | d[2]) >>> 0);
  w.push(((d[3] << 24) | (d[4] << 16) | (d[5] << 8) | d[6]) >>> 0);
  for (let i = 16; i < 30; i++) {
    let v = SHA_SCHEDULE[i - 16];
    if (i - 2 >= 14) v += i === 16 ? (sigma1(w[i - 2]) ^ SHA_SIGMA1_ADJ) >>> 0 : sigma1(w[i - 2]);
    if (i - 7 >= 14) v += w[i - 7];
    if (i - 15 >= 14) v += i === 29 ? (sigma0(w[i - 15]) ^ SHA_SIGMA0_ADJ) >>> 0 : sigma0(w[i - 15]);
    w.push(v >>> 0);
  }
  w.push((sigma1(w[28]) + w[23] + sigma0(w[15]) + w[14] + SHA_ADJ - SHA_K[14]) >>> 0);
  shaExpand(w, 31);
  const r = shaRounds(SHA_STATE, w, 14);
  return SHA_IV.map((x, i) => (x + r[i]) >>> 0);
}

function shaDigest(data) {
  const length = 57 + data.length;
  const tail = data.length - 7;
  const total = tail + 1 + ((((55 - length) % 64) + 64) % 64) + 8;
  const p = new Uint8Array(total);
  p.set(data.subarray(7));
  p[tail] = 0x80;
  const dv = new DataView(p.buffer);
  dv.setUint32(total - 8, Math.floor((length * 8) / 2 ** 32));
  dv.setUint32(total - 4, (length * 8) >>> 0);
  let st = shaInit(data);
  for (let off = 0; off < total; off += 64) {
    const w = [];
    for (let i = 0; i < 16; i++) w.push(dv.getUint32(off + i * 4));
    shaExpand(w, 16);
    const r = shaRounds(st, w);
    st = st.map((x, i) => (x + r[i]) >>> 0);
  }
  return st; // 빅엔디언 32비트 단어 8개
}

function cs64Digest(data, st) {
  const ka = (bswap(st[0]) | 1) >>> 0;
  const kb = (bswap(st[1]) | 1) >>> 0;
  const fac = [Math.imul(ka, CS64_FACTOR) >>> 0, Math.imul(kb, CS64_FACTOR) >>> 0];
  const terms = CS64_COEF.map(([c], i) => Math.imul(c, fac[i % 2]) >>> 0);
  const offs = CS64_COEF.map(([, o]) => o);

  const src = new Uint8Array(Math.ceil((data.length + 1) / 4) * 4);
  src.set(data, 1);
  const dv = new DataView(src.buffer);
  const words = [];
  for (let i = 0; i < src.length; i += 4) words.push(dv.getUint32(i, true));
  if (words.length % 2) words.push(0);
  words.forEach((w, i) => {
    let term = Math.imul(w, i % 2 === 0 ? ka : kb);
    let off = Math.imul(rol16(w), i % 2 === 0 ? 0xEF0569FB : 0xC31713DB);
    if (i === 0) { term += Math.imul(CS64_ADJ0, fac[0]); off += CS64_ADJ1; }
    terms.push(term >>> 0);
    offs.push(off >>> 0);
  });

  let swapAcc = 0, swapLast = 0, state = 0, acc = 0;
  for (let i = 0; i < terms.length; i += 2) {
    const x = terms[i], y = terms[i + 1];
    let t = rol16((offs[i] + x) >>> 0);
    let q = Math.imul(t, 0x76F50F34) >>> 0;
    swapAcc += (Math.imul(rol16(q), 0xC3EFEA97) + q) >>> 0;
    t = rol16((offs[i + 1] + y) >>> 0);
    q = Math.imul(t, 0x1881CE3C) >>> 0;
    swapLast = (Math.imul(rol16(q), 0x35BD1EC9) + q) >>> 0;
    swapAcc = (swapAcc + swapLast) >>> 0;

    state = (Math.imul(state, ka) + x) >>> 0;
    state = Math.imul(rol16(state), 0xCF98B111) >>> 0;
    state = Math.imul(rol16(state), 0x87085B9F) >>> 0;
    state = Math.imul(rol16(state), 0x12CEB96D) >>> 0;
    state = Math.imul(rol16(state), 0x257E1D83) >>> 0;
    acc += state;
    t = (Math.imul(state, kb) + y) >>> 0;
    t = Math.imul(rol16(t), 0xA27416F5) >>> 0;
    t = Math.imul(rol16(t), 0xD38396FF) >>> 0;
    state = Math.imul(rol16(Math.imul(rol16(t), 0x7C932B89) >>> 0), 0xBFA49F69) >>> 0;
    acc = (acc + state) >>> 0;
  }
  return [(swapLast ^ state) >>> 0, (swapAcc ^ acc) >>> 0];
}

/** 5분 단위로 고정되는 시간 토큰 "<CS64 16hex>-<SHA256 64hex>". */
function generateSecMsGec(unixSeconds = Date.now() / 1000) {
  let ticks = BigInt(Math.floor(unixSeconds)) + WIN_EPOCH;
  ticks -= ticks % 300n;      // 5분 내림
  ticks *= 10000000n;         // 100나노초 단위로 변환
  const data = new TextEncoder().encode(ticks.toString() + TRUSTED_CLIENT_TOKEN);
  const st = shaDigest(data);
  const [c0, c1] = cs64Digest(data, st);
  return `${hex8(bswap(c0))}${hex8(bswap(c1))}-${st.map(hex8).join("")}`;
}

function generateMuid() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function dateToString() {
  const d = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const mons = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${days[d.getUTCDay()]} ${mons[d.getUTCMonth()]} ${p(d.getUTCDate())} ${d.getUTCFullYear()} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} ` +
    `GMT+0000 (Coordinated Universal Time)`
  );
}

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 문장 경계를 지키면서 긴 텍스트를 자릅니다. */
function splitText(text, limit = MAX_CHARS) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return [clean];

  const parts = clean.match(/[^.!?]+[.!?]*\s*/g) || [clean];
  const out = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + p).length > limit && cur) {
      out.push(cur.trim());
      cur = "";
    }
    if (p.length > limit) {
      for (let i = 0; i < p.length; i += limit) out.push(p.slice(i, i + limit).trim());
    } else {
      cur += p;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

/* ------------------------ 끝에 붙일 무음 ------------------------ */
// Edge가 내려주는 포맷(24kHz / 48kbps / mono MP3)과 정확히 같은 규격의 무음 프레임 1개.
// 프레임 하나 = 576샘플 / 24000Hz = 24ms. 필요한 개수만큼 이어 붙입니다.
// MP3는 프레임 단위라 그냥 뒤에 붙여도 정상 재생됩니다.
const SILENT_FRAME_B64 =
  "//NkxAAAAANIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const SILENT_FRAME_MS = 24;
let SILENT_FRAME = null;

function silentFrame() {
  if (!SILENT_FRAME) {
    const bin = atob(SILENT_FRAME_B64);
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    SILENT_FRAME = b;
  }
  return SILENT_FRAME;
}

function silencePad(ms) {
  const want = Math.max(0, Math.min(3000, parseInt(ms, 10) || 0));
  const n = Math.round(want / SILENT_FRAME_MS);
  if (!n) return null;
  const f = silentFrame();
  const out = new Uint8Array(f.length * n);
  for (let i = 0; i < n; i++) out.set(f, i * f.length);
  return out;
}

/* ------------------------ Edge TTS 합성 ------------------------ */

async function openEdgeSocket() {
  const sec = generateSecMsGec();
  const query =
    `?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&ConnectionId=${crypto.randomUUID().replace(/-/g, "")}` +
    `&Sec-MS-GEC=${sec}` +
    `&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

  // Workers는 fetch + Upgrade 헤더로 아웃바운드 WebSocket을 엽니다.
  // 일부 런타임에서 스킴을 가리므로 wss -> https 순으로 시도합니다.
  let lastErr;
  for (const scheme of ["wss", "https"]) {
    try {
      const res = await fetch(`${scheme}://${BASE_HOST}/edge/v1${query}`, {
        headers: { Upgrade: "websocket", ...WSS_HEADERS, Cookie: `muid=${generateMuid()};` },
      });
      if (res.webSocket) {
        res.webSocket.accept();
        // 런타임에 따라 바이너리 프레임이 Blob으로 오기도 합니다. 가능하면 ArrayBuffer로 고정.
        try { res.webSocket.binaryType = "arraybuffer"; } catch (_) {}
        return res.webSocket;
      }
      lastErr = new Error(`upgrade rejected (HTTP ${res.status})`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("websocket connect failed");
}

/** 바이너리 프레임은 런타임에 따라 ArrayBuffer, TypedArray, Blob 중 무엇으로도 올 수 있습니다. */
async function frameToBytes(data) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (data && typeof data.arrayBuffer === "function") return new Uint8Array(await data.arrayBuffer()); // Blob
  return new Uint8Array(0);
}

/** [2바이트 헤더 길이][헤더][MP3 데이터] 구조에서 오디오 부분만 잘라냅니다. */
function extractAudio(bytes) {
  if (bytes.length < 2) return null;
  const headerLen = (bytes[0] << 8) | bytes[1];
  let start = 2 + headerLen;
  if (start > bytes.length) {
    start = -1;
    for (let i = 0; i < bytes.length - 3; i++) {
      if (bytes[i] === 13 && bytes[i + 1] === 10 && bytes[i + 2] === 13 && bytes[i + 3] === 10) {
        start = i + 4; break;
      }
    }
    if (start < 0) return null;
  }
  const audio = bytes.subarray(start);
  return audio.length ? audio : null;
}

function concatBytes(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function speechConfigMessage() {
  return (
    `X-Timestamp:${dateToString()}\r\n` +
    `Content-Type:application/json; charset=utf-8\r\n` +
    `Path:speech.config\r\n\r\n` +
    `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false",` +
    `"wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`
  );
}

// 주의: Microsoft는 Edge가 직접 만들 수 없는 SSML을 거부합니다.
// <speak><voice><prosody> 구조 외에 다른 태그(<break> 등)를 넣으면
// 서버가 연결을 끊어버립니다. 이 구조를 바꾸지 마세요.
function ssmlMessage(text, opts) {
  const ssml =
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
    `<voice name='${opts.voice}'>` +
    `<prosody pitch='${opts.pitch}' rate='${opts.rate}' volume='${opts.volume}'>` +
    `${escapeXml(text)}` +
    `</prosody></voice></speak>`;
  return {
    ssml,
    message:
      `X-RequestId:${crypto.randomUUID().replace(/-/g, "")}\r\n` +
      `Content-Type:application/ssml+xml\r\n` +
      `X-Timestamp:${dateToString()}Z\r\n` +
      `Path:ssml\r\n\r\n${ssml}`,
  };
}

function synthesizeChunk(text, opts) {
  return new Promise(async (resolve, reject) => {
    let ws;
    try {
      ws = await openEdgeSocket();
    } catch (e) {
      return reject(e);
    }

    // Blob 변환은 비동기라 프레임 순서를 지키려고 Promise 배열로 모읍니다.
    const pending = [];
    let settled = false;

    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch (_) {}
      fn(arg);
    };

    const timer = setTimeout(() => finish(reject, new Error("Edge TTS timeout")), WS_TIMEOUT);

    ws.addEventListener("message", (event) => {
      const data = event.data;

      if (typeof data === "string") {
        if (data.includes("Path:turn.end")) {
          Promise.all(pending)
            .then((parts) => {
              const audio = parts.filter(Boolean);
              if (!audio.length) return finish(reject, new Error("no audio received"));
              finish(resolve, concatBytes(audio));
            })
            .catch((e) => finish(reject, e));
        }
        return;
      }

      pending.push(frameToBytes(data).then(extractAudio).catch(() => null));
    });

    ws.addEventListener("error", () => finish(reject, new Error("Edge TTS socket error")));
    ws.addEventListener("close", (e) => {
      if (!settled) finish(reject, new Error(`Edge TTS closed early (code ${e.code || "?"})`));
    });

    try {
      ws.send(speechConfigMessage());
      ws.send(ssmlMessage(text, opts).message);
    } catch (e) {
      finish(reject, e);
    }
  });
}

async function synthesize(text, opts) {
  const pieces = splitText(text);
  const buffers = [];
  for (const piece of pieces) {
    let last;
    let ok = null;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        ok = await synthesizeChunk(piece, opts);
      } catch (e) {
        last = e;
        // 서버가 연결 자체를 거절(403 등)한 건 다시 해도 같으니 바로 실패로 돌려줍니다
        if (/upgrade rejected/.test(String(e && e.message))) break;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    if (!ok) throw last || new Error("synthesis failed");
    buffers.push(ok);
  }
  // 항목 사이 쉼을 오디오 안에 넣습니다. 그래야 연속 재생에 자바스크립트 타이머가
  // 필요 없어지고, 안드로이드 백그라운드에서도 소리가 끊기지 않습니다.
  const pad = silencePad(opts.gapMs);
  if (pad) buffers.push(pad);
  return concatBytes(buffers); // MP3는 그냥 이어붙여도 정상 재생됩니다.
}

/* ------------------------- 진단 (/debug) ------------------------- */

function diagnose(text, opts) {
  return new Promise(async (resolve) => {
    const log = { textFrames: [], binaryFrames: 0, audioBytes: 0, closeCode: null, error: null };
    const pending = [];
    const t0 = Date.now();
    let ws;
    try {
      ws = await openEdgeSocket();
      log.handshake = "ok";
    } catch (e) {
      log.handshake = "failed";
      log.error = String(e && e.message ? e.message : e);
      return resolve(log);
    }

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      log.elapsedMs = Date.now() - t0;
      try { ws.close(); } catch (_) {}
      resolve(log);
    };
    const timer = setTimeout(() => { log.error = log.error || "timeout"; done(); }, WS_TIMEOUT);

    ws.addEventListener("message", (event) => {
      if (typeof event.data === "string") {
        log.textFrames.push(event.data.slice(0, 400));
        if (event.data.includes("Path:turn.end")) {
          Promise.all(pending).then((parts) => {
            const audio = parts.filter(Boolean);
            log.audioBytes = audio.reduce((n, p) => n + p.length, 0);
            done();
          }).catch((e) => { log.error = String(e); done(); });
        }
        return;
      }
      log.binaryFrames++;
      if (!log.frameType) log.frameType = (event.data && event.data.constructor && event.data.constructor.name) || typeof event.data;
      pending.push(frameToBytes(event.data).then((bytes) => {
        if (log.binaryFrames === 1 && bytes.length >= 2) {
          const headerLen = (bytes[0] << 8) | bytes[1];
          log.firstFrameBytes = bytes.length;
          log.firstBinaryHeader = new TextDecoder().decode(bytes.subarray(2, Math.min(2 + headerLen, bytes.length)));
        }
        return extractAudio(bytes);
      }).catch(() => null));
    });
    ws.addEventListener("error", () => { log.error = "socket error"; done(); });
    ws.addEventListener("close", (e) => { log.closeCode = e.code || null; log.closeReason = e.reason || null; done(); });

    try {
      ws.send(speechConfigMessage());
      const m = ssmlMessage(text, { voice: opts.voice, pitch: "+0Hz", rate: "+0%", volume: "+0%" });
      log.ssml = m.ssml;
      ws.send(m.message);
    } catch (e) {
      log.error = String(e && e.message ? e.message : e);
      done();
    }
  });
}

/* --------------------------- 라우팅 --------------------------- */

async function handleEdge(request, env, ctx) {
  let body = {};
  if (request.method === "POST") {
    body = await request.json().catch(() => ({}));
  } else {
    const u = new URL(request.url);
    body = Object.fromEntries(u.searchParams.entries());
  }

  const text = (body.text || "").toString().trim();
  if (!text) return json({ error: "text is required" }, 400);
  if (text.length > 20000) return json({ error: "text too long" }, 413);

  const opts = {
    voice: (body.voice || env.DEFAULT_VOICE || "en-US-AvaMultilingualNeural").toString(),
    rate: (body.rate || "+0%").toString(),
    pitch: (body.pitch || "+0Hz").toString(),
    volume: (body.volume || "+0%").toString(),
    gapMs: body.gapMs,
  };

  // 같은 문장은 캐시에서 즉시 반환 (커스텀 도메인에서만 동작, workers.dev에서는 자동 무시)
  const hash = await sha256Hex(`${opts.voice}|${opts.rate}|${opts.pitch}|${opts.volume}|${opts.gapMs || 0}|${text}`);
  const cacheKey = new Request(`https://tts-cache.internal/v1/${hash}`, { method: "GET" });
  const cache = caches.default;

  try {
    const hit = await cache.match(cacheKey);
    if (hit) {
      const r = new Response(hit.body, hit);
      Object.entries(corsHeaders({ "X-Cache": "HIT" })).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }
  } catch (_) { /* 캐시 미지원 환경 무시 */ }

  const audio = await synthesize(text, opts);

  const res = new Response(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=604800",
      ...corsHeaders({ "X-Cache": "MISS" }),
    },
  });
  try { ctx.waitUntil(cache.put(cacheKey, res.clone())); } catch (_) {}
  return res;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);

    // 선택: AUTH_TOKEN 시크릿을 설정하면 아무나 못 쓰게 막을 수 있습니다.
    if (env.AUTH_TOKEN && url.pathname !== "/") {
      const given = request.headers.get("X-Auth-Token") || url.searchParams.get("token");
      if (given !== env.AUTH_TOKEN) return json({ error: "unauthorized" }, 401);
    }

    try {
      if (url.pathname === "/debug") {
        const text = url.searchParams.get("text") || "Hello, this is a test.";
        const voice = url.searchParams.get("voice") || env.DEFAULT_VOICE || "en-US-AvaMultilingualNeural";
        const report = await diagnose(text, { voice });
        report.secMsGecVersion = SEC_MS_GEC_VERSION;
        report.workerTimeUtc = new Date().toISOString();
        return json(report);
      }
      if (url.pathname === "/tts" || url.pathname === "/") {
        if (url.pathname === "/" && request.method === "GET" && !url.searchParams.get("text")) {
          return json({ ok: true, service: "tts-proxy", secMsGecVersion: SEC_MS_GEC_VERSION });
        }
        return await handleEdge(request, env, ctx);
      }
      return json({ error: "not found" }, 404);
    } catch (err) {
      return json({ error: String(err && err.message ? err.message : err) }, 502);
    }
  },
};
