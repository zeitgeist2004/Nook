// ============================================================================
// NOOK — SUITE DE TESTES DO WORKFLOW PARA PROJETOS & AGENTES
// Valida: Context Pack, Prompt Library, Session Handoff, Dev Journal,
// Project Linking, Agent Instructions, Agent Skills, Minimalismo, Segurança e Perf.
// ============================================================================

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('--- Executando Suite de Testes do Nook Developer Workflow ---');

function loadTsModule(relPath) {
  const fullPath = path.join(rootDir, relPath);
  assert(fs.existsSync(fullPath), `Módulo ausente: ${relPath}`);
  const src = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const module = { exports: {} };
  const fn = new vm.Script(`(function(exports, module) { ${transpiled} })`).runInThisContext();
  fn(module.exports, module);
  return module.exports;
}

const wf = loadTsModule('src/utils/workflowUtils.ts');

// ----------------------------------------------------------------------------
// TESTE 1: Hierarquia de Projetos, Resolução de Raiz & Proteção contra Ciclos
// ----------------------------------------------------------------------------
const collections = [
  { id: 'proj-1', name: 'Nook App', collection_type: 'project', parent_id: null, sort_order: 0, created_at: 1, updated_at: 1, deleted_at: null },
  { id: 'fold-1', name: 'Arquitetura', collection_type: 'folder', parent_id: 'proj-1', sort_order: 0, created_at: 1, updated_at: 1, deleted_at: null },
  { id: 'fold-2', name: 'Backend', collection_type: 'folder', parent_id: 'fold-1', sort_order: 0, created_at: 1, updated_at: 1, deleted_at: null },
  { id: 'cyc-a', name: 'CycA', collection_type: 'folder', parent_id: 'cyc-b', sort_order: 0, created_at: 1, updated_at: 1, deleted_at: null },
  { id: 'cyc-b', name: 'CycB', collection_type: 'folder', parent_id: 'cyc-a', sort_order: 0, created_at: 1, updated_at: 1, deleted_at: null },
];

assert.strictEqual(wf.resolveRootProjectId('fold-2', collections), 'proj-1', 'Subpasta aninhada deve resolver até o projeto raiz');
assert.strictEqual(wf.resolveRootProjectId('proj-1', collections), 'proj-1', 'Projeto raiz resolve para si mesmo');
assert(wf.resolveRootProjectId('cyc-a', collections), 'Resolução de ciclo não deve entrar em loop infinito');
console.log('✓ Teste 1: Resolução de projeto raiz e proteção contra ciclos validados.');

// ----------------------------------------------------------------------------
// TESTE 2: Nook Context Pack (Seleção por Pasta, Ordem Customizada e Markdown Puro)
// ----------------------------------------------------------------------------
const sampleNotes = [
  { id: 'n1', collection_id: 'proj-1', title: 'Visão Geral', content: 'App desktop minimalista.', is_pinned: false, sort_order: 0, created_at: 1, updated_at: 1, deleted_at: null },
  { id: 'n2', collection_id: 'fold-2', title: 'SQLite & Rust', content: 'WAL habilitado.', is_pinned: false, sort_order: 0, created_at: 1, updated_at: 2, deleted_at: null },
  { id: 'n3', collection_id: null, title: 'Nota Pessoal', content: 'Lista de compras.', is_pinned: false, sort_order: 0, created_at: 1, updated_at: 3, deleted_at: null },
];

const subtreeNotes = wf.getNotesInCollectionSubtree('proj-1', collections, sampleNotes);
assert.strictEqual(subtreeNotes.length, 2, 'Subárvore do projeto deve incluir notas diretas e de subpastas, excluindo notas rápidas');

const packed = wf.assembleContextPackMarkdown({
  projectName: 'Nook App',
  items: [
    { note: sampleNotes[1], folderPath: 'Arquitetura / Backend' },
    { note: sampleNotes[0] },
  ],
  includeHeader: true,
  headerPrefix: 'Contexto do Projeto',
  untitledLabel: 'Sem título',
});

assert(packed.startsWith('# Contexto do Projeto: Nook App'), 'Cabeçalho do projeto deve abrir o Context Pack');
assert(packed.indexOf('## [Arquitetura / Backend] SQLite & Rust') < packed.indexOf('## Visão Geral'), 'Ordem manual definida pelo usuário deve ser preservada');
assert(packed.includes('WAL habilitado.') && packed.includes('App desktop minimalista.'), 'Conteúdo original das notas deve ser preservado sem reescrita');
const stats = wf.measureTextStats(packed);
assert(stats.chars > 0 && stats.words > 0 && stats.lines > 0, 'Contagem determinística de caracteres/palavras/linhas deve funcionar');
console.log('✓ Teste 2: Nook Context Pack determinístico e ordenável validado.');

// ----------------------------------------------------------------------------
// TESTE 3: Prompt Library (Extração de {{variavel}}, preenchimento e preservação)
// ----------------------------------------------------------------------------
const rawPrompt = [
  'Revise o projeto {{nome_do_projeto}} em {{linguagem}}.',
  'Objetivo principal: {{objetivo}}.',
  '```ts',
  'function test() { return { ok: true }; }',
  '```',
  'Repita projeto: {{nome_do_projeto}}.',
].join('\n');

const vars = wf.extractPromptVariables(rawPrompt);
assert.deepStrictEqual(vars, ['nome_do_projeto', 'linguagem', 'objetivo'], 'Deve extrair variáveis únicas na ordem de aparição e ignorar chaves de código JS');
assert.strictEqual(wf.humanizeVarName('nome_do_projeto'), 'Nome do projeto');

const filled = wf.fillPromptVariables(rawPrompt, {
  nome_do_projeto: 'Nook',
  linguagem: 'TypeScript + Rust',
  objetivo: 'Reduzir uso de RAM',
});
assert(filled.includes('Revise o projeto Nook em TypeScript + Rust.'));
assert(filled.includes('Repita projeto: Nook.'));
assert(filled.includes('return { ok: true };'), 'Código fonte dentro do prompt deve permanecer intacto');
console.log('✓ Teste 3: Prompt Library com variáveis preenchíveis validada.');

// ----------------------------------------------------------------------------
// TESTE 4: Session Handoff & Dev Journal (Campos opcionais e formatação)
// ----------------------------------------------------------------------------
const handoffMd = wf.formatHandoffNoteMarkdown(
  {
    done: 'Implementado Context Pack.',
    nextSteps: 'Revisar Agent Instructions.',
    issues: '',
    importantInfo: '',
  },
  {
    done: 'O que foi feito',
    nextSteps: 'Próximos passos',
    issues: 'Problemas pendentes',
    importantInfo: 'Informações importantes',
  }
);
const handoffForAgent = wf.formatHandoffForAgentCopy({
  projectName: 'Nook App',
  noteTitle: 'Progresso — 2026-11-18 01:00',
  content: handoffMd,
  headerPrefix: 'Continuidade da Sessão',
});
assert(handoffForAgent.includes('## O que foi feito') && handoffForAgent.includes('Implementado Context Pack.'));
assert(!handoffForAgent.includes('## Problemas pendentes'), 'Seções vazias opcionais devem ser omitidas ao copiar para continuar');

const journalTitle = wf.formatJournalEntryTitle('Diário', new Date('2026-11-18T14:05:00'));
assert.strictEqual(journalTitle, 'Diário — 2026-11-18 14:05');
const journalMd = wf.formatJournalEntryMarkdown({
  whatChanged: 'O que mudou',
  whyChanged: 'Por que mudou',
  problemsFound: 'Problemas encontrados',
  decisions: 'Decisões',
  nextSteps: 'Próximos passos',
});
assert(journalMd.includes('## O que mudou') && journalMd.includes('## Decisões'));
console.log('✓ Teste 4: Session Handoff e Dev Journal validados.');

// ----------------------------------------------------------------------------
// TESTE 5: Auditoria de Minimalismo, Onboarding e Experiência Unificada (§11 & §12)
// ----------------------------------------------------------------------------
const sidebarSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'sidebar', 'Sidebar.tsx'), 'utf8');
assert(!sidebarSrc.includes('Context Pack'), 'Sidebar não pode criar 7 novas seções permanentes');
assert(!sidebarSrc.includes('Agent Instructions'), 'Sidebar deve permanecer limpa para uso casual');
assert(!sidebarSrc.includes('Agent Skills'), 'Sidebar não deve exibir jargões permanentes');

const onboardingSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'onboarding', 'OnboardingModal.tsx'), 'utf8');
assert(!onboardingSrc.includes('AGENTS.md') && !onboardingSrc.includes('SKILL.md'), 'Onboarding inicial deve permanecer focado apenas em notas simples');

const contextMenuSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'sidebar', 'ContextMenu.tsx'), 'utf8');
assert(contextMenuSrc.includes('t.contextMenu.projectTools'), 'Menu contextual de projeto deve agrupar ações em Ferramentas do projeto');

const toolsModalSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tools', 'ProjectToolsModal.tsx'), 'utf8');
assert(toolsModalSrc.includes('hasSeenDevIntro') && toolsModalSrc.includes('markDevIntroSeen'), 'Introdução contextual discreta deve aparecer uma única vez por opção do usuário');
assert(toolsModalSrc.includes('dismissToolTip') && toolsModalSrc.includes('showHelpBox'), 'Dicas contextuais dispensáveis e ajuda sob demanda obrigatórias');

const appSrc = fs.readFileSync(path.join(rootDir, 'src', 'app', 'App.tsx'), 'utf8');
assert(appSrc.includes("const ProjectToolsModal = lazy("), 'ProjectToolsModal deve ser lazy-loaded para zero impacto na inicialização');
console.log('✓ Teste 5: Minimalismo, agrupamento contextual, lazy loading e onboarding discreto validados.');

// ----------------------------------------------------------------------------
// TESTE 6: Auditoria de Segurança Local, Mobile e Ausência de LLMs (§3 & §13)
// ----------------------------------------------------------------------------
const pkgJson = fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8');
const cargoToml = fs.readFileSync(path.join(rootDir, 'src-tauri', 'Cargo.toml'), 'utf8');
assert(!pkgJson.includes('openai') && !pkgJson.includes('anthropic') && !pkgJson.includes('node-pty'), 'Sem SDKs de IA ou terminal embutido');
assert(!cargoToml.includes('portable-pty') && !cargoToml.includes('reqwest'), 'Sem emulador de terminal ou clientes HTTP de LLM em Rust');

const routesRs = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'server', 'routes.rs'), 'utf8');
assert(!routesRs.includes('inspect_linked_folder') && !routesRs.includes('open_local_folder'), 'Rotas Axum/Mobile não podem expor acesso ao sistema de arquivos do Windows');
assert(!routesRs.includes('list_agent_skills') && !routesRs.includes('write_project_instruction_file'), 'Edição ou leitura de arquivos locais de projeto deve ficar restrita ao Desktop');

const workflowRs = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'commands', 'workflow.rs'), 'utf8');
assert(workflowRs.includes('is_path_within_roots'), 'Comandos desktop devem validar fronteira de pastas autorizadas');
assert(workflowRs.includes('force_overwrite') && workflowRs.includes('conflict: true'), 'Escrita em AGENTS.md/CLAUDE.md deve impedir sobrescrita silenciosa');

const linkingPanel = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tools', 'ProjectLinkingPanel.tsx'), 'utf8');
const instructionsPanel = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tools', 'AgentInstructionsPanel.tsx'), 'utf8');
const skillsPanel = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tools', 'AgentSkillsPanel.tsx'), 'utf8');
assert(linkingPanel.includes('!isTauri()') && instructionsPanel.includes('!isTauri()') && skillsPanel.includes('!isTauri()'), 'Painéis de disco devem se resguardar no Mobile/Web');
console.log('✓ Teste 6: Isolamento de sistema de arquivos no Mobile, segurança local e zero LLMs validados.');

// ----------------------------------------------------------------------------
// TESTE 7: Benchmark de Performance (Context Pack + Prompt Parsing)
// ----------------------------------------------------------------------------
const bigNotes = Array.from({ length: 100 }, (_, i) => ({
  note: {
    id: `n-${i}`,
    collection_id: 'proj-1',
    title: `Documento Técnico ${i}`,
    content: `# Seção ${i}\n\nConteúdo detalhado com regras de arquitetura e decisão #${i}.`,
    is_pinned: false,
    sort_order: i,
    created_at: 1,
    updated_at: 1,
    deleted_at: null,
  },
  folderPath: 'Arquitetura',
}));

const t0 = performance.now();
for (let k = 0; k < 20; k++) {
  wf.assembleContextPackMarkdown({
    projectName: 'Large Repo',
    items: bigNotes,
    includeHeader: true,
    headerPrefix: 'Context Pack',
    untitledLabel: 'Sem título',
  });
  wf.fillPromptVariables(rawPrompt, { nome_do_projeto: 'Nook', linguagem: 'TS', objetivo: 'Teste' });
}
const avgMs = (performance.now() - t0) / 20;
assert(avgMs < 15, `Context Pack (100 notas) + Prompt Parsing levou ${avgMs.toFixed(2)}ms (meta < 15ms)`);
console.log(`✓ Teste 7: Performance Context Pack (100 notas) + Prompt fill em ${avgMs.toFixed(2)} ms/ciclo.`);

console.log('\n--- Todos os 7 testes do Nook Developer Workflow foram aprovados com 100% de sucesso! ---');
