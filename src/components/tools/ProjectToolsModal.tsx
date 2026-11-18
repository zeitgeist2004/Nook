import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Layers,
  GitCommitHorizontal,
  Sparkles,
  BookOpen,
  FolderGit2,
  FileCode2,
  BookMarked,
  HelpCircle,
  Check,
  Briefcase,
} from 'lucide-react';
import {
  Collection,
  DevNotesMetaMap,
  DevProjectsConfigMap,
  DevWorkflowToolId,
  Note,
  NoteSummary,
  NoteWorkflowRole,
  ProjectDevConfig,
} from '../../types';
import { useTranslation } from '../../i18n';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { NookWelcomeMascot } from '../mascot/NookMascot';
import {
  dismissToolTip,
  getDismissedToolTips,
  hasSeenDevIntro,
  markDevIntroSeen,
} from '../../utils/workflowUtils';
import { ContextPackPanel } from './ContextPackPanel';
import { PromptLibraryPanel } from './PromptLibraryPanel';
import { HandoffPanel } from './HandoffPanel';
import { DevJournalPanel } from './DevJournalPanel';
import { ProjectLinkingPanel } from './ProjectLinkingPanel';
import { AgentInstructionsPanel } from './AgentInstructionsPanel';
import { AgentSkillsPanel } from './AgentSkillsPanel';

interface ProjectToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProjectId: string | null;
  initialTool?: DevWorkflowToolId;
  initialPromptNoteId?: string | null;
  collections: Collection[];
  notes: NoteSummary[];
  activeNoteId: string | null;
  devProjectsConfig: DevProjectsConfigMap;
  devNotesMeta: DevNotesMetaMap;
  onUpdateProjectConfig: (
    projectId: string,
    updater: (prev: ProjectDevConfig) => ProjectDevConfig
  ) => void;
  onUpdateNoteMeta: (
    noteId: string,
    updater: (
      prev: DevNotesMetaMap[string] | undefined
    ) => DevNotesMetaMap[string] | undefined
  ) => void;
  onCreateNote: (
    collectionId: string | null,
    title: string,
    content: string,
    role: NoteWorkflowRole
  ) => Promise<Note>;
  onDuplicatePromptNote: (noteId: string) => Promise<void>;
  onOpenNoteInEditor: (noteId: string) => void;
  onOpenExternalDoc: (filePath: string) => void;
  onCreateProjectPrompt?: () => void;
  isMobile?: boolean;
}

export const ProjectToolsModal: React.FC<ProjectToolsModalProps> = ({
  isOpen,
  onClose,
  initialProjectId,
  initialTool = 'context-pack',
  initialPromptNoteId,
  collections,
  notes,
  activeNoteId,
  devProjectsConfig,
  devNotesMeta,
  onUpdateProjectConfig,
  onUpdateNoteMeta,
  onCreateNote,
  onDuplicatePromptNote,
  onOpenNoteInEditor,
  onOpenExternalDoc,
  onCreateProjectPrompt,
  isMobile = false,
}) => {
  const { t } = useTranslation();

  const rootProjects = useMemo(
    () =>
      collections
        .filter((c) => !c.parent_id)
        .sort((a, b) => {
          const oa = a.sort_order ?? 0;
          const ob = b.sort_order ?? 0;
          if (oa !== ob) return oa - ob;
          return a.name.localeCompare(b.name);
        }),
    [collections]
  );

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    initialProjectId || rootProjects[0]?.id || null
  );
  const [activeTool, setActiveTool] = useState<DevWorkflowToolId>(initialTool);
  const [showIntro, setShowIntro] = useState<boolean>(() => !hasSeenDevIntro());
  const [dismissedTips, setDismissedTips] = useState<Set<DevWorkflowToolId>>(() =>
    getDismissedToolTips()
  );
  const [showHelpBox, setShowHelpBox] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const resolvedTool =
      isMobile && ['project-linking', 'instructions', 'skills'].includes(initialTool)
        ? 'context-pack'
        : initialTool;
    setActiveTool(resolvedTool);
    setShowHelpBox(false);
    setShowIntro(!hasSeenDevIntro());
    if (initialProjectId && rootProjects.some((p) => p.id === initialProjectId)) {
      setSelectedProjectId(initialProjectId);
    } else if (!selectedProjectId || !rootProjects.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(rootProjects[0]?.id ?? null);
    }
  }, [isOpen, initialProjectId, initialTool, isMobile, rootProjects]);

  useDialogA11y({ isOpen, onClose });

  if (!isOpen) return null;

  const activeProject = rootProjects.find((p) => p.id === selectedProjectId) ?? null;
  const projectConfig: ProjectDevConfig = activeProject
    ? devProjectsConfig[activeProject.id] ?? {}
    : {};

  const toolMeta: Record<
    DevWorkflowToolId,
    {
      label: string;
      sub: string;
      tip: string;
      help: string;
      icon: React.ReactNode;
      group: 'notes' | 'local';
    }
  > = {
    'context-pack': {
      label: t.projectTools.toolContextPack,
      sub: t.projectTools.toolContextPackSub,
      tip: t.projectTools.tipContextPack,
      help: t.projectTools.helpContextPack,
      icon: <Layers size={15} />,
      group: 'notes',
    },
    handoff: {
      label: t.projectTools.toolHandoff,
      sub: t.projectTools.toolHandoffSub,
      tip: t.projectTools.tipHandoff,
      help: t.projectTools.helpHandoff,
      icon: <GitCommitHorizontal size={15} />,
      group: 'notes',
    },
    prompts: {
      label: t.projectTools.toolPrompts,
      sub: t.projectTools.toolPromptsSub,
      tip: t.projectTools.tipPrompts,
      help: t.projectTools.helpPrompts,
      icon: <Sparkles size={15} />,
      group: 'notes',
    },
    journal: {
      label: t.projectTools.toolJournal,
      sub: t.projectTools.toolJournalSub,
      tip: t.projectTools.tipJournal,
      help: t.projectTools.helpJournal,
      icon: <BookOpen size={15} />,
      group: 'notes',
    },
    'project-linking': {
      label: t.projectTools.toolLinking,
      sub: t.projectTools.toolLinkingSub,
      tip: t.projectTools.tipLinking,
      help: t.projectTools.helpLinking,
      icon: <FolderGit2 size={15} />,
      group: 'local',
    },
    instructions: {
      label: t.projectTools.toolInstructions,
      sub: t.projectTools.toolInstructionsSub,
      tip: t.projectTools.tipInstructions,
      help: t.projectTools.helpInstructions,
      icon: <FileCode2 size={15} />,
      group: 'local',
    },
    skills: {
      label: t.projectTools.toolSkills,
      sub: t.projectTools.toolSkillsSub,
      tip: t.projectTools.tipSkills,
      help: t.projectTools.helpSkills,
      icon: <BookMarked size={15} />,
      group: 'local',
    },
  };

  const noteTools: DevWorkflowToolId[] = ['context-pack', 'handoff', 'prompts', 'journal'];
  const localTools: DevWorkflowToolId[] = ['project-linking', 'instructions', 'skills'];
  const currentMeta = toolMeta[activeTool];

  const handleDismissTip = (toolId: DevWorkflowToolId) => {
    dismissToolTip(toolId);
    setDismissedTips((prev) => new Set(prev).add(toolId));
  };

  const handleExploreFromIntro = () => {
    markDevIntroSeen();
    setShowIntro(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.68)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile
          ? 'max(10px, env(safe-area-inset-top, 10px)) 10px max(10px, env(safe-area-inset-bottom, 10px)) 10px'
          : '24px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.projectTools.modalTitle}
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-pop"
        style={{
          width: isMobile ? '100%' : 'min(940px, 94vw)',
          height: isMobile
            ? 'min(92dvh, var(--nook-viewport-height, 92dvh), 720px)'
            : 'min(650px, 88dvh)',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.62)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal First-Contact Introduction (§12.2) */}
        {showIntro ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: isMobile ? '24px 20px' : '40px 44px',
              textAlign: 'center',
              position: 'relative',
              overflowY: 'auto',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={t.common.close}
              className="nook-icon-btn"
              style={{ position: 'absolute', top: '14px', right: '14px' }}
            >
              <X size={18} />
            </button>

            <div style={{ marginBottom: '12px' }}>
              <NookWelcomeMascot size={74} />
            </div>

            <h2
              style={{
                margin: '0 0 8px 0',
                fontSize: '20px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
              }}
            >
              {t.projectTools.introTitle}
            </h2>

            <p
              style={{
                margin: '0 0 22px 0',
                fontSize: '13.5px',
                color: 'var(--text-secondary)',
                maxWidth: '460px',
                lineHeight: 1.5,
              }}
            >
              {t.projectTools.introSubtitle}
            </p>

            <div
              style={{
                width: '100%',
                maxWidth: '490px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                textAlign: 'left',
                marginBottom: '26px',
              }}
            >
              {[
                t.projectTools.introBulletContext,
                t.projectTools.introBulletContinuity,
                t.projectTools.introBulletPrompts,
                t.projectTools.introBulletLocal,
              ].map((bullet) => (
                <div
                  key={bullet}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-main)',
                    fontSize: '12.5px',
                    lineHeight: 1.45,
                    color: 'var(--text-primary)',
                  }}
                >
                  {bullet}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" onClick={onClose} className="nook-btn-secondary">
                {t.projectTools.introNotNowBtn}
              </button>
              <button type="button" onClick={handleExploreFromIntro} className="nook-btn-primary">
                <Check size={14} />
                <span>{t.projectTools.introExploreBtn}</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Top Modal Header */}
            <div
              style={{
                padding: '12px 18px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  <Layers size={16} style={{ color: 'var(--accent)' }} />
                  <span>{t.projectTools.modalTitle}</span>
                </div>

                {rootProjects.length > 0 && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Briefcase size={13} style={{ color: 'var(--text-muted)' }} />
                    <select
                      aria-label={t.projectTools.selectProjectLabel}
                      value={selectedProjectId || ''}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-main)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        fontWeight: 500,
                      }}
                    >
                      {rootProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {activeProject && (
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11.5px',
                      color: projectConfig.enabled ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      backgroundColor: projectConfig.enabled ? 'var(--accent-muted)' : 'transparent',
                      border: `1px solid ${projectConfig.enabled ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!projectConfig.enabled}
                      onChange={(e) =>
                        onUpdateProjectConfig(activeProject.id, (prev) => ({
                          ...prev,
                          enabled: e.target.checked,
                        }))
                      }
                    />
                    <span>{t.projectTools.enableForProject}</span>
                  </label>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={t.common.close}
                className="nook-icon-btn"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body: Left Nav + Active Tool Workspace */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                overflow: 'hidden',
              }}
            >
              {/* Nav Sidebar */}
              <div
                style={{
                  width: isMobile ? '100%' : '212px',
                  backgroundColor: 'var(--bg-sidebar)',
                  borderRight: isMobile ? 'none' : '1px solid var(--border-color)',
                  borderBottom: isMobile ? '1px solid var(--border-color)' : 'none',
                  padding: isMobile ? '8px 10px' : '12px 8px',
                  display: 'flex',
                  flexDirection: isMobile ? 'row' : 'column',
                  gap: isMobile ? '6px' : '14px',
                  overflowX: isMobile ? 'auto' : 'visible',
                  overflowY: isMobile ? 'hidden' : 'auto',
                  flexShrink: 0,
                }}
              >
                {!isMobile && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div
                      style={{
                        padding: '2px 10px 4px',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {t.projectTools.groupNotesContinuity}
                    </div>
                    {noteTools.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setActiveTool(id);
                          setShowHelpBox(false);
                        }}
                        className={`nook-nav-btn ${activeTool === id ? 'active' : ''}`}
                      >
                        {toolMeta[id].icon}
                        <span>{toolMeta[id].label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {!isMobile && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div
                      style={{
                        padding: '2px 10px 4px',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {t.projectTools.groupFolderAgents}
                    </div>
                    {localTools.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setActiveTool(id);
                          setShowHelpBox(false);
                        }}
                        className={`nook-nav-btn ${activeTool === id ? 'active' : ''}`}
                      >
                        {toolMeta[id].icon}
                        <span>{toolMeta[id].label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {isMobile &&
                  noteTools.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setActiveTool(id);
                        setShowHelpBox(false);
                      }}
                      className={`nook-tool-chip ${activeTool === id ? 'active' : ''}`}
                      style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      {toolMeta[id].icon}
                      <span>{toolMeta[id].label}</span>
                    </button>
                  ))}
              </div>

              {/* Workspace Right Pane */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 0,
                  padding: isMobile ? '12px 14px' : '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  overflow: 'hidden',
                }}
              >
                {/* Workspace Subheader + On-Demand Help Button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexShrink: 0,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {currentMeta.label}
                      </h3>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {currentMeta.sub}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowHelpBox((prev) => !prev)}
                    title={t.projectTools.helpBtnTooltip}
                    className={`nook-icon-btn ${showHelpBox ? 'active' : ''}`}
                    style={{
                      color: showHelpBox ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    <HelpCircle size={16} />
                  </button>
                </div>

                {/* On-Demand Help Card (§12.4) */}
                {showHelpBox && (
                  <div
                    style={{
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      fontSize: '12px',
                      lineHeight: 1.45,
                      color: 'var(--text-secondary)',
                      flexShrink: 0,
                    }}
                  >
                    {currentMeta.help}
                  </div>
                )}

                {/* Contextual First-Use Tip Banner (§12.3) */}
                {!dismissedTips.has(activeTool) && !showHelpBox && (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--accent-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {currentMeta.tip}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDismissTip(activeTool)}
                      aria-label={t.projectTools.dismissTipAria}
                      className="nook-icon-btn"
                      style={{ flexShrink: 0 }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}

                {/* If no projects exist and current tool is project-scoped (except Prompts which works globally too) */}
                {!activeProject && activeTool !== 'prompts' ? (
                  <div className="nook-empty-box">
                    <Briefcase size={24} style={{ color: 'var(--text-muted)' }} />
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {t.projectTools.noProjectsTitle}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '360px', lineHeight: 1.45 }}>
                      {t.projectTools.noProjectsDesc}
                    </div>
                    {onCreateProjectPrompt && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onCreateProjectPrompt();
                        }}
                        className="nook-btn-primary"
                      >
                        {t.projectTools.createProjectBtn}
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {activeTool === 'context-pack' && (
                      <ContextPackPanel
                        project={activeProject}
                        collections={collections}
                        notes={notes}
                        activeNoteId={activeNoteId}
                        isMobile={isMobile}
                      />
                    )}

                    {activeTool === 'prompts' && (
                      <PromptLibraryPanel
                        project={activeProject}
                        collections={collections}
                        notes={notes}
                        activeNoteId={activeNoteId}
                        devNotesMeta={devNotesMeta}
                        initialTemplateNoteId={initialPromptNoteId}
                        onUpdateNoteMeta={onUpdateNoteMeta}
                        onCreateNoteAndOpen={onCreateNote}
                        onDuplicatePromptNote={onDuplicatePromptNote}
                        onOpenNoteInEditor={onOpenNoteInEditor}
                        onCloseModal={onClose}
                      />
                    )}

                    {activeTool === 'handoff' && (
                      <HandoffPanel
                        project={activeProject}
                        collections={collections}
                        notes={notes}
                        devNotesMeta={devNotesMeta}
                        onCreateNote={onCreateNote}
                        onOpenNoteInEditor={onOpenNoteInEditor}
                        onCloseModal={onClose}
                      />
                    )}

                    {activeTool === 'journal' && (
                      <DevJournalPanel
                        project={activeProject}
                        collections={collections}
                        notes={notes}
                        devNotesMeta={devNotesMeta}
                        onCreateNote={onCreateNote}
                        onOpenNoteInEditor={onOpenNoteInEditor}
                        onCloseModal={onClose}
                      />
                    )}

                    {activeTool === 'project-linking' && activeProject && (
                      <ProjectLinkingPanel
                        project={activeProject}
                        config={projectConfig}
                        onUpdateConfig={(updater) =>
                          onUpdateProjectConfig(activeProject.id, updater)
                        }
                        onSwitchTool={setActiveTool}
                        onOpenExternalDoc={onOpenExternalDoc}
                        onCloseModal={onClose}
                      />
                    )}

                    {activeTool === 'instructions' && activeProject && (
                      <AgentInstructionsPanel
                        config={projectConfig}
                        onUpdateConfig={(updater) =>
                          onUpdateProjectConfig(activeProject.id, updater)
                        }
                        isMobile={isMobile}
                      />
                    )}

                    {activeTool === 'skills' && activeProject && (
                      <AgentSkillsPanel
                        config={projectConfig}
                        onUpdateConfig={(updater) =>
                          onUpdateProjectConfig(activeProject.id, updater)
                        }
                        isMobile={isMobile}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <style>{`
          .nook-nav-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 10px;
            border-radius: var(--radius-sm);
            font-size: 12.5px;
            font-weight: 500;
            color: var(--text-secondary);
            background: transparent;
            border: none;
            width: 100%;
            text-align: left;
            cursor: pointer;
            transition: background-color var(--transition-fast), color var(--transition-fast);
          }
          .nook-nav-btn:hover {
            background-color: var(--bg-hover);
            color: var(--text-primary);
          }
          .nook-nav-btn.active {
            background-color: var(--bg-selected);
            color: var(--text-primary);
            font-weight: 600;
          }
          .nook-btn-primary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 7px 12px;
            border-radius: var(--radius-sm);
            font-size: 12.5px;
            font-weight: 600;
            background-color: var(--primary);
            color: var(--primary-foreground);
            border: none;
            cursor: pointer;
            transition: opacity var(--transition-fast);
          }
          .nook-btn-primary:hover:not(:disabled) {
            opacity: 0.9;
          }
          .nook-btn-primary:disabled {
            opacity: 0.45;
            cursor: default;
          }
          .nook-btn-secondary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 6px 11px;
            border-radius: var(--radius-sm);
            font-size: 12px;
            font-weight: 500;
            background-color: var(--bg-main);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            cursor: pointer;
            transition: background-color var(--transition-fast);
          }
          .nook-btn-secondary:hover:not(:disabled) {
            background-color: var(--bg-hover);
          }
          .nook-btn-secondary:disabled {
            opacity: 0.45;
            cursor: default;
          }
          .nook-tool-chip {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 4px 9px;
            border-radius: var(--radius-sm);
            font-size: 11.5px;
            font-weight: 500;
            background-color: var(--bg-main);
            color: var(--text-secondary);
            border: 1px solid var(--border-color);
            cursor: pointer;
          }
          .nook-tool-chip:hover:not(:disabled) {
            background-color: var(--bg-hover);
            color: var(--text-primary);
          }
          .nook-tool-chip.active {
            background-color: var(--bg-selected);
            color: var(--text-primary);
            border-color: var(--accent-border);
          }
          .nook-tool-chip:disabled {
            opacity: 0.45;
            cursor: default;
          }
          .nook-icon-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 5px;
            border-radius: var(--radius-sm);
            background: transparent;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
          }
          .nook-icon-btn:hover:not(:disabled) {
            background-color: var(--bg-hover);
            color: var(--text-primary);
          }
          .nook-icon-btn:disabled {
            opacity: 0.35;
            cursor: default;
          }
          .nook-input,
          .nook-textarea {
            padding: 7px 10px;
            border-radius: var(--radius-sm);
            border: 1px solid var(--border-color);
            background-color: var(--bg-elevated);
            color: var(--text-primary);
            font-size: 12.5px;
            font-family: var(--font-sans);
            outline: none;
            box-sizing: border-box;
          }
          .nook-input:focus,
          .nook-textarea:focus {
            border-color: var(--accent);
          }
          .nook-textarea {
            resize: vertical;
            line-height: 1.45;
          }
          .nook-field-label {
            font-size: 11.5px;
            font-weight: 600;
            color: var(--text-secondary);
          }
          .nook-empty-box {
            flex: 1;
            border: 1px dashed var(--border-color);
            border-radius: var(--radius-md);
            background-color: var(--bg-main);
            padding: 32px 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            gap: 8px;
          }
        `}</style>
      </div>
    </div>
  );
};
