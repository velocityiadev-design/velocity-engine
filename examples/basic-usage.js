

// Velocity Engine — Basic Usage Example
//
// Before running:
// 1. Get a Gemini API key: https://ai.google.dev/
// 2. Set it in your environment:
//    - Windows:  set GEMINI_API_KEY=your_key_here
//    - Mac/Linux: export GEMINI_API_KEY=your_key_here
// 3. Run: node examples/basic-usage.js

const { VelocityEngine } = require("../src/index");

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("❌ Please set GEMINI_API_KEY in your environment.");
    console.error("   Get one free at: https://ai.google.dev/");
    process.exit(1);
  }

  const engine = new VelocityEngine({ apiKey });

  console.log("🚀 Generating a website...\n");

  const result = await engine.generate({
    prompt: "Create a website for an African restaurant in Kinshasa with menu and reservation",
    type: "web",
  });

  console.log("✅ Generation complete!\n");
  console.log(`📦 Project name: ${result.projectName}`);
  console.log(`📁 Files generated: ${result.files.length}\n`);

  for (const file of result.files) {
    console.log(`   📄 ${file.path} (${file.content.length} bytes)`);
  }

  console.log("\n💡 Next steps:");
  console.log("   1. Save the files to disk");
  console.log("   2. Run: npm install && npm run dev");
  console.log("   3. Open http://localhost:5173\n");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});

