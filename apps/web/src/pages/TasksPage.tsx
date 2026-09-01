import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { TaskCardPreview } from '@/components/tasks/TaskCard'
import { TaskColumn } from '@/components/tasks/TaskColumn'
import { TaskDetail } from '@/components/tasks/TaskDetail'
import { CreateTaskForm, Modal } from '@/components/tasks/TaskModal'
import { useAuth } from '@/lib/auth'
import {
  columnsFor,
  type Task,
  type TaskBoard,
  type TaskPerson,
  type TaskStatus,
} from '@/lib/task-columns'
import {
  advanceTask,
  createTask,
  deleteTask,
  fetchColleagues,
  fetchTask,
  fetchTasks,
  updateTask,
  uploadTaskFiles,
} from '@/lib/tasks-api'

function detectCollision(columnIds: Set<string>): CollisionDetection {
  return (args) => {
    const pointerHits = pointerWithin(args)
    const hits = pointerHits.length > 0 ? pointerHits : closestCorners(args)
    const overCard = hits.find((hit) => !columnIds.has(String(hit.id)))
    return overCard ? [overCard] : hits
  }
}

export function TasksPage() {
  const { user } = useAuth()
  const [board, setBoard] = useState<TaskBoard>('ORGANIZATION')
  const [tasks, setTasks] = useState<Task[]>([])
  const [people, setPeople] = useState<TaskPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [opened, setOpened] = useState<Task | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const columns = columnsFor(board)
  const columnIds = useMemo(() => new Set(columns.map(String)), [columns])
  const collisionDetection = useMemo(() => detectCollision(columnIds), [columnIds])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const dragSnapshot = useRef<Task[] | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const activeTask = activeId ? tasks.find((task) => task.id === activeId) : null

  const load = useCallback(async (nextBoard: TaskBoard) => {
    setLoading(true)
    try {
      setTasks(await fetchTasks(nextBoard))
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(board)
  }, [board, load])

  useEffect(() => {
    void fetchColleagues()
      .then(setPeople)
      .catch(() => setPeople([]))
  }, [])

  useEffect(() => {
    const el = boardRef.current
    if (!el) return

    function onWheel(event: WheelEvent) {
      const target = boardRef.current
      if (!target) return
      const dx = event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX
      const dy = event.shiftKey && event.deltaX === 0 ? 0 : event.deltaY
      if (Math.abs(dx) <= Math.abs(dy)) return
      event.preventDefault()
      target.scrollLeft += dx
    }

    el.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => el.removeEventListener('wheel', onWheel, { capture: true })
  }, [])

  function applyTask(updated: Task) {
    setTasks((current) => current.map((task) => (task.id === updated.id ? { ...task, ...updated } : task)))
    setOpened((current) => (current?.id === updated.id ? { ...current, ...updated } : current))
  }

  async function openTask(task: Task) {
    setOpened(task)
    try {
      setOpened(await fetchTask(task.id))
    } catch {
      // keep the card snapshot if the detail request fails
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>()
    for (const column of columns) map.set(column, [])
    for (const task of tasks) {
      if (task.board !== board) continue
      map.get(task.status)?.push(task)
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position)
    return map
  }, [columns, tasks])

  async function handleCreate(input: {
    title: string
    description: string
    assigneeIds: string[]
    files: File[]
  }) {
    setBusy(true)
    try {
      let task = await createTask({
        board,
        title: input.title,
        description: input.description || undefined,
        assigneeIds: input.assigneeIds,
      })
      if (input.files.length) {
        try {
          task = await uploadTaskFiles(task.id, input.files)
        } catch {
          setTasks((current) => [...current, task])
          setCreating(false)
          setOpened(await fetchTask(task.id).catch(() => task))
          return
        }
      }
      setTasks((current) => [...current, task])
      setCreating(false)
    } catch {
      // create failed
    } finally {
      setBusy(false)
    }
  }

  async function handleAdvance() {
    if (!opened) return
    const updated = await advanceTask(opened.id)
    applyTask(updated)
    setOpened(null)
  }

  async function handleDelete() {
    if (!opened) return
    await deleteTask(opened.id)
    setTasks((current) => current.filter((task) => task.id !== opened.id))
    setOpened(null)
  }

  function statusFromOver(overId: string, list: Task[]) {
    const overTask = list.find((task) => task.id === overId)
    if (overTask) return overTask.status
    return columns.includes(overId as TaskStatus) ? (overId as TaskStatus) : null
  }

  function placeTask(list: Task[], moving: Task, overId: string, newStatus: TaskStatus) {
    const overTask = list.find((task) => task.id === overId)
    const columnTasks = list
      .filter((task) => task.status === newStatus && task.id !== moving.id)
      .sort((a, b) => a.position - b.position)
    let insertAt = columnTasks.length
    if (overTask && overTask.status === newStatus) {
      insertAt = columnTasks.findIndex((task) => task.id === overTask.id)
      if (insertAt < 0) insertAt = columnTasks.length
    }
    const prev = columnTasks[insertAt - 1]
    const next = columnTasks[insertAt]
    const position =
      prev && next ? (prev.position + next.position) / 2 : next ? next.position - 1000 : (prev?.position ?? 0) + 1000
    return { ...moving, status: newStatus, position }
  }

  function handleDragStart(event: DragStartEvent) {
    dragSnapshot.current = tasks
    setActiveId(String(event.active.id))
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const overId = String(over.id)
    setTasks((current) => {
      const moving = current.find((task) => task.id === active.id)
      if (!moving) return current
      const newStatus = statusFromOver(overId, current)
      if (!newStatus || moving.status === newStatus) return current
      const next = placeTask(current, moving, overId, newStatus)
      return current.map((task) => (task.id === moving.id ? next : task))
    })
  }

  function handleDragCancel() {
    if (dragSnapshot.current) setTasks(dragSnapshot.current)
    dragSnapshot.current = null
    setActiveId(null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) {
      handleDragCancel()
      return
    }

    const moving = tasks.find((task) => task.id === active.id)
    if (!moving) return

    const overId = String(over.id)
    const newStatus = statusFromOver(overId, tasks)
    if (!newStatus) {
      handleDragCancel()
      return
    }

    const optimistic = placeTask(tasks, moving, overId, newStatus)
    dragSnapshot.current = null
    setTasks((current) => current.map((task) => (task.id === moving.id ? optimistic : task)))
    if (opened?.id === moving.id) {
      setOpened((current) => (current ? { ...current, ...optimistic } : current))
    }

    try {
      const saved = await updateTask(moving.id, { status: optimistic.status, position: optimistic.position })
      applyTask(saved)
    } catch {
      void load(board)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4 px-4 pt-5 pb-4 md:px-8">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Задачи</h1>
          <div className="mt-3 flex gap-5" role="tablist" aria-label="Доски">
            <BoardTab
              selected={board === 'ORGANIZATION'}
              onClick={() => {
                setOpened(null)
                setLoading(true)
                setTasks([])
                setBoard('ORGANIZATION')
              }}
            >
              Общие
            </BoardTab>
            <BoardTab
              selected={board === 'PERSONAL'}
              onClick={() => {
                setOpened(null)
                setLoading(true)
                setTasks([])
                setBoard('PERSONAL')
              }}
            >
              Личные
            </BoardTab>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary transition-opacity duration-200 hover:opacity-90"
        >
          Новая задача
        </button>
      </div>

      <div
        ref={boardRef}
        className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden px-4 pb-6 md:px-8"
      >
        {loading ? (
          <p className="text-sm text-secondary">Загрузка</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={(event) => void handleDragEnd(event)}
            onDragCancel={handleDragCancel}
          >
            <div className="flex h-full min-h-0 items-stretch gap-3">
              {columns.map((status) => (
                <TaskColumn
                  key={status}
                  status={status}
                  tasks={grouped.get(status) ?? []}
                  onOpen={openTask}
                />
              ))}
            </div>
            <DragOverlay dropAnimation={null}>
              {activeTask ? <TaskCardPreview task={activeTask} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {creating ? (
        <Modal title="Новая задача" onClose={() => setCreating(false)} wide>
          <p className="mt-1 text-sm text-secondary">
            {board === 'PERSONAL' ? 'Видна только вам' : 'Видна всей организации'}
          </p>
          <CreateTaskForm
            people={people}
            shared={board === 'ORGANIZATION'}
            busy={busy}
            onCancel={() => setCreating(false)}
            onSubmit={(input) => void handleCreate(input)}
          />
        </Modal>
      ) : null}

      {opened && user ? (
        <Modal title={opened.title} onClose={() => setOpened(null)} wide>
          <TaskDetail
            task={opened}
            userId={user.id}
            onChange={applyTask}
            onClose={() => setOpened(null)}
            onAdvance={() => void handleAdvance()}
            onDelete={() => void handleDelete()}
          />
        </Modal>
      ) : null}
    </div>
  )
}

function BoardTab({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`tab-item pb-1.5 pt-0 ${selected ? 'tab-item-active' : ''}`}
    >
      {children}
    </button>
  )
}
