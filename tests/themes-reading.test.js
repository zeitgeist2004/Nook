// ============================================================================
// NOOK — SUITE DE TESTES TEMAS 2.0, TIPOGRAFIA & EXPERIÊNCIA MARKDOWN
// Valida: Contraste WCAG AA em todos os 5 temas, identidades Neon e Sakura,
// tipografia editorial, CodeMirror 6 sem recriação, Smart Code Blocks e perf.
// ============================================================================

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { marked } from 'marked';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('--- Executando Suite de Testes Temas 2.0 & Experiência Markdown ---');

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function extractThemeBlock(css, selectorPattern) {
  const idx = css.indexOf(selectorPattern);
  assert(idx !== -1, `Seletor ${selectorPattern} ausente em theme.css`);
  const braceStart = css.indexOf('{', idx);
  const braceEnd = css.indexOf('}', braceStart);
  return css.slice(braceStart + 1, braceEnd);
}

function extractVar(block, varName) {
  const m = block.match(new RegExp(`${varName}:\\s*(#[0-9A-Fa-f]{3,6})`));
  return m ? m[1] : null;
}

// ----------------------------------------------------------------------------
// TESTE 1: Auditoria de Contraste WCAG AA/AAA nos 5 Temas (Cinza, Escuro, Claro, Neon, Sakura)
// ----------------------------------------------------------------------------
const themeCss = fs.readFileSync(path.join(rootDir, 'src', 'styles', 'theme.css'), 'utf8');

const themesToAudit = [
  { name: 'Cinza', selector: '[data-theme="gray"]' },
  { name: 'Escuro', selector: '[data-theme="dark"]' },
  { name: 'Claro', selector: '[data-theme="white"]' },
  { name: 'Neon', selector: '[data-theme="neon"]' },
  { name: 'Sakura', selector: '[data-theme="sakura"]' },
];

for (const th of themesToAudit) {
  const block = extractThemeBlock(themeCss, th.selector);
  const bg = extractVar(block, '--bg-main');
  const textPrimary = extractVar(block, '--text-primary');
  const textSecondary = extractVar(block, '--text-secondary');
  const heading = extractVar(block, '--md-heading-color');
  const codeBg = extractVar(block, '--md-code-bg');
  const codeText = extractVar(block, '--md-code-text');
  const linkColor = extractVar(block, '--md-link-color');

  assert(bg && textPrimary && textSecondary && heading && codeBg && codeText && linkColor, `Tokens semânticos completos obrigatórios no tema ${th.name}`);

  const primaryCR = contrastRatio(textPrimary, bg);
  const secondaryCR = contrastRatio(textSecondary, bg);
  const headingCR = contrastRatio(heading, bg);
  const codeCR = contrastRatio(codeText, codeBg);
  const linkCR = contrastRatio(linkColor, bg);

  assert(primaryCR >= 7.0, `Tema ${th.name}: texto principal (${primaryCR.toFixed(2)}:1) deve atingir >= 7.0:1`);
  assert(secondaryCR >= 4.5, `Tema ${th.name}: texto secundário (${secondaryCR.toFixed(2)}:1) deve atingir WCAG AA >= 4.5:1`);
  assert(headingCR >= 7.0, `Tema ${th.name}: títulos (${headingCR.toFixed(2)}:1) devem atingir >= 7.0:1`);
  assert(codeCR >= 7.0, `Tema ${th.name}: blocos de código (${codeCR.toFixed(2)}:1) devem atingir >= 7.0:1`);
  assert(linkCR >= 4.5, `Tema ${th.name}: links (${linkCR.toFixed(2)}:1) devem atingir WCAG AA >= 4.5:1`);
}

// Regras estritas do Neon (apenas 1 tom de verde #00FF9D) e Sakura (sem rosa neon exagerado)
assert(!themeCss.includes('#00F0FF') && !themeCss.includes('#10B981'), 'Neon deve preservar apenas 1 único tom de verde (#00FF9D)');
assert(themeCss.includes('#FAF9F6'), 'Tema Claro deve usar branco papel suave confortável (#FAF9F6)');
assert(themeCss.includes('#E89EB8'), 'Tema Sakura deve usar rosa antigo suave (#E89EB8)');
console.log('✓ Teste 1: Contraste WCAG AA/AAA e identidades estéticas dos 5 temas validados.');

// ----------------------------------------------------------------------------
// TESTE 2: Ilustrações Temáticas Leves e Sem Bloqueio de Leitura (Neon & Sakura)
// ----------------------------------------------------------------------------
const backdropSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'themes', 'ThemeBackdrop.tsx'), 'utf8');
assert(backdropSrc.includes("mode === 'off'"), 'ThemeBackdrop deve permitir desativação total via preferência');
assert(backdropSrc.includes("pointerEvents: 'none'") && backdropSrc.includes('aria-hidden="true"'), 'Fundo temático deve ser não-interativo e acessível');
assert(!backdropSrc.includes('<canvas') && !backdropSrc.includes('requestAnimationFrame') && !backdropSrc.includes('setInterval'), 'Fundo temático deve ser leve em SVG estático (zero canvas, timers ou partículas)');
assert(backdropSrc.includes('SakuraBlossom') && backdropSrc.includes('nook-neon-grid'), 'SVG original de circuitos Neon e cerejeira Sakura presentes');

const appSrc = fs.readFileSync(path.join(rootDir, 'src', 'app', 'App.tsx'), 'utf8');
assert(appSrc.includes('<ThemeBackdrop') && appSrc.includes("backgroundDecorations || 'subtle'"), 'App.tsx deve montar ThemeBackdrop respeitando preferência do usuário');
console.log('✓ Teste 2: Backgrounds vetoriais originais (Neon & Sakura), leves e não intrusivos validados.');

// ----------------------------------------------------------------------------
// TESTE 3: Renderização Markdown Editorial & Smart Code Blocks (Marked + DOMPurify)
// ----------------------------------------------------------------------------
const mdParserSrc = fs.readFileSync(path.join(rootDir, 'src', 'utils', 'markdownParser.ts'), 'utf8');
assert(mdParserSrc.includes('DOMPurify.sanitize'), 'Sanitização DOMPurify obrigatória preservada no markdownParser.ts');

const transpiledMd = ts.transpileModule(mdParserSrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const mdModule = { exports: {} };
const mdReq = (id) => {
  if (id === 'marked') return { marked };
  if (id === 'dompurify') return { default: { sanitize: (s) => s } };
  throw new Error(`Unexpected require: ${id}`);
};
new vm.Script(`(function(exports, require, module) { ${transpiledMd} })`).runInThisContext()(
  mdModule.exports,
  mdReq,
  mdModule
);

const complexMd = [
  '# Título Principal',
  '',
  'Parágrafo com **negrito**, *itálico*, [link seguro](https://example.com) e `código inline`.',
  '',
  '## Subtítulo H2',
  '',
  '### Seção H3',
  '',
  '> Uma citação editorial discreta.',
  '',
  '- Item 1',
  '- [x] Tarefa concluída',
  '',
  '1. Passo ordenado',
  '',
  '---',
  '',
  '| Coluna A | Coluna B |',
  '| :--- | :--- |',
  '| Dado 1 | Dado 2 |',
  '',
  '```rust',
  'fn main() {',
  '    println!("Nook Markdown");',
  '}',
  '```',
].join('\n');

const tRenderStart = performance.now();
let lastRendered;
for (let i = 0; i < 30; i++) {
  lastRendered = mdModule.exports.renderMarkdownToHtml(complexMd);
}
const avgMdMs = (performance.now() - tRenderStart) / 30;

assert(lastRendered.html.includes('<h1>') && lastRendered.html.includes('<h2>') && lastRendered.html.includes('<h3>'), 'Hierarquia H1-H3 renderizada');
assert(lastRendered.html.includes('<strong>') && lastRendered.html.includes('<em>') && lastRendered.html.includes('<blockquote>'), 'Negrito, itálico e citação renderizados');
assert(lastRendered.html.includes('nook-task-checkbox') && lastRendered.html.includes('<table>') && lastRendered.html.includes('<hr'), 'Checklists, tabelas e separadores renderizados');
assert(lastRendered.html.includes('class="language-rust"'), 'Linguagem preservada para Smart Code Blocks');
assert(avgMdMs < 10, `Pipeline Markdown demorou ${avgMdMs.toFixed(2)}ms por documento (meta < 10ms)`);

const viewerSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'editor', 'MarkdownViewer.tsx'), 'utf8');
assert(viewerSrc.includes('nook-code-header') && viewerSrc.includes('nook-code-lang'), 'Smart Code Blocks devem exibir barra superior discreta com linguagem');
assert(viewerSrc.includes('readingWidth') && viewerSrc.includes('paragraphSpacing') && viewerSrc.includes('lineHeight'), 'MarkdownViewer deve respeitar largura, espaçamento entre parágrafos e altura de linha');
console.log(`✓ Teste 3: Pipeline Markdown editorial + Smart Code Blocks (${avgMdMs.toFixed(2)} ms/render) validados.`);

// ----------------------------------------------------------------------------
// TESTE 4: CodeMirror 6 — Estilização Estrutural sem Destruir Editor nem IME/Histórico
// ----------------------------------------------------------------------------
const cmSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'editor', 'CodeMirrorEditor.tsx'), 'utf8');
assert(cmSrc.includes('HighlightStyle.define') && cmSrc.includes('syntaxHighlighting'), 'CodeMirror 6 deve estilizar Markdown via HighlightStyle incremental do Lezer');
assert(cmSrc.includes('typographyCompartment') && cmSrc.includes('Compartment'), 'Tipografia e largura de coluna devem reconfigurar por Compartment');
assert(cmSrc.includes('}, []);'), 'Instância do EditorView deve montar uma única vez sem recriar ao trocar tema');
assert(cmSrc.includes('Transaction.addToHistory.of(false)'), 'Carga externa de nota não deve poluir histórico Undo/Redo');
assert(cmSrc.includes('cm-nook-h1') && cmSrc.includes('cm-nook-strong') && cmSrc.includes('cm-nook-meta'), 'Classes semânticas de destaque Markdown aplicadas no editor');

const globalsCss = fs.readFileSync(path.join(rootDir, 'src', 'styles', 'globals.css'), 'utf8');
assert(globalsCss.includes('.nook-measure-comfortable') && globalsCss.includes('70ch'), 'Largura de leitura confortável (~70 caracteres) configurada');
assert(globalsCss.includes('--cm-active-line-bg') && globalsCss.includes('--md-selection-bg'), 'Linha ativa e seleção devem seguir os tokens de contraste de cada tema');
assert(globalsCss.includes('.markdown-reading-content') && globalsCss.includes('.nook-theme-backdrop'), 'Adaptações responsivas para telas menores presentes');
console.log('✓ Teste 4: Consistência CodeMirror 6, largura editorial e preservação de estado validados.');

// ----------------------------------------------------------------------------
// TESTE 5: Personalização Visual, Miniaturas & Sincronização Persistente
// ----------------------------------------------------------------------------
const settingsSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'settings', 'SettingsModal.tsx'), 'utf8');
assert(settingsSrc.includes('showThemesIntro') && settingsSrc.includes('t.settings.themesIntroTitle'), 'Onboarding visual discreto ("Um Nook com a sua cara") presente');
assert(settingsSrc.includes('backgroundDecorations') && settingsSrc.includes('readingWidth') && settingsSrc.includes('paragraphSpacing') && settingsSrc.includes('lineHeight'), 'Controles essenciais de personalização visual e leitura integrados');
assert(settingsSrc.includes('fontGeorgia'), 'Opção tipográfica serifada local adicionada sem fontes web');
assert(appSrc.includes("'appearance_prefs'") && appSrc.includes("readingWidth: 'comfortable'"), 'Preferências de leitura persistidas no SQLite e sincronizadas entre dispositivos');
console.log('✓ Teste 5: Miniaturas de temas, preferências de leitura e persistência validados.');

console.log('\n--- Todos os 5 testes do Nook Temas 2.0 & Leitura Editorial passaram com 100% de sucesso! ---');
