"""Tests for CacheStore."""

import time

import pytest

from peanut_agent.cache.store import CacheStore


@pytest.fixture
def cache(tmp_path):
    return CacheStore(cache_dir=str(tmp_path / "cache"), ttl_seconds=5)


class TestCacheBasics:
    def test_put_and_get(self, cache):
        cache.put("key1", {"response": "hello"})
        result = cache.get("key1")
        assert result == {"response": "hello"}

    def test_miss(self, cache):
        result = cache.get("nonexistent")
        assert result is None

    def test_overwrite(self, cache):
        cache.put("k", {"v": 1})
        cache.put("k", {"v": 2})
        assert cache.get("k") == {"v": 2}

    def test_stats_tracking(self, cache):
        cache.put("a", {"v": 1})
        cache.get("a")     # hit
        cache.get("b")     # miss
        cache.get("a")     # hit

        stats = cache.stats()
        assert stats["hits"] == 2
        assert stats["misses"] == 1
        assert stats["entries"] == 1
        assert stats["hit_rate"] == "66.7%"


class TestCacheTTL:
    def test_expired_entry_returns_none(self, tmp_path):
        cache = CacheStore(cache_dir=str(tmp_path / "cache"), ttl_seconds=1)
        cache.put("k", {"v": 1})

        # Wait for expiry
        time.sleep(1.1)
        assert cache.get("k") is None

    def test_prune_expired(self, tmp_path):
        cache = CacheStore(cache_dir=str(tmp_path / "cache"), ttl_seconds=1)
        cache.put("old1", {"v": 1})
        cache.put("old2", {"v": 2})
        time.sleep(1.1)
        cache.put("new1", {"v": 3})

        pruned = cache.prune_expired()
        assert pruned == 2
        assert cache.get("new1") == {"v": 3}


class TestCacheClear:
    def test_clear_all(self, cache):
        cache.put("a", {"v": 1})
        cache.put("b", {"v": 2})
        count = cache.clear()
        assert count == 2
        assert cache.get("a") is None
        assert cache.get("b") is None


class TestMakeKey:
    def test_deterministic(self):
        k1 = CacheStore.make_key("model", [{"role": "user", "content": "hi"}])
        k2 = CacheStore.make_key("model", [{"role": "user", "content": "hi"}])
        assert k1 == k2

    def test_different_messages_different_key(self):
        k1 = CacheStore.make_key("model", [{"role": "user", "content": "hi"}])
        k2 = CacheStore.make_key("model", [{"role": "user", "content": "bye"}])
        assert k1 != k2

    def test_different_models_different_key(self):
        msgs = [{"role": "user", "content": "hi"}]
        k1 = CacheStore.make_key("model-a", msgs)
        k2 = CacheStore.make_key("model-b", msgs)
        assert k1 != k2
