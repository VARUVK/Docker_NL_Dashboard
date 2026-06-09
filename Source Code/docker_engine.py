"""
docker_engine.py
================
Docker Engine Integration Module
Handles all Docker SDK operations: listing containers, fetching logs,
health status, uptime, and statistics.

Author: Docker NL Health Dashboard
"""

import docker
import docker.errors
from datetime import datetime, timezone
from typing import Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_docker_client():
    """
    Create and return a Docker client connected to the local Docker daemon.
    Returns None if Docker is not running or not installed.
    """
    try:
        client = docker.from_env()
        client.ping()  # Test connectivity
        return client
    except docker.errors.DockerException as e:
        logger.error(f"Docker connection failed: {e}")
        return None


def get_all_containers(status_filter: Optional[str] = None) -> list[dict]:
    """
    Fetch all containers from Docker Engine.

    Args:
        status_filter: Filter by status ('running', 'exited', 'restarting',
                       'paused', 'created', 'dead'). None = all containers.

    Returns:
        List of container info dicts.
    """
    client = get_docker_client()
    if not client:
        return []

    try:
        # all=True fetches stopped containers too
        containers = client.containers.list(all=True)
        result = []

        for c in containers:
            # Reload to get latest attributes
            c.reload()
            attrs = c.attrs

            # Parse uptime
            started_at = attrs.get("State", {}).get("StartedAt", "")
            uptime_str = _calculate_uptime(started_at)

            # Parse health check status
            health = attrs.get("State", {}).get("Health", {})
            health_status = health.get("Status", "N/A") if health else "N/A"

            # Parse ports
            ports = attrs.get("NetworkSettings", {}).get("Ports", {})
            port_list = _format_ports(ports)

            container_info = {
                "id": c.short_id,
                "name": c.name,
                "image": c.image.tags[0] if c.image.tags else str(c.image.id)[:12],
                "status": c.status,
                "health": health_status,
                "uptime": uptime_str,
                "ports": port_list,
                "started_at": started_at[:19].replace("T", " ") if started_at else "N/A",
                "restart_count": attrs.get("RestartCount", 0),
            }
            result.append(container_info)

        # Apply status filter if provided
        if status_filter and status_filter != "all":
            result = [c for c in result if c["status"].lower() == status_filter.lower()]

        return result

    except docker.errors.APIError as e:
        logger.error(f"Docker API error: {e}")
        return []


def get_container_logs(container_name: str, tail: int = 50) -> str:
    """
    Fetch the last N lines of logs from a specific container.

    Args:
        container_name: Container name or ID.
        tail: Number of log lines to fetch (default 50).

    Returns:
        Log string or error message.
    """
    client = get_docker_client()
    if not client:
        return "❌ Docker is not running."

    try:
        container = client.containers.get(container_name)
        logs = container.logs(tail=tail, timestamps=True).decode("utf-8", errors="replace")
        return logs if logs else "📭 No logs available for this container."

    except docker.errors.NotFound:
        return f"❌ Container '{container_name}' not found."
    except docker.errors.APIError as e:
        return f"❌ Docker API error: {e}"


def get_docker_stats() -> dict:
    """
    Return aggregate statistics about all containers.

    Returns:
        Dict with counts: total, running, stopped, restarting, paused, unhealthy.
    """
    all_containers = get_all_containers()

    stats = {
        "total": len(all_containers),
        "running": sum(1 for c in all_containers if c["status"] == "running"),
        "stopped": sum(1 for c in all_containers if c["status"] == "exited"),
        "restarting": sum(1 for c in all_containers if c["status"] == "restarting"),
        "paused": sum(1 for c in all_containers if c["status"] == "paused"),
        "created": sum(1 for c in all_containers if c["status"] == "created"),
        "dead": sum(1 for c in all_containers if c["status"] == "dead"),
        "unhealthy": sum(1 for c in all_containers if c["health"] == "unhealthy"),
    }
    return stats


def get_crashed_containers(hours: int = 1) -> list[dict]:
    """
    Find containers that have exited/crashed within the last N hours.

    Args:
        hours: Look back window in hours.

    Returns:
        List of recently crashed container dicts.
    """
    client = get_docker_client()
    if not client:
        return []

    try:
        containers = client.containers.list(all=True, filters={"status": "exited"})
        crashed = []

        for c in containers:
            c.reload()
            finished_at = c.attrs.get("State", {}).get("FinishedAt", "")
            if finished_at and finished_at != "0001-01-01T00:00:00Z":
                try:
                    # Parse ISO timestamp
                    finished_dt = datetime.fromisoformat(finished_at[:19])
                    finished_dt = finished_dt.replace(tzinfo=timezone.utc)
                    now = datetime.now(timezone.utc)
                    diff_hours = (now - finished_dt).total_seconds() / 3600

                    if diff_hours <= hours:
                        exit_code = c.attrs.get("State", {}).get("ExitCode", -1)
                        crashed.append({
                            "id": c.short_id,
                            "name": c.name,
                            "image": c.image.tags[0] if c.image.tags else str(c.image.id)[:12],
                            "status": c.status,
                            "health": "crashed",
                            "uptime": "N/A",
                            "ports": "",
                            "started_at": finished_at[:19].replace("T", " "),
                            "exit_code": exit_code,
                            "restart_count": c.attrs.get("RestartCount", 0),
                        })
                except Exception:
                    pass

        return crashed

    except docker.errors.APIError as e:
        logger.error(f"Error fetching crashed containers: {e}")
        return []


def is_docker_running() -> bool:
    """Check if Docker daemon is accessible."""
    return get_docker_client() is not None


# ─── Internal Helpers ────────────────────────────────────────────────────────

def _calculate_uptime(started_at: str) -> str:
    """Convert a Docker ISO timestamp to a human-readable uptime string."""
    if not started_at or started_at.startswith("0001"):
        return "N/A"
    try:
        started_dt = datetime.fromisoformat(started_at[:19])
        started_dt = started_dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        delta = now - started_dt

        days = delta.days
        hours, remainder = divmod(delta.seconds, 3600)
        minutes, _ = divmod(remainder, 60)

        if days > 0:
            return f"{days}d {hours}h {minutes}m"
        elif hours > 0:
            return f"{hours}h {minutes}m"
        else:
            return f"{minutes}m"
    except Exception:
        return "N/A"


def _format_ports(ports: dict) -> str:
    """Format Docker port bindings into a readable string."""
    if not ports:
        return ""
    port_strings = []
    for container_port, host_bindings in ports.items():
        if host_bindings:
            for binding in host_bindings:
                host_port = binding.get("HostPort", "")
                port_strings.append(f"{host_port}→{container_port}")
        else:
            port_strings.append(container_port)
    return ", ".join(port_strings[:3])  # Limit display to 3 ports