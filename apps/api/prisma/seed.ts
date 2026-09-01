import { PrismaClient, LicenseStatus, AccessStatus, UserRole } from '@prisma/client'
import { DEMO_ORG, fillParquetDemo, wipeDemoProductFiles } from '../src/demo/parquet-demo'
import { defaultDealPipelineColumns } from '../src/sales/statuses'

const prisma = new PrismaClient()

const ALL_PAGES = [
  'tasks',
  'mail',
  'sales',
  'warehouse',
  'production',
  'products',
  'purchases',
  'counterparties',
  'admin',
]

async function seedDealPipeline(organizationId: string) {
  const defaults = defaultDealPipelineColumns()
  await prisma.dealStatusConfig.createMany({
    data: defaults.map((column) => ({
      organizationId,
      status: column.status,
      label: column.label,
      color: column.color,
      position: column.position,
    })),
  })
}

async function main() {
  await wipeDemoProductFiles()
  await prisma.mailAttachment.deleteMany()
  await prisma.mailMessage.deleteMany()
  await prisma.productionJob.deleteMany()
  await prisma.productionType.deleteMany()
  await prisma.purchase.deleteMany()
  await prisma.deal.deleteMany()
  await prisma.dealStatusConfig.deleteMany()
  await prisma.warehouse.deleteMany()
  await prisma.productAttributeTemplate.deleteMany()
  await prisma.product.deleteMany()
  await prisma.productGroup.deleteMany()
  await prisma.warehouseCategory.deleteMany()
  await prisma.task.deleteMany()
  await prisma.counterparty.deleteMany()
  await prisma.session.deleteMany()
  await prisma.otpChallenge.deleteMany()
  await prisma.user.deleteMany()
  await prisma.role.deleteMany()
  await prisma.organization.deleteMany()

  const live = await prisma.organization.create({
    data: {
      ...DEMO_ORG,
      licenseStatus: LicenseStatus.ACTIVE,
    },
  })
  await seedDealPipeline(live.id)

  const adminRole = await prisma.role.create({
    data: {
      organizationId: live.id,
      name: 'Администратор',
      pages: ALL_PAGES,
      locked: true,
    },
  })
  const memberRole = await prisma.role.create({
    data: {
      organizationId: live.id,
      name: 'Сотрудник',
      pages: ALL_PAGES.filter((page) => page !== 'admin'),
    },
  })

  await prisma.user.createMany({
    data: [
      {
        organizationId: live.id,
        email: 'owner@faverum.local',
        name: 'Анна Ковалёва',
        role: UserRole.ADMIN,
        roleId: adminRole.id,
        status: AccessStatus.ACTIVE,
        mailSignature: 'С уважением,\nАнна Ковалёва\nГенеральный директор\nДубрава Паркет',
        jobTitle: 'Генеральный директор',
      },
      {
        organizationId: live.id,
        email: 'manager@faverum.local',
        name: 'Иван Петров',
        role: UserRole.MEMBER,
        roleId: memberRole.id,
        status: AccessStatus.ACTIVE,
        mailSignature: 'С уважением,\nИван Петров\nОтдел продаж\nДубрава Паркет',
        jobTitle: 'Менеджер по продажам',
      },
      {
        organizationId: live.id,
        email: 'shop@faverum.local',
        name: 'Павел Скворцов',
        role: UserRole.MEMBER,
        roleId: memberRole.id,
        status: AccessStatus.ACTIVE,
        mailSignature: 'С уважением,\nПавел Скворцов\nНачальник цеха\nДубрава Паркет',
        jobTitle: 'Начальник цеха',
      },
      {
        organizationId: live.id,
        email: 'store@faverum.local',
        name: 'Елена Новикова',
        role: UserRole.MEMBER,
        roleId: memberRole.id,
        status: AccessStatus.ACTIVE,
        mailSignature: 'С уважением,\nЕлена Новикова\nСклад\nДубрава Паркет',
        jobTitle: 'Кладовщик',
      },
      {
        organizationId: live.id,
        email: 'blocked@faverum.local',
        name: 'Сергей Морозов',
        role: UserRole.MEMBER,
        roleId: memberRole.id,
        status: AccessStatus.BLOCKED,
        jobTitle: 'Менеджер',
      },
    ],
  })

  const owner = await prisma.user.findUniqueOrThrow({ where: { email: 'owner@faverum.local' } })
  const manager = await prisma.user.findUniqueOrThrow({ where: { email: 'manager@faverum.local' } })
  const shop = await prisma.user.findUniqueOrThrow({ where: { email: 'shop@faverum.local' } })
  const store = await prisma.user.findUniqueOrThrow({ where: { email: 'store@faverum.local' } })

  await fillParquetDemo(prisma, {
    organizationId: live.id,
    ownerId: owner.id,
    managerId: manager.id,
    shopId: shop.id,
    storeId: store.id,
    shopName: shop.name,
  })

  const paused = await prisma.organization.create({
    data: {
      name: 'Приостановленная организация',
      licenseStatus: LicenseStatus.SUSPENDED,
    },
  })
  await seedDealPipeline(paused.id)
  const pausedAdmin = await prisma.role.create({
    data: {
      organizationId: paused.id,
      name: 'Администратор',
      pages: ALL_PAGES,
      locked: true,
    },
  })
  await prisma.user.create({
    data: {
      organizationId: paused.id,
      email: 'suspended@faverum.local',
      name: 'Иван Петров',
      role: UserRole.ADMIN,
      roleId: pausedAdmin.id,
      status: AccessStatus.ACTIVE,
    },
  })

  console.log(`Seeded organization ${live.name}`)
  console.log('Active admin: owner@faverum.local')
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
