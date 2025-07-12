/*
  # Add Geolocation Support

  1. New Columns
    - Add `latitude` and `longitude` to `visits` table for visit location tracking
    - Add `latitude` and `longitude` to `clients` table for permanent client location
  
  2. Changes
    - Both tables get nullable decimal columns for coordinates
    - Existing data remains unchanged
    - New visits will capture location data
    - Client locations set on first visit
*/

-- Add geolocation columns to visits table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'visits' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE visits ADD COLUMN latitude DECIMAL(10, 8);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'visits' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE visits ADD COLUMN longitude DECIMAL(11, 8);
  END IF;
END $$;

-- Add geolocation columns to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE clients ADD COLUMN latitude DECIMAL(10, 8);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE clients ADD COLUMN longitude DECIMAL(11, 8);
  END IF;
END $$;