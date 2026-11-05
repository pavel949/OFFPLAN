// Source-contract regression for explicit, non-resetting form submission.
// Does not replace browser acceptance testing of React's form lifecycle.
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../components/admin/InfoForm.tsx',import.meta.url),'utf8');
test('basic information form does not use the auto-resetting React form action',()=>{
 assert.match(source,/<form onSubmit=/);
 assert.doesNotMatch(source,/<form action=/);
 assert.match(source,/event\.preventDefault\(\)/);
 assert.match(source,/new FormData\(event\.currentTarget\)/);
 assert.match(source,/startTransition\(\(\) => action\(fd\)\)/);
});
test('pending writes lock inputs and duplicate submissions without losing submitted controls',()=>{
 assert.match(source,/if \(submitting\.current\) return/);
 assert.match(source,/<fieldset disabled=\{pending\}/);
 assert.match(source,/finally \{\s*submitting\.current = false/);
 assert(source.indexOf('new FormData(event.currentTarget)')<source.indexOf('startTransition(() => action(fd))'));
});
