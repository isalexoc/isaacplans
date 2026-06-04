import type { PortableTextBlock, PortableTextSpan } from "./types";

export function generateKey(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseInlineMarks(text: string): PortableTextSpan[] {
  const children: PortableTextSpan[] = [];
  let current = "";
  let inBold = false;

  const flush = () => {
    if (current) {
      children.push({
        _type: "span",
        _key: generateKey(),
        text: current,
        marks: inBold ? ["strong"] : [],
      });
      current = "";
    }
  };

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "*" && text[i + 1] === "*") {
      flush();
      inBold = !inBold;
      i++;
    } else {
      current += text[i];
    }
  }
  flush();

  if (children.length === 0) {
    children.push({ _type: "span", _key: generateKey(), text, marks: [] });
  }

  return children;
}

export function createTextBlock(text: string): PortableTextBlock {
  const children = text.trim()
    ? parseInlineMarks(text)
    : [{ _type: "span" as const, _key: generateKey(), text: "", marks: [] }];

  return {
    _type: "block",
    _key: generateKey(),
    style: "normal",
    children,
    markDefs: [],
  };
}

export function createHeadingBlock(text: string, level: number): PortableTextBlock {
  const styleMap: Record<number, string> = { 1: "h1", 2: "h2", 3: "h3", 4: "h4" };
  return {
    _type: "block",
    _key: generateKey(),
    style: styleMap[level] ?? "h2",
    children: text.trim() ? parseInlineMarks(text) : [{ _type: "span", _key: generateKey(), text, marks: [] }],
    markDefs: [],
  };
}

export function createListBlocks(items: string[]): PortableTextBlock[] {
  return items.map((item) => ({
    _type: "block",
    _key: generateKey(),
    style: "normal",
    listItem: "bullet" as const,
    children: item.trim() ? parseInlineMarks(item) : [{ _type: "span", _key: generateKey(), text: item, marks: [] }],
    markDefs: [],
  }));
}

export function textToBlocks(text: string): PortableTextBlock[] {
  const blocks: PortableTextBlock[] = [];
  const lines = text.split("\n");

  let currentParagraph: string[] = [];
  let listItems: string[] = [];
  let inList = false;

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const joined = currentParagraph.join(" ").trim();
      if (joined) blocks.push(createTextBlock(joined));
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push(...createListBlocks(listItems));
      listItems = [];
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push(createHeadingBlock(headingMatch[2].trim(), headingMatch[1].length));
      continue;
    }

    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      inList = true;
      listItems.push(listMatch[1].trim());
      continue;
    }

    if (inList) flushList();
    currentParagraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks;
}
