import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { loadCompanyDirectoryWorkbookRows } from "../src/lib/company-directory";

async function main() {
  const rows = loadCompanyDirectoryWorkbookRows();

  if (rows.length === 0) {
    process.stdout.write(
      `${JSON.stringify({ ok: false, inserted: 0, updated: 0, reason: "No rows found." }, null, 2)}\n`
    );
    return;
  }

  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const existing = await prisma.companyDirectory.findUnique({
      where: {
        normalizedName: row.normalizedName,
      },
      select: {
        id: true,
        companyName: true,
        companyCategory: true,
      },
    });

    await prisma.companyDirectory.upsert({
      where: {
        normalizedName: row.normalizedName,
      },
      update: {
        companyName: row.companyName,
        companyCategory: row.companyCategory,
        source: row.source,
      },
      create: row,
    });

    if (existing) {
      updated += 1;
    } else {
      inserted += 1;
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        totalWorkbookRows: rows.length,
        inserted,
        updated,
      },
      null,
      2
    )}\n`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
