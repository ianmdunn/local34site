import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  imagePlugin,
  tablePlugin,
  jsxPlugin,
  toolbarPlugin,
  diffSourcePlugin,
  frontmatterPlugin,
  linkDialogPlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  DiffSourceToggleWrapper,
  KitchenSinkToolbar,
  type MDXEditorMethods,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';

const API_URL = '/api/contract-mdx';

function getSectionFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('section') || null;
}

/**
 * MDX editor for contract content. Client-only (no SSR).
 * Fetches its own content. When ?section=X, edits only that section and merges back.
 */
function useDarkMode(): boolean {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setDark(el.classList.contains('dark'));
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

export default function ContractMdxEditor() {
  const [markdown, setMarkdown] = useState<string>('');
  const [rawPreview, setRawPreview] = useState('');
  const [section, setSection] = useState<string | null>(null);
  const [fullContent, setFullContent] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const editorRef = useRef<MDXEditorMethods | null>(null);
  const isDark = useDarkMode();

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMsg(null);
    const sectionId = getSectionFromUrl();
    setSection(sectionId);
    try {
      const url = sectionId ? `${API_URL}?section=${encodeURIComponent(sectionId)}` : API_URL;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Load failed: ${res.status}`);
      const data = await res.json();
      const content = data.content;
      setMarkdown(content);
      setRawPreview(content);
      if (data.fullContent) setFullContent(data.fullContent);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const save = useCallback(
    async (content: string) => {
      setStatus('saving');
      setErrorMsg(null);
      try {
        const body = section ? { content, section } : { content };
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Save failed: ${res.status}`);
        }
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
      } catch (err) {
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    },
    [section]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onPopState = () => load();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [load]);

  const onChange = useCallback((newMarkdown: string) => {
    setRawPreview(newMarkdown);
  }, []);

  if (status === 'loading') {
    return (
      <div className="contract-mdx-editor-loading">
        <p>Loading{section ? ` section (${section})…` : ' contract…'}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="contract-mdx-editor-error">
        <p>{errorMsg}</p>
        <button type="button" onClick={load} className="contract-mdx-editor-retry">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="contract-mdx-editor-wrap contract-mdx-editor-layout">
      <div className="contract-mdx-editor-main">
        <div className="contract-mdx-editor-status">
          {section && (
            <span className="contract-mdx-editor-section-badge" title={`Editing section: ${section}`}>
              {section}
            </span>
          )}
          <span className={`contract-mdx-editor-status-dot status-${status}`} />
          {status === 'saving' && 'Saving…'}
          {status === 'saved' && 'Saved'}
          {status === 'idle' && '•'}
          <button
            type="button"
            className="contract-mdx-editor-save-btn"
            onClick={() => save(rawPreview)}
            disabled={status === 'saving'}
          >
            Save
          </button>
        </div>
        <div className="contract-mdx-editor-body">
        <MDXEditor
          ref={editorRef}
          markdown={markdown}
          onChange={onChange}
          className={isDark ? 'contract-mdx-editor-mdx dark-theme' : 'contract-mdx-editor-mdx'}
          plugins={[
            toolbarPlugin({
              toolbarContents: () => (
                <DiffSourceToggleWrapper>
                  <KitchenSinkToolbar />
                </DiffSourceToggleWrapper>
              ),
            }),
            diffSourcePlugin({ viewMode: 'rich-text', diffMarkdown: markdown }),
            frontmatterPlugin(),
            linkDialogPlugin(),
            codeBlockPlugin(),
            codeMirrorPlugin(),
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            markdownShortcutPlugin(),
            linkPlugin(),
            imagePlugin(),
            tablePlugin(),
            jsxPlugin(),
          ]}
          contentEditableClassName="contract-mdx-editor-content prose max-w-none dark:prose-invert"
        />
        </div>
      </div>
      <aside className="contract-mdx-editor-sidebar">
        <div className="contract-mdx-editor-sidebar-header">
          <h3>Raw MDX (realtime)</h3>
        </div>
        <pre className="contract-mdx-editor-raw">
          <code>{rawPreview}</code>
        </pre>
      </aside>
    </div>
  );
}
