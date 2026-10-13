// Velocity Engine — JSX Validation

const SELF_CLOSING = new Set([
  "br", "hr", "img", "input", "meta", "link", "area", "base", "col",
  "embed", "source", "track", "wbr", "path", "circle", "rect", "line",
  "polyline", "polygon", "ellipse", "use", "stop",
]);

function autoFixJSX(content) {
  let fixed = content;
  const tagRegex = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(\/?)>/g;
  const tags = [];
  let match;

  while ((match = tagRegex.exec(content)) !== null) {
    const isClosing = match[1] === "/";
    const tagName = match[2].toLowerCase();
    const isSelfClosed = match[4] === "/" || SELF_CLOSING.has(tagName);
    tags.push({
      isClosing,
      tagName,
      isSelfClosed,
      index: match.index,
      length: match[0].length,
    });
  }

  const stack = [];
  const corrections = [];

  for (const tag of tags) {
    if (tag.isClosing) {
      if (stack.length === 0) continue;
      const lastOpen = stack.pop();
      if (lastOpen.tagName !== tag.tagName) {
        corrections.push({
          index: tag.index,
          length: tag.length,
          newTag: `</${lastOpen.tagName}>`,
        });
      }
    } else if (!tag.isSelfClosed) {
      stack.push(tag);
    }
  }

  corrections.sort((a, b) => b.index - a.index);
  for (const c of corrections) {
    fixed = fixed.slice(0, c.index) + c.newTag + fixed.slice(c.index + c.length);
  }

  const missingCloses = [];
  while (stack.length > 0) {
    const lastOpen = stack.pop();
    missingCloses.push(`</${lastOpen.tagName}>`);
  }

  if (missingCloses.length > 0) {
    const lastDivClose = fixed.lastIndexOf("</div>");
    if (lastDivClose > 0) {
      fixed = fixed.slice(0, lastDivClose) + missingCloses.join("") + fixed.slice(lastDivClose);
    }
  }

  return fixed;
}

function validateJSXSyntax(content, filePath = "file") {
  let cleaned = content;
  cleaned = cleaned.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  cleaned = cleaned.replace(/"([^"\\]|\\.)*"/g, '""');
  cleaned = cleaned.replace(/'([^'\\]|\\.)*'/g, "''");
  cleaned = cleaned.replace(/`([^`\\]|\\.)*`/g, "``");

  const tagStack = [];
  const tagRegex = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(\/?)>/g;
  let match;

  while ((match = tagRegex.exec(cleaned)) !== null) {
    const isClosing = match[1] === "/";
    const tagName = match[2].toLowerCase();
    const isSelfClosed = match[4] === "/" || SELF_CLOSING.has(tagName);

    if (isClosing) {
      if (tagStack.length === 0) {
        return `Balise </${tagName}> fermée sans ouverture`;
      }
      const lastOpen = tagStack.pop();
      if (lastOpen.name !== tagName) {
        return `Balise </${tagName}> ne correspond pas à <${lastOpen.name}>`;
      }
    } else if (!isSelfClosed) {
      tagStack.push({ name: tagName, index: match.index });
    }
  }

  if (tagStack.length > 0) {
    const last = tagStack[tagStack.length - 1];
    return `Balise <${last.name}> non fermée`;
  }

  return null;
}

module.exports = { autoFixJSX, validateJSXSyntax, SELF_CLOSING };