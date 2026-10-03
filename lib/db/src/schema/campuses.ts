import { doublePrecision, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const campusesTable = pgTable(
  "campus_hubs",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    country: text("country").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    radiusKm: doublePrecision("radius_km").notNull().default(2),
  },
  (table) => [uniqueIndex("campus_hubs_name_unique").on(table.name)],
);

export type CampusHub = typeof campusesTable.$inferSelect;
export const insertCampusHubSchema = createInsertSchema(campusesTable).omit({ id: true });
export type InsertCampusHub = z.infer<typeof insertCampusHubSchema>;