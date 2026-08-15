import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categorize } from '../shared/categories.js'

test('pdf → Documents', () =>
  assert.equal(categorize('pdf', 'Use for PDF files'), 'Documents'))
test('brainstorming → Planning', () =>
  assert.equal(categorize('brainstorming', 'Turn ideas into specs'), 'Planning'))
test('plan stem does not match plannotator', () =>
  assert.notEqual(categorize('plannotator-annotate', 'Open Plannotator UI for markdown'), 'Planning'))
test('art word boundary: artifacts → Research & Web', () =>
  assert.equal(categorize('web-artifacts-builder', 'Suite of tools for creating HTML artifacts'), 'Research & Web'))
test('diagnosing → Debugging', () =>
  assert.equal(categorize('diagnosing-bugs', 'Diagnosis loop for hard bugs'), 'Debugging'))
test('mcp → MCP', () =>
  assert.equal(categorize('mcp-builder', 'Guide for creating MCP servers'), 'MCP'))
test('git → Git', () =>
  assert.equal(categorize('using-git-worktrees', 'Isolated workspace via git worktree'), 'Git'))
test('unknown → General', () =>
  assert.equal(categorize('foo', 'bar baz'), 'General'))
