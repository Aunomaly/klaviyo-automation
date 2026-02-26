'use client'

import { useState } from 'react'
import { Mail, ShoppingCart, Eye, Heart, Clock, GitBranch, Play } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface FlowType {
  id: string
  name: string
  description: string
  trigger: string
  icon: React.ReactNode
  emails: number
  defaultDelays: string[]
  splitTestVariants?: {
    name: string
    delays: string[]
  }[]
}

const flowTypes: FlowType[] = [
  {
    id: 'welcome',
    name: 'Welcome Series',
    description: 'Triggered when someone subscribes to your list',
    trigger: 'List Subscription',
    icon: <Mail className="h-6 w-6" />,
    emails: 3,
    defaultDelays: ['Immediately', '1 day', '3 days'],
  },
  {
    id: 'abandoned_cart',
    name: 'Abandoned Cart',
    description: 'Triggered when someone starts checkout but doesn\'t complete',
    trigger: 'Started Checkout',
    icon: <ShoppingCart className="h-6 w-6" />,
    emails: 3,
    defaultDelays: ['4 hours', '24 hours', '72 hours'],
    splitTestVariants: [
      { name: 'Standard', delays: ['4 hours', '24 hours', '72 hours'] },
      { name: 'Aggressive', delays: ['1 hour', '12 hours', '48 hours'] },
    ],
  },
  {
    id: 'browse_abandonment',
    name: 'Browse Abandonment',
    description: 'Triggered when someone views a product but doesn\'t add to cart',
    trigger: 'Viewed Product',
    icon: <Eye className="h-6 w-6" />,
    emails: 2,
    defaultDelays: ['2 hours', '24 hours'],
  },
  {
    id: 'winback',
    name: 'Winback',
    description: 'Triggered when a customer hasn\'t purchased in a while',
    trigger: 'No Order in 60 Days',
    icon: <Heart className="h-6 w-6" />,
    emails: 2,
    defaultDelays: ['Immediately', '7 days'],
  },
]

export default function FlowsPage() {
  const [selectedFlows, setSelectedFlows] = useState<Set<string>>(new Set())
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null)

  function toggleFlow(flowId: string) {
    const newSelected = new Set(selectedFlows)
    if (newSelected.has(flowId)) {
      newSelected.delete(flowId)
    } else {
      newSelected.add(flowId)
    }
    setSelectedFlows(newSelected)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Email Flows</h1>
          <p className="text-muted-foreground mt-1">
            Configure automated email sequences with split tests
          </p>
        </div>
        {selectedFlows.size > 0 && (
          <Button>
            <Play className="h-4 w-4 mr-2" />
            Deploy {selectedFlows.size} Flow{selectedFlows.size > 1 ? 's' : ''}
          </Button>
        )}
      </div>

      <div className="grid gap-6">
        {flowTypes.map((flow) => {
          const isSelected = selectedFlows.has(flow.id)
          const isExpanded = expandedFlow === flow.id

          return (
            <Card
              key={flow.id}
              className={`transition ${isSelected ? 'ring-2 ring-primary' : ''}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${isSelected ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                      {flow.icon}
                    </div>
                    <div>
                      <CardTitle className="text-xl">{flow.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {flow.description}
                      </CardDescription>
                      <div className="flex items-center gap-4 mt-3 text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Play className="h-3 w-3" />
                          Trigger: {flow.trigger}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {flow.emails} emails
                        </span>
                        {flow.splitTestVariants && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <GitBranch className="h-3 w-3" />
                            Split test ready
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedFlow(isExpanded ? null : flow.id)}
                    >
                      {isExpanded ? 'Hide Details' : 'View Details'}
                    </Button>
                    <Button
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => toggleFlow(flow.id)}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="border-t pt-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Timeline */}
                    <div>
                      <h4 className="font-medium mb-4 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Email Timeline
                      </h4>
                      <div className="space-y-4">
                        {flow.defaultDelays.map((delay, index) => (
                          <div key={index} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-sm">Email {index + 1}</div>
                              <div className="text-sm text-muted-foreground">{delay}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Split Test */}
                    {flow.splitTestVariants && (
                      <div>
                        <h4 className="font-medium mb-4 flex items-center gap-2">
                          <GitBranch className="h-4 w-4" />
                          Split Test Variants
                        </h4>
                        <div className="space-y-3">
                          {flow.splitTestVariants.map((variant, index) => (
                            <div
                              key={index}
                              className="p-3 rounded-lg border bg-gray-50"
                            >
                              <div className="font-medium text-sm mb-2">
                                Variant {String.fromCharCode(65 + index)}: {variant.name}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {variant.delays.map((delay, i) => (
                                  <span key={i} className="flex items-center gap-1">
                                    {i > 0 && <span>→</span>}
                                    {delay}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                          <p className="text-xs text-muted-foreground">
                            50/50 split to test which timing performs better
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Selection summary */}
      {selectedFlows.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-lg flex items-center gap-4">
          <span>{selectedFlows.size} flow{selectedFlows.size > 1 ? 's' : ''} selected</span>
          <Button variant="secondary" size="sm">
            <Play className="h-4 w-4 mr-2" />
            Deploy to Klaviyo
          </Button>
        </div>
      )}
    </div>
  )
}
