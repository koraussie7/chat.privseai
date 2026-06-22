/* ===========================================
   privseai 채팅 - Matrix Passkey Client
   =========================================== */

// ============ Credential Store (IndexedDB) ============
const DB_NAME = 'privseai-chat';
const DB_STORE = 'credentials';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(DB_STORE, { keyPath: 'credentialId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbStore(credentialId, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put({ credentialId, ...data });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(credentialId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(credentialId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ============ WebAuthn Helpers ============
function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64ToBuf(str) {
  return Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

async function createPasskey(username) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { id: window.location.hostname, name: 'Privseai Chat' },
      user: {
        id: userId,
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'required',
      },
    },
  });
  return credential;
}

async function getPasskey() {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      userVerification: 'required',
    },
  });
  return credential;
}

function generateUsername() {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let r = '';
  const a = crypto.getRandomValues(new Uint8Array(8));
  for (let i = 0; i < 8; i++) r += c[a[i] % c.length];
  return `user_${r}`;
}

// ============ State ============
const state = {
  accessToken: null,
  userId: null,
  deviceId: null,
  homeServer: window.location.origin,
  since: null,
  rooms: {},
  members: {},
  displayNames: {},
  avatars: {},
  currentRoomId: null,
  syncAbort: null,
  loggedIn: false,
  txnCounter: 0,
};

// ============ DOM refs ============
const $ = (s) => document.querySelector(s);
const loginScreen = $('#login-screen');
const chatScreen = $('#chat-screen');

const bioSection = $('#bio-section');
const bioBtn = $('#bio-btn');
const bioStatus = $('#bio-status');
const welcomeTitle = $('#welcome-title');
const welcomeSub = $('#welcome-sub');

const loginForm = $('#login-form');
const usernameEl = $('#username');
const passwordEl = $('#password');
const loginBtn = $('#login-btn');
const loginError = $('#login-error');
const passwordFallback = $('#password-fallback');
const showPasswordLogin = $('#show-password-login');

const logoutBtn = $('#logout-btn');
const roomList = $('#room-list');
const myName = $('#my-name');
const myId = $('#my-id');
const myAvatar = $('#my-avatar');
const roomView = $('#room-view');
const roomPlaceholder = $('#room-placeholder');
const roomName = $('#room-name');
const roomAvatar = $('#room-avatar');
const roomMeta = $('#room-meta');
const messageList = $('#message-list');
const messageInput = $('#message-input');
const sendBtn = $('#send-btn');
const typingIndicator = $('#typing-indicator');

// ============ Helpers ============
function esc(html) {
  const d = document.createElement('div');
  d.textContent = html;
  return d.innerHTML;
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const pad = (n) => String(n).padStart(2,'0');
  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.toDateString() === now.toDateString()) return hhmm;
  const yesterday = new Date(Date.now()-864e5);
  if (d.toDateString() === yesterday.toDateString()) return `어제 ${hhmm}`;
  return `${d.getMonth()+1}/${d.getDate()} ${hhmm}`;
}

function formatDateDivider(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return '오늘';
  const yesterday = new Date(Date.now()-864e5);
  if (d.toDateString() === yesterday.toDateString()) return '어제';
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
}

function makeTxn() {
  return `txn${Date.now()}_${++state.txnCounter}`;
}

// ============ Matrix API calls ============
async function matrix(method, path, body) {
  const url = `${state.homeServer}${path}`;
  const opts = { method, headers: {} };
  if (state.accessToken) {
    opts.headers['Authorization'] = `Bearer ${state.accessToken}`;
  }
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errcode || `HTTP ${res.status}`);
  return data;
}

async function matrixRegister(username, password) {
  const initData = await matrix('POST', '/_matrix/client/v3/register?kind=user', {
    username, password, device_id: `device_${Date.now()}`,
  });
  if (initData.session) {
    return matrix('POST', '/_matrix/client/v3/register?kind=user', {
      username, password, device_id: `device_${Date.now()}`,
      auth: { session: initData.session, type: 'm.login.dummy' },
    });
  }
  return initData;
}

async function matrixLogin(username, password) {
  return matrix('POST', '/_matrix/client/v3/login', {
    type: 'm.login.password',
    identifier: { type: 'm.id.user', user: username },
    password,
  });
}

async function matrixSync() {
  let path = '/_matrix/client/v3/sync?timeout=30000&set_presence=online';
  if (state.since) path += `&since=${state.since}`;
  return matrix('GET', path);
}

async function matrixSendMessage(roomId, text) {
  const txnId = makeTxn();
  return matrix('PUT', `/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`, {
    msgtype: 'm.text', body: text,
  });
}

async function matrixGetProfile(userId) {
  const [displayRes, avatarRes] = await Promise.allSettled([
    matrix('GET', `/_matrix/client/v3/profile/${encodeURIComponent(userId)}/displayname`),
    matrix('GET', `/_matrix/client/v3/profile/${encodeURIComponent(userId)}/avatar_url`),
  ]);
  return {
    displayname: displayRes.value?.displayname || userId.split(':')[0].slice(1),
    avatarUrl: avatarRes.value?.avatar_url || null,
  };
}

async function matrixGetMembers(roomId) {
  return matrix('GET', `/rooms/${encodeURIComponent(roomId)}/joined_members`);
}

function mxcToHttp(mxc) {
  if (!mxc || !mxc.startsWith('mxc://')) return null;
  const parts = mxc.slice(6).split('/');
  return `${state.homeServer}/_matrix/media/v3/download/${parts[0]}/${parts[1]}`;
}

// ============ Cache profiles ============
async function ensureProfile(userId) {
  if (state.displayNames[userId] !== undefined) return;
  try {
    const profile = await matrixGetProfile(userId);
    state.displayNames[userId] = profile.displayname;
    state.avatars[userId] = profile.avatarUrl;
  } catch {
    state.displayNames[userId] = userId.split(':')[0].slice(1);
    state.avatars[userId] = null;
  }
}

async function ensureRoomMembers(roomId) {
  if (state.members[roomId]) return;
  try {
    const data = await matrixGetMembers(roomId);
    state.members[roomId] = Object.keys(data.joined || {});
    for (const uid of state.members[roomId]) ensureProfile(uid);
  } catch { state.members[roomId] = [] }
}

// ============ Process sync ============
function processSync(data) {
  const joins = data.rooms?.join || {};
  let changed = false;

  for (const [roomId, roomData] of Object.entries(joins)) {
    if (!state.rooms[roomId]) {
      state.rooms[roomId] = { id: roomId, name: null, messages: [], timeline: [] };
      changed = true;
    }
    const room = state.rooms[roomId];

    for (const ev of (roomData.state?.events || [])) {
      if (ev.type === 'm.room.name' && ev.state_key === '') room.name = ev.content?.name || null;
      if (ev.type === 'm.room.member') ensureProfile(ev.state_key);
    }

    const timeline = roomData.timeline?.events || [];
    if (timeline.length > 0) {
      const existingIds = new Set(room.timeline.map(e => e.event_id));
      let newCount = 0;
      for (const ev of timeline) {
        if (!existingIds.has(ev.event_id)) {
          room.timeline.push(ev);
          existingIds.add(ev.event_id);
          newCount++;
          if (ev.type === 'm.room.message') room.messages.push(ev);
        }
      }
      if (room.timeline.length > 500) {
        room.timeline = room.timeline.slice(-500);
        room.messages = room.timeline.filter(e => e.type === 'm.room.message');
      }
      changed = changed || newCount > 0;
    }

    const unread = roomData.unread_notifications;
    room.unread = unread ? (unread.notification_count || 0) + (unread.highlight_count || 0) : 0;

    if (!room.name) {
      const mEvents = roomData.state?.events?.filter(e => e.type === 'm.room.member') || [];
      const others = mEvents
        .filter(e => e.state_key !== state.userId && e.content?.membership === 'join')
        .map(e => e.state_key);
      room.name = others.length > 0
        ? others.map(u => state.displayNames[u] || u.split(':')[0].slice(1)).join(', ')
        : roomId.slice(0, 8);
    }
  }

  if (changed) renderRoomList();
  if (state.currentRoomId && joins[state.currentRoomId]) renderMessages(state.currentRoomId);
}

// ============ Render Room List ============
function renderRoomList() {
  const sorted = Object.values(state.rooms).sort((a, b) => {
    const aL = a.messages.length > 0 ? a.messages[a.messages.length-1].origin_server_ts : 0;
    const bL = b.messages.length > 0 ? b.messages[b.messages.length-1].origin_server_ts : 0;
    return bL - aL;
  });

  roomList.innerHTML = sorted.map(room => {
    const lastMsg = room.messages.length > 0 ? (room.messages[room.messages.length-1].content?.body || '') : '';
    const lastTime = room.messages.length > 0 ? room.messages[room.messages.length-1].origin_server_ts : null;
    const name = room.name || room.id.slice(0, 8);
    const active = room.id === state.currentRoomId ? 'active' : '';
    const unread = room.unread > 0 ? `<span class="room-item-unread">${room.unread > 99 ? '99+' : room.unread}</span>` : '';
    const firstChar = name.charAt(0).toUpperCase();

    return `<div class="room-item ${active}" data-room-id="${esc(room.id)}">
      <div class="room-item-avatar">${firstChar}</div>
      <div class="room-item-info">
        <div class="room-item-name">${esc(name)}</div>
        <div class="room-item-preview">${esc(lastMsg) || '&nbsp;'}</div>
      </div>
      ${lastTime ? `<span class="room-item-time">${formatTime(lastTime)}</span>` : ''}
      ${unread}
    </div>`;
  }).join('');

  roomList.querySelectorAll('.room-item').forEach(el => {
    el.addEventListener('click', () => selectRoom(el.dataset.roomId));
  });
}

// ============ Select Room ============
async function selectRoom(roomId) {
  state.currentRoomId = roomId;
  roomPlaceholder.classList.add('hidden');
  roomView.classList.remove('hidden');
  messageList.innerHTML = '';
  messageInput.disabled = false;
  messageInput.focus();

  const room = state.rooms[roomId];
  if (!room) return;

  roomName.textContent = room.name || roomId.slice(0, 8);
  roomAvatar.textContent = (room.name || '#').charAt(0).toUpperCase();

  ensureRoomMembers(roomId);
  try {
    const members = await matrixGetMembers(roomId);
    const count = Object.keys(members.joined || {}).length;
    roomMeta.textContent = `${count}명 참여 중`;
    state.members[roomId] = Object.keys(members.joined || {});
    for (const uid of state.members[roomId]) ensureProfile(uid);
  } catch {}

  if (room.messages.length < 20) {
    try {
      const data = await matrix('GET', `/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=50`);
      const events = data.chunk?.filter(e => e.type === 'm.room.message') || [];
      events.reverse();
      const existingIds = new Set(room.timeline.map(e => e.event_id));
      for (const ev of events) {
        if (!existingIds.has(ev.event_id)) {
          room.timeline.unshift(ev);
          room.messages.unshift(ev);
          existingIds.add(ev.event_id);
        }
      }
      if (room.timeline.length > 500) {
        room.timeline = room.timeline.slice(-500);
        room.messages = room.timeline.filter(e => e.type === 'm.room.message');
      }
    } catch {}
  }

  room.unread = 0;
  renderRoomList();
  renderMessages(roomId);
}

// ============ Render Messages ============
function renderMessages(roomId) {
  const room = state.rooms[roomId];
  if (!room) return;

  const msgs = room.messages.slice(-200);
  let html = '', lastDate = '', lastSender = '';

  for (const ev of msgs) {
    if (ev.type !== 'm.room.message') continue;
    const content = ev.content || {};
    const body = content.body || '';
    const msgtype = content.msgtype || '';
    const sender = ev.sender || ev.user_id || '';
    const ts = ev.origin_server_ts || Date.now();

    const dateStr = formatDateDivider(ts);
    if (dateStr !== lastDate) {
      html += `<div class="message-date-divider">${dateStr}</div>`;
      lastDate = dateStr;
      lastSender = '';
    }

    const isSelf = sender === state.userId;
    const isSameSender = sender === lastSender;
    const showSender = !isSelf && !isSameSender;
    const groupClass = isSelf ? 'sent' : 'received';
    const displayName = state.displayNames[sender] || sender.split(':')[0].slice(1);
    const avatarUrl = state.avatars[sender] ? mxcToHttp(state.avatars[sender]) : null;
    const avatarHtml = avatarUrl
      ? `<img src="${avatarUrl}" alt="" onerror="this.style.display='none'">`
      : displayName.charAt(0).toUpperCase();

    let bubbleContent = esc(body);
    if (msgtype === 'm.image' && content.url) {
      const src = mxcToHttp(content.url);
      bubbleContent = src ? `<img src="${src}" class="msg-image" onclick="openImage('${src}')">` : esc(body);
    }

    if (isSameSender) {
      html += `<div class="message-group ${groupClass}">
        <div class="message-bubble-wrap">
          ${!isSelf ? '<div class="message-avatar-col"></div>' : ''}
          <div class="message-bubble">${bubbleContent}</div>
          <div class="message-info"><span class="message-time">${formatTime(ts)}</span>${isSelf ? '<span class="message-read-status">✓</span>' : ''}</div>
        </div>
      </div>`;
    } else {
      html += `<div class="message-group ${groupClass}">
        ${showSender ? `<div class="message-sender">${esc(displayName)}</div>` : ''}
        <div class="message-bubble-wrap">
          ${!isSelf ? `<div class="message-avatar-col"><div class="profile-avatar">${avatarHtml}</div></div>` : ''}
          <div class="message-bubble">${bubbleContent}</div>
          <div class="message-info"><span class="message-time">${formatTime(ts)}</span>${isSelf ? '<span class="message-read-status">✓</span>' : ''}</div>
        </div>
      </div>`;
    }

    lastSender = sender;
  }

  messageList.innerHTML = html;
  requestAnimationFrame(() => { messageList.scrollTop = messageList.scrollHeight });
}

// ============ Image preview ============
let modal, modalImg;
function openImage(src) {
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal hidden';
    modal.innerHTML = '<span class="modal-close">&times;</span><img class="modal-content">';
    document.body.appendChild(modal);
    modalImg = modal.querySelector('.modal-content');
    modal.querySelector('.modal-close').onclick = () => modal.classList.add('hidden');
    modal.onclick = () => modal.classList.add('hidden');
  }
  modalImg.src = src;
  modal.classList.remove('hidden');
}

// ============ Send message ============
async function handleSend() {
  const text = messageInput.value.trim();
  if (!text || !state.currentRoomId) return;

  sendBtn.disabled = true;
  messageInput.value = '';
  messageInput.style.height = 'auto';

  const room = state.rooms[state.currentRoomId];
  if (room) {
    const fakeEv = {
      event_id: `local_${makeTxn()}`,
      type: 'm.room.message',
      sender: state.userId,
      origin_server_ts: Date.now(),
      content: { msgtype: 'm.text', body: text },
    };
    room.messages.push(fakeEv);
    room.timeline.push(fakeEv);
    renderMessages(state.currentRoomId);
    renderRoomList();
  }

  try {
    await matrixSendMessage(state.currentRoomId, text);
  } catch (err) {
    console.error('Send failed:', err);
  }

  sendBtn.disabled = false;
  messageInput.focus();
}

// ============ Sync loop ============
let syncing = false;
async function syncLoop() {
  if (syncing || !state.loggedIn) return;
  syncing = true;
  try {
    const data = await matrixSync();
    if (state.loggedIn) processSync(data);
  } catch (err) {
    console.error('Sync error:', err);
    if (err.message?.includes('M_UNKNOWN_TOKEN') || err.message?.includes('401')) {
      doLogout();
      return;
    }
    await new Promise(r => setTimeout(r, 5000));
  } finally {
    syncing = false;
    if (state.loggedIn) syncLoop();
  }
}

function startSync() {
  state.loggedIn = true;
  syncLoop();
}

function stopSync() {
  state.loggedIn = false;
}

// ============ Biometric Auth ============
async function handleBioAuth() {
  bioBtn.disabled = true;

  // Check if we have stored credentials
  const stored = await dbGetAll();

  if (stored.length > 0) {
    // Login flow
    bioStatus.textContent = '지문 인증 중...';
    try {
      const assertion = await getPasskey();
      const credId = bufToBase64(assertion.id);
      const match = stored.find(c => c.credentialId === credId);

      if (match) {
        state.accessToken = match.accessToken;
        state.userId = match.userId;
        state.deviceId = match.deviceId;

        // Verify token is still valid
        try {
          await matrix('GET', '/_matrix/client/v3/account/whoami');
        } catch {
          // Token expired, login with stored password
          const loginData = await matrixLogin(match.username, match.password);
          state.accessToken = loginData.access_token;
          state.userId = loginData.user_id;
          state.deviceId = loginData.device_id;
          await dbStore(credId, { ...match, accessToken: loginData.access_token, deviceId: loginData.device_id });
        }

        enterChat();
      } else {
        bioStatus.textContent = '등록되지 않은 인증 정보입니다. 페이지를 새로고침 후 다시 시도하세요.';
      }
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.message?.includes('cancelled')) {
        bioStatus.textContent = '';
      } else {
        bioStatus.textContent = `인증 실패: ${err.message}`;
      }
    }
  } else {
    // Registration flow
    try {
      const username = generateUsername();
      const password = `p_${crypto.getRandomValues(new Uint8Array(16)).join('')}`;

      bioStatus.textContent = '지문 등록 중...';
      const passkey = await createPasskey(username);
      const credId = bufToBase64(passkey.id);

      bioStatus.textContent = '계정 생성 중...';
      const regData = await matrixRegister(username, password);

      state.accessToken = regData.access_token;
      state.userId = regData.user_id;
      state.deviceId = regData.device_id;

      await dbStore(credId, {
        userId: state.userId,
        accessToken: state.accessToken,
        deviceId: state.deviceId,
        username,
        password,
      });

      enterChat();
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.message?.includes('cancelled')) {
        bioStatus.textContent = '';
      } else if (err.message?.includes('M_USER_IN_USE')) {
        // Extremely rare but handle it by retrying
        bioStatus.textContent = '다시 시도해주세요...';
        setTimeout(() => { bioBtn.disabled = false; bioStatus.textContent = ''; }, 1000);
        return;
      } else {
        bioStatus.textContent = `오류: ${err.message}`;
      }
    }
  }

  bioBtn.disabled = false;
}

function enterChat() {
  loginScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  myName.textContent = state.userId.split(':')[0].slice(1);
  myId.textContent = state.userId;

  ensureProfile(state.userId).then(() => {
    if (state.avatars[state.userId]) {
      const url = mxcToHttp(state.avatars[state.userId]);
      if (url) myAvatar.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;
    }
  });

  try {
    sessionStorage.setItem('mx_token', state.accessToken);
    sessionStorage.setItem('mx_user', state.userId);
  } catch {}

  startSync();
}

// ============ Login (password fallback) ============
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = usernameEl.value.trim();
  const password = passwordEl.value;
  if (!username || !password) return;

  loginBtn.disabled = true;
  loginBtn.textContent = '로그인 중...';
  loginError.textContent = '';

  try {
    const data = await matrixLogin(username, password);
    state.accessToken = data.access_token;
    state.userId = data.user_id;
    state.deviceId = data.device_id;

    // Optionally store as passkey
    try {
      const passkey = await createPasskey(username);
      const credId = bufToBase64(passkey.id);
      await dbStore(credId, {
        userId: state.userId,
        accessToken: state.accessToken,
        deviceId: state.deviceId,
        username,
        password,
      });
    } catch {}

    enterChat();
  } catch (err) {
    loginError.textContent = err.message?.includes('M_FORBIDDEN') ? '아이디 또는 비밀번호가 올바르지 않습니다.' : `로그인 실패: ${err.message}`;
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = '로그인';
  }
});

// ============ Logout ============
function doLogout() {
  stopSync();
  Object.assign(state, {
    accessToken: null, userId: null, since: null, rooms: {}, members: {},
    displayNames: {}, avatars: {}, currentRoomId: null, loggedIn: false,
  });

  try { sessionStorage.removeItem('mx_token'); sessionStorage.removeItem('mx_user') } catch {}

  roomView.classList.add('hidden');
  roomPlaceholder.classList.remove('hidden');
  loginScreen.classList.remove('hidden');
  chatScreen.classList.add('hidden');
  loginBtn.textContent = '로그인';
  loginBtn.disabled = false;
  usernameEl.value = '';
  passwordEl.value = '';
  passwordFallback.classList.add('hidden');

  initBioScreen();
}

logoutBtn.addEventListener('click', doLogout);

// ============ UI handlers ============
bioBtn.addEventListener('click', handleBioAuth);

showPasswordLogin.addEventListener('click', (e) => {
  e.preventDefault();
  passwordFallback.classList.toggle('hidden');
});

messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
  sendBtn.disabled = !messageInput.value.trim();
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
});

sendBtn.addEventListener('click', handleSend);

// ============ Init ============
async function initBioScreen() {
  const stored = await dbGetAll();
  if (stored.length > 0) {
    welcomeTitle.textContent = '돌아오신 것을 환영합니다';
    welcomeSub.textContent = '지문으로 로그인하세요';
    bioBtn.innerHTML = '<span class="bio-icon">🔒</span> 지문으로 로그인';
  } else {
    welcomeTitle.textContent = 'privseai 채팅';
    welcomeSub.textContent = 'Matrix 기반 채팅 서비스';
    bioBtn.innerHTML = '<span class="bio-icon">🔒</span> 지문으로 시작하기';
  }
}

(async function init() {
  try {
    const token = sessionStorage.getItem('mx_token');
    const user = sessionStorage.getItem('mx_user');
    if (token && user) {
      state.accessToken = token;
      state.userId = user;

      try {
        await matrix('GET', '/_matrix/client/v3/account/whoami');
        loginScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        myName.textContent = user.split(':')[0].slice(1);
        myId.textContent = user;
        startSync();
        return;
      } catch {
        // Token expired, will use biometric flow
      }
    }
  } catch {}

  try {
    await initBioScreen();
  } catch {
    // IndexedDB unavailable or other init error, show basic login screen
    welcomeTitle.textContent = 'privseai 채팅';
    welcomeSub.textContent = 'Matrix 기반 채팅 서비스';
    bioBtn.textContent = '🔒 다시 시도';
  }
})();
