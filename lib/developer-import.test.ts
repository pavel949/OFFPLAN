import {describe,it,expect} from 'vitest';
import {importPage,safeSourceUrl} from './developer-import';
describe('private import navigation',()=>{
 it('bounds invalid pagination',()=>{expect(importPage('-2')).toBe(1);expect(importPage('2.5')).toBe(1);expect(importPage('Infinity')).toBe(1);expect(importPage('2')).toBe(2);});
 it('only links to HTTPS without embedded credentials',()=>{expect(safeSourceUrl('javascript:alert(1)')).toBeNull();expect(safeSourceUrl('https://user:secret@example.com')).toBeNull();expect(safeSourceUrl('https://drive.google.com/file/d/abc/view')).toContain('https://drive.google.com/');});
});
