// 서버와 클라이언트가 공유하는 API 계약. 타입 전용이라 런타임에는 사라진다.

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  /** 정렬 순서. 값이 작을수록 위. */
  position: number;
  /** epoch ms */
  createdAt: number;
}

export const MAX_TITLE_LENGTH = 200;

export interface CreateTodoBody {
  title: string;
}

export interface UpdateTodoBody {
  title?: string;
  done?: boolean;
}

export interface ReorderBody {
  /** 화면에 보이는 순서대로의 id 목록. 목록에 없는 항목은 상대 위치를 유지한다. */
  ids: string[];
}

export interface ToggleAllBody {
  done: boolean;
}

export interface RestoreBody {
  todos: Todo[];
}

export interface ApiError {
  error: string;
}
