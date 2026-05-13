/*
  # Create Ship Fixtures Database Schema

  1. New Tables
    - `fixtures` - Main fixtures table storing all shipping fixture data
      - `id` (uuid, primary key)
      - `date_added` (date)
      - `charterers` (text)
      - `qty` (text)
      - `load_port` (text)
      - `discharge_port` (text)
      - `laycan` (text)
      - `vessel` (text)
      - `rate` (text)
      - `status` (text)
      - `grade` (text)
      - `area` (text)
      - `dem` (text)
      - `comments` (text)
      - `position` (text)
      - `open_date` (text)
      - `edit_history` (jsonb)
      - `archived` (boolean)
      - `private` (boolean)
      - `created_at` (timestamp)
    
    - `vessel_owners` - Vessel to owner mapping with DWT
      - `id` (uuid, primary key)
      - `vessel_name` (text, unique)
      - `owner` (text)
      - `dwt` (text)
      - `created_at` (timestamp)
    
    - `port_mappings` - Port to area mapping
      - `id` (uuid, primary key)
      - `port_name` (text, unique)
      - `area` (text)
      - `created_at` (timestamp)
    
    - `charterers` - Charterer names list
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `created_at` (timestamp)
    
    - `grades` - Grade names list
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `created_at` (timestamp)
    
    - `vessel_on_subs` - Isolated vessel on subs entries
      - `id` (uuid, primary key)
      - `vessel` (text)
      - `port` (text)
      - `open_date` (text)
      - `dwt` (text)
      - `owner` (text)
      - `dwt_category` (text)
      - `area` (text)
      - `date_added` (date)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to perform all operations
    - Add policies for anon users to read all data (for public access)
*/

-- Fixtures table
CREATE TABLE IF NOT EXISTS fixtures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_added date DEFAULT CURRENT_DATE,
  charterers text DEFAULT '',
  qty text DEFAULT '',
  load_port text DEFAULT '',
  discharge_port text DEFAULT '',
  laycan text DEFAULT '',
  vessel text DEFAULT '',
  rate text DEFAULT '',
  status text DEFAULT '',
  grade text DEFAULT '',
  area text DEFAULT 'Other',
  dem text DEFAULT '',
  comments text DEFAULT '',
  position text DEFAULT '',
  open_date text DEFAULT '',
  edit_history jsonb DEFAULT '[]'::jsonb,
  archived boolean DEFAULT false,
  private boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fixtures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read fixtures"
  ON fixtures FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert fixtures"
  ON fixtures FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update fixtures"
  ON fixtures FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete fixtures"
  ON fixtures FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Anon users can read fixtures"
  ON fixtures FOR SELECT
  TO anon
  USING (true);

-- Vessel owners table
CREATE TABLE IF NOT EXISTS vessel_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_name text UNIQUE NOT NULL,
  owner text DEFAULT '',
  dwt text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vessel_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vessel_owners"
  ON vessel_owners FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert vessel_owners"
  ON vessel_owners FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update vessel_owners"
  ON vessel_owners FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete vessel_owners"
  ON vessel_owners FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Anon users can read vessel_owners"
  ON vessel_owners FOR SELECT
  TO anon
  USING (true);

-- Port mappings table
CREATE TABLE IF NOT EXISTS port_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  port_name text UNIQUE NOT NULL,
  area text DEFAULT 'Other',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE port_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read port_mappings"
  ON port_mappings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert port_mappings"
  ON port_mappings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update port_mappings"
  ON port_mappings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete port_mappings"
  ON port_mappings FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Anon users can read port_mappings"
  ON port_mappings FOR SELECT
  TO anon
  USING (true);

-- Charterers table
CREATE TABLE IF NOT EXISTS charterers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE charterers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read charterers"
  ON charterers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert charterers"
  ON charterers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete charterers"
  ON charterers FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Anon users can read charterers"
  ON charterers FOR SELECT
  TO anon
  USING (true);

-- Grades table
CREATE TABLE IF NOT EXISTS grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read grades"
  ON grades FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert grades"
  ON grades FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete grades"
  ON grades FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Anon users can read grades"
  ON grades FOR SELECT
  TO anon
  USING (true);

-- Vessel on subs table (isolated from fixtures)
CREATE TABLE IF NOT EXISTS vessel_on_subs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel text NOT NULL,
  port text NOT NULL,
  open_date text NOT NULL,
  dwt text DEFAULT '',
  owner text DEFAULT '',
  dwt_category text DEFAULT '',
  area text DEFAULT 'Other',
  date_added date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vessel_on_subs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vessel_on_subs"
  ON vessel_on_subs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert vessel_on_subs"
  ON vessel_on_subs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update vessel_on_subs"
  ON vessel_on_subs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete vessel_on_subs"
  ON vessel_on_subs FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Anon users can read vessel_on_subs"
  ON vessel_on_subs FOR SELECT
  TO anon
  USING (true);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_fixtures_area ON fixtures(area);
CREATE INDEX IF NOT EXISTS idx_fixtures_vessel ON fixtures(vessel);
CREATE INDEX IF NOT EXISTS idx_fixtures_date_added ON fixtures(date_added);
CREATE INDEX IF NOT EXISTS idx_fixtures_archived ON fixtures(archived);
CREATE INDEX IF NOT EXISTS idx_fixtures_status ON fixtures(status);
CREATE INDEX IF NOT EXISTS idx_vessel_owners_vessel ON vessel_owners(vessel_name);
CREATE INDEX IF NOT EXISTS idx_port_mappings_port ON port_mappings(port_name);
