# Assumptions and Limitations

This document captures the operational assumptions behind the updated TypeScript application.

## Assumptions

| # | Assumption | Why |
|---|---|---|
| 1 | The app is run with Node.js and npm available | The updated source is a Vite + Express + TypeScript project |
| 2 | Port `3000` is available | The server currently binds to port `3000` |
| 3 | Live Docker mode uses a reachable Docker Engine endpoint | The UI can switch into live mode, but it still depends on Docker connectivity |
| 4 | A Gemini API key is optional | The app can still operate with Ollama or fall back in limited ways |
| 5 | Ollama may be local or remote | The configuration UI accepts a configurable base URL and model |
| 6 | Simulation mode is valid for demos and evaluation | The seeded dataset is intentionally included to support walkthroughs without a live Docker host |

## Limitations

| # | Limitation | Impact | Notes |
|---|---|---|---|
| 1 | Port is fixed in the current server code | Running another service on `3000` will conflict | Could be made configurable later |
| 2 | Live Docker mode assumes the engine is exposed in a reachable way | A local desktop Docker setup may still need TCP exposure or proxying | Documented in setup notes |
| 3 | LLM quality depends on provider availability | Gemini and Ollama behavior can vary | The app includes provider status checks and fallback handling |
| 4 | Simulation data is synthetic | Demo output may differ from a real Docker host | This is intentional for reviewability |
| 5 | The repository does not currently include a dedicated automated frontend test suite | Validation relies on lint/build checks and manual scenario coverage | Test guidance is documented in `Test_Cases/` |
| 6 | The current UI is optimized for the delivered scenarios, not every Docker workflow | Advanced orchestration or cluster management is out of scope | Focus remains on Docker host monitoring and diagnosis |

## Graceful degradation

- If a provider is unavailable, the UI exposes its status and the backend avoids hard failure where possible.
- If live Docker access fails, the app can remain usable in simulation mode.
- If a container action is unsupported or blocked, the app returns a bounded error rather than executing blindly.
