import { db, pool, campusesTable } from '@workspace/db';
const [name, city, country, latitudeText, longitudeText] = process.argv.slice(2);
const latitude = Number(latitudeText), longitude = Number(longitudeText);
if (!name?.trim() || !city?.trim() || !country?.trim() || !latitudeText || !longitudeText || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
  console.error('Usage: seed:campus "Campus name" "City" "Country" latitude longitude'); process.exit(1);
}
try {
  const [campus] = await db.insert(campusesTable).values({ name, city, country, latitude, longitude, radiusKm: 2 }).onConflictDoUpdate({ target: campusesTable.name, set: { city, country, latitude, longitude } }).returning();
  console.log(`Configured campus: ${campus.name}`);
} finally { await pool.end(); }
