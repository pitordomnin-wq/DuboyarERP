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

export type StockRow = {
  id: string
  kind: ProductKind
  name: string
  sku: string | null
  unit: string
  price: number
  quantity: number
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
  product: {
    id: string
    kind: ProductKind
    name: string
    sku: string | null
    unit: string
    price: number
    description: string | null
  }
  quantity: number
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

export function fetchStock(warehouseId: string, kind?: ProductKind | 'all', query?: string) {
  const params = new URLSearchParams()
  if (kind && kind !== 'all') params.set('kind', kind)
  if (query?.trim()) params.set('q', query.trim())
  const q = params.toString()
  return request<StockRow[]>(`/v1/warehouses/${warehouseId}/stock${q ? `?${q}` : ''}`)
}

export function fetchStockItem(warehouseId: string, productId: string) {
  return request<StockCard>(`/v1/warehouses/${warehouseId}/stock/${productId}`)
}

export function createStockItem(
  warehouseId: string,
  input: { name: string; sku: string; kind: ProductKind; unit?: string; price?: number },
) {
  return request<StockRow>(`/v1/warehouses/${warehouseId}/items`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateStockItem(
  warehouseId: string,
  productId: string,
  input: { name?: string; sku?: string; unit?: string },
) {
  return request<StockRow>(`/v1/warehouses/${warehouseId}/stock/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
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
