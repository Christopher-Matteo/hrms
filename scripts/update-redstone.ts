import { db, branchesTable } from "@workspace/db";
import { sql, ilike } from "drizzle-orm";

async function main() {
  console.log("Searching for Redstone T Nagar branch...");
  
  // Find any branch matching 'Redstone'
  const branches = await db
    .select()
    .from(branchesTable)
    .where(ilike(branchesTable.name, "%redstone%"));

  if (branches.length === 0) {
    console.error("No branch matching 'Redstone' found!");
    process.exit(1);
  }

  const targetBranch = branches[0];
  console.log(`Found branch: ${targetBranch.name} (ID: ${targetBranch.id})`);
  
  console.log("Updating branch coordinates and address...");
  const [updated] = await db
    .update(branchesTable)
    .set({
      address: "Mamabalam Highway, Zone 9 Teynampet, Chennai - 600024, Tamil Nadu, India",
      latitude: "13.053490",
      longitude: "80.234060",
      radius: "200.00"
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
