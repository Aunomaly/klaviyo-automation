# Klaviyo Automation Platform

A web application to automate email template and flow creation for Klaviyo. Built for agencies and freelancers who set up Klaviyo accounts for multiple clients.

## Features

### Core Features
- **Brand Scraping**: Automatically extract colors, fonts, and logos from client websites
- **Template Engine**: Apply brand customizations to battle-tested email templates
- **Klaviyo Integration**: Deploy templates and flows directly to Klaviyo via API
- **Flow Automation**: Create complete email flows with split tests for timing optimization

### New: Complete Deployment Workflow
- **Figma Design Generation**: Generate visual email designs in Figma using MCP
- **Design Approval**: Review and approve designs before deployment
- **List Management**: Create email and SMS subscriber lists
- **Form Builder**: Generate embeddable signup forms with email and SMS fields
- **Coupon Creation**: Create discount codes for welcome offers
- **End-to-End Automation**: Complete workflow from brand scraping to deployed Klaviyo account

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+ (for scraper)
- Supabase account
- Klaviyo account(s)

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd klaviyo-automation
   npm install
   ```

2. **Install Python dependencies (for scraper):**
   ```bash
   pip install -r lib/scraper/requirements.txt
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.local.example .env.local
   ```
   Edit `.env.local` with your Supabase credentials.

4. **Set up database:**
   - Go to your Supabase SQL Editor
   - Run the migration in `supabase/migrations/001_initial_schema.sql`

5. **Run the development server:**
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
klaviyo-automation/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── scrape/        # Website scraping endpoint
│   │   ├── deploy/        # Klaviyo deployment endpoint
│   │   └── brands/        # Brand CRUD endpoints
│   └── dashboard/         # Dashboard pages
│       ├── brands/        # Brand management
│       ├── templates/     # Template selection
│       ├── flows/         # Flow configuration
│       └── deploy/        # Deployment wizard
├── components/            # React components
│   └── ui/               # UI primitives
├── lib/
│   ├── klaviyo/          # Klaviyo API integration
│   │   ├── client.ts     # Base API client
│   │   ├── templates.ts  # Template API
│   │   ├── flows.ts      # Flows API
│   │   └── universal.ts  # Universal Content API
│   ├── scraper/          # Python brand scraper
│   │   ├── extractors/   # Color, font, image extractors
│   │   └── scraper.py    # Main scraper
│   ├── supabase/         # Database client
│   └── templates/        # Template engine
└── supabase/
    └── migrations/       # Database schema
```

## Usage

### Complete Deployment Workflow

The new workflow takes you from brand scraping to a fully deployed Klaviyo account:

1. **Select Brand** - Choose the client brand to work with
2. **Select Templates** - Pick which email templates to generate
3. **Generate Figma Designs** - Create visual designs using brand guidelines
4. **Approve Designs** - Review and approve each design
5. **Create Lists** - Generate email and SMS subscriber lists
6. **Create Form** - Build a signup form with both email and SMS fields
7. **Create Coupon** - Set up a welcome discount code
8. **Configure Flows** - Select automated flows to create
9. **Review & Deploy** - Confirm and deploy everything to Klaviyo

See [WORKFLOW.md](WORKFLOW.md) for detailed documentation.

### Quick Start (Legacy Workflow)

1. **Add a Brand**
   - Go to Dashboard → Brands → Add Brand
   - Enter the client's website URL
   - Review extracted brand guidelines (colors, fonts, logo)
   - Add the client's Klaviyo API key
   - Save the brand

2. **Deploy Everything**
   - Go to Dashboard → Deploy
   - Follow the complete workflow
   - Approve designs
   - Configure lists, forms, and coupons
   - Deploy to Klaviyo

3. **Edit in Klaviyo**
   - Templates are available in Klaviyo's email editor
   - Use the signup form on your website
   - Track subscriber growth in lists
   - Monitor flow performance

## Template Types

| Category | Templates | Description |
|----------|-----------|-------------|
| Welcome Series | 3 | Onboard new subscribers |
| Abandoned Cart | 3 | Recover lost sales |
| Browse Abandonment | 2 | Re-engage browsers |
| Winback | 2 | Re-activate lapsed customers |

## API Reference

### Brand Scraping

**POST /api/scrape**
```json
{
  "url": "https://example.com"
}
```

### Figma Design Generation

**POST /api/figma/generate**
```json
{
  "brandId": "uuid",
  "templateTypes": ["welcome_1", "abandoned_cart_1"]
}
```

**POST /api/figma/approve**
```json
{
  "designId": "uuid",
  "approved": true
}
```

### List Management

**POST /api/lists**
```json
{
  "brandId": "uuid",
  "apiKey": "pk_..."
}
```

### Form Creation

**POST /api/forms**
```json
{
  "brandId": "uuid",
  "apiKey": "pk_...",
  "emailListId": "uuid",
  "smsListId": "uuid"
}
```

### Coupon Creation

**POST /api/coupons**
```json
{
  "brandId": "uuid",
  "apiKey": "pk_...",
  "couponCode": "WELCOME10",
  "discountType": "percentage",
  "discountValue": 10
}
```

### Template Deployment

**POST /api/deploy**
```json
{
  "brandId": "uuid",
  "apiKey": "pk_...",
  "templates": ["welcome_1", "welcome_2"],
  "brand": {
    "name": "Brand Name",
    "primaryColor": "#000000",
    "secondaryColor": "#FFFFFF",
    "fontPrimary": "Helvetica, Arial, sans-serif"
  }
}
```

## Klaviyo API Notes

- **Template API**: Supports hybrid templates with editable regions
- **Flows API**: May require Partner API access for full functionality
- **Universal Content**: Use for buttons (Template API doesn't support buttons directly)
- **Rate Limits**: Implement exponential backoff for bulk operations

## Security

- Store Klaviyo API keys encrypted in production
- Use Supabase Row Level Security for multi-tenant isolation
- Never expose API keys to the client

## License

Private - All rights reserved
