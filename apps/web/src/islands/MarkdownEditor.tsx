import { useState, useRef, useMemo } from 'react';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

type Props = {
    name: string;
    defaultValue?: string;
    placeholder?: string;
    rows?: number;
    required?: boolean;
};

export default function MarkdownEditor({
    name,
    defaultValue = '',
    placeholder = '',
    rows = 12,
    required = false,
}: Props) {
    const [value, setValue] = useState(defaultValue);
    const [mobilePreview, setMobilePreview] = useState(false);
    const ref = useRef<HTMLTextAreaElement>(null);

    const html = useMemo(() => marked.parse(value || '') as string, [value]);

    function insert(before: string, after = '') {
        const ta = ref.current;
        if (!ta) return;

        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const selected = value.slice(start, end) || 'text';

        const next = value.slice(0, start) + before + selected + after + value.slice(end);
        setValue(next);

        const cursorStart = start + before.length;
        const cursorEnd = cursorStart + selected.length;

        requestAnimationFrame(() => {
            ta.focus();
            ta.setSelectionRange(cursorStart, cursorEnd);
        });
    }

    const tools = [
        { label: 'B', title: 'Bold', bold: true, action: () => insert('**', '**') },
        { label: 'I', title: 'Italic', italic: true, action: () => insert('*', '*') },
        { label: 'H2', title: 'Heading', action: () => insert('## ', '') },
        { label: '•', title: 'Bullet list', action: () => insert('- ', '') },
        { label: '1.', title: 'Numbered list', action: () => insert('1. ', '') },
        { label: '🔗', title: 'Link', action: () => insert('[', '](https://)') },
        { label: '❝', title: 'Quote', action: () => insert('> ', '') },
        { label: '—', title: 'Divider', action: () => insert('\n---\n', '') },
    ];

    const minHeight = `${rows * 1.6}rem`;

    return (
        <div className="border border-[var(--color-border-soft)] rounded-xl overflow-hidden bg-white focus-within:border-[var(--color-brand)] focus-within:ring-2 focus-within:ring-[var(--color-brand)]/10 transition-colors">
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[var(--color-border-soft)] bg-[var(--color-warm)] flex-wrap">
                {tools.map((t, i) => (
                    <button
                        key={i}
                        type="button"
                        title={t.title}
                        onClick={t.action}
                        className="w-8 h-8 text-xs text-gray-500 hover:text-[var(--color-brand)] hover:bg-white rounded-md transition-colors flex items-center justify-center"
                        style={{
                            fontWeight: t.bold ? 800 : 600,
                            fontStyle: t.italic ? 'italic' : 'normal',
                        }}
                    >
                        {t.label}
                    </button>
                ))}
                <div className="flex-1 min-w-[1rem]" />
                <button
                    type="button"
                    onClick={() => setMobilePreview((s) => !s)}
                    className="lg:hidden text-[11px] font-bold text-gray-500 hover:text-[var(--color-brand)] px-2 py-1 rounded-md"
                >
                    {mobilePreview ? '← Edit' : 'Preview →'}
                </button>
            </div>

            {/* Body: split pane on lg, toggle on mobile */}
            <div className="grid lg:grid-cols-2">
                <textarea
                    ref={ref}
                    name={name}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    rows={rows}
                    required={required}
                    placeholder={placeholder}
                    className={`w-full px-4 py-3 text-[13px] font-mono leading-relaxed outline-none resize-y border-0 bg-white ${mobilePreview ? 'hidden lg:block' : 'block'
                        }`}
                    style={{ minHeight }}
                />

                <div
                    className={`border-t lg:border-t-0 lg:border-l border-[var(--color-border-soft)] bg-[var(--color-warm)] px-5 py-4 overflow-y-auto ${mobilePreview ? 'block' : 'hidden lg:block'
                        }`}
                    style={{ minHeight, maxHeight: `${rows * 1.6 + 6}rem` }}
                >
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-3 sticky top-0 bg-[var(--color-warm)] pb-2">
                        Preview
                    </p>
                    {value.trim() ? (
                        <div
                            className="prose"
                            dangerouslySetInnerHTML={{ __html: html }}
                        />
                    ) : (
                        <p className="text-xs text-gray-400 italic">
                            Start typing to see the preview here.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}