-- Add metadata fields to brand_images for better organization
-- Supports tagging with product names, page titles, and custom tags

ALTER TABLE brand_images 
ADD COLUMN IF NOT EXISTS source_page TEXT,           -- Full source page URL
ADD COLUMN IF NOT EXISTS page_title TEXT,            -- Title of the page (e.g., "Knot Buster")
ADD COLUMN IF NOT EXISTS product_name TEXT,          -- Product name if from product page
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[]; -- Custom tags for filtering

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_brand_images_product ON brand_images(product_name) WHERE product_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brand_images_tags ON brand_images USING GIN(tags) WHERE tags IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brand_images_source ON brand_images(source_page);

-- Helper function to extract product name from Shopify URL
CREATE OR REPLACE FUNCTION extract_product_name_from_url(url TEXT) 
RETURNS TEXT AS $$
DECLARE
  product_path TEXT;
  product_slug TEXT;
BEGIN
  -- Extract product slug from URL like /products/knot-buster
  IF url LIKE '%/products/%' THEN
    product_path := substring(url from '/products/([^/?#]+)');
    -- Convert slug to readable name (knot-buster -> Knot Buster)
    product_slug := replace(product_path, '-', ' ');
    RETURN initcap(product_slug);
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON COLUMN brand_images.source_page IS 'URL of the page where this image was found';
COMMENT ON COLUMN brand_images.page_title IS 'Title/name of the page (product name, collection name, etc.)';
COMMENT ON COLUMN brand_images.product_name IS 'Product name if image is from a product page';
COMMENT ON COLUMN brand_images.tags IS 'Custom tags for filtering and organization';
