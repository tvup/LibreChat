import { useEffect, useState, useCallback, useRef } from 'react';
import { Quote } from 'lucide-react';
import { mainTextareaId } from '~/common';
import { insertTextAtCursor } from '~/utils/textarea';
import { useLocalize } from '~/hooks';

/**
 * "Markér tekst → Quote" UI-feature.
 *
 * Når brugeren markerer tekst inde i en chat-besked viser vi en floating
 * mini-knap nær selection. Klik → indsæt teksten som markdown-blockquote
 * (`> {tekst}`) i hovedchat-textarea'en, gør den focused, scroller til den.
 *
 * Begrænsninger:
 *   - Selections inde i textareas / inputs ignoreres (ellers ville man
 *     trigger på sin egen prompt).
 *   - Selections der spænder over flere chat-beskeder accepteres som de er
 *     — det er ofte hvad brugeren ønsker.
 */
export default function QuoteSelection() {
  const localize = useLocalize();
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isInsideEditableNode = useCallback((node: Node | null): boolean => {
    let cur: Node | null = node;
    while (cur) {
      if (cur.nodeType === Node.ELEMENT_NODE) {
        const el = cur as HTMLElement;
        const tag = el.tagName?.toLowerCase();
        if (tag === 'textarea' || tag === 'input' || el.isContentEditable) {
          return true;
        }
      }
      cur = cur.parentNode;
    }
    return false;
  }, []);

  const updateFromSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setPosition(null);
      setSelectedText('');
      return;
    }

    const text = sel.toString().trim();
    if (text.length < 2) {
      setPosition(null);
      setSelectedText('');
      return;
    }

    const anchor = sel.anchorNode;
    const focus = sel.focusNode;
    if (isInsideEditableNode(anchor) || isInsideEditableNode(focus)) {
      setPosition(null);
      setSelectedText('');
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setPosition(null);
      setSelectedText('');
      return;
    }

    /** Placér knappen lige under selection's bottom-left, viewport-koordinater. */
    setPosition({
      top: rect.bottom + window.scrollY + 6,
      left: rect.left + window.scrollX,
    });
    setSelectedText(text);
  }, [isInsideEditableNode]);

  useEffect(() => {
    const onSelectionChange = () => {
      /** Debounce med rAF så vi ikke beregner rect mens brugeren stadig drag'er. */
      window.requestAnimationFrame(updateFromSelection);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    /** Skjul ved scroll (rect bliver ugyldig). */
    const onScroll = () => setPosition(null);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      window.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, [updateFromSelection]);

  const handleQuote = useCallback(() => {
    if (!selectedText) return;
    const textarea = document.getElementById(mainTextareaId) as HTMLTextAreaElement | null;
    if (!textarea) return;

    const blockquote =
      selectedText
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n') + '\n\n';

    textarea.focus();
    /** Hvis textarea ikke er tom og ikke slutter på newline, præpend en newline. */
    const cursor = textarea.selectionStart ?? textarea.value.length;
    const before = textarea.value.slice(0, cursor);
    const needsLeadingNewline = before.length > 0 && !before.endsWith('\n');
    insertTextAtCursor(textarea, (needsLeadingNewline ? '\n' : '') + blockquote);

    /** Ryd selection så toolbar'en forsvinder. */
    window.getSelection()?.removeAllRanges();
    setPosition(null);
    setSelectedText('');
    textarea.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [selectedText]);

  if (!position) {
    return null;
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onMouseDown={(e) => {
        /** Forhindrer at click clear'er selection før vi når at læse den. */
        e.preventDefault();
      }}
      onClick={handleQuote}
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        zIndex: 50,
      }}
      className="flex items-center gap-1 rounded-md border border-border-medium bg-surface-primary px-2 py-1 text-xs font-medium text-text-primary shadow-md hover:bg-surface-hover"
      title={localize('com_ui_quote_selection') || 'Quote selection'}
    >
      <Quote className="size-3" />
      {localize('com_ui_quote_selection') || 'Quote'}
    </button>
  );
}
