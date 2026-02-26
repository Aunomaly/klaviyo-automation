-- Brand Images Migration
-- Stores selected images for each brand, with Klaviyo upload tracking

-- ============================================
-- BRAND IMAGES TABLE
-- Stores images selected by users for use in email templates
-- ============================================
CREATE TABLE IF NOT EXISTS brand_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Image source info
  original_url TEXT NOT NULL,          -- Original URL from scraping
  image_type TEXT NOT NULL,            -- 'logo', 'hero', 'product', 'lifestyle', 'content'
  alt_text TEXT,                       -- Alt text from source
  
  -- Dimensions (if known)
  width INTEGER,
  height INTEGER,
  
  -- Klaviyo upload info
  klaviyo_image_id TEXT,               -- ID from Klaviyo after upload
  klaviyo_image_url TEXT,              -- Hosted URL in Klaviyo
  uploaded_to_klaviyo BOOLEAN DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ,
  
  -- Usage tracking
  is_primary BOOLEAN DEFAULT FALSE,    -- Is this the primary image for its type?
  display_order INTEGER DEFAULT 0,     -- Order for display in UI
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX idx_brand_images_brand ON brand_images(brand_id);
CREATE INDEX idx_brand_images_type ON brand_images(image_type);
CREATE INDEX idx_brand_images_klaviyo ON brand_images(klaviyo_image_id) WHERE klaviyo_image_id IS NOT NULL;

-- Auto-update updated_at timestamp
CREATE TRIGGER update_brand_images_updated_at
  BEFORE UPDATE ON brand_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Ensure only one primary image per type per brand
CREATE UNIQUE INDEX idx_brand_images_primary 
  ON brand_images(brand_id, image_type) 
  WHERE is_primary = TRUE;

-- ============================================
-- HELPER FUNCTION: Set primary image
-- ============================================
CREATE OR REPLACE FUNCTION set_primary_brand_image(
  p_brand_id UUID,
  p_image_id UUID,
  p_image_type TEXT
) RETURNS VOID AS $$
BEGIN
  -- Unset any existing primary for this brand/type
  UPDATE brand_images 
  SET is_primary = FALSE 
  WHERE brand_id = p_brand_id 
    AND image_type = p_image_type 
    AND is_primary = TRUE;
  
  -- Set the new primary
  UPDATE brand_images 
  SET is_primary = TRUE 
  WHERE id = p_image_id;
END;
$$ LANGUAGE plpgsql;
