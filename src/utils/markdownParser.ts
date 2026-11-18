import { marked } from 'marked';
import DOMPurify from 'dompurify';

export interface FrontmatterResult {
  properties: Record<string, string>;
  body: string;
}

/**
 * Extracts YAML frontmatter (properties) from the start of a markdown note
 */
export function extractFrontmatter(markdown: string): FrontmatterResult {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return { properties: {}, body: markdown };
  }

  const rawYaml = match[1];
  const body = markdown.slice(match[0].length);
  const properties: Record<string, string> = {};

  rawYaml.split('\n').forEach((line) => {
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      if (key) {
        // Strip quotes or brackets if present
        properties[key] = val.replace(/^["'\[](.*)["'\]]$/, '$1');
      }
    }
  });

  return { properties, body };
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Parses Obsidian Callouts:
 * > [!note] Title
 * > Content
 */
export function parseObsidianCallouts(markdown: string): string {
  return markdown.replace(
    /^>[ \t]*\[!([a-zA-Z0-9_-]+)\][ \t]*(.*)?\n((?:>[ \t]*.*\n?)*)/gm,
    (_match, rawType, rawTitle, bodyLines) => {
      const type = rawType.toLowerCase();
      const title =
        (rawTitle && rawTitle.trim()) ||
        type.charAt(0).toUpperCase() + type.slice(1);

      const cleanBody = bodyLines
        .split('\n')
        .map((line: string) => line.replace(/^>[ \t]?/, ''))
        .join('\n');

      return `<div class="obsidian-callout callout-${escapeHtmlAttr(type)}" data-callout-type="${escapeHtmlAttr(type)}"><div class="callout-header"><span class="callout-indicator"></span><span class="callout-title">${escapeHtmlAttr(title)}</span></div><div class="callout-body">\n\n${cleanBody}\n\n</div></div>\n\n`;
    }
  );
}

/**
 * Parses Obsidian Wikilinks:
 * [[Note Title]] or [[Note Title|Custom Display Label]]
 */
export function parseWikilinks(text: string): string {
  return text.replace(/\[\[([^|\]\n]+)(?:\|([^\]\n]+))?\]\]/g, (_match, target, alias) => {
    const cleanTarget = target.trim();
    const label = (alias && alias.trim()) || cleanTarget;
    return `<a href="#wikilink" class="nook-wikilink lumina-wikilink" data-wikilink="${escapeHtmlAttr(cleanTarget)}">${escapeHtmlAttr(label)}</a>`;
  });
}

/**
 * Parses Hashtags:
 * #tag or #projeto/design (excluding markdown headers # Heading)
 */
export function parseTags(text: string): string {
  return text.replace(/(^|\s)#([a-zA-ZÀ-ÿ][a-zA-Z0-9_\-\/]*)/g, (_match, space, tag) => {
    const safeTag = escapeHtmlAttr(tag);
    return `${space}<span class="nook-tag lumina-tag" data-tag="${safeTag}">#${safeTag}</span>`;
  });
}

/**
 * Toggles the n-th task checkbox in raw markdown content
 */
export function toggleTaskCheckbox(content: string, targetIndex: number): string {
  let currentIndex = 0;
  return content.replace(
    /^([ \t]*[-*+][ \t]+\[)([ xX])(\][ \t]+.*)$/gm,
    (match, prefix, check, suffix) => {
      if (currentIndex === targetIndex) {
        currentIndex++;
        const newCheck = check.trim() ? ' ' : 'x';
        return `${prefix}${newCheck}${suffix}`;
      }
      currentIndex++;
      return match;
    }
  );
}

/**
 * Full Markdown parsing pipeline:
 * Frontmatter -> Callouts -> Wikilinks -> Marked (GFM + Tasks) -> DOMPurify
 */
export function renderMarkdownToHtml(markdown: string): { html: string; properties: Record<string, string> } {
  const { properties, body } = extractFrontmatter(markdown);

  // Protect fenced code blocks and inline code spans before transforming callouts, wikilinks, and hashtags
  const codePlaceholders: string[] = [];
  const protectCode = (src: string): string => {
    const saveSlot = (raw: string) => {
      const idx = codePlaceholders.length;
      codePlaceholders.push(raw);
      return `\u0000NOOKCODE${idx}\u0000`;
    };
    return src
      .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, saveSlot)
      .replace(/`[^`\n]+`/g, saveSlot);
  };
  const restoreCode = (src: string): string =>
    src.replace(/\u0000NOOKCODE(\d+)\u0000/g, (_m, idx) => codePlaceholders[Number(idx)] ?? '');

  // 1. Pre-process Obsidian extensions safely outside code blocks
  let processed = protectCode(body);
  processed = parseObsidianCallouts(processed);
  processed = parseWikilinks(processed);
  processed = parseTags(processed);
  processed = restoreCode(processed);

  // 2. Configure marked with interactive task checkboxes
  const renderer = new marked.Renderer();
  let taskIndex = 0;

  renderer.checkbox = ({ checked }) => {
    const idx = taskIndex++;
    return `<input type="checkbox" class="nook-task-checkbox lumina-task-checkbox" data-task-index="${idx}" ${
      checked ? 'checked' : ''
    } />`;
  };

  renderer.link = ({ href, title, text }) => {
    const isWiki = href === '#wikilink';
    const isExternal = href?.startsWith('http://') || href?.startsWith('https://');
    const titleAttr = title ? ` title="${title}"` : '';
    const targetAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
    const className = isWiki ? ' class="nook-wikilink lumina-wikilink"' : ' class="nook-link lumina-link"';
    return `<a href="${href}"${className}${targetAttr}${titleAttr}>${text}</a>`;
  };

  const rawHtml = marked.parse(processed, {
    renderer,
    gfm: true,
    breaks: true,
  }) as string;

  // 3. Sanitize HTML for security
  const cleanHtml = DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['data-task-index', 'data-wikilink', 'data-tag', 'data-callout-type', 'target', 'rel'],
    ADD_TAGS: ['input'],
  });

  return { html: cleanHtml, properties };
}
