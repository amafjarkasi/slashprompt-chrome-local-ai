import { findTriggerMatch, type TriggerMatch } from '../shared/trigger.js';

export type EditableElement = HTMLTextAreaElement | HTMLInputElement | HTMLElement;

const SUPPORTED_INPUT_TYPES = new Set(['text', 'search', 'url', 'email', '']);

export function isEditableTarget(el: EventTarget | null): el is EditableElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement) {
    return !el.readOnly && !el.disabled;
  }
  if (el instanceof HTMLInputElement) {
    return (
      SUPPORTED_INPUT_TYPES.has(el.type.toLowerCase()) &&
      !el.readOnly &&
      !el.disabled
    );
  }
  return el.isContentEditable;
}

export function readTargetTrigger(
  el: EditableElement,
  prefix: string
): TriggerMatch | null {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const cursor = el.selectionStart ?? el.value.length;
    return findTriggerMatch(el.value, cursor, prefix);
  }

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return null;

  // Compute text and cursor offset within the contenteditable element
  const preRange = document.createRange();
  preRange.selectNodeContents(el);
  preRange.setEnd(range.startContainer, range.startOffset);
  const beforeText = preRange.toString();
  return findTriggerMatch(beforeText, beforeText.length, prefix);
}

export function replaceTargetRange(
  el: EditableElement,
  start: number,
  end: number,
  replacement: string
): void {
  el.focus();

  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    el.setRangeText(replacement, start, end, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  // Contenteditable: map linear character offsets [start, end] to DOM Text nodes
  const textRange = createRangeFromOffsets(el, start, end);
  if (!textRange) return;

  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(textRange);
  }

  // execCommand('insertText') keeps undo stack and works with ProseMirror/Lexical/React
  const inserted = document.execCommand('insertText', false, replacement);
  if (!inserted) {
    textRange.deleteContents();
    const node = document.createTextNode(replacement);
    textRange.insertNode(node);
    textRange.setStartAfter(node);
    textRange.collapse(true);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(textRange);
    }
    el.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: replacement,
      })
    );
  }
}

function createRangeFromOffsets(
  root: HTMLElement,
  start: number,
  end: number
): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let startNode: Text | null = null;
  let startLocal = 0;
  let endNode: Text | null = null;
  let endLocal = 0;

  let node = walker.nextNode() as Text | null;
  while (node) {
    const len = node.nodeValue?.length ?? 0;
    const nextOffset = currentOffset + len;

    if (!startNode && start >= currentOffset && start <= nextOffset) {
      startNode = node;
      startLocal = start - currentOffset;
    }
    if (!endNode && end >= currentOffset && end <= nextOffset) {
      endNode = node;
      endLocal = end - currentOffset;
      break;
    }

    currentOffset = nextOffset;
    node = walker.nextNode() as Text | null;
  }

  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, startLocal);
  range.setEnd(endNode, endLocal);
  return range;
}

export function getTargetAnchorRect(el: EditableElement): DOMRect {
  if (el.isContentEditable) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) {
        return rect;
      }
    }
  }
  return el.getBoundingClientRect();
}
