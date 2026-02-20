import { describe, it, expect } from 'vitest';
import { cn, formatDate, formatBytes, formatDuration, truncate, statusColor, statusBg } from '../src/lib/utils';

describe('Utils', () => {
  describe('cn', () => {
    it('merges class names', () => {
      expect(cn('a', 'b')).toBe('a b');
      expect(cn('px-2', 'px-4')).toBe('px-4'); // tailwind-merge
    });

    it('handles conditional classes', () => {
      expect(cn('base', { active: true, inactive: false })).toBe('base active');
    });

    it('handles undefined values', () => {
      expect(cn('base', undefined, null as unknown as string, false as unknown as string)).toBe('base');
    });
  });

  describe('formatDate', () => {
    it('formats a date string', () => {
      const result = formatDate('2024-01-15T10:30:00Z');
      expect(result).toContain('2024');
      expect(result).toContain('Jan');
    });

    it('formats a Date object', () => {
      const result = formatDate(new Date('2024-06-20T12:00:00Z'));
      expect(result).toContain('2024');
    });
  });

  describe('formatBytes', () => {
    it('returns 0 B for 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('formats kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
    });

    it('formats megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
    });

    it('formats gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('formatDuration', () => {
    it('formats milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('formats seconds', () => {
      expect(formatDuration(1500)).toBe('1.5s');
    });

    it('formats minutes', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
    });

    it('formats hours', () => {
      expect(formatDuration(7200000)).toBe('2h 0m');
    });
  });

  describe('truncate', () => {
    it('returns string unchanged if short enough', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('truncates long strings', () => {
      expect(truncate('hello world', 5)).toBe('hello...');
    });
  });

  describe('statusColor', () => {
    it('returns green for online', () => {
      expect(statusColor('online')).toContain('green');
    });

    it('returns red for offline', () => {
      expect(statusColor('offline')).toContain('red');
    });

    it('returns yellow for degraded', () => {
      expect(statusColor('degraded')).toContain('yellow');
    });

    it('returns gray for unknown status', () => {
      expect(statusColor('unknown')).toContain('gray');
    });
  });

  describe('statusBg', () => {
    it('returns green bg for running', () => {
      expect(statusBg('running')).toContain('green');
    });

    it('returns red bg for stopped', () => {
      expect(statusBg('stopped')).toContain('red');
    });
  });
});
