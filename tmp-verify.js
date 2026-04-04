const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const result = await prisma.user.updateMany({
    where: { firstName: 'Amanuel' },
    data: { verificationStatus: 'VERIFIED' }
  });
  console.log('Update result:', result);
  await prisma.$disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
