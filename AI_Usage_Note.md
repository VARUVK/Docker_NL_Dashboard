# AI Usage Note

**Project:** Docker NL Health Dashboard
**Submission:** Infinite Computer Solutions — AI-Assisted Development Hackathon

AI coding assistants were used throughout development. The tools involved were **Claude**, **Google AI Studio**, and **Antigravity**. This note summarises where they helped, where they got things wrong, and the prompts that proved most useful.

---

## A. What AI helped with

- **Architecture brainstorming.** Shaping the three-phase *translate → execute → present* pipeline and splitting it into four single-responsibility modules (`app.py`, `ai_parser.py`, `docker_engine.py`, `dashboard.py`) rather than one monolithic script.
- **Code scaffolding.** Generating first drafts of the Docker SDK calls (`containers.list(all=True)`, `.reload()`, log fetching) and the Streamlit layout (metric cards, columns, expanders, sidebar).
- **Prompt iteration.** Refining the system prompt in `ai_parser.py` so the model returns *only* valid JSON for a fixed action set, including the explicit "no markdown, no explanation" instruction and the markdown-fence stripping safeguard.
- **Fallback parser design.** Working out the regex and keyword rules that let the app function deterministically with no API key.
- **Robustness handling.** Suggesting graceful handling for the Docker-offline case, malformed AI responses, and missing container health data.
- **Documentation refinement.** Drafting docstrings, this submission package, and the README's Mermaid diagrams.

## B. What AI got wrong

- **Hallucinated / wrong API shapes.** Early suggestions referenced Docker SDK attributes and Streamlit calls that don't exist or were renamed; these had to be corrected against the official docs (e.g. correct handling of `attrs["State"]["Health"]`, which is absent on containers without a healthcheck).
- **Overengineered solutions.** Initial drafts proposed background threads, websockets, and a database for "live" refresh — far beyond the brief. We replaced this with optional `streamlit-autorefresh` and session state.
- **Brittle JSON parsing.** The model sometimes wrapped its JSON in markdown fences despite instructions, which would have crashed `json.loads`; we added fence-stripping and a try/except fallback.
- **Prompt misinterpretation.** The parser occasionally conflated "stopped" with "paused"; we pinned the mappings explicitly ("stopped = exited") in both the system prompt and the keyword parser.
- **Timezone bugs.** Suggested naïve datetime parsing for uptime/crash windows; we corrected it to treat Docker timestamps as UTC.

## C. Best prompts used during development

1. *"Design a Python module that converts natural-language Docker questions into a small, fixed set of JSON actions, with a keyword-based fallback that needs no API key. List the exact action schemas."* — produced the action space that became `ai_parser.py`.
2. *"Write the Docker SDK code to list all containers (including stopped) and return name, image, status, health, uptime, ports, and restart count, handling containers that have no healthcheck."* — produced the core of `get_all_containers()`.
3. *"Given a parsed action dict, write a router that calls the right docker_engine function and renders results in Streamlit, including a graceful path when Docker is offline."* — shaped the orchestration in `app.py`.
4. *"Review this system prompt and make the model return only raw JSON — no prose, no markdown fences — for these seven action types."* — hardened the parser prompt.
5. *"Generate happy-path pytest cases for the keyword parser and the stats aggregation that don't require a running Docker daemon."* — seeded the `Test_Cases/` suite.

---

**Final implementation decisions, testing, validation, and integration were performed by the student team.** AI assistants accelerated drafting and review, but every line was verified, corrected where wrong, and integrated by the team against real Docker behaviour.
