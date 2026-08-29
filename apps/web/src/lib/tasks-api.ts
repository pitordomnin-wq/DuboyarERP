import { request } from '@/lib/api'
import type { Task, TaskBoard, TaskPerson, TaskStatus } from '@/lib/task-columns'

export const TASK_FILE_ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.zip,.doc,.docx,.xls,.xlsx,application/pdf,image/jpeg,image/png,image/gif,image/webp,text/plain,text/csv,application/zip'

export function fetchTasks(board: TaskBoard) {
  const query = board === 'ORGANIZATION' ? 'organization' : 'personal'
  return request<Task[]>(`/v1/tasks?board=${query}`)
}

export function fetchTask(id: string) {
  return request<Task>(`/v1/tasks/${id}`)
}

export function fetchColleagues() {
  return request<TaskPerson[]>('/v1/tasks/colleagues')
}

export function createTask(input: {
  board: TaskBoard
  title: string
  description?: string
  assigneeIds?: string[]
}) {
  return request<Task>('/v1/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateTask(
  id: string,
  input: {
    title?: string
    description?: string
    status?: TaskStatus
    position?: number
  },
) {
  return request<Task>(`/v1/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function advanceTask(id: string) {
  return request<Task>(`/v1/tasks/${id}/advance`, { method: 'POST' })
}

export function deleteTask(id: string) {
  return request<void>(`/v1/tasks/${id}`, { method: 'DELETE' })
}

export function taskFileUrl(taskId: string, fileId: string) {
  return `/v1/tasks/${taskId}/files/${fileId}/file`
}

export async function uploadTaskFiles(taskId: string, files: File[]) {
  return postFiles(`/v1/tasks/${taskId}/files`, files)
}

export async function addTaskComment(taskId: string, body: string, files: File[]) {
  const data = new FormData()
  data.append('body', body)
  for (const file of files) data.append('files', file)
  return postForm<Task>(`/v1/tasks/${taskId}/comments`, data)
}

export function deleteTaskFile(taskId: string, fileId: string) {
  return request<Task>(`/v1/tasks/${taskId}/files/${fileId}`, { method: 'DELETE' })
}

export function fileErrorMessage(code: string) {
  if (code === 'file_too_large') return 'Файл больше 10 МБ'
  if (code === 'too_many_files') return 'Не больше 10 файлов'
  if (code === 'file_type') return 'Этот тип файла нельзя приложить'
  if (code === 'cannot_delete') return 'Недостаточно прав'
  return 'Не удалось загрузить файл'
}

async function postFiles(path: string, files: File[]) {
  const data = new FormData()
  for (const file of files) data.append('files', file)
  return postForm<Task>(path, data)
}

async function postForm<T>(path: string, data: FormData): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    body: data,
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string
      message?: string | { error?: string }
    }
    const code = typeof payload.message === 'object' ? payload.message?.error : payload.error
    throw new Error(code ?? 'request_failed')
  }
  return (await res.json()) as T
}
