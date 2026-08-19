# Nostr Identity & Full Rebrand Plan

## Executive Summary & Vision

This document details the architectural specification and implementation roadmap to transform **Munder Difflin** into a sovereign, decentralized, Nostr-native multi-agent desktop application.

By anchoring agent identities to **secp256k1 keypairs** (`npub` / `nsec`), agent communication transitions from machine-bound local files into an **End-to-End Encrypted (NIP-44 / NIP-59) distributed mesh** capable of routing across public and private Nostr relays. The user interface and theme are simultaneously rebranded from the legacy *Dunder Mifflin* parody into a modern, cypherpunk sovereign-agent workstation.

---

## 1. Brand Identity: SovereignHive

* **Project Name:** **SovereignHive** (`SH` / `SOV-HIVE`)
* **Repository:** [`https://github.com/SkanderHelali/SovereignHive`](https://github.com/SkanderHelali/SovereignHive)
* **Temporary Web Home:** [`https://slothy.win`](https://slothy.win)
* **Upstream Origin:** Forked from [`chaitanyagiri/munder-difflin`](https://github.com/chaitanyagiri/munder-difflin)

### Brand Rationale & Abbreviation Decision
* **Why SovereignHive:** Balances the proven "hive" multi-agent coordination architecture with self-sovereign cryptographic primitives.
* **Abbreviation:** Utilizes `SH` or `SOV-HIVE` (explicitly avoiding ambiguous acronyms).
* **Vision:** A decentralized, permissionless multi-agent workplace where agents possess self-custodied Nostr identities (`nsec`/`npub`), communicate via encrypted relay transport (NIP-44), and execute local tasks with high autonomy.

---

## 2. Nostr Architecture Specification

### 2.1 Cryptographic Identity Management (`src/main/nostr/identity.ts`)
* **Keypair Generation:** Every agent spawned (including the primary Orchestrator) is provisioned with a dedicated `secp256k1` keypair (`npub` public key / `nsec` private key).
* **Storage & Security:**
  * Private keys (`nsec`) are encrypted at rest using Electron's `safeStorage` (OS Keychain / DPAPI / Secret Service).
  * In-memory private keys follow the existing **write-only contract**: never exposed over IPC to the renderer, never logged, and never written into plain git history or transcripts.
  * Agent metadata records (`registry.json`) store `npub`, relay lists, and optional `nip05` handles.
* **Profile Metadata (NIP-01 Kind 0):**
  * Agents publish profile metadata: `name`, `about` (role & system capabilities), `picture` (avatar URL), and `bot: true` tag.

### 2.2 End-to-End Encrypted Messaging Transport (`src/main/nostr/transport.ts`)
* **Encryption Standards:**
  * **NIP-44 (v2):** Modern authenticated encryption (XChaCha20-Poly1305 + secp256k1 ECDH with conversation key derivation).
  * **NIP-59 (Gift Wrap) / NIP-17:** Encapsulates the NIP-44 payload inside an ephemeral rumor (`kind: 14`) wrapped in a seal (`kind: 13`) and gift-wrapped (`kind: 1059`) to hide sender, recipient, and timing metadata from relays.
* **Hybrid Routing Pipeline:**
  ```
  [ Agent A Outbox ]
          │
          ▼
  [ Router: Local or Remote? ]
     ├───► Local (Fast Path)  ───► Write directly to Target inbox/ + local IPC emit
     └───► Nostr Mesh         ───► NIP-44 Encrypt ──► Sign (nsec) ──► Publish to Relays
                                                                         │
  [ Relay Network ] ◄────────────────────────────────────────────────────┘
          │ (Subscription Filter: kind 1059 / p-tag matching active npubs)
          ▼
  [ Inbound Relay Listener ] ──► Decrypt (nsec) ──► Deposit in Target inbox/
  ```
* **Relay Management (`src/main/nostr/relays.ts`):**
  * Configurable relay pool (defaults: `wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.primal.net`, plus local `ws://127.0.0.1:7777` support).
  * Connection health monitoring, auto-reconnect, and per-agent read/write relay preferences.

---

## 3. Terminology & Codebase Refactoring

| Legacy Term | New Term | Code Context / Affected Files |
|---|---|---|
| `Michael / godId / isGod` | **Orchestrator / Coordinator / Root Node** | `hive.ts`, `roster.ts`, `preload/index.ts`, `App.tsx` |
| `Hive` | **Swarm / Mesh / Network** | `hive.ts`, directory structures, IPC namespaces |
| `Employees / Cast` | **Agents / Sovereign Operatives** | Roster UI, Agent creation modals, Presets |
| `Dunder Mifflin / Paper Co` | **Autonomous Agent Mesh** | Titles, headers, package metadata |
| `munderdifflin://` | **`sovereign://` or `nostragent://`** | Deep-link URI scheme for sharing agent manifests |
| `in.munderdiffl.app` | **`app.sovereignhive` (or chosen brand ID)** | `electron-builder.yml`, `package.json` |

---

## 4. UI & Visual System Rebranding

### 4.1 Design Tokens & Color Palette (`src/renderer/src/design/`)
* **Primary Accent:** Nostr Violet / Electric Purple (`#8B5CF6` / `#7C3AED` / `#A78BFA`).
* **Dark Surfaces:** Obsidian & Deep Slate (`#0B0F19`, `#111827`, `#1F2937`, `#374151`).
* **Light Surfaces (Optional / High Contrast):** Crisp Cool White & Platinum Slate (`#F8FAFC`, `#F1F5F9`, `#E2E8F0`).
* **Status Indicators:**
  * Active / Online: Emerald Neon (`#10B981`)
  * Relay Connected / Encrypted: Cyan Glow (`#06B6D4`)
  * Human Gate / Gated Tool: Amber Alert (`#F59E0B`)
  * Circuit Breaker / Halt: Crimson Rose (`#F43F5E`)

### 4.2 UI Surfaces & Floor Redesign
* **Command Center & Panels:**
  * Clean, border-accented glassmorphic panels with dark-mode first contrast.
  * Agent detail drawer displaying `npub`, NIP-05 verification badges, relay status, and active token metrics.
* **Interactive Floor / Topology Visualizer:**
  * Evolve the 2D floor into a **Cyber Swarm Grid / Node Topology Floor**.
  * Avatars dynamically display their Nostr profile picture (`pfp`), falling back to customizable pixel/vector cyber avatars.
  * Visual packet/event beams when Nostr messages are signed, encrypted, and published to relays.

---

## 5. Phased Implementation Roadmap

### Phase 1: Cryptographic Foundation (`nostr-tools`)
- [ ] Add `nostr-tools` (`npm install nostr-tools`).
- [ ] Implement `src/main/nostr/crypto.ts` (secp256k1 key generation, bech32 encoding/decoding for `nsec`/`npub`).
- [ ] Implement `src/main/nostr/vault.ts` (secure encryption at rest using Electron `safeStorage`).
- [ ] Add unit tests for key generation, storage, and recovery.

### Phase 2: NIP-44 & NIP-59 Transport Layer
- [ ] Implement `src/main/nostr/encryption.ts` (NIP-44 v2 encrypt / decrypt).
- [ ] Implement `src/main/nostr/giftwrap.ts` (NIP-59 / NIP-17 event wrapping & unwrapping).
- [ ] Implement `src/main/nostr/relayClient.ts` (WebSocket relay pool management, connection pooling, publish/subscribe loops).
- [ ] Unit & integration tests for relay publish/subscribe and encrypted roundtrips.

### Phase 3: Hive Router Bridge Integration
- [ ] Extend `HiveManager` in `src/main/hive.ts` to assign `npub` / `nsec` on agent creation.
- [ ] Update `routeOnce()` / `routeMessage()` to publish remote messages to Nostr relays when the recipient has an `npub`.
- [ ] Implement background Nostr relay subscription that injects inbound decrypted events into recipient agent `inbox/`.
- [ ] Maintain the fast local filesystem path for agents on the same machine.

### Phase 4: Terminology & Core Refactor
- [ ] Refactor `isGod` / `godId` to `isOrchestrator` / `orchestratorId` across main, preload, and renderer.
- [ ] Update `electron-builder.yml`, `package.json`, and application metadata.
- [ ] Update deep-link handler protocol (`sovereign://` or `nostragent://`).

### Phase 5: UI & Design System Overhaul
- [ ] Rewrite `tokens.css` and `tokens.ts` with the new Nostr dark slate & violet color palette.
- [ ] Rebrand header chrome, logos, modals, and panel styling.
- [ ] Add Nostr identity widgets (copy `npub`, QR codes, relay management drawer).
- [ ] Update the floor visualizer with Nostr avatars and relay message animations.

---

## 6. Verification & Acceptance Criteria

1. **Self-Contained Security:** No private keys (`nsec`) ever cross the IPC bridge to the renderer in plaintext.
2. **Deterministic E2E Encryption:** All inter-agent traffic over relays is verified to be NIP-44 encrypted; plaintext payloads are never sent over WebSocket.
3. **Seamless Multi-Agent Collaboration:** A local Orchestrator agent can assign tasks to a remote agent on another machine via relay, and receive the completed result back into its inbox.
4. **Clean Builds:** `npm run typecheck`, test suites, and `npm run dist:linux` build without errors.
