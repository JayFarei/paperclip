import { Navigate } from "@/lib/router";

/**
 * Direct URL access to an artifact (e.g. from artifact:// links).
 * Redirects to the main Artifacts page which handles everything inline.
 */
export function ArtifactDetail() {
  return <Navigate to="/artifacts" replace />;
}
