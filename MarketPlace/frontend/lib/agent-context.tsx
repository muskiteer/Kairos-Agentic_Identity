"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface PseudonymRecord {
  service: string
  pseudonym: string
  timestamp: string
}

interface AgentState {
  agentId: string | null
  credits: number
  pseudonyms: PseudonymRecord[]
}

interface AgentContextType {
  agentId: string | null
  credits: number
  pseudonyms: PseudonymRecord[]
  createAgent: () => void
  loadAgent: (id: string) => void
  deductCredits: (amount: number) => boolean
  addPseudonym: (service: string, pseudonym: string) => void
}

const AgentContext = createContext<AgentContextType | undefined>(undefined)

const INITIAL_CREDITS = 100

function generateAgentId(): string {
  return `agent_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`
}

function generatePseudonym(): string {
  const adjectives = ['swift', 'silent', 'crypto', 'shadow', 'quantum', 'cyber', 'neo', 'flux']
  const nouns = ['fox', 'hawk', 'wolf', 'node', 'cipher', 'proxy', 'ghost', 'byte']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const num = Math.floor(Math.random() * 1000)
  return `${adj}_${noun}_${num}`
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AgentState>({
    agentId: null,
    credits: INITIAL_CREDITS,
    pseudonyms: []
  })

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('agent_state')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setState(parsed)
      } catch {
        console.error('Failed to parse agent state')
      }
    }
  }, [])

  // Save to localStorage on state change
  useEffect(() => {
    if (state.agentId) {
      localStorage.setItem('agent_state', JSON.stringify(state))
    }
  }, [state])

  const createAgent = () => {
    const newState = {
      agentId: generateAgentId(),
      credits: INITIAL_CREDITS,
      pseudonyms: []
    }
    setState(newState)
    localStorage.setItem('agent_state', JSON.stringify(newState))
  }

  const loadAgent = (id: string) => {
    // In a real app, this would fetch from backend
    // For now, just set the ID with default credits
    const saved = localStorage.getItem('agent_state')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.agentId === id) {
        setState(parsed)
        return
      }
    }
    // If not found, create new with the provided ID
    const newState = {
      agentId: id,
      credits: INITIAL_CREDITS,
      pseudonyms: []
    }
    setState(newState)
  }

  const deductCredits = (amount: number): boolean => {
    if (state.credits < amount) {
      return false
    }
    setState(prev => ({
      ...prev,
      credits: prev.credits - amount
    }))
    return true
  }

  const addPseudonym = (service: string, pseudonym: string) => {
    setState(prev => ({
      ...prev,
      pseudonyms: [
        ...prev.pseudonyms,
        {
          service,
          pseudonym: pseudonym || generatePseudonym(),
          timestamp: new Date().toISOString()
        }
      ]
    }))
  }

  return (
    <AgentContext.Provider value={{
      agentId: state.agentId,
      credits: state.credits,
      pseudonyms: state.pseudonyms,
      createAgent,
      loadAgent,
      deductCredits,
      addPseudonym
    }}>
      {children}
    </AgentContext.Provider>
  )
}

export function useAgent() {
  const context = useContext(AgentContext)
  if (context === undefined) {
    throw new Error('useAgent must be used within an AgentProvider')
  }
  return context
}

export { generatePseudonym }
