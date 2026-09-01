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
    <section className="glass-well flex h-full w-[300px] min-w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl">
      <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-white/55 px-3">
        <h2 className="truncate text-sm font-semibold text-foreground">{STATUS_LABEL[status]}</h2>
        <span className="glass-chip shrink-0 rounded-full px-1.5 py-0.5 text-xs tabular-nums text-secondary">
          {tasks.length}
        </span>
      </header>
      <div
        ref={setNodeRef}
        className={`flex min-h-0 min-w-0 flex-1 touch-pan-y flex-col gap-2 overflow-x-hidden overflow-y-auto overscroll-y-contain p-2 transition-colors duration-150 ${
          isOver ? 'bg-white/40' : ''
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
