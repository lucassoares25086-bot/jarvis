const KEYS = { chats: 'jarvis.chats.v1', active: 'jarvis.active.v1', notes: 'jarvis.notes.v1', trackers: 'jarvis.trackers.v1', theme: 'jarvis.theme.v1', voice: 'jarvis.voice.v1' };
const conversation = document.querySelector('#conversation');
const welcome = document.querySelector('#welcome');
const input = document.querySelector('#message-input');
const form = document.querySelector('#chat-form');
const sendButton = document.querySelector('.send-button');
const status = document.querySelector('#status');
const scrim = document.querySelector('#scrim');
const historyDrawer = document.querySelector('#history-drawer');
const notesDrawer = document.querySelector('#notes-drawer');
const trackerDrawer = document.querySelector('#tracker-drawer');
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
let chats = load(KEYS.chats, []);
let notes = load(KEYS.notes, []);
let trackers = load(KEYS.trackers, []);
let activeId = localStorage.getItem(KEYS.active);
let busy = false;
let selectedVoice = null;
let recognition = null;
let voiceEnabled = localStorage.getItem(KEYS.voice) !== 'off';

function saveChats() { localStorage.setItem(KEYS.chats, JSON.stringify(chats)); }
function saveTrackers() { localStorage.setItem(KEYS.trackers, JSON.stringify(trackers)); }
function currentChat() { return chats.find(chat => chat.id === activeId); }
function makeId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function updateWelcome() { welcome.hidden = Boolean(conversation.childElementCount); }
function addMessage(role, text, pending = false) {
  const row = document.createElement('article');
  row.className = `message ${role}`;
  const avatar = document.createElement('div');
  avatar.className = 'avatar'; avatar.textContent = role === 'user' ? 'Eu' : 'J'; avatar.setAttribute('aria-hidden', 'true');
  const bubble = document.createElement('div');
  bubble.className = `bubble${pending ? ' pending' : ''}`; bubble.textContent = text;
  row.append(avatar, bubble); conversation.append(row); updateWelcome();
  conversation.scrollIntoView({ block: 'end', behavior: 'smooth' });
  return bubble;
}
function renderChat() {
  conversation.replaceChildren();
  const chat = currentChat();
  chat?.messages.forEach(message => addMessage(message.role, message.content));
  updateWelcome();
  renderHistory();
}
function renderHistory() {
  const list = document.querySelector('#history-list'); list.replaceChildren();
  if (!chats.length) { list.innerHTML = '<p class="empty-state">Suas conversas vão aparecer aqui.</p>'; return; }
  [...chats].reverse().forEach(chat => {
    const row = document.createElement('div'); row.className = 'history-item';
    const open = document.createElement('button'); open.className = 'history-open'; open.textContent = chat.title || 'Nova conversa'; open.title = open.textContent;
    open.addEventListener('click', () => { activeId = chat.id; localStorage.setItem(KEYS.active, activeId); renderChat(); closeDrawers(); });
    const remove = document.createElement('button'); remove.className = 'delete-item'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Excluir conversa');
    remove.addEventListener('click', () => { chats = chats.filter(item => item.id !== chat.id); if (activeId === chat.id) { activeId = null; localStorage.removeItem(KEYS.active); } saveChats(); renderChat(); });
    row.append(open, remove); list.append(row);
  });
}
function openDrawer(drawer) {
  [historyDrawer, notesDrawer, trackerDrawer].forEach(item => { item.classList.remove('open'); item.setAttribute('aria-hidden', 'true'); });
  drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); scrim.classList.add('open');
}
function closeDrawers() {
  [historyDrawer, notesDrawer, trackerDrawer].forEach(drawer => { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); });
  scrim.classList.remove('open');
}
function renderNotes() {
  const list = document.querySelector('#notes-list'); list.replaceChildren();
  if (!notes.length) { list.innerHTML = '<p class="empty-state">Ideias e lembretes para guardar aqui.</p>'; return; }
  [...notes].reverse().forEach(note => {
    const row = document.createElement('div'); row.className = 'note-item';
    const copy = document.createElement('div'); copy.className = 'note-copy'; copy.textContent = note.text;
    if (note.due) { const due = document.createElement('time'); due.dateTime = note.due; due.textContent = `Lembrete · ${new Date(note.due).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`; copy.append(due); }
    const remove = document.createElement('button'); remove.className = 'delete-item'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Excluir nota');
    remove.addEventListener('click', () => { notes = notes.filter(item => item.id !== note.id); localStorage.setItem(KEYS.notes, JSON.stringify(notes)); renderNotes(); });
    row.append(copy, remove); list.append(row);
  });
}
function numericValue(value) {
  const normalized = String(value).trim().replace(/\s/g, '').replace(/R\$/i, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}
function currency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
function dateLabel(value) { return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }
function renderTrackers() {
  const list = document.querySelector('#tracker-list'); list.replaceChildren();
  const numeric = trackers.map(item => numericValue(item.value)).filter(value => value !== null);
  const total = numeric.reduce((sum, value) => sum + value, 0);
  document.querySelector('#tracker-count').textContent = `${trackers.length} ${trackers.length === 1 ? 'item' : 'itens'}`;
  document.querySelector('#tracker-total').textContent = currency(total);
  renderTrackerChart();
  if (!trackers.length) { list.innerHTML = '<p class="empty-state">Seus itens acompanhados aparecem aqui.</p>'; return; }
  [...trackers].reverse().forEach(item => {
    const row = document.createElement('article'); row.className = 'tracker-item';
    const main = document.createElement('div'); main.className = 'tracker-item-main';
    const title = document.createElement('strong'); title.textContent = item.name;
    const meta = document.createElement('span'); meta.textContent = `${item.category} · ${item.date}`;
    const value = document.createElement('b'); value.textContent = item.value;
    const history = document.createElement('details'); history.className = 'tracker-history';
    const summary = document.createElement('summary'); summary.textContent = `Histórico (${item.history.length})`;
    const historyList = document.createElement('ul');
    item.history.slice().reverse().forEach(entry => {
      const li = document.createElement('li');
      li.textContent = `${entry.date} · ${entry.value}${entry.action === 'add' ? ' · criado' : ' · atualizado'}`;
      historyList.append(li);
    });
    history.append(summary, historyList); main.append(title, meta, history);
    const actions = document.createElement('div'); actions.className = 'tracker-item-side';
    actions.append(value);
    const edit = document.createElement('button'); edit.className = 'tracker-small-button'; edit.textContent = 'Editar'; edit.addEventListener('click', () => {
      document.querySelector('#tracker-name').value = item.name;
      document.querySelector('#tracker-value').value = item.value;
      document.querySelector('#tracker-category').value = item.category;
      document.querySelector('#tracker-date').value = item.date;
      document.querySelector('#tracker-id').value = item.id;
      document.querySelector('#tracker-save').textContent = 'Atualizar';
      document.querySelector('#tracker-name').focus();
    });
    const remove = document.createElement('button'); remove.className = 'tracker-small-button danger'; remove.textContent = 'Excluir'; remove.addEventListener('click', () => {
      trackers = trackers.filter(entry => entry.id !== item.id); saveTrackers(); renderTrackers();
    });
    actions.append(edit, remove); row.append(main, actions); list.append(row);
  });
}
function renderTrackerChart() {
  const chart = document.querySelector('#tracker-chart'); chart.replaceChildren();
  const byDate = new Map();
  trackers.forEach(item => {
    const value = numericValue(item.value);
    if (value !== null) byDate.set(item.date, (byDate.get(item.date) || 0) + value);
  });
  const entries = [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-7);
  if (!entries.length) { chart.innerHTML = '<p class="chart-empty">Adicione valores numéricos para ver o gráfico.</p>'; return; }
  const max = Math.max(...entries.map(([, value]) => Math.abs(value)), 1);
  entries.forEach(([date, value]) => {
    const column = document.createElement('div'); column.className = 'chart-column';
    const amount = document.createElement('span'); amount.textContent = currency(value); amount.title = amount.textContent;
    const bar = document.createElement('div'); bar.className = 'chart-bar'; bar.style.height = `${Math.max(5, Math.abs(value) / max * 100)}%`;
    const label = document.createElement('span'); label.textContent = dateLabel(date);
    column.append(amount, bar, label); chart.append(column);
  });
}
function renderTrackerSummary() {
  if (!trackers.length) return 'Ainda não há itens no Rastreador.';
  const numeric = trackers.map(item => numericValue(item.value)).filter(value => value !== null);
  const total = numeric.reduce((sum, value) => sum + value, 0);
  return `No Rastreador há ${trackers.length} ${trackers.length === 1 ? 'item' : 'itens'} (total numérico: ${currency(total)}):\n${trackers.map(item => `• ${item.name}: ${item.value} · ${item.category} · ${item.date}`).join('\n')}`;
}
function addTracker(name, value, category = 'Geral', date = new Date().toISOString().slice(0, 10)) {
  const item = { id: makeId(), name: name.trim(), value: value.trim(), category: category.trim() || 'Geral', date, history: [{ value: value.trim(), date, action: 'add' }] };
  trackers.push(item); saveTrackers(); renderTrackers();
  return item;
}
function updateTracker(item, value, date = new Date().toISOString().slice(0, 10)) {
  item.value = value.trim(); item.date = date;
  item.history.push({ value: item.value, date, action: 'update' });
  saveTrackers(); renderTrackers();
}
function handleTrackerCommand(text) {
  const query = text.trim();
  if (/^(?:meus rastreadores|listar rastreadores|ver rastreadores|rastreador|resumo dos rastreadores|total (?:do )?rastreador|quanto tenho rastreado|quanto tem no rastreador)$/i.test(query)) {
    return renderTrackerSummary();
  }
  const add = query.match(/^(?:rastrear|adicionar ao rastreador|adicionar no rastreador|registre no rastreador|registrar no rastreador)\s+(.+?)\s*=\s*(.+?)(?:\s*\|\s*categoria\s+(.+?))?(?:\s*\|\s*data\s+(\d{4}-\d{2}-\d{2}))?$/i);
  if (add) {
    const item = addTracker(add[1], add[2], add[3] || 'Geral', add[4] || new Date().toISOString().slice(0, 10));
    return `Pronto, adicionei **${item.name}** ao Rastreador com valor **${item.value}** na categoria **${item.category}**.\n\n${renderTrackerSummary()}`;
  }
  const update = query.match(/^(?:atualizar rastreador|atualize o rastreador|mudar rastreador)\s+(.+?)\s*=\s*(.+?)(?:\s*\|\s*data\s+(\d{4}-\d{2}-\d{2}))?$/i);
  if (update) {
    const item = trackers.find(entry => entry.name.toLocaleLowerCase('pt-BR') === update[1].trim().toLocaleLowerCase('pt-BR'));
    if (!item) return `Não achei “${update[1].trim()}” no Rastreador. Confira o nome em Rastreador.`;
    updateTracker(item, update[2], update[3] || new Date().toISOString().slice(0, 10));
    return `Atualizei **${item.name}** para **${item.value}**. O histórico ficou salvo.\n\n${renderTrackerSummary()}`;
  }
  return null;
}
function trackerContext() {
  return JSON.stringify(trackers.map(({ name, value, category, date, history }) => ({ name, value, category, date, history })));
}
async function typeReply(element, text) {
  element.classList.add('pending');
  const step = Math.max(1, Math.ceil(text.length / 190));
  for (let index = 0; index < text.length; index += step) {
    element.textContent = text.slice(0, index + step);
    await new Promise(resolve => setTimeout(resolve, 14));
  }
  element.textContent = text; element.classList.remove('pending');
}
function speak(text) {
  if (!voiceEnabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR'; utterance.rate = 0.96; utterance.pitch = 1.02;
  if (selectedVoice) utterance.voice = selectedVoice;
  window.speechSynthesis.speak(utterance);
}
function chooseVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices().filter(voice => voice.lang.toLowerCase().startsWith('pt-br'));
  const preferred = /google|microsoft|luciana|francisca|brasil|portugu[eê]s.*br/i;
  selectedVoice = voices.find(voice => preferred.test(voice.name)) || voices.find(voice => !voice.localService) || voices[0] || null;
}
function updateVoiceButton() {
  const button = document.querySelector('#voice-toggle');
  button.innerHTML = voiceEnabled
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Zm4 4a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6"/></svg>';
  button.setAttribute('aria-label', voiceEnabled ? 'Desativar voz' : 'Ativar voz');
  button.title = voiceEnabled ? 'Voz ativada' : 'Voz desativada';
}
async function sendMessage(text) {
  const content = text.trim(); if (!content || busy) return;
  busy = true; sendButton.disabled = true; status.textContent = '';
  let chat = currentChat();
  if (!chat) {
    chat = { id: makeId(), title: content.slice(0, 48), messages: [], updatedAt: new Date().toISOString() };
    chats.push(chat); activeId = chat.id; localStorage.setItem(KEYS.active, activeId);
  }
  chat.messages.push({ role: 'user', content }); chat.updatedAt = new Date().toISOString();
  addMessage('user', content); const bubble = addMessage('assistant', 'Pensando...', true);
  saveChats(); renderHistory();
  try {
    const localReply = handleTrackerCommand(content);
    let reply = localReply;
    if (!reply) {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: chat.messages, tracker_context: trackerContext() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Não consegui responder agora. Tente novamente.');
      reply = data.reply;
    }
    bubble.textContent = '';
    chat.messages.push({ role: 'assistant', content: reply }); chat.updatedAt = new Date().toISOString(); saveChats();
    await typeReply(bubble, reply); speak(reply);
  } catch (error) {
    conversation.lastElementChild?.remove();
    status.textContent = error.message || 'Ops, algo deu errado. Tente novamente.';
    chat.messages.pop(); saveChats();
  } finally { busy = false; sendButton.disabled = false; input.focus(); }
}
form.addEventListener('submit', event => { event.preventDefault(); const text = input.value; input.value = ''; input.style.height = 'auto'; sendMessage(text); });
input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 150)}px`; });
input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
document.querySelectorAll('.quick-action').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.prompt; input.focus(); input.dispatchEvent(new Event('input')); }));
document.querySelector('#history-toggle').addEventListener('click', () => { renderHistory(); openDrawer(historyDrawer); });
document.querySelector('#notes-toggle').addEventListener('click', () => { renderNotes(); openDrawer(notesDrawer); });
document.querySelector('#tracker-toggle').addEventListener('click', () => { renderTrackers(); openDrawer(trackerDrawer); });
document.querySelectorAll('.close-drawer').forEach(button => button.addEventListener('click', closeDrawers));
scrim.addEventListener('click', closeDrawers);
document.querySelector('#new-chat').addEventListener('click', () => { activeId = null; localStorage.removeItem(KEYS.active); renderChat(); closeDrawers(); input.focus(); });
document.querySelector('#note-form').addEventListener('submit', event => {
  event.preventDefault(); const noteInput = document.querySelector('#note-input'); const text = noteInput.value.trim(); if (!text) return;
  notes.push({ id: makeId(), text, due: document.querySelector('#reminder-date').value || null, createdAt: new Date().toISOString() });
  localStorage.setItem(KEYS.notes, JSON.stringify(notes)); noteInput.value = ''; document.querySelector('#reminder-date').value = ''; renderNotes();
});
document.querySelector('#tracker-form').addEventListener('submit', event => {
  event.preventDefault();
  const idField = document.querySelector('#tracker-id');
  const name = document.querySelector('#tracker-name').value.trim();
  const value = document.querySelector('#tracker-value').value.trim();
  const category = document.querySelector('#tracker-category').value.trim() || 'Geral';
  const date = document.querySelector('#tracker-date').value || new Date().toISOString().slice(0, 10);
  if (idField.value) {
    const item = trackers.find(entry => entry.id === idField.value);
    if (item) { item.name = name; item.category = category; updateTracker(item, value, date); }
  } else addTracker(name, value, category, date);
  event.target.reset(); idField.value = ''; document.querySelector('#tracker-save').textContent = 'Adicionar';
});
document.querySelector('#tracker-cancel').addEventListener('click', () => {
  document.querySelector('#tracker-form').reset(); document.querySelector('#tracker-id').value = ''; document.querySelector('#tracker-save').textContent = 'Adicionar';
});
document.querySelector('#theme-toggle').addEventListener('click', () => {
  const light = document.documentElement.classList.toggle('light');
  localStorage.setItem(KEYS.theme, light ? 'light' : 'dark');
  document.querySelector('meta[name="theme-color"]').content = light ? '#f7f7f2' : '#11120f';
});
document.querySelector('#voice-toggle').addEventListener('click', () => {
  voiceEnabled = !voiceEnabled; localStorage.setItem(KEYS.voice, voiceEnabled ? 'on' : 'off');
  if (!voiceEnabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  updateVoiceButton();
});
document.querySelector('#mic-button').addEventListener('click', () => {
  if (!recognition) { status.textContent = 'O reconhecimento de voz não está disponível neste navegador.'; return; }
  try { recognition.start(); status.textContent = 'Pode falar — estou ouvindo.'; } catch { status.textContent = 'O microfone já está ouvindo.'; }
});
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognitionAPI) {
  recognition = new SpeechRecognitionAPI(); recognition.lang = 'pt-BR'; recognition.interimResults = false; recognition.maxAlternatives = 1;
  recognition.onresult = event => { input.value = event.results[0][0].transcript; input.dispatchEvent(new Event('input')); input.focus(); status.textContent = 'Entendi! Revise a mensagem e toque em Enviar.'; };
  recognition.onerror = () => { status.textContent = 'Não consegui ouvir. Verifique a permissão do microfone e tente novamente.'; };
  recognition.onend = () => { if (status.textContent === 'Pode falar — estou ouvindo.') status.textContent = ''; };
} else document.querySelector('#mic-button').disabled = true;
if (localStorage.getItem(KEYS.theme) === 'light') document.documentElement.classList.add('light');
if (!chats.some(chat => chat.id === activeId)) { activeId = null; localStorage.removeItem(KEYS.active); }
if ('speechSynthesis' in window) { chooseVoice(); window.speechSynthesis.onvoiceschanged = chooseVoice; }
updateVoiceButton(); renderChat(); renderNotes(); renderTrackers();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(() => {}));
