-- Migration: 002_create_user_profiles.sql
-- Description: Create user_profiles table for PII and medical data (separate from identity)
-- Constitution: PII isolation, Supabase as Source of Truth

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  age INTEGER CHECK (age >= 0 AND age <= 150),
  biological_sex TEXT CHECK (biological_sex IN ('male', 'female', 'other')),
  height_cm INTEGER CHECK (height_cm >= 50 AND height_cm <= 300),
  weight_kg NUMERIC(5, 2) CHECK (weight_kg >= 2 AND weight_kg <= 500),
  medical_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_medications JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One profile per user
CREATE UNIQUE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

-- Updated_at trigger
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE user_profiles IS 'PII table: age, sex, height, weight, medical history, medications. Isolated from users identity table.';
COMMENT ON COLUMN user_profiles.user_id IS 'Foreign key to users.id (CASCADE delete for GDPR compliance)';
COMMENT ON COLUMN user_profiles.age IS 'User age in years (0-150)';
COMMENT ON COLUMN user_profiles.biological_sex IS 'Biological sex: male, female, other';
COMMENT ON COLUMN user_profiles.height_cm IS 'Height in centimeters (50-300)';
COMMENT ON COLUMN user_profiles.weight_kg IS 'Weight in kilograms (2-500)';
COMMENT ON COLUMN user_profiles.medical_history IS 'JSONB array of medical history entries';
COMMENT ON COLUMN user_profiles.current_medications IS 'JSONB array of current medications';
