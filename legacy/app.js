// Todo — 의존성 없는 단일 페이지 앱. 상태는 localStorage에 저장된다.
'use strict';

const STORAGE_KEY = 'todo2.state.v1';
const THEME_KEY = 'todo2.theme';

/** @typedef {{ id: string, title: string, done: boolean, createdAt: number }} Todo */

const state = {
  /** @type {Todo[]} */
  todos: [],
  /** @type {'all' | 'active' | 'done'} */
  filter: 'all',
  /** @type {string | null} 편집 중인 항목 id */
  editingId: null,
  /** @type {string | null} 렌더 후 포커스를 되돌릴 항목 id */
  focusId: null,
};

const $ = (sel) => document.querySelector(sel);

const listEl = $('#list');
const emptyEl = $('#empty');
const countEl = $('#count');
const newForm = $('#new-form');
const newInput = $('#new-input');
const toggleAllBtn = $('#toggle-all');
const clearDoneBtn = $('#clear-done');
const toastEl = $('#toast');
const toastTextEl = $('#toast-text');
const toastActionEl = $('#toast-action');

// ---------------------------------------------------------------- 저장 / 복원

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.todos)) {
      state.todos = data.todos
        .filter((t) => t && typeof t.title === 'string')
        .map((t) => ({
          id: String(t.id || uid()),
          title: t.title,
          done: Boolean(t.done),
          createdAt: Number(t.createdAt) || Date.now(),
        }));
    }
    if (['all', 'active', 'done'].includes(data.filter)) state.filter = data.filter;
  } catch (err) {
    console.warn('저장된 데이터를 불러오지 못했습니다.', err);
  }
}

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ todos: state.todos, filter: state.filter })
    );
  } catch (err) {
    console.warn('저장에 실패했습니다.', err);
    showToast('저장에 실패했습니다 (저장 공간 확인)');
  }
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

// ---------------------------------------------------------------------- 렌더

function visibleTodos() {
  if (state.filter === 'active') return state.todos.filter((t) => !t.done);
  if (state.filter === 'done') return state.todos.filter((t) => t.done);
  return state.todos;
}

function render() {
  const items = visibleTodos();

  listEl.replaceChildren(...items.map(renderItem));

  const remaining = state.todos.filter((t) => !t.done).length;
  const doneCount = state.todos.length - remaining;
  countEl.textContent = state.todos.length ? `${remaining}개 남음` : '';

  toggleAllBtn.disabled = state.todos.length === 0;
  toggleAllBtn.textContent = remaining === 0 && state.todos.length ? '모두 해제' : '모두 완료';
  clearDoneBtn.disabled = doneCount === 0;

  document.querySelectorAll('.filter').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.filter === state.filter));
  });

  emptyEl.hidden = items.length > 0;
  if (items.length === 0) {
    emptyEl.textContent =
      state.todos.length === 0
        ? '아직 할 일이 없습니다. 위에 입력해서 추가해 보세요.'
        : state.filter === 'active'
          ? '진행 중인 할 일이 없습니다. 🎉'
          : '완료한 할 일이 없습니다.';
  }

  // 편집 입력창 / 키보드 이동 후 포커스 복원
  if (state.editingId) {
    const input = listEl.querySelector('.edit-input');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  } else if (state.focusId) {
    listEl.querySelector(`[data-id="${CSS.escape(state.focusId)}"]`)?.focus();
    state.focusId = null;
  }
}

/** @param {Todo} todo */
function renderItem(todo) {
  const li = document.createElement('li');
  li.className = 'item' + (todo.done ? ' done' : '');
  li.dataset.id = todo.id;
  li.tabIndex = 0;
  li.draggable = state.editingId !== todo.id;

  const grip = document.createElement('span');
  grip.className = 'grip';
  grip.textContent = '⠿';
  grip.setAttribute('aria-hidden', 'true');

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'check';
  check.checked = todo.done;
  check.dataset.action = 'toggle';
  check.setAttribute('aria-label', `${todo.title} 완료 표시`);

  li.append(grip, check);

  if (state.editingId === todo.id) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-input';
    input.value = todo.title;
    input.maxLength = 200;
    input.setAttribute('aria-label', '할 일 수정');
    li.append(input);
  } else {
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = todo.title;
    li.append(title);

    const actions = document.createElement('div');
    actions.className = 'item-actions';
    actions.append(
      miniBtn('✎', 'edit', '수정'),
      miniBtn('✕', 'remove', '삭제')
    );
    li.append(actions);
  }

  return li;
}

function miniBtn(glyph, action, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `mini-btn ${action}`;
  btn.dataset.action = action;
  btn.textContent = glyph;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  return btn;
}

// ------------------------------------------------------------------ 상태 변경

function addTodo(title) {
  const text = title.trim();
  if (!text) return;
  state.todos.unshift({ id: uid(), title: text, done: false, createdAt: Date.now() });
  if (state.filter === 'done') state.filter = 'all'; // 방금 추가한 항목이 보이도록
  save();
  render();
}

function toggle(id) {
  const todo = state.todos.find((t) => t.id === id);
  if (!todo) return;
  todo.done = !todo.done;
  save();
  render();
}

function remove(id) {
  const index = state.todos.findIndex((t) => t.id === id);
  if (index === -1) return;
  const [removed] = state.todos.splice(index, 1);
  save();
  render();
  showToast(`"${truncate(removed.title)}" 삭제됨`, '실행 취소', () => {
    state.todos.splice(Math.min(index, state.todos.length), 0, removed);
    save();
    render();
  });
}

function commitEdit(id, value) {
  const todo = state.todos.find((t) => t.id === id);
  state.editingId = null;
  if (todo) {
    const text = value.trim();
    if (text) todo.title = text;
    else return remove(id); // 내용을 비우면 삭제 (실행 취소 가능)
  }
  save();
  state.focusId = id;
  render();
}

/** 보이는 항목 기준으로 위/아래 이웃과 자리를 바꾼다. */
function move(id, direction) {
  const visible = visibleTodos();
  const vIndex = visible.findIndex((t) => t.id === id);
  const neighbor = visible[vIndex + direction];
  if (!neighbor) return;

  const a = state.todos.indexOf(visible[vIndex]);
  const b = state.todos.indexOf(neighbor);
  [state.todos[a], state.todos[b]] = [state.todos[b], state.todos[a]];
  save();
  state.focusId = id;
  render();
}

/** 드래그 후 DOM 순서를 상태에 반영한다 (필터로 숨겨진 항목의 위치는 유지). */
function applyDomOrder() {
  const domIds = [...listEl.querySelectorAll('.item')].map((li) => li.dataset.id);
  const domIdSet = new Set(domIds);
  const slots = [];
  state.todos.forEach((t, i) => {
    if (domIdSet.has(t.id)) slots.push(i);
  });
  if (slots.length !== domIds.length) return;

  const byId = new Map(state.todos.map((t) => [t.id, t]));
  slots.forEach((slot, k) => {
    state.todos[slot] = byId.get(domIds[k]);
  });
  save();
}

function truncate(text, max = 24) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// -------------------------------------------------------------------- 이벤트

newForm.addEventListener('submit', (e) => {
  e.preventDefault();
  addTodo(newInput.value);
  newInput.value = '';
  newInput.focus();
});

listEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  const li = e.target.closest('.item');
  if (!btn || !li) return;
  const { id } = li.dataset;

  if (btn.dataset.action === 'toggle') toggle(id);
  if (btn.dataset.action === 'remove') remove(id);
  if (btn.dataset.action === 'edit') {
    state.editingId = id;
    render();
  }
});

listEl.addEventListener('dblclick', (e) => {
  const title = e.target.closest('.title');
  if (!title) return;
  state.editingId = e.target.closest('.item').dataset.id;
  render();
});

listEl.addEventListener('keydown', (e) => {
  const li = e.target.closest('.item');
  if (!li) return;
  const { id } = li.dataset;

  if (e.target.classList.contains('edit-input')) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit(id, e.target.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      state.editingId = null;
      state.focusId = id;
      render();
    }
    return;
  }

  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    move(id, e.key === 'ArrowUp' ? -1 : 1);
  } else if (e.key === 'Enter' && e.target === li) {
    e.preventDefault();
    state.editingId = id;
    render();
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && e.target === li) {
    e.preventDefault();
    remove(id);
  }
});

listEl.addEventListener(
  'blur',
  (e) => {
    if (e.target.classList.contains('edit-input') && state.editingId) {
      commitEdit(state.editingId, e.target.value);
    }
  },
  true
);

// 드래그 정렬
listEl.addEventListener('dragstart', (e) => {
  const li = e.target.closest('.item');
  if (!li) return;
  li.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', li.dataset.id);
});

listEl.addEventListener('dragover', (e) => {
  const dragging = listEl.querySelector('.dragging');
  if (!dragging) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const after = [...listEl.querySelectorAll('.item:not(.dragging)')].find((li) => {
    const box = li.getBoundingClientRect();
    return e.clientY < box.top + box.height / 2;
  });
  if (after) listEl.insertBefore(dragging, after);
  else listEl.appendChild(dragging);
});

listEl.addEventListener('drop', (e) => e.preventDefault());

listEl.addEventListener('dragend', (e) => {
  e.target.closest('.item')?.classList.remove('dragging');
  applyDomOrder();
  render();
});

document.querySelectorAll('.filter').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.filter = btn.dataset.filter;
    state.editingId = null;
    save();
    render();
  });
});

toggleAllBtn.addEventListener('click', () => {
  const target = state.todos.some((t) => !t.done);
  state.todos.forEach((t) => {
    t.done = target;
  });
  save();
  render();
});

clearDoneBtn.addEventListener('click', () => {
  const removed = state.todos.filter((t) => t.done);
  if (!removed.length) return;
  const snapshot = [...state.todos];
  state.todos = state.todos.filter((t) => !t.done);
  save();
  render();
  showToast(`${removed.length}개 삭제됨`, '실행 취소', () => {
    state.todos = snapshot;
    save();
    render();
  });
});

// 다른 탭에서 변경된 내용 반영
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return;
  state.editingId = null;
  load();
  render();
});

// ---------------------------------------------------------------------- 토스트

let toastTimer;

function showToast(message, actionLabel, onAction) {
  clearTimeout(toastTimer);
  toastTextEl.textContent = message;
  toastEl.hidden = false;

  if (actionLabel && onAction) {
    toastActionEl.hidden = false;
    toastActionEl.textContent = actionLabel;
    toastActionEl.onclick = () => {
      hideToast();
      onAction();
    };
  } else {
    toastActionEl.hidden = true;
    toastActionEl.onclick = null;
  }

  toastTimer = setTimeout(hideToast, 6000);
}

function hideToast() {
  clearTimeout(toastTimer);
  toastEl.hidden = true;
  toastActionEl.onclick = null;
}

// ------------------------------------------------------------------------ 테마

const themeToggle = $('#theme-toggle');
const themeIcon = $('#theme-icon');

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
  const dark =
    theme === 'dark' ||
    (!theme && matchMedia('(prefers-color-scheme: dark)').matches);
  themeIcon.textContent = dark ? '☀️' : '🌙';
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.dataset.theme;
  const isDark =
    current === 'dark' ||
    (!current && matchMedia('(prefers-color-scheme: dark)').matches);
  const next = isDark ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

// ------------------------------------------------------------------------ 시작

applyTheme(localStorage.getItem(THEME_KEY));
load();
render();
newInput.focus();
