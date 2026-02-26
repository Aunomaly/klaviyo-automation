'use client'

import { useState, useEffect } from 'react'
import { Mail, ShoppingCart, Eye, Heart, Check } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TEMPLATE_REGISTRY, TemplateInfo } from '@/lib/templates/types'

const categoryIcons: Record<string, React.ReactNode> = {
  welcome: <Mail className="h-5 w-5" />,
  abandoned_cart: <ShoppingCart className="h-5 w-5" />,
  browse_abandonment: <Eye className="h-5 w-5" />,
  winback: <Heart className="h-5 w-5" />,
  post_purchase: <Check className="h-5 w-5" />,
}

const categoryInfo: Record<string, { name: string; description: string }> = {
  welcome: {
    name: 'Welcome Series',
    description: 'Onboard new subscribers with a warm welcome sequence',
  },
  abandoned_cart: {
    name: 'Abandoned Cart',
    description: 'Recover lost sales by reminding customers about their cart',
  },
  browse_abandonment: {
    name: 'Browse Abandonment',
    description: 'Re-engage visitors who browsed but didn\'t add to cart',
  },
  winback: {
    name: 'Winback',
    description: 'Re-activate lapsed customers who haven\'t purchased recently',
  },
  post_purchase: {
    name: 'Post Purchase',
    description: 'Follow up after a purchase for reviews and repeat sales',
  },
}

export default function TemplatesPage() {
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set())

  // Group templates by category
  const templatesByCategory = TEMPLATE_REGISTRY.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = []
    }
    acc[template.category].push(template)
    return acc
  }, {} as Record<string, TemplateInfo[]>)

  function toggleTemplate(templateId: string) {
    const newSelected = new Set(selectedTemplates)
    if (newSelected.has(templateId)) {
      newSelected.delete(templateId)
    } else {
      newSelected.add(templateId)
    }
    setSelectedTemplates(newSelected)
  }

  function selectCategory(category: string) {
    const categoryTemplates = templatesByCategory[category] || []
    const newSelected = new Set(selectedTemplates)
    
    // Check if all are selected
    const allSelected = categoryTemplates.every(t => selectedTemplates.has(t.id))
    
    if (allSelected) {
      // Deselect all
      categoryTemplates.forEach(t => newSelected.delete(t.id))
    } else {
      // Select all
      categoryTemplates.forEach(t => newSelected.add(t.id))
    }
    
    setSelectedTemplates(newSelected)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground mt-1">
            Select templates to customize and deploy to Klaviyo
          </p>
        </div>
        {selectedTemplates.size > 0 && (
          <Button>
            Deploy {selectedTemplates.size} Template{selectedTemplates.size > 1 ? 's' : ''}
          </Button>
        )}
      </div>

      <div className="space-y-8">
        {Object.entries(templatesByCategory).map(([category, templates]) => {
          const info = categoryInfo[category]
          const allSelected = templates.every(t => selectedTemplates.has(t.id))
          const someSelected = templates.some(t => selectedTemplates.has(t.id))

          return (
            <div key={category}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    {categoryIcons[category]}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{info?.name || category}</h2>
                    <p className="text-sm text-muted-foreground">{info?.description}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectCategory(category)}
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => {
                  const isSelected = selectedTemplates.has(template.id)
                  
                  return (
                    <Card
                      key={template.id}
                      className={`cursor-pointer transition hover:shadow-md ${
                        isSelected ? 'ring-2 ring-primary border-primary' : ''
                      }`}
                      onClick={() => toggleTemplate(template.id)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                              isSelected
                                ? 'bg-primary border-primary'
                                : 'border-gray-300'
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription>{template.description}</CardDescription>
                        {/* Template preview placeholder */}
                        <div className="mt-3 h-32 bg-gray-100 rounded-md flex items-center justify-center text-muted-foreground text-sm">
                          Preview
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Floating action bar */}
      {selectedTemplates.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-lg flex items-center gap-4">
          <span>{selectedTemplates.size} template{selectedTemplates.size > 1 ? 's' : ''} selected</span>
          <Button variant="secondary" size="sm">
            Deploy to Klaviyo
          </Button>
        </div>
      )}
    </div>
  )
}
