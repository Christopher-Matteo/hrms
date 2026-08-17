import { db, branchesTable } from "@workspace/db";
import { sql, ilike } from "drizzle-orm";

async function main() {
  console.log("Searching for Redfox T Nagar branch...");
  
  // Find any branch matching 'Redfox T Nagar'
  const branches = await db
    .select()
    .from(branchesTable)
    .where(ilike(branchesTable.name, "Redfox T Nagar"));

  if (branches.length === 0) {
    console.error("No branch matching 'Redfox T Nagar' found!");
    process.exit(1);
  }

  const targetBranch = branches[0];
  console.log(`Found branch: ${targetBranch.name} (ID: ${targetBranch.id})`);
  
  console.log("Updating branch coordinates...");
  const [updated] = await db
    .update(branchesTable)
    .set({
      latitude: "13.053921",
      longitude: "80.233352"
    })
    .where(sql`id = ${targetBranch.id}`)
    .returning();

  console.log("Successfully updated branch:", updated);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to update branch:", err);
  process.exit(1);
});
