// ============================================================================
// NOOK — SUITE DE AUDITORIA UX, PLATAFORMA, ONBOARDING 2.0 & ACESSIBILIDADE
// Valida: Matriz de Plataforma vs Largura, Onboarding contextual persistente,
// ContextMenu clamping, Tooltip focus/Escape, ErrorBoundary, Zoom & Reconexão.
// ============================================================================

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('--- Executando Suite de Auditoria UX, Plataforma, Onboarding 2.0 & Acessibilidade ---');

function loadTsModule(relPath) {
  const fullPath = path.join(rootDir, relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  const mod = { exports: {} };
  const store = new Map();
  const sandbox = {
    module: mod,
    exports: mod.exports,
    require: () => ({}),
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  };
  vm.runInNewContext(transpiled.outputText, sandbox, { filename: fullPath });
  return { exports: mod.exports, store };
}

const { exports: platformUtils } = loadTsModule('src/utils/platform.ts');
const { exports: onboardingUtils } = loadTsModule('src/utils/onboardingUtils.ts');

// 1. Matriz de Plataforma vs Tamanho de Janela (§4)
{
  // Janela Windows Desktop redimensionada para 600px deve continuar sendo plataforma Desktop
  const narrowWinDesktop = platformUtils.getEnvironmentProfile({
    tauri: true,
    mobileHint: false,
    touchPrimary: false,
    viewportWidth: 600,
    viewportHeight: 800,
  });
  assert.strictEqual(narrowWinDesktop.platform, 'desktop');
  assert.strictEqual(narrowWinDesktop.isCompactViewport, true, 'Layout compacta para drawer em 600px');
  assert.strictEqual(narrowWinDesktop.capabilities.systemTray, true);
  assert.strictEqual(narrowWinDesktop.capabilities.externalFilesDisk, true);
  assert.strictEqual(narrowWinDesktop.capabilities.projectLinking, true);
  assert.strictEqual(narrowWinDesktop.capabilities.splitEditorMode, false, 'Split desativado quando espaço <= 768px');

  // Navegador Web estreito (600px) mantém ações Desktop-Web no CommandPalette
  const narrowWeb = platformUtils.getEnvironmentProfile({
    tauri: false,
    mobileHint: false,
    touchPrimary: false,
    viewportWidth: 600,
    viewportHeight: 750,
  });
  assert.strictEqual(narrowWeb.platform, 'web');
  assert.strictEqual(narrowWeb.capabilities.systemTray, false, 'Web nunca expõe system tray');
  assert.strictEqual(narrowWeb.capabilities.externalFilesDisk, false, 'Web nunca expõe disco local direto');
  assert.strictEqual(narrowWeb.capabilities.folderBackupExport, false);
  assert.strictEqual(narrowWeb.capabilities.commandPaletteDesktopActions, true);

  // Mobile smartphone real (390px touch)
  const realMobile = platformUtils.getEnvironmentProfile({
    tauri: false,
    mobileHint: true,
    touchPrimary: true,
    viewportWidth: 390,
    viewportHeight: 844,
    voiceSupported: true,
  });
  assert.strictEqual(realMobile.platform, 'mobile');
  assert.strictEqual(realMobile.capabilities.commandPaletteDesktopActions, false);
  assert.strictEqual(realMobile.capabilities.mobileLayoutOptimized, true);
  assert.strictEqual(realMobile.capabilities.voiceInputSupported, true);
  assert.strictEqual(realMobile.capabilities.notesCrud, true);
  assert.strictEqual(realMobile.capabilities.contextPack, true);

  // Desktop 900px ativa auto-recolhimento temporário sem tratar como mobile
  const narrowDesktop = platformUtils.getEnvironmentProfile({
    tauri: true,
    mobileHint: false,
    touchPrimary: false,
    viewportWidth: 900,
    viewportHeight: 768,
  });
  assert.strictEqual(narrowDesktop.isNarrowDesktop, true);
  assert.strictEqual(narrowDesktop.isCompactViewport, false);

  console.log('✓ Teste 1: Matriz de disponibilidade separa plataforma real de largura de janela.');
}

// 2. Segurança de Rotas Backend vs Recursos Exclusivos do Windows (§4)
{
  const modRs = fs.readFileSync(path.join(rootDir, 'src-tauri/src/server/mod.rs'), 'utf8');
  const forbiddenHttpRoutes = [
    'open_local_folder',
    'reveal_local_file',
    'list_project_instructions',
    'read_project_instruction_file',
    'write_project_instruction_file',
    'list_agent_skills',
    'inspect_linked_folder',
    'read_external_file',
    'write_external_file',
    'export_library_to_folder',
    'start_mobile_access',
    'stop_mobile_access',
  ];
  for (const cmd of forbiddenHttpRoutes) {
    assert(!modRs.includes(cmd), `Comando Windows exclusivo "${cmd}" não deve estar exposto no Axum HTTP`);
  }
  console.log('✓ Teste 2: Comandos exclusivos do Windows estritamente isolados fora do servidor Web/Mobile.');
}

// 3. Onboarding 2.0 Contextual & Persistência (§11 & §12)
{
  const tips = ['projects', 'quick_notes', 'search', 'history', 'context_pack', 'mobile_sync', 'voice', 'dev_workflow'];
  for (const id of tips) {
    assert.strictEqual(onboardingUtils.hasSeenContextualTip(id), false);
  }
  onboardingUtils.dismissContextualTip('search');
  onboardingUtils.dismissContextualTip('projects');
  assert.strictEqual(onboardingUtils.hasSeenContextualTip('search'), true);
  assert.strictEqual(onboardingUtils.hasSeenContextualTip('projects'), true);
  assert.strictEqual(onboardingUtils.hasSeenContextualTip('history'), false);

  onboardingUtils.resetContextualTips();
  assert.strictEqual(onboardingUtils.hasSeenContextualTip('search'), false);
  console.log('✓ Teste 3: Dicas contextuais e persistência de Onboarding 2.0 validadas.');
}

// 4. Acessibilidade, Viewport Zoom, Teclado Virtual & CSS Keyframes (§8, §9, §10, §16)
{
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  assert(indexHtml.includes('viewport-fit=cover') && indexHtml.includes('interactive-widget=resizes-content'));
  assert(!indexHtml.includes('user-scalable=no') && !indexHtml.includes('maximum-scale=1.0'), 'Zoom acessível WCAG deve estar liberado');

  const globalsCss = fs.readFileSync(path.join(rootDir, 'src/styles/globals.css'), 'utf8');
  assert(globalsCss.includes('@keyframes scaleIn') && globalsCss.includes('@keyframes pulse'), 'Keyframes scaleIn e pulse devem estar definidos');
  assert(globalsCss.includes('--nook-viewport-height'), 'CSS deve respeitar altura dinâmica --nook-viewport-height');
  assert(globalsCss.includes('data-keyboard-open=\'true\'') || globalsCss.includes('data-keyboard-open="true"'));
  assert(globalsCss.includes('overflow-x: auto'), 'Tabelas Markdown devem rolar internamente sem overflow global');

  const tooltipSrc = fs.readFileSync(path.join(rootDir, 'src/components/ui/Tooltip.tsx'), 'utf8');
  assert(tooltipSrc.includes('onFocus') && tooltipSrc.includes('onBlur'), 'Tooltip deve responder ao foco por teclado');
  assert(tooltipSrc.includes("e.key === 'Escape'"), 'Tooltip deve dispensar com Escape');
  assert(tooltipSrc.includes('isCoarseTouchOnly'), 'Tooltip deve se suprimir em telas exclusivamente touch');

  const ctxMenuSrc = fs.readFileSync(path.join(rootDir, 'src/components/sidebar/ContextMenu.tsx'), 'utf8');
  assert(ctxMenuSrc.includes('Math.max(padding, Math.min(menu.x') && ctxMenuSrc.includes('Math.max(padding, Math.min(menu.y'), 'ContextMenu deve clampar coordenadas na viewport');
  assert(ctxMenuSrc.includes('role="menu"'), 'ContextMenu deve declarar semântica ARIA de menu');

  const onboardingSrc = fs.readFileSync(path.join(rootDir, 'src/components/onboarding/OnboardingModal.tsx'), 'utf8');
  assert(onboardingSrc.includes('useDialogA11y') && onboardingSrc.includes('showWebShortcuts') && onboardingSrc.includes('showTouchGuide'));
  console.log('✓ Teste 4: Zoom WCAG, teclado virtual, ContextMenu clamped, Tooltip focus/Escape e atalhos por plataforma validados.');
}

// 5. Navegação Mobile Limpa, Estados de Conexão & ErrorBoundary (§7, §14, §15, §18)
{
  const topBarSrc = fs.readFileSync(path.join(rootDir, 'src/components/mobile/MobileTopBar.tsx'), 'utf8');
  assert(!topBarSrc.includes('confirmDelete') && topBarSrc.includes('MoreVertical'), 'MobileTopBar não deve duplicar lixeira vermelha e deve agrupar ações secundárias');

  const editorSrc = fs.readFileSync(path.join(rootDir, 'src/components/editor/Editor.tsx'), 'utf8');
  assert(editorSrc.includes('ErrorBoundary') && editorSrc.includes('effectiveViewMode'), 'Editor deve usar ErrorBoundary e adaptar Split no mobile');
  assert(!editorSrc.includes('confirmDeletePrompt'), 'Editor não deve repetir botão de lixeira no rodapé mobile');

  const editorHeaderSrc = fs.readFileSync(path.join(rootDir, 'src/components/editor/EditorHeader.tsx'), 'utf8');
  assert(editorHeaderSrc.includes('flexWrap: \'wrap\'') && editorHeaderSrc.includes('MoreHorizontal'), 'EditorHeader deve quebrar linha em larguras extremas e agrupar ações no mobile');

  const apiSrc = fs.readFileSync(path.join(rootDir, 'src/services/api.ts'), 'utf8');
  assert(apiSrc.includes('onConnectionStateChange') && apiSrc.includes('unauthorized') && apiSrc.includes('markUnauthorized'));

  const appSrc = fs.readFileSync(path.join(rootDir, 'src/app/App.tsx'), 'utf8');
  assert(appSrc.includes('t.ux.connUnavailableTitle') && appSrc.includes('installVisualViewportSync'));

  const treeSrc = fs.readFileSync(path.join(rootDir, 'src/components/sidebar/ProjectTree.tsx'), 'utf8');
  const quickSrc = fs.readFileSync(path.join(rootDir, 'src/components/sidebar/QuickNotesList.tsx'), 'utf8');
  assert(treeSrc.includes('MoreHorizontal') && quickSrc.includes('MoreHorizontal'), 'Mobile Drawer deve oferecer botão ⋯ em projetos e notas');
  console.log('✓ Teste 5: MobileTopBar limpo, EditorHeader sem overflow, ErrorBoundary, reconexão e menus touch validados.');
}

console.log('\n--- Todos os testes da Auditoria UX, Plataforma e Acessibilidade passaram com 100% de sucesso! ---');
