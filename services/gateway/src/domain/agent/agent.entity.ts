import type { AgentType, AgentStatus } from '@peanut/shared-types';
import { ValidationError } from '../errors.js';

export interface AgentProps {
  id: string;
  name: string;
  type: AgentType;
  endpoint: string;
  model: string;
  maxTokens: number;
  temperature: number;
  priority: number;
  weight: number;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class Agent {
  private constructor(private readonly props: AgentProps) {}

  static create(props: Omit<AgentProps, 'createdAt' | 'updatedAt'>): Agent {
    Agent.validate(props);
    return new Agent({
      ...props,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: AgentProps): Agent {
    return new Agent(props);
  }

  private static validate(props: Pick<AgentProps, 'name' | 'endpoint' | 'model' | 'temperature' | 'weight' | 'priority'>): void {
    if (!props.name || props.name.trim().length < 2) {
      throw new ValidationError('Agent name must be at least 2 characters');
    }
    if (!props.endpoint || !props.endpoint.startsWith('http')) {
      throw new ValidationError('Agent endpoint must be a valid HTTP/HTTPS URL');
    }
    if (!props.model || props.model.trim().length === 0) {
      throw new ValidationError('Agent model is required');
    }
    if (props.temperature < 0 || props.temperature > 2) {
      throw new ValidationError('Temperature must be between 0 and 2');
    }
    if (props.weight < 1 || props.weight > 100) {
      throw new ValidationError('Weight must be between 1 and 100');
    }
    if (props.priority < 1 || props.priority > 10) {
      throw new ValidationError('Priority must be between 1 and 10');
    }
  }

  update(updates: Partial<Omit<AgentProps, 'id' | 'createdAt' | 'updatedAt'>>): Agent {
    const updated = { ...this.props, ...updates, updatedAt: new Date() };
    Agent.validate(updated);
    return new Agent(updated);
  }

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get type(): AgentType { return this.props.type; }
  get endpoint(): string { return this.props.endpoint; }
  get model(): string { return this.props.model; }
  get maxTokens(): number { return this.props.maxTokens; }
  get temperature(): number { return this.props.temperature; }
  get priority(): number { return this.props.priority; }
  get weight(): number { return this.props.weight; }
  get tags(): string[] { return [...this.props.tags]; }
  get metadata(): Record<string, unknown> { return { ...this.props.metadata }; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  toObject(): AgentProps {
    return { ...this.props, tags: [...this.props.tags], metadata: { ...this.props.metadata } };
  }
}

export interface AgentRepository {
  findById(id: string): Promise<Agent | null>;
  findAll(): Promise<Agent[]>;
  findByType(type: AgentType): Promise<Agent[]>;
  save(agent: Agent): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface AgentHealthRepository {
  getHealth(agentId: string): Promise<AgentHealthRecord | null>;
  updateHealth(health: AgentHealthRecord): Promise<void>;
  getHealthHistory(agentId: string, limit: number): Promise<AgentHealthRecord[]>;
}

export interface AgentHealthRecord {
  agentId: string;
  status: AgentStatus;
  latencyMs: number;
  successRate: number;
  requestCount: number;
  errorCount: number;
  lastCheckedAt: Date;
  details: string;
}
