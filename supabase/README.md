# Supabase Setup

## Quick Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)

2. Copy your project credentials to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

3. Run the migration in Supabase SQL Editor:
   - Go to SQL Editor in your Supabase dashboard
   - Copy and paste the contents of `migrations/001_initial_schema.sql`
   - Click "Run"

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `brands` | Client brand information (colors, fonts, logos, Klaviyo API keys) |
| `universal_buttons` | Klaviyo Universal Content block IDs for buttons |
| `template_configs` | Email template configurations per brand |
| `flow_configs` | Klaviyo flow configurations with split test support |
| `deployment_logs` | Deployment history and error tracking |

### Key Relationships

```
brands
  ├── universal_buttons (1:many)
  ├── template_configs (1:many)
  ├── flow_configs (1:many)
  └── deployment_logs (1:many)
```

## Security Notes

- **Klaviyo API Keys**: Currently stored as plain text. For production, consider:
  - Using Supabase Vault for encryption
  - Implementing field-level encryption
  - Using a secrets manager

- **Row Level Security**: RLS policies are commented out in the migration.
  Enable them after setting up Supabase Auth if you need multi-tenant isolation.
