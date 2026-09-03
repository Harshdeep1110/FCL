import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

/**
 * Create or update an invite-only participant.
 *
 *   npx tsx scripts/create-user.ts <email> <password> [name] [--admin]
 *
 * Re-running with the same email updates the password / name / admin flag.
 */
async function main() {
  const args = process.argv.slice(2);
  const isAdmin = args.includes("--admin");
  const [email, password, name] = args.filter((a) => a !== "--admin");

  if (!email || !password) {
    console.error(
      "Usage: npx tsx scripts/create-user.ts <email> <password> [name] [--admin]",
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    create: { email: normalizedEmail, name: name ?? null, passwordHash, isAdmin },
    update: { passwordHash, isAdmin, ...(name ? { name } : {}) },
  });

  console.log(
    `✔ ${user.email} ${isAdmin ? "(admin) " : ""}saved (id: ${user.id})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
