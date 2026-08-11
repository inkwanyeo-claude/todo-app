# 할 일 (Todo)

React + Vite 프론트엔드와 Express + SQLite API 서버로 이루어진 Todo 앱.
데이터는 서버의 SQLite 파일에 저장되므로 브라우저·기기를 옮겨도 그대로 남습니다.

## 빠른 시작

```bash
npm install       # 워크스페이스 전체 설치
npm run dev       # API(:3000) + Vite(:5173) 동시 실행 → http://localhost:5173
```

배포처럼 한 프로세스로 띄우려면:

```bash
npm run build     # web/dist 생성
npm start         # http://localhost:3000 에서 API와 화면을 함께 서빙
```

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 2개 동시 실행 (Vite가 `/api`를 API 서버로 프록시) |
| `npm run build` | React 앱 프로덕션 빌드 |
| `npm start` | API 서버 실행 (`web/dist`가 있으면 함께 서빙) |
| `npm test` | 서버 API 테스트 (`node:test`) |
| `npm run typecheck` | 서버·웹 타입 검사 |

환경 변수: `PORT`(기본 3000), `DB_PATH`(기본 `server/data/todos.db`, `:memory:` 지원),
`API_URL`(Vite 프록시 대상, 기본 `http://localhost:3000`).

## 기술 스택

**Node.js 24 이상이 필요합니다** (개발·검증 환경: Node 24.19.0, npm 11.17.0).
서버가 Node의 내장 TypeScript 실행과 `node:sqlite`에 의존하기 때문입니다.

| 영역 | 사용 기술 | 버전 |
| --- | --- | --- |
| 런타임 | Node.js | 24.19 |
| 프론트엔드 | React (`react-dom/client`, StrictMode) | 19.2 |
| 빌드·개발 서버 | Vite + `@vitejs/plugin-react` | 6.4 / 4.7 |
| 서버 | Express | 5.2 |
| 데이터베이스 | SQLite (Node 내장 `node:sqlite`, WAL 모드) | — |
| 언어 | TypeScript (`strict`) | 5.9 |
| 테스트 | `node:test` + `node:assert/strict` | 내장 |
| 패키지 관리 | npm workspaces (`server`, `web`) | npm 11 |
| 스타일 | 순수 CSS (커스텀 프로퍼티 기반 테마) | — |

### 선택 이유

- **`node:sqlite`** — Node 24에 내장된 동기식 SQLite API. 네이티브 빌드가 필요한
  드라이버(`better-sqlite3`)나 별도 DB 서버 없이 파일 하나로 영속화합니다. 동기
  API라 라우트 핸들러에 `async`가 없고, 순서 변경은 트랜잭션으로 묶습니다.
- **Node의 TypeScript 직접 실행** — 서버는 `node src/index.ts`로 그대로 돌아갑니다.
  트랜스파일·번들 단계가 없어 `tsc`는 타입 검사(`--noEmit`) 용도로만 씁니다.
  대신 타입 지우기만 가능한 문법으로 제한되므로(`erasableSyntaxOnly`) `enum`이나
  생성자 파라미터 프로퍼티는 쓰지 않습니다.
- **`shared/types.ts`** — API 계약을 한 곳에 두고 서버와 클라이언트가 같은 타입을
  import 합니다. 응답 형태가 바뀌면 양쪽에서 동시에 타입 오류가 납니다.
- **Express 5** — 핸들러에서 던진 오류가 자동으로 에러 미들웨어로 전달되어
  래퍼가 필요 없습니다. `express.json()` 외에는 미들웨어를 쓰지 않습니다.
- **상태 관리 라이브러리 없음** — 서버가 진실의 원천이고 클라이언트 상태는 목록
  하나뿐이라, 커스텀 훅([useTodos.ts](web/src/useTodos.ts))에서 낙관적 업데이트와
  롤백만 다룹니다. Redux·Zustand·React Query를 넣을 만한 복잡도가 아닙니다.
- **드래그 앤 드롭 라이브러리 없음** — HTML5 Drag and Drop 이벤트를 직접 씁니다.
  키보드(<kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd>)로도 같은 동작을 할 수 있어
  접근성을 잃지 않습니다.
- **CSS 프레임워크 없음** — 커스텀 프로퍼티로 라이트/다크 팔레트를 정의하고
  `prefers-color-scheme`과 `[data-theme]`으로 전환합니다.

결과적으로 서버의 런타임 의존성은 **Express 하나**, 프론트엔드는 **React/React DOM**
뿐이며 나머지는 모두 개발 의존성입니다.

## 구조

```
├── web/          React 19 + Vite + TypeScript
│   └── src/      App.tsx · useTodos.ts(상태·낙관적 업데이트) · api.ts · components/
├── server/       Express 5 + node:sqlite (TypeScript를 Node가 직접 실행)
│   └── src/      app.ts(라우팅·검증) · todos.ts(저장소) · db.ts(스키마)
├── shared/       클라이언트·서버가 공유하는 API 타입
└── legacy/       처음 만든 무의존성 바닐라 JS 버전 (index.html을 열면 그대로 동작)
```

빌드 도구가 필요한 곳은 프론트엔드뿐입니다. 서버는 Node 24의 TypeScript 실행과
내장 `node:sqlite`를 쓰기 때문에 트랜스파일 단계도, DB 드라이버 의존성도 없습니다.

## 기능

- 추가 / 완료 토글 / 수정 / 삭제, 필터(전체·진행 중·완료)와 남은 개수
- 모두 완료(해제), 완료 항목 일괄 삭제 — 둘 다 **실행 취소** 가능 (순서까지 복원)
- 드래그 또는 <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd>로 순서 변경, 서버에 저장
- 다크/라이트 테마 (시스템 설정 자동 감지 + 수동 전환)
- 모든 변경은 화면에 먼저 반영하고(낙관적 업데이트) 요청이 실패하면 되돌린 뒤 알림
- 창을 다시 볼 때 서버 상태와 자동 동기화 → 여러 탭·기기에서 같은 목록

## 키보드

| 키 | 동작 |
| --- | --- |
| <kbd>Enter</kbd> (입력창) | 할 일 추가 |
| 더블클릭 / <kbd>Enter</kbd> (항목 선택 시) | 수정 시작 |
| <kbd>Enter</kbd> (수정 중) | 저장 — 내용을 비우면 삭제 |
| <kbd>Esc</kbd> (수정 중) | 취소 |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | 선택한 항목 삭제 |
| <kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>↓</kbd> | 순서 이동 |

## API

모든 응답은 JSON이고, 실패하면 `{ "error": "..." }` 형태입니다.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `GET` | `/api/todos` | 전체 목록 (정렬된 순서) |
| `POST` | `/api/todos` | `{ title }` → 새 항목을 맨 위에 추가 |
| `PATCH` | `/api/todos/:id` | `{ title?, done? }` |
| `DELETE` | `/api/todos/:id` | 삭제된 항목을 그대로 반환 (실행 취소용) |
| `POST` | `/api/todos/restore` | `{ todos }` → id·순서까지 되살림 |
| `PUT` | `/api/todos/order` | `{ ids }` → 보낸 순서대로 재정렬 |
| `POST` | `/api/todos/toggle-all` | `{ done }` |
| `POST` | `/api/todos/clear-completed` | 완료 항목 삭제 후 삭제된 목록 반환 |
| `GET` | `/api/health` | 헬스 체크 |

`PUT /api/todos/order`는 보낸 id들이 원래 차지하던 자리에만 다시 배치하므로,
필터로 일부만 보이는 상태에서 정렬해도 숨겨진 항목의 위치가 흐트러지지 않습니다.

제목은 앞뒤 공백을 제거한 뒤 1~200자여야 하며, 위반 시 `400`을 돌려줍니다.

## 테스트

`npm test`는 인메모리 SQLite로 실제 HTTP 서버를 띄워 CRUD·검증·정렬·실행 취소
동작을 확인합니다 (12개). 프론트엔드는 `npm run typecheck`로 타입을 검증합니다.
