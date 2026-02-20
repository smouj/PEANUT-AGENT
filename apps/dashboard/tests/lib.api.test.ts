import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, ApiError } from '../src/lib/api';

describe('API Client', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReset();
  });

  describe('api.get', () => {
    it('returns parsed JSON on success', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'test' }),
      } as Response);

      const result = await api.get<{ data: string }>('/test');
      expect(result.data).toBe('test');
    });

    it('throws ApiError on HTTP error', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: { code: 'NOT_FOUND', message: 'Not found' } }),
      } as Response);

      await expect(api.get('/missing')).rejects.toThrow(ApiError);
    });

    it('returns undefined on 204 No Content', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.reject(new Error('no body')),
      } as Response);

      const result = await api.delete('/resource/1');
      expect(result).toBeUndefined();
    });
  });

  describe('api.post', () => {
    it('sends JSON body', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: '123' }),
      } as Response);

      await api.post('/agents', { name: 'Test' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/agents'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Test' }),
        }),
      );
    });
  });

  describe('ApiError', () => {
    it('has correct properties', () => {
      const err = new ApiError(404, 'NOT_FOUND', 'Resource not found');
      expect(err.status).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toBe('Resource not found');
      expect(err.name).toBe('ApiError');
    });
  });
});
