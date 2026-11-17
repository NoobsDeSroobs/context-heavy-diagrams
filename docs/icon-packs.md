# Icon packs

A standalone description of an installed icon pack: everything you need to make one by hand or with a script, without reading this project's source code or its decision history. A pack is a folder of SVG files. Install it with the app's icon pack manager (View > Icon packs), or copy the folder into the app's `icon-packs` folder. Installing a folder whose pack name is already installed updates that pack: new icons are added, icons of the same name are replaced, and its `pack.json` and `subset.json` are kept.

## Layout

```
icon-packs/
  AWS Architecture/              a pack
    pack.json                    optional
    Compute/                     a subset
      subset.json                optional
      EC2.svg                    an icon
      Lambda.svg
    Storage/
      S3.svg
```

- A pack is a folder in the `icon-packs` folder of the app's per-user data folder. The manager shows where that is.
- A pack holds subset folders, a subset holds icons. That is all the depth there is: a folder inside a subset, and a file directly in the pack folder, are not read, and the manager says so when it leaves them out.
- An icon is a file ending in `.svg` (in any capitals). Other files are ignored.
- Keep names to characters every system allows: no `\ : * ? " < > |`, no name that ends in a dot or a space, and no Windows device name (`CON`, `PRN`, `AUX`, `NUL`, `COM1` to `COM9`, `LPT1` to `LPT9`) as a name or the start of one before a dot. Two names that differ only in capitals are two files on Linux and one on Windows, so a pack must not have both.

## Metadata

Both files are optional UTF-8 JSON objects. A pack without them works: its name is its folder's name. When the manager installs a pack that has none, it writes the two files below with every field empty, so you can see what to fill in. Unknown fields are ignored, an empty text is the same as no field, and a file that cannot be read is reported and then treated as absent.

`pack.json`:

```json
{
  "name": "AWS Architecture",
  "description": "Service icons from the vendor's architecture set.",
  "ifMissing": "Download the architecture icons from the vendor's site and install the folder with the icon pack manager.",
  "version": "2024.10"
}
```

| Field | Meaning | Limit |
| --- | --- | --- |
| `name` | What the pack is called, and what a diagram refers to it by. Defaults to the folder name. | 100 characters |
| `description` | Shown in the manager. | 1000 characters |
| `ifMissing` | What a person should do when a diagram needs this pack and it is not installed. Shown in the diagram's diagnostics. | 1000 characters |
| `version` | A label for this release of the pack, shown in diagnostics. Free text; the app does not compare versions. | 50 characters |

`subset.json`, in a subset folder:

```json
{
  "name": "Compute",
  "description": "Servers, containers and functions."
}
```

`name` (default: the folder name) is what the picker shows; it is not part of a reference, which uses the folder name. A text is cut at its limit, and control characters (a tab, a new line) become spaces.

A pack is known by its `name`, matched exactly: two folders that give the same name are one pack to a diagram, so the app uses the first it finds and the manager reports the second. Rename a folder and give it the old name in `pack.json`, and diagrams still find it.

## The icons

- **Any SVG works,** and an icon is drawn in the page, not as a picture. A shape that is drawn in `currentColor` takes the text colour, so it follows the light and dark theme; an icon with colours of its own keeps them.
- **The app cleans every icon each time it reads it,** so a pack cannot run code or load anything. It removes scripts and event attributes, `foreignObject`, links, animation, and every reference that leaves the file (`https://…`, another file). Gradients, clip paths, masks, filters, strokes, `<use>` of an id in the same file, and a raster picture written into the file (`data:image/png;base64,…`, also JPEG, GIF and WebP) are kept.
- **A `<style>` element is turned into style attributes on the elements it matches** and then removed; at-rules (`@import`, `@media`, `@font-face`, `@keyframes`) are dropped. Only properties that colour and draw are kept (fill, stroke, opacity, clip, mask, filter, and similar), so nothing can position or resize an icon, and `overflow` is removed.
- **Ids and classes are made unique for each use,** so the `id="a"` or `class="cls-1"` that design tools write into every file do not collide with another icon's.
- **Size.** A file of more than 1 MB is not used. A real icon is a few kilobytes to a few tens.
- **The viewBox** decides the shape of the icon; the app draws it in a square box, so keep icons square or accept the space around them.

## How a diagram refers to an icon

An element's icon is stored in the diagram as

```json
{ "source": "installed", "pack": "AWS Architecture", "path": "Compute/EC2.svg" }
```

`pack` is the pack's name. `path` is the subset folder, a `/` and the file name, using folder and file names, not the names in the metadata. Nothing else is accepted: no `..`, no further folders, no other separator. The path is resolved inside the pack's folder and never outside it, whatever the file says. The same applies to a diagram written by hand or by another tool. The field is described, with the rest of the diagram, in [file-format.md](file-format.md).

When a diagram refers to a pack that is not installed, the app shows no icon there and says in the diagnostics which pack it is and what its `ifMissing` text says, from the copy the diagram keeps of it. A pack that is installed but lacks that icon is reported like any other missing file.

## Making a pack

1. Make a folder named for the pack and a folder inside it for each group of icons.
2. Put the SVG files in the subset folders.
3. Add `pack.json` with at least a `name`, and an `ifMissing` text telling a colleague where to get the icons.
4. Install it with the manager, or copy the folder into `icon-packs`. To share it, copy the folder, or zip it.

A pack can hold icons you do not have the right to hand on. Check the terms of what you put in it before you share it.
