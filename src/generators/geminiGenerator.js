// Velocity Engine — Gemini Generator

const { GoogleGenAI } = require("@google/genai");
const {
  SYSTEM_PROMPT_WEB,
  SYSTEM_PROMPT_MOBILE,
  SYSTEM_PROMPT_EDIT,
} = require("../prompts/system");
const {
  validateAndFixGeneratedFiles,
  hasForbiddenImports,
  checkDuplicateImages,
} = require("../validators/reactValidator");

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJSON(text) {
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("Aucun JSON trouvé dans la réponse Gemini");
  }

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (e) {
    throw new Error("JSON invalide dans la réponse Gemini");
  }
}

async function generateCode(prompt, type, options) {
  const { apiKey, model, maxRetries, retryDelayMs } = options;
  const ai = new GoogleGenAI({ apiKey });

  const systemPrompt = type === "mobile" ? SYSTEM_PROMPT_MOBILE : SYSTEM_PROMPT_WEB;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const interaction = await ai.interactions.create({
        model,
        input: `${systemPrompt}\n\nDemande utilisateur :\n${prompt}`,
      });

      const text = interaction.output_text;
      if (!text) throw new Error("Réponse vide de Gemini");

      const data = parseJSON(text);

      if (!data.projectName || !Array.isArray(data.files) || data.files.length === 0) {
        throw new Error("Structure JSON invalide");
      }

      for (const file of data.files) {
        if (!file.path || typeof file.content !== "string" || file.content.length < 10) {
          throw new Error(`Fichier invalide : ${file.path || "sans nom"}`);
        }
      }

      const paths = data.files.map((f) => f.path);
      if (type === "web") {
        const required = ["package.json", "index.html", "src/main.jsx", "src/App.jsx", "src/index.css"];
        const missing = required.filter((r) => !paths.includes(r));
        if (missing.length > 0) {
          throw new Error(`Fichiers web manquants : ${missing.join(", ")}`);
        }
      } else {
        const required = ["package.json", "app.json", "App.js"];
        const missing = required.filter((r) => !paths.includes(r));
        if (missing.length > 0) {
          throw new Error(`Fichiers mobiles manquants : ${missing.join(", ")}`);
        }
      }

      const validation = validateAndFixGeneratedFiles(data.files);
      if (validation.errors.length > 0) {
        console.warn(`🔧 [Validation] ${validation.errors.length} correction(s) appliquée(s)`);
      }

      const stillForbidden = validation.files.find((f) => hasForbiddenImports(f.content));
      if (stillForbidden) {
        throw new Error("Le projet utilise encore des librairies interdites");
      }

      const appFile = validation.files.find((f) => f.path === "src/App.jsx" || f.path === "App.js");
      if (appFile) {
        const dupes = checkDuplicateImages(appFile.content);
        if (dupes.length > 0) {
          throw new Error(`Images dupliquées : ${dupes.map((d) => d.variable).join(", ")}`);
        }
      }

      data.files = validation.files;
      if (!data.type) data.type = type;
      return data;
    } catch (err) {
      lastError = err;
      const isOverload = err.message?.includes("503") || err.message?.includes("high demand");

      if (isOverload && attempt < maxRetries) {
        const delay = retryDelayMs * Math.pow(2, attempt - 1);
        console.warn(`⚠️ Gemini surchargé (${attempt}/${maxRetries}), retry dans ${delay}ms`);
        await sleep(delay);
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error("Gemini indisponible après plusieurs tentatives");
}

async function editProject(instruction, currentFiles, type, options) {
  const { apiKey, model, maxRetries, retryDelayMs } = options;
  const ai = new GoogleGenAI({ apiKey });

  const MAX_FILES = 30;
  const MAX_FILE_SIZE = 20000;

  const filesToSend = currentFiles
    .filter((f) => typeof f.content === "string" && f.content.length > 0)
    .slice(0, MAX_FILES)
    .map((f) => ({
      path: f.path,
      content: f.content.length > MAX_FILE_SIZE
        ? f.content.slice(0, MAX_FILE_SIZE) + "\n\n// [tronqué]"
        : f.content,
    }));

  const filesContext = filesToSend
    .map((f) => `### Fichier : ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  const userPrompt = `Type : ${type}\n\nFICHIERS ACTUELS :\n${filesContext}\n\nDEMANDE :\n${instruction.trim()}\n\nRenvoie uniquement les fichiers modifiés.`;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const interaction = await ai.interactions.create({
        model,
        input: `${SYSTEM_PROMPT_EDIT}\n\n${userPrompt}`,
      });

      const text = interaction.output_text;
      if (!text) throw new Error("Réponse vide");

      const data = parseJSON(text);

      if (data.error) throw new Error(data.message || "Modification refusée");
      if (!Array.isArray(data.files) || data.files.length === 0) {
        throw new Error("Aucun fichier modifié");
      }

      for (const file of data.files) {
        if (!file.path || typeof file.content !== "string" || file.content.length < 5) {
          throw new Error(`Fichier invalide : ${file.path}`);
        }
      }

      const validation = validateAndFixGeneratedFiles(data.files);
      const stillForbidden = validation.files.find((f) => hasForbiddenImports(f.content));
      if (stillForbidden) throw new Error("Librairies interdites");

      return {
        summary: data.summary || "Modification appliquée",
        files: validation.files,
      };
    } catch (err) {
      lastError = err;
      const isOverload = err.message?.includes("503") || err.message?.includes("high demand");

      if (isOverload && attempt < maxRetries) {
        const delay = retryDelayMs * Math.pow(2, attempt - 1);
        await sleep(delay);
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error("Gemini indisponible après plusieurs tentatives");
}

module.exports = { generateCode, editProject };