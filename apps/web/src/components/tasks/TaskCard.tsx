import { useEffect, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MessageSquare, Paperclip } from 'lucide-react'
import type { Task, TaskPerson } from '@/lib/task-columns'
import { UserAvatar } from '@/components/UserAvatar'

function assigneeLabel(people: TaskPerson[]) {
  if (!people.length) return 'не назначен'
  if (people.length <= 2) return people.map((person) => person.name).join(', ')
  return `${people[0].name} и ещё ${people.length - 1}`
}

function TaskCardBody({ task }: { task: Task }) {
  const assignees = task.assignees ?? []
  const shared = task.board === 'ORGANIZATION'
  const showMeta = shared || (task.commentCount ?? 0) > 0 || (task.fileCount ?? 0) > 0
  return (
    <>
      <h3 className="text-sm font-medium leading-5 text-foreground">{task.title}</h3>
      {task.description ? (
        <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-secondary">{task.description}</p>
      ) : null}
      {showMeta ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-2">
          {shared ? (
            <>
              <div className="flex items-center gap-2">
                <UserAvatar
                  id={task.createdBy.id}
                  name={task.createdBy.name}
                  hasAvatar={task.createdBy.hasAvatar}
                  version={task.createdBy.avatarAt}
                  size={24}
                />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Автор</p>
                  <p className="truncate text-[12px] leading-4 text-foreground">{task.createdBy.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {assignees.length ? (
                  <span className="flex shrink-0 -space-x-1.5">
                    {assignees.slice(0, 3).map((person) => (
                      <span key={person.id} className="rounded-full ring-2 ring-white">
                        <UserAvatar
                          id={person.id}
                          name={person.name}
                          hasAvatar={person.hasAvatar}
                          version={person.avatarAt}
                          size={24}
                        />
                      </span>
                    ))}
                  </span>
                ) : (
                  <span
                    aria-hidden
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-400"
                  >
                    —
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Ответственные</p>
                  <p className="truncate text-[12px] leading-4 text-foreground">{assigneeLabel(assignees)}</p>
                </div>
              </div>
            </>
          ) : null}
          <div className="flex items-center gap-3 text-[11px] text-secondary">
            <span className="inline-flex items-center gap-1">
              <MessageSquare size={12} strokeWidth={2} />
              {task.commentCount ?? 0}
            </span>
            <span className="inline-flex items-center gap-1">
              <Paperclip size={12} strokeWidth={2} />
              {task.fileCount ?? 0}
            </span>
          </div>
        </div>
      ) : null}
    </>
  )
}

export function TaskCardPreview({ task }: { task: Task }) {
  return (
    <article className="glass-chip w-[276px] cursor-grabbing rounded-xl p-3 shadow-lg ring-1 ring-accent/30">
      <TaskCardBody task={task} />
    </article>
  )
}

export function TaskCard({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  const skipClick = useRef(false)

  useEffect(() => {
    if (isDragging) skipClick.current = true
  }, [isDragging])

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? undefined : transition,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      className={`glass-chip min-w-0 shrink-0 cursor-grab overflow-hidden rounded-xl p-3 touch-none active:cursor-grabbing ${
        isDragging ? 'opacity-0' : ''
      }`}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (skipClick.current) {
          skipClick.current = false
          return
        }
        onOpen(task)
      }}
    >
      <TaskCardBody task={task} />
    </article>
  )
}
