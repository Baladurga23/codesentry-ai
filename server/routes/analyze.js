const express = require("express");
const axios = require("axios");
const router = express.Router();
const { analyzeCode } = require("../utils/geminiAnalyzer");

// Helper: Extract owner/repo from a GitHub URL
function parseGitHubUrl(url) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(".git", "") };
}

// Helper: Recursively fetch code files from a repo (limit for speed)
async function fetchRepoFiles(owner, repo, path = "", depth = 0) {
  if (depth > 3) return []; // safety limit: don't go too deep

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` },
  });

  let files = [];
  const skipFolders = ["node_modules", "dist", "build", ".git", "vendor"];

  for (const item of data) {
    if (item.type === "file" && /\.(js|jsx|ts|tsx|py|java)$/.test(item.name)) {
      files.push({ name: item.name, path: item.path, download_url: item.download_url });
    } else if (item.type === "dir" && !skipFolders.includes(item.name)) {
      const subFiles = await fetchRepoFiles(owner, repo, item.path, depth + 1);
      files.push(...subFiles);
      if (files.length >= 10) break; // stop early once we have enough
    }
  }
  return files;
}

// GET /api/fetch-repo?url=https://github.com/owner/repo
router.get("/fetch-repo", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "GitHub URL is required" });

    const parsed = parseGitHubUrl(url);
    if (!parsed) return res.status(400).json({ error: "Invalid GitHub URL" });

    const files = await fetchRepoFiles(parsed.owner, parsed.repo);

    // Limit to first 5 files for speed/testing
    const limitedFiles = files.slice(0, 5);

    // Fetch actual code content for each file
    const filesWithContent = await Promise.all(
      limitedFiles.map(async (file) => {
        const contentRes = await axios.get(file.download_url);
        return { name: file.name, path: file.path, content: contentRes.data };
      })
    );

    res.json({ owner: parsed.owner, repo: parsed.repo, fileCount: files.length, files: filesWithContent });
  } catch (err) {
    console.error("DETAILED ERROR:", err.response?.status, err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch repo files", details: err.message });
  }
});

// POST /api/analyze  { url: "github repo url" }
router.post("/analyze", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "GitHub URL is required" });

    const parsed = parseGitHubUrl(url);
    if (!parsed) return res.status(400).json({ error: "Invalid GitHub URL" });

    const files = await fetchRepoFiles(parsed.owner, parsed.repo);
    const limitedFiles = files.slice(0, 5);

    const filesWithContent = await Promise.all(
      limitedFiles.map(async (file) => {
        const contentRes = await axios.get(file.download_url);
        return { name: file.name, path: file.path, content: String(contentRes.data) };
      })
    );

    const analysis = await analyzeCode(filesWithContent);

    res.json({ owner: parsed.owner, repo: parsed.repo, analysis });
  } catch (err) {
    console.error("ANALYZE ERROR:", err.message);
    res.status(500).json({ error: "Failed to analyze repo", details: err.message });
  }
});

module.exports = router;