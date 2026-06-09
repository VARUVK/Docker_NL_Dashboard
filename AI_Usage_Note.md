# AI Usage Note

**Project:** Docker NL Health Dashboard  
**Submission:** Infinite Computer Solutions — AI-Assisted Development Hackathon

AI-assisted tooling was used throughout design and implementation of the current application version. The main tools involved were **Google AI Studio**, **Gemini**, and general-purpose coding assistants used for iteration, refactoring, and documentation support.

---

## What AI helped with

- **Frontend scaffolding** for the React dashboard layout, icon usage, and state-driven panels.
- **Backend scaffolding** for the Express server, API routes, and Vite development server integration.
- **LLM workflow design** for translating natural-language Docker questions into structured intents with reasoning.
- **Fallback planning** for Gemini-to-Ollama provider switching and simulation-mode behavior.
- **Docker integration review** for log parsing, summary generation, metrics display, and guarded container actions.
- **Documentation drafting** for README updates, architecture notes, and test guidance.

## What AI got wrong or needed correction

- **Generic starter metadata.** The uploaded app still used placeholder metadata such as `react-example`, which had to be renamed for the repository.
- **Environment assumptions.** Some generated notes assumed AI Studio-only hosting and needed to be rewritten for a normal GitHub repository workflow.
- **Cross-platform script issues.** The generated `clean` script used a Unix-style command and was updated to a Node-based command that also works on Windows.
- **Overconfident documentation.** Starter docs described the app too generically and did not reflect the actual Docker, Gemini, and Ollama workflow implemented in the code.
- **Repository drift.** Existing repository documents still described the previous Python version, so they were manually reviewed and rewritten to match the current TypeScript app.

## Most useful prompt directions

1. *"Design a Docker health dashboard that supports both simulation mode and live Docker Engine mode, with a clear separation between UI, API routes, and Docker execution logic."*
2. *"Translate free-form Docker troubleshooting questions into a small structured intent object with target selection, reasoning, and safe fallback behavior."*
3. *"Generate a React operations dashboard that shows container cards, logs, controls, system metrics, filters, and a natural-language panel."*
4. *"Add dual-provider AI support so the app can use Gemini when available and Ollama as a configurable alternative."*
5. *"Rewrite the repository documentation so it accurately reflects a Vite + Express + TypeScript app instead of an older Python implementation."*

---

**Final implementation decisions, testing, validation, and repository updates were completed by the team.** AI tools accelerated drafting and iteration, but the team reviewed, corrected, and integrated the final result.
