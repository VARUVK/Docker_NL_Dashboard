"""
ai_parser.py
============
AI Query Parser Module
Converts natural language queries into structured Docker action JSON
using the Anthropic Claude API (claude-sonnet-4-20250514).

Supports local fallback with keyword-based parsing if no API key is set.

Author: Docker NL Health Dashboard
"""

import json
import re
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ─── System prompt for the AI parser ─────────────────────────────────────────
SYSTEM_PROMPT = """
You are a Docker command interpreter. Convert natural language queries about
Docker containers into structured JSON actions.

Return ONLY valid JSON — no markdown, no explanation, no extra text.

Supported actions and their JSON formats:

1. List containers by status:
   {"action": "list_containers", "status": "running"}
   {"action": "list_containers", "status": "stopped"}
   {"action": "list_containers", "status": "restarting"}
   {"action": "list_containers", "status": "paused"}
   {"action": "list_containers", "status": "all"}

2. Show container logs:
   {"action": "show_logs", "container": "<name_or_id>", "tail": 50}

3. Count containers:
   {"action": "count_containers", "status": "all"}
   {"action": "count_containers", "status": "running"}

4. Show crashed containers:
   {"action": "crashed_containers", "hours": 1}

5. Show health overview:
   {"action": "health_overview"}

6. Show unhealthy containers:
   {"action": "list_containers", "status": "unhealthy"}

7. Search containers by name:
   {"action": "search_containers", "query": "<search_term>"}

Rules:
- "stopped" = exited status
- "crashed" = recently exited with error
- "active" = running
- If you cannot determine the action, return: {"action": "unknown", "raw": "<original query>"}
- Always return exactly one JSON object.
"""

# ─── Main Parser Function ─────────────────────────────────────────────────────

def parse_query(user_query: str, api_key: Optional[str] = None) -> dict:
    """
    Parse a natural language Docker query into a structured action dict.

    Tries AI parsing first (if API key available), falls back to keyword parsing.

    Args:
        user_query: The natural language query from the user.
        api_key: Anthropic API key (optional; falls back to env var).

    Returns:
        Parsed action dict, e.g. {"action": "list_containers", "status": "running"}
    """
    if not user_query or not user_query.strip():
        return {"action": "unknown", "raw": ""}

    # Try AI parsing
    key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
    if key:
        result = _parse_with_ai(user_query, key)
        if result:
            return result

    # Fallback to keyword-based parsing
    return _parse_with_keywords(user_query)


# ─── AI-based Parsing (Anthropic API) ────────────────────────────────────────

def _parse_with_ai(user_query: str, api_key: str) -> Optional[dict]:
    """Use Anthropic Claude API to parse the query."""
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=256,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_query}]
        )
        raw_text = message.content[0].text.strip()

        # Strip accidental markdown fences
        raw_text = re.sub(r"```(?:json)?", "", raw_text).strip().rstrip("`")

        parsed = json.loads(raw_text)
        if isinstance(parsed, dict) and "action" in parsed:
            return parsed
        return None

    except Exception as e:
        logger.warning(f"AI parsing failed: {e}. Using keyword fallback.")
        return None


# ─── Keyword-based Fallback Parser ───────────────────────────────────────────

def _parse_with_keywords(query: str) -> dict:
    """
    Rule-based fallback parser using regex and keyword matching.
    Covers common Docker queries without requiring an API key.
    """
    q = query.lower().strip()

    # ── Logs ──────────────────────────────────────────────────────────────────
    log_match = re.search(
        r"(?:show|get|fetch|display|print)\s+logs?\s+(?:of|for|from)?\s*['\"]?(\S+)['\"]?",
        q
    )
    if log_match:
        container_name = log_match.group(1).strip("'\"")
        # Extract tail count if mentioned
        tail_match = re.search(r"(\d+)\s*(?:lines?|rows?)", q)
        tail = int(tail_match.group(1)) if tail_match else 50
        return {"action": "show_logs", "container": container_name, "tail": tail}

    # ── Crashed / Failed ──────────────────────────────────────────────────────
    if any(w in q for w in ["crash", "crashed", "failed", "fail"]):
        hours_match = re.search(r"(\d+)\s*hour", q)
        hours = int(hours_match.group(1)) if hours_match else 1
        return {"action": "crashed_containers", "hours": hours}

    # ── Count ─────────────────────────────────────────────────────────────────
    if any(w in q for w in ["how many", "count", "number of", "total"]):
        if any(w in q for w in ["running", "active", "up"]):
            return {"action": "count_containers", "status": "running"}
        if any(w in q for w in ["stop", "stopped", "down", "exited"]):
            return {"action": "count_containers", "status": "stopped"}
        return {"action": "count_containers", "status": "all"}

    # ── Health Overview ───────────────────────────────────────────────────────
    if any(w in q for w in ["health", "overview", "summary", "dashboard", "status"]):
        if "unhealthy" in q:
            return {"action": "list_containers", "status": "unhealthy"}
        return {"action": "health_overview"}

    # ── Search ────────────────────────────────────────────────────────────────
    search_match = re.search(
        r"(?:search|find|look for|locate)\s+(?:container[s]?\s+)?(?:named?|called?)?\s*['\"]?(\S+)['\"]?",
        q
    )
    if search_match:
        return {"action": "search_containers", "query": search_match.group(1)}

    # ── List by Status ────────────────────────────────────────────────────────
    if any(w in q for w in ["restart", "restarting"]):
        return {"action": "list_containers", "status": "restarting"}

    if any(w in q for w in ["pause", "paused"]):
        return {"action": "list_containers", "status": "paused"}

    if any(w in q for w in ["stop", "stopped", "exited", "down", "off"]):
        return {"action": "list_containers", "status": "exited"}

    if any(w in q for w in ["run", "running", "active", "up", "alive", "online"]):
        return {"action": "list_containers", "status": "running"}

    if any(w in q for w in ["all", "every", "list", "show", "display", "containers"]):
        return {"action": "list_containers", "status": "all"}

    # ── Default: show all ─────────────────────────────────────────────────────
    return {"action": "unknown", "raw": query}


# ─── Human-readable Action Descriptions ──────────────────────────────────────

def describe_action(parsed: dict) -> str:
    """Return a human-readable description of the parsed action."""
    action = parsed.get("action", "unknown")

    descriptions = {
        "list_containers": f"Listing {parsed.get('status', 'all')} containers",
        "show_logs": f"Fetching logs for container: {parsed.get('container', '?')}",
        "count_containers": f"Counting {parsed.get('status', 'all')} containers",
        "crashed_containers": f"Finding containers that crashed in the last {parsed.get('hours', 1)} hour(s)",
        "health_overview": "Loading Docker health overview",
        "search_containers": f"Searching for containers matching: {parsed.get('query', '')}",
        "unknown": "Query not understood — showing all containers",
    }
    return descriptions.get(action, "Processing query...")