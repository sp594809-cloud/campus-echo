import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { makeAnonymousAlias } from "./aliases";

function academicDomainFromEmail(email: string | undefined): string | null {
  if (!email) return null;
  const domain = email.split("@").at(-1)?.toLowerCase();
  if (!domain) return null;
  const academicDomain = /(?:\.edu(?:\.[a-z]{2,})?|\.ac\.[a-z]{2,})$/i.test(domain);
  return academicDomain ? domain : null;
}

export async function ensureProfile(userId: string) {
  const [existing] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(profilesTable)
    .values({
      userId,
      alias: makeAnonymousAlias(),
      studentVerified: false,
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;
  const [concurrent] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);
  if (!concurrent) throw new Error("Could not create the anonymous profile.");
  return concurrent;
}

export async function refreshVerifiedStudentStatus(userId: string, user: { id: string; email?: string; email_confirmed_at?: string } | undefined) {
  const domain = user?.id === userId && user.email_confirmed_at ? academicDomainFromEmail(user.email) : null;
  const profile = await ensureProfile(userId);

  const [updated] = await db
    .update(profilesTable)
    .set({
      studentVerified: domain !== null,
      studentEmailDomain: domain,
      updatedAt: new Date(),
    })
    .where(eq(profilesTable.userId, profile.userId))
    .returning();

  return updated;
}