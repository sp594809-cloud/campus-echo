import { asc } from "drizzle-orm";
import { db, campusesTable } from "@workspace/db";

export async function getCommunityHub() {
  const hubs = await db.select().from(campusesTable).orderBy(asc(campusesTable.id));
  const hub = hubs.find(h => h.name === "LJ University, Sarkhej") ?? hubs[0];
  return hub ? { hub } : null;
}
