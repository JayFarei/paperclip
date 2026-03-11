export const ARTIFACT_MENTION_SCHEME = "artifact://";

const ARTIFACT_MENTION_LINK_RE = /\[[^\]]*]\((artifact:\/\/[^)\s]+)\)/gi;

export interface ParsedArtifactMention {
  projectUrlKey: string;
  path: string;
}

export function buildArtifactMentionHref(projectUrlKey: string, relativePath: string): string {
  return `${ARTIFACT_MENTION_SCHEME}${projectUrlKey.trim()}/${relativePath.trim()}`;
}

export function parseArtifactMentionHref(href: string): ParsedArtifactMention | null {
  if (!href.startsWith(ARTIFACT_MENTION_SCHEME)) return null;

  const rest = href.slice(ARTIFACT_MENTION_SCHEME.length);
  const slashIndex = rest.indexOf("/");
  if (slashIndex <= 0) return null;

  const projectUrlKey = rest.slice(0, slashIndex).trim();
  const path = rest.slice(slashIndex + 1).trim();
  if (!projectUrlKey || !path) return null;

  return { projectUrlKey, path };
}

export function extractArtifactPaths(markdown: string): ParsedArtifactMention[] {
  if (!markdown) return [];
  const results: ParsedArtifactMention[] = [];
  const re = new RegExp(ARTIFACT_MENTION_LINK_RE);
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    const parsed = parseArtifactMentionHref(match[1]);
    if (parsed) results.push(parsed);
  }
  return results;
}
