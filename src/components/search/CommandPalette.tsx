import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  FileText,
  FilePlus,
  Folder,
  FolderPlus,
  Settings as SettingsIcon,
  Trash2,
  Moon,
  Download,
  ArrowRight,
  FileUp,
  BookOpen,
  History,
  Keyboard,
  Database,
  X,
  Mic,
  Globe,
  Layers,
  GitCommitHorizontal,
  Sparkles,
  FolderGit2,
  FileCode2,
  BookMarked,
  Heart,
} from 'lucide-react';
import { DevWorkflowToolId, SearchResultItem } from '../../types';
import { api, isTauri } from '../../services/api';
import { TranslationDictionary, useTranslation } from '../../i18n';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { ContextualHint } from '../ui/ContextualHint';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNote: (noteId: string) => void;
  onCreateQuickNote: () => void;
  onCreateProject: () => void;
  onOpenSettings: () => void;
  onOpenTrash: () => void;
  onOpenExternalFile: () => void;
  onToggleTheme: () => void;
  onToggleLanguage?: () => void;
  onExportLibrary: () => void;
  onOpenVersionHistory?: () => void;
  onOpenShortcuts?: () => void;
  onTriggerBackup?: () => void;
  onOpenVoice?: () => void;
  onOpenProjectTools?: (tool?: DevWorkflowToolId) => void;
  onOpenSupport?: () => void;
  isMobile?: boolean;
}

interface ActionCommand {
  id: string;
  title: string;
  subtitle: string;
  keywords?: string;
  icon: React.ReactNode;
  category: 'notes' | 'organization' | 'workflow' | 'system';
  shortcut?: string;
  run: () => void;
}

const CATEGORIES: Array<{
  id: 'notes' | 'organization' | 'workflow' | 'system';
  labelKey: keyof Pick<
    TranslationDictionary['commandPalette'],
    'categoryNotes' | 'categoryOrganization' | 'categoryWorkflow' | 'categorySystem'
  >;
}> = [
  { id: 'notes', labelKey: 'categoryNotes' },
  { id: 'organization', labelKey: 'categoryOrganization' },
  { id: 'workflow', labelKey: 'categoryWorkflow' },
  { id: 'system', labelKey: 'categorySystem' },
];

const CommandPaletteComponent: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectNote,
  onCreateQuickNote,
  onCreateProject,
  onOpenSettings,
  onOpenTrash,
  onOpenExternalFile,
  onToggleTheme,
  onToggleLanguage,
  onExportLibrary,
  onOpenVersionHistory,
  onOpenShortcuts,
  onTriggerBackup,
  onOpenVoice,
  onOpenProjectTools,
  onOpenSupport,
  isMobile = false,
}) => {
  const { t, format } = useTranslation();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useDialogA11y({ isOpen, onClose });

  const isDesktopRuntime = isTauri();

  const actionCommands: ActionCommand[] = [
    // 1. NOTAS & ESCRITA
    {
      id: 'cmd-voice-note',
      title: t.commandPalette.cmdVoiceNoteTitle,
      subtitle: t.commandPalette.cmdVoiceNoteSub,
      icon: <Mic size={16} />,
      category: 'notes',
      run: () => {
        onClose();
        onOpenVoice?.();
      },
    },
    {
      id: 'cmd-new-note',
      title: t.commandPalette.cmdNewQuickNoteTitle,
      subtitle: t.commandPalette.cmdNewQuickNoteSub,
      icon: <FilePlus size={16} />,
      category: 'notes',
      shortcut: 'Ctrl+N',
      run: () => {
        onClose();
        onCreateQuickNote();
      },
    },
    {
      id: 'cmd-reading-mode',
      title: t.commandPalette.cmdToggleModeTitle,
      subtitle: t.commandPalette.cmdToggleModeSub,
      icon: <BookOpen size={16} />,
      category: 'notes',
      shortcut: 'Ctrl+E',
      run: () => {
        onClose();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true }));
      },
    },
    {
      id: 'cmd-version-history',
      title: t.commandPalette.cmdVersionHistoryTitle,
      subtitle: t.commandPalette.cmdVersionHistorySub,
      icon: <History size={16} />,
      category: 'notes',
      run: () => {
        onClose();
        onOpenVersionHistory?.();
      },
    },
    {
      id: 'cmd-open-external',
      title: t.commandPalette.cmdOpenExternalTitle,
      subtitle: t.commandPalette.cmdOpenExternalSub,
      icon: <FileUp size={16} />,
      category: 'notes',
      run: () => {
        onClose();
        onOpenExternalFile();
      },
    },

    // 2. ORGANIZAÇÃO & PROJETOS
    {
      id: 'cmd-new-project',
      title: t.commandPalette.cmdNewProjectTitle,
      subtitle: t.commandPalette.cmdNewProjectSub,
      icon: <FolderPlus size={16} />,
      category: 'organization',
      run: () => {
        onClose();
        onCreateProject();
      },
    },
    {
      id: 'cmd-trash',
      title: t.commandPalette.cmdOpenTrashTitle,
      subtitle: t.commandPalette.cmdOpenTrashSub,
      icon: <Trash2 size={16} />,
      category: 'organization',
      run: () => {
        onClose();
        onOpenTrash();
      },
    },
    {
      id: 'cmd-export',
      title: t.commandPalette.cmdExportLibraryTitle,
      subtitle: t.commandPalette.cmdExportLibrarySub,
      icon: <Download size={16} />,
      category: 'organization',
      run: () => {
        onClose();
        onExportLibrary();
      },
    },

    // 2B. FERRAMENTAS DO PROJETO (Opcional & sob demanda)
    ...(onOpenProjectTools
      ? [
          {
            id: 'cmd-wf-tools',
            title: t.commandPalette.cmdProjectToolsTitle,
            subtitle: t.commandPalette.cmdProjectToolsSub,
            icon: <Layers size={16} />,
            category: 'workflow' as const,
            run: () => {
              onClose();
              onOpenProjectTools('context-pack');
            },
          },
          {
            id: 'cmd-wf-context',
            title: t.commandPalette.cmdContextPackTitle,
            subtitle: t.commandPalette.cmdContextPackSub,
            icon: <Layers size={16} />,
            category: 'workflow' as const,
            run: () => {
              onClose();
              onOpenProjectTools('context-pack');
            },
          },
          {
            id: 'cmd-wf-prompts',
            title: t.commandPalette.cmdPromptLibraryTitle,
            subtitle: t.commandPalette.cmdPromptLibrarySub,
            icon: <Sparkles size={16} />,
            category: 'workflow' as const,
            run: () => {
              onClose();
              onOpenProjectTools('prompts');
            },
          },
          {
            id: 'cmd-wf-handoff',
            title: t.commandPalette.cmdSessionHandoffTitle,
            subtitle: t.commandPalette.cmdSessionHandoffSub,
            icon: <GitCommitHorizontal size={16} />,
            category: 'workflow' as const,
            run: () => {
              onClose();
              onOpenProjectTools('handoff');
            },
          },
          {
            id: 'cmd-wf-journal',
            title: t.commandPalette.cmdDevJournalTitle,
            subtitle: t.commandPalette.cmdDevJournalSub,
            icon: <BookOpen size={16} />,
            category: 'workflow' as const,
            run: () => {
              onClose();
              onOpenProjectTools('journal');
            },
          },
          {
            id: 'cmd-wf-link',
            title: t.commandPalette.cmdLinkFolderTitle,
            subtitle: t.commandPalette.cmdLinkFolderSub,
            icon: <FolderGit2 size={16} />,
            category: 'workflow' as const,
            run: () => {
              onClose();
              onOpenProjectTools('project-linking');
            },
          },
          {
            id: 'cmd-wf-instructions',
            title: t.commandPalette.cmdProjectInstructionsTitle,
            subtitle: t.commandPalette.cmdProjectInstructionsSub,
            icon: <FileCode2 size={16} />,
            category: 'workflow' as const,
            run: () => {
              onClose();
              onOpenProjectTools('instructions');
            },
          },
          {
            id: 'cmd-wf-skills',
            title: t.commandPalette.cmdAgentSkillsTitle,
            subtitle: t.commandPalette.cmdAgentSkillsSub,
            icon: <BookMarked size={16} />,
            category: 'workflow' as const,
            run: () => {
              onClose();
              onOpenProjectTools('skills');
            },
          },
        ]
      : []),

    // 3. PREFERÊNCIAS & SISTEMA
    {
      id: 'cmd-settings',
      title: t.commandPalette.cmdOpenSettingsTitle,
      subtitle: t.commandPalette.cmdOpenSettingsSub,
      icon: <SettingsIcon size={16} />,
      category: 'system',
      shortcut: 'Ctrl+,',
      run: () => {
        onClose();
        onOpenSettings();
      },
    },
    {
      id: 'cmd-theme',
      title: t.commandPalette.cmdToggleThemeTitle,
      subtitle: t.commandPalette.cmdToggleThemeSub,
      icon: <Moon size={16} />,
      category: 'system',
      run: () => {
        onClose();
        onToggleTheme();
      },
    },
    ...(onToggleLanguage
      ? [
          {
            id: 'cmd-language',
            title: t.commandPalette.cmdCycleLanguageTitle,
            subtitle: t.commandPalette.cmdCycleLanguageSub,
            icon: <Globe size={16} />,
            category: 'system' as const,
            run: () => {
              onClose();
              onToggleLanguage();
            },
          },
        ]
      : []),
    {
      id: 'cmd-shortcuts',
      title: t.commandPalette.cmdShortcutsTitle,
      subtitle: t.commandPalette.cmdShortcutsSub,
      icon: <Keyboard size={16} />,
      category: 'system',
      shortcut: 'Ctrl+/',
      run: () => {
        onClose();
        onOpenShortcuts?.();
      },
    },
    ...(isDesktopRuntime
      ? [
          {
            id: 'cmd-auto-backup',
            title: t.commandPalette.cmdTriggerBackupTitle,
            subtitle: t.commandPalette.cmdTriggerBackupSub,
            icon: <Database size={16} />,
            category: 'system' as const,
            run: () => {
              onClose();
              onTriggerBackup?.();
            },
          },
        ]
      : []),
    {
      id: 'cmd-support-nook',
      title: t.support.commandTitle,
      subtitle: t.support.commandSubtitle,
      keywords: t.support.commandKeywords,
      icon: <Heart size={16} />,
      category: 'system',
      run: () => {
        onClose();
        if (onOpenSupport) {
          onOpenSupport();
        } else {
          api.openSponsorsPage().catch(() => {});
        }
      },
    },
  ];

  // Perform search query debounced
  useEffect(() => {
    if (!isOpen) return;

    if (!query.trim()) {
      setSearchResults([]);
      setSelectedIndex(0);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await api.searchNotes(query.trim());
        setSearchResults(results);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Failed to search:', err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSearchResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Combine items for keyboard navigation (On mobile, we only search notes & collections, no desktop command actions)
  const normalizedQuery = query.toLowerCase();
  const filteredActions = isMobile
    ? []
    : actionCommands.filter(
        (a) =>
          a.title.toLowerCase().includes(normalizedQuery) ||
          a.subtitle.toLowerCase().includes(normalizedQuery) ||
          (a.keywords ? a.keywords.toLowerCase().includes(normalizedQuery) : false)
      );

  const totalItems = searchResults.length + filteredActions.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, totalItems));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalItems) % Math.max(1, totalItems));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex < searchResults.length) {
        const res = searchResults[selectedIndex];
        onClose();
        if (res.item_type === 'note') {
          onSelectNote(res.id);
        }
      } else {
        const actionIdx = selectedIndex - searchResults.length;
        if (filteredActions[actionIdx]) {
          filteredActions[actionIdx].run();
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: isMobile ? 'max(14px, env(safe-area-inset-top, 14px))' : 'min(12dvh, 96px)',
        paddingLeft: isMobile ? '12px' : '16px',
        paddingRight: isMobile ? '12px' : '16px',
        paddingBottom: '12px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isMobile ? t.commandPalette.placeholderMobile : t.commandPalette.placeholder}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? '100%' : 'min(92vw, 620px)',
          maxWidth: '620px',
          maxHeight: isMobile
            ? 'min(80dvh, calc(var(--nook-viewport-height, 100dvh) - 28px - env(safe-area-inset-top, 0px)))'
            : 'min(82dvh, 480px)',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: isMobile ? '16px' : 'var(--radius-lg)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        className="animate-modal-pop"
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: isMobile ? '12px 14px' : '14px 18px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <Search size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isMobile ? t.commandPalette.placeholderMobile : t.commandPalette.placeholder}
            style={{
              width: '100%',
              fontSize: isMobile ? '16px' : '15px',
              color: 'var(--text-primary)',
              backgroundColor: 'transparent',
            }}
          />
          {isMobile ? (
            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                borderRadius: '50%',
                flexShrink: 0,
              }}
              aria-label={t.commandPalette.closeSearchAria}
            >
              <X size={18} />
            </button>
          ) : (
            <kbd>ESC</kbd>
          )}
        </div>

        {/* Results List */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <ContextualHint
            tipId="search"
            title={t.ux.tipSearchTitle}
            description={t.ux.tipSearchDesc}
            compact
          />
          {/* Mobile empty query state */}
          {isMobile && searchResults.length === 0 && !query.trim() && (
            <div
              style={{
                padding: '36px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Search size={32} style={{ opacity: 0.35 }} />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {t.commandPalette.searchNotesHeading}
              </span>
              <span style={{ fontSize: '12px', maxWidth: '240px', lineHeight: '1.4' }}>
                {t.commandPalette.searchNotesSubtitle}
              </span>
            </div>
          )}
          {/* Notes & Collections Results */}
          {searchResults.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.04em',
                }}
              >
                {t.commandPalette.resultsFound}
              </div>

              {searchResults.map((item, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onClose();
                      if (item.item_type === 'note') onSelectNote(item.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isSelected ? 'var(--bg-selected)' : 'transparent',
                      cursor: 'pointer',
                      borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {item.item_type === 'note' ? <FileText size={16} /> : <Folder size={16} />}
                      </span>

                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                            {item.title}
                          </span>
                          {item.collection_name && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {format(t.commandPalette.inCollection, { name: item.collection_name })}
                            </span>
                          )}
                        </div>

                        {item.snippet && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-secondary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginTop: '2px',
                            }}
                          >
                            {item.snippet}
                          </span>
                        )}
                      </div>
                    </div>

                    <ArrowRight size={14} style={{ opacity: isSelected ? 0.9 : 0, color: 'var(--text-primary)' }} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Commands Grouped by Category */}
          {filteredActions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {CATEGORIES.map((cat, catIdx) => {
                const catActions = filteredActions.filter((cmd) => cmd.category === cat.id);
                if (catActions.length === 0) return null;

                return (
                  <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div
                      style={{
                        padding: '6px 12px 4px 12px',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        letterSpacing: '0.05em',
                        borderTop:
                          catIdx > 0 || searchResults.length > 0 ? '1px solid var(--border-subtle)' : 'none',
                        marginTop: catIdx > 0 || searchResults.length > 0 ? '4px' : '0',
                        paddingTop: catIdx > 0 || searchResults.length > 0 ? '8px' : '4px',
                      }}
                    >
                      {t.commandPalette[cat.labelKey]}
                    </div>

                    {catActions.map((cmd) => {
                      const itemIdx = searchResults.length + filteredActions.findIndex((a) => a.id === cmd.id);
                      const isSelected = selectedIndex === itemIdx;

                      return (
                        <div
                          key={cmd.id}
                          onClick={cmd.run}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isSelected ? 'var(--bg-selected)' : 'transparent',
                            cursor: 'pointer',
                            borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                            transition: 'background-color var(--transition-fast)',
                          }}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {cmd.icon}
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                {cmd.title}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {cmd.subtitle}
                              </span>
                            </div>
                          </div>

                          {cmd.shortcut && (
                            <kbd
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-muted)',
                              }}
                            >
                              {cmd.shortcut}
                            </kbd>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {totalItems === 0 && query.trim() && (
            <div
              style={{
                padding: '28px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t.ux.emptySearchTitle}
              </span>
              <span style={{ fontSize: '12px' }}>
                {format(t.commandPalette.noResults, { query })}
              </span>
            </div>
          )}
        </div>

        {/* Footer Hint (Desktop only: keyboard navigation shortcuts) */}
        {!isMobile && (
          <div
            style={{
              padding: '8px 16px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            <div style={{ display: 'flex', gap: '12px' }}>
              <span>{t.commandPalette.navNavigate}</span>
              <span>{t.commandPalette.navSelect}</span>
              <span>{t.commandPalette.navClose}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const CommandPalette = React.memo(CommandPaletteComponent);
