const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeCode(files) {
  const codeBlock = files
    .map((f) => `--- FILE: ${f.path} ---\n${f.content.slice(0, 2000)}`)
    .join("\n\n");

  const prompt = `
You are a senior code reviewer. Analyze the following code files from a GitHub repository.

For each issue you find, respond ONLY in this exact JSON format (an array of objects), with no extra text before or after:

[
  {
    "file": "filename",
    "severity": "Critical" | "Warning" | "Suggestion",
    "issue": "short description of the issue",
    "suggestion": "how to fix it"
  }
]

Also include one extra object at the end of the array with this shape:
{
  "file": "OVERALL",
  "severity": "Score",
  "issue": "Code Health Score: X/100",
  "suggestion": "one-line overall summary"
}

Here is the code:

${codeBlock}
`;

  const maxRetries = 4;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt,
      });

      const text = response.text;
      const cleaned = text.replace(/```json|```/g, "").trim();

      try {
        return JSON.parse(cleaned);
      } catch (e) {
        return { error: "Failed to parse AI response", raw: text };
      }
    } catch (err) {
      lastError = err;
      const isOverloaded = err.message && err.message.includes("503");
      if (isOverloaded && attempt < maxRetries) {
        const waitTime = attempt * 3000; // 3s, 6s, 9s...
        console.log(`Model overloaded, retrying in ${waitTime / 1000}s (attempt ${attempt}/${maxRetries})...`);
        await sleep(waitTime);
      } else {
        throw err;
      }
    }
  }

  throw lastError;
}

module.exports = { analyzeCode };