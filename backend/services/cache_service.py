"""简易内存缓存 - 生产环境替换为 Redis"""
import time
from threading import Lock
from typing import Any

class MemoryCache:
    """线程安全的内存缓存，支持 TTL"""

    def __init__(self, default_ttl: int = 300):
        self._store: dict[str, tuple[float, Any]] = {}
        self._lock = Lock()
        self._default_ttl = default_ttl

    def get(self, key: str) -> Any | None:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expiry, value = entry
            if time.time() > expiry:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl: int | None = None):
        with self._lock:
            expiry = time.time() + (ttl if ttl is not None else self._default_ttl)
            self._store[key] = (expiry, value)

    def clear(self):
        with self._lock:
            self._store.clear()

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._store)


# 全局单例
cache = MemoryCache(default_ttl=300)  # 5 分钟默认 TTL
