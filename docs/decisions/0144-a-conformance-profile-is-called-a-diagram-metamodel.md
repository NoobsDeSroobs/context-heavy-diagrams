# 0144: A conformance profile is called a diagram metamodel

## Status
Accepted (2026-11-05). Renames the concept of [ADR 0131](0131-conformance-profiles.md); the design there stands. Renames the file written by [ADR 0143](0143-the-extension-writes-diagram-metamodels.md).

## Context
"Profile" says too little: it suggests a variant or a preference, and the app already has a style panel and palettes. What the file holds is one unit that gives value only as a whole, the way the C4 edge, entity and nesting rules do together: a vocabulary of element and relation kinds and the constraints on combining them. Rules from different diagram types do not add up to anything, so hexagonal over C4 means nothing. A check applies exactly one.

## Decision
- **The concept is a diagram metamodel,** "metamodel" for short. The check keeps its name, a conformance check.
- **The file is `<name>.chdmeta`,** JSON as before. The extension is unique to the tool, so a file picker can offer only these files. It is rarely seen by people; the name is what the app shows.
- **The command line option is `--metamodel`.** The check's `--json` output names the metamodel `metamodelName`, and the extension's `check_diagram` takes `metamodel`.
- **The version key is `metamodelVersion`.** Built-in metamodels live in `resources/metamodels/`.
- **The old names are still read, never written:** `.chdprofile.json` files (by path, in the metamodels folder and in the extension's folder), the key `profileVersion` (an error beside `metamodelVersion`), `--profile`, and the saved folder setting `profilesFolder`, with the default `profiles` folder in the user-data folder while it is the one that holds files. The extension never wrote the old name, so it does not accept it for writing.
- **One metamodel per check.** Layering several, as the rules of GDPR and NIS2 add up to one boundary, is a different feature and is not covered.

## Alternatives considered
- **Profile (kept).** Vague, as above.
- **Archetype.** Suggests a template a diagram only approximates, where these are hard rules with room for freedom inside them. The skill's layout guide already uses "archetype" for layouts.
- **Rules / ruleset.** Rules from several sources can be combined, which these cannot.
- **Style.** Clashes with the Style panel, and a data-flow diagram is not an architectural style.
- **Viewpoint.** The ISO 42010 term; it belongs to a compliance setting the tool does not aim at.
- **`.chddmm`, `.chdmetamodel.json`, `.chdprofile`.** Longer or opaque; the `.json` ending is no help to people, and the double extension gave less in a picker than a single one.

## Consequences
- Files, scripts and CI jobs written for 0.3.0 to 0.5.x keep working. The `--json` key `profileName` is now `metamodelName`; a script reading it changes.
- A `.chdmeta` file gets no JSON highlighting from an editor or from GitHub unless it is associated with JSON.
- The names in the code follow the words (`Metamodel`, `metamodels:*`); the saved folder setting is read from either key but written as `metamodelsFolder`.
