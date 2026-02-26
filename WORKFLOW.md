# Complete Deployment Workflow

This document outlines the end-to-end workflow for deploying a complete Klaviyo setup for a brand.

## Workflow Overview

The complete workflow takes you from brand scraping to a fully deployed Klaviyo account with templates, flows, lists, forms, and discount codes.

```
Brand Scraping → Template Selection → Figma Design Generation → 
Design Approval → List Creation → Form Creation → Coupon Creation → 
Flow Configuration → Review → Deploy
```

## Step-by-Step Guide

### 1. Brand Scraping & Setup

**What happens:**
- Scrape brand website for colors, fonts, and logos
- Save brand information to database
- Add Klaviyo API key

**Files involved:**
- `app/api/scrape/route.ts` - Website scraping endpoint
- `lib/scraper/` - Python scraping utilities

**Database tables:**
- `brands` - Brand information and styling

---

### 2. Template Selection

**What happens:**
- Choose which email templates to generate
- Templates are selected from the registry

**Options:**
- Welcome Series (3 templates)
- Abandoned Cart (3 templates)
- Browse Abandonment (2 templates)
- Winback (2 templates)

**Files involved:**
- `lib/templates/types.ts` - Template registry

---

### 3. Figma Design Generation

**What happens:**
- Generate visual email designs in Figma using MCP
- Apply brand colors, fonts, and logo
- Create designs for each selected template

**API endpoints:**
- `POST /api/figma/generate` - Generate designs

**Database tables:**
- `figma_designs` - Design records and approval status

**MCP Integration:**
The system uses the Figma MCP server to:
- Generate design frames from brand data
- Apply design specifications
- Create reusable components

---

### 4. Design Approval

**What happens:**
- Review generated Figma designs
- Approve or reject each design
- Request revisions if needed

**API endpoints:**
- `POST /api/figma/approve` - Approve/reject designs
- `PATCH /api/figma/approve` - Update with Figma URLs

**Approval states:**
- `pending` - Awaiting review
- `approved` - Ready for deployment
- `rejected` - Needs revision
- `needs_revision` - Minor changes needed

---

### 5. List Creation

**What happens:**
- Create email subscriber list in Klaviyo
- Create SMS subscriber list in Klaviyo
- Both use double opt-in by default

**API endpoints:**
- `POST /api/lists` - Create lists

**Klaviyo API:**
- `createBrandLists()` - Creates both lists

**Database tables:**
- `brand_lists` - List records with Klaviyo IDs

---

### 6. Form Creation

**What happens:**
- Create signup form with email and SMS fields
- Configure form styling with brand colors
- Generate embed code for website

**API endpoints:**
- `POST /api/forms` - Create signup form

**Klaviyo API:**
- `createBrandSignupForm()` - Creates embeddable form

**Database tables:**
- `brand_forms` - Form records with embed code

**Form fields:**
- Email (required)
- Phone number (optional)
- SMS consent checkbox

---

### 7. Coupon Creation

**What happens:**
- Create welcome discount coupon
- Generate unique coupon code
- Set expiration date (optional)

**API endpoints:**
- `POST /api/coupons` - Create discount coupon

**Klaviyo API:**
- `createWelcomeDiscount()` - Creates coupon and code

**Database tables:**
- `brand_coupons` - Coupon records
- `coupon_codes` - Individual codes

**Default:**
- 10% off first order
- Customizable code (e.g., WELCOME10)

---

### 8. Flow Configuration

**What happens:**
- Select which automated flows to create
- Configure flow timing and split tests
- Link templates to flow emails

**Flow types:**
- **Welcome Series** - 3 emails over 4 days
- **Abandoned Cart** - 3 emails with split test timing
- **Browse Abandonment** - 2 emails
- **Winback** - 2 emails for inactive customers

**API endpoints:**
- Uses existing `/api/deploy` endpoint

**Klaviyo API:**
- `createFlow()` - Creates flow structure
- `generateFlowConfig()` - Generates timing config

---

### 9. Review & Deploy

**What happens:**
- Review all configurations
- Confirm selections
- Deploy everything to Klaviyo

**Deployment includes:**
- ✅ Email templates (from approved Figma designs)
- ✅ Email subscriber list
- ✅ SMS subscriber list
- ✅ Signup form (embeddable)
- ✅ Welcome discount coupon
- ✅ Automated flows (optional)

**API endpoints:**
- `POST /api/deploy` - Deploy templates and flows

---

## Database Schema

### Core Tables

**brands**
- Brand information and styling
- Klaviyo API credentials

**figma_designs**
- Design records from Figma generation
- Approval workflow tracking
- Figma file URLs and preview images

**brand_lists**
- Email and SMS lists
- Klaviyo list IDs

**brand_forms**
- Signup forms
- Embed codes and styling

**brand_coupons**
- Discount coupons
- Expiration and usage tracking

**coupon_codes**
- Individual coupon codes
- Assignment and usage status

**deployment_workflows**
- Tracks complete deployment progress
- Links all created resources

---

## API Reference

### Figma Generation

```typescript
POST /api/figma/generate
{
  "brandId": "uuid",
  "templateTypes": ["welcome_1", "abandoned_cart_1"],
  "figmaFileUrl": "https://figma.com/file/..." // optional
}
```

### Design Approval

```typescript
POST /api/figma/approve
{
  "designId": "uuid",
  "approved": true,
  "rejectionReason": "optional"
}
```

### List Creation

```typescript
POST /api/lists
{
  "brandId": "uuid",
  "apiKey": "pk_..."
}
```

### Form Creation

```typescript
POST /api/forms
{
  "brandId": "uuid",
  "apiKey": "pk_...",
  "emailListId": "uuid",
  "smsListId": "uuid"
}
```

### Coupon Creation

```typescript
POST /api/coupons
{
  "brandId": "uuid",
  "apiKey": "pk_...",
  "couponCode": "WELCOME10",
  "discountType": "percentage",
  "discountValue": 10,
  "expiresAt": "2026-12-31T23:59:59Z" // optional
}
```

---

## Integration with Figma MCP

The system integrates with the Figma MCP server for design generation:

### MCP Tools Used

1. **generate_figma_design** (future)
   - Generates design layers from UI
   - Creates frames in Figma files

2. **get_design_context** (future)
   - Extracts code from Figma designs
   - Converts designs to email HTML

3. **Design Metadata**
   - Colors, fonts, layout specs
   - Component mapping

### Current Implementation

The current implementation creates design records and prompts that can be used with the Figma MCP server. In production, you would:

1. Call MCP server to generate actual Figma designs
2. Store returned Figma file URLs
3. Use MCP to extract code from approved designs
4. Convert to Klaviyo HTML templates

---

## Workflow Tracking

The system tracks deployment progress using the `deployment_workflows` table:

**Steps tracked:**
1. brand_scrape
2. template_selection
3. figma_generation
4. approval
5. klaviyo_deployment
6. list_creation
7. form_creation
8. coupon_creation
9. complete

**Helper functions:**
```sql
-- Create new workflow
SELECT create_deployment_workflow('brand-id', 'Workflow Name');

-- Update progress
SELECT update_workflow_step('workflow-id', 'list_creation', true);

-- Complete workflow
SELECT complete_workflow('workflow-id', true);
```

---

## Next Steps

### To Complete MCP Integration:

1. **Connect to Figma MCP server in API routes**
   ```typescript
   // In /api/figma/generate/route.ts
   // Add actual MCP calls to generate Figma designs
   ```

2. **Extract code from approved designs**
   ```typescript
   // Use get_design_context MCP tool
   // Convert Figma designs to HTML
   ```

3. **Deploy to Klaviyo**
   ```typescript
   // Use converted HTML in createTemplate()
   ```

### To Run the System:

1. **Set up database**
   ```bash
   # Run migrations in Supabase
   001_initial_schema.sql
   002_brand_images.sql
   003_lists_forms_coupons.sql
   ```

2. **Start development server**
   ```bash
   npm run dev
   ```

3. **Access workflow**
   ```
   http://localhost:3000/dashboard/deploy
   ```

---

## Tips for Success

1. **Brand Scraping**
   - Ensure website is accessible
   - Have logo and hero images available
   - Verify color extraction

2. **Figma Designs**
   - Review all designs before approval
   - Check brand colors are applied correctly
   - Verify layout matches template specs

3. **Lists & Forms**
   - Use double opt-in for compliance
   - Customize form styling to match brand
   - Test form embed on website

4. **Coupons**
   - Choose memorable codes
   - Set appropriate expiration dates
   - Track usage in Klaviyo

5. **Flows**
   - Start with welcome series
   - Test timing variations
   - Monitor performance metrics
