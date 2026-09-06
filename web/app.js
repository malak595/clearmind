const STORAGE_KEY = 'clearmind-state-v2';
const defaultState = { moodHistory: [], goals: [], entries: [], toolsUsed: 0, streak: 0, lastActive: null };
let state = loadState();
let selectedMood = null;
let activeExercise = null;
let exerciseTimer = null;
let audioContext = null;
let activeSound = null;
let soundSession = null;
let deferredInstallPrompt = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || typeof stored !== 'object') return { ...defaultState };
    return {
      ...defaultState,
      ...stored,
      moodHistory: Array.isArray(stored.moodHistory) ? stored.moodHistory : [],
      goals: Array.isArray(stored.goals) ? stored.goals : [],
      entries: Array.isArray(stored.entries) ? stored.entries : [],
      toolsUsed: Number.isFinite(stored.toolsUsed) ? stored.toolsUsed : 0,
      streak: Number.isFinite(stored.streak) ? stored.streak : 0
    };
  }
  catch { return { ...defaultState }; }
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { showToast('This browser cannot save more data. Export or clear old browser data.'); }
}
function todayKey(date = new Date()) { return date.toISOString().slice(0, 10); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2800); }

function navigate(view) {
  $$('.view').forEach((section) => section.classList.toggle('active-view', section.id === `view-${view}`));
  $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  window.location.hash = view;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateHeader() {
  const date = new Date();
  $('#date-label').textContent = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const hour = date.getHours();
  $('#greeting').textContent = hour < 12 ? 'Good morning, friend.' : hour < 18 ? 'Good afternoon, friend.' : 'Good evening, friend.';
}

function selectMood(mood) {
  selectedMood = mood;
  $$('.mood-button').forEach((button) => button.classList.toggle('selected', button.dataset.mood === mood));
  $('#checkin-followup').classList.remove('hidden');
  $('#checkin-followup').querySelector('label').textContent = `How much energy do you have with feeling ${mood}?`;
}

function saveCheckin() {
  if (!selectedMood) return;
  const existing = state.moodHistory.find((entry) => entry.date === todayKey());
  const checkin = { date: todayKey(), mood: selectedMood, energy: Number($('#energy-range').value) };
  if (existing) Object.assign(existing, checkin); else state.moodHistory.push(checkin);
  markActive(); saveState(); renderDashboard(); renderRecommendation();
  $('#checkin-followup').classList.add('hidden');
  showToast('Check-in saved. Thank you for noticing how you feel.');
}

function markActive() {
  const today = todayKey();
  if (state.lastActive === today) return;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  state.streak = state.lastActive === todayKey(yesterday) ? state.streak + 1 : 1;
  state.lastActive = today;
}

const recommendations = {
  great: ['Protect the good feeling', 'Write down one thing that is helping today, then carry it into your next small task.', 'journal'],
  okay: ['A soft reset', 'Try a two-minute box breath or a gentle stretch to give your attention a fresh starting point.', 'box'],
  low: ['Be extra kind to yourself', 'Choose one easy care action: water, fresh air, a warm shower, or a message to someone safe.', 'grounding'],
  anxious: ['Lower the volume', 'Start with four slow breaths and name five things you can see. You do not need to solve everything now.', 'box'],
  tired: ['Rest is useful', 'Pick Ocean Sleep or a body scan, and let the goal be comfort rather than perfect sleep.', 'relax']
};
function renderRecommendation() {
  const mood = state.moodHistory.find((item) => item.date === todayKey())?.mood || selectedMood;
  if (!mood || !recommendations[mood]) return;
  const [title, text, action] = recommendations[mood];
  $('#recommendation-title').textContent = title;
  $('#recommendation-text').textContent = text;
  $('#recommendation-card').dataset.actionTarget = action;
}
function useRecommendation() {
  const action = $('#recommendation-card').dataset.actionTarget;
  if (action === 'journal') { navigate('journal'); $('#journal-content').focus(); return; }
  openExercise(action || 'box');
}

function renderDashboard() {
  const completed = state.goals.filter((goal) => goal.done).length;
  const total = state.goals.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  $('#goal-ring').textContent = `${percent}%`;
  $('#streak-value').textContent = state.streak;
  $('#checkin-count').textContent = state.moodHistory.length;
  $('#goal-count').textContent = completed;
  $('#tool-count').textContent = state.toolsUsed;
  $('#goal-empty').classList.toggle('hidden', total > 0);
  $('#goal-list').innerHTML = state.goals.map((goal) => `<div class="goal-row ${goal.done ? 'done' : ''}"><button data-goal="${goal.id}" aria-label="${goal.done ? 'Reopen' : 'Complete'} goal">${goal.done ? '✓' : ''}</button><span>${escapeHtml(goal.text)}</span></div>`).join('');
  $('#week-dots').innerHTML = [...Array(7)].map((_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); const key = todayKey(date); const active = state.moodHistory.some((item) => item.date === key) || state.lastActive === key; return `<span class="${active ? 'active' : ''}" data-day="${date.toLocaleDateString(undefined, { weekday: 'narrow' })}"></span>`; }).join('');
}

function addGoal(event) {
  event.preventDefault();
  const input = $('#goal-input'); const text = input.value.trim();
  if (!text) return;
  state.goals.unshift({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), text, done: false });
  input.value = ''; markActive(); saveState(); renderDashboard(); showToast('A small goal added for today.');
}
function toggleGoal(id) {
  const goal = state.goals.find((item) => item.id === id);
  if (!goal) return;
  goal.done = !goal.done; markActive(); saveState(); renderDashboard();
  showToast(goal.done ? 'Goal complete. That counts.' : 'Goal reopened. No pressure.');
}

function addMessage(text, type) { const node = document.createElement('div'); node.className = `message ${type}`; node.textContent = text; $('#chat-messages').appendChild(node); $('#chat-messages').scrollTop = $('#chat-messages').scrollHeight; }
function botReply(text) {
  const lower = text.toLowerCase();
  if (/(suicide|suicidal|kill myself|hurt myself|self harm|end my life|want to die)/.test(lower)) return 'I am really sorry you are carrying this. Please do not stay alone: contact local emergency services or a crisis line now, tell someone you trust exactly what is happening, and move away from anything you could use to hurt yourself. I am not a psychologist or doctor and cannot provide emergency help.';
  if (/(panic attack|panic|anxious|anxiety|worried|nervous|racing thoughts)/.test(lower)) return 'When anxiety rises, first make the next minute smaller: put both feet on the floor, breathe out slowly four times, and name five things you can see. Then write down what is in your control today. If panic keeps returning or disrupts your life, a qualified professional can help you build a treatment plan.';
  if (/(stress|overwhelm|overwhelmed|burnout|too much|pressure)/.test(lower)) return 'Stress often needs fewer demands and more recovery. Choose one must-do task, one task to postpone, and one short care break. A five-minute walk, water, or a grounding practice can help your nervous system reset. What is one pressure you can reduce today?';
  if (/(sad|low|depress|depressed|cry|hopeless)/.test(lower)) return 'I hear how heavy this feels. You do not have to make the whole day better. Try one basic care step, such as eating something, opening a window, or messaging someone safe. If low mood lasts, worsens, or affects daily life, please consider speaking with a qualified mental health professional.';
  if (/(lonely|alone|isolated|no friends|rejected)/.test(lower)) return 'Feeling alone can make everything louder. Try a low-pressure connection: send a simple “thinking of you” message, sit near other people, or join a supportive group around an interest. You do not need to explain everything to deserve company. Who feels safest to contact?';
  if (/(sleep|insomnia|can.t sleep|wake up|nightmare)/.test(lower)) return 'For sleep, keep the next hour quiet and predictable: dim lights, put the phone away if possible, and try a body scan or slow breathing. If you cannot sleep, leave the bed briefly for a calm activity and return when sleepy. Persistent sleep problems are worth discussing with a clinician.';
  if (/(tired|exhaust|fatigue|no energy|rest)/.test(lower)) return 'Your body may be asking for care, not criticism. Check the basics: water, food, daylight, movement, and a real pause. Lower today’s expectations to one necessary step and one kind step. If fatigue is new, severe, or persistent, a healthcare professional can help check possible causes.';
  if (/(angry|mad|furious|frustr|rage)/.test(lower)) return 'Anger can be useful information, but it deserves a pause before action. Unclench your hands, lengthen your exhale, step away from the trigger, and name the need or boundary underneath the anger. If you might hurt someone, create distance and contact immediate support.';
  if (/(grief|grieving|loss|died|bereav)/.test(lower)) return 'Grief is not a problem you have to solve on a schedule. Let the feeling come in waves, keep one small routine, and accept practical support from people you trust. A grief counselor or support group can offer care that friends may not know how to provide.';
  if (/(relationship|partner|breakup|family|friend|conflict|boundary)/.test(lower)) return 'Try separating the feeling, the need, and the request: “I feel… I need… Would you be willing to…?” Choose a calm moment and speak from your experience rather than guessing someone else’s intent. A boundary is about what you will do to care for yourself, not controlling another person.';
  if (/(self esteem|self-worth|worthless|hate myself|insecure|confidence)/.test(lower)) return 'Self-worth is not something you have to earn by being perfect. Notice the harsh thought, ask whether you would say it to someone you love, and replace it with a fairer sentence based on facts. Keep one tiny promise to yourself today; trust grows through repeated actions.';
  if (/(focus|concentrat|procrastinat|motivat|distract)/.test(lower)) return 'Make focus easier instead of demanding more willpower: choose one task, set a five-minute timer, remove one distraction, and stop or continue when it ends. Starting small is a strategy, not a failure. What is the smallest visible next action?';
  if (/(trauma|flashback|trigger|abuse)/.test(lower)) return 'That sounds deeply difficult. Focus first on present safety and grounding: look around, name the date and place, and connect with someone trustworthy. You do not need to describe details here. A trauma-informed mental health professional can help you work through this safely.';
  if (/(exercise|breath|ground|calm|relax|tool)/.test(lower)) return 'For a quick reset, I suggest box breathing if your thoughts feel fast, 5–4–3–2–1 grounding if you feel detached, or a body scan if you need rest. Open Calm Tools and choose the one that feels easiest, not the one that sounds perfect.';
  if (/(thank|thanks)/.test(lower)) return 'You are welcome. I am glad you gave yourself a moment here. What would feel supportive as your next small step?';
  if (/(hello|hi|hey)/.test(lower)) return 'Hello. I am glad you are here. What has your attention today?';
  return 'I can help you think through common wellness questions about anxiety, stress, low mood, sleep, grief, relationships, self-esteem, focus, anger, loneliness, and coping. I cannot diagnose or replace a psychologist or doctor. Tell me what you are noticing, how long it has been happening, and what feels hardest right now.';
}
function sendChat(event) { event.preventDefault(); const input = $('#chat-input'); const text = input.value.trim(); if (!text) return; addMessage(text, 'user'); input.value = ''; updateChatCount(); $('#typing-indicator').classList.remove('hidden'); input.disabled = true; setTimeout(() => { $('#typing-indicator').classList.add('hidden'); input.disabled = false; addMessage(botReply(text), 'bot'); input.focus(); }, 500); }
function clearChat() { $('#chat-messages').innerHTML = ''; initChat(); showToast('Conversation cleared on this device.'); }
function updateChatCount() { $('#chat-count').textContent = `${$('#chat-input').value.length} / 500`; }
function initChat() { if (!$('#chat-messages').children.length) addMessage('Hi, I am ClearMind. I can offer supportive wellness ideas, but I am not a psychologist or doctor. How are you feeling today?', 'bot'); }

const exerciseDetails = {
  box: { title: 'Box breathing', tag: 'Breathing', copy: 'Four equal phases. Keep the breath comfortable and stop if you feel dizzy.', phases: [['Inhale', 4], ['Hold', 4], ['Exhale', 4], ['Hold', 4]], rounds: 3 },
  grounding: { title: '5–4–3–2–1 grounding', tag: 'Grounding', copy: 'Look around slowly. Name five things you see, four you feel, three you hear, two you smell, and one you taste.', phases: [['Look around', 30]], rounds: 1 },
  stretch: { title: 'Gentle stretch reset', tag: 'Movement', copy: 'Roll your shoulders, soften your jaw, and turn your neck slowly. Never push into pain.', phases: [['Shoulders', 20], ['Jaw', 20], ['Neck', 20], ['Reach', 20]], rounds: 1 },
  relax: { title: 'Guided body scan', tag: 'Mindfulness', copy: 'Soften your forehead, jaw, shoulders, hands, belly, and legs. Let each exhale release a little effort.', phases: [['Forehead', 30], ['Shoulders', 30], ['Hands', 30], ['Belly', 30], ['Legs', 30]], rounds: 1 }
};
function openExercise(type) { activeExercise = { type, ...exerciseDetails[type] }; $('#modal-tag').textContent = activeExercise.tag; $('#modal-title').textContent = activeExercise.title; $('#modal-copy').textContent = activeExercise.copy; $('#modal-timer').textContent = 'Ready'; $('#modal-progress-bar').style.width = '0%'; $('#modal-start').textContent = 'Start practice'; $('#exercise-modal').classList.remove('hidden'); }
function startExercise() {
  if (!activeExercise) return;
  clearInterval(exerciseTimer); let phaseIndex = 0; let seconds = activeExercise.phases[0][1]; const total = activeExercise.phases.reduce((sum, phase) => sum + phase[1], 0) * activeExercise.rounds; let elapsed = 0;
  $('#modal-start').textContent = 'Running...';
  const tick = () => { const [label] = activeExercise.phases[phaseIndex]; $('#modal-timer').textContent = `${label} · ${seconds}s`; $('#modal-progress-bar').style.width = `${Math.min(100, (elapsed / total) * 100)}%`; seconds -= 1; elapsed += 1; if (seconds < 0) { phaseIndex = (phaseIndex + 1) % activeExercise.phases.length; if (phaseIndex === 0 && elapsed >= total) { clearInterval(exerciseTimer); $('#modal-timer').textContent = 'Finished'; $('#modal-start').textContent = 'Done'; state.toolsUsed += 1; markActive(); saveState(); renderDashboard(); showToast('Practice complete. Notice how you feel.'); return; } seconds = activeExercise.phases[phaseIndex][1]; } };
  tick(); exerciseTimer = setInterval(tick, 1000);
}
function closeModal() { clearInterval(exerciseTimer); $('#exercise-modal').classList.add('hidden'); }

function stopSound() {
  if (soundSession) {
    soundSession.nodes.forEach((node) => {
      try { node.stop?.(); node.disconnect?.(); } catch { /* already stopped */ }
    });
    soundSession.output.disconnect();
  }
  soundSession = null;
  activeSound = null;
  $$('.music-card').forEach((card) => card.classList.remove('playing'));
  $('#now-playing').textContent = 'Sound paused. Choose a playlist whenever you need a little atmosphere.';
  $('#now-playing').classList.remove('hidden');
}

function createNoiseSource(type) {
  const sampleRate = audioContext.sampleRate;
  const buffer = audioContext.createBuffer(2, sampleRate * 3, sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) {
      const previous = index ? data[index - 1] : 0;
      const whiteNoise = Math.random() * 2 - 1;
      data[index] = type === 'ocean' ? previous * .995 + whiteNoise * .025 : whiteNoise * .28;
    }
  }
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = audioContext.createBiquadFilter();
  filter.type = type === 'rain' ? 'highpass' : 'lowpass';
  filter.frequency.value = type === 'rain' ? 1200 : 700;
  source.connect(filter);
  return { source, filter };
}

function playSound(name) {
  const labels = { rain: 'Rainy focus', ocean: 'Ocean sleep', night: 'Night meditation', study: 'Soft study' };
  if (activeSound === name) { stopSound(); return; }
  stopSound();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) { showToast('This browser does not support ambient audio.'); return; }
  if (!audioContext) audioContext = new AudioContextClass();
  audioContext.resume();
  const output = audioContext.createGain();
  output.gain.value = .2;
  output.connect(audioContext.destination);
  const nodes = [];
  if (name === 'rain' || name === 'ocean') {
    const noise = createNoiseSource(name);
    const noiseGain = audioContext.createGain();
    noiseGain.gain.value = name === 'rain' ? .34 : .95;
    noise.filter.connect(noiseGain); noiseGain.connect(output); noise.source.start();
    nodes.push(noise.source);
  }
  if (name === 'ocean' || name === 'night' || name === 'study') {
    const frequencies = name === 'ocean' ? [110] : name === 'night' ? [174, 261] : [196, 294, 392];
    frequencies.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const toneGain = audioContext.createGain();
      oscillator.type = name === 'ocean' ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      toneGain.gain.value = name === 'ocean' ? .2 : name === 'night' ? .12 / (index + 1) : .09 / (index + 1);
      oscillator.connect(toneGain); toneGain.connect(output); oscillator.start(); nodes.push(oscillator);
    });
  }
  soundSession = { nodes, output };
  activeSound = name;
  $$('.music-card').forEach((card) => card.classList.toggle('playing', card.dataset.sound === name));
  $('#now-playing').textContent = `Now playing: ${labels[name]} · tap it again to pause.`;
  $('#now-playing').classList.remove('hidden');
  state.toolsUsed += 1; markActive(); saveState(); renderDashboard();
}

function saveJournal(event) { event.preventDefault(); const title = $('#journal-title-input').value.trim() || 'Untitled reflection'; const content = $('#journal-content').value.trim(); if (!content) { showToast('Write a thought before saving.'); return; } state.entries.unshift({ id: Date.now(), title, content, date: new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) }); $('#journal-form').reset(); markActive(); saveState(); renderEntries(); renderDashboard(); showToast('Your reflection was saved on this device.'); }
function renderEntries() { $('#entry-count').textContent = `${state.entries.length} ${state.entries.length === 1 ? 'entry' : 'entries'}`; $('#entry-empty').classList.toggle('hidden', state.entries.length > 0); $('#entry-list').innerHTML = state.entries.map((entry) => `<article class="entry-card"><h4>${escapeHtml(entry.title)}</h4><time>${escapeHtml(entry.date)}</time><p>${escapeHtml(entry.content)}</p></article>`).join(''); }
function journalPrompt() { const prompts = ['What would you like your future self to remember about today?', 'What is one feeling you can make space for without fixing?', 'What helped even a little today?']; $('#journal-content').value = prompts[Math.floor(Math.random() * prompts.length)]; $('#journal-content').focus(); }

function openResources() { navigate('chat'); setTimeout(() => $('.safety-note')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100); }
function quickCalm() { openExercise('box'); }
async function installApp() {
  if (!deferredInstallPrompt) { showToast('Use your browser menu and choose Add to Home Screen.'); return; }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $('.install-button').classList.add('hidden');
}
function bindEvents() {
  $$('.nav-item,[data-view]').forEach((element) => element.addEventListener('click', () => navigate(element.dataset.view)));
  $$('.mood-button').forEach((button) => button.addEventListener('click', () => selectMood(button.dataset.mood)));
  $$('.suggestion').forEach((button) => button.addEventListener('click', () => { $('#chat-input').value = button.dataset.prompt; $('#chat-input').focus(); }));
  $$('.tool-card [data-exercise]').forEach((button) => button.addEventListener('click', () => openExercise(button.dataset.exercise)));
  $$('.music-card').forEach((card) => card.addEventListener('click', () => playSound(card.dataset.sound)));
  $$('[data-action="quick-calm"]').forEach((button) => button.addEventListener('click', quickCalm));
  $$('[data-action="open-resources"]').forEach((button) => button.addEventListener('click', openResources));
  $('[data-action="save-checkin"]').addEventListener('click', saveCheckin); $('[data-action="use-recommendation"]').addEventListener('click', useRecommendation); $('[data-action="close-modal"]').addEventListener('click', closeModal); $('[data-action="start-exercise"]').addEventListener('click', startExercise); $('[data-action="journal-prompt"]').addEventListener('click', journalPrompt); $('[data-action="install-app"]').addEventListener('click', installApp); $('[data-action="clear-chat"]').addEventListener('click', clearChat); $('#chat-input').addEventListener('input', updateChatCount);
  $('#goal-form').addEventListener('submit', addGoal); $('#goal-list').addEventListener('click', (event) => { const button = event.target.closest('[data-goal]'); if (button) toggleGoal(button.dataset.goal); }); $('#chat-form').addEventListener('submit', sendChat); $('#journal-form').addEventListener('submit', saveJournal);
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
}

updateHeader(); bindEvents(); renderDashboard(); renderEntries(); renderRecommendation(); initChat();
const initialView = window.location.hash.replace('#', ''); if (['today', 'chat', 'calm', 'journal'].includes(initialView)) navigate(initialView);
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstallPrompt = event; $('.install-button').classList.remove('hidden'); });
window.addEventListener('appinstalled', () => { $('.install-button').classList.add('hidden'); showToast('ClearMind was added to your home screen.'); });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
