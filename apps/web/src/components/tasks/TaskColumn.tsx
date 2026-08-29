import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task, TaskStatus } from '@/lib/task-columns'
import { STATUS_LABEL } from '@/lib/task-columns'
import { TaskCard } from '@/components/tasks/TaskCard'

export function TaskColumn({
  status,
  tasks,
  onOpen,
}: {
  status: TaskStatus
  tasks: Task[]
  onOpen: (task: Task) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <section className="flex h-full w-[300px] shrink-0 flex-col rounded-lg border-2 border-slate-300 bg-slate-100">
      <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b-2 border-slate-300 px-3">
        <h2 className="truncate text-sm font-semibold text-foreground">{STATUS_LABEL[status]}</h2>
        <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-xs tabular-nums text-secondary">
          {tasks.length}
        </span>
      </header>
      <div
        ref={setNodeRef}
        className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2 transition-colors duration-150 ${
          isOver ? 'bg-slate-200' : ''
        }`}
      >
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={onOpen} />
          ))}
        </SortableContext>
        {tasks.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-slate-500">Пусто</p>
        ) : null}
      </div>
    </section>
  )
}
