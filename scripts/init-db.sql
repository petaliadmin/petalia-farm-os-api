-- Run once on the PostgreSQL server to enable PostGIS
-- psql -U postgres -d petalia -f scripts/init-db.sql

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Spatial index on parcelles centroid for proximity queries
-- (table created by TypeORM synchronize — run after first start)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parcelles_centroid_geo
--   ON parcelles USING GIST (ST_GeomFromGeoJSON(centroid::text));
