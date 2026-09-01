import { request } from '@/lib/api'

export type ProductionStageStatus = 'TO_START' | 'IN_PROGRESS'
export type DealItemProductionStatus = 'NONE' | 'IN_PRODUCTION' | 'IN_WAREHOUSE'

export const STAGE_STATUS_LABEL: Record<ProductionStageStatus, string> = {
  TO_START: 'Начать производство',
  IN_PROGRESS: 'Этап выполнен',
}

export type ProductionStageSummary = {
  id: string
  name: string
  position: number
  lossPercent?: number
}

export type ProductionTypeSummary = {
  id: string
  name: string
  productId: string
  product: { id: string; name: string; sku: string | null }
  warehouse: { id: string; name: string }
  stages: ProductionStageSummary[]
  _count: { jobs: number }
}

export type ProductionBomLine = {
  id: string
  productId: string | null
  productGroupId?: string | null
  quantity: number
  product: { id: string; name: string; sku: string | null; unit: string } | null
  productGroup?: { id: string; name: string } | null
}

export type ProductionStage = ProductionStageSummary & {
  lossPercent: number
  inputs: ProductionBomLine[]
  outputs: ProductionBomLine[]
}

export type ProductionType = {
  id: string
  name: string
  productId: string
  warehouseId: string
  product: { id: string; name: string; sku: string | null; unit: string }
  warehouse: { id: string; name: string }
  stages: ProductionStage[]
}

export type ProductionJob = {
  id: string
  title: string
  quantity: number
  status: 'ACTIVE' | 'DONE'
  stageStatus: ProductionStageStatus
  stageId: string
  typeId: string
  type: { id: string; name: string; productId: string }
  stage: { id: string; name: string; position: number }
  deal: { id: string; title: string } | null
  dealItem: { id: string; name: string; unit: string; productionStatus: DealItemProductionStatus } | null
  warehouse: { id: string; name: string }
  createdBy: { id: string; name: string }
  createdAt: string
}

export type ProductionTypeInput = {
  name: string
  productId: string
  warehouseId: string
  stages: {
    name: string
    lossPercent?: number
    inputs: ({ productId: string; quantity: number } | { productGroupId: string; quantity: number })[]
    outputs: { productId: string; quantity: number }[]
  }[]
}

export function fetchProductionTypes() {
  return request<ProductionTypeSummary[]>('/v1/production/types')
}

export function fetchProductionType(id: string) {
  return request<ProductionType>(`/v1/production/types/${id}`)
}

export function createProductionType(input: ProductionTypeInput) {
  return request<ProductionType>('/v1/production/types', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateProductionType(id: string, input: ProductionTypeInput) {
  return request<ProductionType>(`/v1/production/types/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteProductionType(id: string) {
  return request<void>(`/v1/production/types/${id}`, { method: 'DELETE' })
}

export function fetchProductionJobs(filters?: { typeId?: string; dealId?: string }) {
  const params = new URLSearchParams()
  if (filters?.typeId) params.set('typeId', filters.typeId)
  if (filters?.dealId) params.set('dealId', filters.dealId)
  const q = params.toString()
  return request<ProductionJob[]>(`/v1/production/jobs${q ? `?${q}` : ''}`)
}

export function sendDealItemToProduction(dealItemId: string) {
  return request<ProductionJob>('/v1/production/jobs', {
    method: 'POST',
    body: JSON.stringify({ dealItemId }),
  })
}

async function postJobAction(id: string, action: 'start' | 'complete') {
  const res = await fetch(`/v1/production/jobs/${id}/${action}`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; name?: string }
    if (body.error === 'insufficient_stock') {
      throw new Error(`Недостаточно на складе: ${body.name ?? 'сырьё'}`)
    }
    if (body.error === 'type_not_configured') {
      throw new Error('Этапы не настроены в панели управления')
    }
    if (body.error === 'empty_group') {
      throw new Error(`В группе нет товаров: ${body.name ?? ''}`)
    }
    throw new Error('request_failed')
  }
  return (await res.json()) as ProductionJob
}

export function startProductionJob(id: string) {
  return postJobAction(id, 'start')
}

export function completeProductionJob(id: string) {
  return postJobAction(id, 'complete')
}
