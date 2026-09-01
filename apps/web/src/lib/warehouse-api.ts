import { request } from '@/lib/api'

export type ProductKind = 'CONSUMABLE' | 'MATERIAL' | 'SEMI_FINISHED' | 'FINISHED'
export type StockMovementType = 'RECEIPT' | 'WRITEOFF'

export const PRODUCT_KIND_LABEL: Record<ProductKind, string> = {
  CONSUMABLE: 'Расходники',
  MATERIAL: 'Сырьё',
  SEMI_FINISHED: 'Заготовки',
  FINISHED: 'Готовая продукция',
}

export type Warehouse = {
  id: string
  name: string
  address: string | null
}

export type WarehouseCategory = {
  id: string
  name: string
  position: number
}

export type ProductGroup = {
  id: string
  name: string
  _count?: { products: number }
}

export type StockRow = {
  id: string
  kind: ProductKind
  categoryId: string
  groupId: string | null
  name: string
  sku: string | null
  unit: string
  price: number
  quantity: number
  category?: WarehouseCategory
  group?: { id: string; name: string } | null
}

export type StockMovement = {
  id: string
  type: StockMovementType
  quantity: number
  note: string | null
  createdAt: string
  createdBy: { id: string; name: string }
}

export type StockCard = {
  warehouse: { id: string; name: string; address: string | null }
  product: {
    id: string
    kind: ProductKind
    categoryId: string
    groupId: string | null
    inCatalog: boolean
    name: string
    sku: string | null
    unit: string
    price: number
    description: string | null
    createdAt: string
    updatedAt: string
    attributes: { id: string; name: string; value: string }[]
    category?: WarehouseCategory
    group?: { id: string; name: string } | null
  }
  quantity: number
  stats: { receipts: number; writeoffs: number }
  movements: StockMovement[]
}

export function fetchWarehouses() {
  return request<Warehouse[]>('/v1/warehouses')
}

export function createWarehouse(input: { name: string; address?: string }) {
  return request<Warehouse>('/v1/warehouses', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function fetchWarehouseCategories() {
  return request<WarehouseCategory[]>('/v1/warehouses/categories')
}

export function createWarehouseCategory(name: string) {
  return request<WarehouseCategory>('/v1/warehouses/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function updateWarehouseCategory(id: string, input: { name?: string; position?: number }) {
  return request<WarehouseCategory>(`/v1/warehouses/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function reorderWarehouseCategories(ids: string[]) {
  return request<WarehouseCategory[]>('/v1/warehouses/categories/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ ids }),
  })
}

export async function deleteWarehouseCategory(id: string) {
  const res = await fetch(`/v1/warehouses/categories/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (res.status === 204) return
  const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: { error?: string } }
  const code = typeof payload.message === 'object' ? payload.message?.error : payload.error
  throw new Error(code ?? 'request_failed')
}

export function fetchProductGroups() {
  return request<ProductGroup[]>('/v1/product-groups')
}

export function createProductGroup(name: string) {
  return request<ProductGroup>('/v1/product-groups', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function fetchStock(warehouseId: string, categoryId?: string | 'all', query?: string) {
  const params = new URLSearchParams()
  if (categoryId && categoryId !== 'all') params.set('categoryId', categoryId)
  if (query?.trim()) params.set('q', query.trim())
  const q = params.toString()
  return request<StockRow[]>(`/v1/warehouses/${warehouseId}/stock${q ? `?${q}` : ''}`)
}

export function fetchStockItem(warehouseId: string, productId: string) {
  return request<StockCard>(`/v1/warehouses/${warehouseId}/stock/${productId}`)
}

export function createStockItem(
  warehouseId: string,
  input: {
    name: string
    sku: string
    kind: ProductKind
    categoryId: string
    groupId?: string
    groupName?: string
    unit?: string
    price?: number
  },
) {
  return request<StockRow>(`/v1/warehouses/${warehouseId}/items`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateStockItem(
  warehouseId: string,
  productId: string,
  input: {
    name?: string
    sku?: string
    unit?: string
    price?: number
    kind?: ProductKind
    categoryId?: string
    groupId?: string | null
    groupName?: string
  },
) {
  return request<StockRow>(`/v1/warehouses/${warehouseId}/stock/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function deleteStockItem(warehouseId: string, productId: string) {
  const res = await fetch(`/v1/warehouses/${warehouseId}/stock/${productId}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (res.status === 204) return
  const payload = (await res.json().catch(() => ({}))) as {
    error?: string
    message?: string | { error?: string }
  }
  const code = typeof payload.message === 'object' ? payload.message?.error : payload.error
  throw new Error(code ?? 'request_failed')
}

export function postStockMovement(
  warehouseId: string,
  input: { productId: string; type: StockMovementType; quantity: number; note?: string },
) {
  return request<StockMovement>(`/v1/warehouses/${warehouseId}/movements`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
