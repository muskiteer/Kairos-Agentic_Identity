"use client"

import { useState } from 'react'
import { useAgent, generatePseudonym } from '@/lib/agent-context'
import { Button } from '@/components/ui/button'

interface Tool {
  id: string
  name: string
  description: string
  cost: number
  endpoint: string
}

interface ToolCardProps {
  tool: Tool
}

export function ToolCard({ tool }: ToolCardProps) {
  const { agentId, credits, deductCredits, addPseudonym } = useAgent()
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastPseudonym, setLastPseudonym] = useState<string | null>(null)

  const handleUseTool = async () => {
    if (!agentId) {
      setError('Please create or load an agent first')
      return
    }

    if (credits < tool.cost) {
      setError('Insufficient credits')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    // Generate pseudonym for this request
    const pseudonym = generatePseudonym()
    setLastPseudonym(pseudonym)

    try {
      // Simulate API call (in real app, this would be a fetch)
      await new Promise(resolve => setTimeout(resolve, 800))
      
      // Deduct credits
      const success = deductCredits(tool.cost)
      if (!success) {
        setError('Failed to deduct credits')
        return
      }

      // Record pseudonym usage
      addPseudonym(tool.name, pseudonym)

      // Mock response based on tool type
      const mockResponses: Record<string, string> = {
        weather_api: 'Temperature: 28°C, Humidity: 65%, Condition: Partly Cloudy',
        crypto_api: 'BTC: $67,234.50 (+2.3%), ETH: $3,456.78 (-0.8%)',
        qr_api: 'QR Code generated successfully. Data encoded.',
        research_api: 'Research complete. Found 15 relevant articles on the topic.',
      }

      setResult(mockResponses[tool.id] || 'Operation completed successfully')
    } catch {
      setError('API call failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-foreground font-semibold">{tool.name}</h3>
        <span className="text-xs bg-muted px-2 py-1 rounded text-accent">
          {tool.cost} credit{tool.cost !== 1 ? 's' : ''}
        </span>
      </div>
      
      <p className="text-muted-foreground text-sm mb-4">{tool.description}</p>
      
      <Button
        onClick={handleUseTool}
        disabled={loading || !agentId}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {loading ? 'Processing...' : 'Use Tool'}
      </Button>

      {lastPseudonym && (
        <div className="mt-3 text-xs text-muted-foreground">
          <span className="text-accent">Pseudonym:</span> {lastPseudonym}
        </div>
      )}

      {result && (
        <div className="mt-3 p-3 bg-muted rounded text-sm text-primary border border-primary/20">
          <span className="text-muted-foreground">{'> '}</span>{result}
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 bg-destructive/10 rounded text-sm text-destructive border border-destructive/20">
          {error}
        </div>
      )}
    </div>
  )
}
