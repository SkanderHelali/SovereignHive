# Security Policy

## Scope

SovereignHive is a **local-first, sovereign desktop harness**. It spawns local processes in PTYs and reads/writes files under directories you register. It anchors agent communications with cryptographic Nostr keypairs (`secp256k1`), using NIP-44 End-to-End Encryption for all inter-agent messages transmitted across relays.

## Supported versions

| Version | Supported |
|---|---|
| `main` | ✅ |
| older tags | ❌ |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

- Use GitHub's **private vulnerability reporting**: the *Security → Report a vulnerability* tab on https://github.com/SkanderHelali/SovereignHive

You can expect an acknowledgement within a few days. Once a fix is available we'll
credit you (unless you prefer to stay anonymous).

## Notes for reviewers

- Renderer ↔ main IPC goes through a typed `contextBridge` (`window.cth`); the renderer
  has no direct Node access (`nodeIntegration: false`, `contextIsolation: true`).
- All `fs:*` / `git:*` IPC calls are sandboxed and path-validated in the main process,
  rooted at an agent's working directory.
- The hive commits to a local git repo from a **single committer** (the main process);
  agents only write plain files.
