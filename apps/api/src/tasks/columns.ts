import { TaskBoard, TaskStatus } from '@prisma/client';

export const PERSONAL_COLUMNS: TaskStatus[] = [
  TaskStatus.NEW,
  TaskStatus.IN_PROGRESS,
  TaskStatus.DONE,
];

export const ORGANIZATION_COLUMNS: TaskStatus[] = [
  TaskStatus.NEW,
  TaskStatus.APPROVAL,
  TaskStatus.IN_PROGRESS,
  TaskStatus.REVIEW,
  TaskStatus.DONE,
];

export function columnsFor(board: TaskBoard): TaskStatus[] {
  return board === TaskBoard.PERSONAL ? PERSONAL_COLUMNS : ORGANIZATION_COLUMNS;
}

export function nextStatus(board: TaskBoard, status: TaskStatus): TaskStatus | null {
  const columns = columnsFor(board);
  const index = columns.indexOf(status);
  if (index < 0 || index >= columns.length - 1) {
    return null;
  }
  return columns[index + 1] ?? null;
}

export function isAllowedStatus(board: TaskBoard, status: TaskStatus) {
  return columnsFor(board).includes(status);
}
