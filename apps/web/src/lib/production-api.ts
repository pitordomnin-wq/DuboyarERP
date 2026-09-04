import { request } from '@/lib/api'

export type ProductionStageStatus = 'TO_START' | 'IN_PROGRESS'
export type DealItemProductionStatus = 'NONE' | 'IN_PRODUCTION' | 'IN_WAREHOUSE' | 'SHIPPED'
export type ProductionReleaseType = 'DECK' | 'HERRINGBONE'
export type StageInputMode = 'PRODUCT' | 'GROUP' | 'LKP_RECIPE' | 'KEYWORD'
export type StageQuantityBasis = 'M2' | 'PIECE' | 'PACKAGE' | 'M2_ORIGINAL'
export type LkpMaterialCategory = 'PRIMER' | 'LACQUER_OIL' | 'PASTE' | 'DYE' | 'PIGMENT'
export type LayoutMaterialRole =
  | 'VENEER_OAK'
  | 'VENEER_DECK'
  | 'VENEER_HERRINGBONE'
  | 'BOX_DECK'
  | 'BOX_HERRINGBONE'
  | 'PACK_UNIVERSAL'

export const STAGE_STATUS_LABEL: Record<ProductionStageStatus, string> = {
  TO_START: 'Начать производство',
  IN_PROGRESS: 'Этап выполнен',
}

export const RELEASE_TYPE_LABEL: Record<ProductionReleaseType, string> = {
  DECK: 'Палуба',
  HERRINGBONE: 'Ёлка',
}

export const LKP_CATEGORY_LABEL: Record<LkpMaterialCategory, string> = {
  PRIMER: 'Грунт',
  LACQUER_OIL: 'Лак / масло',
  PASTE: 'Паста',
  DYE: 'Краситель',
  PIGMENT: 'Пигмент',
}

export const QUANTITY_BASIS_LABEL: Record<StageQuantityBasis, string> = {
  M2: 'м²',
  PIECE: 'шт',
  PACKAGE: 'упак',
  M2_ORIGINAL: 'м² после профиля',
}

export const INPUT_MODE_LABEL: Record<StageInputMode, string> = {
  PRODUCT: 'Товар',
  GROUP: 'Группа FIFO',
  LKP_RECIPE: 'Рецепт ЛКП',
  KEYWORD: 'По ключевым словам',
}

export const LAYOUT_ROLE_LABEL: Record<LayoutMaterialRole, string> = {
  VENEER_OAK: 'Шпон дуб (универсальный)',
  VENEER_DECK: 'Шпон палуба',
  VENEER_HERRINGBONE: 'Шпон ёлка',
  BOX_DECK: 'Короб палуба',
  BOX_HERRINGBONE: 'Короб ёлка',
  PACK_UNIVERSAL: 'Упаковка (1 шт/упак)',
}

export function layoutRoleApplies(role: LayoutMaterialRole, releaseType: ProductionReleaseType): boolean {
  if (role === 'VENEER_OAK' || role === 'PACK_UNIVERSAL') return true
  if (releaseType === 'DECK') return role === 'VENEER_DECK' || role === 'BOX_DECK'
  return role === 'VENEER_HERRINGBONE' || role === 'BOX_HERRINGBONE'
}

export function inputAppliesToRelease(input: ProductionBomLine, releaseType: ProductionReleaseType): boolean {
  if (input.layoutRole) return layoutRoleApplies(input.layoutRole, releaseType)
  return true
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
  inputMode?: StageInputMode
  quantityBasis?: StageQuantityBasis
  lkpCategory?: LkpMaterialCategory | null
  keyword?: string | null
  layoutRole?: LayoutMaterialRole | null
  product: { id: string; name: string; sku: string | null; unit: string } | null
  productGroup?: { id: string; name: string; keywords?: string[] } | null
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
  defaultReleaseType?: ProductionReleaseType | null
  piecesPerM2?: number
  m2PerPackageDeck?: number
  m2PerPackageHerringbone?: number
  product: { id: string; name: string; sku: string | null; unit: string }
  warehouse: { id: string; name: string }
  stages: ProductionStage[]
}

export type ProductionJob = {
  id: string
  title: string
  quantity: number
  quantityM2: number
  releaseType: ProductionReleaseType
  pieceCount: number | null
  packageCount: number | null
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

export type StageInputPayload = {
  productId?: string
  productGroupId?: string
  quantity: number
  inputMode?: StageInputMode
  quantityBasis?: StageQuantityBasis
  lkpCategory?: LkpMaterialCategory
  keyword?: string
  layoutRole?: LayoutMaterialRole
}

export type ProductionTypeInput = {
  name: string
  productId: string
  warehouseId: string
  defaultReleaseType?: ProductionReleaseType
  piecesPerM2?: number
  m2PerPackageDeck?: number
  m2PerPackageHerringbone?: number
  stages: {
    name: string
    lossPercent?: number
    inputs: StageInputPayload[]
    outputs: { productId: string; quantity: number }[]
  }[]
}

export type LkpNorm = {
  id: string
  category: LkpMaterialCategory
  normPerM2Kg: number
  keywords: string[]
}

export type ImportTechCardRow = {
  materialName: string
  stage: number
  normDeckM2?: number
  normHerringboneM2?: number
  productGroupName?: string
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

export function importTechCard(input: {
  productId: string
  warehouseId: string
  defaultReleaseType?: ProductionReleaseType
  rows: ImportTechCardRow[]
}) {
  return request<ProductionType>('/v1/production/types/import', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function fetchLkpNorms() {
  return request<LkpNorm[]>('/v1/production/lkp-norms')
}

export function updateLkpNorms(items: { category: LkpMaterialCategory; normPerM2Kg: number; keywords: string[] }[]) {
  return request<LkpNorm[]>('/v1/production/lkp-norms', {
    method: 'PUT',
    body: JSON.stringify({ items }),
  })
}

export function fetchProductionJobs(filters?: { typeId?: string; dealId?: string }) {
  const params = new URLSearchParams()
  if (filters?.typeId) params.set('typeId', filters.typeId)
  if (filters?.dealId) params.set('dealId', filters.dealId)
  const q = params.toString()
  return request<ProductionJob[]>(`/v1/production/jobs${q ? `?${q}` : ''}`)
}

export function sendDealItemToProduction(dealItemId: string, releaseType?: ProductionReleaseType) {
  return request<ProductionJob>('/v1/production/jobs', {
    method: 'POST',
    body: JSON.stringify({ dealItemId, releaseType }),
  })
}

export type ProductionWriteoff = {
  id: string
  quantity: number
  note: string | null
  createdAt: string
  product: { id: string; name: string; unit: string }
  createdBy: { id: string; name: string }
}

export type ProductionWriteoffPreview = {
  slotKey?: string
  productId: string
  productName: string
  unit: string
  quantity: number
  groupName?: string
  groupId?: string | null
  label?: string
  candidates?: {
    productId: string
    productName: string
    unit: string
    quantity: number
  }[]
}

export function fetchJobWriteoffs(jobId: string) {
  return request<ProductionWriteoff[]>(`/v1/production/jobs/${jobId}/writeoffs`)
}

export function previewJobWriteoffs(jobId: string) {
  return request<ProductionWriteoffPreview[]>(`/v1/production/jobs/${jobId}/preview-writeoffs`)
}

async function postJobAction(
  id: string,
  action: 'start' | 'complete' | 'rollback',
  body?: { writeoffs?: { productId: string; quantity: number }[] },
) {
  const res = await fetch(`/v1/production/jobs/${id}/${action}`, {
    method: 'POST',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string
      name?: string
      message?: string
    }
    if (payload.error === 'insufficient_stock') {
      throw new Error(`Недостаточно на складе: ${payload.name ?? 'сырьё'}`)
    }
    if (payload.error === 'material_not_found') {
      throw new Error(`Материал не найден на складе: ${payload.name ?? ''}`)
    }
    if (payload.error === 'type_not_configured') {
      throw new Error('Этапы не настроены в панели управления')
    }
    if (payload.error === 'empty_group') {
      throw new Error(`В группе нет товаров: ${payload.name ?? ''}`)
    }
    if (payload.error === 'cannot_rollback') {
      throw new Error(payload.message ?? 'Нельзя откатить действие')
    }
    if (payload.error === 'nothing_to_rollback') {
      throw new Error('Нечего откатывать')
    }
    throw new Error('request_failed')
  }
  return (await res.json()) as ProductionJob
}

export function startProductionJob(id: string) {
  return postJobAction(id, 'start')
}

export function rollbackProductionJob(id: string) {
  return postJobAction(id, 'rollback')
}

export function completeProductionJob(
  id: string,
  writeoffs?: { productId: string; quantity: number }[],
) {
  return postJobAction(id, 'complete', writeoffs ? { writeoffs } : undefined)
}
