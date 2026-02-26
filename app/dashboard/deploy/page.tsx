'use client'

import { useState, useEffect } from 'react'
import {
  Rocket,
  Check,
  Loader2,
  Mail,
  MessageSquare,
  Tag,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Brand } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { TEMPLATE_REGISTRY } from '@/lib/templates/types'
import { TemplatePreviewIframe } from '@/components/TemplatePreviewIframe'

type DeployStep =
  | 'select-brand'
  | 'select-templates'
  | 'preview-templates'
  | 'prepare-templates'
  | 'configure-lists'
  | 'configure-form'
  | 'configure-coupon'
  | 'select-flows'
  | 'review'
  | 'deploying'
  | 'complete'

interface TemplateOverride {
  subjectLine?: string
  preheaderText?: string
}

interface BrandList {
  id: string
  list_name: string
  list_type: string
  klaviyo_list_id?: string
}

interface BrandForm {
  id: string
  form_name: string
  embed_code?: string
  klaviyo_form_url?: string
}

interface BrandCoupon {
  id: string
  coupon_name: string
  discount_value: number
  discount_type: string
}

const STEPS = [
  { key: 'select-brand',      label: 'Select Brand' },
  { key: 'select-templates',  label: 'Select Templates' },
  { key: 'preview-templates', label: 'Preview Templates' },
  { key: 'prepare-templates', label: 'Prepare Templates' },
  { key: 'configure-lists',   label: 'Create Lists' },
  { key: 'configure-form',    label: 'Signup Form' },
  { key: 'configure-coupon',  label: 'Welcome Coupon' },
  { key: 'select-flows',      label: 'Select Flows' },
  { key: 'review',            label: 'Review & Deploy' },
]

export default function DeployPage() {
  const [step, setStep] = useState<DeployStep>('select-brand')
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set())
  const [lists, setLists] = useState<{ email?: BrandList; sms?: BrandList }>({})
  const [form, setForm] = useState<BrandForm | null>(null)
  const [coupon, setCoupon] = useState<BrandCoupon | null>(null)
  const [couponCode, setCouponCode] = useState('WELCOME10')
  const [selectedFlows, setSelectedFlows] = useState<Set<string>>(new Set())
  const [templateOverrides, setTemplateOverrides] = useState<Record<string, TemplateOverride>>({})
  const [loading, setLoading] = useState(true)
  const [processingStep, setProcessingStep] = useState(false)

  useEffect(() => { loadBrands() }, [])

  async function loadBrands() {
    try {
      const supabase = createClient()
      const { data } = await supabase.from('brands').select('*').order('name')
      setBrands(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function toggleTemplate(id: string) {
    const s = new Set(selectedTemplates)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelectedTemplates(s)
  }

  function toggleFlow(id: string) {
    const s = new Set(selectedFlows)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelectedFlows(s)
  }

  async function handleCreateLists() {
    if (!selectedBrand) return
    setProcessingStep(true)
    try {
      const res = await fetch('/api/lists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId: selectedBrand.id, apiKey: selectedBrand.klaviyo_api_key }) })
      const data = await res.json()
      if (data.success) { setLists({ email: data.lists.email, sms: data.lists.sms }); setStep('configure-form') }
      else alert('Failed to create lists')
    } catch { alert('Failed to create lists') } finally { setProcessingStep(false) }
  }

  async function handleCreateForm() {
    if (!selectedBrand || !lists.email || !lists.sms) return
    setProcessingStep(true)
    try {
      const res = await fetch('/api/forms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId: selectedBrand.id, apiKey: selectedBrand.klaviyo_api_key, emailListId: lists.email.id, smsListId: lists.sms.id }) })
      const data = await res.json()
      if (data.success) { setForm(data.form); setStep('configure-coupon') }
      else alert('Failed to create form')
    } catch { alert('Failed to create form') } finally { setProcessingStep(false) }
  }

  async function handleCreateCoupon() {
    if (!selectedBrand) return
    setProcessingStep(true)
    try {
      const res = await fetch('/api/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId: selectedBrand.id, apiKey: selectedBrand.klaviyo_api_key, couponCode, description: `${selectedBrand.name} Welcome Discount`, discountType: 'percentage', discountValue: 10 }) })
      const data = await res.json()
      if (data.success) { setCoupon(data.coupon); setStep('select-flows') }
      else alert('Failed to create coupon')
    } catch { alert('Failed to create coupon') } finally { setProcessingStep(false) }
  }

  async function handleDeploy() {
    if (!selectedBrand?.klaviyo_api_key) { alert('Please add a Klaviyo API key first'); return }
    setStep('deploying')
    try {
      const res = await fetch('/api/deploy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId: selectedBrand.id, apiKey: selectedBrand.klaviyo_api_key, templates: Array.from(selectedTemplates), templateOverrides: Object.keys(templateOverrides).length ? templateOverrides : undefined, brand: { name: selectedBrand.name, primaryColor: selectedBrand.primary_color ?? '#000000', secondaryColor: selectedBrand.secondary_color ?? '#ffffff', accentColor: selectedBrand.accent_color ?? '#000000', fontPrimary: selectedBrand.font_primary ?? 'Helvetica, Arial, sans-serif', logoUrl: selectedBrand.logo_url } }) })
      const data = await res.json()
      if (data.success) setStep('complete')
      else { setStep('review'); alert(data.error ?? 'Deployment failed') }
    } catch { setStep('review'); alert('Deployment failed') }
  }

  const currentStepIdx = STEPS.findIndex((s) => s.key === step)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Deploy Wizard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Step {Math.min(currentStepIdx + 1, STEPS.length)} of {STEPS.length}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">

        {/* ── Step progress sidebar ── */}
        <div className="space-y-1">
          {STEPS.map((s, i) => {
            const isDone = i < currentStepIdx
            const isActive = i === currentStepIdx
            return (
              <div
                key={s.key}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  isActive ? 'bg-white border font-semibold text-foreground' : isDone ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  isDone || isActive ? 'bg-primary text-primary-foreground' : 'bg-gray-200 text-gray-500'
                }`}>
                  {isDone ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                {s.label}
              </div>
            )
          })}
        </div>

        {/* ── Main content ── */}
        <div className="bg-white border rounded-xl overflow-hidden min-h-[480px] flex flex-col">

          {step === 'select-brand' && (
            <StepShell title="Select a Brand" desc="Choose the brand you want to deploy" onBack={undefined} onContinue={() => setStep('select-templates')} continueDisabled={!selectedBrand}>
              {brands.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-4">No brands found</p>
                  <a href="/dashboard/brands/new" className="text-sm text-primary hover:underline">Add a brand first</a>
                </div>
              ) : (
                <div className="space-y-2">
                  {brands.map((brand) => (
                    <div key={brand.id} onClick={() => setSelectedBrand(brand)} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${selectedBrand?.id === brand.id ? 'border-primary bg-primary/5' : 'hover:border-gray-300'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: brand.primary_color || '#000' }} />
                        <div>
                          <div className="font-medium text-sm">{brand.name}</div>
                          <div className="text-xs text-muted-foreground">{brand.website_url}</div>
                        </div>
                      </div>
                      {!brand.klaviyo_api_key && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">No API key</span>}
                    </div>
                  ))}
                </div>
              )}
            </StepShell>
          )}

          {step === 'select-templates' && (
            <StepShell title="Select Templates" desc={`Choose templates for ${selectedBrand?.name}`} onBack={() => setStep('select-brand')} onContinue={() => setStep('preview-templates')} continueDisabled={selectedTemplates.size === 0} continueLabel={`Continue (${selectedTemplates.size} selected)`}>
              <div className="space-y-2">
                {TEMPLATE_REGISTRY.map((template) => (
                  <div key={template.id} onClick={() => toggleTemplate(template.id)} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${selectedTemplates.has(template.id) ? 'border-primary bg-primary/5' : 'hover:border-gray-300'}`}>
                    <div>
                      <div className="font-medium text-sm">{template.name}</div>
                      <div className="text-xs text-muted-foreground">{template.description}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedTemplates.has(template.id) ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                      {selectedTemplates.has(template.id) && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </div>
                ))}
              </div>
            </StepShell>
          )}

          {step === 'preview-templates' && (
            <StepShell title="Preview Templates" desc={`Templates with ${selectedBrand?.name}'s brand applied`} onBack={() => setStep('select-templates')} onContinue={() => setStep('prepare-templates')}>
              <div className="space-y-6">
                {Array.from(selectedTemplates).map((templateId) => {
                  const template = TEMPLATE_REGISTRY.find((t) => t.id === templateId)
                  return (
                    <div key={templateId} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Branded</span>
                        <span className="font-medium text-sm">{template?.name}</span>
                      </div>
                      <TemplatePreviewIframe brandId={selectedBrand!.id} templateId={templateId} className="w-full border rounded-lg bg-white overflow-hidden" style={{ height: '420px' }} />
                    </div>
                  )
                })}
              </div>
            </StepShell>
          )}

          {step === 'prepare-templates' && (
            <StepShell title="Prepare Templates" desc="Set subject lines and preheader text" onBack={() => setStep('preview-templates')} onContinue={() => setStep('configure-lists')}>
              <div className="space-y-4">
                {Array.from(selectedTemplates).map((templateId) => {
                  const template = TEMPLATE_REGISTRY.find((t) => t.id === templateId)
                  const override = templateOverrides[templateId] || {}
                  return (
                    <div key={templateId} className="p-4 rounded-lg border space-y-3">
                      <div className="font-medium text-sm">{template?.name}</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={`subject-${templateId}`} className="text-xs">Subject line</Label>
                          <Input id={`subject-${templateId}`} value={override.subjectLine ?? ''} onChange={(e) => setTemplateOverrides((prev) => ({ ...prev, [templateId]: { ...prev[templateId], subjectLine: e.target.value || undefined } }))} placeholder={`e.g. Welcome to ${selectedBrand?.name ?? 'your brand'}`} className="mt-1 text-sm" />
                        </div>
                        <div>
                          <Label htmlFor={`preheader-${templateId}`} className="text-xs">Preheader text</Label>
                          <Input id={`preheader-${templateId}`} value={override.preheaderText ?? ''} onChange={(e) => setTemplateOverrides((prev) => ({ ...prev, [templateId]: { ...prev[templateId], preheaderText: e.target.value || undefined } }))} placeholder="Preview text shown in inbox" className="mt-1 text-sm" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </StepShell>
          )}

          {step === 'configure-lists' && (
            <StepShell title="Create Subscriber Lists" desc="Create email and SMS lists in Klaviyo" onBack={() => setStep('prepare-templates')} onContinue={handleCreateLists} continueLabel={processingStep ? 'Creating…' : 'Create Lists'} continueDisabled={processingStep} continueLoading={processingStep}>
              <div className="text-center py-10">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-7 w-7 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">We'll create two lists in Klaviyo: one for email subscribers and one for SMS.</p>
              </div>
            </StepShell>
          )}

          {step === 'configure-form' && (
            <StepShell title="Create Signup Form" desc="Generate an embeddable form with email and SMS fields" onBack={() => setStep('configure-lists')} onContinue={handleCreateForm} continueLabel={processingStep ? 'Creating…' : 'Create Form'} continueDisabled={processingStep} continueLoading={processingStep}>
              <div className="text-center py-10">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="h-7 w-7 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">Generate an embeddable signup form that connects to your new lists.</p>
              </div>
            </StepShell>
          )}

          {step === 'configure-coupon' && (
            <StepShell title="Create Welcome Discount" desc="Create a coupon code for new subscribers" onBack={() => setStep('configure-form')} onContinue={handleCreateCoupon} continueLabel={processingStep ? 'Creating…' : 'Create Coupon'} continueDisabled={processingStep || !couponCode} continueLoading={processingStep}>
              <div className="space-y-4 max-w-sm">
                <div>
                  <Label htmlFor="couponCode" className="text-xs">Coupon Code</Label>
                  <Input id="couponCode" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="WELCOME10" className="mt-1 font-mono" />
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                  <span className="text-muted-foreground">Discount: </span>
                  <span className="font-medium">10% off first order</span>
                </div>
              </div>
            </StepShell>
          )}

          {step === 'select-flows' && (
            <StepShell title="Select Flows" desc="Choose which automation flows to create (optional)" onBack={() => setStep('configure-coupon')} onContinue={() => setStep('review')}>
              <div className="space-y-2">
                {['welcome', 'abandoned_cart', 'browse_abandonment', 'winback'].map((flowId) => (
                  <div key={flowId} onClick={() => toggleFlow(flowId)} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${selectedFlows.has(flowId) ? 'border-primary bg-primary/5' : 'hover:border-gray-300'}`}>
                    <span className="font-medium text-sm capitalize">{flowId.replace(/_/g, ' ')}</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedFlows.has(flowId) ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                      {selectedFlows.has(flowId) && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </div>
                ))}
              </div>
            </StepShell>
          )}

          {step === 'review' && (
            <StepShell title="Review & Deploy" desc="Confirm everything before deploying to Klaviyo" onBack={() => setStep('select-flows')} onContinue={handleDeploy} continueLabel="Deploy to Klaviyo" continueIcon={<Rocket className="h-3.5 w-3.5" />}>
              <div className="space-y-0 divide-y">
                <ReviewRow label="Brand" value={selectedBrand?.name ?? '—'} />
                <ReviewRow label={`Templates (${selectedTemplates.size})`} value={Array.from(selectedTemplates).map((id) => TEMPLATE_REGISTRY.find((t) => t.id === id)?.name ?? id).join(', ')} />
                <ReviewRow label="Lists" value="Email + SMS" done />
                <ReviewRow label="Signup form" value="Created" done />
                <ReviewRow label="Coupon" value={`${couponCode} — 10% off`} done />
                {selectedFlows.size > 0 && <ReviewRow label={`Flows (${selectedFlows.size})`} value={Array.from(selectedFlows).map((id) => id.replace(/_/g, ' ')).join(', ')} />}
              </div>
            </StepShell>
          )}

          {step === 'deploying' && (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <h3 className="text-lg font-semibold">Deploying to Klaviyo…</h3>
              <p className="text-sm text-muted-foreground mt-1">This may take a moment</p>
            </div>
          )}

          {step === 'complete' && (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Check className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Deployment Complete!</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-8">Everything has been deployed to {selectedBrand?.name}&apos;s Klaviyo account</p>
              <div className="space-y-2 max-w-xs text-left mb-8">
                {[`${selectedTemplates.size} Templates`, '2 Lists (Email + SMS)', '1 Signup Form', '1 Discount Coupon', ...(selectedFlows.size > 0 ? [`${selectedFlows.size} Flows`] : [])].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setStep('select-brand'); setSelectedTemplates(new Set()); setSelectedFlows(new Set()); setTemplateOverrides({}); setLists({}); setForm(null); setCoupon(null) }} className="text-sm border rounded-lg px-4 py-2 hover:bg-gray-50 transition">
                  Deploy More
                </button>
                <a href="/dashboard" className="text-sm font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 transition">
                  Back to Dashboard
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Step shell ───────────────────────────────────────────────────────────────

function StepShell({ title, desc, children, onBack, onContinue, continueDisabled, continueLabel, continueLoading, continueIcon }: {
  title: string; desc: string; children: React.ReactNode
  onBack?: () => void; onContinue?: () => void
  continueDisabled?: boolean; continueLabel?: string; continueLoading?: boolean; continueIcon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col flex-1">
      <div className="px-6 py-5 border-b">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
      <div className="px-6 py-4 border-t flex items-center justify-between">
        {onBack ? (
          <button onClick={onBack} className="text-sm border rounded-lg px-4 py-2 hover:bg-gray-50 transition">← Back</button>
        ) : <div />}
        {onContinue && (
          <button onClick={onContinue} disabled={continueDisabled} className="flex items-center gap-1.5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed">
            {continueLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {continueIcon && !continueLoading && continueIcon}
            {continueLabel ?? 'Continue →'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Review row ───────────────────────────────────────────────────────────────

function ReviewRow({ label, value, done }: { label: string; value: string; done?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="text-sm text-muted-foreground flex-shrink-0">{label}</span>
      <span className={`text-sm font-medium text-right ${done ? 'text-primary' : ''}`}>{value}</span>
    </div>
  )
}
