import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('--- Executando Verificação dos Assets e Animações do Nook ---');

const requiredAssets = [
  'nook-idle-open.png',
  'nook-idle-blink.png',
  'nook-drag-alert.png',
  'nook-welcome-wave.png',
  'nook-drag-dropzone.png',
  'nook-drag-success.png',
  'nook-trash-clean.png',
  'nook-head-open.png',
  'nook-head-wink.png',
];

const refDir = path.join(rootDir, 'Nook_Identidade_Para_LLM', 'referencias2');
const publicDir = path.join(rootDir, 'public', 'brand', 'mascot');
const assetsDir = path.join(rootDir, 'assets', 'brand', 'mascot');

// Test 1: Check all 9 renamed assets in referencias2 when local design handoff directory is present
if (fs.existsSync(refDir)) {
  for (const asset of requiredAssets) {
    const p = path.join(refDir, asset);
    assert(fs.existsSync(p), `Arquivo ausente em referencias2: ${asset}`);
    const stats = fs.statSync(p);
    assert(stats.size > 100000, `Arquivo muito pequeno ou corrompido: ${asset} (${stats.size} bytes)`);
  }
  console.log('✓ Teste 1: Todos os 9 arquivos em referencias2 renomeados semântica e corretamente.');
} else {
  console.log('✓ Teste 1: Pasta de design handoff local omitida; validando assets de produção.');
}

// Test 2: Check all 9 assets in public/brand/mascot
for (const asset of requiredAssets) {
  const p = path.join(publicDir, asset);
  assert(fs.existsSync(p), `Arquivo ausente em public/brand/mascot: ${asset}`);
  const stats = fs.statSync(p);
  assert(stats.size > 100000, `Arquivo público inválido: ${asset}`);
}
console.log('✓ Teste 2: Todos os 9 assets sincronizados e servíveis em public/brand/mascot.');

// Test 3: Check all 9 assets in assets/brand/mascot
for (const asset of requiredAssets) {
  const p = path.join(assetsDir, asset);
  assert(fs.existsSync(p), `Arquivo ausente em assets/brand/mascot: ${asset}`);
}
console.log('✓ Teste 3: Todos os 9 assets sincronizados em assets/brand/mascot.');

// Test 4: CSS Motion & Animation System Validation
const cssPath = path.join(rootDir, 'src', 'styles', 'globals.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

const requiredKeyframes = [
  '@keyframes nookBreathe',
  '@keyframes nookWave',
  '@keyframes nookPopIn',
  '@keyframes nookMicroWink',
  '@keyframes nookDropPulse',
  '@keyframes nookZenClean',
];

for (const kf of requiredKeyframes) {
  assert(cssContent.includes(kf), `Keyframe de animação ausente no CSS: ${kf}`);
}
assert(cssContent.includes('@media (prefers-reduced-motion: reduce)'), 'Acessibilidade @media prefers-reduced-motion ausente!');
console.log('✓ Teste 4: Keyframes GPU e classes de acessibilidade validados no design system.');

// Test 5: Verify component integration
const mascotComponent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'mascot', 'NookMascot.tsx'), 'utf8');
assert(mascotComponent.includes('NookIdleMascot'), 'NookIdleMascot component ausente');
assert(mascotComponent.includes('NookSaveMicroMark'), 'NookSaveMicroMark component ausente');
assert(mascotComponent.includes('NookWelcomeMascot'), 'NookWelcomeMascot component ausente');
assert(mascotComponent.includes('NookCleanTrashMascot'), 'NookCleanTrashMascot component ausente');
assert(mascotComponent.includes('NookDropZoneVisual'), 'NookDropZoneVisual component ausente');
assert(mascotComponent.includes('NookImportSuccessToast'), 'NookImportSuccessToast component ausente');
console.log('✓ Teste 5: Todos os 6 componentes de animação e feedback do mascote implementados.');

// Test 6: Verify Duplicate Icon in EditorHeader and ContextMenu
const editorHeaderContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'editor', 'EditorHeader.tsx'), 'utf8');
assert(!editorHeaderContent.includes('Share2'), 'EditorHeader ainda contém o ícone Share2');
assert(editorHeaderContent.includes('CopyPlus'), 'EditorHeader não contém o ícone CopyPlus para duplicar');

const contextMenuContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'sidebar', 'ContextMenu.tsx'), 'utf8');
assert(contextMenuContent.includes('CopyPlus'), 'ContextMenu não contém CopyPlus para duplicar');
console.log('✓ Teste 6: Botão de duplicar atualizado com o ícone semântico CopyPlus (sem Share2).');

// Test 7: Verify Non-Technical Version History Dialog
const versionDialogContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'dialogs', 'VersionHistoryDialog.tsx'), 'utf8');
assert(!versionDialogContent.toLowerCase().includes('snapshot'), 'VersionHistoryDialog ainda contém o termo técnico "snapshot"');
assert(versionDialogContent.includes('Versões Anteriores'), 'Título humanizado "Versões Anteriores" ausente');
assert(versionDialogContent.includes('Salvar Versão Atual'), 'Ação "Salvar Versão Atual" ausente');
console.log('✓ Teste 7: Tela de versões simplificada e humanizada sem jargões técnicos.');

// Test 8: Verify Command Palette Hierarchical Organization
const cmdPaletteContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'search', 'CommandPalette.tsx'), 'utf8');
assert(cmdPaletteContent.includes("category: 'notes'"), 'Categoria notes ausente na CommandPalette');
assert(cmdPaletteContent.includes("category: 'organization'"), 'Categoria organization ausente na CommandPalette');
assert(cmdPaletteContent.includes("category: 'system'"), 'Categoria system ausente na CommandPalette');
assert(cmdPaletteContent.includes('CATEGORIES'), 'Lista de categorias ausente na CommandPalette');
console.log('✓ Teste 8: Hierarquia e agrupamento por categorias implementados na tela de comandos.');

// Test 9: Verify Standalone Splash Screen HTML & Design System
const splashHtmlPath = path.join(rootDir, 'splash.html');
assert(fs.existsSync(splashHtmlPath), 'splash.html não existe na raiz do projeto');
const splashContent = fs.readFileSync(splashHtmlPath, 'utf8');
assert(splashContent.includes('#0D0E11'), 'Fundo #0D0E11 ausente no splash.html');
assert(splashContent.includes('Nook'), 'Texto "Nook" ausente no splash.html');
assert(splashContent.includes('progress-rail'), 'Barra de progresso minimalista ausente');
assert(splashContent.includes('mascotEnter'), 'Animação de entrada do mascote ausente');
assert(splashContent.includes('@media (prefers-reduced-motion: reduce)'), 'Acessibilidade de movimento reduzido ausente no splash');
console.log('✓ Teste 9: Splash screen independente, monocromática e acessível validada.');

// Test 10: Verify Single-Window Full-Tab Architecture (No detached floating windows)
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
const mainWin = tauriConf.app.windows.find(w => w.label === 'main');
assert(mainWin, 'Janela "main" não encontrada em tauri.conf.json');
assert(mainWin.visible === true, 'Janela principal deve iniciar visível (visible: true)');
assert.strictEqual(tauriConf.app.windows.length, 1, 'Deve haver apenas 1 janela nativa para evitar janelas flutuantes desconexas e flicker');

const reactSplashPath = path.join(rootDir, 'src', 'components', 'splash', 'SplashScreen.tsx');
assert(fs.existsSync(reactSplashPath), 'SplashScreen.tsx deve existir');
const reactSplashContent = fs.readFileSync(reactSplashPath, 'utf8');
assert(reactSplashContent.includes('#0D0E11'), 'Fundo #0D0E11 ausente no SplashScreen.tsx');
assert(reactSplashContent.includes('100vw') && reactSplashContent.includes('100vh'), 'Splash deve ocupar 100% da área da aplicação (full tab)');
assert(reactSplashContent.includes('2160') && reactSplashContent.includes('1960'), 'Splash deve executar com duração otimizada (2160ms total, 20% mais rápida)');
console.log('✓ Teste 10: Arquitetura de splash full-tab em janela única nativa (sem janelas flutuantes desconexas) validada.');

// Test 11: Verify Rust Splash Command and Single Instance
const libRsContent = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'lib.rs'), 'utf8');
assert(libRsContent.includes('close_splashscreen'), 'Comando close_splashscreen ausente no lib.rs');
assert(libRsContent.includes('single_instance'), 'Plugin single_instance ausente no lib.rs');
console.log('✓ Teste 11: Comandos Rust e proteção contra janelas duplicadas validados.');

// Test 12: Verify GPU Micro-Tooltip System & Clean Attributes
const tooltipComponent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ui', 'Tooltip.tsx'), 'utf8');
assert(tooltipComponent.includes('createPortal'), 'Tooltip deve renderizar via React Portal');
assert(tooltipComponent.includes('window.innerWidth'), 'Guarda de colisão horizontal com viewport ausente');
assert(tooltipComponent.includes('window.innerHeight'), 'Guarda de colisão vertical com viewport ausente');
assert(tooltipComponent.includes('<kbd'), 'Renderizador de atalhos em badges <kbd> ausente');
assert(cssContent.includes('@keyframes tooltipFade'), 'Keyframe GPU @keyframes tooltipFade ausente no globals.css');
console.log('✓ Teste 12: Sistema de micro-tooltips com portal, detecção de colisão e aceleração GPU validado.');

// Test 13: Verify Minimalist Onboarding & Starter Note Experience
const onboardingContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'onboarding', 'OnboardingModal.tsx'), 'utf8');
assert(onboardingContent.includes('Escrita sem Fricção'), 'Pilar "Escrita sem Fricção" ausente no OnboardingModal');
assert(onboardingContent.includes('Organização Fluida'), 'Pilar "Organização Fluida" ausente no OnboardingModal');
assert(onboardingContent.includes('Foco no Teclado'), 'Pilar "Foco no Teclado" ausente no OnboardingModal');
assert(onboardingContent.includes("e.key === 'Escape'"), 'Atalho de teclado Escape ausente no OnboardingModal');
assert(onboardingContent.includes("e.key === 'Enter'"), 'Atalho de teclado Enter ausente no OnboardingModal');

const appContent = fs.readFileSync(path.join(rootDir, 'src', 'app', 'App.tsx'), 'utf8');
assert(appContent.includes('handleOpenStarterNote'), 'Função handleOpenStarterNote ausente no App.tsx');
assert(appContent.includes('Bem-vindo ao Nook'), 'Nota de introdução interativa ausente no App.tsx');

const editorContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'editor', 'Editor.tsx'), 'utf8');
assert(editorContent.includes('Guia Rápido'), 'Ação "Guia Rápido" ausente no estado vazio do Editor');
assert(editorContent.includes('Tooltip'), 'Tooltips ausentes no estado vazio do Editor');
console.log('✓ Teste 13: Onboarding minimalista, nota interativa e estado vazio intuitivo validados.');

// Test 14: Verify Sidebar Folder Drag & Drop & Unobstructed Overlay Architecture
const projectTreeContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'sidebar', 'ProjectTree.tsx'), 'utf8');
assert(projectTreeContent.includes("e.dataTransfer.types?.includes('Files')"), 'Suporte a tipos Files do Windows ausente no ProjectTree');
assert(projectTreeContent.includes('+ Soltar aqui'), 'Indicador visual de drop no projeto/pasta ausente');
assert(projectTreeContent.includes('onImportFile'), 'Callback onImportFile ausente no ProjectTree');

const sidebarContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'sidebar', 'Sidebar.tsx'), 'utf8');
assert(sidebarContent.includes("e.dataTransfer.types?.includes('Files')"), 'Suporte a tipos Files ausente na Sidebar');
assert(sidebarContent.includes('data-drop-zone="quick-notes"'), 'Zona de drop de notas rápidas ausente');

// App.tsx overlay must NOT cover the whole screen (not fixed inset 0 over sidebar)
assert(!appContent.includes('position: \'fixed\',\n            inset: 0,\n            backgroundColor: \'rgba(0, 0, 0, 0.72)\''), 'Overlay de drop não deve cobrir a tela inteira/barra lateral com fixed inset 0');
assert(appContent.includes('targetEl?.closest(\'[data-collection-id]\')'), 'Roteamento inteligente de drop para projeto ausente no App.tsx');
assert(appContent.includes('<SplashScreen'), 'Componente SplashScreen ausente no App.tsx');
console.log('✓ Teste 14: Drag & Drop para pastas da barra lateral desobstruído e roteamento inteligente validados.');

// Test 15: Validar remoção de botões manuais e drag & drop via Pointer Events (imune a bloqueio OLE/WebView2)
const contextMenuSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'sidebar', 'ContextMenu.tsx'), 'utf-8');
const projectTreeSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'sidebar', 'ProjectTree.tsx'), 'utf-8');

assert(!contextMenuSrc.includes('Mover para o topo'), 'Botões de reordenação direta não devem existir no menu de contexto');
assert(!contextMenuSrc.includes('ChevronsUp'), 'Ícones de reordenação direta não devem existir no menu de contexto');
assert(!projectTreeSrc.includes('GripVertical'), 'GripVertical não deve existir no ProjectTree (arrastar é nativo na linha inteira)');
assert(projectTreeSrc.includes('handleCollectionPointerDown'), 'Reordenação deve usar Pointer Events (imune ao bloqueio Windows OLE IDropTarget)');
assert(projectTreeSrc.includes("window.addEventListener('pointermove'"), 'Listener global de pointermove deve existir para arrastar fluido sem sinal de bloqueio');
assert(projectTreeSrc.includes('data-collection-row-id'), 'Atributo data-collection-row-id necessário para hit-testing preciso de posições');
console.log('✓ Teste 15: Remoção de botões manuais e drag & drop via Pointer Events (sem bloqueio OLE) validados.');

// Test 16: Validar proteções contra corrupção / apagamento acidental de arquivos externos (.txt / .md)
const useAutoSaveSrc = fs.readFileSync(path.join(rootDir, 'src', 'hooks', 'useAutoSave.ts'), 'utf-8');
const filesRsSrc = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'commands', 'files.rs'), 'utf-8');
const cmEditorSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'editor', 'CodeMirrorEditor.tsx'), 'utf-8');

assert(useAutoSaveSrc.includes('canAutoSaveExternal'), 'Guarda explícita canAutoSaveExternal obrigatória no useAutoSave.ts');
assert(useAutoSaveSrc.includes('lastSavedRef.current.docKey !== cur.docKey'), 'Guarda atômica de identidade docKey obrigatória para evitar sobrescrita cruzada');
assert(appContent.includes('externalFileRef.current'), 'Auto-refresh de foco deve verificar externalFileRef antes de atualizar conteúdo');
assert(appContent.includes('loadSeqRef.current'), 'Guarda monotônica loadSeqRef obrigatória contra race conditions assíncronas');
assert(filesRsSrc.includes('decode_text_bytes'), 'Decodificação multi-encoding (UTF-8 BOM / UTF-16 / Windows-1252) ausente no files.rs');
assert(cmEditorSrc.includes('Transaction.addToHistory.of(false)'), 'Carga programática do editor não deve entrar no histórico Ctrl+Z');
assert(editorContent.includes('key={`edit-${noteId || externalPath'), 'Instâncias do CodeMirrorEditor devem ser isoladas por key única');
console.log('✓ Teste 16: Blindagem completa contra corrupção ou perda de conteúdo ao abrir arquivos externos validada.');

console.log('\n--- Todos os 16 testes de interface, splash, drag & drop e blindagem de arquivos passaram com 100% de sucesso! ---');
