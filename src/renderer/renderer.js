// ============================================================
// State
// ============================================================
let state = {
  todos: [],     // active memo items: { id, text, done, createdAt }
  history: [],   // archived items:    { id, text, done, createdAt, archivedAt, reason }
};

const views = {
  pet: document.getElementById('pet-view'),
  memo: document.getElementById('memo-view'),
  history: document.getElementById('history-view'),
};

// ============================================================
// Helpers
// ============================================================
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

async function persist() {
  try {
    await window.petAPI.saveData(state);
  } catch (e) {
    console.error('save failed', e);
  }
}

function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dayKey(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayLabel(key) {
  const todayKey = dayKey(Date.now());
  const yesterdayKey = dayKey(Date.now() - 86400000);
  if (key === todayKey) return '今天';
  if (key === yesterdayKey) return '昨天';
  return key;
}

// ============================================================
// View switching
// ============================================================
function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== name);
  });
  // Window resizes: pet form is small, memo/history are large.
  window.petAPI.setMode(name === 'pet' ? 'pet' : 'memo');

  if (name === 'memo') renderMemoList();
  if (name === 'history') renderHistory();
  if (name === 'pet') updatePetBubble();
}

// ============================================================
// PET
// ============================================================
const petEl = document.getElementById('petFace');
const petBubble = document.getElementById('pet-bubble');
const petContainer = document.querySelector('.pet');

// Random cute actions
const petActions = [
  'happy-bounce', 'wiggle', 'spin-jump', 'squish', 'excited', 'heartbeat', 'tumbler',
  'jelly', 'dizzy', 'bloat', 'sneeze', 'moonwalk', 'flip', 'shrink-bounce', 'yoga-stretch'
  , 'confused', 'wave', 'heartbeat-super', 'pogo'
];

// 进场动画类型
const enterAnimations = ['enter-fall', 'enter-roll-left', 'enter-roll-right'];

// 播放随机进场动画
function playEnterAnimation() {
  const anim = enterAnimations[Math.floor(Math.random() * enterAnimations.length)];
  petContainer.classList.add(anim);
  
  // 动画结束后移除类名
  setTimeout(() => {
    petContainer.classList.remove(anim);
  }, 1500);
}

function playRandomAction() {
  const petBody = document.querySelector('.pet-body');
  petBody.classList.remove(...petActions);
  void petBody.offsetWidth;
  const action = petActions[Math.floor(Math.random() * petActions.length)];
  petBody.classList.add(action);
  setTimeout(() => {
    petBody.classList.remove(action);
  }, 1000);
}

// Right-click to open memo
petEl.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showView('memo');
});

// Drag and click detection
let mouseDownTime = null;
let isDragging = false;
let hasDragged = false;
const CLICK_THRESHOLD = 200; // ms
const MOVE_THRESHOLD = 5; // pixels

petEl.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  mouseDownTime = Date.now();
  isDragging = false;
  hasDragged = false;
});

petEl.addEventListener('mousemove', (e) => {
  if (!mouseDownTime || isDragging) return;
  
  // Check if mouse moved enough to start dragging
  if (e.movementX !== undefined) {
    const totalMovement = Math.abs(e.movementX) + Math.abs(e.movementY);
    if (totalMovement > MOVE_THRESHOLD) {
      isDragging = true;
      hasDragged = true;
      window.petAPI.dragStart(e.screenX, e.screenY);
    }
  }
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    window.petAPI.dragMove(e.screenX, e.screenY);
  }
});

document.addEventListener('mouseup', (e) => {
  if (!mouseDownTime) return;
  
  const holdTime = Date.now() - mouseDownTime;
  
  // If it was a drag, end it
  if (isDragging) {
    window.petAPI.dragEnd();
  }
  // If it was a quick click without dragging, play action
  else if (holdTime < CLICK_THRESHOLD && !hasDragged) {
    playRandomAction();
  }
  
  mouseDownTime = null;
  isDragging = false;
  hasDragged = false;
});

function updatePetBubble() {
  const pending = state.todos.filter((t) => !t.done).length;
  if (pending > 0) {
    petBubble.textContent = pending > 99 ? '99+' : String(pending);
    petBubble.classList.remove('hidden');
  } else {
    petBubble.classList.add('hidden');
  }
}

// ============================================================
// EXIT ANIMATION
// ============================================================
function playExitAnimation() {
  const petBody = document.querySelector('.pet-body');
  const petContainer = document.querySelector('.pet');
  
  // 随机选择向左或向右滚动
  const direction = Math.random() < 0.5 ? 'left' : 'right';
  
  // 添加滚动动画类
  petContainer.classList.add('exit-roll', `exit-${direction}`);
  
  // 动画完成后退出程序
  setTimeout(() => {
    window.petAPI.close();
  }, 1200);
}

// ============================================================
// MEMO
// ============================================================
const memoInput = document.getElementById('memo-input');
const memoList = document.getElementById('memo-list');
const memoEmpty = document.getElementById('memo-empty');
const memoCounter = document.getElementById('memo-counter');

function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  state.todos.unshift({
    id: uid(),
    text: trimmed,
    done: false,
    createdAt: Date.now(),
  });
  persist();
  renderMemoList();
}

function toggleTodo(id) {
  const t = state.todos.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  persist();
  renderMemoList();
  
  // Check if all today's todos are done
  checkAndCelebrate();
}

function checkAndCelebrate() {
  const todayKey = dayKey(Date.now());
  const todayTodos = state.todos.filter(t => dayKey(t.createdAt) === todayKey);
  const allDone = todayTodos.length > 0 && todayTodos.every(t => t.done);
  
  if (allDone) {
    showCelebration();
  }
}

function showCelebration() {
  const celebration = document.getElementById('celebration');
  celebration.classList.remove('hidden');
  celebration.innerHTML = '';
  
  // Create main big firework in center
  setTimeout(() => createBigFirework(celebration, 50, 35), 100);
  
  // Create small fireworks
  for (let i = 0; i < 6; i++) {
    setTimeout(() => createSmallFirework(celebration), i * 200 + 200);
  }
  
  // Create stars
  for (let i = 0; i < 15; i++) {
    setTimeout(() => createStar(celebration), i * 100 + 50);
  }
  
  // Hide after animation
  setTimeout(() => {
    celebration.classList.add('hidden');
  }, 2500);
}

function createBigFirework(container, x, y) {
  const colors = ['#ff8fab', '#ff5d8f', '#ffd1dd', '#ffb3c9', '#fff', '#ffe066', '#ff9999'];
  
  for (let i = 0; i < 24; i++) {
    const particle = document.createElement('div');
    particle.className = 'firework big';
    particle.style.left = `${x}%`;
    particle.style.top = `${y}%`;
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    particle.style.width = '10px';
    particle.style.height = '10px';
    
    const angle = (i / 24) * Math.PI * 2;
    const distance = 80 + Math.random() * 40;
    particle.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
    particle.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
    
    container.appendChild(particle);
  }
}

function createSmallFirework(container) {
  const colors = ['#ff8fab', '#ff5d8f', '#ffd1dd', '#ffb3c9', '#fff'];
  const x = 10 + Math.random() * 80;
  const y = 15 + Math.random() * 50;
  
  for (let i = 0; i < 12; i++) {
    const particle = document.createElement('div');
    particle.className = 'firework';
    particle.style.left = `${x}%`;
    particle.style.top = `${y}%`;
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    
    const angle = (i / 12) * Math.PI * 2;
    const distance = 40 + Math.random() * 30;
    particle.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
    particle.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
    
    container.appendChild(particle);
  }
}

function createStar(container) {
  const stars = ['⭐', '✨', '🌟', '💫'];
  const x = 10 + Math.random() * 80;
  const y = 15 + Math.random() * 50;
  
  const star = document.createElement('div');
  star.className = 'star';
  star.textContent = stars[Math.floor(Math.random() * stars.length)];
  star.style.left = `${x}%`;
  star.style.top = `${y}%`;
  star.style.fontSize = `${14 + Math.random() * 10}px`;
  star.style.opacity = '0.5';
  
  const angle = Math.random() * Math.PI * 2;
  const distance = 30 + Math.random() * 40;
  star.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
  star.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
  
  container.appendChild(star);
}

function archiveTodo(todo, reason) {
  state.history.unshift({
    id: todo.id,
    text: todo.text,
    done: todo.done,
    createdAt: todo.createdAt,
    archivedAt: Date.now(),
    reason,
  });
}

function deleteTodo(id) {
  const idx = state.todos.findIndex((x) => x.id === id);
  if (idx === -1) return;
  const [removed] = state.todos.splice(idx, 1);
  archiveTodo(removed, removed.done ? 'completed' : 'deleted');
  persist();
  renderMemoList();
}

function clearDone() {
  const done = state.todos.filter((t) => t.done);
  if (done.length === 0) return;
  
  // Check if clearing completes all today's todos
  const todayKey = dayKey(Date.now());
  const todayTodos = state.todos.filter(t => dayKey(t.createdAt) === todayKey);
  const allTodayDone = todayTodos.length > 0 && todayTodos.every(t => t.done);
  
  done.forEach((t) => archiveTodo(t, 'completed'));
  state.todos = state.todos.filter((t) => !t.done);
  persist();
  renderMemoList();
  
  if (allTodayDone) {
    showCelebration();
  }
}

function renderMemoList() {
  memoList.innerHTML = '';
  const items = state.todos;

  memoEmpty.classList.toggle('hidden', items.length !== 0);
  memoList.classList.toggle('hidden', items.length === 0);

  items.forEach((todo) => {
    const li = document.createElement('li');
    li.className = 'memo-item' + (todo.done ? ' done' : '');

    const check = document.createElement('div');
    check.className = 'check' + (todo.done ? ' checked' : '');
    check.title = '标记完成';
    check.addEventListener('click', () => toggleTodo(todo.id));

    const span = document.createElement('span');
    span.className = 'memo-text';
    span.textContent = todo.text;

    const del = document.createElement('button');
    del.className = 'del-btn';
    del.textContent = '⨉';
    del.title = '删除';
    del.addEventListener('click', () => deleteTodo(todo.id));

    li.append(check, span, del);
    memoList.appendChild(li);
  });

  const pending = items.filter((t) => !t.done).length;
  memoCounter.textContent = `${items.length} 项 · 待办 ${pending}`;
}

// Memo events
document.getElementById('memo-add-btn').addEventListener('click', () => {
  addTodo(memoInput.value);
  memoInput.value = '';
  memoInput.focus();
});
memoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addTodo(memoInput.value);
    memoInput.value = '';
  }
});
document.getElementById('clear-done-btn').addEventListener('click', clearDone);
document.getElementById('back-to-pet-btn').addEventListener('click', () => showView('pet'));
document.getElementById('show-history-btn').addEventListener('click', () => showView('history'));
document.getElementById('memo-close-btn').addEventListener('click', () => {
  showView('pet');
  // 延迟一点时间让用户看到宠物，然后播放退场动画
  setTimeout(() => playExitAnimation(), 300);
});

// ============================================================
// HISTORY
// ============================================================
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const historyCounter = document.getElementById('history-counter');

function restoreFromHistory(id) {
  const idx = state.history.findIndex((h) => h.id === id);
  if (idx === -1) return;
  const [item] = state.history.splice(idx, 1);
  state.todos.unshift({
    id: uid(),
    text: item.text,
    done: false,
    createdAt: Date.now(),
  });
  persist();
  renderHistory();
}

function deleteFromHistory(id) {
  const idx = state.history.findIndex((h) => h.id === id);
  if (idx === -1) return;
  state.history.splice(idx, 1);
  persist();
  renderHistory();
}

function clearHistory() {
  if (state.history.length === 0) return;
  state.history = [];
  persist();
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = '';
  const items = state.history;

  historyEmpty.classList.toggle('hidden', items.length !== 0);
  historyList.classList.toggle('hidden', items.length === 0);

  const groups = {};
  items.forEach((it) => {
    const key = dayKey(it.archivedAt || it.createdAt);
    (groups[key] = groups[key] || []).push(it);
  });

  Object.keys(groups)
    .sort((a, b) => (a < b ? 1 : -1))
    .forEach((key) => {
      const title = document.createElement('div');
      title.className = 'history-group-title';
      title.textContent = dayLabel(key);
      historyList.appendChild(title);

      groups[key].forEach((it) => {
        const row = document.createElement('div');
        row.className = 'history-item' + (it.done ? ' done' : '');

        // 左侧内容区域
        const leftContent = document.createElement('div');
        leftContent.className = 'history-item-left';
        
        const status = document.createElement('span');
        status.className = 'history-status';
        status.textContent = it.reason === 'completed' || it.done ? '✔️' : '‍​✖️';

        const body = document.createElement('div');
        body.className = 'history-body';
        const text = document.createElement('div');
        text.className = 'history-text';
        text.textContent = it.text;
        const time = document.createElement('div');
        time.className = 'history-time';
        const reasonLabel = it.reason === 'completed' || it.done ? '已完成' : '已删除';
        time.textContent = `${reasonLabel} · ${formatTime(it.archivedAt || it.createdAt)}`;
        body.append(text, time);
        
        leftContent.append(status, body);

        // 右侧按钮区域
        const rightContent = document.createElement('div');
        rightContent.className = 'history-item-right';

        const restore = document.createElement('button');
        restore.className = 'restore-btn';
        restore.textContent = '↻';
        restore.title = '恢复到备忘录';
        restore.addEventListener('click', () => restoreFromHistory(it.id));

        const del = document.createElement('button');
        del.className = 'del-btn history-del-btn';
        del.textContent = '⨉';
        del.title = '永久删除';
        del.addEventListener('click', () => deleteFromHistory(it.id));
        
        rightContent.append(restore, del);

        row.append(leftContent, rightContent);
        historyList.appendChild(row);
      });
    });

  historyCounter.textContent = `${items.length} 条记录`;
}

document.getElementById('history-back-btn').addEventListener('click', () => showView('memo'));
document.getElementById('history-close-btn').addEventListener('click', () => {
  showView('pet');
  setTimeout(() => playExitAnimation(), 300);
});
document.getElementById('clear-history-btn').addEventListener('click', clearHistory);

// ============================================================
// Init
// ============================================================
(async function init() {
  try {
    const data = await window.petAPI.loadData();
    if (data) {
      state.todos = Array.isArray(data.todos) ? data.todos : [];
      state.history = Array.isArray(data.history) ? data.history : [];
    }
  } catch (e) {
    console.error('load failed', e);
  }
  showView('pet');
  
  // 播放进场动画
  playEnterAnimation();
})();
