import { PrismaClient, LicenseStatus, AccessStatus, UserRole, TaskBoard, TaskStatus, DealStatus, ProductKind, StockMovementType, PurchaseStatus, MailFolder } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.mailAttachment.deleteMany();
  await prisma.mailMessage.deleteMany();
  await prisma.productionJob.deleteMany();
  await prisma.productionType.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.product.deleteMany();
  await prisma.task.deleteMany();
  await prisma.counterparty.deleteMany();
  await prisma.session.deleteMany();
  await prisma.otpChallenge.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.organization.deleteMany();

  const allPages = [
    'tasks',
    'mail',
    'sales',
    'warehouse',
    'production',
    'products',
    'purchases',
    'counterparties',
    'admin',
  ];

  const live = await prisma.organization.create({
    data: {
      name: 'Атлас Производство',
      licenseStatus: LicenseStatus.ACTIVE,
      inn: '7709876543',
      kpp: '770901001',
      ogrn: '1027700000001',
      legalAddress: '115035, г. Москва, ул. Садовническая, д. 12',
      bankName: 'ПАО Сбербанк',
      bik: '044525225',
      checkingAccount: '40702810100000011111',
      correspondentAccount: '30101810400000000225',
    },
  });

  const adminRole = await prisma.role.create({
    data: {
      organizationId: live.id,
      name: 'Администратор',
      pages: allPages,
      locked: true,
    },
  });
  const memberRole = await prisma.role.create({
    data: {
      organizationId: live.id,
      name: 'Сотрудник',
      pages: allPages.filter((page) => page !== 'admin'),
    },
  });

  await prisma.user.createMany({
    data: [
      {
        organizationId: live.id,
        email: 'owner@faverum.local',
        name: 'Анна Ковалёва',
        role: UserRole.ADMIN,
        roleId: adminRole.id,
        status: AccessStatus.ACTIVE,
        mailSignature: 'С уважением,\nАнна Ковалёва\nАтлас Производство',
        jobTitle: 'Генеральный директор',
      },
      {
        organizationId: live.id,
        email: 'manager@faverum.local',
        name: 'Иван Петров',
        role: UserRole.MEMBER,
        roleId: memberRole.id,
        status: AccessStatus.ACTIVE,
        mailSignature: 'С уважением,\nИван Петров\nОтдел продаж',
        jobTitle: 'Менеджер по продажам',
      },
      {
        organizationId: live.id,
        email: 'blocked@faverum.local',
        name: 'Сергей Морозов',
        role: UserRole.MEMBER,
        roleId: memberRole.id,
        status: AccessStatus.BLOCKED,
      },
    ],
  });

  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: 'owner@faverum.local' },
  });
  const manager = await prisma.user.findUniqueOrThrow({
    where: { email: 'manager@faverum.local' },
  });

  await prisma.task.createMany({
    data: [
      {
        organizationId: live.id,
        board: TaskBoard.PERSONAL,
        ownerId: owner.id,
        createdById: owner.id,
        status: TaskStatus.NEW,
        position: 1000,
        title: 'Созвониться с логистом',
        description: 'Уточнить слоты отгрузки на следующую неделю.',
      },
      {
        organizationId: live.id,
        board: TaskBoard.PERSONAL,
        ownerId: owner.id,
        createdById: owner.id,
        status: TaskStatus.IN_PROGRESS,
        position: 1000,
        title: 'Закрыть авансовый отчёт',
      },
      {
        organizationId: live.id,
        board: TaskBoard.PERSONAL,
        ownerId: owner.id,
        createdById: owner.id,
        status: TaskStatus.DONE,
        position: 1000,
        title: 'Подписать доверенность',
      },
      {
        organizationId: live.id,
        board: TaskBoard.ORGANIZATION,
        createdById: owner.id,
        status: TaskStatus.NEW,
        position: 1000,
        title: 'Согласовать спецификацию на партию №14',
        description: 'Черновик у технолога. Нужна проверка состава сырья.',
      },
      {
        organizationId: live.id,
        board: TaskBoard.ORGANIZATION,
        createdById: owner.id,
        status: TaskStatus.APPROVAL,
        position: 1000,
        title: 'Обновить прайс для дилеров',
      },
      {
        organizationId: live.id,
        board: TaskBoard.ORGANIZATION,
        createdById: owner.id,
        status: TaskStatus.IN_PROGRESS,
        position: 1000,
        title: 'Подготовить отгрузку в Казань',
      },
      {
        organizationId: live.id,
        board: TaskBoard.ORGANIZATION,
        createdById: owner.id,
        status: TaskStatus.REVIEW,
        position: 1000,
        title: 'Проверить акт сверки с ООО «Север»',
      },
      {
        organizationId: live.id,
        board: TaskBoard.ORGANIZATION,
        createdById: owner.id,
        status: TaskStatus.DONE,
        position: 1000,
        title: 'Закрыть заявку на рекламацию',
      },
    ],
  });

  const orgTasks = await prisma.task.findMany({
    where: { organizationId: live.id, board: TaskBoard.ORGANIZATION },
    select: { id: true },
  });
  if (orgTasks.length) {
    await prisma.taskAssignee.createMany({
      data: orgTasks.map((task) => ({ taskId: task.id, userId: manager.id })),
    });
  }

  await prisma.counterparty.createMany({
    data: [
      {
        organizationId: live.id,
        name: 'ООО «Север»',
        legalName: 'Общество с ограниченной ответственностью «Север»',
        inn: '7701234567',
        kpp: '770101001',
        ogrn: '1027700132195',
        legalAddress: '101000, г. Москва, ул. Мясницкая, д. 24',
        actualAddress: '101000, г. Москва, ул. Мясницкая, д. 24',
        bankName: 'ПАО Сбербанк',
        bik: '044525225',
        checkingAccount: '40702810900000012345',
        correspondentAccount: '30101810400000000225',
        email: 'zakaz@sever.example',
        phone: '+7 495 111-22-33',
        telegram: 'sever_zakup',
        contactName: 'Дмитрий Орлов',
      },
      {
        organizationId: live.id,
        name: 'ИП Козлова А.В.',
        legalName: 'Индивидуальный предприниматель Козлова Анна Викторовна',
        inn: '770200044401',
        legalAddress: '420111, г. Казань, ул. Баумана, д. 9',
        email: 'kozlova@example.ru',
        phone: '+7 917 555-01-02',
        contactName: 'Анна Козлова',
      },
      {
        organizationId: live.id,
        name: 'АО «Волга Трейд»',
        legalName: 'Акционерное общество «Волга Трейд»',
        inn: '6317081234',
        kpp: '631701001',
        ogrn: '1026301417523',
        legalAddress: '443010, г. Самара, ул. Куйбышева, д. 88',
        bankName: 'Банк ВТБ (ПАО)',
        bik: '044525187',
        checkingAccount: '40702810100000067890',
        correspondentAccount: '30101810700000000187',
        email: 'office@volga-trade.example',
        notes: 'Основной дилер по ПФО.',
      },
    ],
  });

  const sever = await prisma.counterparty.findFirstOrThrow({
    where: { organizationId: live.id, inn: '7701234567' },
  });
  const kozlova = await prisma.counterparty.findFirstOrThrow({
    where: { organizationId: live.id, inn: '770200044401' },
  });
  const volga = await prisma.counterparty.findFirstOrThrow({
    where: { organizationId: live.id, inn: '6317081234' },
  });

  await prisma.mailMessage.createMany({
    data: [
      {
        organizationId: live.id,
        userId: owner.id,
        folder: MailFolder.INBOX,
        fromAddress: sever.email,
        fromName: sever.contactName ?? sever.name,
        toAddress: owner.email,
        toName: owner.name,
        subject: 'Партия панелей — уточнение срока',
        body: 'Анна, добрый день.\n\nПодтвердите, пожалуйста, отгрузку графитовых панелей к 12 сентября. Если сдвинется производство — напишите сразу.\n\nДмитрий Орлов\nООО «Север»',
        createdAt: new Date('2026-08-28T09:14:00Z'),
      },
      {
        organizationId: live.id,
        userId: owner.id,
        folder: MailFolder.INBOX,
        fromAddress: manager.email,
        fromName: manager.name,
        toAddress: owner.email,
        toName: owner.name,
        subject: 'Счёт для Козловой',
        body: 'Анна, выставил счёт по фурнитуре. Проверьте сумму и отправьте клиенту, если всё верно.',
        createdAt: new Date('2026-08-28T11:40:00Z'),
      },
      {
        organizationId: live.id,
        userId: owner.id,
        folder: MailFolder.SENT,
        fromAddress: owner.email,
        fromName: owner.name,
        toAddress: kozlova.email,
        toName: kozlova.contactName ?? kozlova.name,
        subject: 'Счёт на комплект фурнитуры',
        body: 'Анна Викторовна, добрый день.\n\nНаправляю счёт на комплект скрытых петель. Если удобно — можем отгрузить на следующей неделе.\n\nС уважением,\nАнна Ковалёва\nАтлас Производство',
        readAt: new Date('2026-08-27T15:02:00Z'),
        createdAt: new Date('2026-08-27T15:02:00Z'),
      },
      {
        organizationId: live.id,
        userId: owner.id,
        folder: MailFolder.DRAFTS,
        fromAddress: owner.email,
        fromName: owner.name,
        toAddress: volga.email,
        toName: volga.name,
        subject: 'Прайс для дилеров',
        body: 'Коллеги, готовим обновлённый прайс. Черновик во вложении — допишу комментарий по скидкам.',
        createdAt: new Date('2026-08-29T08:20:00Z'),
      },
      {
        organizationId: live.id,
        userId: manager.id,
        folder: MailFolder.INBOX,
        fromAddress: owner.email,
        fromName: owner.name,
        toAddress: manager.email,
        toName: manager.name,
        subject: 'Счёт для Козловой',
        body: 'Иван, проверьте счёт по фурнитуре и отправьте клиенту, если сумма сходится.',
        createdAt: new Date('2026-08-28T11:35:00Z'),
      },
    ],
  });

  await prisma.product.createMany({
    data: [
      {
        organizationId: live.id,
        kind: ProductKind.FINISHED,
        inCatalog: true,
        name: 'Панель графит 600×600',
        sku: 'PAN-600-GR',
        unit: 'шт',
        price: 1850,
      },
      {
        organizationId: live.id,
        kind: ProductKind.FINISHED,
        inCatalog: true,
        name: 'Петля скрытая',
        sku: 'HINGE-H',
        unit: 'шт',
        price: 95,
      },
      {
        organizationId: live.id,
        kind: ProductKind.FINISHED,
        inCatalog: true,
        name: 'Профиль алюминиевый 3 м',
        sku: 'ALU-3M',
        unit: 'шт',
        price: 420,
      },
      {
        organizationId: live.id,
        kind: ProductKind.FINISHED,
        inCatalog: true,
        name: 'Комплект крепежа',
        sku: 'FIX-KIT',
        unit: 'компл',
        price: 180,
      },
      {
        organizationId: live.id,
        kind: ProductKind.MATERIAL,
        name: 'Плёнка ПЭТ',
        sku: 'MAT-PET',
        unit: 'м',
        price: 0,
      },
      {
        organizationId: live.id,
        kind: ProductKind.MATERIAL,
        name: 'Клей ПВА',
        sku: 'MAT-GLUE',
        unit: 'кг',
        price: 0,
      },
      {
        organizationId: live.id,
        kind: ProductKind.SEMI_FINISHED,
        name: 'Заготовка панели графит',
        sku: 'WIP-PAN-GR',
        unit: 'шт',
        price: 0,
      },
      {
        organizationId: live.id,
        kind: ProductKind.CONSUMABLE,
        name: 'Коробка упаковочная',
        sku: 'CON-BOX',
        unit: 'шт',
        price: 0,
      },
    ],
  });

  const [panel, hinge, profile, kit, film, glue, box, blank] = await Promise.all([
    prisma.product.findFirstOrThrow({ where: { organizationId: live.id, sku: 'PAN-600-GR' } }),
    prisma.product.findFirstOrThrow({ where: { organizationId: live.id, sku: 'HINGE-H' } }),
    prisma.product.findFirstOrThrow({ where: { organizationId: live.id, sku: 'ALU-3M' } }),
    prisma.product.findFirstOrThrow({ where: { organizationId: live.id, sku: 'FIX-KIT' } }),
    prisma.product.findFirstOrThrow({ where: { organizationId: live.id, sku: 'MAT-PET' } }),
    prisma.product.findFirstOrThrow({ where: { organizationId: live.id, sku: 'MAT-GLUE' } }),
    prisma.product.findFirstOrThrow({ where: { organizationId: live.id, sku: 'CON-BOX' } }),
    prisma.product.findFirstOrThrow({ where: { organizationId: live.id, sku: 'WIP-PAN-GR' } }),
  ]);

  const panelDeal = await prisma.deal.create({
    data: {
      organizationId: live.id,
      counterpartyId: sever.id,
      createdById: owner.id,
      title: 'Партия декоративных панелей',
      description: 'Комплект панелей под заказ, цвет графит.',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: DealStatus.NEW,
      position: 1000,
      items: {
        create: [{ productId: panel.id, name: panel.name, quantity: 40, unit: panel.unit, price: panel.price }],
      },
      events: { create: { text: 'Сделка создана' } },
    },
  });
  await prisma.deal.create({
    data: {
      organizationId: live.id,
      counterpartyId: kozlova.id,
      createdById: owner.id,
      title: 'Комплект фурнитуры',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: DealStatus.IN_PROGRESS,
      position: 1000,
      items: {
        create: [{ productId: hinge.id, name: hinge.name, quantity: 120, unit: hinge.unit, price: hinge.price }],
      },
      events: { create: { text: 'Сделка создана' } },
    },
  });

  const mainWarehouse = await prisma.warehouse.create({
    data: {
      organizationId: live.id,
      name: 'Основной склад',
      address: '115035, г. Москва, ул. Садовническая, д. 12',
    },
  });
  await prisma.stockMovement.createMany({
    data: [
      { warehouseId: mainWarehouse.id, productId: panel.id, type: StockMovementType.RECEIPT, quantity: 220, note: 'Остаток на начало', createdById: owner.id },
      { warehouseId: mainWarehouse.id, productId: hinge.id, type: StockMovementType.RECEIPT, quantity: 800, note: 'Остаток на начало', createdById: owner.id },
      { warehouseId: mainWarehouse.id, productId: profile.id, type: StockMovementType.RECEIPT, quantity: 90, note: 'Остаток на начало', createdById: owner.id },
      { warehouseId: mainWarehouse.id, productId: kit.id, type: StockMovementType.RECEIPT, quantity: 40, note: 'Остаток на начало', createdById: owner.id },
      { warehouseId: mainWarehouse.id, productId: film.id, type: StockMovementType.RECEIPT, quantity: 1200, note: 'Остаток на начало', createdById: owner.id },
      { warehouseId: mainWarehouse.id, productId: glue.id, type: StockMovementType.RECEIPT, quantity: 48, note: 'Остаток на начало', createdById: owner.id },
      { warehouseId: mainWarehouse.id, productId: box.id, type: StockMovementType.RECEIPT, quantity: 300, note: 'Остаток на начало', createdById: owner.id },
      { warehouseId: mainWarehouse.id, productId: blank.id, type: StockMovementType.RECEIPT, quantity: 35, note: 'Остаток на начало', createdById: owner.id },
    ],
  });

  const postedPurchase = await prisma.purchase.create({
    data: {
      organizationId: live.id,
      number: 'ЗК-0001',
      title: 'Плёнка и клей',
      counterpartyId: volga.id,
      warehouseId: mainWarehouse.id,
      status: PurchaseStatus.POSTED,
      purchasedAt: new Date('2026-08-20T12:00:00.000Z'),
      note: 'Поставка сырья на основной склад',
      createdById: owner.id,
      items: {
        create: [
          { productId: film.id, name: film.name, quantity: 200, unit: film.unit, price: 85 },
          { productId: glue.id, name: glue.name, quantity: 20, unit: glue.unit, price: 140 },
        ],
      },
      documents: {
        create: {
          title: 'Счёт поставщика',
          number: 'СЧ-4412',
          issuedAt: new Date('2026-08-18T12:00:00.000Z'),
        },
      },
    },
  });
  await prisma.stockMovement.createMany({
    data: [
      {
        warehouseId: mainWarehouse.id,
        productId: film.id,
        type: StockMovementType.RECEIPT,
        quantity: 200,
        note: 'Закупка ЗК-0001',
        purchaseId: postedPurchase.id,
        createdById: owner.id,
      },
      {
        warehouseId: mainWarehouse.id,
        productId: glue.id,
        type: StockMovementType.RECEIPT,
        quantity: 20,
        note: 'Закупка ЗК-0001',
        purchaseId: postedPurchase.id,
        createdById: owner.id,
      },
    ],
  });
  await prisma.purchase.create({
    data: {
      organizationId: live.id,
      number: 'ЗК-0002',
      title: 'Коробки упаковочные',
      counterpartyId: kozlova.id,
      warehouseId: mainWarehouse.id,
      status: PurchaseStatus.DRAFT,
      purchasedAt: new Date('2026-08-27T12:00:00.000Z'),
      createdById: owner.id,
      items: {
        create: [{ productId: box.id, name: box.name, quantity: 100, unit: box.unit, price: 12 }],
      },
    },
  });

  const panelType = await prisma.productionType.create({
    data: {
      organizationId: live.id,
      name: 'Панель 600×600',
      productId: panel.id,
      warehouseId: mainWarehouse.id,
      stages: {
        create: [
          { name: 'Раскрой', position: 0, outputProductId: blank.id },
          { name: 'Оклейка', position: 1 },
          { name: 'Упаковка', position: 2, outputProductId: panel.id },
        ],
      },
    },
    include: { stages: { orderBy: { position: 'asc' } } },
  });
  const [cut, glueStage, pack] = panelType.stages;
  await prisma.productionStageInput.createMany({
    data: [
      { stageId: cut.id, productId: film.id, quantity: 0.8 },
      { stageId: glueStage.id, productId: glue.id, quantity: 0.15 },
      { stageId: pack.id, productId: blank.id, quantity: 1 },
      { stageId: pack.id, productId: box.id, quantity: 1 },
    ],
  });

  const paused = await prisma.organization.create({
    data: {
      name: 'Приостановленная организация',
      licenseStatus: LicenseStatus.SUSPENDED,
    },
  });
  const pausedAdmin = await prisma.role.create({
    data: {
      organizationId: paused.id,
      name: 'Администратор',
      pages: allPages,
      locked: true,
    },
  });
  await prisma.user.create({
    data: {
      organizationId: paused.id,
      email: 'suspended@faverum.local',
      name: 'Иван Петров',
      role: UserRole.ADMIN,
      roleId: pausedAdmin.id,
      status: AccessStatus.ACTIVE,
    },
  });

  console.log(`Seeded organization ${live.name}`);
  console.log('Active admin: owner@faverum.local');
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
