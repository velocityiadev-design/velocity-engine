// Velocity Engine — Edit Existing Project Example
//
// Before running: set GEMINI_API_KEY in your environment.

const { VelocityEngine } = require("../src/index");

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("❌ Please set GEMINI_API_KEY in your environment.");
    process.exit(1);
  }

  const engine = new VelocityEngine({ apiKey });

  // Example: pretend we already have a project
  const currentFiles = [
    {
      path: "src/App.jsx",
      content: `import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <h1 className="text-4xl font-bold text-gray-800">
        Welcome to my site
      </h1>
    </div>
  );
}`,
    },
  ];

  console.log("✏️  Editing project...\n");

  const result = await engine.edit({
    instruction: "Change the background to a purple gradient and make the title white",
    currentFiles,
    type: "web",
  });

  console.log("✅ Edit complete!\n");
  console.log(`📝 Summary: ${result.summary}\n`);
  console.log(`📁 Files modified: ${result.files.length}\n`);

  for (const file of result.files) {
    console.log(`   📄 ${file.path}`);
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});