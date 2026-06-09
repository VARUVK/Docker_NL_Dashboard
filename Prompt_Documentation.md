# Prompt Documentation

This document records the main prompt directions used while iterating on the updated **Docker NL Health Dashboard**. The entries below reflect the current TypeScript application stored in `Source Code/`.

---

## Google AI Studio / Gemini-oriented prompts

### 1. Dashboard scaffolding
- **Objective:** Create the main React dashboard shell.
- **Prompt Used:** *"Build a Docker health dashboard with cards, searchable container tables, runtime panels, logs, and a natural-language assistant area."*
- **Expected Output:** A rich React interface with reusable state and sections.
- **Actual Utilization:** Guided the structure now centered in `Source Code/src/App.tsx`.

### 2. AI intent translation
- **Objective:** Convert free-form Docker questions into structured actions.
- **Prompt Used:** *"Translate Docker troubleshooting questions into a strict JSON intent with fields for intent, target, containerName, and reasoning."*
- **Expected Output:** A stable intent schema for backend execution.
- **Actual Utilization:** Shaped the translation logic in `Source Code/src/server/llmService.ts`.

### 3. Multi-provider LLM support
- **Objective:** Support both hosted and local AI providers.
- **Prompt Used:** *"Design the backend so Gemini can be used when a cloud API key is available, and Ollama can be configured as an alternative provider."*
- **Expected Output:** Provider-aware configuration and availability checks.
- **Actual Utilization:** Reflected in the Gemini/Ollama configuration endpoints and runtime switching logic.

---

## Backend integration prompts

### 4. Docker executor design
- **Objective:** Implement one service that can serve either simulation data or live Docker data.
- **Prompt Used:** *"Build a Docker service with a simulation dataset, live Docker Engine integration, summary metrics, log retrieval, and container lifecycle actions."*
- **Expected Output:** A single execution layer with mode switching and reusable helpers.
- **Actual Utilization:** Became `Source Code/src/server/dockerExecutor.ts`.

### 5. Agent loop behavior
- **Objective:** Make the natural-language flow inspect, act, and summarize.
- **Prompt Used:** *"Create an agent controller that translates a query, executes the chosen Docker action, optionally loops for follow-up reasoning, and then returns commentary."*
- **Expected Output:** A bounded execution loop with traceable steps.
- **Actual Utilization:** Implemented in `Source Code/src/server/agentController.ts`.

### 6. Express route structure
- **Objective:** Expose the backend cleanly to the frontend.
- **Prompt Used:** *"Set up an Express server that serves a Vite frontend and adds endpoints for health, Docker state, logs, controls, provider config, and natural-language query execution."*
- **Expected Output:** A single server entrypoint that supports local development and production builds.
- **Actual Utilization:** Reflected in `Source Code/server.ts`.

---

## Documentation and refinement prompts

### 7. Repository refresh
- **Objective:** Replace outdated repository text after the app stack changed.
- **Prompt Used:** *"Rewrite the README, architecture note, assumptions, and test guidance to match a React + Express + TypeScript Docker dashboard instead of a Python dashboard."*
- **Expected Output:** Consistent repository documentation aligned to the new codebase.
- **Actual Utilization:** Used to guide the repository-wide documentation refresh in this update.

### 8. Tone normalization
- **Objective:** Keep ownership language consistent.
- **Prompt Used:** *"Rewrite any references that sound like individual attribution so the deliverables read as work completed by the team."*
- **Expected Output:** Clean, neutral, team-owned wording.
- **Actual Utilization:** Applied across the submission documents in this repository.

---

All prompts were reviewed and refined by the team, and the resulting code and documentation were manually checked before being committed.

