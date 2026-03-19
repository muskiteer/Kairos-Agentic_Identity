"use client"

import { ToolCard } from '@/components/tool-card'
import { AgentInfo } from '@/components/agent-info'

const TOOLS = [
  {
    id: 'weather_api',
    name: 'Weather API',
    description: 'Get current weather data for any location worldwide. Returns temperature, humidity, and conditions.',
    cost: 1,
    endpoint: '/tools/weather_api'
  },
  {
    id: 'crypto_api',
    name: 'Crypto Prices',
    description: 'Real-time cryptocurrency price data. Supports BTC, ETH, and major altcoins.',
    cost: 1,
    endpoint: '/tools/crypto_api'
  },
  {
    id: 'qr_api',
    name: 'QR Generator',
    description: 'Generate QR codes for any text, URL, or data. Returns a downloadable image.',
    cost: 2,
    endpoint: '/tools/qr_api'
  },
  {
    id: 'research_api',
    name: 'Research Engine',
    description: 'AI-powered research assistant. Searches and summarizes information on any topic.',
    cost: 3,
    endpoint: '/tools/research_api'
  }
]

export default function MarketplacePage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary text-sm">
          <span>{'>'}_</span>
          <span>marketplace.list()</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground">Tool Marketplace</h1>
        <p className="text-muted-foreground">
          Browse and use available API tools. Each request generates a unique pseudonym for privacy.
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <AgentInfo />
          
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-foreground font-semibold mb-3 flex items-center gap-2">
              <span className="text-primary">{'>'}</span>
              Credit Costs
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between text-muted-foreground">
                <span>Weather</span>
                <span className="text-accent">1 credit</span>
              </li>
              <li className="flex justify-between text-muted-foreground">
                <span>Crypto</span>
                <span className="text-accent">1 credit</span>
              </li>
              <li className="flex justify-between text-muted-foreground">
                <span>QR Code</span>
                <span className="text-accent">2 credits</span>
              </li>
              <li className="flex justify-between text-muted-foreground">
                <span>Research</span>
                <span className="text-accent">3 credits</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="lg:col-span-3">
          <div className="grid md:grid-cols-2 gap-4">
            {TOOLS.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
