import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as todos from './todos.ts';
import { MAX_TITLE_LENGTH } from '../../shared/types.ts';
import type { Todo } from '../../shared/types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.join(here, '..', '..', 'web', 'dist');

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  const api = express.Router();

  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  api.get('/todos', (_req, res) => {
    res.json(todos.list());
  });

  api.post('/todos', (req, res) => {
    const title = parseTitle(req.body?.title);
    if (title === null) return badRequest(res, '제목은 1~200자의 문자열이어야 합니다.');
    res.status(201).json(todos.create(title));
  });

  // 실행 취소: 삭제된 항목을 id와 순서까지 그대로 되살린다.
  api.post('/todos/restore', (req, res) => {
    const list: unknown = req.body?.todos;
    if (!Array.isArray(list)) return badRequest(res, 'todos 배열이 필요합니다.');

    const parsed: Todo[] = [];
    for (const item of list) {
      const todo = parseTodo(item);
      if (!todo) return badRequest(res, '되살릴 항목의 형식이 올바르지 않습니다.');
      parsed.push(todo);
    }
    res.json({ restored: todos.restore(parsed) });
  });

  api.put('/todos/order', (req, res) => {
    const ids: unknown = req.body?.ids;
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
      return badRequest(res, 'ids는 문자열 배열이어야 합니다.');
    }
    res.json({ todos: todos.reorder(ids as string[]) });
  });

  api.post('/todos/toggle-all', (req, res) => {
    const done: unknown = req.body?.done;
    if (typeof done !== 'boolean') return badRequest(res, 'done은 boolean이어야 합니다.');
    res.json({ todos: todos.toggleAll(done) });
  });

  api.post('/todos/clear-completed', (_req, res) => {
    res.json({ removed: todos.clearCompleted() });
  });

  api.patch('/todos/:id', (req, res) => {
    const patch: { title?: string; done?: boolean } = {};

    if (req.body?.title !== undefined) {
      const title = parseTitle(req.body.title);
      if (title === null) return badRequest(res, '제목은 1~200자의 문자열이어야 합니다.');
      patch.title = title;
    }
    if (req.body?.done !== undefined) {
      if (typeof req.body.done !== 'boolean') return badRequest(res, 'done은 boolean이어야 합니다.');
      patch.done = req.body.done;
    }
    if (patch.title === undefined && patch.done === undefined) {
      return badRequest(res, '변경할 내용이 없습니다.');
    }

    const updated = todos.update(req.params.id, patch);
    if (!updated) return notFound(res);
    res.json(updated);
  });

  api.delete('/todos/:id', (req, res) => {
    const removed = todos.remove(req.params.id);
    if (!removed) return notFound(res);
    res.json(removed);
  });

  app.use('/api', api);
  app.use('/api', (_req, res) => notFound(res));

  // 빌드된 React 앱이 있으면 같은 서버에서 함께 서빙한다.
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // 잘못된 요청 본문(파싱 실패 등)은 정상적인 400이므로 로그를 남기지 않는다.
    const status = (err as { status?: number })?.status;
    if (err instanceof SyntaxError || status === 400) {
      return badRequest(res, '요청 본문을 읽을 수 없습니다.');
    }
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  });

  return app;
}

function parseTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const title = value.trim();
  if (!title || title.length > MAX_TITLE_LENGTH) return null;
  return title;
}

function parseTodo(value: unknown): Todo | null {
  if (typeof value !== 'object' || value === null) return null;
  const t = value as Record<string, unknown>;
  const title = parseTitle(t.title);
  if (typeof t.id !== 'string' || !t.id) return null;
  if (title === null) return null;
  if (typeof t.done !== 'boolean') return null;
  if (typeof t.position !== 'number' || !Number.isFinite(t.position)) return null;
  if (typeof t.createdAt !== 'number' || !Number.isFinite(t.createdAt)) return null;
  return { id: t.id, title, done: t.done, position: t.position, createdAt: t.createdAt };
}

function badRequest(res: express.Response, error: string) {
  res.status(400).json({ error });
}

function notFound(res: express.Response) {
  res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
}
