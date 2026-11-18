import {
  AppLanguage,
  Collection,
  DevNotesMetaMap,
  DevProjectsConfigMap,
  DevWorkflowToolId,
  Note,
  NoteSummary,
} from '../types';

const DEV_INTRO_KEY = 'nook_dev_tools_intro_seen';
const DEV_TIPS_KEY = 'nook_dev_tool_tips_dismissed';

export function hasSeenDevIntro(): boolean {
  try {
    return localStorage.getItem(DEV_INTRO_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markDevIntroSeen(): void {
  try {
    localStorage.setItem(DEV_INTRO_KEY, 'true');
  } catch {
    // ignore storage errors
  }
}

export function getDismissedToolTips(): Set<DevWorkflowToolId> {
  try {
    const raw = localStorage.getItem(DEV_TIPS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed as DevWorkflowToolId[]);
    }
  } catch {
    // ignore parse errors
  }
  return new Set();
}

export function dismissToolTip(toolId: DevWorkflowToolId): void {
  try {
    const existing = getDismissedToolTips();
    existing.add(toolId);
    localStorage.setItem(DEV_TIPS_KEY, JSON.stringify(Array.from(existing)));
  } catch {
    // ignore storage errors
  }
}

export function parseDevProjectsConfig(raw?: string | null): DevProjectsConfigMap {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as DevProjectsConfigMap;
    }
  } catch {
    // ignore invalid JSON
  }
  return {};
}

export function parseDevNotesMeta(raw?: string | null): DevNotesMetaMap {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as DevNotesMetaMap;
    }
  } catch {
    // ignore invalid JSON
  }
  return {};
}

/**
 * Walks up parent_id chain (with cycle guard) to find the top-level Project/Root Collection ID.
 */
export function resolveRootProjectId(
  collectionId: string | null | undefined,
  collections: Collection[]
): string | null {
  if (!collectionId) return null;
  const byId = new Map(collections.map((c) => [c.id, c]));
  const visited = new Set<string>();
  let curr: string | null = collectionId;

  while (curr && !visited.has(curr)) {
    visited.add(curr);
    const col = byId.get(curr);
    if (!col) break;
    if (!col.parent_id) return col.id;
    curr = col.parent_id;
  }
  return collectionId;
}

/**
 * Collects a collection ID plus all descendant folder IDs recursively (with cycle guard).
 */
export function getDescendantCollectionIds(
  rootCollectionId: string,
  collections: Collection[]
): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const queue = [rootCollectionId];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    result.push(cur);

    for (const col of collections) {
      if (col.parent_id === cur && !visited.has(col.id)) {
        queue.push(col.id);
      }
    }
  }
  return result;
}

export function getNotesInCollectionSubtree(
  collectionId: string,
  collections: Collection[],
  notes: NoteSummary[]
): NoteSummary[] {
  const allowedIds = new Set(getDescendantCollectionIds(collectionId, collections));
  return notes.filter((n) => n.collection_id && allowedIds.has(n.collection_id));
}

export function getCollectionBreadcrumbPath(
  collectionId: string | null,
  collections: Collection[],
  stopAtCollectionId?: string | null
): string {
  if (!collectionId) return '';
  const byId = new Map(collections.map((c) => [c.id, c]));
  const parts: string[] = [];
  const visited = new Set<string>();
  let curr: string | null = collectionId;

  while (curr && !visited.has(curr)) {
    visited.add(curr);
    if (stopAtCollectionId && curr === stopAtCollectionId) break;
    const col = byId.get(curr);
    if (!col) break;
    parts.unshift(col.name);
    curr = col.parent_id;
  }
  return parts.join(' / ');
}

export interface ContextPackNoteInput {
  note: Note | NoteSummary;
  folderPath?: string;
}

export function assembleContextPackMarkdown(options: {
  projectName: string;
  items: ContextPackNoteInput[];
  includeHeader: boolean;
  headerPrefix: string;
  untitledLabel: string;
}): string {
  const { projectName, items, includeHeader, headerPrefix, untitledLabel } = options;
  if (items.length === 0) return '';

  const chunks: string[] = [];
  if (includeHeader && projectName.trim()) {
    chunks.push(`# ${headerPrefix}: ${projectName.trim()}`);
  }

  for (const item of items) {
    const title = (item.note.title || '').trim() || untitledLabel;
    const body = 'content' in item.note ? item.note.content : item.note.snippet;
    const heading = item.folderPath ? `## [${item.folderPath}] ${title}` : `## ${title}`;
    const trimmedBody = (body || '').trim();
    chunks.push(trimmedBody ? `${heading}\n\n${trimmedBody}` : `${heading}`);
  }

  return chunks.join('\n\n---\n\n').trim() + '\n';
}

export function measureTextStats(text: string): { chars: number; lines: number; words: number } {
  if (!text) return { chars: 0, lines: 0, words: 0 };
  const lines = text.split(/\r\n|\r|\n/).length;
  const words = (text.match(/[\p{L}\p{N}]+/gu) || []).length;
  return { chars: text.length, lines, words };
}

// ----------------------------------------------------------------------------
// PROMPT LIBRARY HELPERS ({{variable}} extraction & safe single-pass fill)
// ----------------------------------------------------------------------------
const PROMPT_VAR_REGEX = /\{\{([^{}\r\n]{1,64})\}\}/g;

export function extractPromptVariables(content: string): string[] {
  if (!content) return [];
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const match of content.matchAll(PROMPT_VAR_REGEX)) {
    const key = match[1].trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      ordered.push(key);
    }
  }
  return ordered;
}

export function fillPromptVariables(
  content: string,
  values: Record<string, string>
): string {
  if (!content) return '';
  return content.replace(PROMPT_VAR_REGEX, (fullMatch, rawName: string) => {
    const key = rawName.trim();
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      const replacement = values[key];
      if (replacement !== undefined && replacement !== '') {
        return replacement;
      }
    }
    return fullMatch;
  });
}

export function humanizeVarName(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  if (!spaced) return name;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function createStarterPromptTemplate(lang: AppLanguage, projectName?: string): {
  title: string;
  content: string;
} {
  const proj = projectName?.trim() || 'Projeto';
  if (lang === 'en') {
    return {
      title: `Prompt — ${projectName?.trim() || 'Reusable Template'}`,
      content: [
        '# Task Prompt',
        '',
        `Project: {{project_name}}`,
        'Language / Stack: {{language}}',
        '',
        '## Goal',
        '{{goal}}',
        '',
        '## Constraints & Rules',
        '{{constraints}}',
      ].join('\n'),
    };
  }
  if (lang === 'es') {
    return {
      title: `Prompt — ${projectName?.trim() || 'Plantilla Reutilizable'}`,
      content: [
        '# Prompt de Tarea',
        '',
        'Proyecto: {{nombre_del_proyecto}}',
        'Lenguaje / Stack: {{lenguaje}}',
        '',
        '## Objetivo',
        '{{objetivo}}',
        '',
        '## Restricciones y Reglas',
        '{{restricciones}}',
      ].join('\n'),
    };
  }
  return {
    title: `Prompt — ${proj}`,
    content: [
      '# Prompt de Tarefa',
      '',
      'Projeto: {{nome_do_projeto}}',
      'Linguagem / Stack: {{linguagem}}',
      '',
      '## Objetivo',
      '{{objetivo}}',
      '',
      '## Restrições e Regras',
      '{{restricoes}}',
    ].join('\n'),
  };
}

// ----------------------------------------------------------------------------
// SESSION HANDOFF HELPERS
// ----------------------------------------------------------------------------
export interface HandoffFields {
  done: string;
  nextSteps: string;
  issues: string;
  importantInfo: string;
}

export interface HandoffSectionLabels {
  done: string;
  nextSteps: string;
  issues: string;
  importantInfo: string;
}

export function formatHandoffTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function formatHandoffNoteMarkdown(
  fields: HandoffFields,
  labels: HandoffSectionLabels
): string {
  const sections: Array<[string, string]> = [
    [labels.done, fields.done],
    [labels.nextSteps, fields.nextSteps],
    [labels.issues, fields.issues],
    [labels.importantInfo, fields.importantInfo],
  ];

  const blocks = sections.map(([heading, body]) => {
    const clean = body.trim();
    return clean ? `## ${heading}\n\n${clean}` : `## ${heading}\n\n`;
  });

  return `${blocks.join('\n\n')}\n`;
}

export function formatHandoffForAgentCopy(options: {
  projectName?: string;
  noteTitle: string;
  content: string;
  headerPrefix: string;
}): string {
  const { projectName, noteTitle, content, headerPrefix } = options;
  const trimmed = (content || '').trim();
  if (!trimmed) return '';

  // Remove empty Markdown headings (`## Heading` with no body until next heading) cleanly
  const lines = trimmed.replace(/\r\n/g, '\n').split('\n');
  const sections: Array<{ heading: string | null; bodyLines: string[] }> = [];
  let current: { heading: string | null; bodyLines: string[] } = {
    heading: null,
    bodyLines: [],
  };

  for (const line of lines) {
    if (/^##\s+.+/.test(line)) {
      sections.push(current);
      current = { heading: line, bodyLines: [] };
    } else {
      current.bodyLines.push(line);
    }
  }
  sections.push(current);

  const nonEmptyBlocks: string[] = [];
  for (const sec of sections) {
    const body = sec.bodyLines.join('\n').trim();
    if (!body && sec.heading) continue;
    if (!body && !sec.heading) continue;
    nonEmptyBlocks.push(sec.heading ? `${sec.heading}\n\n${body}` : body);
  }

  const finalBody = nonEmptyBlocks.length > 0 ? nonEmptyBlocks.join('\n\n') : trimmed;
  const header = projectName?.trim()
    ? `# ${headerPrefix} — ${projectName.trim()} (${noteTitle.trim() || headerPrefix})`
    : `# ${noteTitle.trim() || headerPrefix}`;

  return `${header}\n\n${finalBody}\n`;
}

// ----------------------------------------------------------------------------
// DEV JOURNAL HELPERS
// ----------------------------------------------------------------------------
export interface JournalSectionLabels {
  whatChanged: string;
  whyChanged: string;
  problemsFound: string;
  decisions: string;
  nextSteps: string;
}

export function formatJournalEntryTitle(prefix: string, date = new Date()): string {
  return `${prefix} — ${formatHandoffTimestamp(date)}`;
}

export function formatJournalEntryMarkdown(labels: JournalSectionLabels): string {
  return [
    `## ${labels.whatChanged}`,
    '',
    '',
    `## ${labels.whyChanged}`,
    '',
    '',
    `## ${labels.problemsFound}`,
    '',
    '',
    `## ${labels.decisions}`,
    '',
    '',
    `## ${labels.nextSteps}`,
    '',
    '',
  ].join('\n');
}
