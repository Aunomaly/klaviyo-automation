-- Klaviyo Automation Platform Database Schema
-- Run this migration in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- BRANDS TABLE
-- Stores client brand information and styling
-- ============================================
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  website_url TEXT,
  
  -- Brand colors
  primary_color TEXT DEFAULT '#000000',
  secondary_color TEXT DEFAULT '#FFFFFF',
  accent_color TEXT DEFAULT '#666666',
  
  -- Typography
  font_primary TEXT DEFAULT 'Helvetica, Arial, sans-serif',
  font_secondary TEXT DEFAULT 'Georgia, serif',
  
  -- Assets
  logo_url TEXT,
  favicon_url TEXT,
  
  -- Klaviyo integration
  klaviyo_api_key TEXT, -- Should be encrypted in production
  klaviyo_public_key TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_brands_name ON brands(name);
CREATE INDEX idx_brands_created_at ON brands(created_at DESC);

-- ============================================
-- UNIVERSAL BUTTONS TABLE
-- Stores Klaviyo Universal Content block IDs for buttons
-- ============================================
CREATE TABLE IF NOT EXISTS universal_buttons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Klaviyo Universal Content block ID
  klaviyo_block_id TEXT NOT NULL,
  
  -- Button configuration
  button_type TEXT NOT NULL DEFAULT 'primary', -- 'primary', 'secondary', 'cta'
  button_text TEXT NOT NULL DEFAULT 'Shop Now',
  button_url TEXT,
  
  -- Styling (stored for reference, actual styling in Klaviyo)
  background_color TEXT,
  text_color TEXT,
  border_radius TEXT DEFAULT '5px',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_universal_buttons_brand ON universal_buttons(brand_id);

-- ============================================
-- TEMPLATE CONFIGS TABLE
-- Stores email template configurations per brand
-- ============================================
CREATE TABLE IF NOT EXISTS template_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Template identification
  template_type TEXT NOT NULL, -- 'welcome_1', 'welcome_2', 'abandoned_cart_1', etc.
  template_name TEXT NOT NULL,
  
  -- Klaviyo integration
  klaviyo_template_id TEXT, -- Set after deployment to Klaviyo
  
  -- Template source
  base_template TEXT NOT NULL, -- Path to base HTML file
  
  -- Customizations applied to base template
  customizations JSONB DEFAULT '{}'::jsonb,
  /*
    Example customizations:
    {
      "subject_line": "Welcome to {{brand_name}}!",
      "preheader": "Get 10% off your first order",
      "hero_headline": "STYLE IN EVERY PIECE",
      "hero_subheadline": "Discover our collection",
      "button_text": "Shop Now",
      "button_url": "https://example.com/shop"
    }
  */
  
  -- Status
  status TEXT DEFAULT 'draft', -- 'draft', 'deployed', 'archived'
  deployed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_template_configs_brand ON template_configs(brand_id);
CREATE INDEX idx_template_configs_type ON template_configs(template_type);
CREATE INDEX idx_template_configs_status ON template_configs(status);

-- ============================================
-- FLOW CONFIGS TABLE
-- Stores Klaviyo flow configurations per brand
-- ============================================
CREATE TABLE IF NOT EXISTS flow_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Flow identification
  flow_type TEXT NOT NULL, -- 'welcome_series', 'abandoned_cart', 'browse_abandonment', 'winback'
  flow_name TEXT NOT NULL,
  
  -- Klaviyo integration
  klaviyo_flow_id TEXT, -- Set after deployment to Klaviyo
  
  -- Trigger configuration
  trigger_type TEXT NOT NULL, -- 'list_subscription', 'started_checkout', 'viewed_product', 'placed_order'
  trigger_config JSONB DEFAULT '{}'::jsonb,
  /*
    Example trigger_config:
    {
      "list_id": "abc123",
      "filter": {"property": "value"}
    }
  */
  
  -- Time delays between emails
  time_delays JSONB DEFAULT '[]'::jsonb,
  /*
    Example time_delays (supports split testing):
    {
      "splits": [
        {"variant": "A", "weight": 50, "delays": ["0", "1d", "3d"]},
        {"variant": "B", "weight": 50, "delays": ["0", "12h", "2d"]}
      ]
    }
    
    Or simple without splits:
    ["0", "1d", "3d"]
  */
  
  -- Templates linked to this flow (in order)
  template_ids UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- Status
  status TEXT DEFAULT 'draft', -- 'draft', 'deployed', 'active', 'paused', 'archived'
  deployed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flow_configs_brand ON flow_configs(brand_id);
CREATE INDEX idx_flow_configs_type ON flow_configs(flow_type);
CREATE INDEX idx_flow_configs_status ON flow_configs(status);

-- ============================================
-- DEPLOYMENT LOGS TABLE
-- Tracks all deployments to Klaviyo
-- ============================================
CREATE TABLE IF NOT EXISTS deployment_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  
  -- What was deployed
  deployment_type TEXT NOT NULL, -- 'template', 'flow', 'button'
  resource_id UUID NOT NULL, -- ID of template_config, flow_config, or universal_button
  klaviyo_resource_id TEXT, -- ID returned from Klaviyo
  
  -- Deployment details
  status TEXT NOT NULL, -- 'success', 'failed', 'pending'
  error_message TEXT,
  request_payload JSONB,
  response_payload JSONB,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deployment_logs_brand ON deployment_logs(brand_id);
CREATE INDEX idx_deployment_logs_type ON deployment_logs(deployment_type);
CREATE INDEX idx_deployment_logs_created ON deployment_logs(created_at DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to brands table
CREATE TRIGGER update_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (Optional - enable if using Supabase Auth)
-- ============================================

-- Enable RLS
-- ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE universal_buttons ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE template_configs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE flow_configs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE deployment_logs ENABLE ROW LEVEL SECURITY;

-- Example policy (enable after setting up auth)
-- CREATE POLICY "Users can view their own brands" ON brands
--   FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- SEED DATA (Optional - for testing)
-- ============================================

-- Uncomment to insert test data
/*
INSERT INTO brands (name, website_url, primary_color, secondary_color)
VALUES 
  ('Demo Brand', 'https://example.com', '#000000', '#FFFFFF');
*/
