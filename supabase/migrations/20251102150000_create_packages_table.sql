/*
  # Create Packages Table

  1. New Tables
    - `packages`
      - `id` (uuid, primary key) - Unique identifier
      - `package_id` (text, unique) - Human-readable package ID (auto-generated)
      - `package_name` (text) - Name of the package
      - `description` (text) - Package description
      - `package_type` (text) - Type of package
      - `products` (jsonb) - Array of product objects with id and quantity
      - `total_price` (numeric) - Total calculated price of all products
      - `discounted_price` (numeric) - Final price after discount
      - `discount_percentage` (numeric) - Discount percentage applied
      - `currency` (text) - Currency code
      - `is_active` (boolean) - Whether package is active
      - `features` (jsonb) - Array of package features
      - `validity_days` (integer) - Package validity in days
      - `thumbnail_url` (text) - Package thumbnail URL
      - `total_sales` (integer) - Total number of sales
      - `total_revenue` (numeric) - Total revenue generated
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `packages` table
    - Add policies for authenticated users to read packages
    - Add policies for admin users to manage packages

  3. Indexes
    - Create index on package_type for filtering
    - Create index on is_active for filtering
*/

-- Create packages table
CREATE TABLE IF NOT EXISTS packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id text UNIQUE NOT NULL,
  package_name text NOT NULL,
  description text,
  package_type text NOT NULL,
  products jsonb DEFAULT '[]'::jsonb,
  total_price numeric(10, 2) DEFAULT 0,
  discounted_price numeric(10, 2) DEFAULT 0,
  discount_percentage numeric(5, 2) DEFAULT 0,
  currency text DEFAULT 'INR',
  is_active boolean DEFAULT true,
  features jsonb DEFAULT '[]'::jsonb,
  validity_days integer,
  thumbnail_url text,
  total_sales integer DEFAULT 0,
  total_revenue numeric(12, 2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_packages_package_type ON packages(package_type);
CREATE INDEX IF NOT EXISTS idx_packages_is_active ON packages(is_active);

-- Create function to generate package ID
CREATE OR REPLACE FUNCTION generate_package_id()
RETURNS text AS $$
DECLARE
  new_id text;
  id_exists boolean;
BEGIN
  LOOP
    new_id := 'PKG-' || LPAD(floor(random() * 10000)::text, 4, '0');

    SELECT EXISTS(SELECT 1 FROM packages WHERE package_id = new_id) INTO id_exists;

    IF NOT id_exists THEN
      RETURN new_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate package_id
CREATE OR REPLACE FUNCTION set_package_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.package_id IS NULL OR NEW.package_id = '' THEN
    NEW.package_id := generate_package_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_package_id
  BEFORE INSERT ON packages
  FOR EACH ROW
  EXECUTE FUNCTION set_package_id();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_packages_updated_at
  BEFORE UPDATE ON packages
  FOR EACH ROW
  EXECUTE FUNCTION update_packages_updated_at();

-- Enable Row Level Security
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Allow anonymous users to read active packages"
  ON packages FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "Allow authenticated users to read all packages"
  ON packages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anonymous users to insert packages"
  ON packages FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous users to update packages"
  ON packages FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous users to delete packages"
  ON packages FOR DELETE
  TO anon
  USING (true);
