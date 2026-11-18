<div align="center">

<br />

<img src="./assets/brand/nook-app-icon-1024.png" alt="Ícone do Nook" width="132" />
&nbsp;&nbsp;&nbsp;
<img src="./assets/brand/mascot/nook-welcome-wave.png" alt="Mascote do Nook" width="108" />

# Nook

### Seu espaço minimalista, rápido e 100% local-first para notas, projetos e fluxos de trabalho no Windows, Web e Mobile.

<p>
  <strong>🌐 Idioma:</strong>
  &nbsp;<a href="./README.md">English</a>
  &nbsp;•&nbsp;
  <b>Português (BR)</b>
  &nbsp;•&nbsp;
  <a href="./README.es.md">Español</a>
</p>

<p>
  <a href="https://github.com/zeitgeist2004/Nook/releases/latest">
    <img src="https://img.shields.io/badge/Versão-v1.0.0-111111?style=for-the-badge&logo=github&logoColor=white" alt="Versão v1.0.0" />
  </a>
  <img src="https://img.shields.io/badge/Windows-10%20%2F%2011%20(x64)-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Windows 10/11" />
  <img src="https://img.shields.io/badge/Tauri%202%20%2B%20Rust-Native-FFC131?style=for-the-badge&logo=tauri&logoColor=black" alt="Tauri 2 + Rust" />
  <img src="https://img.shields.io/badge/SQLite-WAL%20Offline-0F80CC?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite WAL" />
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/Licença-MIT-10B981?style=for-the-badge" alt="Licença MIT" />
  </a>
</p>

<p>
  <a href="#-download-e-instalação-windows">⬇️ Baixar EXE / Instalador</a> •
  <a href="#-recursos-principais">✨ Recursos</a> •
  <a href="#-explore-os-recursos">🎨 Detalhes</a> •
  <a href="#-privacidade-e-arquitetura">🔒 Arquitetura</a> •
  <a href="#-compilar-do-código-fonte">🛠️ Compilar</a>
</p>

</div>

---

## ⬇️ Download e Instalação (Windows)

Baixe o formato que preferir em **[GitHub Releases](https://github.com/zeitgeist2004/Nook/releases/latest)**:

| Formato | Indicado para | Download Direto |
| :--- | :--- | :--- |
| **Instalador `.exe` (NSIS)** | Instalação padrão no Windows com atalhos, associação de arquivos `.md`/`.txt` e atualização automática *(Recomendado)* | [![Baixar Setup EXE](https://img.shields.io/badge/Baixar-Nook--1.0.0--Setup.exe-00C875?style=flat-square&logo=windows&logoColor=white)](https://github.com/zeitgeist2004/Nook/releases/latest) |
| **Instalador `.msi` (Windows Installer)** | Pacote MSI padrão Windows x64 | [![Baixar MSI](https://img.shields.io/badge/Baixar-Nook--1.0.0--x64.msi-0078D6?style=flat-square&logo=windows&logoColor=white)](https://github.com/zeitgeist2004/Nook/releases/latest) |
| **Versão Portátil (`.zip`)** | Extrair e usar sem instalar (inclui `Nook.exe`, `WebView2Loader.dll` e `cloudflared.exe`) | [![Baixar ZIP](https://img.shields.io/badge/Baixar-Nook--Portatil--Completo.zip-6B7280?style=flat-square&logo=files&logoColor=white)](https://github.com/zeitgeist2004/Nook/releases/latest) |
| **Executável Avulso (`.exe`)** | Execução direta do binário `Nook.exe` | [![Baixar EXE](https://img.shields.io/badge/Baixar-Nook.exe-18181B?style=flat-square&logo=windows&logoColor=white)](https://github.com/zeitgeist2004/Nook/releases/latest) |

---

## ✨ Recursos Principais

- **100% Offline e Local-First:** Sem conta, sem login, sem nuvem obrigatória e zero telemetria. Dados gravados localmente em SQLite (`WAL`).
- **Editor CodeMirror 6 + Leitor Markdown:** Modos **Editar**, **Dividir** e **Leitura** em 1 clique.
- **Organização Fluida:** Projetos, subpastas aninhadas, **Notas Rápidas**, até 5 abas simultâneas, notas fixadas e reordenação por arrastar e soltar.
- **Auto-Save & Histórico de Versões:** Salvamento automático em 350ms, rascunho de recuperação e versões anteriores restauráveis.
- **Busca Instantânea & Paleta de Comandos (`Ctrl + K`):** Pesquisa em tempo real via SQLite **FTS5** e ações rápidas por teclado.
- **Fluxo Dev para Agentes de IA (Opcional):** Monte **Context Pack** em 1 clique, salve **Modelos de Prompt**, **Session Handoff**, **Diário de Projeto**, vincule pastas e consulte `CLAUDE.md`, `AGENTS.md` e skills locais (`SKILL.md`).
- **Interface Multilíngue:** **English**, **Português (BR)** e **Español**.
- **Backups Automáticos & Auto-Update:** Cópias diárias/semanais configuráveis em `.json`, exportação completa em `.md` e atualizações assinadas via GitHub Releases.

---

## 🎨 Explore os Recursos

<details>
<summary><b>📝 1. Markdown Completo (Callouts, Wikilinks, Checklists e Frontmatter)</b></summary>
<br />

- **Callouts Formatados:** `> [!note]`, `> [!tip]`, `> [!warning]` e `> [!important]`.
- **Wikilinks:** `[[Nome da Nota]]` ou `[[Nota Alvo|Texto]]` — navegue ou crie notas com um clique no modo leitura.
- **Checklists Interativas:** Marque e desmarque `- [ ] Tarefa` direto no modo leitura com atualização imediata do Markdown.
- **Frontmatter YAML & Hashtags:** Propriedades no topo da nota exibidas em cartão limpo + reconhecimento de `#tags`.

</details>

<details>
<summary><b>🎨 2. Cinco Temas Visuais (Sincronizados entre Desktop, Web e Mobile)</b></summary>
<br />

| Tema | Estilo | Destaque |
| :--- | :--- | :--- |
| **Cinza (`gray`)** | Minimalismo grafite balanceado | Padrão confortável para escrita prolongada |
| **Escuro (`dark`)** | Contraste profundo `#090A0D` | Foco noturno sem fadiga visual |
| **Claro (`white`)** | Papel quente editorial `#FAF9F6` | Leitura nítida em ambientes claros |
| **Neon (`neon`)** | Terminal / Cibersegurança | Fundo escuro com trilhas PCB e grade verde `#00FF9D` |
| **Sakura (`sakura`)** | Jardim japonês minimalista | Tons escuros acolhedores com ramos e flores `#E89EB8` |

</details>

<details>
<summary><b>📱 3. Nook Web, Nook Mobile & Nook Voice (Sincronização ao Vivo)</b></summary>
<br />

- **Nook Web:** Acesse sua biblioteca pelo navegador local (`127.0.0.1`) via servidor Rust **Axum** embutido.
- **Nook Mobile:** Ative o túnel seguro **Cloudflare Quick Tunnel**, escaneie o **QR Code** no celular e aprove o pareamento 2FA direto na tela do PC.
- **Nook Voice:** Ditado rápido de notas por voz no navegador ou celular com fila offline de recuperação.

</details>

---

## 🔒 Privacidade & Arquitetura

- **Core Desktop:** Tauri 2 + Rust (Edition 2024)
- **Banco de Dados:** SQLite local (`WAL` + `FTS5`)
- **Frontend:** React 18 + TypeScript + Vite
- **Editor & Preview:** CodeMirror 6 + `marked` + `DOMPurify`

---

## 🛠️ Compilar do Código-Fonte

```bash
npm install
npm test
npx tsc --noEmit
npm run tauri build
```

---

## ❤️ Apoiar o Nook

O Nook é 100% gratuito e open-source. Se ele ajuda no seu dia a dia, você pode apoiar o projeto pelo **[GitHub Sponsors](https://github.com/sponsors/zeitgeist2004)**.

<div align="center">
  <br />
  <img src="./assets/brand/mascot/nook-idle-open.png" alt="Mascote Nook" width="56" />
  <br />
  <sub>Feito por <a href="https://github.com/zeitgeist2004">zeitgeist2004</a> • <a href="./LICENSE">Licença MIT</a></sub>
</div>
