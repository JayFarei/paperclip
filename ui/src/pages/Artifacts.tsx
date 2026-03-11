import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  File,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  Pencil,
  Eye,
  Save,
  X,
  History,
  MessageSquarePlus,
  Trash2,
  RotateCcw,
} from "lucide-react";
import type { ArtifactTreeEntry, ArtifactVersionInfo } from "@paperclipai/shared";
import { artifactsApi } from "../api/artifacts";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useDialog } from "../context/DialogContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { MarkdownBody } from "../components/MarkdownBody";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";

// ── Tree components ──

function TreeNode({
  entry,
  projectId,
  depth,
  selectedPath,
  onSelect,
}: {
  entry: ArtifactTreeEntry;
  projectId: string;
  depth: number;
  selectedPath: string | null;
  onSelect: (projectId: string, path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (entry.type === "directory") {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 w-full px-2 py-1 text-[13px] text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors rounded-sm"
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
          {expanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">{entry.name}</span>
        </button>
        {expanded &&
          entry.children?.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              projectId={projectId}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
      </div>
    );
  }

  const isSelected = selectedPath === `${projectId}:${entry.path}`;

  return (
    <button
      onClick={() => onSelect(projectId, entry.path)}
      className={cn(
        "flex items-center gap-1.5 w-full px-2 py-1 text-[13px] transition-colors rounded-sm",
        isSelected
          ? "bg-accent text-foreground"
          : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
      )}
      style={{ paddingLeft: `${depth * 14 + 22}px` }}
    >
      {entry.contentType === "html" ? (
        <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate">{entry.name}</span>
    </button>
  );
}

function ProjectTree({
  entry,
  selectedPath,
  onSelect,
}: {
  entry: ArtifactTreeEntry;
  selectedPath: string | null;
  onSelect: (projectId: string, path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const projectId = entry.path;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[13px] font-medium text-foreground hover:bg-accent/50 transition-colors rounded-sm"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
        )}
        <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{entry.name}</span>
      </button>
      {expanded &&
        entry.children?.map((child) => (
          <TreeNode
            key={child.path}
            entry={child}
            projectId={projectId}
            depth={1}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

// ── Version sidebar ──

function VersionPanel({
  projectId,
  filePath,
  lastModified,
  viewingVersion,
  onViewVersion,
  onRestore,
  restoring,
}: {
  projectId: string;
  filePath: string;
  lastModified: string;
  viewingVersion: number | null;
  onViewVersion: (v: number | null) => void;
  onRestore: (v: number) => void;
  restoring: boolean;
}) {
  const { data: versions } = useQuery({
    queryKey: queryKeys.artifacts.versions(projectId, filePath),
    queryFn: () => artifactsApi.listVersions(projectId, filePath),
  });

  return (
    <div className="w-52 shrink-0 border-l border-border overflow-y-auto p-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Versions
      </h3>

      {/* Current */}
      <button
        onClick={() => onViewVersion(null)}
        className={cn(
          "w-full text-left p-2 rounded text-xs transition-colors mb-1",
          viewingVersion === null ? "bg-accent" : "hover:bg-accent/50",
        )}
      >
        <div className="font-medium">Current</div>
        <div className="text-muted-foreground">{new Date(lastModified).toLocaleString()}</div>
      </button>

      {/* Archived */}
      {versions && [...versions].reverse().map((v) => (
        <div key={v.version} className="flex items-center gap-0.5 mb-1">
          <button
            onClick={() => onViewVersion(v.version)}
            className={cn(
              "flex-1 text-left p-2 rounded text-xs transition-colors",
              viewingVersion === v.version ? "bg-accent" : "hover:bg-accent/50",
            )}
          >
            <div className="font-medium">v{v.version}</div>
            <div className="text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</div>
          </button>
          <button
            onClick={() => onRestore(v.version)}
            disabled={restoring}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            title="Restore this version"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      ))}

      {(!versions || versions.length === 0) && (
        <p className="text-xs text-muted-foreground">No previous versions.</p>
      )}
    </div>
  );
}

// ── Main component ──

export function Artifacts() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { openNewIssue } = useDialog();
  const queryClient = useQueryClient();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState("");
  const [showVersions, setShowVersions] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Artifacts" }]);
  }, [setBreadcrumbs]);

  const { data: companyTree, isLoading } = useQuery({
    queryKey: queryKeys.artifacts.companyTree(selectedCompanyId!),
    queryFn: () => artifactsApi.companyTree(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const selectedProjectId = selectedKey?.split(":")[0] ?? null;
  const selectedFilePath = selectedKey ? selectedKey.slice(selectedKey.indexOf(":") + 1) : null;

  const { data: file } = useQuery({
    queryKey: queryKeys.artifacts.file(selectedProjectId!, selectedFilePath!),
    queryFn: () => artifactsApi.readFile(selectedProjectId!, selectedFilePath!),
    enabled: !!selectedProjectId && !!selectedFilePath,
  });

  const { data: versionContent } = useQuery({
    queryKey: [...queryKeys.artifacts.versions(selectedProjectId!, selectedFilePath!), viewingVersion],
    queryFn: () => artifactsApi.readVersion(selectedProjectId!, selectedFilePath!, viewingVersion!),
    enabled: !!selectedProjectId && !!selectedFilePath && viewingVersion !== null,
  });

  // Reset state when switching files
  const handleSelect = useCallback((projectId: string, path: string) => {
    const newKey = `${projectId}:${path}`;
    setSelectedKey(newKey);
    setEditing(false);
    setEditBody("");
    setViewingVersion(null);
    setShowVersions(false);
    setPendingDelete(false);
  }, []);

  const enterEdit = useCallback(() => {
    if (file) {
      setEditBody(file.body);
      setEditing(true);
      setViewingVersion(null);
    }
  }, [file]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditBody("");
  }, []);

  const saveMutation = useMutation({
    mutationFn: () =>
      artifactsApi.writeFile(selectedProjectId!, { path: selectedFilePath!, body: editBody }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.artifacts.file(selectedProjectId!, selectedFilePath!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.artifacts.versions(selectedProjectId!, selectedFilePath!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.artifacts.companyTree(selectedCompanyId!) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => artifactsApi.deleteFile(selectedProjectId!, selectedFilePath!),
    onSuccess: () => {
      setPendingDelete(false);
      setSelectedKey(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.artifacts.companyTree(selectedCompanyId!) });
    },
  });

  const restoreVersion = useMutation({
    mutationFn: async (version: number) => {
      const { body } = await artifactsApi.readVersion(selectedProjectId!, selectedFilePath!, version);
      await artifactsApi.writeFile(selectedProjectId!, { path: selectedFilePath!, body });
    },
    onSuccess: () => {
      setViewingVersion(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.artifacts.file(selectedProjectId!, selectedFilePath!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.artifacts.versions(selectedProjectId!, selectedFilePath!) });
    },
  });

  const handleRequestChanges = useCallback(() => {
    if (!file || !selectedFilePath) return;
    openNewIssue({
      title: `Feedback on: ${file.title}`,
      description: `[${file.title}](artifact://${selectedFilePath})`,
      projectId: selectedProjectId ?? undefined,
    });
  }, [file, selectedFilePath, selectedProjectId, openNewIssue]);

  if (!selectedCompanyId) {
    return <EmptyState icon={FileText} message="Select a company to view artifacts." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  if (!companyTree || companyTree.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        message="No artifacts yet. Agents write documents to the artifacts/ directory in each project workspace."
      />
    );
  }

  const displayBody = viewingVersion !== null && versionContent ? versionContent.body : file?.body ?? "";

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* Left: file tree */}
      <div className="w-56 shrink-0 border-r border-border overflow-y-auto py-1">
        {companyTree.map((projectEntry) => (
          <ProjectTree
            key={projectEntry.path}
            entry={projectEntry}
            selectedPath={selectedKey}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Center: view / edit */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {!file ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Select a file to preview
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border shrink-0">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{file.title}</span>
              <span className="text-xs text-muted-foreground">
                {file.contentType === "html" ? ".html" : ".md"}
              </span>
              {viewingVersion !== null && (
                <span className="text-xs bg-accent px-1.5 py-0.5 rounded">
                  viewing v{viewingVersion}
                </span>
              )}

              <div className="ml-auto flex items-center gap-1">
                {editing ? (
                  <>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                      className="h-7 text-xs"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      {saveMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={cancelEdit}
                      className="h-7 text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={enterEdit}
                      className="h-7 text-xs"
                      title="Edit"
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleRequestChanges}
                      className="h-7 text-xs"
                      title="Request changes via issue"
                    >
                      <MessageSquarePlus className="h-3 w-3 mr-1" />
                      Suggest Changes
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowVersions(!showVersions)}
                      className={cn("h-7 text-xs", showVersions && "bg-accent")}
                      title="Version history"
                    >
                      <History className="h-3 w-3 mr-1" />
                      {file.versionCount > 0 ? file.versionCount : ""}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPendingDelete(true)}
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {saveMutation.error && (
              <div className="px-4 py-1.5 text-xs text-destructive border-b border-border bg-destructive/5">
                {(saveMutation.error as Error).message}
              </div>
            )}

            {/* Content area */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-w-0 overflow-y-auto">
                {editing ? (
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="w-full h-full text-sm font-mono px-4 py-3 bg-background text-foreground resize-none focus:outline-none"
                    spellCheck={false}
                  />
                ) : (
                  <div className="px-5 py-4">
                    {viewingVersion !== null && (
                      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground bg-accent/50 rounded px-2.5 py-1.5">
                        <Eye className="h-3 w-3" />
                        Viewing version {viewingVersion}
                        <button
                          className="underline ml-1 hover:text-foreground"
                          onClick={() => setViewingVersion(null)}
                        >
                          Back to current
                        </button>
                      </div>
                    )}
                    {file.contentType === "html" ? (
                      <iframe
                        srcDoc={displayBody}
                        sandbox="allow-scripts"
                        className="w-full min-h-[500px] border border-border rounded bg-white"
                        title={file.title}
                      />
                    ) : (
                      <MarkdownBody>{displayBody}</MarkdownBody>
                    )}
                  </div>
                )}
              </div>

              {/* Version sidebar */}
              {showVersions && !editing && selectedProjectId && selectedFilePath && (
                <VersionPanel
                  projectId={selectedProjectId}
                  filePath={selectedFilePath}
                  lastModified={file.lastModified}
                  viewingVersion={viewingVersion}
                  onViewVersion={setViewingVersion}
                  onRestore={(v) => restoreVersion.mutate(v)}
                  restoring={restoreVersion.isPending}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation */}
      {pendingDelete && file && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-sm font-semibold">Delete artifact</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete "{file.title}"? The current content will be archived.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPendingDelete(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
