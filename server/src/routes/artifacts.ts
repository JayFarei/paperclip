import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { artifactService } from "../services/artifacts.js";
import { assertCompanyAccess } from "./authz.js";

export function artifactRoutes(db: Db) {
  const router = Router();
  const svc = artifactService(db);

  // GET /companies/:companyId/artifacts/tree - aggregated tree across all projects
  router.get("/companies/:companyId/artifacts/tree", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);
    const entries = await svc.companyTree(companyId);
    res.json(entries);
  });

  // GET /projects/:projectId/artifacts/tree
  router.get("/projects/:projectId/artifacts/tree", async (req, res) => {
    const { projectId } = req.params;
    const { entries, companyId } = await svc.tree(projectId);
    assertCompanyAccess(req, companyId);
    res.json(entries);
  });

  // GET /projects/:projectId/artifacts/file?path=...
  router.get("/projects/:projectId/artifacts/file", async (req, res) => {
    const { projectId } = req.params;
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: "path query parameter is required" });
      return;
    }
    const { file, companyId } = await svc.readFile(projectId, filePath);
    assertCompanyAccess(req, companyId);
    res.json(file);
  });

  // POST /projects/:projectId/artifacts/file
  router.post("/projects/:projectId/artifacts/file", async (req, res) => {
    const { projectId } = req.params;
    const { path: filePath, body } = req.body as { path: string; body: string };
    if (!filePath || body == null) {
      res.status(400).json({ error: "path and body are required" });
      return;
    }
    const { companyId } = await svc.createFile(projectId, filePath, body);
    assertCompanyAccess(req, companyId);
    res.status(201).json({ ok: true });
  });

  // PUT /projects/:projectId/artifacts/file
  router.put("/projects/:projectId/artifacts/file", async (req, res) => {
    const { projectId } = req.params;
    const { path: filePath, body } = req.body as { path: string; body: string };
    if (!filePath || body == null) {
      res.status(400).json({ error: "path and body are required" });
      return;
    }
    const { companyId } = await svc.writeFile(projectId, filePath, body);
    assertCompanyAccess(req, companyId);
    res.json({ ok: true });
  });

  // DELETE /projects/:projectId/artifacts/file?path=...
  router.delete("/projects/:projectId/artifacts/file", async (req, res) => {
    const { projectId } = req.params;
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: "path query parameter is required" });
      return;
    }
    const { companyId } = await svc.deleteFile(projectId, filePath);
    assertCompanyAccess(req, companyId);
    res.json({ ok: true });
  });

  // GET /projects/:projectId/artifacts/versions?path=...
  router.get("/projects/:projectId/artifacts/versions", async (req, res) => {
    const { projectId } = req.params;
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: "path query parameter is required" });
      return;
    }
    const { versions, companyId } = await svc.listVersions(projectId, filePath);
    assertCompanyAccess(req, companyId);
    res.json(versions);
  });

  // GET /projects/:projectId/artifacts/versions/:version?path=...
  router.get("/projects/:projectId/artifacts/versions/:version", async (req, res) => {
    const { projectId, version } = req.params;
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: "path query parameter is required" });
      return;
    }
    const versionNum = parseInt(version, 10);
    if (isNaN(versionNum) || versionNum < 1) {
      res.status(400).json({ error: "Invalid version number" });
      return;
    }
    const { body, companyId } = await svc.readVersion(projectId, filePath, versionNum);
    assertCompanyAccess(req, companyId);
    res.json({ body });
  });

  return router;
}
