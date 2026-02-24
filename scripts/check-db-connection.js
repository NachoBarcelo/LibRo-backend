require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRawUnsafe("SELECT 1 as ok");
  console.log("DB connection OK:", result);
}

main()
  .catch((error) => {
    console.error("DB connection FAILED:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
