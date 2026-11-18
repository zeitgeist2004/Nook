import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderGit2,
  FolderOpen,
  Copy,
  Check,
  Link2Off,
  FileText,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  FileCode2,
  BookMarked,
} from 'lucide-react';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import {
  Collection,
  DevWorkflowToolId,
  FolderInspectionResult,
  ProjectDevConfig,
} from '../../types';
import { api, isTauri } from '../../services/api';
import { useTranslation } from '../../i18n';

interface ProjectLinkingPanelProps {
  project: Collection | null;
  config: ProjectDevConfig;
  onUpdateConfig: (updater: (prev: ProjectDevConfig) => ProjectDevConfig) => void;
  onSwitchTool: (tool: DevWorkflowToolId) => void;
  onOpenExternalDoc: (filePath: string) => void;
  onCloseModal: () => void;
}

export const ProjectLinkingPanel: React.FC<ProjectLinkingPanelProps> = ({
  project,
  config,
  onUpdateConfig,
  onSwitchTool,
  onOpenExternalDoc,
  onCloseModal,
}) => {
  const { t, format } = useTranslation();
  const [inspection, setInspection] = useState<FolderInspectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  const linkedPath = config.linkedFolderPath || null;

  const refreshInspection = useCallback(async () => {
    if (!linkedPath || !isTauri()) {
      setInspection(null);
      return;
    }
    setLoading(true);
    try {
      const res = await api.inspectLinkedFolder(linkedPath, config.skillFolderPaths);
      setInspection(res);
    } catch {
      setInspection(null);
    } finally {
      setLoading(false);
    }
  }, [linkedPath, config.skillFolderPaths]);

  useEffect(() => {
    refreshInspection();
  }, [refreshInspection]);

  if (!isTauri()) {
    return (
      <div className="nook-empty-box">
        <FolderGit2 size={24} style={{ color: 'var(--text-muted)' }} />
        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {t.projectTools.toolLinking}
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.5 }}>
          {t.projectTools.desktopOnlyNotice}
        </div>
      </div>
    );
  }

  const handleChooseFolder = async () => {
    try {
      const selected = await openFileDialog({
        directory: true,
        multiple: false,
        title: t.projectTools.linkingChooseFolderBtn,
      });
      if (!selected || typeof selected !== 'string') return;
      onUpdateConfig((prev) => ({
        ...prev,
        enabled: true,
        linkedFolderPath: selected,
      }));
    } catch (err) {
      console.warn('Folder dialog canceled or failed:', err);
    }
  };

  const handleUnlink = () => {
    if (!window.confirm(t.projectTools.linkingUnlinkConfirm)) return;
    onUpdateConfig((prev) => ({
      ...prev,
      linkedFolderPath: undefined,
    }));
    setInspection(null);
  };

  const handleCopyPath = async () => {
    if (!linkedPath) return;
    await navigator.clipboard.writeText(linkedPath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 1600);
  };

  if (!linkedPath) {
    return (
      <div className="nook-empty-box">
        <FolderGit2 size={26} style={{ color: 'var(--text-muted)' }} />
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {t.projectTools.linkingNoFolderTitle}
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '400px', lineHeight: 1.5 }}>
          {t.projectTools.linkingNoFolderDesc}
        </div>
        {project && (
          <button type="button" onClick={handleChooseFolder} className="nook-btn-primary" style={{ marginTop: '6px' }}>
            <FolderGit2 size={14} />
            <span>{t.projectTools.linkingChooseFolderBtn}</span>
          </button>
        )}
      </div>
    );
  }

  const folderExists = inspection ? inspection.exists : true;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
      {/* Linked Folder Card */}
      <div
        style={{
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-main)',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <FolderGit2 size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: folderExists ? 'var(--accent-muted)' : 'var(--danger-muted)',
                color: folderExists ? 'var(--accent)' : 'var(--danger)',
              }}
            >
              {folderExists
                ? t.projectTools.linkingFolderConnected
                : t.projectTools.linkingFolderMissing}
            </span>
          </div>

          {inspection && folderExists && (
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              {format(t.projectTools.linkingSummaryCounts, {
                docs: inspection.doc_files.length,
                instructions: inspection.instruction_count,
                skills: inspection.skill_count,
              })}
            </span>
          )}
        </div>

        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11.5px',
            color: 'var(--text-secondary)',
            wordBreak: 'break-all',
            padding: '7px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {linkedPath}
        </div>

        {!folderExists && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <AlertCircle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />
            <span>{t.projectTools.linkingFolderMissing}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {folderExists && (
            <button
              type="button"
              onClick={() => api.openLocalFolder(linkedPath)}
              className="nook-btn-primary"
            >
              <FolderOpen size={14} />
              <span>{t.projectTools.linkingOpenFolderBtn}</span>
            </button>
          )}

          <button type="button" onClick={handleCopyPath} className="nook-btn-secondary">
            {copiedPath ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedPath ? t.common.copiedExclamation : t.projectTools.linkingCopyPathBtn}</span>
          </button>

          <button type="button" onClick={handleChooseFolder} className="nook-btn-secondary">
            <FolderGit2 size={14} />
            <span>{t.projectTools.linkingChangeFolderBtn}</span>
          </button>

          <button type="button" onClick={refreshInspection} className="nook-icon-btn" title={t.common.refresh}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <div style={{ flex: 1 }} />

          <button
            type="button"
            onClick={handleUnlink}
            className="nook-btn-secondary"
            style={{ color: 'var(--danger)' }}
          >
            <Link2Off size={14} />
            <span>{t.projectTools.linkingUnlinkBtn}</span>
          </button>
        </div>
      </div>

      {/* Shortcuts to Instructions & Skills */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => onSwitchTool('instructions')}
          className="nook-btn-secondary"
        >
          <FileCode2 size={14} />
          <span>{t.projectTools.linkingQuickInstructions}</span>
        </button>

        <button
          type="button"
          onClick={() => onSwitchTool('skills')}
          className="nook-btn-secondary"
        >
          <BookMarked size={14} />
          <span>{t.projectTools.linkingQuickSkills}</span>
        </button>
      </div>

      {/* Compatible Docs */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-main)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
          }}
        >
          {t.projectTools.linkingDocsTitle}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
          {!inspection || inspection.doc_files.length === 0 ? (
            <div style={{ padding: '18px 12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
              {t.projectTools.linkingDocsEmpty}
            </div>
          ) : (
            inspection.doc_files.map((doc) => (
              <div
                key={doc.full_path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <FileText size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '12.5px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {doc.relative_path}
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      {(doc.size_bytes / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onCloseModal();
                    onOpenExternalDoc(doc.full_path);
                  }}
                  className="nook-tool-chip"
                >
                  <ExternalLink size={12} />
                  <span>{t.projectTools.linkingOpenDocBtn}</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
