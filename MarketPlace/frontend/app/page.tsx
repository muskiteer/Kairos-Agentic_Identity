"use client"

import { useState } from 'react'
import { useAgent } from '@/lib/agent-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AgentInfo } from '@/components/agent-info'

export default function HomePage() {
  const { agentId, createAgent, loadAgent } = useAgent()
  const [loadId, setLoadId] = useState('')
  const [showLoadInput, setShowLoadInput] = useState(false)

  const handleLoad = () => {
    if (loadId.trim()) {
      loadAgent(loadId.trim())
      setLoadId('')
      setShowLoadInput(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 text-primary text-sm">
          <span>{'>'}_</span>
          <span>system.init()</span>
        </div>
        <h1 className="text-4xl font-bold text-foreground">
          Agentic Identity Marketplace
        </h1>
        <p className="text-muted-foreground">
          Deploy AI agents with privacy-preserving pseudonymous identities
        </p>
      </div>

      {/* Agent Status */}
      <div className="space-y-4">
        <AgentInfo />
      </div>

      {/* Actions */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-primary">{'>'}</span>
          <span className="text-foreground font-semibold">Agent Management</span>
        </div>

        {!agentId ? (
          <div className="space-y-4">
            <Button 
              onClick={createAgent}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12"
            >
              Create New Agent
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            {showLoadInput ? (
              <div className="space-y-3">
                <Input
                  value={loadId}
                  onChange={(e) => setLoadId(e.target.value)}
                  placeholder="Enter Agent ID..."
                  className="bg-muted border-border focus:border-primary text-foreground placeholder:text-muted-foreground"
                />
                <div className="flex gap-2">
                  <Button 
                    onClick={handleLoad}
                    disabled={!loadId.trim()}
                    className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    Load Agent
                  </Button>
                  <Button 
                    onClick={() => setShowLoadInput(false)}
                    variant="outline"
                    className="border-border text-foreground hover:bg-muted"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                onClick={() => setShowLoadInput(true)}
                variant="outline"
                className="w-full border-border text-foreground hover:bg-muted h-12"
              >
                Load Existing Agent
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 text-primary text-sm mb-2">
                <span>{'>'}</span>
                <span>agent.status: ACTIVE</span>
              </div>
              <p className="text-muted-foreground text-sm">
                Your agent is ready. Visit the Marketplace to use tools or try the AI interface.
              </p>
            </div>

            <Button 
              onClick={createAgent}
              variant="outline"
              className="w-full border-border text-foreground hover:bg-muted"
            >
              Create New Agent (Reset)
            </Button>
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-accent font-semibold mb-2">Privacy First</h3>
          <p className="text-muted-foreground text-sm">
            Each tool request uses a unique pseudonym, keeping your agent identity private across services.
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-accent font-semibold mb-2">Credit System</h3>
          <p className="text-muted-foreground text-sm">
            Start with 100 credits. Different tools have different costs. Manage your resources wisely.
          </p>
        </div>
      </div>
    </div>
  )
}
