import React, { useEffect, useRef } from 'react';
import { EditorState, Compartment, Transaction } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers as cmLineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { searchKeymap } from '@codemirror/search';
import { ReadingWidth } from '../../types';

interface CodeMirrorEditorProps {
  content: string;
  onChange: (value: string) => void;
  showLineNumbers?: boolean;
  lineWrapping?: boolean;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  readingWidth?: ReadingWidth;
}

const lineNumbersCompartment = new Compartment();
const lineWrappingCompartment = new Compartment();
const typographyCompartment = new Compartment();

const MEASURE_MAP: Record<ReadingWidth, string> = {
  comfortable: '70ch',
  wide: '940px',
  full: '100%',
};

const nookMarkdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, class: 'cm-nook-h1' },
  { tag: tags.heading2, class: 'cm-nook-h2' },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], class: 'cm-nook-h3' },
  { tag: tags.strong, class: 'cm-nook-strong' },
  { tag: tags.emphasis, class: 'cm-nook-em' },
  { tag: tags.link, class: 'cm-nook-link' },
  { tag: tags.url, class: 'cm-nook-url' },
  { tag: tags.quote, class: 'cm-nook-quote' },
  { tag: tags.monospace, class: 'cm-nook-code' },
  { tag: [tags.processingInstruction, tags.meta], class: 'cm-nook-meta' },
  { tag: tags.list, class: 'cm-nook-list' },
  { tag: tags.contentSeparator, class: 'cm-nook-hr' },
]);

function buildTypographyTheme(
  fontSize: number,
  fontFamily: string,
  lineHeight: number,
  readingWidth: ReadingWidth
) {
  const maxMeasure = MEASURE_MAP[readingWidth] || '70ch';
  return EditorView.theme({
    '&': {
      fontSize: `${fontSize}px`,
      fontFamily,
    },
    '.cm-scroller': {
      lineHeight: String(lineHeight),
    },
    '.cm-content': {
      maxWidth: `min(100%, ${maxMeasure}) !important`,
    },
  });
}

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  content,
  onChange,
  showLineNumbers = false,
  lineWrapping = true,
  fontSize = 15,
  fontFamily = "'Inter', sans-serif",
  lineHeight = 1.65,
  readingWidth = 'comfortable',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isUpdatingRef = useRef(false);
  const lastValueRef = useRef(content);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Initialize editor once per mounted instance (never destroyed on theme/style changes)
  useEffect(() => {
    if (!containerRef.current) return;

    const baseTheme = EditorView.theme({
      '&': {
        height: '100%',
        backgroundColor: 'transparent',
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'inherit',
      },
      '.cm-content': {
        caretColor: 'var(--accent)',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--accent)',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: 'var(--md-selection-bg)',
      },
      '.cm-panels': {
        backgroundColor: 'var(--bg-elevated)',
        color: 'var(--text-primary)',
        borderBottom: '1px solid var(--border-color)',
      },
      '.cm-search': {
        background: 'var(--bg-elevated) !important',
        border: '1px solid var(--border-color) !important',
        borderRadius: 'var(--radius-sm)',
        padding: '6px 10px !important',
      },
      '.cm-textfield': {
        background: 'var(--bg-main) !important',
        border: '1px solid var(--border-color) !important',
        borderRadius: 'var(--radius-sm) !important',
        color: 'var(--text-primary) !important',
      },
      '.cm-button': {
        background: 'var(--bg-hover) !important',
        border: '1px solid var(--border-color) !important',
        borderRadius: 'var(--radius-sm) !important',
        color: 'var(--text-primary) !important',
      },
    });

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isUpdatingRef.current) {
        const val = update.state.doc.toString();
        lastValueRef.current = val;
        onChangeRef.current(val);
      }
    });

    const state = EditorState.create({
      doc: content,
      extensions: [
        history(),
        markdown(),
        syntaxHighlighting(nookMarkdownHighlight),
        baseTheme,
        highlightActiveLine(),
        highlightActiveLineGutter(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        lineNumbersCompartment.of(showLineNumbers ? cmLineNumbers() : []),
        lineWrappingCompartment.of(lineWrapping ? EditorView.lineWrapping : []),
        typographyCompartment.of(
          buildTypographyTheme(fontSize, fontFamily, lineHeight, readingWidth)
        ),
        updateListener,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Update doc when external content changes (e.g., switching notes or restoring snapshot)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    if (content === lastValueRef.current) {
      return;
    }

    const currentDoc = view.state.doc.toString();
    if (content !== currentDoc) {
      const prevSel = view.state.selection.main;
      const prevScrollTop = view.scrollDOM.scrollTop;
      const clampedAnchor = Math.min(prevSel.anchor, content.length);
      const clampedHead = Math.min(prevSel.head, content.length);

      isUpdatingRef.current = true;
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: content,
        },
        selection: { anchor: clampedAnchor, head: clampedHead },
        scrollIntoView: false,
        annotations: Transaction.addToHistory.of(false),
      });
      lastValueRef.current = content;
      isUpdatingRef.current = false;
      requestAnimationFrame(() => {
        if (viewRef.current) {
          viewRef.current.scrollDOM.scrollTop = prevScrollTop;
        }
      });
    }
  }, [content]);

  // Update line numbers dynamically
  useEffect(() => {
    const view = viewRef.current;
    if (view) {
      view.dispatch({
        effects: lineNumbersCompartment.reconfigure(
          showLineNumbers ? cmLineNumbers() : []
        ),
      });
    }
  }, [showLineNumbers]);

  // Update line wrapping dynamically
  useEffect(() => {
    const view = viewRef.current;
    if (view) {
      view.dispatch({
        effects: lineWrappingCompartment.reconfigure(
          lineWrapping ? EditorView.lineWrapping : []
        ),
      });
    }
  }, [lineWrapping]);

  // Reconfigure typography & reading column measure dynamically without recreating editor
  useEffect(() => {
    const view = viewRef.current;
    if (view) {
      view.dispatch({
        effects: typographyCompartment.reconfigure(
          buildTypographyTheme(fontSize, fontFamily, lineHeight, readingWidth)
        ),
      });
    }
  }, [fontSize, fontFamily, lineHeight, readingWidth]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};
