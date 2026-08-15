// Heuristic category rules. First match wins, else 'General'.
// Fragments are case-insensitive regex; word boundaries keep "artifacts" ≠
// Design and "plannotator" ≠ Planning. Order matters (see spec table).
const RULES = [
  ['Skill Authoring', ['\\bskill', 'skill\\.md', 'agents\\.md']],
  ['Documents', ['\\bpdf\\b', '\\bdocx\\b', '\\bpptx\\b', '\\bxlsx\\b', '\\bspreadsheet', '\\bword\\b']],
  ['Git', ['\\bgit\\b', '\\bbranch', '\\bmerge', '\\brebase', '\\bcommit', '\\bcherry']],
  ['Debugging', ['\\bdebug', '\\bdiagnos', '\\bregression']],
  ['Testing', ['\\btest', '\\btdd\\b', 'red-green']],
  ['Planning', ['\\bbrainstorm', '\\bspec', '\\bplans?\\b', '\\bproposal']],
  ['Design & Visual', ['\\bdesign', '\\blogo', '\\bart\\b', '\\btheme', '\\bcanvas', '\\bposter', '\\bgif\\b']],
  ['Research & Web', ['\\bsearch', '\\bweb', '\\bscrape', '\\bcrawl', '\\bfetch', '\\bresearch', '\\btranscript']],
  ['MCP', ['\\bmcp\\b']],
  ['Agents', ['\\bagents?\\b', '\\bsubagent', '\\borchestrat', '\\bdispatch']],
  ['Ops & Setup', ['\\bserver', '\\bvps\\b', '\\bops\\b', '\\bsetup', '\\bprovision', '\\bssh\\b', '\\bdeploy']],
  ['Prompting', ['\\bprompt', '\\bgoal', '\\bloop', '\\binstruction']]
]

export function categorize(name, description) {
  const text = `${name} ${description}`.toLowerCase()
  for (const [category, fragments] of RULES) {
    if (fragments.some(f => new RegExp(f, 'i').test(text))) return category
  }
  return 'General'
}
