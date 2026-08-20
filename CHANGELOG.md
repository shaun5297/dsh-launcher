# Changelog

## [0.2.0] - 2026-08-20

### Added
- `status --json` machine-readable output; `prepublishOnly` publish gate.

### Added
- Harness bundle plugin: installable via `dsh plugin add dsh-launcher`, registers the `harness_launch` agent tool (detect → start → wait → open browser new window).
- `cordis.patch.yml` bundle manifest with env-configurable host/port/browser (`DSH_LAUNCHER_HOST` / `DSH_LAUNCHER_PORT` / `DSH_LAUNCHER_BROWSER`).
- GitHub Actions CI (Node 18/20/22 matrix): syntax check + 16 unit tests.
- CLI arg parsing tests, shortcut-generation test, `startBackend` log-dir test.
- CI badge in README.

### Changed
- `startBackend` auto-creates the web log directory instead of failing on a missing parent.
- `makeShortcut` accepts an explicit desktop directory (testable, embeddable).

## [0.1.0] - 2026-08-20

### Added
- Cross-platform CLI: `dsh-launcher` / `start` / `open` / `status` / `make-shortcut`.
- Backend detection (TCP), detached start of `dsh web` with `--no-open`, readiness polling, browser new-window opening (Chrome by default, fallback to default browser).
- macOS desktop shortcut (`.command`), Windows (`.cmd`), Linux (`.desktop`).
- Zero-dependency core (`lib/launcher.js`), MIT license, README in Chinese.
