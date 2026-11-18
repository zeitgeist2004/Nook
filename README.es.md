<div align="center">

<br />

<img src="./assets/brand/nook-app-icon-1024.png" alt="Icono de Nook" width="132" />
&nbsp;&nbsp;&nbsp;
<img src="./assets/brand/mascot/nook-welcome-wave.png" alt="Mascota de Nook" width="108" />

# Nook

### Tu espacio minimalista, rápido y 100% local-first para notas, proyectos y flujos de trabajo en Windows, Web y Mobile.

<p>
  <strong>🌐 Idioma:</strong>
  &nbsp;<a href="./README.md">English</a>
  &nbsp;•&nbsp;
  <a href="./README.pt-BR.md">Português (BR)</a>
  &nbsp;•&nbsp;
  <b>Español</b>
</p>

<p>
  <a href="https://github.com/zeitgeist2004/Nook/releases/latest">
    <img src="https://img.shields.io/badge/Versión-v1.0.0-111111?style=for-the-badge&logo=github&logoColor=white" alt="Versión v1.0.0" />
  </a>
  <img src="https://img.shields.io/badge/Windows-10%20%2F%2011%20(x64)-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Windows 10/11" />
  <img src="https://img.shields.io/badge/Tauri%202%20%2B%20Rust-Native-FFC131?style=for-the-badge&logo=tauri&logoColor=black" alt="Tauri 2 + Rust" />
  <img src="https://img.shields.io/badge/SQLite-WAL%20Offline-0F80CC?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite WAL" />
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/Licencia-MIT-10B981?style=for-the-badge" alt="Licencia MIT" />
  </a>
</p>

<p>
  <a href="#-descarga-e-instalación-windows">⬇️ Descargar EXE / Instalador</a> •
  <a href="#-funciones-principales">✨ Funciones</a> •
  <a href="#-recorrido-interactivo">🎨 Detalles</a> •
  <a href="#-privacidad-y-arquitectura">🔒 Arquitectura</a> •
  <a href="#-compilar-desde-el-código-fuente">🛠️ Compilar</a>
</p>

</div>

---

## ⬇️ Descarga e Instalación (Windows)

Elige el formato que prefieras en **[GitHub Releases](https://github.com/zeitgeist2004/Nook/releases/latest)**:

| Formato | Ideal para | Descarga Directa |
| :--- | :--- | :--- |
| **Instalador `.exe` (NSIS)** | Instalación estándar en Windows con accesos directos, asociación `.md`/`.txt` y actualizaciones automáticas *(Recomendado)* | [![Descargar Setup EXE](https://img.shields.io/badge/Descargar-Nook--1.0.0--Setup.exe-00C875?style=flat-square&logo=windows&logoColor=white)](https://github.com/zeitgeist2004/Nook/releases/latest) |
| **Instalador `.msi` (Windows Installer)** | Paquete MSI estándar para Windows x64 | [![Descargar MSI](https://img.shields.io/badge/Descargar-Nook--1.0.0--x64.msi-0078D6?style=flat-square&logo=windows&logoColor=white)](https://github.com/zeitgeist2004/Nook/releases/latest) |
| **Versión Portátil (`.zip`)** | Extraer y usar sin instalar (incluye `Nook.exe`, `WebView2Loader.dll` y `cloudflared.exe`) | [![Descargar ZIP](https://img.shields.io/badge/Descargar-Nook--Portatil--Completo.zip-6B7280?style=flat-square&logo=files&logoColor=white)](https://github.com/zeitgeist2004/Nook/releases/latest) |
| **Ejecutable Independiente (`.exe`)** | Ejecución directa de `Nook.exe` | [![Descargar EXE](https://img.shields.io/badge/Descargar-Nook.exe-18181B?style=flat-square&logo=windows&logoColor=white)](https://github.com/zeitgeist2004/Nook/releases/latest) |

---

## ✨ Funciones Principales

- **100% Offline y Local-First:** Sin cuentas, sin nube obligatoria y cero telemetría. Todo guardado en SQLite nativo (`WAL`).
- **Editor CodeMirror 6 + Lector Markdown:** Modos **Editar**, **Dividir** y **Lectura** en un clic.
- **Organización Fluida:** Proyectos, subcarpetas anidadas, **Notas Rápidas**, hasta 5 pestañas simultáneas, notas fijadas y reordenación arrastrando y soltando.
- **Auto-Save e Historial de Versiones:** Guardado automático en 350ms, recuperación de borradores y versiones anteriores restaurables.
- **Búsqueda Instantánea y Paleta de Comandos (`Ctrl + K`):** Búsqueda en tiempo real con SQLite **FTS5**.
- **Flujo Dev para Agentes de IA (Opcional):** Crea un **Context Pack** en 1 clic, guarda **Plantillas de Prompts**, **Session Handoff**, **Diario de Proyecto**, vincula carpetas locales y consulta `CLAUDE.md`, `AGENTS.md` y skills (`SKILL.md`).
- **Interfaz Multilingüe:** **English**, **Português (BR)** y **Español**.
- **Copias de Seguridad y Actualizaciones Automáticas:** Backups programados en `.json`, exportación completa en `.md` y actualizaciones firmadas por GitHub Releases.

---

## 🎨 Recorrido Interactivo

<details>
<summary><b>📝 1. Markdown Completo (Callouts, Wikilinks, Checklists y Frontmatter)</b></summary>
<br />

- **Callouts Formateados:** `> [!note]`, `> [!tip]`, `> [!warning]` e `> [!important]`.
- **Wikilinks:** `[[Nombre de Nota]]` o `[[Nota Destino|Texto]]` — haz clic en modo lectura para navegar o crear la nota al instante.
- **Checklists Interactivas:** Marca o desmarca `- [ ] Tarea` directamente en modo lectura actualizando el Markdown en vivo.
- **Frontmatter YAML y Etiquetas:** Metadatos al inicio (`---`) mostrados en tarjetas limpias + soporte para `#tags`.

</details>

<details>
<summary><b>🎨 2. Cinco Temas Visuales (Sincronizados entre Desktop, Web y Mobile)</b></summary>
<br />

| Tema | Estilo | Destaque |
| :--- | :--- | :--- |
| **Gris (`gray`)** | Minimalismo grafito equilibrado | Predeterminado cómodo para largas sesiones |
| **Oscuro (`dark`)** | Contraste profundo `#090A0D` | Enfoque nocturno sin fatiga visual |
| **Claro (`white`)** | Papel cálido editorial `#FAF9F6` | Lectura nítida de día |
| **Neon (`neon`)** | Terminal / Ciberseguridad | Fondo oscuro con circuitos PCB y retícula verde `#00FF9D` |
| **Sakura (`sakura`)** | Jardín japonés minimalista | Tonos oscuros suaves con ramas y flores `#E89EB8` |

</details>

<details>
<summary><b>📱 3. Nook Web, Nook Mobile y Nook Voice (Sincronización en Vivo)</b></summary>
<br />

- **Nook Web:** Accede a tu biblioteca en el navegador local (`127.0.0.1`) mediante el servidor Rust **Axum** integrado.
- **Nook Mobile:** Activa el túnel seguro **Cloudflare Quick Tunnel**, escanea el **código QR** desde tu teléfono y aprueba la conexión 2FA directamente en tu PC.
- **Nook Voice:** Dicta notas por voz en el navegador o celular con cola de recuperación sin conexión.

</details>

---

## 🔒 Privacidad y Arquitectura

- **Core Desktop:** Tauri 2 + Rust (Edition 2024)
- **Base de Datos:** SQLite local (`WAL` + `FTS5`)
- **Frontend:** React 18 + TypeScript + Vite
- **Editor y Vista Previa:** CodeMirror 6 + `marked` + `DOMPurify`

---

## 🛠️ Compilar desde el Código Fuente

```bash
npm install
npm test
npx tsc --noEmit
npm run tauri build
```

---

## ❤️ Apoyar a Nook

Nook es 100% gratuito y de código abierto. Si te ayuda en tu día a día, puedes apoyar el desarrollo en **[GitHub Sponsors](https://github.com/sponsors/zeitgeist2004)**.

<div align="center">
  <br />
  <img src="./assets/brand/mascot/nook-idle-open.png" alt="Mascota Nook" width="56" />
  <br />
  <sub>Creado por <a href="https://github.com/zeitgeist2004">zeitgeist2004</a> • <a href="./LICENSE">Licencia MIT</a></sub>
</div>
