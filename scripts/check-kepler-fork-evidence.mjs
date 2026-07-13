import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const forkRoot = resolve(root, 'fork/kepler-gl');

const evidence = JSON.parse(await readFile(resolve(forkRoot, 'evidence.json'), 'utf8'));
const patches = await Promise.all(
  (evidence.patches || [evidence.patch]).map(patch => readFile(resolve(forkRoot, patch), 'utf8'))
);
const patch = patches.join('\n');
const ledger = await readFile(resolve(forkRoot, 'PATCH_LEDGER.md'), 'utf8');
const overrides = JSON.parse(await readFile(resolve(forkRoot, 'consumer-overrides.json'), 'utf8'));
const companionPatches = await Promise.all(
  evidence.companionPatches.map(item => readFile(resolve(forkRoot, item.patch), 'utf8'))
);
const security = await readFile(resolve(root, 'apps/v3/SECURITY.md'), 'utf8');

const failures = [];
const requireValue = (condition, message) => {
  if (!condition) failures.push(message);
};

requireValue(
  evidence.status === 'public-fork-prerelease-not-production',
  'Evidence must remain explicitly non-production until all fork gates pass.'
);
requireValue(/^[0-9a-f]{40}$/.test(evidence.upstream?.commit || ''), 'Missing immutable upstream commit.');
requireValue(evidence.verification?.nodeTests?.passed === 11386, 'Unexpected upstream Node test count.');
requireValue(evidence.verification?.nodeTests?.failed === 0, 'Upstream Node test failures are recorded.');
requireValue(evidence.remainingProductionRoots?.length === 0, 'Packed core audit roots should be cleared.');
requireValue(evidence.notYetProven?.length > 0, 'Unproven gates must remain explicit.');
requireValue(
  evidence.publicFork?.repository === 'https://github.com/evcatalyst/kepler.gl',
  'Public fork evidence is missing.'
);
requireValue(
  evidence.publishedV3Prerelease?.strictCspWithoutUnsafeEval === 'passed',
  'Published V3 strict-CSP evidence is missing.'
);
requireValue(patch.length > 40000, 'Security patch is missing or unexpectedly truncated.');
requireValue(patches.length === 3, 'Expected the runtime, Lodash, and packaging-alignment patches.');
requireValue(companionPatches.length === 3, 'Expected two Hubble and one loaders.gl companion patches.');
requireValue(evidence.packedCoreAudit?.findings?.high === 0, 'Packed core high findings are not zero.');
requireValue(evidence.packedCoreAudit?.findings?.moderate === 0, 'Packed core moderate findings are not zero.');
requireValue(
  evidence.packedCoreAudit?.productionDependencies === 836,
  'Unexpected packed core dependency count.'
);

for (const [name, version] of Object.entries({
  postcss: '8.5.10',
  'styled-components': '6.4.3',
  thrift: '0.23.0',
  uuid: '11.1.1'
})) {
  requireValue(overrides[name] === version, `Missing verified consumer override ${name}@${version}.`);
}

requireValue(
  companionPatches.some(value => value.includes('-    "@kepler.gl/constants": "3.1.0"')),
  'Hubble companion patch does not remove its old Kepler pin.'
);
requireValue(
  companionPatches.some(value => value.includes('-    "react-onclickoutside": "^6.9.0"')),
  'Hubble companion patch does not remove its unused React-18-only dependency.'
);
requireValue(
  companionPatches.some(value => value.includes('+    "thrift": "^0.23.0"')),
  'loaders.gl companion patch does not upgrade Thrift.'
);

for (const marker of [
  '@kepler.gl/task-runtime',
  'd3-color": "^3.1.0',
  'd3-scale": "^4.0.2',
  'node-fetch": "2.7.0',
  'thrift": "0.23.0',
  'lodash": "4.18.1',
  '@deck.gl-community/editable-layers": "9.3.7',
  '"module": "dist-esm/index.mjs"',
  'react-intl": "^7.0.0',
  '-    "react-palm": "^3.3.8"'
]) {
  requireValue(patch.includes(marker), `Patch is missing required marker: ${marker}`);
}

for (const id of ['KSEC-001', 'KSEC-002', 'KSEC-003', 'KSEC-004', 'KSEC-005', 'KSEC-006', 'KSEC-007', 'KSEC-008', 'KSEC-009']) {
  requireValue(ledger.includes(id), `Patch ledger is missing ${id}.`);
}

requireValue(
  security.includes('internal alpha — publication and production promotion blocked'),
  'The corrected direct-stack alpha must not silently open publication or production promotion.'
);

if (failures.length) {
  console.error(failures.map(failure => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(
  `Kepler fork evidence is internally consistent: ${evidence.verification.nodeTests.passed} upstream Node tests, ${evidence.packedCoreAudit.productionDependencies} packed production dependencies, zero audit findings.`
);
