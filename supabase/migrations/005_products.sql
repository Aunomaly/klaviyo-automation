-- Products table
-- Stores individual products per brand for product-specific flow building.
-- Shopify stores expose product data at /products/[slug].json (no API key needed).

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,

  -- Product identity
  name TEXT NOT NULL,
  product_url TEXT NOT NULL,          -- Full URL e.g. https://store.com/products/knot-buster
  shopify_product_id TEXT,            -- Shopify numeric ID (from .json response)

  -- Primary image used in email templates
  primary_image_url TEXT,

  -- Additional product images (stored as JSON array of URLs)
  images JSONB DEFAULT '[]'::jsonb,

  -- Product copy
  description TEXT,
  price TEXT,                         -- Stored as text to preserve formatting e.g. "$29.99"
  tagline TEXT,                       -- Short one-liner for email subject/preheader

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_active ON products(brand_id, is_active);

-- Auto-update updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
