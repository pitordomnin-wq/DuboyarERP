export type TaskBoard = 'PERSONAL' | 'ORGANIZATION'
export type TaskStatus = 'NEW' | 'APPROVAL' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'

export type TaskPerson = {
  id: string
  name: string
  hasAvatar?: boolean
  avatarAt?: string | null
}

export type TaskFile = {
  id: string
  name: string
  mimeType: string
  size: number
  commentId: string | null
  createdAt: string
}

export type TaskComment = {
  id: string
  body: string
  createdAt: string
  author: TaskPerson
  files: TaskFile[]
}

export type Task = {
  id: string
  board: TaskBoard
  status: TaskStatus
  title: string
  description: string | null
  position: number
  createdAt: string
  createdBy: TaskPerson
  assignees: TaskPerson[]
  commentCount: number
  fileCount: number
  canDelete: boolean
  files?: TaskFile[]
  comments?: TaskComment[]
}

export const PERSONAL_COLUMNS: TaskStatus[] = ['NEW', 'IN_PROGRESS', 'DONE']
export const ORGANIZATION_COLUMNS: TaskStatus[] = [
  'NEW',
  'APPROVAL',
  'IN_PROGRESS',
  'REVIEW',
  'DONE',
]

export const STATUS_LABEL: Record<TaskStatus, string> = {
  NEW: 'Новые',
  APPROVAL: 'На согласовании',
  IN_PROGRESS: 'В работе',
  REVIEW: 'На проверке',
  DONE: 'Выполнено',
}

export function columnsFor(board: TaskBoard): TaskStatus[] {
  return board === 'PERSONAL' ? PERSONAL_COLUMNS : ORGANIZATION_COLUMNS
}

export function nextStatus(board: TaskBoard, status: TaskStatus): TaskStatus | null {
  const columns = columnsFor(board)
  const index = columns.indexOf(status)
  if (index < 0 || index >= columns.length - 1) return null
  return columns[index + 1] ?? null
}
