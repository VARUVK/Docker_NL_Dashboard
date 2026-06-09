# Sample Data

Representative inputs and expected outputs for the Docker NL Health Dashboard. These let an evaluator validate behaviour without a live Docker daemon, and they back the automated tests in `../Test_Cases/`.

| File | Purpose |
|---|---|
| `sample_queries.txt` | The set of natural-language queries the app accepts, one per line. These are the **inputs** a user types into the dashboard. |
| `container_status.json` | A representative container inventory in the exact dict shape that `docker_engine.get_all_containers()` returns. Acts as a **fixture** standing in for a live Docker daemon. |
| `ai_responses.json` | The **structured JSON actions** that `ai_parser.parse_query()` produces for each sample query — identical shape whether the Claude API or the keyword fallback handled it. |
| `expected_results.json` | The **expected outputs** when each query runs against `container_status.json`: parsed action, matched containers, counts, and the AI summary string from `dashboard.generate_summary()`. |

**Input → output flow:** a line from `sample_queries.txt` is parsed (see `ai_responses.json`), executed against the inventory in `container_status.json`, and produces the result captured in `expected_results.json`.
