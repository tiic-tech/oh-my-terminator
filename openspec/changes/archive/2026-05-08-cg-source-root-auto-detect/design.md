## Context

The codegraph CLI currently requires users to explicitly specify the source root via `--source-root` argument for commands like `analyze` and `query`. This creates friction as users must remember the flag and know the correct path. Most modern projects have identifiable root markers (package.json, pyproject.toml, etc.) that can be used for automatic detection.

The proposed solution adds automatic detection while preserving the explicit override option for edge cases.

## Goals / Non-Goals

**Goals:**
- Automatically detect source root when `--source-root` is not provided
- Support common project types: Node.js, Python, Rust, Go
- Preserve existing explicit `--source-root` behavior
- Provide fallback for projects without standard markers
- Maintain backward compatibility

**Non-Goals:**
- Supporting project types beyond the listed four in initial implementation
- Changing existing CLI command structure or output formats
- Detecting monorepo structure or multiple source roots
- Remote repository detection (only local filesystem)

## Decisions

### D1: Search Direction - Upward from CWD

**Decision:** Search upward from current working directory toward filesystem root.

**Alternatives considered:**
- Downward from filesystem root: More expensive, requires knowing where to stop
- Both directions: Adds complexity without clear benefit

**Rationale:** Most CLI usage happens from within the project directory. Upward search is O(depth) and typically finds the root within 3-5 hops.

### D2: Project Markers

**Decision:** Recognize these marker files as project roots:

| Project Type | Marker Files |
|--------------|--------------|
| Node.js | package.json, package-lock.json, yarn.lock, pnpm-lock.yaml |
| Python | pyproject.toml, setup.py, requirements.txt, Pipfile |
| Rust | Cargo.toml, Cargo.lock |
| Go | go.mod, go.sum |
| Generic | .git directory (fallback) |

**Alternatives considered:**
- Configuration file for custom markers: Adds complexity, can be added later
- Only .git detection: Too narrow, misses language-specific context

**Rationale:** These markers are universally recognized and indicate the logical project root where source analysis should begin.

### D3: Detection Priority

**Decision:** Language-specific markers take priority over `.git` directory.

**Rationale:** In monorepos or nested projects, `.git` may exist at a higher level than the actual source root. Language markers provide more precise context.

### D3.1: Language Marker Priority at Same Level

**Decision:** When multiple language markers exist in the same directory, use alphabetical order by filename.

**Priority order:** Cargo.toml > go.mod > package.json > pyproject.toml > setup.py

**Rationale:** Deterministic output, no need to maintain type priority list, simple implementation.

### D4: Failure Behavior

**Decision:** If no markers found, fail with clear error message suggesting `--source-root` usage.

**Alternatives considered:**
- Use CWD as fallback: Could lead to incorrect analysis scope
- Silent failure: Poor UX, user unaware of incorrect behavior

**Rationale:** Explicit error prevents silent incorrect behavior and guides user to correct solution.

### D5: Maximum Search Depth

**Decision:** Maximum upward search depth is 10 directory levels.

**Rationale:** Prevent infinite loops, reasonable coverage for nested projects.

**Implementation:** Throw error if marker not found within 10 hops.

### D6: Symlink Resolution Strategy

**Decision:** Resolve all symlinks to realpath before starting search using fs.realpath.

**Rationale:** Consistent behavior, prevent circular symlink loops, simplify traversal logic.

**Implementation:** Resolve start directory to realpath first, then search upward.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Mis-detection in nested projects (e.g., monorepo subproject) | `--source-root` override always available; `--no-auto-detect` to disable |
| Performance in deeply nested directory trees | Limit search depth to 10 hops; bail early on marker found |
| Detection in symlinked directories | Resolve symlinks during search; document behavior |
| Projects with multiple markers at different levels | Priority order: language markers > .git; stop on first match |