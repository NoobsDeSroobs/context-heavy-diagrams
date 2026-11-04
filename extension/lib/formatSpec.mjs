// Same topics as `chd spec` (resources/cli/chd.mjs): the default is only the
// skill itself, the references are opt-in because they are tens of KB.
export const SPEC_TOPICS = ['fields', 'authoring', 'layout', 'conformance', 'all']

const TITLES = {
  fields: 'Field reference',
  authoring: 'Authoring guide',
  layout: 'Layout guide',
  conformance: 'Architecture checks'
}

// The skill file starts with YAML frontmatter meant for skill loaders.
function stripFrontmatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trimStart()
}

const PREAMBLE = `(Output of get_format_spec. File links below such as references/field-reference.md are the
topics of the same tool ("fields", "authoring", "layout", "conformance"). This server has tools in
place of the commands the text names: \`node scripts/validate_chd.mjs <file>\` is validate_diagram,
\`chd hash <file>\` is the fingerprint read_file returns, \`chd diff\` is diff_diagrams and
\`chd check\` is check_diagram. Use update_file/create_file to write.)

`

export function formatSpec(sources, topic) {
  if (topic !== undefined && topic !== 'core' && !SPEC_TOPICS.includes(topic)) {
    throw new Error(`unknown topic '${topic}' (expected core, ${SPEC_TOPICS.join(', ')})`)
  }
  const parts = []
  if (topic === undefined || topic === 'core' || topic === 'all') {
    parts.push(PREAMBLE + stripFrontmatter(sources.skill))
  }
  for (const [name, title] of Object.entries(TITLES)) {
    if (topic === name) parts.push(`# ${title}\n\n${sources[name]}`)
  }
  // The references together are about 66 KB, over what some clients accept in one result, so
  // "all" is the core rules plus an index; the topics are read one at a time.
  if (topic === 'all') parts.push(topicIndex(sources))
  if (topic === undefined || topic === 'core') {
    parts.push(
      'More detail, one topic per call: "fields", "authoring", "layout", "conformance" (or "all" for an index).'
    )
  }
  return parts.join('\n\n---\n\n').trimEnd()
}

function topicIndex(sources) {
  const lines = Object.entries(TITLES).map(
    ([name, title]) =>
      `- "${name}" (${Math.ceil(Buffer.byteLength(sources[name], 'utf-8') / 1024)} KB): ${title}`
  )
  return `# Topics\n\nCall get_format_spec once per topic you need:\n\n${lines.join('\n')}`
}
