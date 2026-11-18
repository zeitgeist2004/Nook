import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileCode2,
  FolderPlus,
  FilePlus,
  ExternalLink,
  RefreshCw,
  Save,
  Eye,
  Edit3,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import {
  InstructionFileDetail,
  InstructionFileSummary,
  ProjectDevConfig,
} from '../../types';
import { api, isTauri } from '../../services/api';
import { useTranslation } from '../../i18n';
import { MarkdownViewer } from '../editor/MarkdownViewer';

interface AgentInstructionsPanelProps {
  config: ProjectDevConfig;
  onUpdateConfig: (updater: (prev: ProjectDevConfig) => ProjectDevConfig) => void;
  isMobile?: boolean;
}

export const AgentInstructionsPanel: React.FC<AgentInstructionsPanelProps> = ({
  config,
  onUpdateConfig,
  isMobile = false,
}) => {
  const { t, format } = useTranslation();
  const [files, setFiles] = useState<InstructionFileSummary[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [detail, setDetail] = useState<InstructionFileDetail | null>(null);
  const [draft, setDraft] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [conflictState, setConflictState] = useState<{
    diskContent: string;
    diskHash: string;
  } | null>(null);
  const [copiedMine, setCopiedMine] = useState(false);

  const allowedRoots = useMemo(() => {
    const roots: string[] = [];
    if (config.linkedFolderPath) roots.push(config.linkedFolderPath);
    if (config.customInstructionPaths) roots.push(...config.customInstructionPaths);
    return roots;
  }, [config.linkedFolderPath, config.customInstructionPaths]);

  const loadFiles = useCallback(async () => {
    if (!isTauri()) return;
    setLoadingList(true);
    try {
      const list = await api.listProjectInstructions(
        config.linkedFolderPath ?? null,
        config.customInstructionPaths ?? []
      );
      setFiles(list);
      if (list.length > 0 && (!selectedPath || !list.some((f) => f.full_path === selectedPath))) {
        setSelectedPath(list[0].full_path);
      } else if (list.length === 0) {
        setSelectedPath(null);
        setDetail(null);
        setDraft('');
      }
    } finally {
      setLoadingList(false);
    }
  }, [config.linkedFolderPath, config.customInstructionPaths, selectedPath]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const loadFileDetail = useCallback(
    async (filePath: string) => {
      if (!isTauri()) return;
      setLoadingFile(true);
      setConflictState(null);
      setStatusMessage(null);
      try {
        const res = await api.readProjectInstructionFile(filePath, allowedRoots);
        setDetail(res);
        setDraft(res.content);
      } catch (err) {
        console.error('Failed to read instruction file:', err);
      } finally {
        setLoadingFile(false);
      }
    },
    [allowedRoots]
  );

  useEffect(() => {
    if (selectedPath) {
      loadFileDetail(selectedPath);
    }
  }, [selectedPath, loadFileDetail]);

  if (!isTauri()) {
    return (
      <div className="nook-empty-box">
        <FileCode2 size={24} style={{ color: 'var(--text-muted)' }} />
        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {t.projectTools.toolInstructions}
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.5 }}>
          {t.projectTools.desktopOnlyNotice}
        </div>
      </div>
    );
  }

  const handleAddFolder = async () => {
    const selected = await openFileDialog({ directory: true, multiple: false });
    if (!selected || typeof selected !== 'string') return;
    onUpdateConfig((prev) => {
      const existing = prev.customInstructionPaths ?? [];
      if (existing.includes(selected)) return prev;
      return { ...prev, customInstructionPaths: [...existing, selected] };
    });
  };

  const handleAddFile = async () => {
    const selected = await openFileDialog({
      multiple: false,
      filters: [{ name: t.dialogs.markdownFilterName, extensions: ['md', 'mdc', 'txt', 'markdown'] }],
    });
    if (!selected || typeof selected !== 'string') return;
    onUpdateConfig((prev) => {
      const existing = prev.customInstructionPaths ?? [];
      if (existing.includes(selected)) return prev;
      return { ...prev, customInstructionPaths: [...existing, selected] };
    });
    setSelectedPath(selected);
  };

  const isDirty = detail !== null && draft !== detail.content;

  const handleSave = async (forceOverwrite = false) => {
    if (!detail) return;
    if (!forceOverwrite) {
      const confirmed = window.confirm(
        format(t.projectTools.instructionsConfirmSave, { path: detail.full_path })
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setStatusMessage(null);
    try {
      const result = await api.writeProjectInstructionFile(
        detail.full_path,
        draft,
        detail.content_hash,
        forceOverwrite,
        allowedRoots
      );
      if (result.conflict && result.disk_content !== undefined && result.disk_content !== null) {
        setConflictState({
          diskContent: result.disk_content,
          diskHash: result.disk_hash || result.new_hash,
        });
        return;
      }
      if (result.saved) {
        setConflictState(null);
        setDetail({
          ...detail,
          content: draft,
          content_hash: result.new_hash,
          modified_ms: result.modified_ms,
        });
        setStatusMessage(t.projectTools.instructionsSavedToast);
        setTimeout(() => setStatusMessage(null), 2200);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
      {/* Top Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button type="button" onClick={handleAddFile} className="nook-btn-secondary">
            <FilePlus size={14} />
            <span>{t.projectTools.instructionsAddFileBtn}</span>
          </button>
          <button type="button" onClick={handleAddFolder} className="nook-btn-secondary">
            <FolderPlus size={14} />
            <span>{t.projectTools.instructionsAddLocationBtn}</span>
          </button>
        </div>

        <button type="button" onClick={loadFiles} className="nook-icon-btn" title={t.common.refresh}>
          <RefreshCw size={14} className={loadingList ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Main Content */}
      {allowedRoots.length === 0 ? (
        <div className="nook-empty-box">
          <FileCode2 size={24} style={{ color: 'var(--text-muted)' }} />
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {t.projectTools.instructionsLinkFirstTitle}
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.5 }}>
            {t.projectTools.instructionsLinkFirstDesc}
          </div>
        </div>
      ) : files.length === 0 ? (
        <div className="nook-empty-box">
          <FileCode2 size={24} style={{ color: 'var(--text-muted)' }} />
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {t.projectTools.instructionsEmptyTitle}
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.5 }}>
            {t.projectTools.instructionsEmptyDesc}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'minmax(190px, 0.72fr) minmax(280px, 1.45fr)',
            gap: '10px',
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* File list */}
          <div
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-main)',
              overflowY: 'auto',
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              maxHeight: isMobile ? '150px' : '100%',
            }}
          >
            {files.map((f) => {
              const isSelected = selectedPath === f.full_path;
              return (
                <button
                  key={f.full_path}
                  type="button"
                  onClick={() => setSelectedPath(f.full_path)}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--bg-selected)' : 'transparent',
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  <div style={{ fontSize: '12.5px', fontWeight: 600 }}>{f.name}</div>
                  <div
                    style={{
                      fontSize: '10.5px',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: '2px',
                    }}
                  >
                    {f.agent_hint} · {f.relative_path}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Instruction Editor & Viewer */}
          <div
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-main)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {loadingFile || !detail ? (
              <div style={{ padding: '16px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                {t.common.loading}
              </div>
            ) : (
              <>
                {/* File header */}
                <div
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {detail.name}
                      </span>
                      <span
                        style={{
                          fontSize: '10.5px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {detail.agent_hint}
                      </span>
                      {isDirty && (
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 600,
                            padding: '1px 7px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--accent-muted)',
                            color: 'var(--accent)',
                          }}
                        >
                          {t.projectTools.instructionsUnsavedBadge}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10.5px',
                        color: 'var(--text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginTop: '2px',
                      }}
                    >
                      {detail.full_path}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setViewMode('preview')}
                      className={`nook-tool-chip ${viewMode === 'preview' ? 'active' : ''}`}
                    >
                      <Eye size={12} />
                      <span>{t.editor.read}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('edit')}
                      className={`nook-tool-chip ${viewMode === 'edit' ? 'active' : ''}`}
                    >
                      <Edit3 size={12} />
                      <span>{t.editor.edit}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => api.revealLocalFile(detail.full_path, allowedRoots)}
                      className="nook-icon-btn"
                      title={t.projectTools.instructionsRevealBtn}
                    >
                      <ExternalLink size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => loadFileDetail(detail.full_path)}
                      className="nook-icon-btn"
                      title={t.projectTools.instructionsReloadBtn}
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>

                {/* External Modification Conflict Warning */}
                {conflictState && (
                  <div
                    style={{
                      padding: '10px 12px',
                      backgroundColor: 'var(--danger-muted)',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--danger)' }}>
                      <AlertTriangle size={14} />
                      <span>{t.projectTools.instructionsConflictTitle}</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {t.projectTools.instructionsConflictDesc}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setDraft(conflictState.diskContent);
                          setDetail({
                            ...detail,
                            content: conflictState.diskContent,
                            content_hash: conflictState.diskHash,
                          });
                          setConflictState(null);
                        }}
                        className="nook-btn-secondary"
                      >
                        {t.projectTools.instructionsConflictReloadBtn}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(draft);
                          setCopiedMine(true);
                          setTimeout(() => setCopiedMine(false), 1600);
                        }}
                        className="nook-btn-secondary"
                      >
                        {copiedMine ? <Check size={13} /> : <Copy size={13} />}
                        <span>{t.projectTools.instructionsConflictCopyMineBtn}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSave(true)}
                        className="nook-btn-primary"
                      >
                        {t.projectTools.instructionsConflictForceBtn}
                      </button>
                    </div>
                  </div>
                )}

                {/* Content body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: viewMode === 'edit' ? '0' : '12px 14px' }}>
                  {viewMode === 'edit' ? (
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      spellCheck={false}
                      style={{
                        width: '100%',
                        height: '100%',
                        minHeight: '220px',
                        padding: '12px 14px',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12.5px',
                        lineHeight: 1.55,
                        boxSizing: 'border-box',
                      }}
                    />
                  ) : (
                    <MarkdownViewer
                      content={draft}
                      onContentChange={() => {}}
                      fontSize={13.5}
                    />
                  )}
                </div>

                {/* Save Footer */}
                <div
                  style={{
                    padding: '8px 12px',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '11.5px', color: statusMessage ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {statusMessage || detail.agent_hint}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={!isDirty || saving}
                    className="nook-btn-primary"
                  >
                    <Save size={14} />
                    <span>{t.projectTools.instructionsSaveBtn}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
