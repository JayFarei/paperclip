---
name: artifacts
description: >
  Manage shared artifacts (documents, specs, reports, visualizations) for board
  review and cross-agent collaboration. Use when producing deliverables that need
  human review, when referencing shared documents in tickets, or when iterating
  on a document with the board.
---

# Artifacts

Artifacts are shared documents (markdown, HTML) stored on the filesystem for human review and agent collaboration. They are not code or agent memory, they are deliverables.

## Where artifacts live

```
{project_workspace_cwd}/artifacts/
  {folder}/
    {document}.md or .html
  _versions/               <- auto-managed, do not touch
```

## Creating and updating artifacts

- Write markdown or HTML files directly to `{cwd}/artifacts/{path}`
- Create subdirectories for organization (e.g., `design/`, `reports/`, `specs/`)
- Use descriptive filenames: `api-design.md`, `q1-strategy.md`, `dashboard-mockup.html`
- Do NOT touch the `_versions/` directory, it is managed by the system

## Referencing artifacts in tickets

- Link format: `[Display Name](artifact://{projectUrlKey}/{relative-path})`
- Example: `[API Design](artifact://hashlock-quest/design/api-design.md)`
- The board app renders these as clickable links opening the artifact viewer
- Always reference artifacts in your issue comments when the artifact is relevant to the task

## Collaboration protocol

- When asked to produce a spec, report, or design, write it as an artifact (not just a comment)
- When iterating on feedback, update the artifact file directly (the system auto-versions)
- Reference the artifact link in your status comment so the board can review it inline
- When you receive feedback via an issue referencing an artifact, read the artifact, apply changes, and comment with the updated artifact link

## When to use artifacts vs comments

- **Artifact**: Standalone document that will be reviewed, iterated on, or referenced later (specs, designs, reports, proposals, visualizations)
- **Comment**: Status updates, questions, quick responses, progress notes

## HTML artifacts

- Use for rich visualizations, interactive content, or formatted reports
- Must be self-contained (inline styles/scripts, no external dependencies)
- The board renders HTML in a sandboxed iframe
