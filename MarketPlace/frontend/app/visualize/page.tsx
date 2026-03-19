"use client"

import { useAgent } from '@/lib/agent-context'
import { AgentInfo } from '@/components/agent-info'

export default function VisualizePage() {
  const { agentId, pseudonyms } = useAgent()

  // Group pseudonyms by service
  const groupedByService = pseudonyms.reduce((acc, record) => {
    if (!acc[record.service]) {
      acc[record.service] = []
    }
    acc[record.service].push(record)
    return acc
  }, {} as Record<string, typeof pseudonyms>)

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary text-sm">
          <span>{'>'}_</span>
          <span>agent.visualize()</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground">Agent Visualization</h1>
        <p className="text-muted-foreground">
          View your agent identity and pseudonym history across services.
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <AgentInfo />
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Agent Identity Card */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-foreground font-semibold mb-4 flex items-center gap-2">
              <span className="text-primary">{'>'}</span>
              Agent Identity
            </h2>
            
            {agentId ? (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <div className="text-muted-foreground text-xs mb-1">Agent ID</div>
                  <code className="text-foreground text-sm break-all">{agentId}</code>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-muted-foreground text-xs mb-1">Total Requests</div>
                    <div className="text-2xl font-bold text-primary">{pseudonyms.length}</div>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-muted-foreground text-xs mb-1">Services Used</div>
                    <div className="text-2xl font-bold text-accent">{Object.keys(groupedByService).length}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm p-4 bg-muted rounded-lg">
                No agent loaded. Create or load an agent from the Home page.
              </div>
            )}
          </div>

          {/* Pseudonyms by Service */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-foreground font-semibold mb-4 flex items-center gap-2">
              <span className="text-primary">{'>'}</span>
              Pseudonyms by Service
            </h2>
            
            {Object.keys(groupedByService).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(groupedByService).map(([service, records]) => (
                  <div key={service} className="bg-muted rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-accent font-semibold capitalize">{service}</h3>
                      <span className="text-xs text-muted-foreground">
                        {records.length} request{records.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {records.map((record, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between text-sm bg-background/50 px-3 py-2 rounded"
                        >
                          <code className="text-foreground">{record.pseudonym}</code>
                          <span className="text-muted-foreground text-xs">
                            {new Date(record.timestamp).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm p-4 bg-muted rounded-lg">
                No pseudonyms generated yet. Use tools from the Marketplace or AI interface.
              </div>
            )}
          </div>

          {/* Activity Table */}
          {pseudonyms.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-foreground font-semibold mb-4 flex items-center gap-2">
                <span className="text-primary">{'>'}</span>
                Activity Log
              </h2>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Service</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Pseudonym</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...pseudonyms].reverse().map((record, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-2 px-3 text-accent capitalize">{record.service}</td>
                        <td className="py-2 px-3">
                          <code className="text-foreground">{record.pseudonym}</code>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {new Date(record.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
