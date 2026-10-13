const { generateCode, editProject } = require("./generators/geminiGenerator");
const { validateAndFixGeneratedFiles } = require("./validators/reactValidator");
const { validateJSXSyntax, autoFixJSX } = require("./validators/jsxValidator");
const {
  SYSTEM_PROMPT_WEB,
  SYSTEM_PROMPT_MOBILE,
  SYSTEM_PROMPT_EDIT,
  RULES_COMMON,
} = require("./prompts/system");

class VelocityEngine {
  constructor(options = {}) {
    if (!options.apiKey) {
      throw new Error(
        "VelocityEngine: apiKey is required. Get one at https://ai.google.dev/"
      );
    }

    this.apiKey = options.apiKey;
    this.model = options.model || "gemini-3.5-flash-lite";
    this.maxRetries = options.maxRetries || 3;
    this.retryDelayMs = options.retryDelayMs || 2000;
  }

  async generate({ prompt, type = "web" }) {
    if (!prompt || typeof prompt !== "string") {
      throw new Error("VelocityEngine: prompt is required and must be a string");
    }

    return await generateCode(prompt, type, {
      apiKey: this.apiKey,
      model: this.model,
      maxRetries: this.maxRetries,
      retryDelayMs: this.retryDelayMs,
    });
  }

  async edit({ instruction, currentFiles, type = "web" }) {
    if (!instruction || typeof instruction !== "string") {
      throw new Error("VelocityEngine: instruction is required");
    }
    if (!Array.isArray(currentFiles) || currentFiles.length === 0) {
      throw new Error("VelocityEngine: currentFiles must be a non-empty array");
    }

    return await editProject(instruction, currentFiles, type, {
      apiKey: this.apiKey,
      model: this.model,
      maxRetries: this.maxRetries,
      retryDelayMs: this.retryDelayMs,
    });
  }
}

module.exports = {
  VelocityEngine,
  generateCode,
  editProject,
  validateAndFixGeneratedFiles,
  validateJSXSyntax,
  autoFixJSX,
  SYSTEM_PROMPT_WEB,
  SYSTEM_PROMPT_MOBILE,
  SYSTEM_PROMPT_EDIT,
  RULES_COMMON,
};