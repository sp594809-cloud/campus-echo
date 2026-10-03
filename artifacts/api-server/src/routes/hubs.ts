import { Router, type IRouter } from "express";
import { GetNearestHubQueryParams, GetNearestHubResponse, ListHubsResponse } from "@workspace/api-zod";
import { db, campusesTable } from "@workspace/db";
import { findNearestHub } from "../lib/geofencing";

const router: IRouter = Router();

router.get("/hubs", async (_req, res): Promise<void> => {
  const hubs = await db.select().from(campusesTable).orderBy(campusesTable.name);
  res.json(ListHubsResponse.parse(hubs));
});

router.get("/hubs/nearest", async (req, res): Promise<void> => {
  const params = GetNearestHubQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const nearest = await findNearestHub(params.data.latitude, params.data.longitude);
  res.json(
    GetNearestHubResponse.parse({
      hub: nearest?.hub ?? null,
      distanceKm: nearest?.distanceKm ?? null,
      withinRadius: nearest?.withinRadius ?? false,
    }),
  );
});

export default router;