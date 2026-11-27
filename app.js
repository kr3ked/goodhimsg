import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import {SUPABASE_URL, SUPABASE_ANON_KEY} from './config.js';
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ini = n => (n || '?').trim().slice(0, 1).toUpperCase();
const tm = d => new Date(d).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
const day = d => new Date(d).toDateString() === new Date().toDateString() ? tm(d) : new Date(d).toLocaleDateString();
let me, prof, chats = [], cur, msgs = [], otherRead = 0, reply = null, edit = null, online = new Set(), typCh, typTimer, signup = false;

// ---- тема и звук ----
const ls = (k, d) => localStorage.getItem(k) ?? d;
function theme() {
  const t = ls('theme', 'system');
  document.documentElement.dataset.theme = t === 'system' ? (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light') : t;
}
theme(); matchMedia('(prefers-color-scheme:dark)').addEventListener('change', theme);
function beep() {
  if (ls('sound', '1') !== '1') return;
  try { const a = new AudioContext(), o = a.createOscillator(), g = a.createGain();
    o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.setValueAtTime(.1, a.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .25); o.start(); o.stop(a.currentTime + .25); } catch {}
}

// ---- авторизация ----
$('#aswitch').onclick = () => {
  signup = !signup;
  ['#aname', '#auser'].forEach(s => $(s).classList.toggle('hide', !signup));
  $('#atitle').textContent = signup ? 'Регистрация' : 'Вход';
  $('#auth .btn').textContent = signup ? 'Создать аккаунт' : 'Войти';
  $('#aswitch').textContent = signup ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Регистрация';
};
$('#auth').onsubmit = async e => {
  e.preventDefault(); $('#aerr').textContent = '';
  const email = $('#aemail').value, password = $('#apass').value;
  let r;
  if (signup) {
    const username = $('#auser').value.replace('@', '').toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return $('#aerr').textContent = 'Username: 3–20 символов, a-z, 0-9, _';
    r = await sb.auth.signUp({email, password, options: {data: {username, display_name: $('#aname').value || username}}});
    if (!r.error && !r.data.session) return $('#aerr').textContent = 'Подтвердите email по письму (или отключите подтверждение в Supabase).';
  } else r = await sb.auth.signInWithPassword({email, password});
  if (r.error) $('#aerr').textContent = r.error.message;
};
sb.auth.onAuthStateChange((_, s) => { if (s?.user && !me) boot(s.user); if (!s) location.reload(); });

async function boot(user) {
  me = user;
  prof = (await sb.from('profiles').select('*').eq('id', me.id).single()).data;
  $('#auth').classList.add('hide'); $('#app').classList.remove('hide');
  $('#me').textContent = ini(prof.display_name);
  await loadChats();
  const pc = sb.channel('online', {config: {presence: {key: me.id}}});
  pc.on('presence', {event: 'sync'}, () => { online = new Set(Object.keys(pc.presenceState())); renderList(); renderHead(); })
    .subscribe(s => { if (s === 'SUBSCRIBED' && prof.show_online) pc.track({t: Date.now()}); });
  sb.channel('inbox')
    .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'messages'}, ({new: m}) => {
      if (cur && m.chat_id === cur.chat_id) { if (!msgs.some(x => x.id === m.id)) { msgs.push(m); renderMsgs(); } if (m.sender_id !== me.id) markRead(); }
      if (m.sender_id !== me.id && (!cur || cur.chat_id !== m.chat_id || document.hidden)) beep();
      loadChats();
    })
    .on('postgres_changes', {event: 'UPDATE', schema: 'public', table: 'messages'}, ({new: m}) => {
      msgs = msgs.map(x => x.id === m.id ? m : x); renderMsgs(); loadChats();
    })
    .on('postgres_changes', {event: 'UPDATE', schema: 'public', table: 'chat_members'}, ({new: r}) => {
      if (cur && r.chat_id === cur.chat_id && r.user_id !== me.id) { otherRead = +new Date(r.last_read_at); renderMsgs(); }
    }).subscribe();
}

// ---- список чатов и поиск людей ----
async function loadChats() { chats = (await sb.rpc('my_chats')).data || []; renderList(); }
let people = [];
$('#q').oninput = async e => {
  const q = e.target.value.trim().replace('@', '').toLowerCase();
  people = q.length < 2 ? [] : (await sb.from('profiles').select('id,username,display_name').neq('id', me.id).ilike('username', `%${q}%`).limit(5)).data || [];
  renderList();
};
function renderList() {
  const q = $('#q').value.trim().replace('@', '').toLowerCase();
  const f = chats.filter(c => !q || c.name.toLowerCase().includes(q) || c.username.includes(q));
  $('#list').innerHTML = f.map(c => `<div class="row ${cur?.chat_id === c.chat_id ? 'on' : ''}" data-chat="${c.chat_id}">
    <div class="av ${online.has(c.other_id) ? 'on' : ''}">${ini(c.name)}</div>
    <div class="grow"><div class="nm"><span>${esc(c.name)}</span><span class="sub">${day(c.last_at)}</span></div>
    <div class="sub"><span>${esc(c.last_text || '')}</span>${c.unread > 0 ? `<span class="badge">${c.unread}</span>` : ''}</div></div></div>`).join('')
    + (people.length ? '<div class="sec">Люди</div>' + people.map(p => `<div class="row" data-user="${p.id}"><div class="av">${ini(p.display_name)}</div><div class="grow"><b>${esc(p.display_name)}</b><div class="sub">@${esc(p.username)}</div></div></div>`).join('') : '');
}
$('#list').onclick = async e => {
  const r = e.target.closest('.row'); if (!r) return;
  if (r.dataset.user) {
    const {data: id} = await sb.rpc('open_direct', {other: r.dataset.user});
    $('#q').value = ''; people = []; await loadChats();
    return open(chats.find(c => c.chat_id === id));
  }
  open(chats.find(c => c.chat_id === r.dataset.chat));
};

// ---- чат ----
async function open(c) {
  if (!c) return;
  cur = c; reply = edit = null; renderBar();
  $('#app').classList.add('open');
  ['#head', '#comp'].forEach(s => $(s).classList.remove('hide'));
  const [{data: m}, {data: o}] = await Promise.all([
    sb.from('messages').select('*').eq('chat_id', c.chat_id).order('created_at').limit(300),
    sb.from('chat_members').select('last_read_at').eq('chat_id', c.chat_id).eq('user_id', c.other_id).single()]);
  msgs = m || []; otherRead = +new Date(o?.last_read_at || 0);
  renderHead(); renderMsgs(); markRead(); renderList();
  if (typCh) sb.removeChannel(typCh);
  typCh = sb.channel('typing:' + c.chat_id).on('broadcast', {event: 'typing'}, ({payload}) => {
    if (payload.u === me.id) return;
    $('#bar').classList.remove('hide'); $('#barx').textContent = 'печатает…'; $('#barc').classList.add('hide');
    clearTimeout(typTimer); typTimer = setTimeout(renderBar, 2500);
  }).subscribe();
  $('#txt').focus();
}
async function markRead() {
  await sb.from('chat_members').update({last_read_at: new Date().toISOString()}).eq('chat_id', cur.chat_id).eq('user_id', me.id);
  const c = chats.find(x => x.chat_id === cur.chat_id); if (c) { c.unread = 0; renderList(); }
}
function renderHead() {
  if (!cur) return;
  $('#hav').textContent = ini(cur.name); $('#hav').classList.toggle('on', online.has(cur.other_id));
  $('#hname').textContent = cur.name;
  $('#hst').textContent = online.has(cur.other_id) ? 'в сети' : '@' + cur.username;
}
function renderMsgs() {
  const box = $('#msgs'), bottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.innerHTML = msgs.map(m => {
    const mine = m.sender_id === me.id, rp = msgs.find(x => x.id === m.reply_to);
    const read = mine && otherRead >= +new Date(m.created_at);
    return `<div class="m ${mine ? 'me' : ''}" data-id="${m.id}">
      ${rp ? `<div class="rp">${esc(rp.deleted ? 'Сообщение удалено' : rp.text)}</div>` : ''}
      ${m.deleted ? '<span class="del">Сообщение удалено</span>' : esc(m.text)}
      <div class="meta">${m.edited_at && !m.deleted ? 'изменено · ' : ''}${tm(m.created_at)}${mine && !m.deleted ? ` <span class="${read ? 'ok' : ''}">${read ? '✓✓' : '✓'}</span>` : ''}</div>
      ${m.deleted ? '' : `<div class="acts"><button data-a="r">↩</button>${mine ? '<button data-a="e">✎</button><button data-a="d">🗑</button>' : ''}</div>`}</div>`;
  }).join('');
  if (bottom || !box.dataset.init) box.scrollTop = box.scrollHeight; box.dataset.init = 1;
}
$('#msgs').onclick = async e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const m = msgs.find(x => x.id === b.closest('.m').dataset.id);
  if (b.dataset.a === 'r') { reply = m; edit = null; }
  if (b.dataset.a === 'e') { edit = m; reply = null; $('#txt').value = m.text; }
  if (b.dataset.a === 'd' && confirm('Удалить сообщение?')) await sb.from('messages').update({deleted: true, text: null}).eq('id', m.id);
  renderBar(); $('#txt').focus();
};
function renderBar() {
  const t = edit ? 'Редактирование: ' + edit.text : reply ? 'Ответ: ' + reply.text : '';
  $('#bar').classList.toggle('hide', !t); $('#barx').textContent = t.slice(0, 80); $('#barc').classList.remove('hide');
}
$('#barc').onclick = () => { reply = edit = null; $('#txt').value = ''; renderBar(); };
$('#back').onclick = () => { $('#app').classList.remove('open'); cur = null; renderList(); };
let lastT = 0;
$('#txt').oninput = () => { if (Date.now() - lastT > 2000 && typCh) { lastT = Date.now(); typCh.send({type: 'broadcast', event: 'typing', payload: {u: me.id}}); } };
$('#comp').onsubmit = async e => {
  e.preventDefault();
  const text = $('#txt').value.trim(); if (!text || !cur) return;
  $('#txt').value = '';
  if (edit) { await sb.from('messages').update({text, edited_at: new Date().toISOString()}).eq('id', edit.id); edit = null; }
  else {
    const {data} = await sb.from('messages').insert({chat_id: cur.chat_id, text, reply_to: reply?.id ?? null}).select().single();
    if (data && !msgs.some(x => x.id === data.id)) { msgs.push(data); renderMsgs(); }
    loadChats();
  }
  reply = null; renderBar();
};

// ---- профиль и настройки ----
$('#me').onclick = () => {
  const d = document.createElement('div'); d.className = 'modal';
  d.innerHTML = `<div><h3 style="margin:0">Профиль и настройки</h3>
    <input id="pn" placeholder="Имя" value="${esc(prof.display_name)}">
    <input id="pu" placeholder="@username" value="${esc(prof.username)}">
    <input id="pb" placeholder="О себе" value="${esc(prof.bio)}">
    <label>Тема <select id="pt"><option value="system">Системная</option><option value="light">Светлая</option><option value="dark">Тёмная</option></select></label>
    <label><input type="checkbox" id="ps" style="width:auto"> Звук уведомлений</label>
    <label><input type="checkbox" id="po" style="width:auto"> Показывать статус «в сети»</label>
    <div id="pe" style="color:#ef4444"></div>
    <button class="btn" id="psave">Сохранить</button><button id="pout" style="color:#ef4444">Выйти</button><button id="pc">Закрыть</button></div>`;
  document.body.append(d);
  $('#pt').value = ls('theme', 'system'); $('#ps').checked = ls('sound', '1') === '1'; $('#po').checked = prof.show_online;
  $('#pc').onclick = () => d.remove();
  $('#pout').onclick = () => sb.auth.signOut();
  $('#psave').onclick = async () => {
    const upd = {display_name: $('#pn').value.trim() || prof.display_name, username: $('#pu').value.replace('@', '').toLowerCase(), bio: $('#pb').value, show_online: $('#po').checked};
    if (!/^[a-z0-9_]{3,20}$/.test(upd.username)) return $('#pe').textContent = 'Username: 3–20 символов, a-z, 0-9, _';
    const {error} = await sb.from('profiles').update(upd).eq('id', me.id);
    if (error) return $('#pe').textContent = error.code === '23505' ? 'Этот username занят' : error.message;
    localStorage.setItem('theme', $('#pt').value); localStorage.setItem('sound', $('#ps').checked ? '1' : '0');
    Object.assign(prof, upd); theme(); $('#me').textContent = ini(prof.display_name); d.remove();
    if (upd.show_online !== undefined) location.reload();
  };
};

sb.auth.getSession().then(({data}) => { if (data.session) boot(data.session.user); });
