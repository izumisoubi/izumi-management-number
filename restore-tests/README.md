# Restore drill records

The quarterly GitHub Actions workflow records its result in the workflow summary. After each drill, copy the non-secret result into a dated Markdown file based on `template.md`.

A drill is complete only after database restore, Storage restore, login, representative project retrieval, ledger totals and document output have been checked in an isolated environment.
