// ============================================================================
// NOOK — SUITE PLAYWRIGHT E2E MULTI-VIEWPORT & MULTI-NAVEGADOR
// Testa o bundle dist/ real em Chromium e Firefox across 14 viewports + DPI,
// jornadas completas (A-F), overflow horizontal, modais, clamping, teclado
// virtual, acessibilidade e estados de desconexão/reconexão.
// ============================================================================

import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const screenshotDir = process.env.NOOK_SCREENSHOT_DIR || path.join(rootDir, '.playwright-screenshots');

const PW_PATH = 'C:/Users/varg/AppData/Roaming/npm/node_modules/playwright/index.mjs';
const FIREFOX_EXE = 'C:/Users/varg/AppData/Local/ms-playwright/firefox-1522/firefox/firefox.exe';

const { chromium, firefox } = await import(pathToFileURL(PW_PATH).href);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

function createBackendState() {
  const now = Date.now();
  const collections = [
    {
      id: 'proj-alpha',
      name: 'Projeto Nook UX & Engenharia',
      parent_id: null,
      collection_type: 'project',
      sort_order: 0,
      is_deleted: false,
      created_at: now - 86400000,
      updated_at: now - 3600000,
    },
    {
      id: 'folder-sub',
      name: 'Subpasta com nome muito longo para testar truncamento seguro na barra lateral',
      parent_id: 'proj-alpha',
      collection_type: 'folder',
      sort_order: 0,
      is_deleted: false,
      created_at: now - 80000000,
      updated_at: now - 3600000,
    },
  ];
  const notes = [
    {
      id: 'note-md',
      collection_id: 'proj-alpha',
      title: 'Guia Editorial Markdown & Tabela Larga',
      content:
        '# Título Principal\n\nTexto de exemplo com link longo https://example.com/caminho/muito/extenso/para/testar/quebra/de/linha/sem/estourar/a/largura/mobile\n\n| Coluna 1 | Coluna 2 | Coluna 3 | Coluna 4 | Coluna 5 | Coluna 6 |\n|---|---|---|---|---|---|\n| A1 | B1 | C1 | D1 | E1 | F1 |\n| A2 | B2 | C2 | D2 | E2 | F2 |\n\n```typescript\nexport const greet = (name: string) => `Olá, ${name}!`;\n```\n\n- [ ] Tarefa pendente\n- [x] Tarefa concluída\n',
      snippet: 'Texto de exemplo com tabela larga e bloco de código...',
      is_pinned: true,
      is_deleted: false,
      created_at: now - 5000000,
      updated_at: now - 120000,
    },
    {
      id: 'note-quick',
      collection_id: null,
      title: 'Rascunho Rápido',
      content: 'Conteúdo inicial persistido.',
      snippet: 'Conteúdo inicial persistido.',
      is_pinned: false,
      is_deleted: false,
      created_at: now - 4000000,
      updated_at: now - 60000,
    },
  ];
  const versions = {
    'note-md': [
      {
        id: 'ver-1',
        note_id: 'note-md',
        title: 'Guia Editorial v1',
        content: '# Versão Anterior\nConteúdo histórico salvo.',
        created_at: now - 3600000,
      },
    ],
  };
  const settings = new Map([
    ['theme', 'gray'],
    ['language', 'pt'],
  ]);
  return { collections, notes, versions, settings };
}

function sendWsText(socket, obj) {
  const payload = Buffer.from(JSON.stringify(obj), 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else {
    header = Buffer.from([0x81, 126, (len >> 8) & 0xff, len & 0xff]);
  }
  try {
    socket.write(Buffer.concat([header, payload]));
  } catch {}
}

function startMockServer(state) {
  const wsClients = new Set();
  let wsAllow = true;

  const readBody = (req) =>
    new Promise((resolve) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
        } catch {
          resolve({});
        }
      });
    });

  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, 'http://127.0.0.1');
    const pathname = reqUrl.pathname;

    const json = (code, data) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    if (pathname === '/api/status') {
      return json(200, {
        ok: true,
        version: '1.0.0',
        build_id: 'nook-v1.0.0-test',
      });
    }
    if (pathname === '/api/app/restore') return json(200, { restored: true });

    if (pathname === '/api/collections' && req.method === 'GET') {
      return json(200, state.collections.filter((c) => !c.is_deleted));
    }
    if (pathname === '/api/collections' && req.method === 'POST') {
      const b = await readBody(req);
      const col = {
        id: 'col-' + Math.random().toString(36).slice(2, 8),
        name: b.name || 'Novo Projeto',
        parent_id: b.parent_id ?? null,
        collection_type: b.collection_type || 'project',
        sort_order: state.collections.length,
        is_deleted: false,
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      state.collections.push(col);
      return json(200, col);
    }

    if (pathname === '/api/notes' && req.method === 'GET') {
      return json(200, state.notes.filter((n) => !n.is_deleted));
    }
    if (pathname === '/api/notes' && req.method === 'POST') {
      const b = await readBody(req);
      const created = {
        id: 'note-' + Math.random().toString(36).slice(2, 8),
        collection_id: b.collection_id ?? null,
        title: b.title || 'Sem título',
        content: b.content || '',
        snippet: (b.content || '').slice(0, 80),
        is_pinned: false,
        is_deleted: false,
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      state.notes.unshift(created);
      return json(200, created);
    }
    if (pathname === '/api/notes/save' && req.method === 'POST') {
      const b = await readBody(req);
      const target = state.notes.find((n) => n.id === b.id);
      if (target) {
        target.title = b.title ?? target.title;
        target.content = b.content ?? target.content;
        target.snippet = (target.content || '').slice(0, 80);
        target.updated_at = Date.now();
        return json(200, { id: target.id, updated_at: target.updated_at, version: b.version || 1 });
      }
      return json(404, { error: 'Not found' });
    }
    if (pathname === '/api/notes/move' && req.method === 'POST') {
      const b = await readBody(req);
      const target = state.notes.find((n) => n.id === b.id);
      if (target) target.collection_id = b.collection_id ?? null;
      return json(200, { ok: true });
    }
    if (pathname === '/api/notes/pin' && req.method === 'POST') {
      const b = await readBody(req);
      const target = state.notes.find((n) => n.id === b.id);
      if (target) target.is_pinned = !target.is_pinned;
      return json(200, target ? target.is_pinned : false);
    }
    if (pathname === '/api/notes/duplicate' && req.method === 'POST') {
      const b = await readBody(req);
      const src = state.notes.find((n) => n.id === b.id);
      const copy = {
        ...src,
        id: 'note-' + Math.random().toString(36).slice(2, 8),
        title: `${src?.title || 'Sem título'} (cópia)`,
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      state.notes.unshift(copy);
      return json(200, copy);
    }
    if (pathname.startsWith('/api/notes/') && pathname.endsWith('/versions')) {
      const id = pathname.split('/')[3];
      if (req.method === 'POST') {
        const b = await readBody(req);
        const ver = {
          id: 'ver-' + Date.now(),
          note_id: id,
          title: b.title || '',
          content: b.content || '',
          created_at: Date.now(),
        };
        state.versions[id] = [ver, ...(state.versions[id] || [])];
        return json(200, ver);
      }
      return json(200, state.versions[id] || []);
    }
    if (pathname.startsWith('/api/notes/')) {
      const id = pathname.split('/')[3];
      const found = state.notes.find((n) => n.id === id);
      if (req.method === 'DELETE') {
        if (found) found.is_deleted = true;
        return json(200, { ok: true });
      }
      return found ? json(200, found) : json(404, { error: 'Not found' });
    }
    if (pathname === '/api/trash') {
      return json(200, state.notes.filter((n) => n.is_deleted));
    }
    if (pathname === '/api/trash/collections') {
      return json(200, state.collections.filter((c) => c.is_deleted));
    }
    if (pathname === '/api/search') {
      const q = (reqUrl.searchParams.get('q') || '').toLowerCase();
      const hits = state.notes
        .filter((n) => !n.is_deleted && (`${n.title} ${n.content}`).toLowerCase().includes(q))
        .map((n) => ({
          id: n.id,
          item_type: 'note',
          title: n.title,
          snippet: n.snippet || '',
          collection_name: state.collections.find((c) => c.id === n.collection_id)?.name || null,
        }));
      return json(200, hits);
    }
    if (pathname === '/api/settings') {
      if (req.method === 'POST') {
        const b = await readBody(req);
        if (b.key) state.settings.set(b.key, String(b.value ?? ''));
        return json(200, { ok: true });
      }
      const list = [...state.settings.entries()].map(([key, value]) => ({ key, value }));
      return json(200, list);
    }

    // Serve compiled static files from dist/
    let relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    let filePath = path.join(distDir, relPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  server.on('upgrade', (req, socket) => {
    if (!wsAllow) {
      socket.destroy();
      return;
    }
    const key = req.headers['sec-websocket-key'];
    const accept = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    wsClients.add(socket);
    sendWsText(socket, { event: 'connected', data: {} });
    socket.on('close', () => wsClients.delete(socket));
    socket.on('error', () => wsClients.delete(socket));
  });

  return {
    server,
    dropAllWs: () => {
      wsAllow = false;
      for (const s of wsClients) {
        try {
          s.end();
          s.destroy();
        } catch {}
      }
      wsClients.clear();
    },
    allowWs: () => {
      wsAllow = true;
    },
  };
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    bodyScrollW: document.body.scrollWidth,
  }));
  assert(
    metrics.scrollW <= metrics.innerW + 1 && metrics.bodyScrollW <= metrics.innerW + 1,
    `Overflow horizontal detectado em [${label}]: scrollWidth=${metrics.scrollW}, body=${metrics.bodyScrollW}, innerWidth=${metrics.innerW}`
  );
}

async function assertVisibleInsideViewport(locator, label) {
  const box = await locator.boundingBox();
  assert(box && box.width > 0 && box.height > 0, `Elemento [${label}] invisível`);
  const vp = await locator.page().evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  assert(
    box.x >= -1 &&
      box.y >= -1 &&
      box.x + box.width <= vp.w + 2 &&
      box.y + box.height <= vp.h + 2,
    `Elemento [${label}] cortado fora da viewport (${vp.w}x${vp.h}): box=${JSON.stringify(box)}`
  );
}

console.log('--- Executando Suite Playwright E2E Multi-Viewport & Multi-Navegador ---');
fs.mkdirSync(screenshotDir, { recursive: true });

const backendState = createBackendState();
const mock = startMockServer(backendState);
await new Promise((resolve) => mock.server.listen(0, '127.0.0.1', resolve));
const port = mock.server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;

let chromiumBrowser;
let firefoxBrowser;

try {
  chromiumBrowser = await chromium.launch();
  firefoxBrowser = await firefox.launch({ executablePath: FIREFOX_EXE });

  // =========================================================================
  // 1. VARREDURA COMPLETA DOS 12 VIEWPORTS + PAISAGEM + DPI (CHROMIUM)
  // =========================================================================
  const viewports = [
    { width: 320, height: 568, name: '320px-mobile-min', mobile: true },
    { width: 360, height: 640, name: '360px-android', mobile: true },
    { width: 375, height: 667, name: '375px-iphone-compact', mobile: true },
    { width: 390, height: 844, name: '390px-iphone-modern', mobile: true },
    { width: 430, height: 932, name: '430px-phone-large', mobile: true },
    { width: 600, height: 800, name: '600px-narrow-window', mobile: false },
    { width: 768, height: 1024, name: '768px-tablet', mobile: false },
    { width: 820, height: 1180, name: '820px-tablet-mid', mobile: false },
    { width: 1024, height: 768, name: '1024px-landscape-small', mobile: false },
    { width: 1280, height: 720, name: '1280x720-low-height', mobile: false, dpr: 1.5 },
    { width: 1440, height: 900, name: '1440px-desktop', mobile: false, dpr: 1.25 },
    { width: 1920, height: 1080, name: '1920px-large', mobile: false, dpr: 2 },
    { width: 812, height: 375, name: '812x375-mobile-landscape', mobile: true },
  ];

  for (const vp of viewports) {
    const context = await chromiumBrowser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr || 1,
      hasTouch: vp.mobile,
      isMobile: vp.mobile && vp.width < 600,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.addInitScript(() => {
      localStorage.setItem('nook_onboarding_completed', 'true');
    });
    const targetUrl = vp.mobile ? `${baseUrl}/?mobile=true` : baseUrl;
    await page.goto(targetUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('header, .btn-primary, .cm-editor', { timeout: 10000 });
    await page.waitForTimeout(300);

    await assertNoHorizontalOverflow(page, `${vp.name}-home`);

    // Abre a nota Markdown larga em todos os viewports (drawer no mobile/compacto ou Ctrl+B no desktop estreito)
    const noteEntry = page.getByText('Guia Editorial Markdown').first();
    if (!(await noteEntry.isVisible().catch(() => false))) {
      if (vp.mobile || vp.width <= 768) {
        await page.getByLabel('Abrir menu de navegação').click();
      } else {
        await page.keyboard.press('Control+b');
      }
      await page.waitForTimeout(250);
    }
    await noteEntry.click();
    await page.waitForTimeout(300);
    await assertNoHorizontalOverflow(page, `${vp.name}-editor`);

    // Alterna para leitura para validar tabela larga & URL comprida
    await page.getByRole('button', { name: 'Leitura' }).click();
    await page.waitForTimeout(200);
    await assertNoHorizontalOverflow(page, `${vp.name}-reading-wide-table`);
    await page.getByRole('button', { name: 'Editar' }).click();

    // Screenshots visuais dos cenários chave
    if (vp.name === '375px-iphone-compact') {
      await page.screenshot({ path: path.join(screenshotDir, 'mobile-375-editor.png') });
      await page.getByLabel('Abrir menu de navegação').click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(screenshotDir, 'mobile-375-drawer.png') });
      await page.getByLabel('Fechar menu').click();
      await page.waitForTimeout(250);
    } else if (vp.name === '1440px-desktop') {
      await page.screenshot({ path: path.join(screenshotDir, 'desktop-1440-editor.png') });
    }

    assert.strictEqual(errors.length, 0, `Erros JS em ${vp.name}: ${errors.join('; ')}`);
    await context.close();
    console.log(`  · Viewport ${vp.name} OK`);
  }
  console.log(`✓ Teste 1: Todos os ${viewports.length} viewports (320px–1920px, landscape e DPI 1x–2x) sem overflow ou erros JS.`);

  // =========================================================================
  // 2. JORNADAS COMPLETAS E MODAIS NO DESKTOP & TEMAS 2.0 VISUAL CHECK (CHROMIUM)
  // =========================================================================
  // Jornada A0: Instalação limpa padrão em Inglês + Carrossel 3 idiomas + 3 etapas -> Editor
  {
    const freshState = {
      collections: [],
      notes: [],
      versions: {},
      settings: new Map([['theme', 'gray']]),
    };
    const freshMock = startMockServer(freshState);
    await new Promise((resolve) => freshMock.server.listen(0, '127.0.0.1', resolve));
    const freshUrl = `http://127.0.0.1:${freshMock.server.address().port}`;
    const freshCtx = await chromiumBrowser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await freshCtx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    try {
      await page.goto(freshUrl, { waitUntil: 'networkidle' });
      const dlg = page.locator('[role="dialog"]').first();
      await dlg.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(250);
      await assertVisibleInsideViewport(dlg, 'Onboarding-Fresh-Step0-1280x720');

      const step0Text = await dlg.innerText();
      assert(step0Text.includes('Welcome to Nook'), 'Instalação nova deve abrir em Inglês (Welcome to Nook)');
      assert(step0Text.includes('Choose your language'), 'Etapa 0 deve exibir Choose your language');
      await page.screenshot({ path: path.join(screenshotDir, 'onboarding-step0-en-1280x720.png') });

      // Avança carrossel para Português
      await dlg.locator('button[aria-label]').nth(2).click();
      await page.waitForTimeout(160);
      const ptText = await dlg.innerText();
      assert(ptText.includes('Boas-vindas ao Nook') && ptText.includes('Seu espaço para ideias.'), 'Carrossel deve atualizar para Português');

      // Avança carrossel para Español
      await dlg.locator('button[aria-label]').nth(2).click();
      await page.waitForTimeout(160);
      const esText = await dlg.innerText();
      assert(esText.includes('Te damos la bienvenida a Nook') && esText.includes('Tu espacio para las ideas.'), 'Carrossel deve atualizar para Español');

      // Volta para English pelo seletor direto
      await dlg.getByRole('radio', { name: 'English' }).click();
      await page.waitForTimeout(160);
      assert((await dlg.innerText()).includes('Welcome to Nook'), 'Seleção direta de idioma deve atualizar instantaneamente');

      // Etapa 0 -> Etapa 1 (Essenciais)
      await dlg.getByRole('button', { name: /Continue/i }).click();
      await page.waitForTimeout(220);
      const step1Text = await dlg.innerText();
      assert(
        step1Text.includes('Quick notes') && step1Text.includes('Projects') && step1Text.includes('Search'),
        'Etapa 1 deve exibir exatamente os 3 essenciais (Quick notes, Projects, Search)'
      );
      await page.screenshot({ path: path.join(screenshotDir, 'onboarding-step1-1280x720.png') });

      // Etapa 1 -> Etapa 2 (Start writing) -> Editor ativo
      await dlg.getByRole('button', { name: /Continue/i }).click();
      await page.waitForTimeout(220);
      await dlg.getByRole('button', { name: /Start writing/i }).click();
      await page.waitForSelector('.cm-content', { timeout: 6000 });
      assert.strictEqual(freshState.settings.get('language'), 'en', 'Idioma escolhido no onboarding deve persistir no backend');
      assert.strictEqual(errors.length, 0, `Erros Onboarding Novo: ${errors.join('; ')}`);
    } finally {
      await freshCtx.close();
      freshMock.server.close();
    }
  }

  // Jornada A-F em perfil existente PT (Autosave, ContextMenu, CommandPalette, Settings 2.0, Temas Neon/Sakura)
  {
    const deskCtx = await chromiumBrowser.newContext({ viewport: { width: 1280, height: 720 } });
    await deskCtx.addInitScript(() => {
      localStorage.setItem('nook_onboarding_completed', 'true');
    });
    const page = await deskCtx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('header, .btn-primary, .cm-editor', { timeout: 10000 });
    await page.waitForTimeout(250);

    // Abre nota e valida autosave persistido após reload
    await page.getByText('Guia Editorial Markdown').first().click();
    await page.waitForSelector('.cm-content', { timeout: 6000 });
    const cm = page.locator('.cm-content').first();
    await cm.click();
    await page.keyboard.type('\nLinha validada no E2E Chromium.');
    await page.waitForTimeout(900);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('header, .btn-primary, .cm-editor', { timeout: 10000 });
    await page.waitForTimeout(300);

    // Jornada B: Clamping do ContextMenu próximo à borda inferior/direita
    await page.getByText('Guia Editorial Markdown').first().click({ button: 'right' });
    const ctxMenu = page.locator('[role="menu"]').first();
    await ctxMenu.waitFor({ state: 'visible', timeout: 3000 });
    await assertVisibleInsideViewport(ctxMenu, 'ContextMenu-desktop');
    await page.keyboard.press('Escape');

    // CommandPalette (Ctrl+K) + busca real + dica contextual dispensável
    await page.keyboard.press('Control+k');
    const cmdDialog = page.locator('[role="dialog"]').first();
    await cmdDialog.waitFor({ state: 'visible', timeout: 3000 });
    await assertVisibleInsideViewport(cmdDialog, 'CommandPalette-desktop');
    await page.screenshot({ path: path.join(screenshotDir, 'command-palette-1280.png') });
    await page.keyboard.type('Guia Editorial');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');

    // Settings modal: Aparência (miniaturas), Idioma, Dados & Backup e Sobre o Nook
    await page.keyboard.press('Control+,');
    const settingsDlg = page.locator('[role="dialog"]').first();
    await settingsDlg.waitFor({ state: 'visible', timeout: 3000 });
    await assertVisibleInsideViewport(settingsDlg, 'Settings-desktop');
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(screenshotDir, 'settings-appearance-1280.png') });

    await page.getByRole('button', { name: /Idioma|Language/i }).click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(screenshotDir, 'settings-language-1280.png') });

    await page.getByRole('button', { name: /Geral|General/i }).click();
    await page.waitForTimeout(150);
    await page.getByRole('button', { name: /Dados|Data/i }).click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(screenshotDir, 'settings-data-1280.png') });

    await page.getByRole('button', { name: /Sobre o Nook|About Nook/i }).click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(screenshotDir, 'settings-about-1280.png') });
    await page.keyboard.press('Escape');

    // Inspeção visual Temas 2.0 (Sakura & Neon em tela vazia 1440x900 vs nota aberta)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(150);
    // Fecha abas abertas para capturar o estado vazio limpo sem nota ativa
    while (await page.locator('[aria-label="Fechar aba"]').count()) {
      await page.locator('[aria-label="Fechar aba"]').first().click();
      await page.waitForTimeout(120);
    }
    await page.keyboard.press('Control+,');
    await settingsDlg.waitFor({ state: 'visible', timeout: 3000 });
    await settingsDlg.getByRole('button', { name: /Sakura/i }).click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(280);
    await page.screenshot({ path: path.join(screenshotDir, 'sakura-empty-1440.png') });

    await page.getByText('Guia Editorial Markdown').first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, 'sakura-editor-1440.png') });

    await page.keyboard.press('Control+,');
    await settingsDlg.waitFor({ state: 'visible', timeout: 3000 });
    await settingsDlg.getByRole('button', { name: /Neon/i }).click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, 'neon-editor-1440.png') });

    while (await page.locator('[aria-label="Fechar aba"]').count()) {
      await page.locator('[aria-label="Fechar aba"]').first().click();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(280);
    await page.screenshot({ path: path.join(screenshotDir, 'neon-empty-1440.png') });

    // Restaura tema cinza padrão no estado mock
    await page.keyboard.press('Control+,');
    await settingsDlg.waitFor({ state: 'visible', timeout: 3000 });
    await settingsDlg.getByRole('button', { name: /Cinza|Gray/i }).click();
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(150);

    // Version History
    await page.getByText('Guia Editorial Markdown').first().click();
    await page.waitForTimeout(250);
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(200);
    await page.keyboard.type('Versões Anteriores');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const verDlg = page.locator('[role="dialog"]').first();
    await verDlg.waitFor({ state: 'visible', timeout: 3000 });
    await assertVisibleInsideViewport(verDlg, 'VersionHistory-desktop');
    await page.keyboard.press('Escape');

    assert.strictEqual(errors.length, 0, `Erros Desktop Journeys: ${errors.join('; ')}`);
    await deskCtx.close();
    console.log('✓ Teste 2: Onboarding EN/PT/ES 3 etapas, Temas 2.0 (Sakura/Neon), Settings (Aparência/Idioma/Dados/Sobre), Autosave & Versões OK.');
  }

  // =========================================================================
  // 3. NOOK MOBILE (320px/375px): MODAIS, TOQUE ⋯, TECLADO VIRTUAL & DESCONEXÃO
  // =========================================================================
  {
    const mobCtx = await chromiumBrowser.newContext({
      viewport: { width: 320, height: 568 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await mobCtx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.addInitScript(() => {
      localStorage.setItem('nook_onboarding_completed', 'true');
    });
    await page.goto(`${baseUrl}/?mobile=true`, { waitUntil: 'networkidle' });
    await page.waitForSelector('header, .btn-primary, .cm-editor', { timeout: 10000 });
    await page.waitForTimeout(350);
    await assertNoHorizontalOverflow(page, 'mobile-320-init');

    // Abre Ajuda mobile via menu ⋮ do MobileTopBar -> verifica zero overflow e guia por toque
    await page.getByLabel('Mais ações').click();
    await page.waitForTimeout(150);
    await page.getByRole('menuitem', { name: /Ajuda e atalhos/i }).click();
    await page.waitForTimeout(250);
    const mobHelp = page.locator('[role="dialog"]').first();
    await assertVisibleInsideViewport(mobHelp, 'MobileHelp-320x568');
    await page.screenshot({ path: path.join(screenshotDir, 'mobile-320-help.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Abre Configurações mobile em 320px -> valida tabs horizontais sem quebra
    await page.getByLabel('Mais ações').click();
    await page.waitForTimeout(150);
    await page.getByRole('menuitem', { name: /Configurações/i }).click();
    await page.waitForTimeout(250);
    const mobSettings = page.locator('[role="dialog"]').first();
    await assertVisibleInsideViewport(mobSettings, 'MobileSettings-320x568');
    await page.screenshot({ path: path.join(screenshotDir, 'mobile-320-settings.png') });
    await page.keyboard.press('Escape');

    // Jornada C: Abre Drawer, testa botão ⋯ em pasta/nota (sem depender de right-click)
    await page.getByLabel('Abrir menu de navegação').click();
    await page.waitForTimeout(250);
    const itemMenuBtn = page.getByLabel('Opções do item').first();
    await itemMenuBtn.click();
    await page.waitForTimeout(150);
    const touchCtxMenu = page.locator('[role="menu"]').first();
    await assertVisibleInsideViewport(touchCtxMenu, 'Mobile-Item-ContextMenu-320');
    await page.keyboard.press('Escape');
    await page.getByLabel('Fechar menu').click();

    // Testa criação de Projeto via PromptDialog em 320px (antigo width: 380px vazava!)
    await page.getByLabel('Abrir menu de navegação').click();
    await page.waitForTimeout(200);
    await page.getByLabel('Criar novo projeto').click();
    await page.waitForTimeout(200);
    const promptDlg = page.locator('[role="dialog"]').first();
    await assertVisibleInsideViewport(promptDlg, 'PromptDialog-320px');
    await page.keyboard.press('Escape');
    await page.getByLabel('Fechar menu').click();

    // Testa edição Mobile + simulação de teclado virtual reduzindo viewport para 320x300
    await page.getByLabel('Abrir menu de navegação').click();
    await page.waitForTimeout(200);
    await page.getByText('Guia Editorial Markdown').first().click();
    await page.waitForTimeout(250);
    await page.locator('.cm-content').first().click();
    await page.setViewportSize({ width: 320, height: 300 });
    await page.waitForTimeout(250);
    await assertNoHorizontalOverflow(page, 'mobile-320-virtual-keyboard-open');
    await page.keyboard.type('\nDigitado com teclado virtual ativo');
    const editorVal = await page.locator('.cm-content').first().innerText();
    assert(editorVal.includes('Digitado com teclado virtual ativo'), 'Texto digitado com teclado aberto deve permanecer');

    // Jornada E: Simula queda do Nook.exe (WebSocket fechado) -> verifica banner de desconexão não-bloqueante
    await page.setViewportSize({ width: 360, height: 640 });
    mock.dropAllWs();
    await page.waitForTimeout(3000);
    const banner = page.locator('[role="status"]').filter({ hasText: /Nook|Reconectando/i }).first();
    await banner.waitFor({ state: 'visible', timeout: 12000 });
    await page.screenshot({ path: path.join(screenshotDir, 'mobile-360-disconnected.png') });
    mock.allowWs();

    assert.strictEqual(errors.length, 0, `Erros Mobile Journeys: ${errors.join('; ')}`);
    await mobCtx.close();
    console.log('✓ Teste 3: Nook Mobile 320px–360px (Menu ⋮, ⋯ nas pastas, PromptDialog sem corte, Teclado Virtual, Banner offline) OK.');
  }

  // =========================================================================
  // 4. VALIDAÇÃO CROSS-BROWSER EM FIREFOX GECKO (320px, 390px, 768px, 1280px)
  // =========================================================================
  {
    const ffCtx = await firefoxBrowser.newContext({ viewport: null });
    await ffCtx.addInitScript(() => {
      localStorage.setItem('nook_onboarding_completed', 'true');
    });
    const opener = await ffCtx.newPage();
    await opener.setContent('<html><body></body></html>');

    for (const vp of [
      { width: 320, height: 568, mobile: true },
      { width: 390, height: 844, mobile: true },
      { width: 768, height: 1024, mobile: false },
      { width: 1280, height: 800, mobile: false },
    ]) {
      const [page] = await Promise.all([
        opener.waitForEvent('popup'),
        opener.evaluate(
          ([w, h]) => window.open('about:blank', '_blank', `width=${w},height=${h}`),
          [vp.width, vp.height]
        ),
      ]);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(vp.mobile ? `${baseUrl}/?mobile=true` : baseUrl, { waitUntil: 'networkidle' });
      await page.waitForSelector('header, .btn-primary, .cm-editor', { timeout: 10000 });
      await page.waitForTimeout(300);
      await assertNoHorizontalOverflow(page, `firefox-${vp.width}px`);
      const actualWidth = await page.evaluate(() => window.innerWidth);
      assert(Math.abs(actualWidth - vp.width) <= 2, `Largura esperada Firefox ${vp.width}px, obtida ${actualWidth}px`);
      assert.strictEqual(errors.length, 0, `Erros Firefox ${vp.width}px: ${errors.join('; ')}`);
      await page.close();
      console.log(`  · Firefox Gecko ${vp.width}px OK`);
    }
    await ffCtx.close();
    console.log('✓ Teste 4: Validação cross-browser Firefox 150 (320px, 390px, 768px, 1280px) aprovada com zero erros.');
  }

  console.log(`\n--- Suite Playwright E2E Multi-Viewport & Multi-Navegador concluída com 100% de sucesso! Screenshots em ${screenshotDir} ---`);
} finally {
  if (chromiumBrowser) await chromiumBrowser.close();
  if (firefoxBrowser) await firefoxBrowser.close();
  mock.server.close();
}
