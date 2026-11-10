-- Keep the PostGIS geography column in sync with latitude/longitude.
-- Prisma cannot write `Unsupported` columns, so the application only writes
-- latitude/longitude and the database derives `location`. Triggers and CHECK
-- constraints are invisible to Prisma's schema diffing, so they cause no drift.

ALTER TABLE "Incident"
  ADD CONSTRAINT "Incident_latitude_range"  CHECK ("latitude"  IS NULL OR "latitude"  BETWEEN -90  AND 90),
  ADD CONSTRAINT "Incident_longitude_range" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "Incident_coordinates_pair" CHECK (("latitude" IS NULL) = ("longitude" IS NULL));

CREATE OR REPLACE FUNCTION incident_sync_location() RETURNS trigger AS $$
BEGIN
  IF NEW."latitude" IS NULL OR NEW."longitude" IS NULL THEN
    NEW."location" := NULL;
  ELSE
    NEW."location" := ST_SetSRID(ST_MakePoint(NEW."longitude", NEW."latitude"), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER incident_sync_location
  BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "Incident"
  FOR EACH ROW EXECUTE FUNCTION incident_sync_location();

-- Partial index for the hot path: active incidents on the live map.
CREATE INDEX "Incident_active_location_idx" ON "Incident" USING GIST ("location")
  WHERE "status" <> 'RESOLVED' AND "deletedAt" IS NULL;
