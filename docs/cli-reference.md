# The `chd` command line: reference

`chd` is the app's command-line companion. It needs no display and no separate Node, and it never changes a diagram unless you run `chd edit`. `chd help <command>` (or `chd <command> --help`) prints one command's options; this page shows how the commands fit together. Nothing here is a network call: the tool stays offline ([ADR 0113](decisions/0113-enforced-offline-behaviour.md)).

| Command | What it does |
|---|---|
| [`spec`](#chd-spec) | Print the `.chd` file format reference |
| [`validate`](#chd-validate) | Check diagram or metamodel files for problems |
| [`hash`](#chd-hash) | Print a file's fingerprint (SHA-256 of its bytes) |
| [`export`](#chd-export) | Draw a diagram as an SVG image |
| [`check`](#chd-check) | Check diagrams against a diagram metamodel |
| [`diff`](#chd-diff) | What changed between two versions of a diagram |
| [`edit`](#chd-edit) | Build or change a diagram with a list of operations |
| [`ask`](#chd-ask) | Ask about a diagram's layout while you build it |
| [`mcp`](#chd-mcp) | Run the MCP server for one folder, for an app to start |

**Exit codes** are the same everywhere: `0` ok, `1` the command found something or could not finish (an error in a diagram, a refused edit, an unreadable file), `2` it was used wrongly. Each command lists the exceptions. A pipeline can rely on them.

## Getting `chd`

The Windows and Linux builds carry a launcher next to the app's executable: `chd.cmd` on Windows, `chd` on Linux. It is **not on your `PATH`** ([ADR 0106](decisions/0106-chd-command-line-tool.md)), so call it by its full path, or add its folder to `PATH` yourself. **AI → Enable AI assistance in a folder…** writes the launcher's full path into that folder's `AGENTS.md`. From a source checkout, run `node resources/cli/chd.mjs` in place of `chd` (after `npm run build`, which builds the commands that live in their own bundles). There is no launcher in a macOS build.

On **Windows PowerShell 5.1**, text piped to a program is re-encoded and can damage non-ASCII labels. Give the operations as a file (`--ops ops.json`) rather than a pipe, or use PowerShell 7 or bash.

## `chd spec`

`chd spec [fields|authoring|layout|conformance|all]` prints the file format reference an assistant needs. With no topic it prints the core rules and traps; the others are opt-in, because together they are large. Exit codes: `0`, `2` for an unknown topic.

## `chd validate`

`chd validate <file.chd|file.chdmeta>... [--recursive]`

Reports duplicate ids, dangling edge endpoints, parent-before-child ordering and relative paths that do not resolve, and warns where an edge label does not fit in the gap between its two elements. A `.chdmeta` file is checked against the metamodel format. `--recursive` also follows linked diagrams. Warnings alone do not fail. Exit codes: `0`, `1` if any error was found, `2`.

```
$ chd validate shop.chd
[shop.chd] OK
```

## `chd hash`

`chd hash <file.chd>` prints the lowercase hex SHA-256 of the file's raw bytes. That is the fingerprint of the stale-edit check ([ADR 0109](decisions/0109-stale-edit-check-for-every-ai-write-path.md)): note it when you read a file, and `chd edit` refuses to write if it has changed since. Exit codes: `0`, `1` if the file cannot be read, `2`.

```
$ chd hash shop.chd
273d1f7d58ae12b1b3bf7d6d554e904dadc9e503da988d608defc7ff67b6ee05
```

## `chd export`

`chd export <file.chd> [options]` writes the diagram as an SVG, so an image in a README or wiki can be regenerated whenever the diagram changes. It only reads the diagram and never overwrites one.

| Option | Meaning |
|---|---|
| `-o`, `--output <file.svg>` | Where to write; the default is next to the diagram, `-` is standard output |
| `--theme light\|dark` | The look to draw (default light) |
| `--padding <px>` | Margin around the drawing (default 24) |
| `--background <value>` | `theme` (default), `transparent` or a colour such as `#ffffff` |
| `--no-legend` | Leave the legend out |
| `--legend-corner <corner>` | `bottom-left` (default), `bottom-right`, `top-left` or `top-right` |
| `--highlight <key[=value]>` | Draw a highlight as if it were switched on; repeatable. `key` alone switches on every value of that key |

Exit codes: `0`, `1` if the file cannot be read or written, `2`.

```
$ chd export shop.chd --theme dark --highlight owner=team-a -o docs/shop-dark.svg
```

## `chd check`

`chd check <file.chd>... --metamodel <metamodel> [--json]` reports where a diagram breaks the rules of a diagram metamodel ([format](metamodel-format.md)). `--metamodel` is a `.chdmeta` file or a built-in name (`hexagonal`, `data-flow-diagram`); `--profile` is its old name and still works. A single `-` reads the diagram from standard input, to check a draft before it is written, or a committed version out of git. `--json` prints the result as JSON. Errors fail the check; warnings and information do not. Exit codes: `0` every diagram conforms, `1` a diagram has an error or cannot be read, `2` the command or the metamodel cannot be used.

```
$ chd check shop.chd --metamodel hexagonal
shop.chd: does not conform to Hexagonal architecture (ports and adapters) (1 error, 2 warnings, 0 info)
  error   edge-set: Missing required edge set: the diagram needs an edge direction set named "dependsOn" (spaces and capitals do not matter).
  warning entity-has-role: Set the "role" tag so the element is checked. ["Web"]
  warning entity-has-role: Set the "role" tag so the element is checked. ["Orders API"]
  not evaluated (they need the edge set): no-adapter-to-adapter, domain-not-on-adapter, port-not-on-adapter, adapter-uses-port, port-has-adapter
$ echo $?
1
```

The committed version of a diagram, from git, on standard input:

```
$ git show HEAD:docs/arch.chd | chd check - --metamodel hexagonal
```

## `chd diff`

`chd diff <old.chd> <new.chd>` or `chd diff <file.chd> [--rev <revision>]` shows what changed, in the order a reviewer should look: security assessments, links and notes, modified elements, restyled elements, removed, added. Moving or resizing an element is not a change; a changed note, link, label, tag or connection is, and so is a look that carries meaning (colour, line style, markers, animation, icons: "restyled"). A change of font, text alignment or routing is only counted under `cosmeticLook` in `--json`. It only reads.

| Option | Meaning |
|---|---|
| `--rev <revision>` | With one file: compare with git at a branch, tag, commit or `HEAD~2` (default `HEAD`). Needs git |
| `--match` | The ids were replaced (an assistant rewrote the diagram): pair removed and added elements with the same type and a similar name and place, so they show as edited. A guess; it says how many it paired |
| `--json` | Print the result as JSON |
| `--exit-code` | Exit `1` when anything changed, like `git diff --exit-code` |

A single `-` stands for one of the two files, read from standard input, to review a draft before it is written (notes are not compared for it). Exit codes: `0`, `1` something changed (only with `--exit-code`), `2`, `3` a version could not be read.

```
$ chd diff before.chd shop.chd
shop.chd against before.chd
1 element changed

MODIFIED
  element "Orders API"
    + owner: "team-a"
    label: "API" → "Orders API"
```

Against git, and as a pipeline step that fails while the diagram has changes that are not committed:

```
$ chd diff docs/arch.chd --rev origin/main
$ chd diff docs/arch.chd --exit-code
```

## `chd edit`

`chd edit <file.chd> [--ops <file>] [--base <fingerprint>]` applies a list of operations to a diagram, all or nothing (at most 200), and prints what each made, the new fingerprint and what is wrong with the layout so far, as JSON. The file is created if it does not exist. It works inside the current folder, and a note or linked diagram an operation makes is written beside the diagram, in a folder named after it.

| Option | Meaning |
|---|---|
| `--ops <file>` | The operations as JSON: a list of `{"op": ...}` objects or `{"operations": [...]}`. `-`, also the default, reads standard input |
| `--base <fingerprint>` | Required for a diagram that exists: the fingerprint (`chd hash`, or the last answer) of the version the edit is based on. The edit is refused if the file changed since. Leave it out to create a new file |

Exit codes: `0` done, `1` not done (an operation was refused, the file changed, the result would be invalid), `2`. `chd help edit` lists every operation with its fields; they are the same as the Claude Desktop extension's `edit_diagram`:

`add_entity` `add_container` `add_text` `add_line` `add_connection_point` `connect` `move` `resize` `set_label` `set_style` `reparent` `remove` `set_edge_points` `set_tag` `remove_tag` `set_diagram_tag` `remove_diagram_tag` `set_required_tag` `remove_required_tag` `set_highlight` `remove_highlight` `add_legend_entry` `set_legend_entry` `remove_legend_entry` `link_to_existing_diagram` `add_new_linked_diagram` `remove_link` `set_note` `remove_note`

Create a diagram, then change it with the fingerprint of the answer before:

```
$ chd edit shop.chd --ops ops.json
{
  "path": "shop.chd",
  "fingerprint": "273d1f7d58ae12b1b3bf7d6d554e904dadc9e503da988d608defc7ff67b6ee05",
  "results": [
    {"op":"add_entity","element":{"id":"web","x":0,"y":0,"width":120,"height":80}},
    {"op":"add_entity","element":{"id":"api","x":320,"y":0,"width":120,"height":80}},
    {"op":"connect","element":{"id":"calls","from":"web","to":"api","fromHandle":"right","toHandle":"left"}}
  ],
  "issues": [],
  "warnings": []
}
$ echo '[{"op":"set_label","id":"api","label":"Orders API"}]' | chd edit shop.chd --base 273d1f7d58ae12b1b3bf7d6d554e904dadc9e503da988d608defc7ff67b6ee05
```

An edit to an existing file without `--base` is refused with exit `2`, and one whose `--base` no longer matches is refused with exit `1`; read the file again and redo the edit. Review what an assistant changed with `chd diff <file>` afterwards.

## `chd ask`

Questions about a diagram while you build it. Both only read, and the answer is JSON.

`chd ask inspect <file.chd> [--styles]` lists the elements as they stand, with absolute positions and the connection points an edge may name, the tags, links, notes, required tags, highlights and legend, the fingerprint, and what is wrong with the layout so far. `--styles` adds the style fields each element sets.

`chd ask room --label <text> --direction horizontal|vertical [options]` says how much space two connected elements need for an edge label. `--direction` is `horizontal` (side by side) or `vertical` (one above the other). Options: `--font-size <n>`, `--bold`, `--font-family <name>`, `--start-marker <m>` and `--end-marker <m>` (the graphics at the ends of the edge), `--position <0..1>` (how far along the edge the label sits; the default is the middle). Exit codes: `0`, `1` the diagram cannot be read, `2`.

```
$ chd ask room --label requests --direction horizontal
{
  "minimum": 87,
  "target": 103,
  "chip": {"width":62.2,"height":23.2}
}
```

## `chd mcp`

`chd mcp <folder> [--allow-update]` runs the MCP server, the one the Claude Desktop extension runs, over standard input and output, for the one folder you give. It is not meant to be run by hand: an app that speaks MCP starts it from its settings. The assistant can read the files in the folder, check and diff diagrams, build and change them, and create files; `--allow-update` also lets it replace existing files, which can lose data, so it is off unless you add it. Exit codes: `0` when the app closes the connection, `1` if the folder does not exist or the server is not built here, `2` for wrong use.

The app's AI menu makes the settings for you: **AI → Install the MCP server for → Other apps: copy server settings…** asks for the folder and puts a block like this on the clipboard, with the paths of your installation:

```json
{
  "mcpServers": {
    "context-heavy-diagrams": {
      "command": "C:\\Users\\you\\AppData\\Local\\Programs\\context-heavy-diagrams\\context-heavy-diagrams.exe",
      "args": ["C:\\Users\\you\\AppData\\Local\\Programs\\context-heavy-diagrams\\resources\\app.asar.unpacked\\resources\\cli\\chd.mjs", "mcp", "D:\\diagrams"],
      "env": { "ELECTRON_RUN_AS_NODE": "1" }
    }
  }
}
```

It starts the app's executable as plain Node instead of calling the `chd` launcher, because an app starts a program without a shell and a `.cmd` file needs one. From a checkout, `node resources/cli/chd.mjs mcp <folder>` does the same once `npm run build:extension` has run. Everything the assistant reads is sent to its provider.

## Using the commands together

A build step that fails when a diagram is invalid, breaks its metamodel, or an image is out of date:

```
chd validate docs/*.chd
chd check docs/arch.chd --metamodel hexagonal
chd export docs/arch.chd -o docs/arch.svg
git diff --exit-code docs/arch.svg
```

An assistant working on a diagram follows the same loop a person does: `chd spec`, then `chd edit` (with `chd ask` for layout questions), `chd validate`, and `chd diff` to tell the person what changed. The `chd-diagrams` skill and `AGENTS.md` say this to the assistant ([AI integration](architecture/ai-integration.md)).
