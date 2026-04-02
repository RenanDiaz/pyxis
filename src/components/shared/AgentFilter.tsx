import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { UserProfile } from '@/types'

interface AgentFilterProps {
  agents: UserProfile[]
  value: string
  onChange: (value: string) => void
}

function getAgentLabel(agent: UserProfile) {
  return agent.display_name || agent.email
}

export default function AgentFilter({ agents, value, onChange }: AgentFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-[200px]">
        <SelectValue placeholder="Agente" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos los agentes</SelectItem>
        {agents.map((agent) => (
          <SelectItem key={agent.uid} value={agent.uid}>
            {getAgentLabel(agent)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { getAgentLabel }
