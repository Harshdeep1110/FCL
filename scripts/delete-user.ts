import "dotenv/config";
import { prisma } from "../src/lib/prisma";

/**
 * Remove a participant by email.
 *
 *   npx tsx scripts/delete-user.ts <email>
 */
async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  if (!email) {
    console.error("Usage: npx tsx scripts/delete-user.ts <email>");
    process.exit(1);
  }

  const deleted = await prisma.user
    .delete({ where: { email } })
    .catch(() => null);

  if (!deleted) {
    console.log(`No user found with email ${email}`);
    return;
  }
  console.log(`✔ Deleted ${deleted.email} (id: ${deleted.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
