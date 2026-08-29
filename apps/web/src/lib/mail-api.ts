import { request } from '@/lib/api'

export type MailFolder = 'INBOX' | 'SENT' | 'DRAFTS' | 'SPAM' | 'ARCHIVE'

export const MAIL_FOLDER_LABEL: Record<MailFolder, string> = {
  INBOX: 'Входящие',
  SENT: 'Исходящие',
  DRAFTS: 'Черновики',
  SPAM: 'Спам',
  ARCHIVE: 'Архив',
}

export const MAIL_FOLDERS: MailFolder[] = ['INBOX', 'SENT', 'DRAFTS', 'SPAM', 'ARCHIVE']

export type MailAttachment = {
  id: string
  name: string
  mimeType: string
  size: number
}

export type MailMessage = {
  id: string
  folder: MailFolder
  fromAddress: string
  fromName: string
  toAddress: string
  toName: string
  subject: string
  body: string
  readAt: string | null
  createdAt: string
  attachments: MailAttachment[]
}

export type MailCounts = Record<MailFolder, number> & { unread: number }

export type AddressBook = {
  employees: { id: string; name: string; email: string }[]
  counterparties: { id: string; name: string; email: string; contactName: string | null }[]
}

export function fetchMailCounts() {
  return request<MailCounts>('/v1/mailbox/counts')
}

export function fetchMail(folder: MailFolder) {
  return request<MailMessage[]>(`/v1/mailbox?folder=${folder}`)
}

export function fetchMailMessage(id: string) {
  return request<MailMessage>(`/v1/mailbox/${id}`)
}

export function fetchAddressBook() {
  return request<AddressBook>('/v1/mailbox/address-book')
}

export function composeMail(input: {
  toAddress: string
  toName?: string
  subject: string
  body: string
  draft?: boolean
}) {
  return request<MailMessage>('/v1/mailbox', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function sendDraft(id: string) {
  return request<MailMessage>(`/v1/mailbox/${id}/send`, { method: 'POST' })
}

export function updateMail(id: string, input: Partial<Pick<MailMessage, 'folder' | 'toAddress' | 'toName' | 'subject' | 'body'>>) {
  return request<MailMessage>(`/v1/mailbox/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteMail(id: string) {
  return request<void>(`/v1/mailbox/${id}`, { method: 'DELETE' })
}

export function attachmentFileUrl(messageId: string, attachmentId: string) {
  return `/v1/mailbox/${messageId}/attachments/${attachmentId}/file`
}

export async function uploadAttachments(messageId: string, files: File[]) {
  const data = new FormData()
  for (const file of files) data.append('files', file)
  const res = await fetch(`/v1/mailbox/${messageId}/attachments`, {
    method: 'POST',
    credentials: 'include',
    body: data,
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? 'request_failed')
  }
  return (await res.json()) as MailMessage
}

export function deleteAttachment(messageId: string, attachmentId: string) {
  return request<MailMessage>(`/v1/mailbox/${messageId}/attachments/${attachmentId}`, {
    method: 'DELETE',
  })
}
