import { PrismaClient, Role } from "@prisma/client";

// Automatically load .env file if running standalone via tsx/node
try {
  process.loadEnvFile?.();
} catch {
  // Ignored if .env does not exist or environment is already provided
}

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding ApparelFlow ERP database...");

  // ─── Users ───────────────────────────────────────────────────────
  const supervisor = await prisma.user.upsert({
    where: { id: "usr-supervisor-001" },
    update: {},
    create: {
      id: "usr-supervisor-001",
      name: "Ali Khan (Cutting Supervisor)",
      role: Role.cutting_supervisor,
    },
  });

  const verifier = await prisma.user.upsert({
    where: { id: "usr-verifier-001" },
    update: {},
    create: {
      id: "usr-verifier-001",
      name: "Sara Ahmed (Cutting Verifier)",
      role: Role.cutting_verifier,
    },
  });

  const sewingSupervisor = await prisma.user.upsert({
    where: { id: "usr-sewing-001" },
    update: {},
    create: {
      id: "usr-sewing-001",
      name: "Bilal Hussain (Sewing Supervisor)",
      role: Role.sewing_supervisor,
    },
  });

  console.log("✅ Users created:", supervisor.name, verifier.name, sewingSupervisor.name);

  // ─── Recipes ─────────────────────────────────────────────────────
  const poloShirt = await prisma.recipe.upsert({
    where: { name: "Polo Shirt - Classic Fit" },
    update: {},
    create: {
      name: "Polo Shirt - Classic Fit",
      description: "Standard polo shirt with collar and 3-button placket",
      components: {
        create: [
          { componentName: "Front Panel", expectedQty: 2, unit: "pcs" },
          { componentName: "Back Panel", expectedQty: 1, unit: "pcs" },
          { componentName: "Sleeve", expectedQty: 2, unit: "pcs" },
          { componentName: "Collar", expectedQty: 1, unit: "pcs" },
          { componentName: "Cuff", expectedQty: 2, unit: "pcs" },
          { componentName: "Placket", expectedQty: 1, unit: "pcs" },
        ],
      },
    },
  });

  const denim = await prisma.recipe.upsert({
    where: { name: "Denim Jeans - Straight Cut" },
    update: {},
    create: {
      name: "Denim Jeans - Straight Cut",
      description: "5-pocket straight cut denim jeans",
      components: {
        create: [
          { componentName: "Front Leg Panel", expectedQty: 2, unit: "pcs" },
          { componentName: "Back Leg Panel", expectedQty: 2, unit: "pcs" },
          { componentName: "Waistband", expectedQty: 1, unit: "pcs" },
          { componentName: "Pocket Bag", expectedQty: 4, unit: "pcs" },
          { componentName: "Fly Shield", expectedQty: 1, unit: "pcs" },
          { componentName: "Belt Loop", expectedQty: 5, unit: "pcs" },
        ],
      },
    },
  });

  const hoodie = await prisma.recipe.upsert({
    where: { name: "Zip-Up Hoodie" },
    update: {},
    create: {
      name: "Zip-Up Hoodie",
      description: "Full-zip hoodie with kangaroo pocket",
      components: {
        create: [
          { componentName: "Front Body (Left)", expectedQty: 1, unit: "pcs" },
          { componentName: "Front Body (Right)", expectedQty: 1, unit: "pcs" },
          { componentName: "Back Body", expectedQty: 1, unit: "pcs" },
          { componentName: "Hood Panel", expectedQty: 2, unit: "pcs" },
          { componentName: "Sleeve", expectedQty: 2, unit: "pcs" },
          { componentName: "Kangaroo Pocket", expectedQty: 1, unit: "pcs" },
          { componentName: "Ribbed Cuff", expectedQty: 2, unit: "pcs" },
          { componentName: "Ribbed Hem", expectedQty: 1, unit: "pcs" },
        ],
      },
    },
  });

  console.log("✅ Recipes created:", poloShirt.name, denim.name, hoodie.name);

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
