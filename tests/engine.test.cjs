const assert=require('node:assert/strict');
const fs=require('node:fs');
const L=require(fs.existsSync(require('node:path').join(__dirname,'../dist/engine.js'))?'../dist/engine.js':'../engine.js');
let count=0;
function test(name,fn){fn();count++;console.log('PASS',name);}
function ready(pieces,dice,mode='classic',turn=0){const s=L.create(mode);s.pieces=pieces;s.turn=turn;L.roll(s,dice);return s;}
test('52 unique shared cells and connected paths',()=>{
 assert.equal(L.PATH.length,52);assert.equal(new Set(L.PATH.map(p=>p.join(','))).size,52);
 for(let p=0;p<2;p++)for(let n=0;n<56;n++){const a=L.location(p,0,n),b=L.location(p,0,n+1),dr=Math.abs(a[0]-b[0]),dc=Math.abs(a[1]-b[1]);assert(dr+dc>=1&&dr+dc<=2);if(n<55)assert(dr<=1&&dc<=1);}
});
test('six required to leave home',()=>{const s=L.create();L.roll(s,3);assert.equal(s.turn,1);assert.equal(s.phase,'roll');assert.deepEqual(s.pieces[0],[-1,-1,-1,-1]);});
test('six enters start without moving six squares',()=>{const s=L.create();L.roll(s,6);assert.deepEqual(L.legal(s),[0,1,2,3]);assert(L.move(s,2));assert.equal(s.pieces[0][2],0);assert.equal(s.turn,0);});
test('invalid phases and illegal choices do not mutate state',()=>{const s=L.create();const before=JSON.stringify(s);assert.equal(L.move(s,0),false);assert.equal(L.roll(s,7),false);assert.equal(L.resolve(s,false),false);assert.equal(JSON.stringify(s),before);});
test('exact finish and overshoot protection',()=>{const s=ready([[54,55,56,-1],[-1,-1,-1,-1]],2);assert.deepEqual(L.legal(s),[0]);L.move(s,0);assert.equal(s.pieces[0][0],56);assert.equal(s.score[0],30);assert.equal(s.turn,0);});
test('capture returns opponent home and grants another turn',()=>{const s=ready([[0,-1,-1,-1],[27,-1,-1,-1]],1);L.move(s,0);assert.equal(s.pieces[1][0],-1);assert.equal(s.score[0],20);assert.equal(s.turn,0);});
test('stars protect opposing pieces',()=>{const s=ready([[7,-1,-1,-1],[34,-1,-1,-1]],1);L.move(s,0);assert.equal(s.pieces[1][0],34);assert.equal(s.score[0],0);assert.equal(s.turn,1);});
test('opponent cannot be captured inside their home lane',()=>{const s=ready([[0,-1,-1,-1],[53,-1,-1,-1]],1);L.move(s,0);assert.equal(s.pieces[1][0],53);});
test('multiple pieces captured on one unprotected square',()=>{const s=ready([[0,-1,-1,-1],[27,27,-1,-1]],1);L.move(s,0);assert.deepEqual(s.pieces[1],[-1,-1,-1,-1]);assert.equal(s.score[0],40);});
test('third consecutive six passes the turn without moving',()=>{const s=L.create('classic');for(let i=0;i<2;i++){L.roll(s,6);L.move(s,0);}const old=s.pieces[0][0];L.roll(s,6);assert.equal(s.turn,1);assert.equal(s.sixes,0);assert.equal(s.pieces[0][0],old);});
test('greed can bank capture bonus exactly once',()=>{const s=ready([[0,-1,-1,-1],[27,-1,-1,-1]],1,'temptation');L.move(s,0);assert.equal(s.phase,'temptation');assert.equal(s.score[0],0);L.resolve(s,false);assert.equal(s.score[0],20);assert.equal(s.turn,0);assert.equal(L.resolve(s,false),false);});
test('greed risk doubles or loses only the pending bonus',()=>{for(let d=1;d<=6;d++){const s=ready([[0,-1,-1,-1],[27,-1,-1,-1]],1,'temptation');s.score[0]=30;L.move(s,0);L.resolve(s,true,d);assert.equal(s.score[0],30+(d>=4?40:0));assert.equal(s.pieces[1][0],-1);assert.equal(s.dice,1);}});
test('champion finishing first grants pride only once',()=>{const s=ready([[55,-1,-1,-1],[-1,-1,-1,-1]],1,'temptation');L.move(s,0);assert.equal(s.score[0],80);s.pieces[0][1]=55;L.roll(s,1);L.move(s,1);assert.equal(s.score[0],110);});
test('different first finisher forfeits pride',()=>{const s=ready([[55,55,-1,-1],[-1,-1,-1,-1]],1,'temptation');L.move(s,1);assert.equal(s.pride[0],false);assert.equal(s.score[0],30);L.roll(s,1);L.move(s,0);assert.equal(s.score[0],60);});
test('capturing champion forfeits their pride',()=>{const s=ready([[0,-1,-1,-1],[27,-1,-1,-1]],1,'temptation');L.move(s,0);assert.equal(s.pride[1],false);});
test('revenge rewards the exact marked opponent',()=>{const s=ready([[0,-1,-1,-1],[27,-1,-1,-1]],1,'temptation');s.revenge[0]=0;L.move(s,0);assert.equal(s.score[0],20);assert.equal(s.revenge[0],null);assert.equal(s.revenge[1],0);L.resolve(s,false);assert.equal(s.score[0],40);});
test('all four finished wins regardless of scores',()=>{const s=ready([[56,56,56,55],[-1,-1,-1,-1]],1);s.score[1]=10000;L.move(s,3);assert.equal(s.winner,0);assert.equal(s.phase,'done');assert.equal(L.roll(s,6),false);});
test('bot uses only legal moves and prioritizes arrival',()=>{const s=ready([[-1,-1,-1,-1],[0,55,-1,-1]],1,'classic',1);assert.equal(L.chooseBot(s),1);});
test('bot receives same pride and greed bonuses',()=>{let s=ready([[-1,-1,-1,-1],[55,-1,-1,-1]],1,'temptation',1);L.move(s,0);assert.equal(s.score[1],80);s=ready([[27,-1,-1,-1],[0,-1,-1,-1]],1,'temptation',1);L.move(s,0);L.resolve(s,false);assert.equal(s.score[1],20);});
test('500 seeded complete games preserve invariants and terminate',()=>{
 let seed=192807;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 let max=0;const winners=[0,0];
 for(let game=0;game<500;game++){
   const s=L.create(game%2?'classic':'temptation',game%4,(game+1)%4);let steps=0;
   while(s.phase!=='done'&&steps<5000){
     steps++;
     if(s.phase==='roll')assert(L.roll(s,Math.floor(random()*6)+1));
     else if(s.phase==='select'){const legal=L.legal(s);assert(legal.length);const i=L.chooseBot(s,random);assert(legal.includes(i));assert(L.move(s,i));}
     else if(s.phase==='temptation')assert(L.resolve(s,random()<.4,Math.floor(random()*6)+1));
     else assert.fail('unknown phase');
     assert(s.pieces.flat().every(v=>Number.isInteger(v)&&v>=-1&&v<=56));
     assert(s.score.every(v=>Number.isInteger(v)&&v>=0));
   }
   assert.equal(s.phase,'done');assert(s.pieces[s.winner].every(v=>v===56));winners[s.winner]++;max=Math.max(max,steps);
 }
 console.log('500 complete games; winners',winners,'; longest',max,'steps');
});
console.log(`${count} tests passed.`);
