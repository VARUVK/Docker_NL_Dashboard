# Sample Data Notes

The updated application no longer depends on the old static JSON fixtures from the previous Python version.

For the current app:

- **simulation mode** provides the built-in demo dataset at runtime
- **live mode** reads directly from a Docker Engine endpoint
- `sample_queries.txt` contains representative natural-language prompts for demos and manual validation

Static expected-result JSON files were removed because they no longer reflect the current React + Express + TypeScript application flow.
