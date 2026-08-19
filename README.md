<div align="center">

# SovereignHive

### Sovereign, Nostr-Native Multi-Agent Coordination Harness

**Free, open source, and local-first** — an autonomous multi-agent orchestration harness that empowers terminal coding CLIs with **cryptographic Nostr identities**, **End-to-End Encrypted (E2EE) inter-agent communication**, and a visual control surface.

Wraps **[Claude Code](https://claude.com/claude-code)**, **Antigravity (Gemini)**, **OpenAI Codex**, **xAI Grok**, **Kimi Code**, **Qwen**, **OpenCode**, **Crush**, **pi.dev**, and **GitHub Copilot CLI** — with bring-your-own keys and local LLMs (Ollama / vLLM).

<p>
  <em>Electron · React · TypeScript · Nostr · Pixi.js · xterm.js · node-pty</em>
</p>

<p>
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-8B5CF6.svg?style=flat-square"></a>
  <a href="https://github.com/SkanderHelali/SovereignHive"><img alt="Fork: Munder Difflin" src="https://img.shields.io/badge/fork-Munder%20Difflin-10B981.svg?style=flat-square"></a>
  <img alt="Identity: Nostr (NIP-01/44)" src="https://img.shields.io/badge/identity-Nostr%20%28NIP--01%2F44%29-8B5CF6.svg?style=flat-square">
  <img alt="Platform: macOS | Windows | Linux" src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-1F2937.svg?style=flat-square">
</p>

<p>
  <strong>Website:</strong> <a href="https://slothy.win">https://slothy.win</a>
</p>

</div>

---

> [!NOTE]
> **Fork & Origin Notice**  
> **SovereignHive** is an independent open-source fork of [**Munder Difflin**](https://github.com/chaitanyagiri/munder-difflin) created by [Chaitanya Giri](https://github.com/chaitanyagiri).  
> SovereignHive extends the original multi-agent local harness by anchoring agent identities into the **Nostr protocol** (`secp256k1` keypairs), introducing **NIP-44 / NIP-59 encrypted agent-to-agent communication over relays**, and rebranding the environment into a sovereign cypherpunk agent workstation.

---

## Contents

- [What it is](#what-it-is)
- [Nostr & Sovereign Agent Architecture](#nostr--sovereign-agent-architecture)
- [Key Features](#key-features)
- [Getting Started](#getting-started)
- [Building the Linux AppImage](#building-the-linux-appimage)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)
- [License & Attribution](#license--attribution)

---

## What it is

SovereignHive is a desktop control harness that turns terminal coding agents into a self-coordinating, sovereign mesh:

- **Cryptographic Sovereign Identity:** Each agent is provisioned with a dedicated Nostr `secp256k1` keypair (`npub` / `nsec`), enabling verifiable identity, tamper-proof signing, and public NIP-01 profile metadata.
- **End-to-End Encrypted Relay Routing:** Agents coordinate via local mailboxes or broadcast across public/private Nostr relays using **NIP-44 authenticated encryption** and **NIP-59 Gift Wrapping** for metadata privacy.
- **Every Terminal is an Agent:** Real terminal processes (`claude`, `agy`, `codex`, `grok`, `kimi`, `qwen`, `opencode`, `crush`, `pi`, `copilot`) execute in authentic pseudo-terminals (`node-pty`) rendered via xterm.js.
- **Visual Swarm Floor:** Real-time 2D canvas displaying active sovereign agents, live tool executions, message delivery beams, and fleet health.
- **Persistent Memory & Governance:** Markdown memory palace with instant semantic recall, task kanban ledger, single-committer git worktrees, and operator circuit breakers.

---

## Nostr & Sovereign Agent Architecture

```
                     ┌───────────────────────────────┐
                     │     Nostr Relay Network       │
                     │  (e.g., wss://relay.damus.io, │
                     │   wss://nos.lol, local relay) │
                     └───────▲───────────────┬───────┘
                             │ NIP-44/59     │ Inbound
                      Publish│ Encrypted     │ Events
                             │ Events        │
                 ┌───────────┴───────────────▼───────────┐
                 │        Sovereign Transport Bridge     │
                 │   (Main Process: nostr-tools, relays) │
                 └───────────▲───────────────┬───────────┘
                             │               │
                     outbox/ │               │ inbox/
                     events  │               │ delivery
              ┌──────────────┴───────┐   ┌───▼──────────────────┐
              │  Sovereign Agent A   │   │  Sovereign Agent B   │
              │  Identity: npub1...  │   │  Identity: npub1...  │
              │  Signer:   nsec1...  │   │  Signer:   nsec1...  │
              └──────────────────────┘   └──────────────────────┘
```

1. **Identity (`nsec` / `npub`):** Generated per agent. Private keys are encrypted at rest using OS-level secure storage (Electron `safeStorage`) and never exposed over IPC.
2. **E2EE Communication:** Inter-agent messages are encrypted via **NIP-44 v2** (XChaCha20-Poly1305 + secp256k1 ECDH), gift-wrapped (NIP-59), and published to configured Nostr relays.
3. **Decentralized Multi-Node Mesh:** Agents on different machines or remote nodes can collaborate seamlessly through relay subscriptions while preserving confidentiality and anonymity.

---

## Key Features

* **Multi-Engine CLI Support:** Seamlessly orchestrate Claude Code, Antigravity (Gemini), OpenAI Codex, xAI Grok, OpenCode, Qwen, Crush, and custom commands.
* **Orchestrator Coordination:** A central coordinator agent (Michael) triages incoming work, delegates subtasks, and escalates critical actions to human approval gates.
* **Git Worktree Isolation:** Automatic branch and worktree isolation so parallel agents never collide on working trees.
* **Durable Knowledge & Memory:** Fast semantic recall index, markdown memory logs, and an Enterprise Knowledge Graph.
* **Operator Circuit Breaker:** Steer, gate specific tools, or halt runaway agents in real time.
* **Built-in Monaco IDE:** Integrated file tree, editor, git commit graph, and branch comparison.

---

## Getting Started

### Prerequisites

- **macOS, Linux, or Windows**
- **Node.js 18+** and npm
- **C/C++ Build Toolchain** (for compiling native `node-pty` / `better-sqlite3` addons)
- At least one supported coding CLI on your `PATH` (`claude`, `agy`, `codex`, `grok`, etc.)

### Installation & Development

```bash
# 1. Clone the repository
git clone https://github.com/SkanderHelali/SovereignHive.git
cd SovereignHive

# 2. Install dependencies (runs electron-rebuild for native modules)
npm install

# 3. Start the application in development mode with hot reload
npm run dev
```

---

## Building the Linux AppImage

To package a standalone Linux AppImage executable:

```bash
npm run dist:linux
```

The compiled binary will be placed at:
```
dist/Sovereign-Hive-0.4.4-linux-x86_64.AppImage
```

---

## Project Structure

```
SovereignHive/
  src/
    main/                    Electron Main Process (Node.js)
      nostr/                 Nostr key vault, NIP-44 encryption & relay client
      pty.ts                 node-pty pseudo-terminal process manager
      hive.ts                Multi-agent coordination, memory & outbox/inbox router
      hooks.ts               In-app lifecycle hook server
      integrations.ts        Encrypted credentials & secret broker (safeStorage)
      fs.ts / git.ts         Sandboxed filesystem & git operations
    preload/                 Context bridge exposing typed window.cth API
    renderer/src/            Electron Renderer Process (React + Vite + Pixi.js)
      design/                Tokens, styles & theme definitions
      components/            Command center, kanban board, terminal views, modals
      scene/office/          Pixi.js interactive agent floor
  NOSTR_REBRAND_PLAN.md      Detailed architectural & implementation specification
  package.json               Application configuration & scripts
  electron-builder.yml       Cross-platform packaging configuration
```

---

## Roadmap

- [x] **Fork & Rebrand Foundation:** Transition repository identity to SovereignHive.
- [ ] **Phase 1: Nostr Key Management:** Provision `secp256k1` (`npub`/`nsec`) keypairs per agent with `safeStorage` encryption.
- [ ] **Phase 2: NIP-44 / NIP-59 Transport:** End-to-end encrypted relay publishing and subscription listeners.
- [ ] **Phase 3: Mesh Routing Bridge:** Seamless outbox-to-relay and relay-to-inbox dispatching across distributed agent nodes.
- [ ] **Phase 4: Sovereign Cypherpunk UI:** Overhaul visual theme, palette, and customizable Nostr avatars.

---

## License & Attribution

* **Source Code:** Released under the [MIT License](./LICENSE) — Copyright (c) 2026 SovereignHive Contributors & Chaitanya Giri.
* **Upstream Attribution:** Forked from [Munder Difflin](https://github.com/chaitanyagiri/munder-difflin) by [Chaitanya Giri](https://github.com/chaitanyagiri).
* **Art Asset Notice:** Bundled pixel art assets under `src/renderer/src/assets/` originate from [LimeZu](https://limezu.itch.io/) and are subject to the **LimeZu Free Version License (Non-Commercial Use Only)**. See [`ATTRIBUTION.md`](./src/renderer/src/assets/ATTRIBUTION.md).
