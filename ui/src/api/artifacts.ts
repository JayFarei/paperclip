import type { ArtifactFile, ArtifactTreeEntry, ArtifactVersionInfo } from "@paperclipai/shared";
import { api } from "./client";

export const artifactsApi = {
  companyTree: (companyId: string) =>
    api.get<ArtifactTreeEntry[]>(`/companies/${companyId}/artifacts/tree`),

  tree: (projectId: string) =>
    api.get<ArtifactTreeEntry[]>(`/projects/${projectId}/artifacts/tree`),

  readFile: (projectId: string, path: string) =>
    api.get<ArtifactFile>(`/projects/${projectId}/artifacts/file?path=${encodeURIComponent(path)}`),

  createFile: (projectId: string, data: { path: string; body: string }) =>
    api.post<{ ok: boolean }>(`/projects/${projectId}/artifacts/file`, data),

  writeFile: (projectId: string, data: { path: string; body: string }) =>
    api.put<{ ok: boolean }>(`/projects/${projectId}/artifacts/file`, data),

  deleteFile: (projectId: string, path: string) =>
    api.delete<{ ok: boolean }>(`/projects/${projectId}/artifacts/file?path=${encodeURIComponent(path)}`),

  listVersions: (projectId: string, path: string) =>
    api.get<ArtifactVersionInfo[]>(`/projects/${projectId}/artifacts/versions?path=${encodeURIComponent(path)}`),

  readVersion: (projectId: string, path: string, version: number) =>
    api.get<{ body: string }>(`/projects/${projectId}/artifacts/versions/${version}?path=${encodeURIComponent(path)}`),
};
