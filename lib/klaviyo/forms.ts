/**
 * Klaviyo Forms API
 * 
 * Create and manage signup forms for collecting email and SMS subscribers.
 */

import { KlaviyoClient } from './client'

export interface KlaviyoForm {
  type: 'form'
  id: string
  attributes: {
    name: string
    form_type: 'embed' | 'flyout' | 'modal'
    fields: FormField[]
    settings: FormSettings
    created: string
    updated: string
  }
}

export interface FormField {
  key: string
  label: string
  type: 'email' | 'phone_number' | 'text' | 'checkbox'
  required: boolean
  placeholder?: string
}

export interface FormSettings {
  success_message?: string
  submit_button_text?: string
  submit_button_color?: string
  background_color?: string
  text_color?: string
  double_opt_in?: boolean
}

export interface CreateFormOptions {
  name: string
  formType?: 'embed' | 'flyout' | 'modal'
  listIds: string[] // Lists to add subscribers to
  fields?: FormField[]
  settings?: FormSettings
}

/**
 * Create a new signup form in Klaviyo
 */
export async function createForm(
  client: KlaviyoClient,
  options: CreateFormOptions
): Promise<KlaviyoForm> {
  const defaultFields: FormField[] = [
    {
      key: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      placeholder: 'Enter your email',
    },
    {
      key: 'phone_number',
      label: 'Phone Number',
      type: 'phone_number',
      required: false,
      placeholder: 'Enter your phone (optional)',
    },
  ]

  const defaultSettings: FormSettings = {
    success_message: 'Thanks for signing up!',
    submit_button_text: 'Subscribe',
    submit_button_color: '#000000',
    background_color: '#FFFFFF',
    text_color: '#000000',
    double_opt_in: true,
  }

  const payload = {
    data: {
      type: 'form',
      attributes: {
        name: options.name,
        form_type: options.formType || 'embed',
        fields: options.fields || defaultFields,
        settings: { ...defaultSettings, ...options.settings },
      },
      relationships: {
        lists: {
          data: options.listIds.map(id => ({ type: 'list', id })),
        },
      },
    },
  }

  const response = await client.post<{ data: KlaviyoForm }>(
    '/forms/',
    payload
  )

  return response.data
}

/**
 * Get all forms
 */
export async function getForms(
  client: KlaviyoClient,
  options?: {
    filter?: string
    pageSize?: number
  }
): Promise<KlaviyoForm[]> {
  let endpoint = '/forms/'
  const params: string[] = []

  if (options?.filter) {
    params.push(`filter=${encodeURIComponent(options.filter)}`)
  }
  if (options?.pageSize) {
    params.push(`page[size]=${options.pageSize}`)
  }

  if (params.length > 0) {
    endpoint += `?${params.join('&')}`
  }

  const response = await client.get<{ data: KlaviyoForm[] }>(endpoint)
  return response.data
}

/**
 * Get a specific form by ID
 */
export async function getForm(
  client: KlaviyoClient,
  formId: string
): Promise<KlaviyoForm> {
  const response = await client.get<{ data: KlaviyoForm }>(`/forms/${formId}/`)
  return response.data
}

/**
 * Update a form
 */
export async function updateForm(
  client: KlaviyoClient,
  formId: string,
  updates: {
    name?: string
    fields?: FormField[]
    settings?: Partial<FormSettings>
  }
): Promise<KlaviyoForm> {
  const payload = {
    data: {
      type: 'form',
      id: formId,
      attributes: updates,
    },
  }

  const response = await client.patch<{ data: KlaviyoForm }>(
    `/forms/${formId}/`,
    payload
  )

  return response.data
}

/**
 * Delete a form
 */
export async function deleteForm(
  client: KlaviyoClient,
  formId: string
): Promise<void> {
  await client.delete(`/forms/${formId}/`)
}

/**
 * Helper: Create a brand signup form with email and SMS fields
 */
export async function createBrandSignupForm(
  client: KlaviyoClient,
  brandName: string,
  listIds: { emailListId: string; smsListId: string },
  brandColors?: {
    primaryColor?: string
    secondaryColor?: string
  }
): Promise<KlaviyoForm> {
  return createForm(client, {
    name: `${brandName} - Newsletter Signup`,
    formType: 'embed',
    listIds: [listIds.emailListId, listIds.smsListId],
    fields: [
      {
        key: 'email',
        label: 'Email Address',
        type: 'email',
        required: true,
        placeholder: 'you@example.com',
      },
      {
        key: 'phone_number',
        label: 'Phone Number (Optional)',
        type: 'phone_number',
        required: false,
        placeholder: '+1 (555) 123-4567',
      },
      {
        key: 'consent_sms',
        label: 'I agree to receive SMS messages',
        type: 'checkbox',
        required: false,
      },
    ],
    settings: {
      success_message: `Thanks for joining ${brandName}! Check your email to confirm.`,
      submit_button_text: 'Join the List',
      submit_button_color: brandColors?.primaryColor || '#000000',
      background_color: '#FFFFFF',
      text_color: brandColors?.secondaryColor || '#000000',
      double_opt_in: true,
    },
  })
}

/**
 * Get form embed code
 */
export function getFormEmbedCode(formId: string): string {
  return `<div class="klaviyo-form-${formId}"></div>
<script async type="text/javascript" src="https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=YOUR_PUBLIC_KEY"></script>`
}

/**
 * Get form URL in Klaviyo
 */
export function getFormUrl(formId: string): string {
  return `https://www.klaviyo.com/form/${formId}/edit`
}
