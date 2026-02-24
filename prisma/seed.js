"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const userName = "LibRo User";
    const user = await prisma.user.upsert({
        where: { id: "11111111-1111-1111-1111-111111111111" },
        update: { name: userName },
        create: {
            id: "11111111-1111-1111-1111-111111111111",
            name: userName,
        },
    });
    console.log("Seed completed. Default user:", user);
}
main()
    .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
