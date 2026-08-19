/**
 * SovereignHive Nostr Agent Profiles (NIP-01 Kind 0)
 *
 * Builds standard Nostr profile metadata events for agents to broadcast their
 * role, display name, avatar, and system capabilities across Nostr relays.
 */
import { signEvent } from './crypto';
import type { NostrProfileMetadata, VerifiedEvent } from './types';

/**
 * Construct and sign a NIP-01 Kind 0 metadata event for an agent.
 */
export function buildAgentProfileEvent(
  secretKey: Uint8Array,
  profile: NostrProfileMetadata,
  createdAtSeconds = Math.floor(Date.now() / 1000)
): VerifiedEvent {
  const content = JSON.stringify({
    name: profile.name,
    display_name: profile.displayName ?? profile.name,
    about: profile.about ?? '',
    picture: profile.picture ?? '',
    banner: profile.banner ?? '',
    nip05: profile.nip05 ?? '',
    lud16: profile.lud16 ?? '',
    bot: profile.bot !== false // default true for autonomous agent nodes
  });

  const template = {
    kind: 0,
    created_at: createdAtSeconds,
    tags: [
      ['client', 'SovereignHive'],
      ['bot', 'true']
    ],
    content
  };

  return signEvent(template, secretKey);
}

/**
 * Parse the content of a NIP-01 Kind 0 event into NostrProfileMetadata.
 */
export function parseAgentProfileContent(contentJson: string): NostrProfileMetadata | null {
  try {
    const parsed = JSON.parse(contentJson);
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      name: String(parsed.name ?? ''),
      displayName: parsed.display_name ? String(parsed.display_name) : undefined,
      about: parsed.about ? String(parsed.about) : undefined,
      picture: parsed.picture ? String(parsed.picture) : undefined,
      banner: parsed.banner ? String(parsed.banner) : undefined,
      nip05: parsed.nip05 ? String(parsed.nip05) : undefined,
      lud16: parsed.lud16 ? String(parsed.lud16) : undefined,
      bot: parsed.bot === true || parsed.bot === 'true'
    };
  } catch {
    return null;
  }
}
