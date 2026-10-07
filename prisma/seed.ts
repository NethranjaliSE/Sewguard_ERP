import { PrismaClient, Role, OrderStatus, ComponentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

// Automatically load .env file if running standalone via tsx/node
try {
  process.loadEnvFile?.();
} catch {
  // Ignored if .env does not exist or environment is already provided
}

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding ApparelFlow ERP database...");

  // ─── Users (with bcrypt hashed passwords) ─────────────────────────
  const supervisorHash = await bcrypt.hash("Supervisor@123", 10);
  const verifierHash = await bcrypt.hash("Verifier@123", 10);
  const sewingHash = await bcrypt.hash("Sewing@123", 10);

  const supervisor = await prisma.user.upsert({
    where: { id: "usr-supervisor-001" },
    update: {
      email: "supervisor@apparelfow.com",
      name: "Cutting Supervisor",
      role: Role.cutting_supervisor,
      passwordHash: supervisorHash,
    },
    create: {
      id: "usr-supervisor-001",
      email: "supervisor@apparelfow.com",
      name: "Cutting Supervisor",
      role: Role.cutting_supervisor,
      passwordHash: supervisorHash,
    },
  });

  const verifier = await prisma.user.upsert({
    where: { id: "usr-verifier-001" },
    update: {
      email: "verifier@apparelfow.com",
      name: "Cutting Verifier",
      role: Role.cutting_verifier,
      passwordHash: verifierHash,
    },
    create: {
      id: "usr-verifier-001",
      email: "verifier@apparelfow.com",
      name: "Cutting Verifier",
      role: Role.cutting_verifier,
      passwordHash: verifierHash,
    },
  });

  const sewingSupervisor = await prisma.user.upsert({
    where: { id: "usr-sewing-001" },
    update: {
      email: "sewing@apparelfow.com",
      name: "Sewing Supervisor",
      role: Role.sewing_supervisor,
      passwordHash: sewingHash,
    },
    create: {
      id: "usr-sewing-001",
      email: "sewing@apparelfow.com",
      name: "Sewing Supervisor",
      role: Role.sewing_supervisor,
      passwordHash: sewingHash,
    },
  });

  console.log("✅ Demo users configured with secure bcrypt hashes:");
  console.log("   -", supervisor.email, "=> cutting_supervisor");
  console.log("   -", verifier.email, "=> cutting_verifier");
  console.log("   -", sewingSupervisor.email, "=> sewing_supervisor");

  // ─── Recipe A: Casual Blouse ─────────────────────────────────────
  const blouse = await prisma.recipe.upsert({
    where: { name: "Casual Blouse" },
    update: {
      recipeCode: "REC-BL01",
      category: "Blouse",
      stdFabricYards: 1.8,
      wastageCap: 5.0,
      description: "Standard casual blouse with front & back body panels, sleeves, collar and cuffs.",
    },
    create: {
      recipeCode: "REC-BL01",
      name: "Casual Blouse",
      category: "Blouse",
      stdFabricYards: 1.8,
      wastageCap: 5.0,
      description: "Standard casual blouse with front & back body panels, sleeves, collar and cuffs.",
      components: {
        create: [
          { componentName: "Front Body Panel", piecesPerGarment: 1, expectedQty: 1, unit: "pcs" },
          { componentName: "Back Body Panel", piecesPerGarment: 1, expectedQty: 1, unit: "pcs" },
          { componentName: "Sleeves", piecesPerGarment: 2, expectedQty: 2, unit: "pcs" },
          { componentName: "Collar & Stand", piecesPerGarment: 1, expectedQty: 1, unit: "pcs" },
          { componentName: "Sleeve Cuffs", piecesPerGarment: 2, expectedQty: 2, unit: "pcs" },
        ],
      },
    },
  });

  // Ensure components exist if recipe already existed
  const blouseComponents = [
    { componentName: "Front Body Panel", piecesPerGarment: 1, expectedQty: 1 },
    { componentName: "Back Body Panel", piecesPerGarment: 1, expectedQty: 1 },
    { componentName: "Sleeves", piecesPerGarment: 2, expectedQty: 2 },
    { componentName: "Collar & Stand", piecesPerGarment: 1, expectedQty: 1 },
    { componentName: "Sleeve Cuffs", piecesPerGarment: 2, expectedQty: 2 },
  ];
  for (const c of blouseComponents) {
    await prisma.recipeComponent.upsert({
      where: { recipeId_componentName: { recipeId: blouse.id, componentName: c.componentName } },
      update: { piecesPerGarment: c.piecesPerGarment, expectedQty: c.expectedQty },
      create: {
        recipeId: blouse.id,
        componentName: c.componentName,
        piecesPerGarment: c.piecesPerGarment,
        expectedQty: c.expectedQty,
        unit: "pcs",
      },
    });
  }

  // ─── Recipe B: Crop Top ──────────────────────────────────────────
  const cropTop = await prisma.recipe.upsert({
    where: { name: "Crop Top" },
    update: {
      recipeCode: "REC-CT02",
      category: "Crop Top",
      stdFabricYards: 1.1,
      wastageCap: 8.0,
      description: "Fitted stretch crop top with chest support, neck binding, and accent straps.",
    },
    create: {
      recipeCode: "REC-CT02",
      name: "Crop Top",
      category: "Crop Top",
      stdFabricYards: 1.1,
      wastageCap: 8.0,
      description: "Fitted stretch crop top with chest support, neck binding, and accent straps.",
      components: {
        create: [
          { componentName: "Front Chest Panel", piecesPerGarment: 1, expectedQty: 1, unit: "pcs" },
          { componentName: "Back Support Panel", piecesPerGarment: 1, expectedQty: 1, unit: "pcs" },
          { componentName: "Neck Binding Strip", piecesPerGarment: 1, expectedQty: 1, unit: "pcs" },
          { componentName: "Hem Elastic Casing", piecesPerGarment: 1, expectedQty: 1, unit: "pcs" },
          { componentName: "Side Strap Accents", piecesPerGarment: 2, expectedQty: 2, unit: "pcs" },
        ],
      },
    },
  });

  const cropTopComponents = [
    { componentName: "Front Chest Panel", piecesPerGarment: 1, expectedQty: 1 },
    { componentName: "Back Support Panel", piecesPerGarment: 1, expectedQty: 1 },
    { componentName: "Neck Binding Strip", piecesPerGarment: 1, expectedQty: 1 },
    { componentName: "Hem Elastic Casing", piecesPerGarment: 1, expectedQty: 1 },
    { componentName: "Side Strap Accents", piecesPerGarment: 2, expectedQty: 2 },
  ];
  for (const c of cropTopComponents) {
    await prisma.recipeComponent.upsert({
      where: { recipeId_componentName: { recipeId: cropTop.id, componentName: c.componentName } },
      update: { piecesPerGarment: c.piecesPerGarment, expectedQty: c.expectedQty },
      create: {
        recipeId: cropTop.id,
        componentName: c.componentName,
        piecesPerGarment: c.piecesPerGarment,
        expectedQty: c.expectedQty,
        unit: "pcs",
      },
    });
  }

  console.log("✅ Required recipes configured:", blouse.name, cropTop.name);

  // ─── Demo Orders ─────────────────────────────────────────────────
  // Order 1: Verified Order (ready for Sewing Queue)
  const order1Exists = await prisma.cuttingOrder.findFirst({
    where: { orderNo: "ORD-DEMO-001" },
  });

  if (!order1Exists) {
    const blouseComps = await prisma.recipeComponent.findMany({
      where: { recipeId: blouse.id },
    });

    const targetQty1 = 50;
    const expectedFabric1 = Number((targetQty1 * blouse.stdFabricYards).toFixed(2));
    const actualFabric1 = 92.5; // wastage: ((92.5 - 90)/90)*100 = 2.78% (within 5.0% cap)
    const wastage1 = parseFloat((((actualFabric1 - expectedFabric1) / expectedFabric1) * 100).toFixed(2));

    const order1 = await prisma.cuttingOrder.create({
      data: {
        orderNo: "ORD-DEMO-001",
        recipeId: blouse.id,
        targetQty: targetQty1,
        fabricRollId: "FAB-ROLL-101",
        actualFabricYards: actualFabric1,
        expectedFabricYards: expectedFabric1,
        status: OrderStatus.VERIFIED,
        createdById: supervisor.id,
        verificationItems: {
          create: blouseComps.map((comp) => {
            const exp = comp.piecesPerGarment * targetQty1;
            return {
              recipeComponentId: comp.id,
              expectedQty: exp,
              actualQty: exp, // all match (GREEN)
              status: ComponentStatus.MATCH,
            };
          }),
        },
      },
      include: { verificationItems: { include: { recipeComponent: true } } },
    });

    await prisma.verificationLog.create({
      data: {
        cuttingOrderId: order1.id,
        verifiedById: verifier.id,
        action: "APPROVED",
        decision: "APPROVED",
        wastagePct: wastage1,
        snapshotData: order1.verificationItems.map((vi) => ({
          component: vi.recipeComponent.componentName,
          expectedQty: vi.expectedQty,
          actualQty: vi.actualQty,
          status: vi.status,
        })),
      },
    });
    console.log("✅ Seeded Verified Demo Order: ORD-DEMO-001");
  }

  // Order 2: Pending Verification Order
  const order2Exists = await prisma.cuttingOrder.findFirst({
    where: { orderNo: "ORD-DEMO-002" },
  });

  if (!order2Exists) {
    const cropComps = await prisma.recipeComponent.findMany({
      where: { recipeId: cropTop.id },
    });

    const targetQty2 = 40;
    const expectedFabric2 = Number((targetQty2 * cropTop.stdFabricYards).toFixed(2));
    const actualFabric2 = 45.0;

    await prisma.cuttingOrder.create({
      data: {
        orderNo: "ORD-DEMO-002",
        recipeId: cropTop.id,
        targetQty: targetQty2,
        fabricRollId: "FAB-ROLL-202",
        actualFabricYards: actualFabric2,
        expectedFabricYards: expectedFabric2,
        status: OrderStatus.PENDING_VERIFICATION,
        createdById: supervisor.id,
        verificationItems: {
          create: cropComps.map((comp) => ({
            recipeComponentId: comp.id,
            expectedQty: comp.piecesPerGarment * targetQty2,
            actualQty: null,
            status: null,
          })),
        },
      },
    });
    console.log("✅ Seeded Pending Demo Order: ORD-DEMO-002");
  }

  console.log("\n🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
