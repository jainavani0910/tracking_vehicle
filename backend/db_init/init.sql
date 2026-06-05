CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 1. Use more efficient data types
CREATE TABLE IF NOT EXISTS vehicle_locations (
    time        TIMESTAMPTZ       NOT NULL,
    vehicle_id  TEXT              NOT NULL, -- TEXT is generally preferred over VARCHAR in PG
    latitude    REAL              NOT NULL, -- REAL (4 bytes) is plenty for GPS precision
    longitude   REAL              NOT NULL, -- DOUBLE (8 bytes) is often overkill for pings
    speed       REAL,
    heading     REAL
);

-- 2. Create the Hypertable
-- Using 1 day chunks is recommended for your volume (864M rows/day)
SELECT create_hypertable('vehicle_locations', 'time', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- 3. Enable Compression (CRITICAL for 10,000 vehicles)
-- This moves data from row-store to column-store, saving ~90% disk space
ALTER TABLE vehicle_locations SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'vehicle_id',
  timescaledb.compress_orderby = 'time DESC'
);

-- 4. Set Policies
-- Compress data after 2 hours (once it's unlikely to be updated)
SELECT add_compression_policy('vehicle_locations', INTERVAL '2 hours', if_not_exists => TRUE);

-- Drop data after 7 days
SELECT add_retention_policy('vehicle_locations', INTERVAL '7 days', if_not_exists => TRUE);

-- 5. Indexing (Optional but helpful)
-- Note: Compression creates its own internal indexes; large manual indexes can slow down INSERTS.
CREATE INDEX IF NOT EXISTS ix_vehicle_time ON vehicle_locations (vehicle_id, time DESC);










-- CREATE EXTENSION IF NOT EXISTS timescaledb;

-- CREATE TABLE IF NOT EXISTS vehicle_locations (
--     time        TIMESTAMPTZ       NOT NULL,
--     vehicle_id  VARCHAR(50)       NOT NULL,
--     latitude    DOUBLE PRECISION  NOT NULL,
--     longitude   DOUBLE PRECISION  NOT NULL,
--     speed       DOUBLE PRECISION,
--     heading     DOUBLE PRECISION
-- );

-- -- Turn into a hypertable partitioned by time
-- SELECT create_hypertable('vehicle_locations', by_range('time'), if_not_exists => TRUE);

-- -- Create an index on vehicle_id and time for faster lookups per vehicle
-- CREATE INDEX IF NOT EXISTS ix_vehicle_time ON vehicle_locations (vehicle_id, time DESC);

-- -- Add retention policy to drop data older than 7 days
-- SELECT add_retention_policy('vehicle_locations', INTERVAL '7 days', if_not_exists => TRUE);
