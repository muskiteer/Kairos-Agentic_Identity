"use client"

import { useState, useRef, useEffect } from 'react'
import { useAgent, generatePseudonym } from '@/lib/agent-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Message {
  role: 'user' | 'ai'
  content: string
  timestamp: Date
}

// Tool costs
const TOOL_COSTS: Record<string, number> = {
  weather: 1,
  crypto: 1,
  qr: 2,
  research: 3,
}

// Simple intent detection
function detectIntent(input: string): { tool: string | null; query: string } {
  const lower = input.toLowerCase()
  
  if (lower.includes('weather')) {
    const match = lower.match(/weather\s+(?:in\s+)?(.+)/i)
    return { tool: 'weather', query: match?.[1] || 'current location' }
  }
  
  if (lower.includes('btc') || lower.includes('bitcoin') || lower.includes('crypto') || lower.includes('eth') || lower.includes('price')) {
    return { tool: 'crypto', query: input }
  }
  
  if (lower.includes('qr') || lower.includes('generate qr')) {
    const match = lower.match(/qr\s+(?:for\s+)?(.+)/i)
    return { tool: 'qr', query: match?.[1] || 'data' }
  }
  
  if (lower.includes('research') || lower.includes('search') || lower.includes('find')) {
    return { tool: 'research', query: input }
  }
  
  return { tool: null, query: input }
}

// Mock API responses
function getMockResponse(tool: string, query: string): string {
  switch (tool) {
    case 'weather':
      const temps = ['24', '28', '32', '18', '22']
      const conditions = ['Sunny', 'Partly Cloudy', 'Clear', 'Overcast']
      return `${temps[Math.floor(Math.random() * temps.length)]}°C in ${query}. ${conditions[Math.floor(Math.random() * conditions.length)]}.`
    
    case 'crypto':
      const btc = (60000 + Math.random() * 10000).toFixed(2)
      const eth = (3000 + Math.random() * 500).toFixed(2)
      return `BTC: $${btc} | ETH: $${eth}`
    
    case 'qr':
      return `QR Code generated for: "${query}". Ready for download.`
    
    case 'research':
      return `Found ${Math.floor(Math.random() * 20 + 5)} results for "${query}". Top result: Comprehensive analysis available.`
    
    default:
      return 'I can help you with: weather (e.g., "Get weather in Tokyo"), crypto prices, QR generation, and research queries.'
  }
}

export function ChatBox() {
  const { agentId, credits, deductCredits, addPseudonym } = useAgent()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return

    if (!agentId) {
      setMessages(prev => [...prev, {
        role: 'ai',
        content: 'Please create or load an agent from the Home page first.',
        timestamp: new Date()
      }])
      return
    }

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsProcessing(true)

    // Detect intent
    const { tool, query } = detectIntent(input)

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 600))

    let response: string

    if (tool) {
      const cost = TOOL_COSTS[tool]
      
      if (credits < cost) {
        response = `Insufficient credits. ${tool} requires ${cost} credit(s), but you have ${credits}.`
      } else {
        // Deduct credits and generate pseudonym
        deductCredits(cost)
        const pseudonym = generatePseudonym()
        addPseudonym(tool, pseudonym)
        
        response = getMockResponse(tool, query)
      }
    } else {
      response = getMockResponse('help', query)
    }

    const aiMessage: Message = {
      role: 'ai',
      content: response,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, aiMessage])
    setIsProcessing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-[600px] bg-card border border-border rounded-lg">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-primary">{'>'}_</span>
          <span className="text-foreground font-semibold">AI Terminal</span>
        </div>
        <span className="text-xs text-muted-foreground">
          Credits: <span className={credits > 20 ? 'text-primary' : 'text-destructive'}>{credits}</span>
        </span>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-muted-foreground text-sm space-y-2">
            <p>Welcome to the AI Terminal. Try these commands:</p>
            <ul className="list-none space-y-1 ml-4">
              <li><code className="text-accent">{'"Get weather in Delhi"'}</code> - 1 credit</li>
              <li><code className="text-accent">{'"Get BTC price"'}</code> - 1 credit</li>
              <li><code className="text-accent">{'"Generate QR for hello"'}</code> - 2 credits</li>
              <li><code className="text-accent">{'"Research AI agents"'}</code> - 3 credits</li>
            </ul>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2 rounded-lg ${
              msg.role === 'user' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-foreground border border-border'
            }`}>
              <div className="text-xs mb-1 opacity-70">
                {msg.role === 'user' ? 'You' : 'AI'}
              </div>
              <div className="text-sm">{msg.content}</div>
            </div>
          </div>
        ))}
        
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-muted text-foreground border border-border px-4 py-2 rounded-lg">
              <div className="text-xs mb-1 opacity-70">AI</div>
              <div className="text-sm flex items-center gap-2">
                <span className="animate-pulse">Processing</span>
                <span className="text-primary">...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter command..."
            disabled={isProcessing}
            className="flex-1 bg-muted border-border focus:border-primary text-foreground placeholder:text-muted-foreground"
          />
          <Button 
            onClick={handleSend} 
            disabled={isProcessing || !input.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
