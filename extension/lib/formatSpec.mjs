// Same topics as `chd spec` (resources/cli/chd.mjs): the default is only the
// skill itself, the references are opt-in because they are tens of KB.
export const SPEC_TOPICS = ['fields', 'authoring', 'layout', 'all']

const TITLES = {
  fields: 'Field reference',
  authoring: 'Authoring guide',
  layout: 'Layout guide'
}

// The skill file starts with YAML frontmatter meant for skill loaders.
function stripFrontmatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trimStart()
}

const PREAMBLE = `(Output of get_format_spec. File links below such as references/field-reference.md are the
topics of the same tool ("fields", "authoring", "layout"); wherever it says to run
\`node scripts/validate_chd.mjs <file>\`, call the validate_diagram tool instead. Use read_file
to get a diagram's fingerprint and update_file/create_file to write.)

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
    if (topic === 'all' || topic === name) parts.push(`# ${title}\n\n${sources[name]}`)
  }
  if (topic === undefined || topic === 'core') {
    parts.push('More detail: topics "fields", "authoring", "layout" or "all".')
  }
  return parts.join('\n\n---\n\n').trimEnd()
}
