import React, { useEffect } from 'react';
import {
  X,
  ArrowRight,
  Command,
  FilePlus,
  Zap,
  BookOpen,
  PanelLeft,
  HelpCircle,
  Feather,
  FolderTree,
  Keyboard,
} from 'lucide-react';
import { NookWelcomeMascot } from '../mascot/NookMascot';
import { Tooltip } from '../ui/Tooltip';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartWriting: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onStartWriting,
}) => {
  const handleDismiss = () => {
    try {
      localStorage.setItem('nook_onboarding_completed', 'true');
    } catch (e) {
      // ignore
    }
    onClose();
  };

  const handleStart = () => {
    try {
      localStorage.setItem('nook_onboarding_completed', 'true');
    } catch (e) {
      // ignore
    }
    onClose();
    onStartWriting();
  };

  // Keyboard accessibility: Escape to dismiss, Enter to start writing
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
      } else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleStart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const pillars = [
    {
      icon: <Feather size={15} />,
      title: 'Escrita sem Fricção',
      desc: 'Markdown rápido, tarefas interativas e salvamento contínuo.',
    },
    {
      icon: <FolderTree size={15} />,
      title: 'Organização Fluida',
      desc: 'Projetos, pastas e arrastar arquivos direto do Explorer.',
    },
    {
      icon: <Keyboard size={15} />,
      title: 'Foco no Teclado',
      desc: 'Navegação ágil e paleta de comandos via atalhos globais.',
    },
  ];

  const shortcuts = [
    {
      action: 'Nova Nota Rápida',
      desc: 'Cria uma anotação em branco imediatamente',
      keys: ['Ctrl', 'N'],
      icon: <FilePlus size={14} />,
    },
    {
      action: 'Busca & Comandos',
      desc: 'Localiza notas, projetos e executa ações rápidas',
      keys: ['Ctrl', 'K'],
      icon: <Command size={14} />,
    },
    {
      action: 'Modo Leitura / Edição',
      desc: 'Alterna entre editor e visualizador Markdown renderizado',
      keys: ['Ctrl', 'E'],
      icon: <BookOpen size={14} />,
    },
    {
      action: 'Recolher Barra Lateral',
      desc: 'Foco total nas palavras sem distrações visuais',
      keys: ['Ctrl', 'B'],
      icon: <PanelLeft size={14} />,
    },
    {
      action: 'Captura Rápida',
      desc: 'Atalho para capturar uma ideia sem perder o fluxo',
      keys: ['Ctrl', 'Alt', 'N'],
      icon: <Zap size={14} />,
    },
    {
      action: 'Central de Ajuda',
      desc: 'Reabre esta central e resumo de comandos a qualquer momento',
      keys: ['Ctrl', '/'],
      icon: <HelpCircle size={14} />,
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.76)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        animation: 'fadeIn var(--transition-fast) ease-out',
      }}
      onClick={handleDismiss}
    >
      <div
        style={{
          width: '580px',
          maxWidth: '95vw',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: '0 24px 52px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'nookPopIn 160ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button with tooltip */}
        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
          <Tooltip content="Fechar" shortcut="Esc" position="left">
            <button
              onClick={handleDismiss}
              aria-label="Fechar introdução"
              style={{
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color var(--transition-fast), background-color var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <X size={16} />
            </button>
          </Tooltip>
        </div>

        {/* Hero Section */}
        <div
          style={{
            padding: '32px 32px 18px 32px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ marginBottom: '12px' }}>
            <NookWelcomeMascot size={72} />
          </div>
          <h1
            style={{
              fontSize: '21px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: '0 0 6px 0',
            }}
          >
            Bem-vindo ao Nook
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              margin: 0,
              fontWeight: 400,
              lineHeight: 1.45,
              maxWidth: '380px',
            }}
          >
            Seu refúgio de escrita: minimalista, rápido e 100% offline. Foco total nas palavras.
          </p>
        </div>

        {/* 3 Core Pillars */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            padding: '0 28px 16px 28px',
          }}
        >
          {pillars.map((p) => (
            <div
              key={p.title}
              style={{
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <span style={{ color: 'var(--text-secondary)', display: 'inline-flex' }}>{p.icon}</span>
                <span>{p.title}</span>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  lineHeight: 1.35,
                }}
              >
                {p.desc}
              </div>
            </div>
          ))}
        </div>

        {/* Cheatsheet de Atalhos */}
        <div style={{ padding: '0 28px 20px 28px' }}>
          <div
            style={{
              fontSize: '10.5px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-muted)',
              marginBottom: '8px',
              paddingLeft: '2px',
            }}
          >
            Atalhos Principais
          </div>

          <div
            style={{
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            {shortcuts.map((item, idx) => (
              <div
                key={item.action}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderBottom: idx < shortcuts.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <div style={{ color: 'var(--text-secondary)', display: 'inline-flex' }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {item.action}
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      {item.desc}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  {item.keys.map((k) => (
                    <kbd
                      key={k}
                      style={{
                        padding: '2px 6px',
                        fontSize: '10px',
                        fontWeight: 600,
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '3px',
                        color: 'var(--text-primary)',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
                      }}
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 28px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '12px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px 0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'color var(--transition-fast)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <span>Pular introdução</span>
            <kbd
              style={{
                fontSize: '9.5px',
                padding: '1px 4px',
                color: 'var(--text-muted)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '3px',
              }}
            >
              Esc
            </kbd>
          </button>

          <button
            onClick={handleStart}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
              transition: 'opacity var(--transition-fast)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.92')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <span>Começar a escrever</span>
            <ArrowRight size={14} />
            <kbd
              style={{
                fontSize: '9.5px',
                padding: '1px 5px',
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                color: 'inherit',
                borderRadius: '3px',
                marginLeft: '2px',
              }}
            >
              Enter ↵
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
};
