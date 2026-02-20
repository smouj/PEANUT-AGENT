import { describe, it, expect } from 'vitest';
import { Agent } from '../../src/domain/agent/agent.entity.js';
import { ValidationError } from '../../src/domain/errors.js';

const validProps = {
  id: 'agent-1',
  name: 'Test Agent',
  type: 'ollama' as const,
  endpoint: 'http://localhost:11434',
  model: 'qwen2.5:7b',
  maxTokens: 4096,
  temperature: 0.0,
  priority: 5,
  weight: 10,
  tags: ['local', 'test'],
  metadata: { region: 'us-east' },
};

describe('Agent Entity', () => {
  describe('create', () => {
    it('creates a valid agent', () => {
      const agent = Agent.create(validProps);
      expect(agent.id).toBe('agent-1');
      expect(agent.name).toBe('Test Agent');
      expect(agent.type).toBe('ollama');
    });

    it('throws for name too short', () => {
      expect(() => Agent.create({ ...validProps, name: 'A' }))
        .toThrow(ValidationError);
    });

    it('throws for invalid endpoint', () => {
      expect(() => Agent.create({ ...validProps, endpoint: 'not-a-url' }))
        .toThrow(ValidationError);
    });

    it('throws for temperature out of range', () => {
      expect(() => Agent.create({ ...validProps, temperature: 3.0 }))
        .toThrow(ValidationError);
      expect(() => Agent.create({ ...validProps, temperature: -0.1 }))
        .toThrow(ValidationError);
    });

    it('throws for weight out of range', () => {
      expect(() => Agent.create({ ...validProps, weight: 0 }))
        .toThrow(ValidationError);
      expect(() => Agent.create({ ...validProps, weight: 101 }))
        .toThrow(ValidationError);
    });

    it('throws for priority out of range', () => {
      expect(() => Agent.create({ ...validProps, priority: 0 }))
        .toThrow(ValidationError);
      expect(() => Agent.create({ ...validProps, priority: 11 }))
        .toThrow(ValidationError);
    });
  });

  describe('update', () => {
    it('returns updated agent immutably', () => {
      const agent = Agent.create(validProps);
      const updated = agent.update({ name: 'Updated Name', weight: 20 });
      expect(updated.name).toBe('Updated Name');
      expect(updated.weight).toBe(20);
      expect(agent.name).toBe('Test Agent'); // original unchanged
    });

    it('throws for invalid updates', () => {
      const agent = Agent.create(validProps);
      expect(() => agent.update({ name: 'X' })).toThrow(ValidationError);
    });
  });

  describe('toObject', () => {
    it('returns a copy of props', () => {
      const agent = Agent.create(validProps);
      const obj = agent.toObject();
      expect(obj.id).toBe(agent.id);
      expect(obj.tags).not.toBe(agent.tags); // deep copy
    });
  });
});
