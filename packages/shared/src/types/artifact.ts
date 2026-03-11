export interface ArtifactFile {
  path: string;
  title: string;
  contentType: "markdown" | "html";
  body: string;
  versionCount: number;
  lastModified: string;
}

export interface ArtifactTreeEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  contentType?: "markdown" | "html";
  lastModified?: string;
  size?: number;
  children?: ArtifactTreeEntry[];
}

export interface ArtifactVersionInfo {
  version: number;
  path: string;
  createdAt: string;
}
