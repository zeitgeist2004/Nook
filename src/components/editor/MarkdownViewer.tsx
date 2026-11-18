import React, { useMemo, useEffect, useRef } from 'react';
import { renderMarkdownToHtml, toggleTaskCheckbox } from '../../utils/markdownParser';
import { ParagraphSpacing, ReadingWidth } from '../../types';
import { useTranslation } from '../../i18n';

interface MarkdownViewerProps {
  content: string;
  onContentChange: (newContent: string) => void;
  onNavigateWikilink?: (targetName: string) => void;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  readingWidth?: ReadingWidth;
  paragraphSpacing?: ParagraphSpacing;
}

const PARAGRAPH_GAP_MAP: Record<ParagraphSpacing, string> = {
  compact: '0.78em',
  comfortable: '1.05em',
  airy: '1.36em',
};

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  content,
  onContentChange,
  onNavigateWikilink,
  fontSize = 15,
  fontFamily = "'Inter', sans-serif",
  lineHeight = 1.65,
  readingWidth = 'comfortable',
  paragraphSpacing = 'comfortable',
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  // Render markdown with memoization
  const { html, properties } = useMemo(() => {
    return renderMarkdownToHtml(content || '');
  }, [content]);

  const hasProperties = Object.keys(properties).length > 0;

  // Handle click events (checkboxes, wikilinks, code copy)
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // 1. Task checkbox clicked
    if (target.classList.contains('nook-task-checkbox') || target.classList.contains('lumina-task-checkbox')) {
      const checkbox = target as HTMLInputElement;
      const taskIdxStr = checkbox.getAttribute('data-task-index');
      if (taskIdxStr !== null) {
        const taskIdx = parseInt(taskIdxStr, 10);
        const updated = toggleTaskCheckbox(content, taskIdx);
        onContentChange(updated);
      }
      return;
    }

    // 2. Wikilink clicked
    const wikilinkEl = target.closest('.nook-wikilink, .lumina-wikilink') as HTMLElement | null;
    if (wikilinkEl) {
      e.preventDefault();
      const targetName = wikilinkEl.getAttribute('data-wikilink');
      if (targetName && onNavigateWikilink) {
        onNavigateWikilink(targetName);
      }
      return;
    }

    // 3. Code copy button clicked
    const copyBtn = target.closest('.nook-code-copy-btn, .lumina-code-copy-btn') as HTMLElement | null;
    if (copyBtn) {
      e.preventDefault();
      const wrapperEl = copyBtn.closest('.nook-code-wrapper, .lumina-code-wrapper');
      const codeBlock = wrapperEl?.querySelector('code');
      if (codeBlock) {
        navigator.clipboard.writeText(codeBlock.innerText || '');
        copyBtn.innerText = t.common.copiedExclamation;
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.innerText = t.editor.copyCode;
          copyBtn.classList.remove('copied');
        }, 1500);
      }
      return;
    }
  };

  // Enhance code blocks with language header bar & copy button after render (syncing on language switch)
  useEffect(() => {
    if (!containerRef.current) return;
    const preElements = containerRef.current.querySelectorAll('pre');
    preElements.forEach((pre) => {
      const codeEl = pre.querySelector('code');
      const langMatch = codeEl?.className.match(/language-([\w+#.-]+)/i);
      const langLabel = (langMatch?.[1] || t.editor.codeLabel).toLowerCase();

      const existingWrapper = pre.parentElement;
      if (
        existingWrapper?.classList.contains('nook-code-wrapper') ||
        existingWrapper?.classList.contains('lumina-code-wrapper')
      ) {
        const existingLang = existingWrapper.querySelector('.nook-code-lang') as HTMLElement | null;
        if (existingLang && !langMatch) {
          existingLang.innerText = t.editor.codeLabel;
        }
        const existingBtn = existingWrapper.querySelector('.nook-code-copy-btn') as HTMLButtonElement | null;
        if (existingBtn && !existingBtn.classList.contains('copied')) {
          existingBtn.title = t.editor.copyCodeTitle;
          existingBtn.innerText = t.editor.copyCode;
        }
        return;
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'nook-code-wrapper lumina-code-wrapper';
      pre.parentNode?.insertBefore(wrapper, pre);

      const header = document.createElement('div');
      header.className = 'nook-code-header';

      const langBadge = document.createElement('span');
      langBadge.className = 'nook-code-lang';
      langBadge.innerText = langLabel;

      const copyBtn = document.createElement('button');
      copyBtn.className = 'nook-code-copy-btn lumina-code-copy-btn';
      copyBtn.type = 'button';
      copyBtn.title = t.editor.copyCodeTitle;
      copyBtn.innerText = t.editor.copyCode;

      header.appendChild(langBadge);
      header.appendChild(copyBtn);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);
    });
  }, [html, t.editor.copyCode, t.editor.copyCodeTitle, t.editor.codeLabel]);

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{
        height: '100%',
        overflowY: 'auto',
        fontFamily: fontFamily,
        fontSize: `${fontSize}px`,
        lineHeight,
        color: 'var(--text-primary)',
        padding: '12px 0 60px 0',
        ['--nook-paragraph-gap' as string]: PARAGRAPH_GAP_MAP[paragraphSpacing] || '1.05em',
      }}
      className="markdown-reading-scroller"
    >
      <div
        style={{
          maxWidth: '940px',
          width: '100%',
          margin: '0 auto',
          padding: '0 40px',
          boxSizing: 'border-box',
        }}
        className={`markdown-reading-content nook-measure-${readingWidth}`}
      >
        {/* Frontmatter / Properties Card (Obsidian / Lark Style) */}
        {hasProperties && (
          <div
            style={{
              marginBottom: '24px',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px 16px',
              fontSize: '12px',
            }}
          >
            {Object.entries(properties).map(([key, val]) => (
              <div
                key={key}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--text-secondary)',
                }}
              >
                <span
                  style={{
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                    textTransform: 'lowercase',
                  }}
                >
                  {key}:
                </span>
                <span
                  style={{
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--bg-hover)',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {val}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Rendered HTML */}
        <div
          dangerouslySetInnerHTML={{ __html: html }}
          className="markdown-body-rendered"
        />
      </div>
    </div>
  );
};
