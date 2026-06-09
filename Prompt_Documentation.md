# Prompt Documentation

This file records the key prompts used while building the **Docker NL Health Dashboard**, organised by the AI tool used. Each entry lists the objective, the prompt, the expected output, and how the result was actually used in the project. Prompts are reconstructed to reflect the real implementation in `Source Code/`.

---

## Google AI Studio

### 1. Action-schema design
- **Objective:** Define a minimal, fixed set of structured actions that natural-language Docker queries can map to.
- **Prompt Used:** *"I'm building a tool where users ask about Docker containers in plain English. Propose a small, closed set of JSON action types (list, count, logs, crashed, health overview, search) with exact field names and example values. Keep it minimal."*
- **Expected Output:** A list of 6–7 JSON action shapes with fields like `action`, `status`, `container`, `hours`, `query`.
- **Actual Utilization:** Became the canonical action set documented in the `SYSTEM_PROMPT` of `ai_parser.py` and routed in `app.py` (`list_containers`, `show_logs`, `count_containers`, `crashed_containers`, `health_overview`, `search_containers`, `unknown`).

### 2. Status vocabulary mapping
- **Objective:** Resolve ambiguity between everyday words and Docker's real status values.
- **Prompt Used:** *"Map casual user words (stopped, down, active, alive, crashed, paused) to Docker's actual container statuses (running, exited, restarting, paused, dead). Note any that are ambiguous."*
- **Expected Output:** A mapping table flagging "stopped → exited" and "active → running".
- **Actual Utilization:** Encoded both in the parser system prompt rules and in the keyword branches of `_parse_with_keywords()` (`docker_engine.py` uses `exited` internally; the UI label says "Stopped").

---

## Antigravity

### 3. Docker SDK integration scaffolding
- **Objective:** Generate the Docker Engine integration layer.
- **Prompt Used:** *"Using the Docker SDK for Python, write functions to: connect to the local daemon and ping it, list all containers (including stopped) returning id/name/image/status/health/uptime/ports/restart count, fetch the last N timestamped log lines for a container, and detect containers that exited in the last N hours. Handle the case where a container has no healthcheck."*
- **Expected Output:** Functions roughly equal to `get_docker_client`, `get_all_containers`, `get_container_logs`, `get_crashed_containers`.
- **Actual Utilization:** Formed the basis of `docker_engine.py`. The team corrected the health-status extraction (`attrs["State"].get("Health")` can be empty) and added UTC-aware uptime/crash calculations in `_calculate_uptime` and `get_crashed_containers`.

### 4. Streamlit dashboard rendering
- **Objective:** Build the visual rendering layer.
- **Prompt Used:** *"Write Streamlit render functions for: a row of five metric cards from a stats dict, a colour-coded container table built from a list of dicts with status emojis and row highlighting, a log viewer with a download button, and a health overview with a status-distribution bar chart."*
- **Expected Output:** Functions like `render_stats_cards`, `render_container_table`, `render_logs`, `render_health_overview`.
- **Actual Utilization:** Became `dashboard.py`. The team added the status emoji/colour maps, pandas `Styler` row highlighting, and CSV/log download buttons.

### 5. Resilient orchestration
- **Objective:** Wire parsing and execution together safely.
- **Prompt Used:** *"Given a parsed action dict, route it to the correct docker_engine function, show the detected intent and parsed JSON to the user, render the result, and stop gracefully with a remediation panel if the Docker daemon is unreachable."*
- **Expected Output:** The query-processing block and the offline guard.
- **Actual Utilization:** Implemented as the action router and `is_docker_running()` guard in `app.py`, plus `render_docker_offline_warning()` in `dashboard.py`.

---

## Claude

### 6. Hardening the AI parser prompt
- **Objective:** Force strictly machine-parseable output from the LLM.
- **Prompt Used:** *"Rewrite this Docker-query system prompt so the model returns ONLY one valid JSON object — no prose, no markdown code fences — for these seven action types, and returns an explicit 'unknown' action when it can't classify the query."*
- **Expected Output:** A tightened system prompt plus client-side safeguards.
- **Actual Utilization:** The final `SYSTEM_PROMPT` in `ai_parser.py`, combined with `re.sub(r"```(?:json)?", "", ...)` fence-stripping and a try/except that falls back to keyword parsing on any failure.

### 7. Keyword fallback parser
- **Objective:** Make the app usable with no API key.
- **Prompt Used:** *"Write a deterministic keyword + regex parser that maps Docker questions to the same JSON action schema as the AI parser, covering logs, crashed, counts, health overview, search, and list-by-status, with sensible defaults."*
- **Expected Output:** A rule-based function returning the same dict shape as the AI path.
- **Actual Utilization:** Became `_parse_with_keywords()` in `ai_parser.py`; the team tuned the regex for log/tail extraction and the ordering of status checks.

### 8. Happy-path test generation
- **Objective:** Provide automated tests that don't require Docker.
- **Prompt Used:** *"Generate pytest happy-path tests for the keyword parser and the stats aggregation logic, mocking Docker so the suite runs without a daemon."*
- **Expected Output:** Pytest test functions with mocked Docker calls.
- **Actual Utilization:** Seeded the suite in `Test_Cases/`; the team expanded assertions and added the documented test matrix.

---

*All prompts above were iterated on by the student team, and every generated artifact was reviewed, corrected against official Docker and Anthropic documentation, and validated against real container behaviour before inclusion.*
