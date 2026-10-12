/* ===========================================
   privseai 채팅 - Matrix Chat Client
   =========================================== */

// ============ State ============
const state = {
  accessToken: null,
  userId: null,
  deviceId: null,
  homeServer: 'https://chat.privseai.com',
  since: null,
  rooms: {},
  members: {},
  displayNames: {},
  avatars: {},
  currentRoomId: null,
  syncAbort: null,
  loggedIn: false,
  txnCounter: 0,
  isGuest: false,
  guestId: null,
};

// ============ DOM refs ============
const $ = (s) => document.querySelector(s);
const loginScreen = $('#login-screen');
const chatScreen = $('#chat-screen');
const welcomeTitle = $('#welcome-title');
const welcomeSub = $('#welcome-sub');
const loginForm = $('#login-form');
const usernameEl = $('#username');
const passwordEl = $('#password');
const loginBtn = $('#login-btn');
const loginError = $('#login-error');
const passwordFallback = $('#password-fallback');
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
  const body = { username, password, device_id: `device_${Date.now()}` };
  // First call: 401 with session is expected (normal Matrix registration flow)
  const res = await fetch(`${state.homeServer}/_matrix/client/v3/register?kind=user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const initData = await res.json();
  if (initData.session) {
    return matrix('POST', '/_matrix/client/v3/register?kind=user', {
      ...body,
      auth: { session: initData.session, type: 'm.login.dummy' },
    });
  }
  if (!res.ok) throw new Error(initData.error || initData.errcode || `HTTP ${res.status}`);
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
  return matrix('PUT', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`, {
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
  return matrix('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/joined_members`);
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
      const data = await matrix('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=50`);
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

// ============ Guest Auth ============
function generateGuestUsername() {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let r = '';
  const a = crypto.getRandomValues(new Uint8Array(12));
  for (let i = 0; i < 12; i++) r += c[a[i] % c.length];
  return `guest_${r}`;
}

async function handleGuestAuth() {
  const guestBtn = document.getElementById('guest-btn');
  const guestStatus = document.getElementById('guest-status');
  if (guestBtn) guestBtn.disabled = true;
  if (guestStatus) guestStatus.textContent = '게스트 계정 생성 중...';

  try {
    const username = generateGuestUsername();
    const password = `g_${crypto.getRandomValues(new Uint8Array(16)).join('')}`;
    const regData = await matrixRegister(username, password);

    state.accessToken = regData.access_token;
    state.userId = regData.user_id;
    state.deviceId = regData.device_id;
    state.isGuest = true;
    state.guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Store in localStorage (not IndexedDB — guests don't persist credentials)
    try {
      const guestSession = {
        accessToken: state.accessToken,
        userId: state.userId,
        deviceId: state.deviceId,
        guestId: state.guestId,
      };
      localStorage.setItem('privseai_guest', JSON.stringify(guestSession));
    } catch {}

    enterChat();
  } catch (err) {
    if (guestStatus) guestStatus.textContent = `게스트 접속 실패: ${err.message}`;
    console.error('Guest auth failed:', err);
  } finally {
    if (guestBtn) guestBtn.disabled = false;
  }
}

function enterChat() {
  loginScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  myName.textContent = state.userId.split(':')[0].slice(1);
  myId.textContent = state.userId;

  // Guest badge in sidebar
  const guestBadge = document.getElementById('guest-badge');
  if (guestBadge) {
    if (state.isGuest) {
      guestBadge.classList.remove('hidden');
    } else {
      guestBadge.classList.add('hidden');
    }
  }

  // Guest info in sidebar
  const guestInfo = document.getElementById('guest-info');
  if (guestInfo) {
    if (state.isGuest) {
      guestInfo.classList.remove('hidden');
    } else {
      guestInfo.classList.add('hidden');
    }
  }

  ensureProfile(state.userId).then(() => {
    if (state.avatars[state.userId]) {
      const url = mxcToHttp(state.avatars[state.userId]);
      if (url) myAvatar.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;
    }
  });

  try {
    sessionStorage.setItem('mx_token', state.accessToken);
    sessionStorage.setItem('mx_user', state.userId);
    if (state.isGuest) sessionStorage.setItem('mx_guest', '1');
  } catch {}

  startSync();
  ensureRoom();
}

async function ensureRoom() {
  if (Object.keys(state.rooms).length > 0) return;
  try {
    const displayName = state.userId.split(':')[0].slice(1);
    const data = await matrix('POST', '/_matrix/client/v3/createRoom', {
      name: `${displayName}의 채팅방`,
      preset: 'public_chat',
      initial_state: [
        { type: 'm.room.guest_access', state_key: '', content: { guest_access: 'can_join' } },
        { type: 'm.room.history_visibility', state_key: '', content: { history_visibility: 'world_readable' } },
      ],
    });
    state.rooms[data.room_id] = {
      id: data.room_id,
      name: `${displayName}의 채팅방`,
      messages: [],
      timeline: [],
    };
    renderRoomList();
    selectRoom(data.room_id);
  } catch (err) {
    console.error('Room creation failed:', err);
  }
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
  const wasGuest = state.isGuest;
  Object.assign(state, {
    accessToken: null, userId: null, since: null, rooms: {}, members: {},
    displayNames: {}, avatars: {}, currentRoomId: null, loggedIn: false,
    isGuest: false, guestId: null,
  });

  try {
    sessionStorage.removeItem('mx_token');
    sessionStorage.removeItem('mx_user');
    sessionStorage.removeItem('mx_guest');
    if (wasGuest) localStorage.removeItem('privseai_guest');
  } catch {}

  roomView.classList.add('hidden');
  roomPlaceholder.classList.remove('hidden');
  loginScreen.classList.remove('hidden');
  chatScreen.classList.add('hidden');
  loginBtn.textContent = '로그인';
  loginBtn.disabled = false;
  usernameEl.value = '';
  passwordEl.value = '';
  passwordFallback.classList.add('hidden');
}

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
/* ===== AI 패키지 다운로드 모달 ===== */
(function initAiPackModal() {
  const btn = document.getElementById('ai-pack-btn');
  const modal = document.getElementById('ai-pack-modal');
  if (!btn || !modal) return;
  const closeBtn = document.getElementById('ai-pack-close');
  btn.addEventListener('click', () => modal.classList.remove('hidden'));
  closeBtn?.addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.classList.add('hidden'); });
  const tabs = modal.querySelectorAll('.dl-os-tab');
  const panes = { win: 'dl-steps-win', mac: 'dl-steps-mac', and: 'dl-steps-and' };
  // OS 자동선택
  const ua = navigator.userAgent || '';
  let auto = 'win';
  if (/Android/i.test(ua)) auto = 'and';
  else if (/Mac|Linux/i.test(ua)) auto = 'mac';
  function select(os) {
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.os === os));
    Object.entries(panes).forEach(([k, id]) => document.getElementById(id)?.classList.toggle('hidden', k !== os));
  }
  tabs.forEach((t) => t.addEventListener('click', () => select(t.dataset.os)));
  select(auto);
})();

(async function init() {
  // Check for guest session in localStorage first
  try {
    const guestRaw = localStorage.getItem('privseai_guest');
    if (guestRaw) {
      const guest = JSON.parse(guestRaw);
      state.accessToken = guest.accessToken;
      state.userId = guest.userId;
      state.deviceId = guest.deviceId;
      state.isGuest = true;
      state.guestId = guest.guestId;

      try {
        await matrix('GET', '/_matrix/client/v3/account/whoami');
        loginScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        myName.textContent = guest.userId.split(':')[0].slice(1);
        myId.textContent = guest.userId;
        try { sessionStorage.setItem('mx_token', guest.accessToken); sessionStorage.setItem('mx_user', guest.userId); sessionStorage.setItem('mx_guest', '1'); } catch {}
        startSync();
        ensureRoom();
        return;
      } catch {
        // Guest token expired, clear and show login
        localStorage.removeItem('privseai_guest');
      }
    }
  } catch {}

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
        ensureRoom();
        return;
      } catch {
        // Token expired, show login
      }
    }
  } catch {}

  document.getElementById('guest-btn')?.addEventListener('click', handleGuestAuth);

  // Show login screen by default
  welcomeTitle.textContent = 'privseai 채팅';
  welcomeSub.textContent = 'Matrix 기반 채팅 서비스';
})();
