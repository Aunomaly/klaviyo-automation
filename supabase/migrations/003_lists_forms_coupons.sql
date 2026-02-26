-- Lists, Forms, and Coupons Migration
-- Stores Klaviyo lists, signup forms, and discount coupons per brand

-- ============================================
-- BRAND LISTS TABLE
-- Stores Klaviyo lists for email and SMS subscribers
-- ============================================
CREATE TABLE IF NOT EXISTS brand_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  
  -- List identification
  list_name TEXT NOT NULL,
  list_type TEXT NOT NULL CHECK (list_type IN ('email', 'sms', 'both')),
  
  -- Klaviyo integration
  klaviyo_list_id TEXT,
  klaviyo_list_url TEXT,
  
  -- Settings
  opt_in_process TEXT DEFAULT 'double_opt_in' CHECK (opt_in_process IN ('single_opt_in', 'double_opt_in')),
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  deployed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_brand_lists_brand ON brand_lists(brand_id);
CREATE INDEX idx_brand_lists_type ON brand_lists(list_type);
CREATE INDEX idx_brand_lists_klaviyo ON brand_lists(klaviyo_list_id) WHERE klaviyo_list_id IS NOT NULL;

CREATE TRIGGER update_brand_lists_updated_at
  BEFORE UPDATE ON brand_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- BRAND FORMS TABLE
-- Stores signup forms for collecting subscribers
-- ============================================
CREATE TABLE IF NOT EXISTS brand_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Form identification
  form_name TEXT NOT NULL,
  form_type TEXT DEFAULT 'embed' CHECK (form_type IN ('embed', 'flyout', 'modal')),
  
  -- Klaviyo integration
  klaviyo_form_id TEXT,
  klaviyo_form_url TEXT,
  embed_code TEXT,
  
  -- Associated lists (for multi-list forms)
  email_list_id UUID REFERENCES brand_lists(id),
  sms_list_id UUID REFERENCES brand_lists(id),
  
  -- Form configuration
  fields JSONB DEFAULT '[]'::jsonb,
  /*
    Example fields:
    [
      {"key": "email", "label": "Email", "type": "email", "required": true},
      {"key": "phone_number", "label": "Phone", "type": "phone_number", "required": false}
    ]
  */
  
  settings JSONB DEFAULT '{}'::jsonb,
  /*
    Example settings:
    {
      "success_message": "Thanks for signing up!",
      "submit_button_text": "Subscribe",
      "submit_button_color": "#000000",
      "background_color": "#FFFFFF",
      "double_opt_in": true
    }
  */
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  deployed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_brand_forms_brand ON brand_forms(brand_id);
CREATE INDEX idx_brand_forms_type ON brand_forms(form_type);
CREATE INDEX idx_brand_forms_klaviyo ON brand_forms(klaviyo_form_id) WHERE klaviyo_form_id IS NOT NULL;

CREATE TRIGGER update_brand_forms_updated_at
  BEFORE UPDATE ON brand_forms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- BRAND COUPONS TABLE
-- Stores discount codes and promotions
-- ============================================
CREATE TABLE IF NOT EXISTS brand_coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Coupon identification
  coupon_name TEXT NOT NULL,
  external_id TEXT NOT NULL, -- Your internal identifier
  description TEXT,
  
  -- Klaviyo integration
  klaviyo_coupon_id TEXT,
  klaviyo_coupon_url TEXT,
  
  -- Coupon details
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_shipping')),
  discount_value DECIMAL(10, 2), -- e.g., 10 for 10% or $10
  
  -- Usage
  usage_type TEXT DEFAULT 'multi_use' CHECK (usage_type IN ('single_use', 'multi_use')),
  max_uses INTEGER,
  times_used INTEGER DEFAULT 0,
  
  -- Validity
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired', 'archived')),
  deployed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_brand_coupons_brand ON brand_coupons(brand_id);
CREATE INDEX idx_brand_coupons_status ON brand_coupons(status);
CREATE INDEX idx_brand_coupons_klaviyo ON brand_coupons(klaviyo_coupon_id) WHERE klaviyo_coupon_id IS NOT NULL;
CREATE INDEX idx_brand_coupons_external ON brand_coupons(external_id);

CREATE TRIGGER update_brand_coupons_updated_at
  BEFORE UPDATE ON brand_coupons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COUPON CODES TABLE
-- Individual codes for a coupon (for unique code generation)
-- ============================================
CREATE TABLE IF NOT EXISTS coupon_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID NOT NULL REFERENCES brand_coupons(id) ON DELETE CASCADE,
  
  -- Code details
  code TEXT NOT NULL UNIQUE,
  klaviyo_code_id TEXT,
  
  -- Assignment
  assigned_to TEXT, -- Profile ID or email
  assigned_at TIMESTAMPTZ,
  
  -- Usage
  status TEXT DEFAULT 'unassigned' CHECK (status IN ('unassigned', 'assigned', 'used')),
  used_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coupon_codes_coupon ON coupon_codes(coupon_id);
CREATE INDEX idx_coupon_codes_status ON coupon_codes(status);
CREATE INDEX idx_coupon_codes_code ON coupon_codes(code);
CREATE INDEX idx_coupon_codes_klaviyo ON coupon_codes(klaviyo_code_id) WHERE klaviyo_code_id IS NOT NULL;

-- ============================================
-- FIGMA DESIGNS TABLE
-- Stores Figma design references for email templates
-- ============================================
CREATE TABLE IF NOT EXISTS figma_designs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Design identification
  design_name TEXT NOT NULL,
  design_type TEXT NOT NULL, -- 'email_template', 'flow', 'form'
  
  -- Source
  source_type TEXT NOT NULL CHECK (source_type IN ('generated', 'imported', 'screenshot')),
  source_url TEXT, -- Original image URL if imported
  
  -- Figma integration
  figma_file_id TEXT,
  figma_file_url TEXT,
  figma_frame_id TEXT,
  figma_node_id TEXT,
  
  -- Preview
  preview_image_url TEXT,
  thumbnail_url TEXT,
  
  -- Approval workflow
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_revision')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Template association
  template_config_id UUID REFERENCES template_configs(id) ON DELETE SET NULL,
  
  -- Design metadata
  design_data JSONB DEFAULT '{}'::jsonb,
  /*
    Example design_data:
    {
      "colors": ["#000000", "#FFFFFF"],
      "fonts": ["Helvetica", "Arial"],
      "layout": {"columns": 1, "width": 600},
      "components": ["header", "hero", "cta", "footer"]
    }
  */
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_figma_designs_brand ON figma_designs(brand_id);
CREATE INDEX idx_figma_designs_type ON figma_designs(design_type);
CREATE INDEX idx_figma_designs_status ON figma_designs(approval_status);
CREATE INDEX idx_figma_designs_template ON figma_designs(template_config_id) WHERE template_config_id IS NOT NULL;

CREATE TRIGGER update_figma_designs_updated_at
  BEFORE UPDATE ON figma_designs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DEPLOYMENT WORKFLOW TRACKING
-- Extends deployment_logs to track the full workflow
-- ============================================
CREATE TABLE IF NOT EXISTS deployment_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Workflow identification
  workflow_name TEXT NOT NULL,
  workflow_type TEXT NOT NULL DEFAULT 'full_deployment',
  
  -- Progress tracking
  current_step TEXT NOT NULL DEFAULT 'brand_scrape',
  -- Steps: brand_scrape -> template_selection -> figma_generation -> approval -> 
  --        klaviyo_deployment -> list_creation -> form_creation -> coupon_creation -> complete
  
  steps_completed TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Resources created
  list_ids UUID[] DEFAULT ARRAY[]::UUID[],
  form_ids UUID[] DEFAULT ARRAY[]::UUID[],
  coupon_ids UUID[] DEFAULT ARRAY[]::UUID[],
  template_ids UUID[] DEFAULT ARRAY[]::UUID[],
  flow_ids UUID[] DEFAULT ARRAY[]::UUID[],
  figma_design_ids UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- Status
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'cancelled')),
  error_message TEXT,
  
  -- Metadata
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deployment_workflows_brand ON deployment_workflows(brand_id);
CREATE INDEX idx_deployment_workflows_status ON deployment_workflows(status);
CREATE INDEX idx_deployment_workflows_started ON deployment_workflows(started_at DESC);

CREATE TRIGGER update_deployment_workflows_updated_at
  BEFORE UPDATE ON deployment_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

/**
 * Create a complete deployment workflow
 */
CREATE OR REPLACE FUNCTION create_deployment_workflow(
  p_brand_id UUID,
  p_workflow_name TEXT
) RETURNS UUID AS $$
DECLARE
  v_workflow_id UUID;
BEGIN
  INSERT INTO deployment_workflows (brand_id, workflow_name)
  VALUES (p_brand_id, p_workflow_name)
  RETURNING id INTO v_workflow_id;
  
  RETURN v_workflow_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Update workflow progress
 */
CREATE OR REPLACE FUNCTION update_workflow_step(
  p_workflow_id UUID,
  p_step TEXT,
  p_mark_completed BOOLEAN DEFAULT TRUE
) RETURNS VOID AS $$
BEGIN
  UPDATE deployment_workflows
  SET 
    current_step = p_step,
    steps_completed = CASE 
      WHEN p_mark_completed AND NOT (p_step = ANY(steps_completed))
      THEN array_append(steps_completed, p_step)
      ELSE steps_completed
    END
  WHERE id = p_workflow_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Complete workflow
 */
CREATE OR REPLACE FUNCTION complete_workflow(
  p_workflow_id UUID,
  p_success BOOLEAN DEFAULT TRUE,
  p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE deployment_workflows
  SET 
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    error_message = p_error_message,
    completed_at = NOW()
  WHERE id = p_workflow_id;
END;
$$ LANGUAGE plpgsql;
