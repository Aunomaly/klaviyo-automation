export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      brands: {
        Row: {
          id: string
          name: string
          website_url: string | null
          primary_color: string | null
          secondary_color: string | null
          accent_color: string | null
          font_primary: string | null
          font_secondary: string | null
          logo_url: string | null
          klaviyo_api_key: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          website_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          accent_color?: string | null
          font_primary?: string | null
          font_secondary?: string | null
          logo_url?: string | null
          klaviyo_api_key?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          website_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          accent_color?: string | null
          font_primary?: string | null
          font_secondary?: string | null
          logo_url?: string | null
          klaviyo_api_key?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      brand_images: {
        Row: {
          id: string
          brand_id: string
          original_url: string
          image_type: string
          alt_text: string | null
          width: number | null
          height: number | null
          klaviyo_image_id: string | null
          klaviyo_image_url: string | null
          uploaded_to_klaviyo: boolean
          uploaded_at: string | null
          is_primary: boolean
          display_order: number
          // AI generation fields (migration 006)
          is_ai_generated: boolean
          generation_prompt: string | null
          reference_image_ids: string[] | null
          model: string | null
          provider: string | null
          storage_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          original_url: string
          image_type: string
          alt_text?: string | null
          width?: number | null
          height?: number | null
          klaviyo_image_id?: string | null
          klaviyo_image_url?: string | null
          uploaded_to_klaviyo?: boolean
          uploaded_at?: string | null
          is_primary?: boolean
          display_order?: number
          is_ai_generated?: boolean
          generation_prompt?: string | null
          reference_image_ids?: string[] | null
          model?: string | null
          provider?: string | null
          storage_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          brand_id?: string
          original_url?: string
          image_type?: string
          alt_text?: string | null
          width?: number | null
          height?: number | null
          klaviyo_image_id?: string | null
          klaviyo_image_url?: string | null
          uploaded_to_klaviyo?: boolean
          uploaded_at?: string | null
          is_primary?: boolean
          display_order?: number
          is_ai_generated?: boolean
          generation_prompt?: string | null
          reference_image_ids?: string[] | null
          model?: string | null
          provider?: string | null
          storage_path?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      universal_buttons: {
        Row: {
          id: string
          brand_id: string
          klaviyo_block_id: string
          button_type: string | null
          button_text: string | null
          button_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          klaviyo_block_id: string
          button_type?: string | null
          button_text?: string | null
          button_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          brand_id?: string
          klaviyo_block_id?: string
          button_type?: string | null
          button_text?: string | null
          button_url?: string | null
          created_at?: string
        }
      }
      template_configs: {
        Row: {
          id: string
          brand_id: string
          template_type: string
          klaviyo_template_id: string | null
          base_template: string
          customizations: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          template_type: string
          klaviyo_template_id?: string | null
          base_template: string
          customizations?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          brand_id?: string
          template_type?: string
          klaviyo_template_id?: string | null
          base_template?: string
          customizations?: Json | null
          created_at?: string
        }
      }
      flow_configs: {
        Row: {
          id: string
          brand_id: string
          flow_type: string
          klaviyo_flow_id: string | null
          trigger_type: string
          time_delays: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          flow_type: string
          klaviyo_flow_id?: string | null
          trigger_type: string
          time_delays?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          brand_id?: string
          flow_type?: string
          klaviyo_flow_id?: string | null
          trigger_type?: string
          time_delays?: Json | null
          created_at?: string
        }
      }
    }
  }
}

// Convenience types
export type Brand = Database['public']['Tables']['brands']['Row']
export type BrandInsert = Database['public']['Tables']['brands']['Insert']
export type BrandImage = Database['public']['Tables']['brand_images']['Row']
export type BrandImageInsert = Database['public']['Tables']['brand_images']['Insert']
export type UniversalButton = Database['public']['Tables']['universal_buttons']['Row']
export type TemplateConfig = Database['public']['Tables']['template_configs']['Row']
export type FlowConfig = Database['public']['Tables']['flow_configs']['Row']
