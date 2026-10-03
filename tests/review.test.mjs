// Independent pre-publication oracle. Intentionally imports no search helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import {solve} from '../src/solver.mjs';
import {normalizeInput} from '../src/schema.mjs';
import {validatePlan,verifyDocument} from '../src/validate.mjs';
import {exportsFor} from '../src/export.mjs';
const roster=n=>Array.from({length:n},(_,i)=>`P${i}`);
const input=(n,extra={})=>({schemaVersion:1,participants:roster(n),tableCount:2,roundCount:1,maxPerTable:n,seed:17,workBudget:1500,...extra});
function candidates(people,k){
  const result=[],groups=Array.from({length:k},()=>[]),small=Math.floor(people.length/k),large=Math.ceil(people.length/k);
  function visit(i){if(i===people.length){if(groups.every(g=>g.length>=small&&g.length<=large))result.push(groups.map(g=>[...g]));return;}
    for(let j=0;j<k;j++){if(groups[j].length===large)continue;if(j>0&&groups[j-1].length===0)break;groups[j].push(people[i]);visit(i+1);groups[j].pop();}}
  visit(0);return result;
}
function oracle(incoming,rounds){
  const counts=new Map(),seen=new Set();let total=0;
  for(let ri=0;ri<rounds.length;ri++){
    const hist=(incoming.frozenRounds??[])[ri];
    const expected=hist?hist.attendees:incoming.participants.filter(p=>!(incoming.absences??[]).some(a=>a.participant===p&&a.fromRound<=ri+1));
    const r=rounds[ri];assert.equal(r.number,ri+1);assert.equal(r.frozen,!!hist);assert.deepEqual([...r.attendees].sort(),[...expected].sort());
    assert.equal(r.tables.length,incoming.tableCount);assert.deepEqual(r.tables.flat().sort(),[...expected].sort());
    const sizes=r.tables.map(x=>x.length);assert.ok(Math.min(...sizes)>0);assert.ok(Math.max(...sizes)-Math.min(...sizes)<=1);
    if(hist)assert.deepEqual(r.tables,hist.tables);else{assert.ok(sizes.every(n=>n<=incoming.maxPerTable));for(const [a,b] of incoming.keepApart??[])assert.ok(r.tables.every(g=>!(g.includes(a)&&g.includes(b))));}
    for(let i=0;i<incoming.participants.length;i++)for(let j=i+1;j<incoming.participants.length;j++){
      if(r.tables.some(g=>g.includes(incoming.participants[i])&&g.includes(incoming.participants[j]))){const key=`${i}:${j}`;seen.add(key);counts.set(key,(counts.get(key)??0)+1);total++;}
    }
  }
  return {unique:seen.size,total,repeats:total-seen.size,counts,max:Math.max(0,...counts.values())};
}
test('independent exhaustive oracle: all keep-apart graphs on four and five people',()=>{
  let checked=0,feasible=0,proved=0,exhausted=0;
  for(const n of [4,5]){
    const people=roster(n),pairs=[];for(let a=0;a<n;a++)for(let b=a+1;b<n;b++)pairs.push([people[a],people[b]]);
    const partitions=candidates(people,2);
    for(let mask=0;mask<2**pairs.length;mask++){
      const apart=pairs.filter((_,i)=>mask&(1<<i));const exists=partitions.some(gs=>apart.every(([a,b])=>gs.every(g=>!g.includes(a)||!g.includes(b))));
      const incoming=input(n,{keepApart:apart}),res=solve(incoming);checked++;
      if(exists){feasible++;assert.equal(res.status,'best-found',`n=${n}, mask=${mask}`);oracle(incoming,res.plan.rounds);}
      else {assert.notEqual(res.status,'best-found',`n=${n}, mask=${mask}`);if(res.status==='contradiction')proved++;else {exhausted++;assert.match(res.reasons.join(' '),/not a proof/i);}}
      if(res.status==='best-found')assert.ok(res.plan.search.workUsed<=incoming.workBudget);else assert.ok(res.workUsed<=incoming.workBudget);
    }
  }
  assert.equal(checked,1088);assert.ok(feasible>0&&proved>0&&exhausted>0);
});
test('independent audit oracle, absences, arbitrary roster labels, and frozen history',()=>{
  for(let seed=0;seed<100;seed++){
    const n=4+seed%21,k=Math.min(n,2+seed%5),p=roster(n);
    const hist=candidates(p.slice(0,Math.min(n,6)),2)[0];
    const frozen=seed%4===0&&k===2?[{attendees:p.slice(0,Math.min(n,6)),tables:hist}]:[];
    const incoming=input(n,{tableCount:k,roundCount:6,maxPerTable:Math.ceil(n/k),seed,workBudget:2000,frozenRounds:frozen,keepApart:n>k+1?[[p[0],p[1]]]:[],absences:n>k?[{participant:p.at(-1),fromRound:3}]:[]});
    const before=structuredClone(incoming),res=solve(incoming);assert.equal(res.status,'best-found');assert.deepEqual(incoming,before);
    const expected=oracle(incoming,res.plan.rounds),audit=res.plan.audit;assert.equal(audit.uniquePairs,expected.unique);assert.equal(audit.totalPairEncounters,expected.total);assert.equal(audit.repeatEncounters,expected.repeats);assert.equal(audit.maxPairCount,expected.max);
    for(let i=0;i<n;i++){assert.equal(audit.matrix[i][i],0);for(let j=i+1;j<n;j++){assert.equal(audit.matrix[i][j],expected.counts.get(`${i}:${j}`)??0);assert.equal(audit.matrix[j][i],audit.matrix[i][j]);}}
    assert.ok(audit.repeatLowerBound<=expected.repeats);assert.deepEqual(solve(incoming),res);
    const untrusted=structuredClone(res.plan);untrusted.audit={uniquePairs:-999,matrix:[],repeatEncounters:NaN};assert.deepEqual(verifyDocument(untrusted).audit,audit);
  }
});
test('validators reject diverse serialized table and attendance corruptions',()=>{
  const incoming=input(6,{roundCount:3,maxPerTable:3}),good=solve(incoming).plan;
  const corruptions=[p=>p.rounds.pop(),p=>p.rounds[0]=null,p=>p.rounds[0].number=2,p=>p.rounds[0].frozen=true,p=>p.rounds[0].attendees=[],p=>p.rounds[0].tables=null,p=>p.rounds[0].tables[0]={},p=>p.rounds[0].tables[0][0]=null,p=>p.rounds[0].tables[0][0]='NOPE',p=>p.rounds[0].tables[0][0]=p.rounds[0].tables[1][0],p=>p.rounds[0].tables[0].push(p.rounds[0].tables[1].pop()),p=>p.rounds[0].tables[0][0]=['P0']];
  for(const edit of corruptions){const bad=structuredClone(good);edit(bad);assert.equal(validatePlan(incoming,bad.rounds).valid,false);assert.throws(()=>verifyDocument(bad));}
});
test('JSON export roundtrip preserves punctuation and non-ASCII labels; HTML never interprets them',()=>{
  const labels=['</li><img src=x>','"quoted,comma"','a:b','日本語😀','[foo]','__proto__'];const p=solve(input(6,{participants:labels,maxPerTable:3,roundCount:3})).plan;
  const x=exportsFor(p);assert.deepEqual(verifyDocument(JSON.parse(x.json)),p);assert.ok(!x.printHTML.includes('<img'));assert.ok(x.printHTML.includes('&lt;/li&gt;&lt;img src=x&gt;'));assert.ok(x.tablesCSV.includes('""quoted,comma""'));assert.ok(x.matrixCSV.includes('__proto__'));
});


test('exported APIs reject sparse arrays at every trust boundary',()=>{
  const incoming=input(4),hist={attendees:roster(4),tables:[['P0','P1'],['P2','P3']]};
  for(const patch of [
    {participants:new Array(4)}, {keepApart:new Array(1)}, {keepApart:[new Array(2)]},
    {absences:new Array(1)}, {frozenRounds:new Array(1)},
    {frozenRounds:[{...hist,attendees:new Array(4)}]},
    {frozenRounds:[{...hist,tables:new Array(2)}]},
    {frozenRounds:[{...hist,tables:[new Array(2),['P2','P3']]}]},
  ])assert.throws(()=>normalizeInput({...incoming,...patch}));
  const good=solve(incoming).plan;
  for(const edit of [
    p=>p.rounds=new Array(1),p=>delete p.rounds[0].attendees[3],
    p=>p.rounds[0].tables=new Array(2),p=>delete p.rounds[0].tables[0][0],
    p=>{p.rounds[0].tables=[roster(4),[]];delete p.rounds[0].tables[1];},
  ]){const p=structuredClone(good);edit(p);assert.equal(validatePlan(incoming,p.rounds).valid,false);assert.throws(()=>verifyDocument(p),e=>e.name==='InputError');}
});

test('verified imports canonicalize extra metadata without retaining opaque payloads',()=>{
  const incoming=input(4),good=solve(incoming).plan,bad=structuredClone(good);
  bad.extra='untrusted top-level payload';bad.search.extra='untrusted search payload';
  bad.rounds[0].extra={opaque:'untrusted round payload'};bad.rounds[0].attendees.extra='array payload';bad.rounds[0].tables[0].extra='table payload';
  assert.deepEqual(verifyDocument(bad),good);assert.deepEqual(JSON.parse(exportsFor(bad).json),good);
});

test('all 256 absence-onset patterns preserve round attendance or prove nonempty-table shortage',()=>{
  for(let encoded=0;encoded<256;encoded++){
    let choices=encoded;const absences=[];for(const participant of roster(4)){const fromRound=choices%4;choices=Math.floor(choices/4);if(fromRound)absences.push({participant,fromRound});}
    const incoming=input(4,{roundCount:3,maxPerTable:2,absences});const res=solve(incoming);
    const enough=[1,2,3].every(r=>4-absences.filter(a=>a.fromRound<=r).length>=2);
    if(enough){assert.equal(res.status,'best-found');oracle(incoming,res.plan.rounds);}else{assert.equal(res.status,'contradiction');assert.match(res.reasons.join(' '),/fewer attendees/);}
  }
});
