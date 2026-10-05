const fs = require('node:fs');
const path = require('node:path');

function extractStoryTestCases(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return [];
  }

  const lines = markdown.split(/\r?\n/);
  const cases = [];
  let current = null;

  for (const line of lines) {
    const match = /^###\s+(TC-[0-9]+)\s*:\s*(.*)$/.exec(line.trim());
    if (match) {
      if (current) {
        cases.push(current);
      }
      current = {
        id: match[1],
        title: match[2].trim(),
        body: [],
      };
      continue;
    }

    if (current) {
      current.body.push(line);
    }
  }

  if (current) {
    cases.push(current);
  }

  return cases.map((entry) => ({
    ...entry,
    summary: entry.body.join('\n').trim(),
  }));
}

function resolveStorySpecPath(storyId, rootDir = path.join(__dirname, '..', 'specs')) {
  if (!storyId || typeof storyId !== 'string') {
    return null;
  }

  const normalized = storyId.trim();
  const candidateFolders = fs.existsSync(rootDir)
    ? fs.readdirSync(rootDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .filter((entry) => entry.name.toLowerCase() === normalized.toLowerCase())
    : [];

  if (candidateFolders.length > 0) {
    const folder = path.join(rootDir, candidateFolders[0].name);
    const files = fs.readdirSync(folder)
      .filter((file) => /\.md$/i.test(file))
      .sort();
    if (files.length > 0) {
      return path.join(folder, files[0]);
    }
  }

  const markdownFiles = [];
  if (fs.existsSync(rootDir)) {
    walk(rootDir, markdownFiles);
  }

  const match = markdownFiles.find((filePath) => filePath.toLowerCase().includes(normalized.toLowerCase()));
  return match || null;
}

function walk(currentDir, result) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, result);
      continue;
    }
    if (/\.md$/i.test(entry.name)) {
      result.push(fullPath);
    }
  }
}

module.exports = {
  extractStoryTestCases,
  resolveStorySpecPath,
};
