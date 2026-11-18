use crate::commands::files::{decode_text_bytes, normalize_external_path};
use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const IGNORED_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".venv",
    "venv",
    "__pycache__",
    "obj",
    "bin",
    ".cache",
    "$recycle.bin",
    "system volume information",
];

const MAX_DOC_FILES: usize = 80;
const MAX_INSTRUCTION_FILES: usize = 80;
const MAX_SKILLS: usize = 150;
const MAX_SKILL_REFS: usize = 40;

#[derive(Debug, Clone, Serialize)]
pub struct ProjectDocFile {
    pub name: String,
    pub relative_path: String,
    pub full_path: String,
    pub size_bytes: u64,
    pub modified_ms: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct FolderInspectionResult {
    pub valid: bool,
    pub exists: bool,
    pub path: String,
    pub folder_name: String,
    pub doc_files: Vec<ProjectDocFile>,
    pub instruction_count: usize,
    pub skill_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct InstructionFileSummary {
    pub name: String,
    pub relative_path: String,
    pub full_path: String,
    pub agent_hint: String,
    pub modified_ms: i64,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct InstructionFileDetail {
    pub name: String,
    pub relative_path: String,
    pub full_path: String,
    pub content: String,
    pub content_hash: String,
    pub modified_ms: i64,
    pub agent_hint: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct WriteInstructionResult {
    pub saved: bool,
    pub conflict: bool,
    pub new_hash: String,
    pub modified_ms: i64,
    pub disk_content: Option<String>,
    pub disk_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkillReferenceFile {
    pub name: String,
    pub relative_path: String,
    pub full_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkillSummary {
    pub id: String,
    pub name: String,
    pub description: String,
    pub skill_dir: String,
    pub skill_md_path: String,
    pub source_root: String,
    pub reference_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkillDetail {
    pub name: String,
    pub description: String,
    pub skill_dir: String,
    pub skill_md_path: String,
    pub content: String,
    pub references: Vec<SkillReferenceFile>,
}

fn modified_ms_of(meta: &fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Deterministic dual-64bit content fingerprint (zero external crate dependencies).
fn compute_content_fingerprint(bytes: &[u8]) -> String {
    let mut h1: u64 = 0xcbf29ce484222325;
    let mut h2: u64 = 0x84222325cbf29ce4;
    for (i, &b) in bytes.iter().enumerate() {
        h1 ^= b as u64;
        h1 = h1.wrapping_mul(0x100000001b3);
        h2 ^= (b as u64).wrapping_add((i as u64).rotate_left(7));
        h2 = h2.wrapping_mul(0x9e3779b185ebca87);
    }
    format!("{:016x}:{:016x}:{}", h1, h2, bytes.len())
}

fn is_ignored_dir_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    IGNORED_DIRS.iter().any(|&ignored| lower == ignored)
}

fn is_doc_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|ext| matches!(ext.to_ascii_lowercase().as_str(), "md" | "markdown" | "txt"))
        .unwrap_or(false)
}

fn canonicalize_existing(raw: &str) -> Option<PathBuf> {
    let cleaned = normalize_external_path(raw);
    let p = PathBuf::from(cleaned);
    fs::canonicalize(p).ok()
}

fn is_path_within_roots(target: &Path, allowed_roots: &[String]) -> bool {
    if allowed_roots.is_empty() {
        return false;
    }
    let canon_target = match fs::canonicalize(target) {
        Ok(c) => c,
        Err(_) => return false,
    };
    for root in allowed_roots {
        if let Some(canon_root) = canonicalize_existing(root)
            && (canon_target == canon_root || canon_target.starts_with(&canon_root))
        {
            return true;
        }
    }
    false
}

fn collect_shallow_docs(
    dir: &Path,
    base: &Path,
    depth: usize,
    max_depth: usize,
    out: &mut Vec<ProjectDocFile>,
) {
    if out.len() >= MAX_DOC_FILES || depth > max_depth {
        return;
    }
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let mut dirs_to_visit = Vec::new();
    for entry in entries.flatten() {
        if out.len() >= MAX_DOC_FILES {
            break;
        }
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();
        if path.is_dir() {
            if depth < max_depth && !is_ignored_dir_name(&file_name) {
                let lower = file_name.to_ascii_lowercase();
                // Inspect only lightweight documentation folders or depth 0 subdirectories lightly
                if depth == 0 && matches!(lower.as_str(), "docs" | "doc" | "documentation" | ".github") {
                    dirs_to_visit.push(path);
                }
            }
        } else if path.is_file() && is_doc_extension(&path) {
            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            // Skip oversized files (> 2 MB) to keep Nook strictly light
            if meta.len() > 2 * 1024 * 1024 {
                continue;
            }
            let rel = path
                .strip_prefix(base)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            let full = normalize_external_path(&path.to_string_lossy());
            out.push(ProjectDocFile {
                name: file_name,
                relative_path: rel,
                full_path: full,
                size_bytes: meta.len(),
                modified_ms: modified_ms_of(&meta),
            });
        }
    }

    for sub in dirs_to_visit {
        collect_shallow_docs(&sub, base, depth + 1, max_depth, out);
    }
}

fn detect_agent_hint(file_name: &str, rel_path: &str) -> &'static str {
    let lower_name = file_name.to_ascii_lowercase();
    let lower_rel = rel_path.to_ascii_lowercase();
    if lower_name == "claude.md" || lower_rel.contains(".claude/") {
        "Claude Code"
    } else if lower_name == "agents.md" || lower_name == "codex.md" {
        "Codex / OpenCode / Agents"
    } else if lower_name == "opencode.md" || lower_rel.contains(".opencode/") {
        "OpenCode"
    } else if lower_name == "gemini.md" {
        "Gemini"
    } else if lower_name.contains("copilot") {
        "GitHub Copilot"
    } else if lower_name.contains("cursor") || lower_rel.contains(".cursor/") {
        "Cursor"
    } else if lower_name.contains("windsurf") || lower_rel.contains(".windsurf") {
        "Windsurf"
    } else {
        "Markdown / Agent Rules"
    }
}

fn push_instruction_if_exists(
    path: &Path,
    base_root: Option<&Path>,
    seen: &mut HashSet<String>,
    out: &mut Vec<InstructionFileSummary>,
) {
    if out.len() >= MAX_INSTRUCTION_FILES || !path.exists() || !path.is_file() {
        return;
    }
    let full = normalize_external_path(&path.to_string_lossy());
    let key = full.to_ascii_lowercase();
    if seen.contains(&key) {
        return;
    }
    let meta = match fs::metadata(path) {
        Ok(m) => m,
        Err(_) => return,
    };
    if meta.len() > 2 * 1024 * 1024 {
        return;
    }
    seen.insert(key);

    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("instructions.md")
        .to_string();
    let rel = base_root
        .and_then(|b| path.strip_prefix(b).ok())
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|| name.clone());

    let hint = detect_agent_hint(&name, &rel).to_string();
    out.push(InstructionFileSummary {
        name,
        relative_path: rel,
        full_path: full,
        agent_hint: hint,
        modified_ms: modified_ms_of(&meta),
        size_bytes: meta.len(),
    });
}

fn scan_instruction_dir(
    root: &Path,
    seen: &mut HashSet<String>,
    out: &mut Vec<InstructionFileSummary>,
) {
    if !root.exists() || !root.is_dir() {
        return;
    }
    let direct_candidates = [
        "AGENTS.md",
        "CLAUDE.md",
        "CODEX.md",
        "OPENCODE.md",
        "GEMINI.md",
        "COPILOT.md",
        ".cursorrules",
        ".windsurfrules",
        ".claude/CLAUDE.md",
        ".claude/AGENTS.md",
        ".github/copilot-instructions.md",
        ".agents/AGENTS.md",
        ".opencode/OPENCODE.md",
    ];

    for rel in direct_candidates {
        push_instruction_if_exists(&root.join(rel), Some(root), seen, out);
    }

    // Check shallow rule folders (.cursor/rules, .windsurf/rules, .claude/rules, .agents/rules)
    let rule_dirs = [
        ".cursor/rules",
        ".windsurf/rules",
        ".claude/rules",
        ".agents/rules",
        ".github/instructions",
    ];
    for rdir in rule_dirs {
        let dir_path = root.join(rdir);
        if dir_path.is_dir()
            && let Ok(entries) = fs::read_dir(&dir_path)
        {
            for entry in entries.flatten() {
                if out.len() >= MAX_INSTRUCTION_FILES {
                    break;
                }
                let p = entry.path();
                if p.is_file()
                    && let Some(ext) = p.extension().and_then(|e| e.to_str())
                    && matches!(ext.to_ascii_lowercase().as_str(), "md" | "mdc" | "txt" | "markdown")
                {
                    push_instruction_if_exists(&p, Some(root), seen, out);
                }
            }
        }
    }

    // Check immediate sub-packages (depth 1 non-ignored folders) for AGENTS.md / CLAUDE.md
    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            if out.len() >= MAX_INSTRUCTION_FILES {
                break;
            }
            let p = entry.path();
            if p.is_dir() {
                let dname = entry.file_name().to_string_lossy().to_string();
                if dname.starts_with('.') || is_ignored_dir_name(&dname) {
                    continue;
                }
                for sub_file in ["AGENTS.md", "CLAUDE.md", "GEMINI.md"] {
                    push_instruction_if_exists(&p.join(sub_file), Some(root), seen, out);
                }
            }
        }
    }
}

fn find_skill_md_in_dir(dir: &Path) -> Option<PathBuf> {
    let exact = dir.join("SKILL.md");
    if exact.is_file() {
        return Some(exact);
    }
    let lower = dir.join("skill.md");
    if lower.is_file() {
        return Some(lower);
    }
    None
}

fn clean_yaml_scalar(val: &str) -> String {
    let trimmed = val.trim();
    if trimmed.len() >= 2
        && ((trimmed.starts_with('"') && trimmed.ends_with('"'))
            || (trimmed.starts_with('\'') && trimmed.ends_with('\'')))
    {
        trimmed[1..trimmed.len() - 1].trim().to_string()
    } else {
        trimmed.to_string()
    }
}

fn parse_skill_frontmatter(content: &str, fallback_name: &str) -> (String, String) {
    let normalized = content.replace("\r\n", "\n");
    let mut lines = normalized.lines();
    let Some(first) = lines.next() else {
        return (fallback_name.to_string(), String::new());
    };
    if first.trim() != "---" {
        return (fallback_name.to_string(), String::new());
    }

    let mut name: Option<String> = None;
    let mut description: Option<String> = None;
    let mut current_key: Option<&str> = None;
    let mut desc_lines: Vec<String> = Vec::new();

    for line in lines {
        let trimmed = line.trim();
        if trimmed == "---" {
            break;
        }
        if let Some(rest) = line.strip_prefix("name:") {
            current_key = Some("name");
            let val = clean_yaml_scalar(rest);
            if !val.is_empty() {
                name = Some(val);
            }
        } else if let Some(rest) = line.strip_prefix("description:") {
            current_key = Some("description");
            let val = clean_yaml_scalar(rest);
            if val != "|" && val != ">" && !val.is_empty() {
                description = Some(val);
            }
        } else if line.starts_with(|c: char| !c.is_whitespace()) && line.contains(':') {
            current_key = None;
        } else if current_key == Some("description") && !trimmed.is_empty() {
            desc_lines.push(trimmed.to_string());
        }
    }

    let final_desc = match description {
        Some(d) if desc_lines.is_empty() => d,
        Some(d) => format!("{} {}", d, desc_lines.join(" ")),
        None => desc_lines.join(" "),
    };

    (
        name.unwrap_or_else(|| fallback_name.to_string()),
        final_desc.trim().to_string(),
    )
}

fn collect_skill_references(skill_dir: &Path) -> Vec<SkillReferenceFile> {
    let mut refs = Vec::new();
    let subdirs = ["references", "examples", "resources"];

    for sub in subdirs {
        let p = skill_dir.join(sub);
        if p.is_dir()
            && let Ok(entries) = fs::read_dir(&p)
        {
            for entry in entries.flatten() {
                if refs.len() >= MAX_SKILL_REFS {
                    break;
                }
                let fpath = entry.path();
                if fpath.is_file() && is_doc_extension(&fpath) {
                    let fname = entry.file_name().to_string_lossy().to_string();
                    refs.push(SkillReferenceFile {
                        name: fname.clone(),
                        relative_path: format!("{}/{}", sub, fname),
                        full_path: normalize_external_path(&fpath.to_string_lossy()),
                    });
                }
            }
        }
    }

    // Also include sibling .md docs inside skill root (excluding SKILL.md)
    if let Ok(entries) = fs::read_dir(skill_dir) {
        for entry in entries.flatten() {
            if refs.len() >= MAX_SKILL_REFS {
                break;
            }
            let fpath = entry.path();
            if fpath.is_file() && is_doc_extension(&fpath) {
                let fname = entry.file_name().to_string_lossy().to_string();
                if fname.eq_ignore_ascii_case("skill.md") {
                    continue;
                }
                refs.push(SkillReferenceFile {
                    name: fname.clone(),
                    relative_path: fname,
                    full_path: normalize_external_path(&fpath.to_string_lossy()),
                });
            }
        }
    }

    refs.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    refs
}

fn scan_skill_root(
    root: &Path,
    source_label: &str,
    depth: usize,
    max_depth: usize,
    seen_dirs: &mut HashSet<String>,
    out: &mut Vec<SkillSummary>,
) {
    if out.len() >= MAX_SKILLS || depth > max_depth || !root.exists() || !root.is_dir() {
        return;
    }

    if let Some(skill_md) = find_skill_md_in_dir(root) {
        let full_dir = normalize_external_path(&root.to_string_lossy());
        let key = full_dir.to_ascii_lowercase();
        if !seen_dirs.contains(&key) {
            seen_dirs.insert(key);
            if let Ok(bytes) = fs::read(&skill_md) {
                let content = decode_text_bytes(&bytes);
                let dir_name = root
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("skill");
                let (name, description) = parse_skill_frontmatter(&content, dir_name);
                let refs = collect_skill_references(root);
                out.push(SkillSummary {
                    id: full_dir.clone(),
                    name,
                    description,
                    skill_dir: full_dir,
                    skill_md_path: normalize_external_path(&skill_md.to_string_lossy()),
                    source_root: source_label.to_string(),
                    reference_count: refs.len(),
                });
            }
        }
        return;
    }

    if depth == max_depth {
        return;
    }

    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            if out.len() >= MAX_SKILLS {
                break;
            }
            let p = entry.path();
            if p.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                if is_ignored_dir_name(&name) {
                    continue;
                }
                scan_skill_root(&p, source_label, depth + 1, max_depth, seen_dirs, out);
            }
        }
    }
}

fn build_skill_roots(
    linked_folder: Option<&str>,
    authorized_folders: &[String],
) -> Vec<(PathBuf, String)> {
    let mut roots = Vec::new();
    let mut seen = HashSet::new();

    if let Some(linked) = linked_folder {
        let base = PathBuf::from(normalize_external_path(linked));
        if base.is_dir() {
            let candidates = [
                ".agents/skills",
                ".claude/skills",
                ".codex/skills",
                ".github/skills",
                ".opencode/skills",
                "skills",
            ];
            for rel in candidates {
                let candidate = base.join(rel);
                if candidate.is_dir() {
                    let norm = normalize_external_path(&candidate.to_string_lossy());
                    if seen.insert(norm.to_ascii_lowercase()) {
                        roots.push((candidate, norm));
                    }
                }
            }
        }
    }

    for raw in authorized_folders {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        let norm = normalize_external_path(trimmed);
        let p = PathBuf::from(&norm);
        if p.is_dir() && seen.insert(norm.to_ascii_lowercase()) {
            roots.push((p, norm));
        }
    }

    roots
}

// ----------------------------------------------------------------------------
// TAURI COMMANDS (Desktop-Only; zero Mobile/HTTP filesystem exposure)
// ----------------------------------------------------------------------------

#[tauri::command]
pub fn inspect_linked_folder(
    folder_path: String,
    extra_skill_roots: Option<Vec<String>>,
) -> FolderInspectionResult {
    let cleaned = normalize_external_path(&folder_path);
    let path = PathBuf::from(&cleaned);

    if cleaned.trim().is_empty() || !path.exists() || !path.is_dir() {
        let fallback_name = Path::new(&cleaned)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&cleaned)
            .to_string();
        return FolderInspectionResult {
            valid: false,
            exists: false,
            path: cleaned,
            folder_name: fallback_name,
            doc_files: Vec::new(),
            instruction_count: 0,
            skill_count: 0,
        };
    }

    let folder_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&cleaned)
        .to_string();

    let mut docs = Vec::new();
    collect_shallow_docs(&path, &path, 0, 1, &mut docs);
    docs.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));

    let mut seen_instr = HashSet::new();
    let mut instrs = Vec::new();
    scan_instruction_dir(&path, &mut seen_instr, &mut instrs);

    let extra = extra_skill_roots.unwrap_or_default();
    let skill_roots = build_skill_roots(Some(&cleaned), &extra);
    let mut seen_skills = HashSet::new();
    let mut skills = Vec::new();
    for (root, label) in skill_roots {
        scan_skill_root(&root, &label, 0, 3, &mut seen_skills, &mut skills);
    }

    FolderInspectionResult {
        valid: true,
        exists: true,
        path: cleaned,
        folder_name,
        doc_files: docs,
        instruction_count: instrs.len(),
        skill_count: skills.len(),
    }
}

#[tauri::command]
pub fn open_local_folder(folder_path: String) -> Result<(), String> {
    let cleaned = normalize_external_path(&folder_path);
    let canon = canonicalize_existing(&cleaned)
        .ok_or_else(|| format!("Folder not found: {}", folder_path))?;
    if !canon.is_dir() {
        return Err(format!("Path is not a directory: {}", folder_path));
    }

    #[cfg(target_os = "windows")]
    {
        let clean_str = normalize_external_path(&canon.to_string_lossy());
        std::process::Command::new("explorer.exe")
            .arg(clean_str)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&canon)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&canon)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn reveal_local_file(file_path: String, allowed_roots: Option<Vec<String>>) -> Result<(), String> {
    let cleaned = normalize_external_path(&file_path);
    let path = PathBuf::from(&cleaned);
    if !path.exists() || !path.is_file() {
        return Err(format!("File not found: {}", file_path));
    }

    if let Some(roots) = allowed_roots
        && !roots.is_empty()
        && !is_path_within_roots(&path, &roots)
    {
        return Err("Access denied outside authorized project folders.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg(format!("/select,{}", cleaned))
            .spawn()
            .map_err(|e| format!("Failed to open location: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &cleaned])
            .spawn()
            .map_err(|e| format!("Failed to open location: {}", e))?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if let Some(parent) = path.parent() {
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| format!("Failed to open location: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn list_project_instructions(
    linked_folder: Option<String>,
    custom_paths: Vec<String>,
) -> Vec<InstructionFileSummary> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();

    if let Some(folder) = linked_folder {
        let cleaned = normalize_external_path(&folder);
        scan_instruction_dir(Path::new(&cleaned), &mut seen, &mut out);
    }

    for custom in custom_paths {
        let cleaned = normalize_external_path(&custom);
        let p = Path::new(&cleaned);
        if p.is_file() {
            push_instruction_if_exists(p, p.parent(), &mut seen, &mut out);
        } else if p.is_dir() {
            scan_instruction_dir(p, &mut seen, &mut out);
        }
    }

    out.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    out
}

#[tauri::command]
pub fn read_project_instruction_file(
    file_path: String,
    allowed_roots: Vec<String>,
) -> Result<InstructionFileDetail, String> {
    let cleaned = normalize_external_path(&file_path);
    let path = PathBuf::from(&cleaned);
    if !path.exists() || !path.is_file() {
        return Err(format!("Instruction file not found: {}", file_path));
    }
    if !is_path_within_roots(&path, &allowed_roots) {
        return Err("Access denied outside authorized folders.".to_string());
    }

    let raw_bytes = fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    let hash = compute_content_fingerprint(&raw_bytes);
    let content = decode_text_bytes(&raw_bytes);
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("AGENTS.md")
        .to_string();

    Ok(InstructionFileDetail {
        agent_hint: detect_agent_hint(&name, &cleaned).to_string(),
        name,
        relative_path: cleaned.clone(),
        full_path: cleaned,
        content,
        content_hash: hash,
        modified_ms: modified_ms_of(&meta),
    })
}

#[tauri::command]
pub fn write_project_instruction_file(
    file_path: String,
    content: String,
    expected_hash: String,
    force_overwrite: bool,
    allowed_roots: Vec<String>,
) -> Result<WriteInstructionResult, String> {
    let cleaned = normalize_external_path(&file_path);
    let path = PathBuf::from(&cleaned);
    if !path.exists() || !path.is_file() {
        return Err(format!("Instruction file does not exist: {}", file_path));
    }
    if !is_path_within_roots(&path, &allowed_roots) {
        return Err("Access denied outside authorized folders.".to_string());
    }

    let current_bytes = fs::read(&path).map_err(|e| format!("Failed to verify disk file: {}", e))?;
    let current_hash = compute_content_fingerprint(&current_bytes);

    // Detect external edits cleanly and refuse silent overwrite unless explicitly confirmed
    if !force_overwrite && current_hash != expected_hash {
        let meta = fs::metadata(&path).ok();
        return Ok(WriteInstructionResult {
            saved: false,
            conflict: true,
            new_hash: current_hash.clone(),
            modified_ms: meta.as_ref().map(modified_ms_of).unwrap_or(0),
            disk_content: Some(decode_text_bytes(&current_bytes)),
            disk_hash: Some(current_hash),
        });
    }

    fs::write(&path, content.as_bytes()).map_err(|e| format!("Failed to write file: {}", e))?;
    let updated_bytes = content.as_bytes();
    let new_hash = compute_content_fingerprint(updated_bytes);
    let modified_ms = fs::metadata(&path).map(|m| modified_ms_of(&m)).unwrap_or(0);

    Ok(WriteInstructionResult {
        saved: true,
        conflict: false,
        new_hash,
        modified_ms,
        disk_content: None,
        disk_hash: None,
    })
}

#[tauri::command]
pub fn list_agent_skills(
    linked_folder: Option<String>,
    authorized_folders: Vec<String>,
) -> Vec<SkillSummary> {
    let roots = build_skill_roots(linked_folder.as_deref(), &authorized_folders);
    let mut seen_dirs = HashSet::new();
    let mut out = Vec::new();

    for (root, label) in roots {
        scan_skill_root(&root, &label, 0, 3, &mut seen_dirs, &mut out);
    }

    out.sort_by_key(|a| a.name.to_ascii_lowercase());
    out
}

#[tauri::command]
pub fn read_agent_skill_detail(
    skill_dir: String,
    allowed_roots: Vec<String>,
) -> Result<SkillDetail, String> {
    let cleaned_dir = normalize_external_path(&skill_dir);
    let dir_path = PathBuf::from(&cleaned_dir);
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err(format!("Skill folder not found: {}", skill_dir));
    }
    if !is_path_within_roots(&dir_path, &allowed_roots) {
        return Err("Access denied outside authorized skill folders.".to_string());
    }

    let skill_md = find_skill_md_in_dir(&dir_path)
        .ok_or_else(|| "SKILL.md not found in folder.".to_string())?;
    let raw = fs::read(&skill_md).map_err(|e| format!("Failed to read SKILL.md: {}", e))?;
    let content = decode_text_bytes(&raw);
    let fallback_name = dir_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("skill");
    let (name, description) = parse_skill_frontmatter(&content, fallback_name);
    let references = collect_skill_references(&dir_path);

    Ok(SkillDetail {
        name,
        description,
        skill_dir: cleaned_dir,
        skill_md_path: normalize_external_path(&skill_md.to_string_lossy()),
        content,
        references,
    })
}

#[tauri::command]
pub fn read_skill_reference_file(
    file_path: String,
    allowed_roots: Vec<String>,
) -> Result<String, String> {
    let cleaned = normalize_external_path(&file_path);
    let path = PathBuf::from(&cleaned);
    if !path.exists() || !path.is_file() {
        return Err(format!("Reference file not found: {}", file_path));
    }
    if !is_path_within_roots(&path, &allowed_roots) {
        return Err("Access denied outside authorized skill folders.".to_string());
    }
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > 2 * 1024 * 1024 {
        return Err("Reference file exceeds 2 MB limit.".to_string());
    }
    let bytes = fs::read(&path).map_err(|e| format!("Failed to read reference file: {}", e))?;
    Ok(decode_text_bytes(&bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_temp_workspace(prefix: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "nook_wf_test_{}_{}",
            prefix,
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&dir).expect("create temp test workspace");
        dir
    }

    #[test]
    fn test_linked_folder_inspection_and_missing_resilience() {
        let missing = std::env::temp_dir().join("nook_definitely_missing_folder_12345");
        let missing_res = inspect_linked_folder(missing.to_string_lossy().to_string(), None);
        assert!(!missing_res.valid);
        assert!(!missing_res.exists);

        let root = create_temp_workspace("inspect");
        fs::create_dir_all(root.join("docs")).unwrap();
        fs::create_dir_all(root.join("node_modules/fake-skill")).unwrap();
        fs::create_dir_all(root.join(".agents/skills/clean-skill/references")).unwrap();

        fs::write(root.join("README.md"), b"# Project").unwrap();
        fs::write(root.join("docs/architecture.md"), b"## Arch").unwrap();
        fs::write(root.join("AGENTS.md"), b"# Rules").unwrap();
        fs::write(root.join("CLAUDE.md"), b"# Claude").unwrap();
        fs::write(
            root.join("node_modules/fake-skill/SKILL.md"),
            b"---\nname: should-ignore\n---\n",
        )
        .unwrap();
        fs::write(
            root.join(".agents/skills/clean-skill/SKILL.md"),
            b"---\nname: clean-skill\ndescription: Helps keep things minimal\n---\n# Clean",
        )
        .unwrap();
        fs::write(
            root.join(".agents/skills/clean-skill/references/guide.md"),
            b"Guide content",
        )
        .unwrap();

        let res = inspect_linked_folder(root.to_string_lossy().to_string(), None);
        assert!(res.valid);
        assert!(res.exists);
        assert_eq!(res.doc_files.len(), 4); // README.md, docs/architecture.md, AGENTS.md, CLAUDE.md
        assert_eq!(res.instruction_count, 2);
        assert_eq!(res.skill_count, 1);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_instruction_conflict_detection_and_path_guard() {
        let root = create_temp_workspace("instr");
        let outside = create_temp_workspace("outside");
        let agents = root.join("AGENTS.md");
        let secret = outside.join("secret.md");

        fs::write(&agents, b"Initial instruction\n").unwrap();
        fs::write(&secret, b"Outside secret\n").unwrap();

        let allowed = vec![root.to_string_lossy().to_string()];

        // Path traversal / outside access must be rejected
        let denied = read_project_instruction_file(
            secret.to_string_lossy().to_string(),
            allowed.clone(),
        );
        assert!(denied.is_err());

        // Read AGENTS.md cleanly
        let detail = read_project_instruction_file(
            agents.to_string_lossy().to_string(),
            allowed.clone(),
        )
        .expect("read AGENTS.md");
        assert_eq!(detail.content, "Initial instruction\n");

        // Simulate external modification on disk
        fs::write(&agents, b"External tool modified this\n").unwrap();

        // Write with stale hash must detect conflict without overwriting!
        let conflict = write_project_instruction_file(
            agents.to_string_lossy().to_string(),
            "Nook buffer\n".to_string(),
            detail.content_hash.clone(),
            false,
            allowed.clone(),
        )
        .expect("write returns conflict struct");
        assert!(!conflict.saved);
        assert!(conflict.conflict);
        assert_eq!(
            conflict.disk_content.as_deref(),
            Some("External tool modified this\n")
        );
        assert_eq!(
            fs::read_to_string(&agents).unwrap(),
            "External tool modified this\n"
        );

        // Explicit force overwrite updates disk cleanly
        let forced = write_project_instruction_file(
            agents.to_string_lossy().to_string(),
            "Confirmed update\n".to_string(),
            detail.content_hash,
            true,
            allowed,
        )
        .expect("force write succeeds");
        assert!(forced.saved);
        assert!(!forced.conflict);
        assert_eq!(fs::read_to_string(&agents).unwrap(), "Confirmed update\n");

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
    }

    #[test]
    fn test_agent_skills_frontmatter_and_references() {
        let root = create_temp_workspace("skills");
        let auth_dir = root.join("my_skills");
        let skill_dir = auth_dir.join("ui-craft");
        fs::create_dir_all(skill_dir.join("references")).unwrap();
        fs::write(
            skill_dir.join("SKILL.md"),
            b"---\nname: \"ui-craft\"\ndescription: Minimal monochrome UI rules\n---\n\n# Craft",
        )
        .unwrap();
        fs::write(skill_dir.join("references/tokens.md"), b"Tokens reference").unwrap();

        let authorized = vec![auth_dir.to_string_lossy().to_string()];
        let list = list_agent_skills(None, authorized.clone());
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "ui-craft");
        assert_eq!(list[0].description, "Minimal monochrome UI rules");
        assert_eq!(list[0].reference_count, 1);

        let detail = read_agent_skill_detail(
            skill_dir.to_string_lossy().to_string(),
            authorized.clone(),
        )
        .expect("read skill detail");
        assert_eq!(detail.references.len(), 1);
        let ref_body = read_skill_reference_file(
            detail.references[0].full_path.clone(),
            authorized,
        )
        .expect("read reference file");
        assert_eq!(ref_body, "Tokens reference");

        let _ = fs::remove_dir_all(&root);
    }
}
