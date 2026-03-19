"use client"

import { useAgent } from '@/lib/agent-context'

export function AgentInfo() {
  const { agentId, credits } = useAgent()

  if (!agentId) {
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-muted-foreground text-sm">No agent loaded</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-primary">{'>'}</span>
        <span className="text-muted-foreground text-sm">Agent ID:</span>
      </div>
      <code className="block text-xs bg-muted px-3 py-2 rounded text-foreground break-all">
        {agentId}
      </code>
      
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-muted-foreground text-sm">Credits:</span>
        <span className={`font-bold ${credits > 20 ? 'text-primary' : credits > 5 ? 'text-yellow-500' : 'text-destructive'}`}>
          {credits}
        </span>
      </div>
    </div>
  )
}
