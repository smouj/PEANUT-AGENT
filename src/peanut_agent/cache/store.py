"""
SQLite-based persistent cache for Peanut Agent.

Caches Ollama API responses keyed by a hash of the request
parameters (model, messages, tools). Supports TTL-based expiry
and hit/miss statistics.
"""

import hashlib
import json
import logging
import sqlite3
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class CacheStore:
    """Persistent response cache backed by SQLite."""

    def __init__(self, cache_dir: str, ttl_seconds: int = 3600) -> None:
        self.ttl = ttl_seconds
        self._hits = 0
        self._misses = 0

        cache_path = Path(cache_dir)
        cache_path.mkdir(parents=True, exist_ok=True)
        db_path = cache_path / "cache.db"

        self._conn = sqlite3.connect(str(db_path))
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS cache (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                ts    REAL NOT NULL
            )
            """
        )
        self._conn.commit()

    # -- Public API --

    def get(self, key: str) -> dict[str, Any] | None:
        """Look up a cached response. Returns None on miss or expiry."""
        row = self._conn.execute(
            "SELECT value, ts FROM cache WHERE key = ?", (key,)
        ).fetchone()

        if row is None:
            self._misses += 1
            return None

        value_json, ts = row
        age = time.time() - ts

        if age > self.ttl:
            # Expired — remove and count as miss
            self._conn.execute("DELETE FROM cache WHERE key = ?", (key,))
            self._conn.commit()
            self._misses += 1
            logger.debug("Cache expired for key=%s (age=%.1fs)", key[:12], age)
            return None

        self._hits += 1
        logger.debug("Cache hit for key=%s (age=%.1fs)", key[:12], age)
        return json.loads(value_json)

    def put(self, key: str, value: dict[str, Any]) -> None:
        """Store a response in the cache."""
        self._conn.execute(
            "INSERT OR REPLACE INTO cache (key, value, ts) VALUES (?, ?, ?)",
            (key, json.dumps(value, ensure_ascii=False), time.time()),
        )
        self._conn.commit()

    def stats(self) -> dict[str, Any]:
        """Return hit/miss statistics."""
        total = self._hits + self._misses
        hit_rate = (self._hits / total * 100) if total > 0 else 0.0
        size = self._conn.execute("SELECT COUNT(*) FROM cache").fetchone()[0]
        return {
            "hits": self._hits,
            "misses": self._misses,
            "total_requests": total,
            "hit_rate": f"{hit_rate:.1f}%",
            "entries": size,
        }

    def clear(self) -> int:
        """Remove all entries. Returns number of deleted rows."""
        cursor = self._conn.execute("DELETE FROM cache")
        self._conn.commit()
        count = cursor.rowcount
        logger.info("Cache cleared: %d entries removed", count)
        return count

    def prune_expired(self) -> int:
        """Remove expired entries. Returns number of deleted rows."""
        cutoff = time.time() - self.ttl
        cursor = self._conn.execute("DELETE FROM cache WHERE ts < ?", (cutoff,))
        self._conn.commit()
        count = cursor.rowcount
        if count > 0:
            logger.info("Pruned %d expired cache entries", count)
        return count

    def close(self) -> None:
        """Close the database connection."""
        self._conn.close()

    # -- Key generation --

    @staticmethod
    def make_key(model: str, messages: list, tools: list | None = None) -> str:
        """Generate a deterministic cache key from request parameters."""
        payload = json.dumps(
            {"model": model, "messages": messages, "tools": tools or []},
            sort_keys=True,
            ensure_ascii=False,
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()
