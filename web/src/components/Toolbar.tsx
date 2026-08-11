export type Filter = 'all' | 'active' | 'done';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '진행 중' },
  { value: 'done', label: '완료' },
];

interface Props {
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
  remaining: number;
  total: number;
  doneCount: number;
  onToggleAll: () => void;
  onClearCompleted: () => void;
}

export function Toolbar({
  filter,
  onFilterChange,
  remaining,
  total,
  doneCount,
  onToggleAll,
  onClearCompleted,
}: Props) {
  const allDone = total > 0 && remaining === 0;

  return (
    <div className="toolbar">
      <div className="filters" role="group" aria-label="필터">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className="filter"
            aria-pressed={filter === f.value}
            onClick={() => onFilterChange(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="toolbar-right">
        <span className="count" aria-live="polite">
          {total > 0 ? `${remaining}개 남음` : ''}
        </span>
        <button className="ghost-btn" type="button" onClick={onToggleAll} disabled={total === 0}>
          {allDone ? '모두 해제' : '모두 완료'}
        </button>
        <button
          className="ghost-btn danger"
          type="button"
          onClick={onClearCompleted}
          disabled={doneCount === 0}
        >
          완료 삭제
        </button>
      </div>
    </div>
  );
}
