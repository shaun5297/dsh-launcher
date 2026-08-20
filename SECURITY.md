# Security Policy

## Scope

This project is a launcher for a locally running DeepSeek Harness instance.
It:

- binds to `127.0.0.1` by default and refuses `--host 0.0.0.0` (the underlying
  `dsh web` app does the same for safety);
- starts `dsh web` **without** shell interpretation of arguments (spawn with an
  argv array, never a shell string);
- opens the harness URL in a browser new window only; it never sends data
  anywhere, never phones home, and has no network listeners of its own.

## Reporting a vulnerability

Please open an issue (do not include credentials or real paths in the report),
or reach out directly via GitHub. We treat reports privately before disclosure.

## Trust model

- `dsh plugin add dsh-launcher` runs plugin code in your Harness with your own
  permissions — review `src/` and `lib/` before installing.
- The `harness_launch` agent tool starts a local process and opens a browser;
  grant it only in sessions you trust.
