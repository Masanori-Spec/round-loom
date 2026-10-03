import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,symlink,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
const cli=resolve('src/cli.mjs');
const run=(file,out)=>spawnSync(process.execPath,[cli,'solve',file,out],{encoding:'utf8',timeout:2000});
const source=JSON.stringify({schemaVersion:1,participants:['A','B','C','D'],tableCount:2,roundCount:1,maxPerTable:2,workBudget:100});
test('CLI accepts byte-limit JSON, rejects oversize and directories without output',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'loom-review-'));
  try{
    const file=join(dir,'input.json');await writeFile(file,source.padEnd(262144,' '));let r=run(file,join(dir,'out'));assert.equal(r.status,0,r.stderr);
    await writeFile(file,source.padEnd(262145,' '));r=run(file,join(dir,'too-large'));assert.equal(r.status,2);assert.match(r.stderr,/256 KiB/);
    r=run(dir,join(dir,'directory-out'));assert.equal(r.status,2);assert.match(r.stderr,/regular JSON file/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('CLI rejects FIFO and devices promptly; regular-file symlink stays usable',{skip:process.platform==='win32'},async t=>{
  const dir=await mkdtemp(join(tmpdir(),'loom-review-'));
  try{
    const file=join(dir,'input.json'),link=join(dir,'link.json'),fifo=join(dir,'pipe');await writeFile(file,source);await symlink(file,link);let r=run(link,join(dir,'out'));assert.equal(r.status,0,r.stderr);
    const fifoResult=spawnSync('mkfifo',[fifo],{encoding:'utf8'});if(fifoResult.status!==0){t.skip('mkfifo unavailable on this platform');return;}
    r=run(fifo,join(dir,'fifo-out'));assert.equal(r.error,undefined);assert.equal(r.status,2);assert.match(r.stderr,/regular JSON file/);
    r=run('/dev/null',join(dir,'device-out'));assert.equal(r.error,undefined);assert.equal(r.status,2);assert.match(r.stderr,/regular JSON file/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
