import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { Todo } from '../../shared/types.ts';

// DB를 열기 전에 인메모리 모드로 고정한다.
process.env.DB_PATH = ':memory:';

const { createApp } = await import('../src/app.ts');
const { db } = await import('../src/db.ts');

let server: Server;
let base: string;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (typeof address === 'string' || address === null) throw new Error('no port');
  base = `http://127.0.0.1:${address.port}`;
});

after(() => {
  server.close();
});

beforeEach(() => {
  db.exec('DELETE FROM todos');
});

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const add = async (title: string): Promise<Todo> => (await api('POST', '/todos', { title })).body;
const listTitles = async (): Promise<string[]> =>
  (await api('GET', '/todos')).body.map((t: Todo) => t.title);

test('빈 목록으로 시작한다', async () => {
  const res = await api('GET', '/todos');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('새 항목은 맨 위에 추가된다', async () => {
  await add('우유 사기');
  const second = await add('보고서 쓰기');

  assert.equal(second.done, false);
  assert.match(second.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(await listTitles(), ['보고서 쓰기', '우유 사기']);
});

test('제목을 검증한다', async () => {
  assert.equal((await api('POST', '/todos', { title: '   ' })).status, 400);
  assert.equal((await api('POST', '/todos', { title: 42 })).status, 400);
  assert.equal((await api('POST', '/todos', {})).status, 400);
  assert.equal((await api('POST', '/todos', { title: 'a'.repeat(201) })).status, 400);
  assert.equal((await api('POST', '/todos', { title: ' 공백 정리 ' })).body.title, '공백 정리');
});

test('완료 토글과 제목 수정', async () => {
  const todo = await add('산책');

  const toggled = await api('PATCH', `/todos/${todo.id}`, { done: true });
  assert.equal(toggled.body.done, true);

  const renamed = await api('PATCH', `/todos/${todo.id}`, { title: '저녁 산책' });
  assert.equal(renamed.body.title, '저녁 산책');
  assert.equal(renamed.body.done, true, '수정해도 완료 상태는 유지된다');

  assert.equal((await api('PATCH', `/todos/${todo.id}`, {})).status, 400);
  assert.equal((await api('PATCH', `/todos/${todo.id}`, { done: 'yes' })).status, 400);
  assert.equal((await api('PATCH', '/todos/없는id', { done: true })).status, 404);
});

test('삭제 후 실행 취소하면 원래 자리로 돌아온다', async () => {
  await add('첫째');
  const middle = await add('둘째');
  await add('셋째');
  assert.deepEqual(await listTitles(), ['셋째', '둘째', '첫째']);

  const deleted = await api('DELETE', `/todos/${middle.id}`);
  assert.equal(deleted.status, 200);
  assert.deepEqual(await listTitles(), ['셋째', '첫째']);
  assert.equal((await api('DELETE', `/todos/${middle.id}`)).status, 404);

  const restored = await api('POST', '/todos/restore', { todos: [deleted.body] });
  assert.equal(restored.body.restored.length, 1);
  assert.deepEqual(await listTitles(), ['셋째', '둘째', '첫째']);
});

test('이미 존재하는 항목은 되살리지 않는다', async () => {
  const todo = await add('하나');
  const res = await api('POST', '/todos/restore', { todos: [todo] });
  assert.deepEqual(res.body.restored, []);
  assert.equal((await api('GET', '/todos')).body.length, 1);
  assert.equal((await api('POST', '/todos/restore', { todos: [{ id: 'x' }] })).status, 400);
});

test('순서를 바꿀 수 있다', async () => {
  const a = await add('A');
  const b = await add('B');
  const c = await add('C');
  assert.deepEqual(await listTitles(), ['C', 'B', 'A']);

  const res = await api('PUT', '/todos/order', { ids: [a.id, b.id, c.id] });
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.todos.map((t: Todo) => t.title),
    ['A', 'B', 'C']
  );
  assert.deepEqual(await listTitles(), ['A', 'B', 'C'], '순서가 저장된다');

  assert.equal((await api('PUT', '/todos/order', { ids: 'nope' })).status, 400);
});

test('일부만 보내면 나머지 항목의 자리는 유지된다', async () => {
  const a = await add('A'); // 목록: C, B, A
  const b = await add('B');
  await add('C');

  // 필터로 B가 숨겨진 상태에서 C와 A의 순서만 뒤집는 상황
  await api('PUT', '/todos/order', { ids: [a.id] });
  const titles = await listTitles();
  assert.equal(titles.length, 3);
  assert.ok(titles.includes('B'));

  await api('PUT', '/todos/order', { ids: [b.id, 'ghost'] });
  assert.equal((await api('GET', '/todos')).body.length, 3, '없는 id는 무시한다');
});

test('모두 완료 / 해제', async () => {
  await add('A');
  await add('B');

  let res = await api('POST', '/todos/toggle-all', { done: true });
  assert.ok(res.body.todos.every((t: Todo) => t.done));

  res = await api('POST', '/todos/toggle-all', { done: false });
  assert.ok(res.body.todos.every((t: Todo) => !t.done));

  assert.equal((await api('POST', '/todos/toggle-all', {})).status, 400);
});

test('완료 항목 일괄 삭제와 실행 취소', async () => {
  const a = await add('A');
  await add('B');
  const c = await add('C');
  await api('PATCH', `/todos/${a.id}`, { done: true });
  await api('PATCH', `/todos/${c.id}`, { done: true });

  const cleared = await api('POST', '/todos/clear-completed');
  assert.equal(cleared.body.removed.length, 2);
  assert.deepEqual(await listTitles(), ['B']);

  await api('POST', '/todos/restore', { todos: cleared.body.removed });
  assert.deepEqual(await listTitles(), ['C', 'B', 'A'], '순서까지 복원된다');
});

test('알 수 없는 API 경로는 404 JSON을 준다', async () => {
  const res = await api('GET', '/nope');
  assert.equal(res.status, 404);
  assert.equal(typeof res.body.error, 'string');
});

test('잘못된 JSON은 400을 준다', async () => {
  const res = await fetch(`${base}/api/todos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{broken',
  });
  assert.equal(res.status, 400);
});
