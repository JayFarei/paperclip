import path from "node:path";
import fs from "node:fs/promises";
import { eq, desc, asc, and } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { projects, projectWorkspaces } from "@paperclipai/db";
import type { ArtifactFile, ArtifactTreeEntry, ArtifactVersionInfo } from "@paperclipai/shared";

const VERSIONS_DIR = "_versions";
const ALLOWED_EXTENSIONS = new Set([".md", ".html"]);

function contentTypeFromExt(ext: string): "markdown" | "html" {
  return ext === ".html" ? "html" : "markdown";
}

function validateRelativePath(relativePath: string): void {
  if (!relativePath || relativePath.includes("..") || path.isAbsolute(relativePath)) {
    throw Object.assign(new Error("Invalid path"), { status: 400 });
  }
  // Block access to _versions directory through file operations
  const normalized = relativePath.split("/").filter(Boolean);
  if (normalized[0] === VERSIONS_DIR) {
    throw Object.assign(new Error("Cannot access _versions directory directly"), { status: 400 });
  }
}

function ensureWithinRoot(resolved: string, root: string): void {
  const normalizedResolved = path.resolve(resolved);
  const normalizedRoot = path.resolve(root);
  if (!normalizedResolved.startsWith(normalizedRoot + "/") && normalizedResolved !== normalizedRoot) {
    throw Object.assign(new Error("Path traversal detected"), { status: 400 });
  }
}

export function artifactService(db: Db) {
  async function resolveArtifactsRoot(projectId: string): Promise<{ root: string; companyId: string }> {
    const [project] = await db
      .select({ id: projects.id, companyId: projects.companyId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!project) {
      throw Object.assign(new Error("Project not found"), { status: 404 });
    }

    const workspaceRows = await db
      .select()
      .from(projectWorkspaces)
      .where(eq(projectWorkspaces.projectId, projectId))
      .orderBy(desc(projectWorkspaces.isPrimary), asc(projectWorkspaces.createdAt), asc(projectWorkspaces.id))
      .limit(1);

    const workspace = workspaceRows[0];
    if (!workspace?.cwd) {
      throw Object.assign(new Error("Project has no workspace with a local directory configured"), { status: 400 });
    }

    const root = path.join(workspace.cwd, "artifacts");
    return { root, companyId: project.companyId };
  }

  async function tree(projectId: string): Promise<{ entries: ArtifactTreeEntry[]; companyId: string }> {
    const { root, companyId } = await resolveArtifactsRoot(projectId);
    const entries = await scanDir(root, "");
    return { entries, companyId };
  }

  async function readFile(projectId: string, relativePath: string): Promise<{ file: ArtifactFile; companyId: string }> {
    validateRelativePath(relativePath);
    const { root, companyId } = await resolveArtifactsRoot(projectId);
    const fullPath = path.resolve(root, relativePath);
    ensureWithinRoot(fullPath, root);

    let body: string;
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      [body, stat] = await Promise.all([
        fs.readFile(fullPath, "utf-8"),
        fs.stat(fullPath),
      ]);
    } catch {
      throw Object.assign(new Error("File not found"), { status: 404 });
    }

    const ext = path.extname(relativePath).toLowerCase();
    const title = path.basename(relativePath, ext);
    const versionCount = await countVersions(root, relativePath);

    return {
      file: {
        path: relativePath,
        title,
        contentType: contentTypeFromExt(ext),
        body,
        versionCount,
        lastModified: stat.mtime.toISOString(),
      },
      companyId,
    };
  }

  async function countVersions(root: string, relativePath: string): Promise<number> {
    const ext = path.extname(relativePath);
    const withoutExt = relativePath.slice(0, -ext.length);
    const versionsDir = path.join(root, VERSIONS_DIR, withoutExt);
    try {
      const entries = await fs.readdir(versionsDir);
      return entries.filter((e) => e.startsWith("v") && e.endsWith(ext)).length;
    } catch {
      return 0;
    }
  }

  async function archiveCurrentVersion(root: string, relativePath: string): Promise<void> {
    const fullPath = path.join(root, relativePath);
    let currentContent: string;
    try {
      currentContent = await fs.readFile(fullPath, "utf-8");
    } catch {
      return; // No existing file to archive
    }

    const ext = path.extname(relativePath);
    const withoutExt = relativePath.slice(0, -ext.length);
    const versionsDir = path.join(root, VERSIONS_DIR, withoutExt);
    await fs.mkdir(versionsDir, { recursive: true });

    const nextVersion = (await countVersions(root, relativePath)) + 1;
    const versionPath = path.join(versionsDir, `v${nextVersion}${ext}`);
    await fs.writeFile(versionPath, currentContent, "utf-8");
  }

  async function writeFile(projectId: string, relativePath: string, body: string): Promise<{ companyId: string }> {
    validateRelativePath(relativePath);
    const { root, companyId } = await resolveArtifactsRoot(projectId);
    const fullPath = path.resolve(root, relativePath);
    ensureWithinRoot(fullPath, root);

    await archiveCurrentVersion(root, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, body, "utf-8");
    return { companyId };
  }

  async function createFile(projectId: string, relativePath: string, body: string): Promise<{ companyId: string }> {
    validateRelativePath(relativePath);
    const { root, companyId } = await resolveArtifactsRoot(projectId);
    const fullPath = path.resolve(root, relativePath);
    ensureWithinRoot(fullPath, root);

    let fileExists = false;
    try {
      await fs.access(fullPath);
      fileExists = true;
    } catch {
      // file doesn't exist, which is what we want
    }
    if (fileExists) {
      throw Object.assign(new Error("File already exists"), { status: 409 });
    }

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, body, "utf-8");
    return { companyId };
  }

  async function deleteFile(projectId: string, relativePath: string): Promise<{ companyId: string }> {
    validateRelativePath(relativePath);
    const { root, companyId } = await resolveArtifactsRoot(projectId);
    const fullPath = path.resolve(root, relativePath);
    ensureWithinRoot(fullPath, root);

    // Archive before deleting
    await archiveCurrentVersion(root, relativePath);
    try {
      await fs.unlink(fullPath);
    } catch {
      throw Object.assign(new Error("File not found"), { status: 404 });
    }
    return { companyId };
  }

  async function listVersions(projectId: string, relativePath: string): Promise<{ versions: ArtifactVersionInfo[]; companyId: string }> {
    validateRelativePath(relativePath);
    const { root, companyId } = await resolveArtifactsRoot(projectId);

    const ext = path.extname(relativePath);
    const withoutExt = relativePath.slice(0, -ext.length);
    const versionsDir = path.join(root, VERSIONS_DIR, withoutExt);

    let entries: string[];
    try {
      entries = await fs.readdir(versionsDir);
    } catch {
      return { versions: [], companyId };
    }

    const versions: ArtifactVersionInfo[] = [];
    for (const entry of entries) {
      const match = /^v(\d+)/.exec(entry);
      if (!match || !entry.endsWith(ext)) continue;
      const versionPath = path.join(versionsDir, entry);
      const stat = await fs.stat(versionPath);
      versions.push({
        version: parseInt(match[1], 10),
        path: `${VERSIONS_DIR}/${withoutExt}/${entry}`,
        createdAt: stat.mtime.toISOString(),
      });
    }

    versions.sort((a, b) => a.version - b.version);
    return { versions, companyId };
  }

  async function readVersion(projectId: string, relativePath: string, version: number): Promise<{ body: string; companyId: string }> {
    validateRelativePath(relativePath);
    const { root, companyId } = await resolveArtifactsRoot(projectId);

    const ext = path.extname(relativePath);
    const withoutExt = relativePath.slice(0, -ext.length);
    const versionFile = path.join(root, VERSIONS_DIR, withoutExt, `v${version}${ext}`);
    ensureWithinRoot(versionFile, root);

    try {
      const body = await fs.readFile(versionFile, "utf-8");
      return { body, companyId };
    } catch {
      throw Object.assign(new Error("Version not found"), { status: 404 });
    }
  }

  async function companyTree(companyId: string): Promise<ArtifactTreeEntry[]> {
    // Get all projects in this company that have workspaces with cwd
    const rows = await db
      .select({
        projectId: projects.id,
        projectName: projects.name,
        cwd: projectWorkspaces.cwd,
      })
      .from(projects)
      .innerJoin(
        projectWorkspaces,
        and(
          eq(projectWorkspaces.projectId, projects.id),
          eq(projectWorkspaces.companyId, companyId),
        ),
      )
      .where(eq(projects.companyId, companyId))
      .orderBy(asc(projects.name));

    // Deduplicate by projectId (take first workspace per project)
    const seen = new Set<string>();
    const uniqueRows: typeof rows = [];
    for (const row of rows) {
      if (row.cwd && !seen.has(row.projectId)) {
        seen.add(row.projectId);
        uniqueRows.push(row);
      }
    }

    const result: ArtifactTreeEntry[] = [];
    for (const row of uniqueRows) {
      if (!row.cwd) continue;
      const root = path.join(row.cwd, "artifacts");
      // Scan this project's artifacts
      let children: ArtifactTreeEntry[];
      try {
        children = await scanDir(root, "");
      } catch {
        children = [];
      }
      // Only include projects that have artifacts
      if (children.length > 0) {
        result.push({
          name: row.projectName,
          path: row.projectId,
          type: "directory",
          children,
        });
      }
    }

    return result;
  }

  // Extracted scan logic so it can be reused
  async function scanDir(dir: string, relativeTo: string): Promise<ArtifactTreeEntry[]> {
    let dirEntries: string[];
    try {
      dirEntries = await fs.readdir(dir);
    } catch {
      return [];
    }

    const result: ArtifactTreeEntry[] = [];
    for (const name of dirEntries) {
      if (name.startsWith(".") || name === VERSIONS_DIR) continue;

      const fullPath = path.join(dir, name);
      const relPath = relativeTo ? path.join(relativeTo, name) : name;
      const stat = await fs.stat(fullPath);

      if (stat.isDirectory()) {
        const children = await scanDir(fullPath, relPath);
        result.push({
          name,
          path: relPath,
          type: "directory",
          children,
        });
      } else if (stat.isFile()) {
        const ext = path.extname(name).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) continue;
        result.push({
          name,
          path: relPath,
          type: "file",
          contentType: contentTypeFromExt(ext),
          lastModified: stat.mtime.toISOString(),
          size: stat.size,
        });
      }
    }
    return result;
  }

  return {
    resolveArtifactsRoot,
    tree,
    companyTree,
    readFile,
    writeFile,
    createFile,
    deleteFile,
    listVersions,
    readVersion,
  };
}
