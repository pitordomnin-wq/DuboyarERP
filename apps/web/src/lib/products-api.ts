import { request } from '@/lib/api'
import type { LkpMaterialCategory } from '@/lib/production-api'
import type { ProductKind } from '@/lib/warehouse-api'

export type ProductCoatingRecipeLine = {
  id?: string
  category: LkpMaterialCategory
  enabled: boolean
  normPerM2Kg?: number | null
}

export type ProductImage = {
  id: string
  mimeType: string
  position: number
}

export type ProductAttribute = {
  id?: string
  name: string
  value: string
  position?: number
}

export type Product = {
  id: string
  kind?: ProductKind
  categoryId?: string
  groupId?: string | null
  inCatalog?: boolean
  name: string
  sku: string | null
  unit: string
  price: number
  description: string | null
  images?: ProductImage[]
  attributes?: ProductAttribute[]
  coatingRecipe?: ProductCoatingRecipeLine[]
  category?: { id: string; name: string; position: number }
  group?: { id: string; name: string } | null
}

export type ProductInput = {
  name: string
  sku?: string
  unit?: string
  price: number
  description?: string
  kind?: ProductKind
  categoryId?: string
  groupId?: string
  groupName?: string
  attributes?: ProductAttribute[]
  coatingRecipe?: ProductCoatingRecipeLine[]
}

export type AttributeTemplate = {
  id: string
  name: string
  items: ProductAttribute[]
}

export type ProductListKind = ProductKind | 'all' | 'supply' | 'stock' | 'catalog'

export function fetchProducts(query?: string, kind?: ProductListKind) {
  const params = new URLSearchParams()
  if (query?.trim()) params.set('q', query.trim())
  if (kind) params.set('kind', kind)
  const q = params.toString()
  return request<Product[]>(`/v1/products${q ? `?${q}` : ''}`)
}

async function upsertProduct(path: string, method: 'POST' | 'PATCH', input: ProductInput) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string
      message?: string | { error?: string } | string[]
    }
    const code =
      typeof payload.message === 'object' && payload.message && !Array.isArray(payload.message)
        ? payload.message.error
        : payload.error
    throw new Error(code ?? 'request_failed')
  }
  return (await res.json()) as Product
}

export function createProduct(input: ProductInput) {
  return upsertProduct('/v1/products', 'POST', input)
}

export function updateProduct(id: string, input: ProductInput) {
  return upsertProduct(`/v1/products/${id}`, 'PATCH', input)
}

export function setProductCatalog(id: string, inCatalog: boolean) {
  return request<Product>(`/v1/products/${id}/catalog`, {
    method: 'PATCH',
    body: JSON.stringify({ inCatalog }),
  })
}

export function productImageUrl(productId: string, imageId: string, width?: number) {
  const base = `/v1/products/${productId}/images/${imageId}/file`
  return width ? `${base}?w=${width}` : base
}

export async function uploadProductImages(productId: string, files: File[]) {
  const data = new FormData()
  for (const file of files) data.append('files', file)
  const res = await fetch(`/v1/products/${productId}/images`, {
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
  return (await res.json()) as Product
}

export function deleteProductImage(productId: string, imageId: string) {
  return request<Product>(`/v1/products/${productId}/images/${imageId}`, { method: 'DELETE' })
}

export async function deleteProduct(id: string) {
  const res = await fetch(`/v1/products/${id}`, { method: 'DELETE', credentials: 'include' })
  if (res.status === 204) return
  const body = (await res.json().catch(() => ({}))) as {
    error?: string
    message?: string | { error?: string }
  }
  const code = typeof body.message === 'object' ? body.message?.error : body.error
  if (code === 'in_production' || code === 'in_purchases') throw new Error(code)
  throw new Error('request_failed')
}

export function money(value: number) {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽'
}

export function fetchAttributeTemplates() {
  return request<AttributeTemplate[]>('/v1/products/attribute-templates')
}

export async function createAttributeTemplate(input: { name: string; items: { name: string; value: string }[] }) {
  const res = await fetch('/v1/products/attribute-templates', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string
      message?: string | { error?: string }
    }
    const code = typeof payload.message === 'object' ? payload.message?.error : payload.error
    throw new Error(code ?? 'request_failed')
  }
  return (await res.json()) as AttributeTemplate
}

export function deleteAttributeTemplate(id: string) {
  return request<void>(`/v1/products/attribute-templates/${id}`, { method: 'DELETE' })
}
