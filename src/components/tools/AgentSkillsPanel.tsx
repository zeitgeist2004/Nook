import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookMarked,
  FolderPlus,
  Search,
  Copy,
  Check,
  FolderOpen,
  RefreshCw,
  X,
  FileText,
  ArrowLeft,
  Shield,
} from 'lucide-react';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { ProjectDevConfig, SkillDetail, SkillSummary } from '../../types';
import { api, isTauri } from '../../services/api';
import { useTranslation } from '../../i18n';
import { MarkdownViewer } from '../editor/MarkdownViewer';

interface AgentSkillsPanelProps {
  config: ProjectDevConfig;
  onUpdateConfig: (updater: (prev: ProjectDevConfig) => ProjectDevConfig) => void;
  isMobile?: boolean;
}

export const AgentSkillsPanel: React.FC<AgentSkillsPanelProps> = ({
  config,
  onUpdateConfig,
  isMobile = false,
}) => {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDir, setSelectedDir] = useState<string | null>(null);
  const [skillDetail, setSkillDetail] = useState<SkillDetail | null>(null);
  const [activeRef, setActiveRef] = useState<{ name: string; content: string } | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [copied, setCopied] = useState(false);

  const authorizedFolders = config.skillFolderPaths ?? [];
  const allowedRoots = useMemo(() => {
    const roots: string[] = [];
    if (config.linkedFolderPath) roots.push(config.linkedFolderPath);
    roots.push(...authorizedFolders);
    return roots;
  }, [config.linkedFolderPath, authorizedFolders]);

  const loadSkills = useCallback(async () => {
    if (!isTauri()) return;
    setLoadingList(true);
    try {
      const list = await api.listAgentSkills(
        config.linkedFolderPath ?? null,
        authorizedFolders
      );
      setSkills(list);
      if (list.length > 0 && (!selectedDir || !list.some((s) => s.skill_dir === selectedDir))) {
        setSelectedDir(list[0].skill_dir);
      } else if (list.length === 0) {
        setSelectedDir(null);
        setSkillDetail(null);
      }
    } finally {
      setLoadingList(false);
    }
  }, [config.linkedFolderPath, authorizedFolders, selectedDir]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  useEffect(() => {
    if (!selectedDir || !isTauri()) {
      setSkillDetail(null);
      setActiveRef(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    setActiveRef(null);
    api
      .readAgentSkillDetail(selectedDir, allowedRoots)
      .then((res) => {
        if (!cancelled) setSkillDetail(res);
      })
      .catch((err) => {
        console.error('Failed to read skill detail:', err);
        if (!cancelled) setSkillDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDir, allowedRoots]);

  if (!isTauri()) {
    return (
      <div className="nook-empty-box">
        <BookMarked size={24} style={{ color: 'var(--text-muted)' }} />
        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {t.projectTools.toolSkills}
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.5 }}>
          {t.projectTools.desktopOnlyNotice}
        </div>
      </div>
    );
  }

  const handleAuthorizeFolder = async () => {
    const selected = await openFileDialog({ directory: true, multiple: false });
    if (!selected || typeof selected !== 'string') return;
    onUpdateConfig((prev) => {
      const curr = prev.skillFolderPaths ?? [];
      if (curr.includes(selected)) return prev;
      return { ...prev, skillFolderPaths: [...curr, selected] };
    });
  };

  const handleRemoveFolder = (folder: string) => {
    onUpdateConfig((prev) => ({
      ...prev,
      skillFolderPaths: (prev.skillFolderPaths ?? []).filter((f) => f !== folder),
    }));
  };

  const filteredSkills = skills.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.skill_dir.toLowerCase().includes(q)
    );
  });

  const handleCopySkill = async () => {
    if (!skillDetail) return;
    const text = activeRef ? activeRef.content : skillDetail.content;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleOpenReference = async (refPath: string, refName: string) => {
    try {
      const content = await api.readSkillReferenceFile(refPath, allowedRoots);
      setActiveRef({ name: refName, content });
    } catch (err) {
      console.error('Failed to read skill reference:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
      {/* Top Toolbar & Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.projectTools.skillsSearchPlaceholder}
            className="nook-input"
            style={{ paddingLeft: '30px', width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button type="button" onClick={handleAuthorizeFolder} className="nook-btn-secondary">
            <FolderPlus size={14} />
            <span>{t.projectTools.skillsAddFolderBtn}</span>
          </button>
          <button type="button" onClick={loadSkills} className="nook-icon-btn" title={t.common.refresh}>
            <RefreshCw size={14} className={loadingList ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Authorized Folder Pills */}
      {authorizedFolders.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {t.projectTools.skillsAuthorizedTitle}:
          </span>
          {authorizedFolders.map((folder) => (
            <span
              key={folder}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 7px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
              }}
            >
              <span>{folder}</span>
              <button
                type="button"
                onClick={() => handleRemoveFolder(folder)}
                aria-label={t.projectTools.skillsRemoveFolderAria}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'inline-flex',
                }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Main Content */}
      {allowedRoots.length === 0 ? (
        <div className="nook-empty-box">
          <BookMarked size={24} style={{ color: 'var(--text-muted)' }} />
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {t.projectTools.toolSkills}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.5 }}>
            {t.projectTools.skillsEmptySources}
          </div>
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="nook-empty-box">
          <BookMarked size={24} style={{ color: 'var(--text-muted)' }} />
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.5 }}>
            {t.projectTools.skillsEmptyFound}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'minmax(195px, 0.78fr) minmax(280px, 1.42fr)',
            gap: '10px',
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Skill Cards List */}
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
              maxHeight: isMobile ? '160px' : '100%',
            }}
          >
            {filteredSkills.map((skill) => {
              const isSelected = selectedDir === skill.skill_dir;
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => setSelectedDir(skill.skill_dir)}
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
                  <div style={{ fontSize: '12.5px', fontWeight: 600 }}>{skill.name}</div>
                  {skill.description && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {skill.description}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Detail Viewer */}
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
            {loadingDetail || !skillDetail ? (
              <div style={{ padding: '16px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                {t.common.loading}
              </div>
            ) : (
              <>
                <div
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {skillDetail.name}
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
                      {skillDetail.skill_dir}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <button type="button" onClick={handleCopySkill} className="nook-btn-primary" style={{ padding: '5px 10px', fontSize: '12px' }}>
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copied ? t.common.copiedExclamation : t.projectTools.skillsCopyInstructionsBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => api.openLocalFolder(skillDetail.skill_dir)}
                      className="nook-btn-secondary"
                      style={{ padding: '5px 9px', fontSize: '12px' }}
                    >
                      <FolderOpen size={13} />
                      <span>{t.projectTools.skillsOpenFolderBtn}</span>
                    </button>
                  </div>
                </div>

                {/* Read-only notice + optional sibling reference bar */}
                <div
                  style={{
                    padding: '6px 12px',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    flexWrap: 'wrap',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Shield size={12} />
                    <span>{t.projectTools.skillsReadOnlyNotice}</span>
                  </span>
                </div>

                {skillDetail.references.length > 0 && (
                  <div
                    style={{
                      padding: '6px 12px',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {activeRef && (
                      <button
                        type="button"
                        onClick={() => setActiveRef(null)}
                        className="nook-tool-chip active"
                      >
                        <ArrowLeft size={11} />
                        <span>{t.projectTools.skillsBackToSkillBtn}</span>
                      </button>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {t.projectTools.skillsReferencesTitle}:
                    </span>
                    {skillDetail.references.map((ref) => (
                      <button
                        key={ref.full_path}
                        type="button"
                        onClick={() => handleOpenReference(ref.full_path, ref.relative_path)}
                        className={`nook-tool-chip ${activeRef?.name === ref.relative_path ? 'active' : ''}`}
                      >
                        <FileText size={11} />
                        <span>{ref.relative_path}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
                  <MarkdownViewer
                    content={activeRef ? activeRef.content : skillDetail.content}
                    onContentChange={() => {}}
                    fontSize={13.5}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
