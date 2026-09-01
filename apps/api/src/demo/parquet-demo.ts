import {
  DealChannel,
  DealItemProductionStatus,
  DealMessageDirection,
  DealStatus,
  MailFolder,
  PrismaClient,
  ProductKind,
  ProductionJobStatus,
  ProductionStageStatus,
  PurchaseStatus,
  StockMovementType,
  TaskBoard,
  TaskStatus,
} from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { existsSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { productUploadRoot, saveProductImage } from '../products/storage'

export type DemoDb = PrismaClient | Prisma.TransactionClient

export const DEMO_ORG = {
  name: 'Дубрава Паркет',
  legalName: 'ООО «Дубрава Паркет»',
  brandAddress: '156000, г. Кострома, ул. Советская, д. 48',
  phone: '+7 4942 49-20-10',
  email: 'hello@dubrava.local',
  inn: '4401001122',
  kpp: '440101001',
  ogrn: '1024400522108',
  legalAddress: '156000, г. Кострома, ул. Советская, д. 48',
  bankName: 'ПАО Сбербанк',
  bik: '044525225',
  checkingAccount: '40702810944000001234',
  correspondentAccount: '30101810400000000225',
} as const

export type DemoActors = {
  organizationId: string
  ownerId: string
  managerId: string
  shopId: string
  storeId: string
  shopName: string
}

/** Moscow local time as UTC Date. */
function at(month: number, day: number, hour = 10, minute = 0) {
  return new Date(Date.UTC(2026, month - 1, day, hour - 3, minute, 0))
}

export async function clearOrganizationOperations(db: DemoDb, organizationId: string) {
  await db.mailMessage.deleteMany({ where: { organizationId } })
  await db.productionJob.deleteMany({ where: { organizationId } })
  await db.productionType.deleteMany({ where: { organizationId } })
  await db.purchase.deleteMany({ where: { organizationId } })
  await db.deal.deleteMany({ where: { organizationId } })
  await db.warehouse.deleteMany({ where: { organizationId } })
  await db.productAttributeTemplate.deleteMany({ where: { organizationId } })
  await db.product.deleteMany({ where: { organizationId } })
  await db.productGroup.deleteMany({ where: { organizationId } })
  await db.warehouseCategory.deleteMany({ where: { organizationId } })
  await db.task.deleteMany({ where: { organizationId } })
  await db.counterparty.deleteMany({ where: { organizationId } })
}

export async function restoreDemoOrganization(db: DemoDb, organizationId: string) {
  await db.organization.update({
    where: { id: organizationId },
    data: { ...DEMO_ORG },
  })
}

export async function wipeDemoProductFiles(organizationId?: string) {
  const root = organizationId ? join(productUploadRoot(), organizationId) : productUploadRoot()
  await rm(root, { recursive: true, force: true })
}

export async function fillParquetDemo(db: DemoDb, actors: DemoActors) {
  const { organizationId: orgId, ownerId, managerId, shopId, storeId, shopName } = actors

  await db.warehouseCategory.createMany({
    data: [
      { organizationId: orgId, name: 'Расходники', position: 0 },
      { organizationId: orgId, name: 'Сырьё', position: 1 },
      { organizationId: orgId, name: 'Заготовки', position: 2 },
      { organizationId: orgId, name: 'Готовая продукция', position: 3 },
    ],
  })
  const cats = await db.warehouseCategory.findMany({ where: { organizationId: orgId } })
  const cat = Object.fromEntries(cats.map((c) => [c.name, c.id])) as Record<string, string>
  const catByKind = {
    [ProductKind.CONSUMABLE]: cat['Расходники'],
    [ProductKind.MATERIAL]: cat['Сырьё'],
    [ProductKind.SEMI_FINISHED]: cat['Заготовки'],
    [ProductKind.FINISHED]: cat['Готовая продукция'],
  }

  await db.productAttributeTemplate.create({
    data: {
      organizationId: orgId,
      name: 'Паркетная доска',
      items: {
        create: [
          { name: 'Толщина', value: '14 мм', position: 0 },
          { name: 'Ширина', value: '190 мм', position: 1 },
          { name: 'Длина', value: '1860 мм', position: 2 },
          { name: 'Порода', value: 'Дуб', position: 3 },
          { name: 'Покрытие', value: 'Лак', position: 4 },
          { name: 'Сорт', value: 'Натур', position: 5 },
        ],
      },
    },
  })

  await db.product.createMany({
    data: [
      fin(orgId, catByKind, 'Паркет дуб натуральный 14×190×1860', 'PAR-OAK-NAT', 'м²', 4850, 'Трёхслойная доска, лак, сорт натур'),
      fin(orgId, catByKind, 'Паркет дуб рустик 14×190×1860', 'PAR-OAK-RUS', 'м²', 5190, 'Живой рисунок, масло-воск'),
      fin(orgId, catByKind, 'Паркет ясень беленый 14×130×1200', 'PAR-ASH-WHT', 'м²', 4450, 'Узкая планка, белёный ясень'),
      fin(orgId, catByKind, 'Инженерная доска дуб селект 15×150×1800', 'ENG-OAK-SEL', 'м²', 6200, 'Селект, заводской лак'),
      fin(orgId, catByKind, 'Плинтус дуб 80 мм', 'PLI-OAK-80', 'м', 890, 'Массив дуба под цвет доски'),
      fin(orgId, catByKind, 'Плинтус дуб 60 мм', 'PLI-OAK-60', 'м', 720, 'Низкий профиль под двери'),
      fin(orgId, catByKind, 'Плинтус ясень 80 мм', 'PLI-ASH-80', 'м', 860, 'Под белёный и натуральный ясень'),
      fin(orgId, catByKind, 'Порог дуб 30 мм', 'THR-OAK', 'м', 640, 'Т-профиль между помещениями'),
      fin(orgId, catByKind, 'Подложка пробковая 2 мм', 'UND-CORK-2', 'м²', 280, 'Под паркетную и инженерную доску'),
      fin(orgId, catByKind, 'Подложка XPS 3 мм', 'UND-XPS', 'м²', 190, 'С фольгой, под тёплый пол'),
      fin(orgId, catByKind, 'Набор ухода масло-воск', 'OIL-CARE', 'шт', 1490, 'Обновление покрытия раз в год'),
      fin(orgId, catByKind, 'Паркет дуб мёд 14×190×1860', 'PAR-OAK-HON', 'м²', 5120, 'Тёплый янтарный тон, лак'),
      fin(orgId, catByKind, 'Паркет дуб дымчатый 14×190×1860', 'PAR-OAK-SMK', 'м²', 5480, 'Серо-коричневый, масло'),
      fin(orgId, catByKind, 'Паркет дуб эспрессо 14×130×1200', 'PAR-OAK-ESP', 'м²', 5290, 'Тёмный узкий формат'),
      fin(orgId, catByKind, 'Паркет дуб широкий 14×220×2200', 'PAR-OAK-WDE', 'м²', 5890, 'Широкая планка, натур'),
      fin(orgId, catByKind, 'Паркет дуб ёлочка 14×90×600', 'PAR-OAK-HER', 'м²', 6420, 'Классическая венгерская ёлка'),
      fin(orgId, catByKind, 'Паркет орех натуральный 14×150×1800', 'PAR-WAL-NAT', 'м²', 7120, 'Орех европейский, лак'),
      fin(orgId, catByKind, 'Паркет ясень натуральный 14×130×1200', 'PAR-ASH-NAT', 'м²', 4680, 'Светлый ясень без отбеливания'),
      fin(orgId, catByKind, 'Инженерная дуб рустик 15×150×1800', 'ENG-OAK-RUS', 'м²', 5980, 'Живой рисунок, масло'),
      fin(orgId, catByKind, 'Инженерная ясень беленый 15×130×1800', 'ENG-ASH-WHT', 'м²', 5740, 'Скандинавский тон'),
      mat(orgId, catByKind, 'Фанера берёзовая 8 мм', 'MAT-PLY-8', 'м²', 890),
      mat(orgId, catByKind, 'Шпон дуба 4 мм', 'MAT-VEN-OAK', 'м²', 1450),
      mat(orgId, catByKind, 'Шпон ясеня 4 мм', 'MAT-VEN-ASH', 'м²', 1380),
      mat(orgId, catByKind, 'Клей полиуретановый', 'MAT-GLUE-PU', 'кг', 420),
      mat(orgId, catByKind, 'Лак ПУ двухкомпонентный', 'MAT-LAC-PU', 'л', 980),
      mat(orgId, catByKind, 'Масло-воск', 'MAT-OIL-WX', 'л', 1240),
      mat(orgId, catByKind, 'Морилка рустик', 'MAT-STAIN', 'л', 760),
      mat(orgId, catByKind, 'Плёнка стрейч', 'CON-FILM', 'м', 18, ProductKind.CONSUMABLE),
      mat(orgId, catByKind, 'Коробка 2.2 м²', 'CON-BOX', 'шт', 45, ProductKind.CONSUMABLE),
      wip(orgId, catByKind, 'Щит дуб натуральный', 'WIP-OAK-NAT-B'),
      wip(orgId, catByKind, 'Профиль дуб натуральный', 'WIP-OAK-NAT-P'),
      wip(orgId, catByKind, 'Доска дуб натуральный под упаковку', 'WIP-OAK-NAT-C'),
      wip(orgId, catByKind, 'Щит дуб рустик', 'WIP-OAK-RUS-B'),
      wip(orgId, catByKind, 'Профиль дуб рустик', 'WIP-OAK-RUS-P'),
      wip(orgId, catByKind, 'Доска дуб рустик под упаковку', 'WIP-OAK-RUS-C'),
      wip(orgId, catByKind, 'Щит ясень беленый', 'WIP-ASH-WHT-B'),
      wip(orgId, catByKind, 'Профиль ясень беленый', 'WIP-ASH-WHT-P'),
      wip(orgId, catByKind, 'Доска ясень беленый под упаковку', 'WIP-ASH-WHT-C'),
      wip(orgId, catByKind, 'Щит инженерный дуб', 'WIP-ENG-OAK-B'),
      wip(orgId, catByKind, 'Профиль инженерный дуб', 'WIP-ENG-OAK-P'),
      wip(orgId, catByKind, 'Доска инженерная под упаковку', 'WIP-ENG-OAK-C'),
    ],
  })

  const products = await db.product.findMany({ where: { organizationId: orgId } })
  const bySku = Object.fromEntries(products.map((item) => [item.sku ?? item.id, item]))
  const p = (sku: string) => {
    const item = bySku[sku]
    if (!item) throw new Error(`Missing product ${sku}`)
    return item
  }

  await db.product.update({
    where: { id: p('PAR-OAK-NAT').id },
    data: {
      attributes: {
        create: attrs([
          ['Толщина', '14 мм'],
          ['Ширина', '190 мм'],
          ['Длина', '1860 мм'],
          ['Порода', 'Дуб'],
          ['Покрытие', 'Лак'],
          ['Сорт', 'Натур'],
        ]),
      },
    },
  })
  await db.product.update({
    where: { id: p('PAR-OAK-RUS').id },
    data: {
      attributes: {
        create: attrs([
          ['Толщина', '14 мм'],
          ['Ширина', '190 мм'],
          ['Длина', '1860 мм'],
          ['Порода', 'Дуб'],
          ['Покрытие', 'Масло-воск'],
          ['Сорт', 'Рустик'],
        ]),
      },
    },
  })
  await db.product.update({
    where: { id: p('PAR-ASH-WHT').id },
    data: {
      attributes: {
        create: attrs([
          ['Толщина', '14 мм'],
          ['Ширина', '130 мм'],
          ['Длина', '1200 мм'],
          ['Порода', 'Ясень'],
          ['Покрытие', 'Лак'],
          ['Сорт', 'Белёный'],
        ]),
      },
    },
  })
  await db.product.update({
    where: { id: p('ENG-OAK-SEL').id },
    data: {
      attributes: {
        create: attrs([
          ['Толщина', '15 мм'],
          ['Ширина', '150 мм'],
          ['Длина', '1800 мм'],
          ['Порода', 'Дуб'],
          ['Покрытие', 'Лак'],
          ['Сорт', 'Селект'],
        ]),
      },
    },
  })
  const extraAttrs: Record<string, [string, string][]> = {
    'PAR-OAK-HON': [
      ['Толщина', '14 мм'],
      ['Ширина', '190 мм'],
      ['Длина', '1860 мм'],
      ['Порода', 'Дуб'],
      ['Покрытие', 'Лак'],
      ['Сорт', 'Мёд'],
    ],
    'PAR-OAK-SMK': [
      ['Толщина', '14 мм'],
      ['Ширина', '190 мм'],
      ['Длина', '1860 мм'],
      ['Порода', 'Дуб'],
      ['Покрытие', 'Масло'],
      ['Сорт', 'Дымчатый'],
    ],
    'PAR-OAK-ESP': [
      ['Толщина', '14 мм'],
      ['Ширина', '130 мм'],
      ['Длина', '1200 мм'],
      ['Порода', 'Дуб'],
      ['Покрытие', 'Лак'],
      ['Сорт', 'Эспрессо'],
    ],
    'PAR-OAK-WDE': [
      ['Толщина', '14 мм'],
      ['Ширина', '220 мм'],
      ['Длина', '2200 мм'],
      ['Порода', 'Дуб'],
      ['Покрытие', 'Лак'],
      ['Сорт', 'Натур'],
    ],
    'PAR-OAK-HER': [
      ['Толщина', '14 мм'],
      ['Ширина', '90 мм'],
      ['Длина', '600 мм'],
      ['Порода', 'Дуб'],
      ['Покрытие', 'Лак'],
      ['Сорт', 'Ёлочка'],
    ],
    'PAR-WAL-NAT': [
      ['Толщина', '14 мм'],
      ['Ширина', '150 мм'],
      ['Длина', '1800 мм'],
      ['Порода', 'Орех'],
      ['Покрытие', 'Лак'],
      ['Сорт', 'Натур'],
    ],
    'PAR-ASH-NAT': [
      ['Толщина', '14 мм'],
      ['Ширина', '130 мм'],
      ['Длина', '1200 мм'],
      ['Порода', 'Ясень'],
      ['Покрытие', 'Лак'],
      ['Сорт', 'Натур'],
    ],
    'ENG-OAK-RUS': [
      ['Толщина', '15 мм'],
      ['Ширина', '150 мм'],
      ['Длина', '1800 мм'],
      ['Порода', 'Дуб'],
      ['Покрытие', 'Масло'],
      ['Сорт', 'Рустик'],
    ],
    'ENG-ASH-WHT': [
      ['Толщина', '15 мм'],
      ['Ширина', '130 мм'],
      ['Длина', '1800 мм'],
      ['Порода', 'Ясень'],
      ['Покрытие', 'Лак'],
      ['Сорт', 'Белёный'],
    ],
  }
  for (const [sku, rows] of Object.entries(extraAttrs)) {
    await db.product.update({
      where: { id: p(sku).id },
      data: { attributes: { create: attrs(rows) } },
    })
  }

  await attachCatalogImages(db, orgId, p)

  const warehouse = await db.warehouse.create({
    data: {
      organizationId: orgId,
      name: 'Склад цеха',
      address: '156000, г. Кострома, ул. Советская, д. 48, лит. Б',
      createdAt: at(1, 1, 8),
    },
  })

  await db.counterparty.createMany({
    data: [
      party(orgId, {
        name: 'ООО «Кострома Лес»',
        legalName: 'ООО «Кострома Лес»',
        inn: '4401123001',
        kpp: '440101001',
        ogrn: '1024400001001',
        legalAddress: '156009, г. Кострома, ул. Лесная, д. 3',
        email: 'sales@kostroma-les.example',
        phone: '+7 4942 30-11-20',
        contactName: 'Алексей Белов',
        notes: 'Фанера и шпон.',
      }),
      party(orgId, {
        name: 'ООО «Химпром Поволжье»',
        legalName: 'ООО «Химпром Поволжье»',
        inn: '6317004401',
        kpp: '631701001',
        ogrn: '1026300004401',
        legalAddress: '443010, г. Самара, ул. Гагарина, д. 15',
        email: 'order@himpovol.example',
        phone: '+7 846 200-40-18',
        contactName: 'Марина Круглова',
        notes: 'Клей, лак, масло.',
      }),
      party(orgId, {
        name: 'ИП Картонов С.П.',
        legalName: 'ИП Картонов Сергей Петрович',
        inn: '440200550088',
        legalAddress: '156000, г. Кострома, ул. Полянская, д. 7',
        email: 'pack@kartonov.example',
        phone: '+7 910 192-00-44',
        contactName: 'Сергей Картонов',
        notes: 'Коробки и стрейч.',
      }),
      party(orgId, {
        name: 'ООО «Север»',
        legalName: 'ООО «Север»',
        inn: '7701234567',
        kpp: '770101001',
        ogrn: '1027700132195',
        legalAddress: '101000, г. Москва, ул. Мясницкая, д. 24',
        email: 'zakaz@sever.example',
        phone: '+7 495 111-22-33',
        telegram: 'sever_zakup',
        contactName: 'Дмитрий Орлов',
        notes: 'Дилер, Москва.',
      }),
      party(orgId, {
        name: 'АО «Волга Трейд»',
        legalName: 'АО «Волга Трейд»',
        inn: '6317081234',
        kpp: '631701001',
        ogrn: '1026301417523',
        legalAddress: '443010, г. Самара, ул. Куйбышева, д. 88',
        email: 'office@volga-trade.example',
        phone: '+7 846 333-10-10',
        contactName: 'Ольга Шанина',
        notes: 'Дилер ПФО.',
      }),
      party(orgId, {
        name: 'ИП Козлова А.В.',
        legalName: 'ИП Козлова Анна Викторовна',
        inn: '770200044401',
        legalAddress: '420111, г. Казань, ул. Баумана, д. 9',
        email: 'kozlova@example.ru',
        phone: '+7 917 555-01-02',
        contactName: 'Анна Козлова',
      }),
      party(orgId, {
        name: 'ООО «Дом и Пол»',
        legalName: 'ООО «Дом и Пол»',
        inn: '7704555001',
        kpp: '770401001',
        ogrn: '1027700455001',
        legalAddress: '119019, г. Москва, ул. Арбат, д. 16',
        email: 'zakup@domipol.example',
        phone: '+7 495 640-18-90',
        contactName: 'Кирилл Малов',
        notes: 'Салон на Арбате.',
      }),
      party(orgId, {
        name: 'ООО «СтройГрад»',
        legalName: 'ООО «СтройГрад»',
        inn: '7728123400',
        kpp: '772801001',
        ogrn: '1027702812340',
        legalAddress: '117292, г. Москва, ул. Профсоюзная, д. 26',
        email: 'objects@stroygrad.example',
        phone: '+7 495 980-22-01',
        contactName: 'Никита Жуков',
        notes: 'Подрядчик ЖК.',
      }),
      party(orgId, {
        name: 'ООО «Паркет Холл»',
        legalName: 'ООО «Паркет Холл»',
        inn: '7810440012',
        kpp: '781001001',
        ogrn: '1027800440012',
        legalAddress: '191186, г. Санкт-Петербург, Невский пр., д. 40',
        email: 'opt@parket-hall.example',
        phone: '+7 812 448-00-31',
        contactName: 'Екатерина Львова',
      }),
      party(orgId, {
        name: 'ООО «ПолМастер»',
        legalName: 'ООО «ПолМастер»',
        inn: '6671234001',
        kpp: '667101001',
        ogrn: '1026601234001',
        legalAddress: '620014, г. Екатеринбург, ул. 8 Марта, д. 12',
        email: 'zakup@polmaster.example',
        phone: '+7 343 310-22-80',
        contactName: 'Роман Ильин',
        notes: 'Салон, Урал.',
      }),
      party(orgId, {
        name: 'ООО «Сибирский Паркет»',
        legalName: 'ООО «Сибирский Паркет»',
        inn: '5402123008',
        kpp: '540201001',
        ogrn: '1025402123008',
        legalAddress: '630099, г. Новосибирск, Красный пр., д. 25',
        email: 'opt@sibparket.example',
        phone: '+7 383 209-14-50',
        contactName: 'Наталья Гришина',
      }),
      party(orgId, {
        name: 'ИП Морозов Д.И.',
        legalName: 'ИП Морозов Дмитрий Игоревич',
        inn: '760300441201',
        legalAddress: '150000, г. Ярославль, ул. Свободы, д. 8',
        email: 'morozov-pol@example.ru',
        phone: '+7 910 812-30-14',
        contactName: 'Дмитрий Морозов',
      }),
      party(orgId, {
        name: 'ООО «Интерьер 52»',
        legalName: 'ООО «Интерьер 52»',
        inn: '5206555011',
        kpp: '520601001',
        ogrn: '1025206555011',
        legalAddress: '603000, г. Нижний Новгород, ул. Большая Покровская, д. 18',
        email: 'hello@interior52.example',
        phone: '+7 831 422-09-17',
        contactName: 'Светлана Панова',
      }),
      party(orgId, {
        name: 'ООО «АртПол»',
        legalName: 'ООО «АртПол»',
        inn: '2307888002',
        kpp: '230701001',
        ogrn: '1022307888002',
        legalAddress: '350000, г. Краснодар, ул. Красная, д. 70',
        email: 'order@artpol.example',
        phone: '+7 861 210-44-03',
        contactName: 'Артём Власов',
      }),
      party(orgId, {
        name: 'ЗАО «Евростиль»',
        legalName: 'ЗАО «Евростиль»',
        inn: '7703999110',
        kpp: '770301001',
        ogrn: '1027703999110',
        legalAddress: '123001, г. Москва, ул. Садовая-Кудринская, д. 11',
        email: 'procurement@evrostil.example',
        phone: '+7 495 787-01-40',
        contactName: 'Ирина Фролова',
        notes: 'Сеть салонов.',
      }),
      party(orgId, {
        name: 'ООО «СтройКом»',
        legalName: 'ООО «СтройКом»',
        inn: '1658012300',
        kpp: '165801001',
        ogrn: '1021608012300',
        legalAddress: '420111, г. Казань, ул. Пушкина, д. 31',
        email: 'objects@stroykom.example',
        phone: '+7 843 567-22-10',
        contactName: 'Марат Хабибуллин',
        notes: 'Подрядчик, Татарстан.',
      }),
      party(orgId, {
        name: 'ИП Беляева О.С.',
        legalName: 'ИП Беляева Ольга Сергеевна',
        inn: '710255508812',
        legalAddress: '300041, г. Тула, пр. Ленина, д. 46',
        email: 'belyaeva.pol@example.ru',
        phone: '+7 953 190-08-21',
        contactName: 'Ольга Беляева',
      }),
      party(orgId, {
        name: 'ООО «Лесной Дом»',
        legalName: 'ООО «Лесной Дом»',
        inn: '6901444003',
        kpp: '690101001',
        ogrn: '1026901444003',
        legalAddress: '170100, г. Тверь, ул. Советская, д. 21',
        email: 'sales@lesdom.example',
        phone: '+7 4822 35-40-18',
        contactName: 'Пётр Савельев',
      }),
      party(orgId, {
        name: 'ООО «Квартал Плюс»',
        legalName: 'ООО «Квартал Плюс»',
        inn: '6167002201',
        kpp: '616701001',
        ogrn: '1026107002201',
        legalAddress: '344002, г. Ростов-на-Дону, ул. Большая Садовая, д. 47',
        email: 'zakup@kvartalplus.example',
        phone: '+7 863 250-19-70',
        contactName: 'Елена Донская',
      }),
    ],
  })

  const parties = await db.counterparty.findMany({ where: { organizationId: orgId } })
  const partyByInn = Object.fromEntries(parties.map((item) => [item.inn, item]))
  const c = (inn: string) => {
    const item = partyByInn[inn]
    if (!item) throw new Error(`Missing counterparty ${inn}`)
    return item
  }

  const lines: LineSpec[] = [
    {
      name: 'Дуб натуральный',
      finishedSku: 'PAR-OAK-NAT',
      board: 'WIP-OAK-NAT-B',
      profile: 'WIP-OAK-NAT-P',
      coated: 'WIP-OAK-NAT-C',
      veneer: 'MAT-VEN-OAK',
      finish: [{ sku: 'MAT-LAC-PU', qty: 0.11 }],
    },
    {
      name: 'Дуб рустик',
      finishedSku: 'PAR-OAK-RUS',
      board: 'WIP-OAK-RUS-B',
      profile: 'WIP-OAK-RUS-P',
      coated: 'WIP-OAK-RUS-C',
      veneer: 'MAT-VEN-OAK',
      finish: [
        { sku: 'MAT-STAIN', qty: 0.08 },
        { sku: 'MAT-OIL-WX', qty: 0.1 },
      ],
    },
    {
      name: 'Ясень беленый',
      finishedSku: 'PAR-ASH-WHT',
      board: 'WIP-ASH-WHT-B',
      profile: 'WIP-ASH-WHT-P',
      coated: 'WIP-ASH-WHT-C',
      veneer: 'MAT-VEN-ASH',
      finish: [{ sku: 'MAT-LAC-PU', qty: 0.12 }],
    },
    {
      name: 'Инженерная дуб селект',
      finishedSku: 'ENG-OAK-SEL',
      board: 'WIP-ENG-OAK-B',
      profile: 'WIP-ENG-OAK-P',
      coated: 'WIP-ENG-OAK-C',
      veneer: 'MAT-VEN-OAK',
      plywoodQty: 1.12,
      glueQty: 0.4,
      finish: [{ sku: 'MAT-LAC-PU', qty: 0.13 }],
    },
  ]

  const types: Record<string, Awaited<ReturnType<typeof createLineType>>> = {}
  for (const line of lines) {
    types[line.finishedSku] = await createLineType(db, orgId, warehouse.id, p, line)
  }

  await db.stockMovement.createMany({
    data: [
      rec(warehouse.id, p('PAR-OAK-NAT').id, 160, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('PAR-OAK-RUS').id, 85, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('PAR-ASH-WHT').id, 55, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('ENG-OAK-SEL').id, 40, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('PLI-OAK-80').id, 220, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('PLI-OAK-60').id, 140, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('PLI-ASH-80').id, 90, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('THR-OAK').id, 75, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('UND-CORK-2').id, 300, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('UND-XPS').id, 180, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('OIL-CARE').id, 48, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('PAR-OAK-HON').id, 70, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('PAR-OAK-SMK').id, 48, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('PAR-OAK-ESP').id, 42, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('PAR-OAK-WDE').id, 36, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('PAR-OAK-HER').id, 28, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('PAR-WAL-NAT').id, 24, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('PAR-ASH-NAT').id, 50, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('ENG-OAK-RUS').id, 32, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('ENG-ASH-WHT').id, 30, 'Остаток на 01.01.2026', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('MAT-PLY-8').id, 2800, 'Остаток сырья', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('MAT-VEN-OAK').id, 1900, 'Остаток сырья', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('MAT-VEN-ASH').id, 620, 'Остаток сырья', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('MAT-GLUE-PU').id, 540, 'Остаток сырья', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('MAT-LAC-PU').id, 160, 'Остаток сырья', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('MAT-OIL-WX').id, 70, 'Остаток сырья', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('MAT-STAIN').id, 35, 'Остаток сырья', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('CON-FILM').id, 4200, 'Остаток сырья', storeId, at(1, 1, 8)),
      rec(warehouse.id, p('CON-BOX').id, 640, 'Остаток сырья', storeId, at(1, 1, 8)),
    ],
  })

  const purchases: PurchaseSpec[] = [
    {
      number: 'ЗК-2026-01',
      title: 'Фанера и шпон дуба, январь',
      inn: '4401123001',
      status: PurchaseStatus.POSTED,
      at: at(1, 15, 11),
      items: [
        { sku: 'MAT-PLY-8', qty: 420, price: 890 },
        { sku: 'MAT-VEN-OAK', qty: 260, price: 1450 },
      ],
      doc: { title: 'Счёт поставщика', number: 'СЧ-1402', issuedAt: at(1, 12, 12) },
    },
    {
      number: 'ЗК-2026-02',
      title: 'Клей и лак, февраль',
      inn: '6317004401',
      status: PurchaseStatus.POSTED,
      at: at(2, 10, 12),
      items: [
        { sku: 'MAT-GLUE-PU', qty: 80, price: 420 },
        { sku: 'MAT-LAC-PU', qty: 40, price: 980 },
      ],
      doc: { title: 'УПД', number: 'УПД-208', issuedAt: at(2, 10, 12) },
    },
    {
      number: 'ЗК-2026-03',
      title: 'Шпон ясеня и коробки',
      inn: '4401123001',
      status: PurchaseStatus.POSTED,
      at: at(3, 6, 10),
      items: [
        { sku: 'MAT-VEN-ASH', qty: 180, price: 1380 },
        { sku: 'MAT-PLY-8', qty: 200, price: 890 },
      ],
    },
    {
      number: 'ЗК-2026-04',
      title: 'Упаковка, март',
      inn: '440200550088',
      status: PurchaseStatus.POSTED,
      at: at(3, 18, 14),
      items: [
        { sku: 'CON-BOX', qty: 180, price: 45 },
        { sku: 'CON-FILM', qty: 800, price: 18 },
      ],
    },
    {
      number: 'ЗК-2026-05',
      title: 'Масло и морилка',
      inn: '6317004401',
      status: PurchaseStatus.POSTED,
      at: at(4, 9, 11),
      items: [
        { sku: 'MAT-OIL-WX', qty: 24, price: 1240 },
        { sku: 'MAT-STAIN', qty: 16, price: 760 },
        { sku: 'MAT-LAC-PU', qty: 30, price: 980 },
      ],
    },
    {
      number: 'ЗК-2026-06',
      title: 'Фанера и шпон, май',
      inn: '4401123001',
      status: PurchaseStatus.POSTED,
      at: at(5, 14, 10),
      items: [
        { sku: 'MAT-PLY-8', qty: 380, price: 910 },
        { sku: 'MAT-VEN-OAK', qty: 240, price: 1480 },
      ],
    },
    {
      number: 'ЗК-2026-07',
      title: 'Подложка и плинтус',
      inn: '6317081234',
      status: PurchaseStatus.POSTED,
      at: at(6, 4, 12),
      items: [
        { sku: 'UND-CORK-2', qty: 200, price: 165 },
        { sku: 'PLI-OAK-80', qty: 120, price: 510 },
      ],
    },
    {
      number: 'ЗК-2026-08',
      title: 'Сырьё на июль',
      inn: '4401123001',
      status: PurchaseStatus.POSTED,
      at: at(7, 8, 11),
      items: [
        { sku: 'MAT-PLY-8', qty: 300, price: 910 },
        { sku: 'MAT-VEN-OAK', qty: 180, price: 1480 },
        { sku: 'MAT-VEN-ASH', qty: 90, price: 1390 },
      ],
    },
    {
      number: 'ЗК-2026-09',
      title: 'Клей и лак, август',
      inn: '6317004401',
      status: PurchaseStatus.POSTED,
      at: at(8, 12, 10),
      items: [
        { sku: 'MAT-GLUE-PU', qty: 60, price: 430 },
        { sku: 'MAT-LAC-PU', qty: 28, price: 990 },
      ],
      doc: { title: 'Счёт', number: 'СЧ-8811', issuedAt: at(8, 10, 12) },
    },
    {
      number: 'ЗК-2026-10',
      title: 'Коробки на сентябрь',
      inn: '440200550088',
      status: PurchaseStatus.DRAFT,
      at: at(8, 28, 16),
      items: [
        { sku: 'CON-BOX', qty: 150, price: 47 },
        { sku: 'CON-FILM', qty: 600, price: 18 },
      ],
    },
    {
      number: 'ЗК-2026-11',
      title: 'Шпон дуба, заявка',
      inn: '4401123001',
      status: PurchaseStatus.DRAFT,
      at: at(8, 29, 11),
      items: [{ sku: 'MAT-VEN-OAK', qty: 120, price: 1480 }],
    },
    {
      number: 'ЗК-2026-12',
      title: 'Плинтус, пороги и уход',
      inn: '6317081234',
      status: PurchaseStatus.POSTED,
      at: at(6, 20, 11),
      items: [
        { sku: 'PLI-OAK-60', qty: 80, price: 420 },
        { sku: 'THR-OAK', qty: 40, price: 310 },
        { sku: 'OIL-CARE', qty: 24, price: 890 },
        { sku: 'UND-XPS', qty: 120, price: 95 },
      ],
    },
  ]

  for (const row of purchases) {
    const created = await db.purchase.create({
      data: {
        organizationId: orgId,
        number: row.number,
        title: row.title,
        counterpartyId: c(row.inn).id,
        warehouseId: warehouse.id,
        status: row.status,
        purchasedAt: row.at,
        createdById: storeId,
        createdAt: row.at,
        updatedAt: row.at,
        note: row.status === PurchaseStatus.POSTED ? 'Проведено на склад цеха' : 'Черновик, ждём поставку',
        items: {
          create: row.items.map((item) => ({
            productId: p(item.sku).id,
            name: p(item.sku).name,
            quantity: item.qty,
            unit: p(item.sku).unit,
            price: item.price,
          })),
        },
        documents: row.doc
          ? { create: { title: row.doc.title, number: row.doc.number, issuedAt: row.doc.issuedAt } }
          : undefined,
      },
    })
    if (row.status === PurchaseStatus.POSTED) {
      await db.stockMovement.createMany({
        data: row.items.map((item) =>
          rec(warehouse.id, p(item.sku).id, item.qty, `Закупка ${row.number}`, storeId, row.at, created.id),
        ),
      })
    }
  }

  const deals: DealSpec[] = [
    {
      inn: '7701234567',
      title: 'Дуб натур, шоурум «Север»',
      status: DealStatus.CLOSED,
      created: at(1, 14, 11),
      updated: at(2, 3, 16),
      due: at(2, 5, 12),
      items: [
        { sku: 'PAR-OAK-NAT', qty: 86 },
        { sku: 'PLI-OAK-80', qty: 42 },
      ],
      production: { sku: 'PAR-OAK-NAT', done: at(1, 28, 15) },
      ship: at(2, 3, 11),
    },
    {
      inn: '6317081234',
      title: 'Рустик для салона в Самаре',
      status: DealStatus.CLOSED,
      created: at(2, 4, 10),
      updated: at(3, 2, 17),
      due: at(3, 6, 12),
      items: [{ sku: 'PAR-OAK-RUS', qty: 64 }],
      production: { sku: 'PAR-OAK-RUS', done: at(2, 20, 14) },
      ship: at(2, 27, 10),
    },
    {
      inn: '7810440012',
      title: 'Ясень беленый, Паркет Холл',
      status: DealStatus.CLOSED,
      created: at(3, 11, 9),
      updated: at(4, 8, 15),
      due: at(4, 10, 12),
      items: [
        { sku: 'PAR-ASH-WHT', qty: 48 },
        { sku: 'UND-CORK-2', qty: 48 },
      ],
      production: { sku: 'PAR-ASH-WHT', done: at(3, 26, 16) },
      ship: at(4, 7, 11),
    },
    {
      inn: '7728123400',
      title: 'ЖК «Речной», корпус 2',
      status: DealStatus.DELIVERED,
      created: at(4, 2, 11),
      updated: at(5, 20, 14),
      due: at(5, 18, 12),
      items: [
        { sku: 'PAR-OAK-NAT', qty: 210 },
        { sku: 'PLI-OAK-80', qty: 96 },
        { sku: 'UND-CORK-2', qty: 210 },
      ],
      production: { sku: 'PAR-OAK-NAT', done: at(5, 6, 17) },
      ship: at(5, 19, 9),
    },
    {
      inn: '7704555001',
      title: 'Инженерная селект, Арбат',
      status: DealStatus.DELIVERED,
      created: at(5, 12, 10),
      updated: at(6, 16, 13),
      due: at(6, 20, 12),
      items: [{ sku: 'ENG-OAK-SEL', qty: 72 }],
      production: { sku: 'ENG-OAK-SEL', done: at(6, 4, 15) },
      ship: at(6, 15, 10),
    },
    {
      inn: '7701234567',
      title: 'Довоз дуб натур, июль',
      status: DealStatus.DELIVERED,
      created: at(6, 18, 12),
      updated: at(7, 22, 16),
      due: at(7, 25, 12),
      items: [{ sku: 'PAR-OAK-NAT', qty: 54 }],
      production: { sku: 'PAR-OAK-NAT', done: at(7, 10, 14) },
      ship: at(7, 21, 11),
    },
    {
      inn: '6317081234',
      title: 'Рустик, партия на Казань',
      status: DealStatus.RETURNED,
      created: at(6, 3, 11),
      updated: at(7, 9, 10),
      due: at(6, 28, 12),
      items: [{ sku: 'PAR-OAK-RUS', qty: 32 }],
      production: { sku: 'PAR-OAK-RUS', done: at(6, 18, 16) },
      ship: at(6, 25, 12),
      note: 'Вернули: не совпал тон с объектом.',
    },
    {
      inn: '7810440012',
      title: 'Ясень, витрина Невский',
      status: DealStatus.TO_DELIVERY,
      created: at(7, 14, 10),
      updated: at(8, 20, 15),
      due: at(9, 4, 12),
      items: [
        { sku: 'PAR-ASH-WHT', qty: 40 },
        { sku: 'PLI-OAK-80', qty: 24 },
      ],
      production: { sku: 'PAR-ASH-WHT', done: at(8, 12, 16) },
    },
    {
      inn: '7704555001',
      title: 'Дуб натур + подложка, салон',
      status: DealStatus.TO_DELIVERY,
      created: at(8, 4, 11),
      updated: at(8, 26, 12),
      due: at(9, 8, 12),
      items: [
        { sku: 'PAR-OAK-NAT', qty: 38 },
        { sku: 'UND-CORK-2', qty: 40 },
      ],
      production: { sku: 'PAR-OAK-NAT', done: at(8, 21, 15) },
    },
    {
      inn: '7728123400',
      title: 'ЖК «Речной», корпус 3',
      status: DealStatus.SHIPPED_TO_WAREHOUSE,
      created: at(7, 22, 9),
      updated: at(8, 25, 17),
      due: at(9, 10, 12),
      items: [{ sku: 'PAR-OAK-NAT', qty: 120 }],
      production: { sku: 'PAR-OAK-NAT', done: at(8, 25, 17) },
    },
    {
      inn: '770200044401',
      title: 'Инженерная, частный дом',
      status: DealStatus.SHIPPED_TO_WAREHOUSE,
      created: at(8, 6, 12),
      updated: at(8, 28, 14),
      due: at(9, 12, 12),
      items: [
        { sku: 'ENG-OAK-SEL', qty: 28 },
        { sku: 'PLI-OAK-80', qty: 18 },
      ],
      production: { sku: 'ENG-OAK-SEL', done: at(8, 27, 16) },
    },
    {
      inn: '7701234567',
      title: 'Рустик под заказ, Север',
      status: DealStatus.TO_PRODUCTION,
      created: at(8, 11, 10),
      updated: at(8, 27, 11),
      due: at(9, 18, 12),
      items: [{ sku: 'PAR-OAK-RUS', qty: 46 }],
      production: { sku: 'PAR-OAK-RUS', stageIndex: 2, stageStatus: ProductionStageStatus.IN_PROGRESS, started: at(8, 18, 9) },
    },
    {
      inn: '6317081234',
      title: 'Ясень, дилер Самара',
      status: DealStatus.TO_PRODUCTION,
      created: at(8, 14, 11),
      updated: at(8, 28, 10),
      due: at(9, 22, 12),
      items: [{ sku: 'PAR-ASH-WHT', qty: 36 }],
      production: { sku: 'PAR-ASH-WHT', stageIndex: 1, stageStatus: ProductionStageStatus.IN_PROGRESS, started: at(8, 20, 8) },
    },
    {
      inn: '7728123400',
      title: 'Дуб натур, квартира на Профсоюзной',
      status: DealStatus.TO_PRODUCTION,
      created: at(8, 19, 15),
      updated: at(8, 29, 9),
      due: at(9, 25, 12),
      items: [{ sku: 'PAR-OAK-NAT', qty: 22 }],
      production: { sku: 'PAR-OAK-NAT', stageIndex: 0, stageStatus: ProductionStageStatus.TO_START, started: at(8, 29, 9) },
    },
    {
      inn: '7704555001',
      title: 'Инженерная селект, витрина',
      status: DealStatus.TO_PRODUCTION,
      created: at(8, 21, 12),
      updated: at(8, 30, 10),
      due: at(9, 28, 12),
      items: [{ sku: 'ENG-OAK-SEL', qty: 18 }],
      production: { sku: 'ENG-OAK-SEL', stageIndex: 3, stageStatus: ProductionStageStatus.IN_PROGRESS, started: at(8, 24, 8) },
    },
    {
      inn: '7810440012',
      title: 'Дуб натур, предоплата получена',
      status: DealStatus.PAID,
      created: at(8, 18, 11),
      updated: at(8, 26, 16),
      due: at(9, 15, 12),
      items: [
        { sku: 'PAR-OAK-NAT', qty: 60 },
        { sku: 'UND-CORK-2', qty: 60 },
      ],
    },
    {
      inn: '770200044401',
      title: 'Плинтус и подложка, Казань',
      status: DealStatus.PAID,
      created: at(8, 22, 14),
      updated: at(8, 27, 12),
      due: at(9, 5, 12),
      items: [
        { sku: 'PLI-OAK-80', qty: 30 },
        { sku: 'UND-CORK-2', qty: 24 },
      ],
    },
    {
      inn: '7701234567',
      title: 'Счёт на рустик, 90 м²',
      status: DealStatus.INVOICE_ISSUED,
      created: at(8, 20, 10),
      updated: at(8, 25, 11),
      due: at(9, 12, 12),
      items: [{ sku: 'PAR-OAK-RUS', qty: 90 }],
    },
    {
      inn: '6317081234',
      title: 'Инженерная, счёт дилеру',
      status: DealStatus.INVOICE_ISSUED,
      created: at(8, 25, 13),
      updated: at(8, 28, 9),
      due: at(9, 20, 12),
      items: [{ sku: 'ENG-OAK-SEL', qty: 44 }],
    },
    {
      inn: '7704555001',
      title: 'Подбор ясеня для гостиной',
      status: DealStatus.IN_PROGRESS,
      created: at(8, 24, 12),
      updated: at(8, 29, 16),
      due: at(9, 8, 12),
      items: [{ sku: 'PAR-ASH-WHT', qty: 26 }],
    },
    {
      inn: '7728123400',
      title: 'Спецификация на корпус 4',
      status: DealStatus.IN_PROGRESS,
      created: at(8, 26, 11),
      updated: at(8, 30, 15),
      due: at(8, 20, 12),
      items: [
        { sku: 'PAR-OAK-NAT', qty: 180 },
        { sku: 'PLI-OAK-80', qty: 80 },
      ],
    },
    {
      inn: '7810440012',
      title: 'Запрос на дуб селект, СПб',
      status: DealStatus.NEW,
      created: at(8, 28, 10),
      updated: at(8, 28, 10),
      due: at(9, 18, 12),
      items: [{ sku: 'ENG-OAK-SEL', qty: 50 }],
    },
    {
      inn: '770200044401',
      title: 'Небольшой заказ, дуб натур 12 м²',
      status: DealStatus.NEW,
      created: at(8, 30, 17),
      updated: at(8, 30, 17),
      due: at(9, 14, 12),
      items: [
        { sku: 'PAR-OAK-NAT', qty: 12 },
        { sku: 'UND-CORK-2', qty: 12 },
      ],
    },
  ]
  deals.push(...expandSalesDeals(deals))

  const statusPos: Partial<Record<DealStatus, number>> = {}
  for (const spec of deals) {
    statusPos[spec.status] = (statusPos[spec.status] ?? 0) + 1000
    const counterparty = c(spec.inn)
    const type = spec.production ? types[spec.production.sku] : undefined
    const itemStatus = spec.production
      ? spec.production.done
        ? DealItemProductionStatus.IN_WAREHOUSE
        : DealItemProductionStatus.IN_PRODUCTION
      : DealItemProductionStatus.NONE

    const deal = await db.deal.create({
      data: {
        organizationId: orgId,
        counterpartyId: counterparty.id,
        createdById: managerId,
        title: spec.title,
        description: spec.note,
        status: spec.status,
        position: statusPos[spec.status] ?? 1000,
        dueDate: spec.due,
        createdAt: spec.created,
        updatedAt: spec.updated,
        items: {
          create: spec.items.map((item) => ({
            productId: p(item.sku).id,
            name: p(item.sku).name,
            quantity: item.qty,
            unit: p(item.sku).unit,
            price: p(item.sku).price,
            productionStatus: item.sku === spec.production?.sku ? itemStatus : DealItemProductionStatus.NONE,
          })),
        },
        events: {
          create: [
            { text: 'Сделка создана', createdAt: spec.created },
            ...(spec.production
              ? [{ text: `${shopName} передал в производство: ${p(spec.production.sku).name}`, createdAt: spec.production.started ?? spec.created }]
              : []),
            ...(spec.production?.done
              ? [
                  {
                    text: `${shopName} завершил производство: ${p(spec.production.sku).name}. Продукция на складе`,
                    createdAt: spec.production.done,
                  },
                ]
              : []),
            ...(spec.ship ? [{ text: 'Отгружено со склада', createdAt: spec.ship }] : []),
          ],
        },
        messages:
          spec.status === DealStatus.IN_PROGRESS || spec.status === DealStatus.NEW
            ? {
                create: {
                  channel: DealChannel.EMAIL,
                  direction: DealMessageDirection.IN,
                  body: `Добрый день. Подтвердите наличие и срок по позиции «${spec.title}».`,
                  authorId: managerId,
                  createdAt: spec.created,
                },
              }
            : undefined,
      },
      include: { items: true },
    })

    if (spec.production && type) {
      const dealItem = deal.items.find((item) => item.productId === p(spec.production!.sku).id)
      if (!dealItem) throw new Error(`Deal item missing for ${spec.production.sku}`)
      const done = Boolean(spec.production.done)
      const stageIndex = done ? type.stages.length - 1 : (spec.production.stageIndex ?? 0)
      const stage = type.stages[stageIndex]
      const jobStatus = done ? ProductionJobStatus.DONE : ProductionJobStatus.ACTIVE
      const stageStatus = done
        ? ProductionStageStatus.IN_PROGRESS
        : (spec.production.stageStatus ?? ProductionStageStatus.TO_START)
      const started = spec.production.started ?? spec.created
      const job = await db.productionJob.create({
        data: {
          organizationId: orgId,
          typeId: type.id,
          stageId: stage.id,
          warehouseId: warehouse.id,
          dealId: deal.id,
          dealItemId: dealItem.id,
          title: `${deal.title} · ${dealItem.name}`,
          quantity: dealItem.quantity,
          status: jobStatus,
          stageStatus,
          position: (stageIndex + 1) * 1000,
          createdById: shopId,
          createdAt: started,
          updatedAt: spec.production.done ?? spec.updated,
        },
      })
      const completedCount = done ? type.stages.length : stageIndex
      for (let i = 0; i < completedCount; i++) {
        const day = addDays(started, i * 2 + 1)
        await writeStageMovements(db, {
          warehouseId: warehouse.id,
          jobId: job.id,
          createdById: shopId,
          title: job.title,
          quantity: job.quantity,
          stage: type.stages[i],
          at: spec.production.done && i === type.stages.length - 1 ? spec.production.done : day,
        })
      }
    }

    if (spec.ship) {
      for (const item of spec.items) {
        const product = p(item.sku)
        if (product.kind !== ProductKind.FINISHED) continue
        await db.stockMovement.create({
          data: {
            warehouseId: warehouse.id,
            productId: product.id,
            type: StockMovementType.WRITEOFF,
            quantity: item.qty,
            note: `Отгрузка · ${spec.title}`,
            createdById: storeId,
            createdAt: spec.ship,
          },
        })
        if (spec.status === DealStatus.RETURNED) {
          await db.stockMovement.create({
            data: {
              warehouseId: warehouse.id,
              productId: product.id,
              type: StockMovementType.RECEIPT,
              quantity: item.qty,
              note: `Возврат · ${spec.title}`,
              createdById: storeId,
              createdAt: spec.updated,
            },
          })
        }
      }
    }
  }

  await db.task.createMany({
    data: [
      taskRow(orgId, ownerId, TaskBoard.PERSONAL, TaskStatus.NEW, 1000, 'Согласовать тон рустика с «Севером»', at(8, 29)),
      taskRow(orgId, ownerId, TaskBoard.PERSONAL, TaskStatus.NEW, 2000, 'Ответить Евростилю по ёлочке', at(8, 30)),
      taskRow(orgId, ownerId, TaskBoard.PERSONAL, TaskStatus.NEW, 3000, 'Проверить прайс на орех', at(8, 31, 8)),
      taskRow(orgId, ownerId, TaskBoard.PERSONAL, TaskStatus.IN_PROGRESS, 1000, 'Закрыть сверку с Кострома Лес', at(8, 20)),
      taskRow(orgId, ownerId, TaskBoard.PERSONAL, TaskStatus.IN_PROGRESS, 2000, 'Собрать отчёт по марже за август', at(8, 26)),
      taskRow(orgId, ownerId, TaskBoard.PERSONAL, TaskStatus.IN_PROGRESS, 3000, 'Согласовать скидку 8% ПолМастеру', at(8, 27)),
      taskRow(orgId, ownerId, TaskBoard.PERSONAL, TaskStatus.DONE, 1000, 'Подписать договор на корпус 3', at(8, 12)),
      taskRow(orgId, ownerId, TaskBoard.PERSONAL, TaskStatus.DONE, 2000, 'Назначить показ салону в Туле', at(8, 8)),
      taskRow(orgId, ownerId, TaskBoard.PERSONAL, TaskStatus.DONE, 3000, 'Проверить акт с СтройГрадом', at(8, 28)),
      taskRow(orgId, ownerId, TaskBoard.ORGANIZATION, TaskStatus.NEW, 1000, 'Просчитать корпус 4 ЖК «Речной»', at(8, 30), 'Нужна спецификация: дуб натур + плинтус.'),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.NEW, 2000, 'Собрать КП для Евростиля, 140 м²', at(8, 29), 'Ёлочка дуб + пороги.'),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.NEW, 3000, 'Уточнить замер у ИП Беляевой', at(8, 30)),
      taskRow(orgId, shopId, TaskBoard.ORGANIZATION, TaskStatus.NEW, 4000, 'Заказать фрезы под широкий формат 220', at(8, 28)),
      taskRow(orgId, storeId, TaskBoard.ORGANIZATION, TaskStatus.NEW, 5000, 'Разметить ячейки под орех и эспрессо', at(8, 29)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.NEW, 6000, 'Подготовить образцы дымчатого для АртПола', at(8, 31, 9)),
      taskRow(orgId, ownerId, TaskBoard.ORGANIZATION, TaskStatus.NEW, 7000, 'Сверить остатки ёлочки перед сентябрём', at(8, 31, 10)),
      taskRow(orgId, shopId, TaskBoard.ORGANIZATION, TaskStatus.NEW, 8000, 'План смены на первую неделю сентября', at(8, 30)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.NEW, 9000, 'Согласовать доставку в Тулу, ИП Беляева', at(8, 31, 11)),
      taskRow(orgId, shopId, TaskBoard.ORGANIZATION, TaskStatus.NEW, 10000, 'Запросить образцы ореха с линии', at(8, 30, 14)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.NEW, 11000, 'Закрыть счёт Интерьеру 52', at(8, 29, 16)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.NEW, 12000, 'Проверить заявку Квартал Плюс на сентябрь', at(8, 31, 9)),
      taskRow(orgId, ownerId, TaskBoard.ORGANIZATION, TaskStatus.NEW, 13000, 'Назначить показ в салоне ПолМастер', at(8, 30, 12)),
      taskRow(orgId, shopId, TaskBoard.ORGANIZATION, TaskStatus.NEW, 14000, 'Уточнить влажность партии эспрессо', at(8, 28, 15)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.NEW, 15000, 'Собрать спецификацию офиса на Садовой', at(8, 31, 13)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.NEW, 16000, 'Ответить СтройГраду по корпусу 5', at(8, 29, 8)),
      taskRow(orgId, shopId, TaskBoard.ORGANIZATION, TaskStatus.APPROVAL, 1000, 'Смена лака на партию ясеня', at(8, 28)),
      taskRow(orgId, ownerId, TaskBoard.ORGANIZATION, TaskStatus.APPROVAL, 2000, 'Согласовать брак по возврату рустика', at(8, 26)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.APPROVAL, 3000, 'Утвердить дилерскую скидку Сибирскому Паркету', at(8, 27)),
      taskRow(orgId, shopId, TaskBoard.ORGANIZATION, TaskStatus.APPROVAL, 4000, 'Пустить в работу широкий дуб 36 м²', at(8, 29)),
      taskRow(orgId, storeId, TaskBoard.ORGANIZATION, TaskStatus.APPROVAL, 5000, 'Списать подложку с повреждённой фольгой', at(8, 25)),
      taskRow(orgId, shopId, TaskBoard.ORGANIZATION, TaskStatus.APPROVAL, 6000, 'Утвердить сверхурочные на упаковке', at(8, 29, 11)),
      taskRow(orgId, ownerId, TaskBoard.ORGANIZATION, TaskStatus.APPROVAL, 7000, 'Согласовать закупку шпона ясеня', at(8, 28, 9)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.APPROVAL, 8000, 'Одобрить скидку 5% Лесному Дому', at(8, 27, 14)),
      taskRow(orgId, shopId, TaskBoard.ORGANIZATION, TaskStatus.APPROVAL, 9000, 'Пустить в покраску орех 24 м²', at(8, 30, 10)),
      taskRow(orgId, shopId, TaskBoard.ORGANIZATION, TaskStatus.IN_PROGRESS, 1000, 'Догнать профилирование по рустику 46 м²', at(8, 25)),
      taskRow(orgId, shopId, TaskBoard.ORGANIZATION, TaskStatus.IN_PROGRESS, 2000, 'Покраска ясеня, партия Самара', at(8, 26)),
      taskRow(orgId, storeId, TaskBoard.ORGANIZATION, TaskStatus.IN_PROGRESS, 3000, 'Принять фанеру с Кострома Лес', at(8, 27)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.IN_PROGRESS, 4000, 'Счёт на 90 м² рустика, Север', at(8, 25)),
      taskRow(orgId, shopId, TaskBoard.ORGANIZATION, TaskStatus.IN_PROGRESS, 5000, 'Настроить станок под ёлочку 90×600', at(8, 21)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.IN_PROGRESS, 6000, 'Собрать отгрузку витрины Краснодар', at(8, 28)),
      taskRow(orgId, ownerId, TaskBoard.ORGANIZATION, TaskStatus.IN_PROGRESS, 7000, 'Переговоры с Евростилем по годовому объёму', at(8, 18)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.IN_PROGRESS, 8000, 'Счёт Евростилю на 140 м² ёлочки', at(8, 28, 10)),
      taskRow(orgId, storeId, TaskBoard.ORGANIZATION, TaskStatus.IN_PROGRESS, 9000, 'Принять масло-воск с Химпрома', at(8, 27, 15)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.IN_PROGRESS, 10000, 'Коммерческое Квартал Плюс, 80 м²', at(8, 29, 11)),
      taskRow(orgId, shopId, TaskBoard.ORGANIZATION, TaskStatus.IN_PROGRESS, 11000, 'Настройка линии под плинтус 60', at(8, 26, 8)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.IN_PROGRESS, 12000, 'Сверка отгрузки с АртПолом', at(8, 28, 16)),
      taskRow(orgId, storeId, TaskBoard.ORGANIZATION, TaskStatus.REVIEW, 1000, 'Пересчитать коробки перед сентябрём', at(8, 27)),
      taskRow(orgId, shopId, TaskBoard.ORGANIZATION, TaskStatus.REVIEW, 2000, 'Проверить влажность щита дуб мёд', at(8, 28)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.REVIEW, 3000, 'Сверить спецификацию ЖК Солнечный', at(8, 29)),
      taskRow(orgId, storeId, TaskBoard.ORGANIZATION, TaskStatus.REVIEW, 4000, 'Инвентаризация порогов и плинтуса 60', at(8, 26)),
      taskRow(orgId, ownerId, TaskBoard.ORGANIZATION, TaskStatus.REVIEW, 5000, 'Проверить УПД по ЗК-2026-11', at(8, 29, 9)),
      taskRow(orgId, shopId, TaskBoard.ORGANIZATION, TaskStatus.REVIEW, 6000, 'Приёмка широкого дуба с линии', at(8, 28, 14)),
      taskRow(orgId, storeId, TaskBoard.ORGANIZATION, TaskStatus.REVIEW, 7000, 'Сверить остатки масла на складе', at(8, 27, 11)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.REVIEW, 8000, 'Акт с ПолМастером по замене 4 м²', at(8, 26, 16)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.DONE, 1000, 'Отгрузить витрину на Невский', at(8, 20)),
      taskRow(orgId, shopId, TaskBoard.ORGANIZATION, TaskStatus.DONE, 2000, 'Закрыть смену по корпусу 2', at(5, 19)),
      taskRow(orgId, storeId, TaskBoard.ORGANIZATION, TaskStatus.DONE, 3000, 'Оприходовать подложку XPS', at(6, 20)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.DONE, 4000, 'Выставить счёт Паркет Холлу 60 м²', at(8, 18)),
      taskRow(orgId, ownerId, TaskBoard.ORGANIZATION, TaskStatus.DONE, 5000, 'Заключить договор с Лесным Домом', at(7, 14)),
      taskRow(orgId, shopId, TaskBoard.ORGANIZATION, TaskStatus.DONE, 6000, 'Профилирование инженерной селект 72 м²', at(6, 4)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.DONE, 7000, 'Закрыть возврат по тону, Волга Трейд', at(7, 9)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.DONE, 8000, 'Отгрузить плинтус ИП Козловой', at(8, 16)),
      taskRow(orgId, storeId, TaskBoard.ORGANIZATION, TaskStatus.DONE, 9000, 'Оприходовать коробки Картонова', at(7, 22)),
      taskRow(orgId, ownerId, TaskBoard.ORGANIZATION, TaskStatus.DONE, 10000, 'Подписать доп. с Севером на Q3', at(7, 3)),
      taskRow(orgId, shopId, TaskBoard.ORGANIZATION, TaskStatus.DONE, 11000, 'Закрыть покраску селекта 40 м²', at(6, 18)),
      taskRow(orgId, managerId, TaskBoard.ORGANIZATION, TaskStatus.DONE, 12000, 'Закрыть заявку Паркет Холл по витрине', at(8, 21)),
    ],
  })

  const orgTasks = await db.task.findMany({
    where: { organizationId: orgId, board: TaskBoard.ORGANIZATION },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  if (orgTasks.length) {
    const assignees = [managerId, shopId, storeId, ownerId]
    await db.taskAssignee.createMany({
      data: orgTasks.map((item, index) => ({ taskId: item.id, userId: assignees[index % assignees.length] })),
    })
  }

  const sever = c('7701234567')
  const les = c('4401123001')
  const hall = c('7810440012')
  const evro = c('7703999110')
  const artpol = c('2307888002')
  const sib = c('5402123008')
  const polmaster = c('6671234001')
  const stroykom = c('1658012300')
  const lesdom = c('6901444003')
  const kvartal = c('6167002201')
  const himprom = c('6317004401')
  const karton = c('440200550088')
  await db.mailMessage.createMany({
    data: [
      mail(orgId, ownerId, MailFolder.INBOX, sever.email, sever.contactName ?? sever.name, 'owner@faverum.local', 'Анна Ковалёва', 'Срок по рустику 46 м²', 'Анна, добрый день.\n\nКогда партия рустика уйдёт в покраску? Объект ждёт 18 сентября.\n\nДмитрий Орлов\nООО «Север»', at(8, 28, 9), null),
      mail(orgId, ownerId, MailFolder.INBOX, les.email, les.contactName ?? les.name, 'owner@faverum.local', 'Анна Ковалёва', 'Шпон дуба — подтверждение', 'Готовы отгрузить 120 м² шпона на следующей неделе. Нужно подтверждение заявки ЗК-2026-11.', at(8, 29, 11), null),
      mail(orgId, ownerId, MailFolder.INBOX, evro.email, evro.contactName ?? evro.name, 'owner@faverum.local', 'Анна Ковалёва', 'Ёлочка дуб, 140 м²', 'Анна, нужны образцы ёлочки и пороги в цвет. Если успеете к 12 сентября — забираем в работу три салона.', at(8, 27, 10), null),
      mail(orgId, ownerId, MailFolder.INBOX, artpol.email, artpol.contactName ?? artpol.name, 'owner@faverum.local', 'Анна Ковалёва', 'Дымчатый дуб на витрину', 'Пришлите 8 м² дымчатого и 6 м плинтуса 80. Оплата по счёту в течение трёх дней.', at(8, 26, 14), null),
      mail(orgId, ownerId, MailFolder.INBOX, sib.email, sib.contactName ?? sib.name, 'owner@faverum.local', 'Анна Ковалёва', 'Дилерский прайс Q4', 'Просим актуальный прайс на инженерную и широкий формат. Новосибирск, отгрузка фурой.', at(8, 25, 8), null),
      mail(orgId, ownerId, MailFolder.INBOX, polmaster.email, polmaster.contactName ?? polmaster.name, 'owner@faverum.local', 'Анна Ковалёва', 'Брак по мёду?', 'На объекте в Академическом планка ушла пятном. Можно ли заменить 4 м² из той же партии?', at(8, 24, 16), at(8, 25, 9)),
      mail(orgId, ownerId, MailFolder.INBOX, stroykom.email, stroykom.contactName ?? stroykom.name, 'owner@faverum.local', 'Анна Ковалёва', 'ЖК «Казанский квартал», корпус 1', 'Нужен дуб натур 260 м² и подложка XPS. Старт укладки 5 октября.', at(8, 23, 11), null),
      mail(orgId, ownerId, MailFolder.INBOX, himprom.email, himprom.contactName ?? himprom.name, 'owner@faverum.local', 'Анна Ковалёва', 'Лак ПУ, срок годности', 'Партия августа — срок 18 месяцев. Паспорт качества во вложении к счёту СЧ-8811.', at(8, 12, 13), at(8, 12, 15)),
      mail(orgId, ownerId, MailFolder.INBOX, karton.email, karton.contactName ?? karton.name, 'owner@faverum.local', 'Анна Ковалёва', 'Коробки 2.2 — подтвердите тираж', 'Могу привезти 150 коробок 3 сентября. Нужно подтверждение черновика ЗК-2026-10.', at(8, 28, 17), null),
      mail(orgId, ownerId, MailFolder.INBOX, lesdom.email, lesdom.contactName ?? lesdom.name, 'owner@faverum.local', 'Анна Ковалёва', 'Договор подписан', 'Скан договора с печатью отправил. Первая заявка — ясень натуральный 40 м².', at(7, 15, 10), at(7, 15, 12)),
      mail(orgId, ownerId, MailFolder.INBOX, kvartal.email, kvartal.contactName ?? kvartal.name, 'owner@faverum.local', 'Анна Ковалёва', 'Ростов, поставка раз в месяц', 'Готовы брать 80–100 м² дуба натур ежемесячно. Нужны условия отсрочки 21 день.', at(8, 19, 9), at(8, 19, 18)),
      mail(orgId, ownerId, MailFolder.INBOX, hall.email, hall.contactName ?? hall.name, 'owner@faverum.local', 'Анна Ковалёва', 'Невский — фото витрины', 'Витрина стоит. Клиенты спрашивают ёлочку. Есть ли в сентябре свободный объём?', at(8, 22, 12), at(8, 22, 16)),
      mail(orgId, ownerId, MailFolder.INBOX, c('7728123400').email, 'Никита Жуков', 'owner@faverum.local', 'Анна Ковалёва', 'Корпус 4, дедлайн сдвинулся', 'Укладку перенесли на 20 сентября. Спецификацию не меняем: 180 м² натур.', at(8, 30, 11), null),
      mail(orgId, ownerId, MailFolder.INBOX, c('7704555001').email, 'Кирилл Малов', 'owner@faverum.local', 'Анна Ковалёва', 'Образцы эспрессо', 'На Арбат нужно 3 планки эспрессо и 3 широкого дуба. Завтра курьер.', at(8, 29, 15), null),
      mail(orgId, ownerId, MailFolder.INBOX, c('5206555011').email, 'Светлана Панова', 'owner@faverum.local', 'Анна Ковалёва', 'Нижний, салон на Покровской', 'Берём орех 22 м² под частный дом. Счёт на ИП или на ООО?', at(8, 21, 10), at(8, 21, 19)),
      mail(orgId, ownerId, MailFolder.INBOX, c('710255508812').email, 'Ольга Беляева', 'owner@faverum.local', 'Анна Ковалёва', 'Тула — образцы широкого дуба', 'Анна, пришлите 4 планки широкого дуба и плинтус 60. Клиент выбирает между мёдом и натуром.', at(8, 30, 9), null),
      mail(orgId, ownerId, MailFolder.INBOX, c('760300441201').email, 'Дмитрий Морозов', 'owner@faverum.local', 'Анна Ковалёва', 'Ярославль, 36 м² ясень натур', 'Нужна отгрузка к 10 сентября. Могу забрать фурой из Костромы.', at(8, 27, 15), null),
      mail(orgId, ownerId, MailFolder.INBOX, c('6901444003').email, 'Пётр Савельев', 'owner@faverum.local', 'Анна Ковалёва', 'Тверь — повтор ясеня', 'Первая партия легла хорошо. Ещё 28 м² натурального ясеня и пороги.', at(8, 22, 8), at(8, 22, 11)),
      mail(orgId, ownerId, MailFolder.INBOX, himprom.email, himprom.contactName ?? himprom.name, 'owner@faverum.local', 'Анна Ковалёва', 'Счёт на масло-воск СЧ-8902', 'Отгрузили 40 л. УПД завтра. Напоминаю про скидку при заказе от 80 л.', at(8, 19, 14), at(8, 19, 17)),
      mail(orgId, ownerId, MailFolder.INBOX, c('7703999110').email, 'Ирина Фролова', 'owner@faverum.local', 'Анна Ковалёва', 'Годовая сетка салонов', 'Анна, пришлите слоты на октябрь–декабрь по ёлочке и эспрессо. Три салона готовы бронировать.', at(8, 16, 10), null),
      mail(orgId, ownerId, MailFolder.INBOX, c('6671234001').email, 'Роман Ильин', 'owner@faverum.local', 'Анна Ковалёва', 'Акт замены получен', '4 м² дуб мёд приняли. Спасибо, претензий нет.', at(8, 31, 8), null),
      mail(orgId, ownerId, MailFolder.INBOX, 'hr@dubrava-jobs.example', 'Кадровое агентство Лес', 'owner@faverum.local', 'Анна Ковалёва', 'Кандидат на упаковку', 'Есть оператор с опытом на линии паркета, готов выйти с 7 сентября.', at(8, 20, 11), at(8, 20, 16)),
      mail(orgId, ownerId, MailFolder.INBOX, 'logist@trans-kostroma.example', 'Транс Кострома', 'owner@faverum.local', 'Анна Ковалёва', 'Машина на 4 сентября', 'Подтвердите загрузку в 7:00. Кузов 82 м³, тент.', at(8, 29, 18), null),
      mail(orgId, ownerId, MailFolder.INBOX, c('1658012300').email, 'Марат Хабибуллин', 'owner@faverum.local', 'Анна Ковалёва', 'Казань — уточнение по XPS', 'Подложка XPS нужна с фольгой вниз. Подтвердите, что партия такая.', at(8, 25, 12), at(8, 25, 15)),
      mail(orgId, ownerId, MailFolder.INBOX, c('5402123008').email, 'Наталья Гришина', 'owner@faverum.local', 'Анна Ковалёва', 'Фура на Новосибирск', 'Можем забрать 4 сентября вместе с инженерной. Нужна погрузка до 16:00.', at(8, 28, 7), null),
      mail(orgId, ownerId, MailFolder.SENT, 'owner@faverum.local', 'Анна Ковалёва', hall.email, hall.name, 'Витрина на Невский — в доставке', 'Екатерина, партия ясеня собрана и передана в доставку. Трек пришлю завтра.', at(8, 21, 15), at(8, 21, 15)),
      mail(orgId, ownerId, MailFolder.SENT, 'owner@faverum.local', 'Анна Ковалёва', sever.email, sever.contactName ?? sever.name, 'Рустик 46 м² — в покраске', 'Дмитрий, партия на этапе покраски. К 16 сентября будет в упаковке.', at(8, 27, 12), at(8, 27, 12)),
      mail(orgId, ownerId, MailFolder.SENT, 'owner@faverum.local', 'Анна Ковалёва', evro.email, evro.contactName ?? evro.name, 'КП на ёлочку', 'Ирина, предварительный расчёт: 140 м² ёлочки + пороги. Срок цеха 18 рабочих дней.', at(8, 28, 16), at(8, 28, 16)),
      mail(orgId, ownerId, MailFolder.SENT, 'owner@faverum.local', 'Анна Ковалёва', les.email, les.contactName ?? les.name, 'ЗК-2026-11 — подтверждаем', 'Алексей, шпон 120 м² подтверждаем. Привезите вместе с фанерой, если получится.', at(8, 29, 14), at(8, 29, 14)),
      mail(orgId, ownerId, MailFolder.SENT, 'owner@faverum.local', 'Анна Ковалёва', stroykom.email, stroykom.contactName ?? stroykom.name, 'Казань, корпус 1 — слоты', 'Марат, 260 м² натур ставим в план на 22–26 сентября. XPS есть на складе.', at(8, 24, 9), at(8, 24, 9)),
      mail(orgId, ownerId, MailFolder.SENT, 'owner@faverum.local', 'Анна Ковалёва', polmaster.email, polmaster.contactName ?? polmaster.name, 'Замена 4 м² дуб мёд', 'Роман, 4 м² из той же партии отгрузим 4 сентября за наш счёт.', at(8, 25, 11), at(8, 25, 11)),
      mail(orgId, ownerId, MailFolder.SENT, 'owner@faverum.local', 'Анна Ковалёва', c('710255508812').email, 'Ольга Беляева', 'Образцы в Тулу', 'Ольга, завтра отправляем 4 планки широкого дуба и плинтус 60 курьером.', at(8, 30, 16), at(8, 30, 16)),
      mail(orgId, ownerId, MailFolder.SENT, 'owner@faverum.local', 'Анна Ковалёва', c('760300441201').email, 'Дмитрий Морозов', 'Ясень 36 м² — слот', 'Дмитрий, ставим отгрузку на 8 сентября. Фуру примем на складе цеха.', at(8, 28, 10), at(8, 28, 10)),
      mail(orgId, ownerId, MailFolder.SENT, 'owner@faverum.local', 'Анна Ковалёва', sib.email, sib.contactName ?? sib.name, 'Прайс Q4 — инженерная и широкий', 'Наталья, сетка во вложении. На фуру от 200 м² — дополнительная скидка 3%.', at(8, 26, 11), at(8, 26, 11)),
      mail(orgId, ownerId, MailFolder.SENT, 'owner@faverum.local', 'Анна Ковалёва', artpol.email, artpol.contactName ?? artpol.name, 'Дымчатый на витрину', 'Артём, 8 м² и плинтус 80 соберём к 3 сентября. Счёт уже у Ивана.', at(8, 27, 9), at(8, 27, 9)),
      mail(orgId, ownerId, MailFolder.DRAFTS, 'owner@faverum.local', 'Анна Ковалёва', 'objects@stroygrad.example', 'Никита Жуков', 'Корпус 4 — черновик спецификации', 'Никита, собрала предварительный расчёт: 180 м² дуб натур и плинтус. Допишу срок цеха.', at(8, 30, 8), null),
      mail(orgId, ownerId, MailFolder.DRAFTS, 'owner@faverum.local', 'Анна Ковалёва', sib.email, sib.name, 'Прайс Q4 — черновик', 'Наталья, высылаю сетку на инженерную и широкий формат. Не хватает комментария по фуре.', at(8, 26, 18), null),
      mail(orgId, ownerId, MailFolder.DRAFTS, 'owner@faverum.local', 'Анна Ковалёва', kvartal.email, kvartal.name, 'Отсрочка 21 день', 'Елена, 21 день готовы дать со второй поставки. Первую — по предоплате 50%.', at(8, 20, 17), null),
      mail(orgId, ownerId, MailFolder.SPAM, 'promo@lak-opt.example', 'Лаки оптом', 'owner@faverum.local', 'Анна Ковалёва', 'Скидка 40% на китайский лак', 'Только сегодня. Перейдите по ссылке.', at(8, 18, 4), null),
      mail(orgId, ownerId, MailFolder.SPAM, 'bot@boards-seo.example', 'SEO для завода', 'owner@faverum.local', 'Анна Ковалёва', 'Выведем сайт в топ', 'Гарантия заявок по паркету.', at(8, 11, 3), null),
      mail(orgId, ownerId, MailFolder.SPAM, 'news@wood-expo.example', 'WoodExpo рассылка', 'owner@faverum.local', 'Анна Ковалёва', 'Стенд на выставке за 90 000', 'Успейте забронировать до пятницы.', at(8, 14, 5), null),
      mail(orgId, ownerId, MailFolder.SPAM, 'credit@fast-money.example', 'Быстрые деньги', 'owner@faverum.local', 'Анна Ковалёва', 'Займ под оборот', 'Одобрим за 15 минут.', at(8, 7, 2), null),
      mail(orgId, ownerId, MailFolder.ARCHIVE, c('770200044401').email, 'Анна Козлова', 'owner@faverum.local', 'Анна Ковалёва', 'Счёт на плинтус — оплачен', 'Оплатила плинтус и подложку. Жду отгрузку в Казань.', at(8, 27, 13), at(8, 27, 14)),
      mail(orgId, ownerId, MailFolder.ARCHIVE, c('6317081234').email, 'Ольга Шанина', 'owner@faverum.local', 'Анна Ковалёва', 'Возврат рустика получен', 'Партия на Казань вернулась на склад. Акт приложила.', at(7, 9, 12), at(7, 9, 15)),
      mail(orgId, ownerId, MailFolder.ARCHIVE, himprom.email, himprom.contactName ?? himprom.name, 'owner@faverum.local', 'Анна Ковалёва', 'УПД-208', 'Документы по февральской поставке клея.', at(2, 10, 16), at(2, 11, 10)),
      mail(orgId, managerId, MailFolder.INBOX, 'owner@faverum.local', 'Анна Ковалёва', 'manager@faverum.local', 'Иван Петров', 'Счёт Паркет Холлу', 'Иван, выставь счёт на дуб натур 60 м² — оплата уже есть, в производство ещё не отдавали.', at(8, 26, 16), null),
      mail(orgId, managerId, MailFolder.INBOX, evro.email, evro.contactName ?? evro.name, 'manager@faverum.local', 'Иван Петров', 'Уточнение по ёлочке', 'Иван, можно ли укладку ёлочки в двух направлениях? Нужна схема.', at(8, 28, 11), null),
      mail(orgId, managerId, MailFolder.INBOX, artpol.email, artpol.contactName ?? artpol.name, 'manager@faverum.local', 'Иван Петров', 'Счёт на дымчатый', 'Ждём счёт на 8 м². Реквизиты прежние.', at(8, 26, 18), at(8, 27, 9)),
      mail(orgId, managerId, MailFolder.INBOX, c('5206555011').email, 'Светлана Панова', 'manager@faverum.local', 'Иван Петров', 'Орех — когда счёт?', 'Иван, клиент ждёт до вечера. 22 м² и пороги.', at(8, 21, 12), null),
      mail(orgId, managerId, MailFolder.INBOX, c('6167002201').email, 'Елена Донская', 'manager@faverum.local', 'Иван Петров', 'Ростов, график на осень', 'Можем брать по 80 м² раз в месяц. Нужен резерв на октябрь.', at(8, 19, 15), at(8, 20, 10)),
      mail(orgId, managerId, MailFolder.INBOX, c('7704555001').email, 'Кирилл Малов', 'manager@faverum.local', 'Иван Петров', 'Арбат — эспрессо в витрину', 'Планки получили. Пришлите ещё 6 м² если есть на складе.', at(8, 30, 9), null),
      mail(orgId, managerId, MailFolder.SENT, 'manager@faverum.local', 'Иван Петров', hall.email, hall.name, 'Счёт 60 м² дуб натур', 'Екатерина, счёт во вложении. Срок резерва 5 рабочих дней.', at(8, 26, 17), at(8, 26, 17)),
      mail(orgId, managerId, MailFolder.SENT, 'manager@faverum.local', 'Иван Петров', artpol.email, artpol.name, 'Счёт на дымчатый 8 м²', 'Артём, счёт отправил. Плинтус 80 включил отдельной строкой.', at(8, 27, 10), at(8, 27, 10)),
      mail(orgId, managerId, MailFolder.DRAFTS, 'manager@faverum.local', 'Иван Петров', polmaster.email, polmaster.name, 'Коммерческое на мёд', 'Роман, черновик КП на 70 м² дуб мёд. Не поставил логистику.', at(8, 29, 19), null),
      mail(orgId, managerId, MailFolder.DRAFTS, 'manager@faverum.local', 'Иван Петров', c('710255508812').email, 'Ольга Беляева', 'КП Тула, широкий дуб', 'Ольга, считаю 18 м² широкого и плинтус. Не хватает адреса доставки.', at(8, 31, 18), null),
    ],
  })
}

type LineSpec = {
  name: string
  finishedSku: string
  board: string
  profile: string
  coated: string
  veneer: string
  plywoodQty?: number
  glueQty?: number
  finish: { sku: string; qty: number }[]
}

async function createLineType(
  db: DemoDb,
  organizationId: string,
  warehouseId: string,
  p: (sku: string) => { id: string; name: string; unit: string; price: number; kind: ProductKind },
  line: LineSpec,
) {
  const plywood = line.plywoodQty ?? 1.08
  const glue = line.glueQty ?? 0.32
  const created = await db.productionType.create({
    data: {
      organizationId,
      name: line.name,
      productId: p(line.finishedSku).id,
      warehouseId,
      stages: {
        create: [
          {
            name: 'Склейка слоев',
            position: 0,
            outputs: { create: [{ productId: p(line.board).id, quantity: 1 }] },
            inputs: {
              create: [
                { productId: p('MAT-PLY-8').id, quantity: plywood },
                { productId: p(line.veneer).id, quantity: plywood },
                { productId: p('MAT-GLUE-PU').id, quantity: glue },
              ],
            },
          },
          {
            name: 'Профилирование',
            position: 1,
            outputs: { create: [{ productId: p(line.profile).id, quantity: 1 }] },
            inputs: { create: [{ productId: p(line.board).id, quantity: 1 }] },
          },
          {
            name: 'Покраска',
            position: 2,
            outputs: { create: [{ productId: p(line.coated).id, quantity: 1 }] },
            inputs: {
              create: [
                { productId: p(line.profile).id, quantity: 1 },
                ...line.finish.map((item) => ({ productId: p(item.sku).id, quantity: item.qty })),
              ],
            },
          },
          {
            name: 'Упаковка',
            position: 3,
            outputs: { create: [{ productId: p(line.finishedSku).id, quantity: 1 }] },
            inputs: {
              create: [
                { productId: p(line.coated).id, quantity: 1 },
                { productId: p('CON-BOX').id, quantity: 0.45 },
                { productId: p('CON-FILM').id, quantity: 2.4 },
              ],
            },
          },
        ],
      },
    },
    include: {
      stages: {
        orderBy: { position: 'asc' },
        include: { inputs: true, outputs: true },
      },
    },
  })
  return created
}

async function writeStageMovements(
  db: DemoDb,
  params: {
    warehouseId: string
    jobId: string
    createdById: string
    title: string
    quantity: number
    at: Date
    stage: {
      name: string
      outputs: { productId: string; quantity: number }[]
      inputs: { productId: string | null; quantity: number }[]
    }
  },
) {
  const rows: Prisma.StockMovementCreateManyInput[] = params.stage.inputs
    .filter((input): input is { productId: string; quantity: number } => Boolean(input.productId))
    .map((input) => ({
    warehouseId: params.warehouseId,
    productId: input.productId,
    type: StockMovementType.WRITEOFF,
    quantity: roundQty(input.quantity * params.quantity),
    note: `${params.title} · ${params.stage.name}`,
    productionJobId: params.jobId,
    createdById: params.createdById,
    createdAt: params.at,
  }))
  if (params.stage.outputs.length) {
    for (const output of params.stage.outputs) {
      rows.push({
        warehouseId: params.warehouseId,
        productId: output.productId,
        type: StockMovementType.RECEIPT,
        quantity: roundQty(output.quantity * params.quantity),
        note: `${params.title} · ${params.stage.name}`,
        productionJobId: params.jobId,
        createdById: params.createdById,
        createdAt: params.at,
      })
    }
  }
  await db.stockMovement.createMany({ data: rows })
}

function roundQty(value: number) {
  return Math.round(value * 1000) / 1000
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function fin(
  organizationId: string,
  catByKind: Record<ProductKind, string>,
  name: string,
  sku: string,
  unit: string,
  price: number,
  description: string,
) {
  return {
    organizationId,
    kind: ProductKind.FINISHED,
    categoryId: catByKind[ProductKind.FINISHED],
    inCatalog: true,
    name,
    sku,
    unit,
    price,
    description,
    createdAt: at(1, 1, 8),
  }
}

function mat(
  organizationId: string,
  catByKind: Record<ProductKind, string>,
  name: string,
  sku: string,
  unit: string,
  price: number,
  kind: ProductKind = ProductKind.MATERIAL,
) {
  return {
    organizationId,
    kind,
    categoryId: catByKind[kind],
    inCatalog: false,
    name,
    sku,
    unit,
    price,
    createdAt: at(1, 1, 8),
  }
}

function wip(organizationId: string, catByKind: Record<ProductKind, string>, name: string, sku: string) {
  return {
    organizationId,
    kind: ProductKind.SEMI_FINISHED,
    categoryId: catByKind[ProductKind.SEMI_FINISHED],
    inCatalog: false,
    name,
    sku,
    unit: 'м²',
    price: 0,
    createdAt: at(1, 1, 8),
  }
}

function attrs(rows: [string, string][]) {
  return rows.map(([name, value], position) => ({ name, value, position }))
}

function party(
  organizationId: string,
  row: {
    name: string
    legalName: string
    inn: string
    kpp?: string
    ogrn?: string
    legalAddress: string
    email: string
    phone?: string
    telegram?: string
    contactName?: string
    notes?: string
  },
) {
  return {
    organizationId,
    name: row.name,
    legalName: row.legalName,
    inn: row.inn,
    kpp: row.kpp,
    ogrn: row.ogrn,
    legalAddress: row.legalAddress,
    actualAddress: row.legalAddress,
    email: row.email,
    phone: row.phone,
    telegram: row.telegram,
    contactName: row.contactName,
    notes: row.notes,
    createdAt: at(1, 1, 9),
  }
}

function rec(
  warehouseId: string,
  productId: string,
  quantity: number,
  note: string,
  createdById: string,
  createdAt: Date,
  purchaseId?: string,
): Prisma.StockMovementCreateManyInput {
  return {
    warehouseId,
    productId,
    type: StockMovementType.RECEIPT,
    quantity,
    note,
    createdById,
    createdAt,
    purchaseId,
  }
}

function taskRow(
  organizationId: string,
  createdById: string,
  board: TaskBoard,
  status: TaskStatus,
  position: number,
  title: string,
  createdAt: Date,
  description?: string,
) {
  return {
    organizationId,
    board,
    status,
    position,
    title,
    description,
    ownerId: board === TaskBoard.PERSONAL ? createdById : null,
    createdById,
    createdAt,
    updatedAt: createdAt,
  }
}

function mail(
  organizationId: string,
  userId: string,
  folder: MailFolder,
  fromAddress: string,
  fromName: string,
  toAddress: string,
  toName: string,
  subject: string,
  body: string,
  createdAt: Date,
  readAt: Date | null,
) {
  return {
    organizationId,
    userId,
    folder,
    fromAddress,
    fromName,
    toAddress,
    toName,
    subject,
    body,
    createdAt,
    readAt,
  }
}

type PurchaseSpec = {
  number: string
  title: string
  inn: string
  status: PurchaseStatus
  at: Date
  items: { sku: string; qty: number; price: number }[]
  doc?: { title: string; number: string; issuedAt: Date }
}

type DealSpec = {
  inn: string
  title: string
  status: DealStatus
  created: Date
  updated: Date
  due?: Date
  note?: string
  items: { sku: string; qty: number }[]
  production?: {
    sku: string
    done?: Date
    started?: Date
    stageIndex?: number
    stageStatus?: ProductionStageStatus
  }
  ship?: Date
}

const CATALOG_IMAGE_SKUS = [
  'PAR-OAK-NAT',
  'PAR-OAK-RUS',
  'PAR-ASH-WHT',
  'ENG-OAK-SEL',
  'PLI-OAK-80',
  'UND-CORK-2',
  'PAR-OAK-HON',
  'PAR-OAK-SMK',
  'PAR-OAK-ESP',
  'PAR-OAK-WDE',
  'PAR-OAK-HER',
  'PAR-WAL-NAT',
  'PAR-ASH-NAT',
  'ENG-OAK-RUS',
  'ENG-ASH-WHT',
  'PLI-OAK-60',
  'PLI-ASH-80',
  'THR-OAK',
  'UND-XPS',
  'OIL-CARE',
]

async function attachCatalogImages(db: DemoDb, organizationId: string, p: (sku: string) => { id: string }) {
  const dir = [
    join(process.cwd(), 'prisma', 'demo-images'),
    join(process.cwd(), 'apps', 'api', 'prisma', 'demo-images'),
    join(__dirname, '..', '..', 'prisma', 'demo-images'),
  ].find((candidate) => existsSync(candidate))
  if (!dir) return
  for (const sku of CATALOG_IMAGE_SKUS) {
    const src = join(dir, `${sku}.png`)
    if (!existsSync(src)) continue
    const buffer = await readFile(src)
    const saved = await saveProductImage(organizationId, `${sku}.png`, buffer)
    await db.productImage.create({
      data: {
        productId: p(sku).id,
        storageKey: saved.storageKey,
        mimeType: saved.mimeType,
        size: saved.size,
        position: 0,
      },
    })
  }
}

const CUSTOMER_INNS = [
  '7701234567',
  '6317081234',
  '770200044401',
  '7704555001',
  '7728123400',
  '7810440012',
  '6671234001',
  '5402123008',
  '760300441201',
  '5206555011',
  '2307888002',
  '7703999110',
  '1658012300',
  '710255508812',
  '6901444003',
  '6167002201',
]

const SELL_SKUS = [
  'PAR-OAK-NAT',
  'PAR-OAK-RUS',
  'PAR-ASH-WHT',
  'ENG-OAK-SEL',
  'PAR-OAK-HON',
  'PAR-OAK-SMK',
  'PAR-OAK-ESP',
  'PAR-OAK-WDE',
  'PAR-OAK-HER',
  'PAR-WAL-NAT',
  'PAR-ASH-NAT',
  'ENG-OAK-RUS',
  'ENG-ASH-WHT',
  'PLI-OAK-80',
  'UND-CORK-2',
]

const SKU_SHORT: Record<string, string> = {
  'PAR-OAK-NAT': 'Дуб натур',
  'PAR-OAK-RUS': 'Дуб рустик',
  'PAR-ASH-WHT': 'Ясень беленый',
  'ENG-OAK-SEL': 'Инженерная селект',
  'PAR-OAK-HON': 'Дуб мёд',
  'PAR-OAK-SMK': 'Дуб дымчатый',
  'PAR-OAK-ESP': 'Дуб эспрессо',
  'PAR-OAK-WDE': 'Дуб широкий',
  'PAR-OAK-HER': 'Дуб ёлочка',
  'PAR-WAL-NAT': 'Орех',
  'PAR-ASH-NAT': 'Ясень натур',
  'ENG-OAK-RUS': 'Инженерная рустик',
  'ENG-ASH-WHT': 'Инженерная ясень',
  'PLI-OAK-80': 'Плинтус дуб 80',
  'UND-CORK-2': 'Подложка пробка',
}

const DEAL_OBJECTS = [
  'ЖК «Речной»',
  'ЖК «Солнечный»',
  'салон на Арбате',
  'витрина Невский',
  'частный дом',
  'офис на Садовой',
  'шоурум дилера',
  'квартира под сдачу',
  'ресепшен отеля',
  'корпус школы',
]

const DEAL_TARGETS: Partial<Record<DealStatus, number>> = {
  NEW: 9,
  IN_PROGRESS: 16,
  INVOICE_ISSUED: 7,
  PAID: 12,
  TO_PRODUCTION: 27,
  SHIPPED_TO_WAREHOUSE: 8,
  TO_DELIVERY: 14,
  DELIVERED: 22,
  RETURNED: 3,
  CLOSED: 39,
}

function expandSalesDeals(existing: DealSpec[]): DealSpec[] {
  const extra: DealSpec[] = []
  for (const status of Object.keys(DEAL_TARGETS) as DealStatus[]) {
    const target = DEAL_TARGETS[status] ?? 0
    const have = existing.filter((item) => item.status === status).length
    for (let i = 0; i < target - have; i++) {
      const sku = SELL_SKUS[(have + i) % SELL_SKUS.length]
      const inn = CUSTOMER_INNS[(have + i * 3) % CUSTOMER_INNS.length]
      const qtyBase = 14 + ((i * 7) % 90)
      const qty = sku.startsWith('PLI') || sku.startsWith('THR') ? Math.max(8, Math.round(qtyBase / 3)) : qtyBase
      const dates = extraDealDates(status, i)
      extra.push({
        inn,
        title: `${SKU_SHORT[sku] ?? sku}, ${DEAL_OBJECTS[i % DEAL_OBJECTS.length]} · ${i + 1}`,
        status,
        created: dates.created,
        updated: dates.updated,
        due: dates.due,
        items: [{ sku, qty }],
      })
    }
  }
  return extra
}

function extraDealDates(status: DealStatus, i: number) {
  const day = 2 + ((i * 2) % 26)
  if (status === DealStatus.CLOSED) {
    return { created: at(1 + (i % 4), day), updated: at(2 + (i % 4), day), due: at(2 + (i % 4), Math.min(28, day + 5)) }
  }
  if (status === DealStatus.DELIVERED) {
    return { created: at(4 + (i % 4), day), updated: at(5 + (i % 3), day), due: at(5 + (i % 3), Math.min(28, day + 4)) }
  }
  if (status === DealStatus.RETURNED) {
    return { created: at(5 + (i % 3), day), updated: at(6 + (i % 2), day), due: at(6, Math.min(28, day + 3)) }
  }
  if (status === DealStatus.TO_DELIVERY || status === DealStatus.SHIPPED_TO_WAREHOUSE) {
    return { created: at(7, Math.min(28, 8 + (i % 18))), updated: at(8, Math.min(30, 10 + (i % 16))), due: at(9, 4 + (i % 20)) }
  }
  if (status === DealStatus.TO_PRODUCTION) {
    return { created: at(8, Math.min(28, 6 + (i % 20))), updated: at(8, Math.min(30, 20 + (i % 8))), due: at(9, 10 + (i % 16)) }
  }
  if (status === DealStatus.NEW) {
    const createdDay = Math.min(31, 18 + (i % 13))
    return { created: at(8, createdDay), updated: at(8, createdDay), due: at(9, 8 + (i % 18)) }
  }
  return {
    created: at(8, Math.min(28, 8 + (i % 18))),
    updated: at(8, Math.min(30, 16 + (i % 12))),
    due: at(9, 6 + (i % 20)),
  }
}
