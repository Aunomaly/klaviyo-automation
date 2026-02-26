import { createClient } from './client'
import { Brand, BrandInsert, BrandImage, BrandImageInsert, TemplateConfig, FlowConfig, UniversalButton } from './types'

// Brand queries
export async function getBrands() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as Brand[]
}

export async function getBrand(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as Brand
}

export async function createBrand(brand: BrandInsert) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('brands')
    .insert(brand)
    .select()
    .single()
  
  if (error) throw error
  return data as Brand
}

export async function updateBrand(id: string, updates: Partial<Brand>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('brands')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as Brand
}

export async function deleteBrand(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('brands')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

// Template config queries
export async function getTemplateConfigs(brandId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('template_configs')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as TemplateConfig[]
}

export async function createTemplateConfig(config: Omit<TemplateConfig, 'id' | 'created_at'>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('template_configs')
    .insert(config)
    .select()
    .single()
  
  if (error) throw error
  return data as TemplateConfig
}

// Flow config queries
export async function getFlowConfigs(brandId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('flow_configs')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as FlowConfig[]
}

export async function createFlowConfig(config: Omit<FlowConfig, 'id' | 'created_at'>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('flow_configs')
    .insert(config)
    .select()
    .single()
  
  if (error) throw error
  return data as FlowConfig
}

// Universal button queries
export async function getUniversalButtons(brandId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('universal_buttons')
    .select('*')
    .eq('brand_id', brandId)
  
  if (error) throw error
  return data as UniversalButton[]
}

export async function createUniversalButton(button: Omit<UniversalButton, 'id' | 'created_at'>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('universal_buttons')
    .insert(button)
    .select()
    .single()
  
  if (error) throw error
  return data as UniversalButton
}

// Brand image queries
export async function getBrandImages(brandId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('brand_images')
    .select('*')
    .eq('brand_id', brandId)
    .order('display_order', { ascending: true })
  
  if (error) throw error
  return data as BrandImage[]
}

export async function getBrandImagesByType(brandId: string, imageType: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('brand_images')
    .select('*')
    .eq('brand_id', brandId)
    .eq('image_type', imageType)
    .order('display_order', { ascending: true })
  
  if (error) throw error
  return data as BrandImage[]
}

export async function getPrimaryBrandImage(brandId: string, imageType: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('brand_images')
    .select('*')
    .eq('brand_id', brandId)
    .eq('image_type', imageType)
    .eq('is_primary', true)
    .single()
  
  if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned
  return data as BrandImage | null
}

export async function createBrandImage(image: BrandImageInsert) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('brand_images')
    .insert(image)
    .select()
    .single()
  
  if (error) throw error
  return data as BrandImage
}

export async function updateBrandImage(id: string, updates: Partial<BrandImage>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('brand_images')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as BrandImage
}

export async function deleteBrandImage(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('brand_images')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

export async function setPrimaryBrandImage(brandId: string, imageId: string, imageType: string) {
  const supabase = createClient()
  
  // Unset current primary
  await supabase
    .from('brand_images')
    .update({ is_primary: false })
    .eq('brand_id', brandId)
    .eq('image_type', imageType)
    .eq('is_primary', true)
  
  // Set new primary
  const { data, error } = await supabase
    .from('brand_images')
    .update({ is_primary: true })
    .eq('id', imageId)
    .select()
    .single()
  
  if (error) throw error
  return data as BrandImage
}
