// Velocity Engine — React Validation

const { autoFixJSX, validateJSXSyntax } = require("./jsxValidator");

const FORBIDDEN_IMPORTS = [
  "lucide-react", "react-icons", "heroicons", "@heroicons",
  "react-feather", "bootstrap-icons", "font-awesome", "@fortawesome",
  "phosphor-react", "react-bootstrap-icons", "tabler-icons-react",
];

const FORBIDDEN_PACKAGES = [
  "lucide-react", "react-icons", "heroicons", "@heroicons/react",
  "react-feather", "bootstrap-icons", "font-awesome",
  "@fortawesome/react-fontawesome", "phosphor-react",
  "react-bootstrap-icons", "tabler-icons-react",
  "framer-motion", "react-router-dom", "react-spring", "styled-components",
];

function fixReactHooks(content) {
  if (!content.includes("React") && !content.includes("useState") && !content.includes("useEffect")) {
    return content;
  }

  let fixed = content;
  const hooks = ["useState", "useEffect", "useRef", "useMemo", "useCallback", "useReducer", "useContext", "useLayoutEffect"];

  for (const hook of hooks) {
    const regex = new RegExp(`(?<![A-Za-z._])${hook}\\s*\\(`, "g");
    fixed = fixed.replace(regex, `React.${hook}(`);
  }

  return fixed;
}

function fixReactImports(content) {
  let fixed = content;
  const namedImportRegex = /import\s*\{\s*(useState|useEffect|useRef|useMemo|useCallback|useReducer|useContext|useLayoutEffect)[^}]*\}\s*from\s*['"]react['"];?/g;

  if (namedImportRegex.test(fixed)) {
    fixed = fixed.replace(namedImportRegex, "import React from 'react';");
  }

  return fixed;
}

function hasForbiddenImports(content) {
  for (const lib of FORBIDDEN_IMPORTS) {
    if (content.includes(`from "${lib}"`) || content.includes(`from '${lib}'`)) return lib;
    if (content.includes(`require("${lib}")`) || content.includes(`require('${lib}')`)) return lib;
  }
  return null;
}

function cleanPackageJson(content) {
  try {
    const pkg = JSON.parse(content);
    let changed = false;
    for (const lib of FORBIDDEN_PACKAGES) {
      if (pkg.dependencies && pkg.dependencies[lib]) {
        delete pkg.dependencies[lib];
        changed = true;
      }
      if (pkg.devDependencies && pkg.devDependencies[lib]) {
        delete pkg.devDependencies[lib];
        changed = true;
      }
    }
    return changed ? JSON.stringify(pkg, null, 2) : null;
  } catch (e) {
    return null;
  }
}

function replaceIconImports(content) {
  let cleaned = content;
  cleaned = cleaned.replace(
    /import\s*\{[^}]*\}\s*from\s*['"](lucide-react|react-icons[^'"]*|@heroicons\/react|heroicons\/react|react-feather|bootstrap-icons|@fortawesome\/react-fontawesome|phosphor-react|react-bootstrap-icons|tabler-icons-react)['"];?\s*\n?/g,
    ""
  );
  cleaned = cleaned.replace(
    /import\s+\w+\s+from\s*['"](lucide-react|react-icons[^'"]*)['"];?\s*\n?/g,
    ""
  );
  return cleaned;
}

function checkDuplicateImages(content) {
  const hookRegex = /const\s+(\w+)\s*=\s*useImages\s*\(\s*["']([^"']+)["']/g;
  const hooks = {};
  let match;
  while ((match = hookRegex.exec(content)) !== null) {
    hooks[match[1]] = match[2];
  }

  const imgRegex = /src\s*=\s*\{\s*(\w+)\s*\[\s*0\s*\]\s*\??\.\s*url\s*\}/g;
  const usedVars = [];
  while ((match = imgRegex.exec(content)) !== null) {
    usedVars.push(match[1]);
  }

  const counts = {};
  for (const v of usedVars) {
    counts[v] = (counts[v] || 0) + 1;
  }

  return Object.entries(counts)
    .filter(([v, count]) => count > 1 && hooks[v])
    .map(([v, count]) => ({ variable: v, keyword: hooks[v], count }));
}

function validateAndFixGeneratedFiles(files) {
  const errors = [];
  const fixedFiles = [];

  for (const file of files) {
    let content = file.content;

    const beforeImports = content;
    content = fixReactImports(content);
    if (content !== beforeImports) errors.push(`${file.path} : import React corrigé`);

    const beforeHooks = content;
    content = fixReactHooks(content);
    if (content !== beforeHooks) errors.push(`${file.path} : hooks préfixés React.`);

    const forbidden = hasForbiddenImports(content);
    if (forbidden) {
      content = replaceIconImports(content);
      errors.push(`${file.path} : import ${forbidden} supprimé`);
    }

    if (file.path === "package.json") {
      const cleaned = cleanPackageJson(content);
      if (cleaned) {
        content = cleaned;
        errors.push(`package.json : dépendances interdites supprimées`);
      }
    }

    if (file.path === "vite.config.js") {
      const before = content;
      content = content.replace(/^\s*base\s*:\s*['"][^'"]*['"]\s*,?\s*$/gm, "");
      content = content.replace(/server\s*:\s*\{[\s\S]*?\},?/g, "");
      const newServerBlock = `server: {
    host: '0.0.0.0',
    allowedHosts: true,
    hmr: { protocol: 'wss', clientPort: 443 },
  },`;
      content = content.replace(/defineConfig\s*\(\s*\{/, `defineConfig({\n  ${newServerBlock}`);
      if (content !== before) errors.push(`${file.path} : vite config corrigé`);
    }

    if (file.path.endsWith(".jsx") || file.path.endsWith(".js")) {
      let attempts = 0;
      let jsxError = validateJSXSyntax(content, file.path);
      while (jsxError && attempts < 3) {
        const fixed = autoFixJSX(content);
        if (fixed === content) break;
        content = fixed;
        jsxError = validateJSXSyntax(content, file.path);
        attempts++;
      }
      if (!jsxError && attempts > 0) errors.push(`${file.path} : JSX corrigé (${attempts} tentative(s))`);
    }

    fixedFiles.push({ path: file.path, content });
  }

  return { valid: errors.length === 0, files: fixedFiles, errors };
}

module.exports = {
  fixReactHooks,
  fixReactImports,
  hasForbiddenImports,
  cleanPackageJson,
  replaceIconImports,
  checkDuplicateImages,
  validateAndFixGeneratedFiles,
  FORBIDDEN_IMPORTS,
  FORBIDDEN_PACKAGES,
};