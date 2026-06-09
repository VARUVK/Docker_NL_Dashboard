# Test Cases

Automated `pytest` suite plus a documented test matrix for the Docker NL Health Dashboard. The suite covers the **happy path** and runs **without a Docker daemon or API key** (the Docker SDK and stats are mocked).

## Contents

| File | What it covers |
|---|---|
| `test_ai_parser.py` | Natural-language → JSON action mapping (keyword/regex fallback parser) |
| `test_docker_engine.py` | Stats aggregation, status filtering, offline handling, helper functions (Docker mocked) |
| `test_dashboard.py` | Plain-English summary generation for every action type |
| `Test_Case_Matrix.md` | Functional, Integration, and User-Acceptance test cases with IDs, inputs, expected/actual results, and status |

## Running the tests

From the **repository root**:

```bash
pip install pytest
pytest Test_Cases/ -v
```

Expected outcome:

```
33 passed
```

No Docker daemon and no Anthropic API key are required — Docker interactions are mocked and the deterministic keyword parser is exercised directly. Live-Docker and live-API paths are listed as manual cases in `Test_Case_Matrix.md` and demonstrated in the walkthrough video.
