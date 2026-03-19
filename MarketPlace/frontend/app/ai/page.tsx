"use client"

import { ChatBox } from '@/components/chat-box'
import { AgentInfo } from '@/components/agent-info'

export default function AIPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary text-sm">
          <span>{'>'}_</span>
          <span>ai.terminal.connect()</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground">AI Interface</h1>
        <p className="text-muted-foreground">
          Interact with tools using natural language. Type commands and the AI will route your requests.
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <AgentInfo />
          
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-foreground font-semibold mb-3 flex items-center gap-2">
              <span className="text-primary">{'>'}</span>
              Commands
            </h3>
            <ul className="space-y-3 text-sm">
              <li className="text-muted-foreground">
                <code className="text-accent block mb-1">{'"Get weather in [city]"'}</code>
                <span className="text-xs">1 credit</span>
              </li>
              <li className="text-muted-foreground">
                <code className="text-accent block mb-1">{'"Get BTC/ETH price"'}</code>
                <span className="text-xs">1 credit</span>
              </li>
              <li className="text-muted-foreground">
                <code className="text-accent block mb-1">{'"Generate QR for [data]"'}</code>
                <span className="text-xs">2 credits</span>
              </li>
              <li className="text-muted-foreground">
                <code className="text-accent block mb-1">{'"Research [topic]"'}</code>
                <span className="text-xs">3 credits</span>
              </li>
            </ul>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-foreground font-semibold mb-3 flex items-center gap-2">
              <span className="text-primary">{'>'}</span>
              How it works
            </h3>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Type a natural command</li>
              <li>AI detects intent</li>
              <li>Pseudonym generated</li>
              <li>API called privately</li>
              <li>Response displayed</li>
            </ol>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="lg:col-span-3">
          <ChatBox />
        </div>
      </div>
    </div>
  )
}
