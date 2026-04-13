// Run from apps/api so it loads that .env:
//   cd apps/api
//   npx ts-node ../../check-admin-password.ts
//
// Optionally reset the password:
//   npx ts-node ../../check-admin-password.ts --reset
//
// Note: this file uses CommonJS `require()` on purpose so it works with
// `ts-node` even when `tsconfig.json` uses `moduleResolution: "bundler"`.
declare const require: any;
declare const process: any;
require('dotenv/config');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require('@prisma/client');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Pool } = require('pg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaPg } = require('@prisma/adapter-pg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcrypt = require('bcrypt');

const ADMIN_EMAIL = 'admin@examina.com';
const ADMIN_PASSWORD = 'Password123!';

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Run this from apps/api so .env is loaded.');
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const user = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (!user) {
      console.log('User not found:', ADMIN_EMAIL);
      process.exitCode = 1;
      return;
    }

    const isMatch = await bcrypt.compare(ADMIN_PASSWORD, user.passwordHash);
    console.log('User found:', ADMIN_EMAIL);
    console.log('Password matches:', isMatch);

    if (!isMatch && hasFlag('--reset')) {
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await prisma.user.update({
        where: { email: ADMIN_EMAIL },
        data: { passwordHash, isActive: true },
      });
      console.log('Password reset complete.');
      const updated = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
      console.log('Password matches (after reset):', await bcrypt.compare(ADMIN_PASSWORD, updated!.passwordHash));
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
