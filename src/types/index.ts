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

export interface AppSettings {
  theme: ThemeId;
  accentColor?: string;
  editorFont: string;
  editorFontSize: number;
  lineWrapping: boolean;
  showLineNumbers: boolean;
  lineHeight: number;
  restoreLastNote: boolean;
  confirmPermanentDelete: boolean;
  lastOpenedNoteId: string | null;
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

