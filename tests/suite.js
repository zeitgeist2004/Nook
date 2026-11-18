// Automated verification test suite for Lumina Notes business logic
import assert from 'node:assert';

console.log('--- Executando Suite de Testes do Nook ---');

// 1. Test Cycle Prevention Algorithm
function canMoveFolder(targetId, movedId, getParent) {
  if (targetId === movedId) return false;
  let curr = targetId;
  const visited = new Set();
  while (curr) {
    if (curr === movedId) return false;
    if (visited.has(curr)) break;
    visited.add(curr);
    curr = getParent(curr);
  }
  return true;
}

const folders = {
  'proj-1': { parent: null },
  'folder-a': { parent: 'proj-1' },
  'folder-b': { parent: 'folder-a' },
  'folder-c': { parent: 'folder-b' },
  'proj-2': { parent: null },
};
const getParent = (id) => folders[id]?.parent || null;

assert.strictEqual(canMoveFolder('folder-b', 'folder-b', getParent), false, 'Cannot move into itself');
assert.strictEqual(canMoveFolder('folder-c', 'proj-1', getParent), false, 'Cannot move parent into descendant');
assert.strictEqual(canMoveFolder('folder-c', 'folder-a', getParent), false, 'Cannot move folder-a into folder-c');
assert.strictEqual(canMoveFolder('proj-2', 'folder-b', getParent), true, 'Can move folder-b into proj-2');
assert.strictEqual(canMoveFolder(null, 'folder-b', getParent), true, 'Can move folder-b to root');
console.log('✓ Teste 1: Prevenção de ciclos na hierarquia passou com sucesso.');

// 2. Test Snippet Extraction with Diacritics and Unicode
function extractSnippet(content, query) {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const pos = lowerContent.indexOf(lowerQuery);
  if (pos !== -1) {
    const start = Math.max(0, pos - 25);
    const end = Math.min(content.length, pos + query.length + 45);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < content.length ? '...' : '';
    return prefix + content.slice(start, end) + suffix;
  }
  return content.slice(0, 70);
}

const doc = 'Hoje foi feita a validação da arquitetura de persistência SQLite com suporte a WAL mode e criptografia.';
const snippet = extractSnippet(doc, 'SQLite');
assert.ok(snippet.includes('SQLite'), 'Snippet must contain search term');
assert.ok(snippet.includes('persistência'), 'Snippet must contain context around term');
console.log('✓ Teste 2: Extração de snippet com contexto e Unicode passou com sucesso.');

// 3. Test Filename Sanitization for Windows Export
function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim();
}
assert.strictEqual(sanitizeFilename('Reunião: 10/11/2026? <Urgente>'), 'Reunião_ 10_11_2026_ _Urgente_');
assert.strictEqual(sanitizeFilename('Nota Normal'), 'Nota Normal');
console.log('✓ Teste 3: Sanitização de nomes de arquivo no Windows passou com sucesso.');

// 4. Test Version Sequencing for Auto-Save
class AutoSaveSequencer {
  constructor() {
    this.latestCommitted = 0;
  }
  canCommit(version) {
    if (version >= this.latestCommitted) {
      this.latestCommitted = version;
      return true;
    }
    return false;
  }
}

const seq = new AutoSaveSequencer();
assert.strictEqual(seq.canCommit(1), true, 'Commit v1');
assert.strictEqual(seq.canCommit(3), true, 'Commit v3');
assert.strictEqual(seq.canCommit(2), false, 'Reject stale out-of-order write v2');
assert.strictEqual(seq.canCommit(4), true, 'Commit v4');
console.log('✓ Teste 4: Controle de concorrência e descarte de gravações antigas passou com sucesso.');

// 5. Test Note Move to Project / Collection
function moveNote(note, targetCollectionId) {
  return { ...note, collection_id: targetCollectionId, updated_at: Date.now() };
}
const note1 = { id: 'note-1', title: 'Nota Rápida', collection_id: null };
const movedNote = moveNote(note1, 'proj-1');
assert.strictEqual(movedNote.collection_id, 'proj-1', 'Note must belong to proj-1');
const movedBack = moveNote(movedNote, null);
assert.strictEqual(movedBack.collection_id, null, 'Note must return to quick notes');
console.log('✓ Teste 5: Movimentação de nota para projeto e retorno passou com sucesso.');

// 6. Test Interactive Task Checkbox Toggle
function toggleTaskCheckbox(content, targetIndex) {
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
const taskDoc = "- [ ] Comprar café\n- [x] Ler documentação\n- [ ] Codificar feature";
const toggledTask = toggleTaskCheckbox(taskDoc, 0);
assert.ok(toggledTask.startsWith("- [x] Comprar café"), "Primeira tarefa deve ser marcada como concluída");
console.log('✓ Teste 6: Alternância interativa de checkboxes em Markdown passou com sucesso.');

// 7. Test Obsidian Callouts & Wikilinks Parser
function parseObsidianCallouts(markdown) {
  return markdown.replace(
    /^>[ \t]*\[!([a-zA-Z0-9_-]+)\][ \t]*(.*)?\n((?:>[ \t]*.*\n?)*)/gm,
    (_match, rawType, rawTitle, bodyLines) => {
      const type = rawType.toLowerCase();
      const title = (rawTitle && rawTitle.trim()) || type.charAt(0).toUpperCase() + type.slice(1);
      const cleanBody = bodyLines.split('\n').map((l) => l.replace(/^>[ \t]?/, '')).join('\n');
      return `<div class="obsidian-callout callout-${type}"><span class="callout-title">${title}</span><div>\n\n${cleanBody}\n\n</div></div>\n`;
    }
  );
}
function parseWikilinks(text) {
  return text.replace(/\[\[([^|\]\n]+)(?:\|([^\]\n]+))?\]\]/g, (_match, target, alias) => {
    const label = (alias && alias.trim()) || target.trim();
    return `<a href="#wikilink" class="nook-wikilink lumina-wikilink" data-wikilink="${target.trim()}">${label}</a>`;
  });
}
const obsidianDoc = "> [!tip] Dica Importante\n> Revise antes de publicar\n\nVeja [[Minha Nota]] para detalhes.";
const parsedCallout = parseObsidianCallouts(obsidianDoc);
assert.ok(parsedCallout.includes('callout-tip'), "Deve conter classe callout-tip");
assert.ok(parsedCallout.includes('Dica Importante'), "Deve conter título do callout");
const parsedWiki = parseWikilinks(parsedCallout);
assert.ok(parsedWiki.includes('data-wikilink="Minha Nota"'), "Deve conter link wikilink para Minha Nota");
console.log('✓ Teste 7: Parser de Callouts do Obsidian e Wikilinks passou com sucesso.');

// 8. Test Word and Character Counting with Unicode & Portuguese Accents
function calculateStats(text) {
  if (!text || text.length === 0) return { chars: 0, words: 0 };
  const words = text.match(/[\p{L}\p{N}]+/gu);
  const wordCount = words ? words.length : 0;
  const charCount = Array.from(text).length;
  return { chars: charCount, words: wordCount };
}
const ptText = "Atenção: o Nook é ultra-rápido, 100% minimalista e confiável!";
const stats = calculateStats(ptText);
// Palavras: ["Atenção", "o", "Nook", "é", "ultra", "rápido", "100", "minimalista", "e", "confiável"] -> 10 tokens
assert.strictEqual(stats.words, 10, "Deve contar exatamente 10 palavras com acentuação e pontuação ignorada");
assert.strictEqual(stats.chars, ptText.length, "Deve contar caracteres corretamente");
console.log('✓ Teste 8: Contador de palavras e caracteres com Unicode e Português passou com sucesso.');

// 9. Test Intelligent Auto-Save Debounce & Max-Wait Logic
class AutoSaveTimer {
  constructor(debounceMs = 350, maxWaitMs = 2000) {
    this.debounceMs = debounceMs;
    this.maxWaitMs = maxWaitMs;
    this.firstChangeTime = null;
    this.lastChangeTime = null;
  }
  recordChange(now) {
    if (this.firstChangeTime === null) this.firstChangeTime = now;
    this.lastChangeTime = now;
  }
  shouldFlush(now) {
    if (this.firstChangeTime === null) return false;
    const timeSinceLastChange = now - this.lastChangeTime;
    const timeSinceFirstChange = now - this.firstChangeTime;
    return timeSinceLastChange >= this.debounceMs || timeSinceFirstChange >= this.maxWaitMs;
  }
  reset() {
    this.firstChangeTime = null;
    this.lastChangeTime = null;
  }
}
const autoSave = new AutoSaveTimer(350, 2000);
autoSave.recordChange(1000);
assert.strictEqual(autoSave.shouldFlush(1200), false, "Não deve disparar antes dos 350ms de pausa");
assert.strictEqual(autoSave.shouldFlush(1400), true, "Deve disparar aos 400ms (> 350ms de debounce)");

// Test Continuous Typing Max Wait
const contTimer = new AutoSaveTimer(350, 2000);
let t = 0;
contTimer.recordChange(t);
for (let step = 0; step < 19; step++) {
  t += 100; // types every 100ms
  contTimer.recordChange(t);
  assert.strictEqual(contTimer.shouldFlush(t), false, `Não deve disparar prematuramente em t=${t}`);
}
// Now t = 2000ms: max-wait threshold reached!
t += 100;
contTimer.recordChange(t);
assert.strictEqual(contTimer.shouldFlush(t), true, "Deve forçar salvamento ao atingir max-wait de 2000ms durante digitação contínua");
console.log('✓ Teste 9: Auto-save debounce e max-wait interval de digitação contínua passou com sucesso.');

// 10. Test Version History Snapshot Retention Pruning
function pruneVersions(versions, maxVersions = 30, retentionDays = 7, nowMs = Date.now()) {
  const cutoff = nowMs - retentionDays * 24 * 60 * 60 * 1000;
  // Filter versions newer than cutoff, or keep up to maxVersions
  const recent = versions.filter(v => v.created_at >= cutoff);
  // Sort descending by creation
  recent.sort((a, b) => b.created_at - a.created_at);
  return recent.slice(0, maxVersions);
}
const now = Date.now();
const mockVersions = [];
for (let i = 0; i < 45; i++) {
  // versions created over the past 10 days
  mockVersions.push({ id: `v-${i}`, created_at: now - i * 6 * 60 * 60 * 1000 });
}
const pruned = pruneVersions(mockVersions, 30, 7, now);
assert.ok(pruned.length <= 30, "Não deve ultrapassar o limite máximo de 30 versões");
assert.ok(pruned.every(v => v.created_at >= now - 7 * 24 * 60 * 60 * 1000), "Todas as versões devem estar dentro da janela de retenção de 7 dias");
console.log('✓ Teste 10: Retenção de versões (limite de 30 versões e janela de 7 dias) passou com sucesso.');

// 11. Test File Drag & Drop Title Extraction and Validation
function parseDroppedFile(filename) {
  const isSupported = /\.(txt|md|markdown)$/i.test(filename);
  const title = filename.replace(/\.(txt|md|markdown)$/i, '').trim() || 'Nota importada';
  return { isSupported, title };
}
assert.deepStrictEqual(parseDroppedFile('Planejamento Q4 2026.md'), { isSupported: true, title: 'Planejamento Q4 2026' });
assert.deepStrictEqual(parseDroppedFile('ideias_rapidas.txt'), { isSupported: true, title: 'ideias_rapidas' });
assert.deepStrictEqual(parseDroppedFile('artigo.markdown'), { isSupported: true, title: 'artigo' });
assert.strictEqual(parseDroppedFile('planilha.xlsx').isSupported, false, "Arquivos não textuais devem ser rejeitados");
console.log('✓ Teste 11: Importação de arquivos via drag & drop com extração limpa de título passou com sucesso.');

// 12. Test Daily Backup Snapshot Retention
function pruneDailyBackups(backupFilenames, retentionDays = 7, referenceDate = new Date()) {
  const cutoff = new Date(referenceDate.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  return backupFilenames.filter((fname) => {
    const match = fname.match(/nook_backup_(\d{4}-\d{2}-\d{2})\.db$/);
    if (!match) return false;
    const backupDate = new Date(match[1]);
    return backupDate >= cutoff;
  });
}
const refDate = new Date('2026-11-10T12:00:00Z');
const sampleBackups = [
  'nook_backup_2026-11-10.db',
  'nook_backup_2026-11-08.db',
  'nook_backup_2026-11-04.db',
  'nook_backup_2026-11-02.db',
  'nook_backup_2026-10-25.db', // > 7 days old
  'nook_backup_2026-10-15.db', // > 7 days old
];
const keptBackups = pruneDailyBackups(sampleBackups, 7, refDate);
assert.strictEqual(keptBackups.length, 3, "Deve reter apenas os backups dos últimos 7 dias (Nov 10, Nov 08, Nov 04)");
assert.ok(!keptBackups.includes('nook_backup_2026-11-02.db'), "Backup de 8 dias atrás deve ser podado");
assert.ok(!keptBackups.includes('nook_backup_2026-10-25.db'), "Backup antigo deve ser podado");
console.log('✓ Teste 12: Retenção e rotação de backups diários de 7 dias passou com sucesso.');

// 13. Test Tab Manager (Max 5 Tabs, Active Switch, Close Fallback)
class TabManager {
  constructor(maxTabs = 5) {
    this.maxTabs = maxTabs;
    this.tabs = [];
    this.activeTabId = null;
  }
  openTab(id, type, title, externalPath = undefined) {
    const existing = this.tabs.find(t => t.id === id);
    if (existing) {
      this.activeTabId = id;
      return;
    }
    const newTab = { id, type, title, externalPath };
    if (this.tabs.length < this.maxTabs) {
      this.tabs.push(newTab);
    } else {
      // Replace active tab
      const idx = this.tabs.findIndex(t => t.id === this.activeTabId);
      if (idx !== -1) {
        this.tabs[idx] = newTab;
      } else {
        this.tabs[this.tabs.length - 1] = newTab;
      }
    }
    this.activeTabId = id;
  }
  closeTab(id) {
    const idx = this.tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    this.tabs = this.tabs.filter(t => t.id !== id);
    if (this.activeTabId === id) {
      if (this.tabs.length > 0) {
        const nextIdx = Math.min(idx, this.tabs.length - 1);
        this.activeTabId = this.tabs[nextIdx].id;
      } else {
        this.activeTabId = null;
      }
    }
  }
}

const tm = new TabManager(5);
tm.openTab('note-1', 'note', 'Nota 1');
tm.openTab('note-2', 'note', 'Nota 2');
tm.openTab('note-3', 'note', 'Nota 3');
tm.openTab('note-4', 'note', 'Nota 4');
tm.openTab('file-5', 'external', 'doc.md', 'C:\\docs\\doc.md');
assert.strictEqual(tm.tabs.length, 5, "Deve conter exatamente 5 abas");
assert.strictEqual(tm.activeTabId, 'file-5', "Aba ativa deve ser a 5ª aberta");

// Open 6th tab: must enforce MAX_TABS = 5 by replacing active tab
tm.openTab('file-6', 'external', 'extra.md', 'C:\\docs\\extra.md');
assert.strictEqual(tm.tabs.length, 5, "Nunca deve ultrapassar 5 abas abertas simultâneas");
assert.strictEqual(tm.activeTabId, 'file-6', "Nova aba deve ser ativada");
assert.ok(tm.tabs.some(t => t.id === 'file-6'), "Aba file-6 deve estar presente");

// Close active tab: falls back to neighbor
tm.closeTab('file-6');
assert.strictEqual(tm.tabs.length, 4, "Deve restar 4 abas");
assert.strictEqual(tm.activeTabId, 'note-4', "Deve selecionar a aba vizinha");
console.log('✓ Teste 13: Gerenciamento de abas (limite máximo de 5 abas e fechamento seguro) passou com sucesso.');

// 14. Test Intelligent Drag & Drop Target Resolution
function resolveDropAction(point, hitTest) {
  const target = hitTest(point.x, point.y);
  if (target && target.collectionId) {
    return { action: 'import_to_collection', collectionId: target.collectionId };
  }
  if (target && target.isQuickNotesZone) {
    return { action: 'import_to_quick_notes' };
  }
  return { action: 'open_external_tab' };
}

const mockHitTest = (x, y) => {
  if (x < 250 && y < 150) return { collectionId: 'proj-design' };
  if (x < 250 && y >= 150 && y < 300) return { isQuickNotesZone: true };
  return null; // Free space / editor / tabs
};

assert.deepStrictEqual(resolveDropAction({ x: 100, y: 100 }, mockHitTest), { action: 'import_to_collection', collectionId: 'proj-design' });
assert.deepStrictEqual(resolveDropAction({ x: 100, y: 200 }, mockHitTest), { action: 'import_to_quick_notes' });
assert.deepStrictEqual(resolveDropAction({ x: 500, y: 400 }, mockHitTest), { action: 'open_external_tab' });
console.log('✓ Teste 14: Roteamento inteligente de arquivos soltos por drag & drop passou com sucesso.');

// 15. Test External File Persistence Path
function getSaveTarget(activeTab) {
  if (activeTab.type === 'external' && activeTab.externalPath) {
    return { target: 'disk', path: activeTab.externalPath };
  }
  return { target: 'sqlite', id: activeTab.id };
}
const extTab = { id: 'C:\\Users\\test\\CONTEXT.md', type: 'external', title: 'CONTEXT.md', externalPath: 'C:\\Users\\test\\CONTEXT.md' };
assert.deepStrictEqual(getSaveTarget(extTab), { target: 'disk', path: 'C:\\Users\\test\\CONTEXT.md' }, 'Salva direto no arquivo do Windows');
const noteTab = { id: 'uuid-123', type: 'note', title: 'Ideia' };
assert.deepStrictEqual(getSaveTarget(noteTab), { target: 'sqlite', id: 'uuid-123' }, 'Salva no banco SQLite local');
console.log('✓ Teste 15: Garantia de autosave no caminho real de disco no Windows passou com sucesso.');

// 16. Test Windows File Association Arguments Parsing & File Detection
function parseWindowsStartupFile(args, fileExistsFn) {
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('-') && fileExistsFn(arg)) {
      return arg;
    }
  }
  return null;
}

const mockFiles = new Set(['C:\\Users\\demo\\Documents\\anotacao.md', 'D:\\Workspace\\README.md']);
const mockExists = (p) => mockFiles.has(p);

assert.strictEqual(
  parseWindowsStartupFile(['Nook.exe', 'C:\\Users\\demo\\Documents\\anotacao.md'], mockExists),
  'C:\\Users\\demo\\Documents\\anotacao.md',
  'Deve detectar arquivo aberto via Windows Explorer'
);
assert.strictEqual(
  parseWindowsStartupFile(['Nook.exe', '--flag', 'D:\\Workspace\\README.md'], mockExists),
  'D:\\Workspace\\README.md',
  'Deve ignorar flags e capturar caminho do arquivo'
);
assert.strictEqual(
  parseWindowsStartupFile(['Nook.exe'], mockExists),
  null,
  'Retorna null se nenhum arquivo foi passado'
);
console.log('✓ Teste 16: Associação de arquivos do Windows (.md/.txt) e captura de argumentos validada com sucesso.');

// 17. Test Folder & Project Drag & Drop Reordering (1° e 3° lugar)
function reorderCollectionList(collections, draggedId, targetId, position) {
  const siblings = [...collections];
  const dragged = siblings.find((c) => c.id === draggedId);
  const filtered = siblings.filter((c) => c.id !== draggedId);
  const targetIndex = filtered.findIndex((c) => c.id === targetId);
  const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
  filtered.splice(insertIndex, 0, dragged);
  return filtered.map((c, idx) => ({ ...c, sort_order: idx }));
}

const initialProjects = [
  { id: 'p1', name: 'Contas GPT', sort_order: 0 },
  { id: 'p2', name: 'Prompts', sort_order: 1 },
  { id: 'p3', name: 'Roblox', sort_order: 2 },
];

// Arrastar Roblox (p3) para o 1º lugar (antes de Contas GPT - p1)
const movedToFirst = reorderCollectionList(initialProjects, 'p3', 'p1', 'before');
assert.strictEqual(movedToFirst[0].name, 'Roblox', 'Roblox deve estar em 1º lugar');
assert.strictEqual(movedToFirst[1].name, 'Contas GPT', 'Contas GPT deve estar em 2º lugar');
assert.strictEqual(movedToFirst[2].name, 'Prompts', 'Prompts deve estar em 3º lugar');

// Arrastar Contas GPT (p1) para o 3º lugar (depois de Roblox - p3)
const movedToThird = reorderCollectionList(initialProjects, 'p1', 'p3', 'after');
assert.strictEqual(movedToThird[0].name, 'Prompts', 'Prompts deve estar em 1º lugar');
assert.strictEqual(movedToThird[1].name, 'Roblox', 'Roblox deve estar em 2º lugar');
assert.strictEqual(movedToThird[2].name, 'Contas GPT', 'Contas GPT deve estar em 3º lugar');
console.log('✓ Teste 17: Reordenação de pastas e projetos por drag & drop (1º ou 3º lugar) validada com sucesso.');

// 18. Test Pointer-Event Insertion Slot Math (Bypassing Windows OLE IDropTarget)
function computePointerSlotReorder(siblings, draggedIndex, midpoints, pointerY) {
  let slot = siblings.length;
  for (let i = 0; i < midpoints.length; i++) {
    if (pointerY < midpoints[i]) {
      slot = i;
      break;
    }
  }
  if (slot === draggedIndex || slot === draggedIndex + 1) {
    return null; // No-op
  }
  const dragged = siblings[draggedIndex];
  const filtered = siblings.filter((_, idx) => idx !== draggedIndex);
  const insertIndex = slot > draggedIndex ? slot - 1 : slot;
  filtered.splice(Math.max(0, Math.min(filtered.length, insertIndex)), 0, dragged);
  return filtered;
}

const slotMidpoints = [110, 140, 170]; // Row midpoints Y in sidebar
// Dragging Contas GPT (idx 0) to 2nd position (between Prompts 140 and Roblox 170 -> pointerY=150)
const slotMoveTo2nd = computePointerSlotReorder(initialProjects, 0, slotMidpoints, 150);
assert.deepStrictEqual(slotMoveTo2nd.map(p => p.name), ['Prompts', 'Contas GPT', 'Roblox']);
// Dragging Contas GPT (idx 0) past last item (pointerY=200) -> 3rd place
const slotMoveTo3rd = computePointerSlotReorder(initialProjects, 0, slotMidpoints, 200);
assert.deepStrictEqual(slotMoveTo3rd.map(p => p.name), ['Prompts', 'Roblox', 'Contas GPT']);
// Dragging Roblox (idx 2) above first item (pointerY=90) -> 1st place
const slotMoveTo1st = computePointerSlotReorder(initialProjects, 2, slotMidpoints, 90);
assert.deepStrictEqual(slotMoveTo1st.map(p => p.name), ['Roblox', 'Contas GPT', 'Prompts']);
// No-op near self
assert.strictEqual(computePointerSlotReorder(initialProjects, 1, slotMidpoints, 135), null);
console.log('✓ Teste 18: Algoritmo de slots verticais por Pointer Events validado (1º, 2º, 3º e no-op).');

// 19. Test External File Data-Loss Prevention Guard (Opening .txt/.md NEVER wipes file content)
function simulateSafeExternalAutoSave({ docKey, baselineKey, isExternal, canAutoSaveExternal, baselineContent, currentContent }) {
  if (!docKey || baselineKey !== docKey) return { wroteDisk: false, reason: 'key-mismatch' };
  if (isExternal) {
    if (!canAutoSaveExternal) return { wroteDisk: false, reason: 'unmodified-read-only-safe' };
    if (baselineContent === currentContent) return { wroteDisk: false, reason: 'unchanged' };
    return { wroteDisk: true, writtenContent: currentContent };
  }
  return { wroteDisk: true, writtenContent: currentContent };
}

// Scenario A: Opening arquivo.txt without user editing (even if focus-refresh tried anything)
const openReadOnlyRes = simulateSafeExternalAutoSave({
  docKey: 'ext:C:\\Users\\demo\\Desktop\\notas.txt',
  baselineKey: 'ext:C:\\Users\\demo\\Desktop\\notas.txt',
  isExternal: true,
  canAutoSaveExternal: false,
  baselineContent: 'Conteúdo importante',
  currentContent: '', // Even in simulated external state anomaly, never writes!
});
assert.strictEqual(openReadOnlyRes.wroteDisk, false, 'Arquivo aberto sem edição do usuário jamais deve ser sobrescrito');

// Scenario B: Mid-transition docKey mismatch (switching from note to external file)
const transitionRes = simulateSafeExternalAutoSave({
  docKey: 'ext:C:\\Users\\demo\\Desktop\\notas.txt',
  baselineKey: 'note:old-empty-note',
  isExternal: true,
  canAutoSaveExternal: true,
  baselineContent: '',
  currentContent: '',
});
assert.strictEqual(transitionRes.wroteDisk, false, 'Sobrescrita cruzada entre documentos deve ser bloqueada');

// Scenario C: User legitimately edits external file -> saves modified content
const realEditRes = simulateSafeExternalAutoSave({
  docKey: 'ext:C:\\Users\\demo\\Desktop\\notas.txt',
  baselineKey: 'ext:C:\\Users\\demo\\Desktop\\notas.txt',
  isExternal: true,
  canAutoSaveExternal: true,
  baselineContent: 'Conteúdo importante',
  currentContent: 'Conteúdo importante\nLinha adicionada pelo usuário',
});
assert.strictEqual(realEditRes.wroteDisk, true, 'Edição explícita do usuário deve salvar no arquivo externo');
console.log('✓ Teste 19: Blindagem contra apagamento/corrupção de arquivos externos (.txt/.md) validada.');

// 20. Test Conflict Watermark vs Sequence Counter
function shouldCreateConflictSnapshot(existingUpdatedAt, existingContent, incomingContent, version, baseUpdatedAt) {
  const EPOCH_MS_THRESHOLD = 1_000_000_000_000;
  const watermark = baseUpdatedAt ?? (version >= EPOCH_MS_THRESHOLD ? version : null);
  if (watermark === null) return false;
  return existingUpdatedAt > watermark && existingContent !== incomingContent;
}
assert.strictEqual(shouldCreateConflictSnapshot(1794421381505, 'A', 'AB', 1, undefined), false, 'Counter v1 must not trigger false conflict');
assert.strictEqual(shouldCreateConflictSnapshot(1794421381505, 'A', 'AB', 2, 1794421381505), false, 'Matching watermark must not trigger conflict');
assert.strictEqual(shouldCreateConflictSnapshot(1794421399999, 'Remote', 'Local', 3, 1794421381505), true, 'Newer remote updated_at with differing content must snapshot');
console.log('✓ Teste 20: Detecção precisa de conflitos por timestamp (sem falsos positivos em auto-save) validada.');

// 21. Test Strict Cloudflare Tunnel Host Match
function isTryCloudflareHost(host) {
  const clean = host.trim().toLowerCase();
  return clean.length > '.trycloudflare.com'.length && clean.endsWith('.trycloudflare.com') && !clean.includes('/');
}
assert.strictEqual(isTryCloudflareHost('safe-tunnel.trycloudflare.com'), true, 'Valid tunnel subdomain accepted');
assert.strictEqual(isTryCloudflareHost('trycloudflare.evil.com'), false, 'Bypass host rejected');
assert.strictEqual(isTryCloudflareHost('trycloudflare.com'), false, 'Bare root without subdomain rejected');
console.log('✓ Teste 21: Validação estrita de subdomínio trycloudflare.com validada.');

console.log('\nTodos os 21 testes da suite de lógica foram aprovados com 100% de sucesso!');
