export type CollectionType = 'project' | 'folder';

export interface Collection {
  id: string;
  name: string;
  collection_type: CollectionType;
  parent_id: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface Note {
  id: string;
  collection_id: string | null;
  title: string;
  content: string;
  is_pinned: boolean;
  sort_order: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface NoteSummary {
  id: string;
  collection_id: string | null;
  title: string;
  snippet: string;
  is_pinned: boolean;
  sort_order: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface SearchResultItem {
  id: string;
  item_type: 'note' | 'collection';
  title: string;
  snippet?: string | null;
  collection_id?: string | null;
  collection_name?: string | null;
  updated_at: number;
}

export type ThemeId = 'gray' | 'dark' | 'white' | 'neon' | 'sakura' | 'pink';

export type AppLanguage = 'pt' | 'en' | 'es';

export type ReadingWidth = 'comfortable' | 'wide' | 'full';
export type ParagraphSpacing = 'compact' | 'comfortable' | 'airy';
export type BackgroundDecorationsMode = 'subtle' | 'off';
export type BackupFrequency = '12h' | 'daily' | 'weekly';
export type BackupRetentionDays = 7 | 14 | 30;

export interface AppSettings {
  theme: ThemeId;
  language: AppLanguage;
  accentColor?: string;
  editorFont: string;
  editorFontSize: number;
  lineWrapping: boolean;
  showLineNumbers: boolean;
  lineHeight: number;
  readingWidth?: ReadingWidth;
  paragraphSpacing?: ParagraphSpacing;
  backgroundDecorations?: BackgroundDecorationsMode;
  restoreLastNote: boolean;
  confirmPermanentDelete: boolean;
  lastOpenedNoteId: string | null;
  developerWorkflowEnabled?: boolean;
  autoBackupEnabled?: boolean;
  backupFrequency?: BackupFrequency;
  backupRetentionDays?: BackupRetentionDays;
  autoUpdateCheck?: boolean;
}

// ----------------------------------------------------------------------------
// DEVELOPER WORKFLOW TYPES (Local-first, zero external AI)
// ----------------------------------------------------------------------------
export type DevWorkflowToolId =
  | 'context-pack'
  | 'handoff'
  | 'prompts'
  | 'journal'
  | 'project-linking'
  | 'instructions'
  | 'skills';

export type NoteWorkflowRole = 'prompt' | 'handoff' | 'journal';

export interface NoteWorkflowMeta {
  role?: NoteWorkflowRole;
  isFavorite?: boolean;
  updatedAt?: number;
}

export type DevNotesMetaMap = Record<string, NoteWorkflowMeta>;

export interface ProjectDevConfig {
  enabled?: boolean;
  linkedFolderPath?: string;
  customInstructionPaths?: string[];
  skillFolderPaths?: string[];
}

export type DevProjectsConfigMap = Record<string, ProjectDevConfig>;

export interface ProjectDocFile {
  name: string;
  relative_path: string;
  full_path: string;
  size_bytes: number;
  modified_ms: number;
}

export interface FolderInspectionResult {
  valid: boolean;
  exists: boolean;
  path: string;
  folder_name: string;
  doc_files: ProjectDocFile[];
  instruction_count: number;
  skill_count: number;
}

export interface InstructionFileSummary {
  name: string;
  relative_path: string;
  full_path: string;
  agent_hint: string;
  modified_ms: number;
  size_bytes: number;
}

export interface InstructionFileDetail {
  name: string;
  relative_path: string;
  full_path: string;
  content: string;
  content_hash: string;
  modified_ms: number;
  agent_hint: string;
}

export interface WriteInstructionResult {
  saved: boolean;
  conflict: boolean;
  new_hash: string;
  modified_ms: number;
  disk_content?: string | null;
  disk_hash?: string | null;
}

export interface SkillReferenceFile {
  name: string;
  relative_path: string;
  full_path: string;
}

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  skill_dir: string;
  skill_md_path: string;
  source_root: string;
  reference_count: number;
}

export interface SkillDetail {
  name: string;
  description: string;
  skill_dir: string;
  skill_md_path: string;
  content: string;
  references: SkillReferenceFile[];
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export type TabType = 'note' | 'external';

export interface TabItem {
  id: string; // note ID or external file path
  type: TabType;
  title: string;
  externalPath?: string;
  isPinned?: boolean;
}

export interface ExternalFile {
  path: string;
  filename: string;
  isModified: boolean;
}

export interface NoteVersion {
  id: string;
  note_id: string;
  title: string;
  content: string;
  created_at: number;
}

export interface AutoBackupInfo {
  filename: string;
  path: string;
  size_bytes: number;
  created_at: number;
  is_auto?: boolean;
}

export interface AutoBackupSummary {
  enabled: boolean;
  frequency: BackupFrequency | string;
  retention_days: number;
  count: number;
  total_size_bytes: number;
  last_backup_at: number | null;
  next_backup_at: number | null;
  backups: AutoBackupInfo[];
}

export interface DeleteBackupsResult {
  deleted_count: number;
  freed_bytes: number;
}

export interface CacheStats {
  cache_size_bytes: number;
  cache_file_count: number;
  cache_dir_path: string;
  webview_requires_restart: boolean;
}

export interface ClearCacheResult {
  deleted_files: number;
  freed_bytes: number;
  webview_requires_restart: boolean;
}

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  type: 'note' | 'collection' | 'root';
  targetId?: string;
  targetItem?: NoteSummary | Collection;
}

// ----------------------------------------------------------------------------
// NOOK MOBILE & REMOTE TUNNEL TYPES
// ----------------------------------------------------------------------------
export interface AuthorizedDevice {
  id: string;
  name: string;
  user_agent: string;
  token_hash?: string;
  ip_hint?: string | null;
  created_at: number;
  last_active_at: number;
  is_revoked: boolean;
}

export interface MobileAccessInfo {
  active: boolean;
  connecting: boolean;
  url: string | null;
  pair_code: string | null;
  qr_payload: string | null;
  error: string | null;
  authorized_devices: AuthorizedDevice[];
}

export interface PendingPairRequest {
  request_id: string;
  pair_code: string;
  device_name: string;
  user_agent: string;
  requested_at: number;
}

// ----------------------------------------------------------------------------
// VOLUNTARY SUPPORT / GITHUB SPONSORS PREFERENCES
// ----------------------------------------------------------------------------
export interface SupportPreferences {
  firstUsedAt: number;
  activeUsageMs: number;
  invitesShownCount: number;
  lastInviteShownAt: number | null;
  neverShowAgain: boolean;
  showInvitesSetting: boolean;
  completedActionsCount: number;
}

