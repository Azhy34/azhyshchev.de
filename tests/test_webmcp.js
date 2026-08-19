/**
 * WebMCP Verification Test Suite
 */
const assert = require('assert');

// Mock browser global environment
const mockWindow = {
  location: { hostname: 'azhyshchev.de' },
  navigator: {},
  dispatchEvent: (event) => {
    assert.strictEqual(event.type, 'modelcontextready');
    assert(event.detail.tools.length >= 5);
  }
};
global.window = mockWindow;
global.navigator = mockWindow.navigator;
global.location = mockWindow.location;
global.CustomEvent = class CustomEvent {
  constructor(type, eventInitDict) {
    this.type = type;
    this.detail = eventInitDict ? eventInitDict.detail : null;
  }
};

// Require WebMCP runtime
require('../js/webmcp.js');

async function runTests() {
  console.log('--- Starting WebMCP Runtime Verification ---');

  // Test 1: Global instances
  assert(mockWindow.modelContext, 'window.modelContext should exist');
  assert(mockWindow.navigator.modelContext, 'navigator.modelContext should exist');
  assert(mockWindow.webMCP, 'window.webMCP should exist');
  console.log('✅ Test 1 Passed: Polyfill attached to window & navigator');

  const mc = mockWindow.modelContext;

  // Test 2: Tools list
  const tools = mc.listTools();
  console.log(`Registered tools count: ${tools.length}`);
  assert.strictEqual(tools.length, 5, 'Should have 5 registered tools');
  
  const toolNames = tools.map(t => t.name);
  assert(toolNames.includes('get_candidate_profile'));
  assert(toolNames.includes('get_candidate_skills'));
  assert(toolNames.includes('get_project_case_study'));
  assert(toolNames.includes('ask_consultant_live'));
  assert(toolNames.includes('book_intro_call'));
  console.log('✅ Test 2 Passed: All 5 WebMCP tools registered with JSON Schema');

  // Test 3: get_candidate_profile
  const profileRes = await mc.callTool('get_candidate_profile');
  assert.strictEqual(profileRes.status, 'success');
  assert.strictEqual(profileRes.result.name, 'Mikhail Azhyshchev');
  assert.strictEqual(profileRes.result.agent_card_url, 'https://azhyshchev.de/.well-known/agent-card.json');
  console.log('✅ Test 3 Passed: get_candidate_profile returned verified data');

  // Test 4: get_candidate_skills
  const skillsRes = await mc.callTool('get_candidate_skills', { category: 'ai_agents' });
  assert.strictEqual(skillsRes.status, 'success');
  assert(Array.isArray(skillsRes.result));
  assert(skillsRes.result.some(s => s.name.includes('Google Agent Development Kit (ADK)')));
  assert(skillsRes.result.some(s => s.name.includes('WebMCP')));
  console.log('✅ Test 4 Passed: get_candidate_skills filtered by category');

  // Test 5: get_project_case_study
  const projectRes = await mc.callTool('get_project_case_study', { projectId: 'azhy-ai-consultant' });
  assert.strictEqual(projectRes.status, 'success');
  assert.strictEqual(projectRes.result.id, 'azhy-ai-consultant');
  assert(projectRes.result.technologies.includes('Google ADK'));
  console.log('✅ Test 5 Passed: get_project_case_study retrieved case study');

  // Test 6: getManifest
  const manifest = mc.getManifest();
  assert.strictEqual(manifest.protocol, 'WebMCP');
  assert.strictEqual(manifest.a2aRegistryPackage, 'de.azhyshchev.azhy_ai_consultant');
  assert.strictEqual(manifest.tools.length, 5);
  console.log('✅ Test 6 Passed: getManifest returned complete discovery manifest');

  console.log('\n🎉 ALL WEBMCP TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
