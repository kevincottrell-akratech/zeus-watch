import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const clientRequire = createRequire(new URL('../client/package.json', import.meta.url));
const React = clientRequire('react');
const { renderToStaticMarkup } = clientRequire('react-dom/server');
const ts = clientRequire('typescript');
const source = readFileSync(new URL('../client/src/support/SupportCause.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const componentModule = { exports: {} };
const requireComponent = specifier => specifier.endsWith('.css') ? {} : clientRequire(specifier);
new Function('require', 'exports', 'module', compiled)(requireComponent, componentModule.exports, componentModule);
const html = renderToStaticMarkup(React.createElement(componentModule.exports.default));

test('support page clearly describes a fictional, non-transactional demonstration', () => {
  assert.match(html, /Demonstration only — no donations are processed\./);
  for (const term of ['food', 'veterinary', 'trap', 'neuter', 'return']) {
    assert.ok(html.toLowerCase().includes(term), `Explains ${term}`);
  }
  for (const provider of ['PayPal', 'Cash App', 'Zelle']) assert.ok(html.includes(provider));
});

test('every support payment control is natively disabled with no collection or payment destinations', () => {
  const controls = [...html.matchAll(/<button\b[^>]*>/g)].map(match => match[0]);
  assert.equal(controls.length, 3, 'One nonfunctional control per displayed payment option');
  for (const control of controls) {
    assert.match(control, /\bdisabled(?:=""|\s|>)/);
    assert.match(control, /\btype="button"/);
  }
  assert.doesNotMatch(html, /<(?:form|input|select|textarea|iframe)\b/i);
  for (const [, destination] of html.matchAll(/\bhref="([^"]*)"/g)) {
    assert.equal(destination, '#ways-to-help', 'Only an internal educational-section jump is allowed');
  }
  assert.doesNotMatch(source, /\bonClick\b|\bonSubmit\b|window\.open|\bfetch\s*\(|\bXMLHttpRequest\b|https?:\/\//);
});
