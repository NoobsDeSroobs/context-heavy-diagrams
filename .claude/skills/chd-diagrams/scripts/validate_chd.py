#!/usr/bin/env python3
"""Validate one or more .chd diagram files for structural integrity.

Checks (see references/field-reference.md and references/authoring-guide.md
for the rules behind each of these):

  ERRORS (structural corruption):
    - invalid JSON
    - duplicate node id / duplicate edge id
    - edge source/target referencing a node id that doesn't exist
    - a node's parentId resolves to a real node, but that parent appears
      LATER in the `nodes` array (violates the parent-before-child ordering
      React Flow requires)
    - a parentId cycle (A inside B inside A)

  WARNINGS (recoverable at runtime, but almost always a mistake):
    - a parentId that doesn't resolve to any node in the file
    - a relative path (custom icon, data.details, data.linkedDiagram,
      data.references entry) that doesn't resolve to a file on disk,
      resolved relative to THIS FILE'S OWN DIRECTORY -- this is the
      most common class of bug when a node is hand-edited or copied
      between diagrams at different folder depths.

Usage:
    python validate_chd.py path/to/diagram.chd [more.chd ...]
    python validate_chd.py path/to/diagram.chd --recursive   # also follow
                                                               # linkedDiagram
                                                               # targets

Exit code is 1 if any ERROR was found in any file, 0 otherwise (warnings
alone don't fail the run, but are always printed).
"""

import argparse
import json
import sys
from pathlib import Path


def load(path: Path):
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as e:
        return None, [f"cannot read file: {e}"]
    try:
        return json.loads(text), []
    except json.JSONDecodeError as e:
        return None, [f"invalid JSON: {e}"]


def resolve_ref(base_dir: Path, ref: str) -> Path:
    # Stored paths always use forward slashes; tolerate backslashes from
    # older/hand-edited files the same way a lenient reader should.
    normalized = ref.replace("\\", "/")
    return (base_dir / normalized).resolve()


def validate_file(path: Path, recursive: bool, _visited=None):
    _visited = _visited if _visited is not None else set()
    resolved = path.resolve()
    if resolved in _visited:
        return [], []
    _visited.add(resolved)

    errors = []
    warnings = []
    prefix = f"[{path}]"

    data, load_errors = load(path)
    if load_errors:
        return [f"{prefix} {e}" for e in load_errors], []

    base_dir = path.resolve().parent
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])

    # --- id uniqueness -----------------------------------------------
    node_ids = {}
    for i, node in enumerate(nodes):
        nid = node.get("id")
        if nid is None:
            errors.append(f"{prefix} node at index {i} has no id")
            continue
        if nid in node_ids:
            errors.append(f"{prefix} duplicate node id '{nid}' (indices {node_ids[nid]} and {i})")
        else:
            node_ids[nid] = i

    edge_ids = set()
    for i, edge in enumerate(edges):
        eid = edge.get("id")
        if eid is None:
            errors.append(f"{prefix} edge at index {i} has no id")
            continue
        if eid in edge_ids:
            errors.append(f"{prefix} duplicate edge id '{eid}'")
        edge_ids.add(eid)

    # --- parent/child ordering + cycles -------------------------------
    for nid, i in node_ids.items():
        node = nodes[i]
        parent_id = node.get("parentId")
        if parent_id is None:
            continue
        if parent_id not in node_ids:
            warnings.append(
                f"{prefix} node '{nid}' has parentId '{parent_id}' which doesn't "
                f"resolve to any node in this file (a reader will drop it and treat "
                f"'{nid}' as top-level)"
            )
            continue
        parent_index = node_ids[parent_id]
        if parent_index >= i:
            errors.append(
                f"{prefix} node '{nid}' (index {i}) has parentId '{parent_id}' "
                f"(index {parent_index}) -- the parent must appear EARLIER in the "
                f"nodes array"
            )
        # cycle check: walk up the parent chain
        seen = {nid}
        cur = parent_id
        depth = 0
        while cur is not None and depth < len(nodes) + 1:
            if cur in seen:
                errors.append(f"{prefix} parentId cycle involving node '{nid}'")
                break
            seen.add(cur)
            cur_node = nodes[node_ids[cur]] if cur in node_ids else None
            cur = cur_node.get("parentId") if cur_node else None
            depth += 1

    # --- edge endpoint references -------------------------------------
    for edge in edges:
        eid = edge.get("id", "<no id>")
        for endpoint_field in ("source", "target"):
            endpoint = edge.get(endpoint_field)
            if endpoint is not None and endpoint not in node_ids:
                errors.append(
                    f"{prefix} edge '{eid}' has {endpoint_field}='{endpoint}' which "
                    f"doesn't match any node id in this file"
                )

    # --- relative path resolution --------------------------------------
    def check_path(context: str, ref: str):
        if not ref:
            return
        target = resolve_ref(base_dir, ref)
        if not target.exists():
            warnings.append(f"{prefix} {context} points to '{ref}' -> resolves to "
                             f"'{target}' which does not exist")
        return target

    linked_diagrams = []
    for node in nodes:
        nid = node.get("id", "<no id>")
        d = node.get("data", {})
        icons = d.get("icons") or {}
        for slot, icon in icons.items():
            if isinstance(icon, dict) and icon.get("source") == "custom":
                check_path(f"node '{nid}' icons.{slot}", icon.get("path"))
        if d.get("details"):
            check_path(f"node '{nid}' data.details", d["details"])
        if d.get("linkedDiagram"):
            target = check_path(f"node '{nid}' data.linkedDiagram", d["linkedDiagram"])
            if target is not None and target.exists():
                linked_diagrams.append(target)
        for ref in d.get("references") or []:
            check_path(f"node '{nid}' data.references[]", ref)

    for entry in data.get("legend") or []:
        icon = entry.get("icon")
        if isinstance(icon, dict) and icon.get("source") == "custom":
            check_path(f"legend entry '{entry.get('id', '?')}' icon", icon.get("path"))

    if recursive:
        for target in linked_diagrams:
            sub_errors, sub_warnings = validate_file(target, recursive=True, _visited=_visited)
            errors.extend(sub_errors)
            warnings.extend(sub_warnings)

    return errors, warnings


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("files", nargs="+", type=Path, help="one or more .chd files to validate")
    parser.add_argument("--recursive", action="store_true", help="also follow and validate linkedDiagram targets")
    args = parser.parse_args()

    had_errors = False
    for path in args.files:
        errors, warnings = validate_file(path, recursive=args.recursive)
        if not errors and not warnings:
            print(f"[{path}] OK")
            continue
        for e in errors:
            print(f"ERROR   {e}")
        for w in warnings:
            print(f"WARNING {w}")
        if errors:
            had_errors = True

    sys.exit(1 if had_errors else 0)


if __name__ == "__main__":
    main()
