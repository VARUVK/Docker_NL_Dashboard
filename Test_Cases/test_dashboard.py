"""
test_dashboard.py
=================
Happy-path tests for the summary generation in dashboard.py.

generate_summary() produces the plain-English result text shown to the user.
These tests confirm the summary reflects the action and result count correctly.
Streamlit is not exercised here — only the pure summary logic.

Run from the repository root:
    pytest Test_Cases/ -v
"""

import sys
import os
from unittest.mock import patch

sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Source Code"))
)

import dashboard  # noqa: E402


def test_summary_list_running():
    containers = [{"name": "web"}, {"name": "api"}]
    summary = dashboard.generate_summary(
        containers, {"action": "list_containers", "status": "running"}
    )
    assert "2" in summary
    assert "running" in summary


def test_summary_list_empty():
    summary = dashboard.generate_summary(
        [], {"action": "list_containers", "status": "exited"}
    )
    assert "No" in summary


def test_summary_crashed_none():
    summary = dashboard.generate_summary(
        [], {"action": "crashed_containers", "hours": 1}
    )
    assert "No containers crashed" in summary


def test_summary_crashed_some():
    containers = [{"name": "migrate"}]
    summary = dashboard.generate_summary(
        containers, {"action": "crashed_containers", "hours": 2}
    )
    assert "1" in summary
    assert "2" in summary  # hours


def test_summary_count():
    containers = [{"name": "a"}, {"name": "b"}, {"name": "c"}]
    summary = dashboard.generate_summary(
        containers, {"action": "count_containers", "status": "running"}
    )
    assert "3" in summary


def test_summary_search_found():
    containers = [{"name": "web"}]
    summary = dashboard.generate_summary(
        containers, {"action": "search_containers", "query": "web"}
    )
    assert "web" in summary
    assert "1" in summary


def test_summary_search_not_found():
    summary = dashboard.generate_summary(
        [], {"action": "search_containers", "query": "ghost"}
    )
    assert "ghost" in summary
    assert "No containers" in summary


@patch("dashboard.get_docker_stats")
def test_summary_health_overview(mock_stats):
    mock_stats.return_value = {
        "total": 6, "running": 3, "stopped": 2, "restarting": 1,
        "paused": 0, "created": 0, "dead": 0, "unhealthy": 1,
    }
    summary = dashboard.generate_summary([], {"action": "health_overview"})
    assert "6" in summary
    assert "running" in summary.lower()
