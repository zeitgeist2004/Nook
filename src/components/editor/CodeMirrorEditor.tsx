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
import { searchKeymap } from '@codemirror/search';

interface CodeMirrorEditorProps {
  content: string;
  onChange: (value: string) => void;
  showLineNumbers?: boolean;
  lineWrapping?: boolean;
  fontSize?: number;
  fontFamily?: string;
}

const lineNumbersCompartment = new Compartment();
const lineWrappingCompartment = new Compartment();
const fontSizeCompartment = new Compartment();

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  content,
  onChange,
  showLineNumbers = false,
  lineWrapping = true,
  fontSize = 15,
  fontFamily = "'Inter', sans-serif",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isUpdatingRef = useRef(false);
  const lastValueRef = useRef(content);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    const baseTheme = EditorView.theme({
      '&': {
        height: '100%',
        fontSize: `${fontSize}px`,
        fontFamily: fontFamily,
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
        backgroundColor: 'rgba(255, 255, 255, 0.16)',
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
        onChange(val);
      }
    });

    const state = EditorState.create({
      doc: content,
      extensions: [
        history(),
        markdown(),
        baseTheme,
        highlightActiveLine(),
        highlightActiveLineGutter(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        lineNumbersCompartment.of(showLineNumbers ? cmLineNumbers() : []),
        lineWrappingCompartment.of(lineWrapping ? EditorView.lineWrapping : []),
        fontSizeCompartment.of(
          EditorView.theme({
            '&': { fontSize: `${fontSize}px`, fontFamily },
          })
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

    // Avoid expensive doc stringification if change originated from editor typing
    if (content === lastValueRef.current) {
      return;
    }

    const currentDoc = view.state.doc.toString();
    if (content !== currentDoc) {
      isUpdatingRef.current = true;
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: content,
        },
        annotations: Transaction.addToHistory.of(false),
      });
      lastValueRef.current = content;
      isUpdatingRef.current = false;
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

  // Update font size dynamically
  useEffect(() => {
    const view = viewRef.current;
    if (view) {
      view.dispatch({
        effects: fontSizeCompartment.reconfigure(
          EditorView.theme({
            '&': { fontSize: `${fontSize}px`, fontFamily },
          })
        ),
      });
    }
  }, [fontSize, fontFamily]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};
