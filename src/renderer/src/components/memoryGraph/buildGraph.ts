// Build the memory-graph model from existing hive data — no new IPC needed.
// Inputs come straight from the preload bridge / store:
//   - agents:   useStore(s => s.agents)
//   - log:      window.cth.hiveLog(200)   (we read kind:'message' entries)
//   - memories: window.cth.hiveMemory(id) per agent (only when topics are on)
// See MEMORY_GRAPH_SPEC.md §3–§5.

import type { AccentColorName } from '@/design/tokens';
import type { StatusKind } from '@/components/PixelBadge';
import type { MessageAct } from '@/scene/office/MessageEnvelope';
import { extractTopics } from './extractTopics';

export interface AgentNode {
  kind: 'agent';
  id: string;
  label: string;
  accent: AccentColorName;
  status: StatusKind;
  isGod: boolean;
  isOrchestrator?: boolean;
  /** number of message edges touching this agent (drives node size) */
  degree: number;
}
export interface TopicNode {
  kind: 'topic';
  id: string;
  label: string;
  /** how many agents share the topic */
  weight: number;
}
export interface PseudoNode {
  kind: 'pseudo';
  id: 'broadcast' | 'human';
  label: string;
}
export type GraphNode = AgentNode | TopicNode | PseudoNode;

export interface GraphEdge {
  id: string;
  kind: 'message' | 'topic';
  source: string;
  target: string;
  /** message: # messages on the pair; topic: 1 */
  weight: number;
  /** message edges only — direction of traffic between the pair */
  dir?: 'fwd' | 'bwd' | 'both';
  lastAct?: MessageAct;
  lastSubject?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** topics actually shown */
  topicShown: number;
  /** total qualifying topics (for the "showing N of M" cap notice) */
  topicTotal: number;
}

/** Minimal shapes we depend on (kept loose — hiveLog is loosely typed). */
export interface MinimalAgent {
  id: string;
  name: string;
  accent: AccentColorName;
  status: StatusKind;
  isGod?: boolean;
  isOrchestrator?: boolean;
}
export interface MessageLogEntry {
  ts?: number;
  kind?: string;
  from?: string;
  to?: string;
  act?: MessageAct;
  subject?: string;
  [k: string]: unknown;
}

export interface BuildOpts {
  showTopics?: boolean;
  memories?: Record<string, string>;
  maxTopics?: number;
}

function sortedPairKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

/**
 * Assemble nodes + edges. Agent + message layer is always built; the topic
 * layer is added only when `showTopics` is set and `memories` are supplied.
 */
export function buildGraph(
  agents: MinimalAgent[],
  log: MessageLogEntry[],
  opts: BuildOpts = {}
): GraphData {
  const byId = new Map(agents.map((a) => [a.id, a]));
  const degree = new Map<string, number>();

  // ── message edges: aggregate per unordered pair, remember direction + latest ─
  interface PairAcc {
    a: string; b: string;            // a < b
    fwd: number; bwd: number;        // a->b, b->a counts
    lastTs: number; lastAct?: MessageAct; lastSubject?: string;
  }
  const pairs = new Map<string, PairAcc>();
  const pseudoUsed = new Set<'broadcast' | 'human'>();

  const resolve = (ep?: string): string | null => {
    if (!ep) return null;
    if (byId.has(ep)) return ep;
    if (ep === 'broadcast') { pseudoUsed.add('broadcast'); return 'broadcast'; }
    if (ep === 'human') { pseudoUsed.add('human'); return 'human'; }
    return null; // unknown id — skip defensively
  };

  for (let i = 0; i < log.length; i++) {
    const e = log[i];
    if (e.kind !== 'message') continue;
    const from = resolve(e.from);
    const to = resolve(e.to);
    if (!from || !to || from === to) continue;
    degree.set(from, (degree.get(from) ?? 0) + 1);
    degree.set(to, (degree.get(to) ?? 0) + 1);
    const k = sortedPairKey(from, to);
    const existing = pairs.get(k);
    const isFwd = from < to;
    if (!existing) {
      pairs.set(k, {
        a: isFwd ? from : to,
        b: isFwd ? to : from,
        fwd: isFwd ? 1 : 0,
        bwd: isFwd ? 0 : 1,
        lastTs: e.ts ?? 0,
        lastAct: e.act,
        lastSubject: e.subject
      });
    } else {
      if (isFwd) existing.fwd++; else existing.bwd++;
      if ((e.ts ?? 0) >= existing.lastTs) {
        existing.lastTs = e.ts ?? existing.lastTs;
        existing.lastAct = e.act ?? existing.lastAct;
        existing.lastSubject = e.subject ?? existing.lastSubject;
      }
    }
  }

  // ── assemble GraphData ────────────────────────────────────────────────────────
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // agent nodes — only those that actually appear, plus orchestrator, to avoid lone dots.
  // We include every roster agent so the floor is fully represented.
  for (const a of agents) {
    nodes.push({
      kind: 'agent',
      id: a.id,
      label: a.name,
      accent: a.accent,
      status: a.status,
      isGod: !!a.isGod,
      isOrchestrator: !!(a.isOrchestrator ?? a.isGod),
      degree: degree.get(a.id) ?? 0
    });
  }
  if (pseudoUsed.has('broadcast')) nodes.push({ kind: 'pseudo', id: 'broadcast', label: 'broadcast' });
  if (pseudoUsed.has('human')) nodes.push({ kind: 'pseudo', id: 'human', label: 'human' });

  for (const p of pairs.values()) {
    const dir: GraphEdge['dir'] = p.fwd && p.bwd ? 'both' : p.fwd ? 'fwd' : 'bwd';
    edges.push({
      id: `message:${p.a}\u0000${p.b}`,
      kind: 'message',
      source: p.a,
      target: p.b,
      weight: p.fwd + p.bwd,
      dir,
      lastAct: p.lastAct,
      lastSubject: p.lastSubject
    });
  }

  // ── topic layer (optional) ──────────────────────────────────────────────────
  let topicShown = 0;
  let topicTotal = 0;
  if (opts.showTopics && opts.memories) {
    const { topics, total } = extractTopics(opts.memories, opts.maxTopics ?? 24);
    topicTotal = total;
    topicShown = topics.length;
    for (const t of topics) {
      nodes.push({ kind: 'topic', id: t.id, label: t.label, weight: t.weight });
      for (const agentId of t.agentIds) {
        if (!byId.has(agentId)) continue;
        edges.push({ id: `topic:${agentId}\u0000${t.id}`, kind: 'topic', source: agentId, target: t.id, weight: 1 });
      }
    }
  }

  return { nodes, edges, topicShown, topicTotal };
}
