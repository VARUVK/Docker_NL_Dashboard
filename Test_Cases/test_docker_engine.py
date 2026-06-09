"""
test_docker_engine.py
=====================
Happy-path tests for the Docker integration layer (docker_engine.py).

The Docker SDK is mocked, so these tests run on any machine without a Docker
daemon. They verify aggregate statistics, status filtering, and graceful
behaviour when Docker is unavailable.

Run from the repository root:
    pytest Test_Cases/ -v
"""

import sys
import os
from unittest.mock import patch

sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Source Code"))
)

import docker_engine  # noqa: E402


# A representative inventory matching get_all_containers() output shape.
SAMPLE_CONTAINERS = [
    {"id": "a1", "name": "web",     "image": "nginx:latest", "status": "running",    "health": "healthy",   "uptime": "2d", "ports": "8080->80", "started_at": "x", "restart_count": 0},
    {"id": "a2", "name": "api",     "image": "api:1.4",      "status": "running",    "health": "healthy",   "uptime": "5h", "ports": "3000",     "started_at": "x", "restart_count": 1},
    {"id": "a3", "name": "worker",  "image": "worker:1.4",   "status": "restarting", "health": "N/A",       "uptime": "0m", "ports": "",         "started_at": "x", "restart_count": 14},
    {"id": "a4", "name": "cache",   "image": "redis:7",      "status": "running",    "health": "unhealthy", "uptime": "1d", "ports": "6379",     "started_at": "x", "restart_count": 0},
    {"id": "a5", "name": "migrate", "image": "migrate:1.4",  "status": "exited",     "health": "crashed",   "uptime": "N/A","ports": "",         "started_at": "x", "restart_count": 0},
    {"id": "a6", "name": "old-job", "image": "busybox",      "status": "exited",     "health": "N/A",       "uptime": "N/A","ports": "",         "started_at": "x", "restart_count": 0},
]


# ─── Statistics aggregation ──────────────────────────────────────────────────

@patch("docker_engine.get_all_containers")
def test_stats_counts(mock_get_all):
    mock_get_all.return_value = SAMPLE_CONTAINERS
    stats = docker_engine.get_docker_stats()

    assert stats["total"] == 6
    assert stats["running"] == 3
    assert stats["stopped"] == 2          # 'exited'
    assert stats["restarting"] == 1
    assert stats["unhealthy"] == 1
    assert stats["paused"] == 0


@patch("docker_engine.get_all_containers")
def test_stats_empty_environment(mock_get_all):
    mock_get_all.return_value = []
    stats = docker_engine.get_docker_stats()
    assert stats["total"] == 0
    assert stats["running"] == 0


# ─── Docker offline handling ─────────────────────────────────────────────────

@patch("docker_engine.get_docker_client")
def test_is_docker_running_false_when_no_client(mock_client):
    mock_client.return_value = None
    assert docker_engine.is_docker_running() is False


@patch("docker_engine.get_docker_client")
def test_is_docker_running_true_with_client(mock_client):
    mock_client.return_value = object()  # any non-None client
    assert docker_engine.is_docker_running() is True


@patch("docker_engine.get_docker_client")
def test_get_all_containers_returns_empty_when_offline(mock_client):
    mock_client.return_value = None
    assert docker_engine.get_all_containers() == []


@patch("docker_engine.get_docker_client")
def test_logs_message_when_offline(mock_client):
    mock_client.return_value = None
    msg = docker_engine.get_container_logs("nginx")
    assert "not running" in msg.lower()


# ─── Helper functions ────────────────────────────────────────────────────────

def test_uptime_handles_empty():
    assert docker_engine._calculate_uptime("") == "N/A"
    assert docker_engine._calculate_uptime("0001-01-01T00:00:00Z") == "N/A"


def test_format_ports_empty():
    assert docker_engine._format_ports({}) == ""


def test_format_ports_with_binding():
    ports = {"80/tcp": [{"HostIp": "0.0.0.0", "HostPort": "8080"}]}
    result = docker_engine._format_ports(ports)
    assert "8080" in result
    assert "80/tcp" in result
