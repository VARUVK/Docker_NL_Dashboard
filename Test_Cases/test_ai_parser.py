"""
test_ai_parser.py
=================
Happy-path tests for the natural-language parser (ai_parser.py).

These tests target the deterministic keyword/regex fallback parser, so they
run without any Docker daemon and without an Anthropic API key. They verify
that documented English queries map to the correct structured JSON actions.

Run from the repository root:
    pytest Test_Cases/ -v
"""

import sys
import os

# Make the application modules importable
sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Source Code"))
)

from ai_parser import parse_query, describe_action  # noqa: E402


# ─── List by status ──────────────────────────────────────────────────────────

def test_running_containers():
    result = parse_query("Show all running containers")
    assert result["action"] == "list_containers"
    assert result["status"] == "running"


def test_stopped_maps_to_exited():
    result = parse_query("Show stopped containers")
    assert result["action"] == "list_containers"
    assert result["status"] == "exited"


def test_restarting_containers():
    result = parse_query("Show containers that are restarting")
    assert result["action"] == "list_containers"
    assert result["status"] == "restarting"


def test_list_all_containers():
    result = parse_query("List all containers")
    assert result["action"] == "list_containers"
    assert result["status"] == "all"


# ─── Crashed ─────────────────────────────────────────────────────────────────

def test_crashed_default_one_hour():
    result = parse_query("Which containers crashed?")
    assert result["action"] == "crashed_containers"
    assert result["hours"] == 1


def test_crashed_explicit_hours():
    result = parse_query("Which containers crashed in the last 6 hours?")
    assert result["action"] == "crashed_containers"
    assert result["hours"] == 6


# ─── Count ───────────────────────────────────────────────────────────────────

def test_count_active():
    result = parse_query("How many containers are active?")
    assert result["action"] == "count_containers"
    assert result["status"] == "running"


def test_count_total():
    result = parse_query("How many total containers do I have?")
    assert result["action"] == "count_containers"
    assert result["status"] == "all"


# ─── Health overview & unhealthy ─────────────────────────────────────────────

def test_health_overview():
    result = parse_query("Show docker health overview")
    assert result["action"] == "health_overview"


def test_unhealthy_containers():
    result = parse_query("Show unhealthy containers")
    assert result["action"] == "list_containers"
    assert result["status"] == "unhealthy"


# ─── Logs ────────────────────────────────────────────────────────────────────

def test_logs_default_tail():
    result = parse_query("Show logs of nginx")
    assert result["action"] == "show_logs"
    assert result["container"] == "nginx"
    assert result["tail"] == 50


def test_logs_custom_tail():
    # The parser expects "logs of/for/from <name>" followed by an "<n> lines" hint.
    result = parse_query("Show logs for web 100 lines")
    assert result["action"] == "show_logs"
    assert result["container"] == "web"
    assert result["tail"] == 100


# ─── Search ──────────────────────────────────────────────────────────────────

def test_search_containers():
    result = parse_query("Find containers named web")
    assert result["action"] == "search_containers"
    assert result["query"] == "web"


# ─── Edge cases ──────────────────────────────────────────────────────────────

def test_empty_query():
    result = parse_query("")
    assert result["action"] == "unknown"


def test_nonsense_query_is_unknown():
    result = parse_query("asldkfj qwerty zzz")
    assert result["action"] == "unknown"


# ─── describe_action ─────────────────────────────────────────────────────────

def test_describe_action_readable():
    desc = describe_action({"action": "list_containers", "status": "running"})
    assert "running" in desc.lower()
