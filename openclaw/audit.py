"""
Audit logging for OpenClaw agent self-management actions.
Logs all task creation, editing, and deletion operations.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any

AGENT_DIR = Path(__file__).parent
AUDIT_FILE = AGENT_DIR / "data" / "audit.log"
AUDIT_LOCK = Lock()

DEFAULT_LIMITS = {
    "max_tasks_per_execution": 5,
    "max_tasks_per_day": 20,
    "max_pending_tasks": 50,
    "min_interval_seconds": 300,
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_audit_dir() -> None:
    (AGENT_DIR / "data").mkdir(parents=True, exist_ok=True)


def write_audit(entry: dict[str, Any]) -> None:
    ensure_audit_dir()
    with AUDIT_LOCK:
        try:
            with AUDIT_FILE.open("a") as f:
                f.write(json.dumps(entry, separators=(",", ":")) + "\n")
        except Exception:
            pass


def log_task_created(
    task_id: str,
    task_title: str,
    task_type: str,
    schedule_mode: str,
    context: str | None = None,
) -> None:
    write_audit({
        "timestamp": now_iso(),
        "action": "task_created",
        "task_id": task_id,
        "task_title": task_title[:100] if task_title else "",
        "task_type": task_type,
        "schedule_mode": schedule_mode,
        "context": context,
    })


def log_task_updated(
    task_id: str,
    changes: dict[str, tuple[Any, Any]],
    reason: str | None = None,
) -> None:
    write_audit({
        "timestamp": now_iso(),
        "action": "task_updated",
        "task_id": task_id,
        "changes": {k: {"old": str(v[0])[:100], "new": str(v[1])[:100]} for k, v in changes.items()},
        "reason": reason,
    })


def log_task_cancelled(task_id: str, reason: str | None = None) -> None:
    write_audit({
        "timestamp": now_iso(),
        "action": "task_cancelled",
        "task_id": task_id,
        "reason": reason,
    })


def log_task_deleted(task_id: str, reason: str | None = None) -> None:
    write_audit({
        "timestamp": now_iso(),
        "action": "task_deleted",
        "task_id": task_id,
        "reason": reason,
    })


def log_limit_reached(limit_name: str, current_value: int, limit_value: int) -> None:
    write_audit({
        "timestamp": now_iso(),
        "action": "limit_reached",
        "limit_name": limit_name,
        "current_value": current_value,
        "limit_value": limit_value,
    })


def log_warning(message: str, context: dict[str, Any] | None = None) -> None:
    write_audit({
        "timestamp": now_iso(),
        "action": "warning",
        "message": message,
        "context": context,
    })


def read_audit_logs(limit: int = 100) -> list[dict[str, Any]]:
    if not AUDIT_FILE.exists():
        return []
    try:
        lines = AUDIT_FILE.read_text().splitlines()
        entries = [json.loads(line) for line in lines[-limit:] if line.strip()]
        return entries
    except Exception:
        return []


def count_tasks_today() -> int:
    today = now_iso()[:10]
    logs = read_audit_logs(limit=10000)
    return sum(1 for e in logs if e.get("action") == "task_created" and e.get("timestamp", "")[:10] == today)


def get_audit_stats() -> dict[str, Any]:
    logs = read_audit_logs(limit=10000)
    today = now_iso()[:10]
    return {
        "tasks_created_today": sum(1 for e in logs if e.get("action") == "task_created" and e.get("timestamp", "")[:10] == today),
        "tasks_cancelled_today": sum(1 for e in logs if e.get("action") == "task_cancelled" and e.get("timestamp", "")[:10] == today),
        "limits_reached_today": sum(1 for e in logs if e.get("action") == "limit_reached" and e.get("timestamp", "")[:10] == today),
        "warnings_today": sum(1 for e in logs if e.get("action") == "warning" and e.get("timestamp", "")[:10] == today),
    }


class RateLimiter:
    def __init__(self, limits: dict[str, int] | None = None):
        self.limits = {**DEFAULT_LIMITS, **(limits or {})}
        self._execution_count = 0
        self._last_reset = now_iso()[:10]

    def check_limits(self, pending_count: int = 0) -> tuple[bool, str]:
        today = now_iso()[:10]
        if today != self._last_reset:
            self._execution_count = 0
            self._last_reset = today

        if self._execution_count >= self.limits["max_tasks_per_execution"]:
            return False, f"max_tasks_per_execution reached ({self._execution_count})"

        if pending_count >= self.limits["max_pending_tasks"]:
            return False, f"max_pending_tasks reached ({pending_count})"

        return True, ""

    def record_creation(self) -> None:
        self._execution_count += 1

    def can_create(self, pending_count: int = 0) -> tuple[bool, str]:
        today_count = count_tasks_today()
        if today_count >= self.limits["max_tasks_per_day"]:
            return False, f"max_tasks_per_day reached ({today_count})"
        check, msg = self.check_limits(pending_count)
        if not check:
            return False, msg
        if today_count >= int(self.limits["max_tasks_per_day"] * 0.8):
            log_warning(f"Approaching daily task limit: {today_count}/{self.limits['max_tasks_per_day']}")
        return True, ""


_agent_limiter: RateLimiter | None = None


def get_rate_limiter() -> RateLimiter:
    global _agent_limiter
    if _agent_limiter is None:
        _agent_limiter = RateLimiter()
    return _agent_limiter
