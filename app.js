'use strict';
const $=id=>document.getElementById(id);
const STORE='ludo-tentation-v1', BEST='ludo-tentation-best-v1';
let state=Ludo.create(), busy=false, epoch=0, botTimer=null, soundOn=false, audioContext=null, best=0;
let pendingMode='temptation', pendingChampion=0;
function getDie(){
  if(globalThis.crypto?.getRandomValues){const a=new Uint32Array(1);do{crypto.getRandomValues(a);}while(a[0]>=4294967292);return a[0]%6+1;}
  return Math.floor(Math.random()*6)+1;
}
function readSaved(){
  try{
    best=Number(localStorage.getItem(BEST))||0;
    const s=JSON.parse(localStorage.getItem(STORE));
    if(!s || !['classic','temptation'].includes(s.mode) || !['roll','select','temptation','done'].includes(s.phase))return;
    if(!Array.isArray(s.pieces)||s.pieces.length!==2||!s.pieces.every(a=>Array.isArray(a)&&a.length===4&&a.every(v=>Number.isInteger(v)&&v>=-1&&v<=56)))return;
    if(![0,1].includes(s.turn)||!Number.isInteger(s.dice)||s.dice<0||s.dice>6)return;
    for(const name of ['score','champion','pride','prideDone','revenge'])if(!Array.isArray(s[name])||s[name].length!==2)return;
    if(!s.score.every(v=>Number.isFinite(v)&&v>=0)||!s.champion.every(v=>Number.isInteger(v)&&v>=0&&v<4))return;
    if(s.phase==='temptation'&&(!s.pending||s.pending.player!==s.turn||!Number.isFinite(s.pending.amount)))return;
    state=s;
  }catch{}
}
function save(){try{localStorage.setItem(STORE,JSON.stringify(state));localStorage.setItem(BEST,String(best));}catch{}}
function sound(type){
  if(!soundOn)return;
  try{
    audioContext??=new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();
    const notes=type==='win'?[523,659,784,1047]:type==='capture'?[330,660]:type==='loss'?[260,180]:[420];
    notes.forEach((frequency,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain(),t=audioContext.currentTime+i*.1;o.type='sine';o.frequency.value=frequency;g.gain.setValueAtTime(.045,t);g.gain.exponentialRampToValueAtTime(.001,t+.14);o.connect(g);g.connect(audioContext.destination);o.start(t);o.stop(t+.15);});
  }catch{}
}
const svgNS='http://www.w3.org/2000/svg';
function svg(tag,attrs,text){const e=document.createElementNS(svgNS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text)e.textContent=text;$('boardart').append(e);return e;}
function drawBoard(){
  svg('rect',{width:450,height:450,fill:'#fffcf8'});
  const homes=[{r:0,c:0,color:'#e96d59',pale:'#f9ded6',name:'TOI',player:0},{r:0,c:9,color:'#69ab9e',pale:'#e4f0e9'},{r:9,c:0,color:'#d3aa54',pale:'#f5ebd1'},{r:9,c:9,color:'#6c4acb',pale:'#e8dff8',name:'MACHINE',player:1}];
  homes.forEach(h=>{
    svg('rect',{x:h.c*30+3,y:h.r*30+3,width:174,height:174,rx:17,fill:h.pale});
    svg('rect',{x:h.c*30+28,y:h.r*30+28,width:124,height:124,rx:19,fill:'#fffcf8',opacity:h.name?1:.45});
    if(h.name){Ludo.HOME[h.player].forEach(([r,c])=>svg('circle',{cx:(c+.5)*30,cy:(r+.5)*30,r:16,fill:h.pale,stroke:h.color,'stroke-opacity':.18}));svg('text',{x:h.c*30+90,y:h.r*30+167,'text-anchor':'middle','font-size':9,'font-weight':700,'letter-spacing':3,fill:h.color},h.name);}
    else{
      const cx=h.c*30+90,cy=h.r*30+90;
      [0,45,90,135].forEach(a=>svg('ellipse',{cx,cy,rx:8,ry:30,fill:h.color,opacity:.18,transform:`rotate(${a} ${cx} ${cy})`}));
      svg('circle',{cx,cy,r:10,fill:h.color,opacity:.22});
    }
  });
  Ludo.PATH.forEach(([r,c],i)=>{
    let fill='#fffcf8';if([0,13,26,39].includes(i))fill=['#e96d59','#69ab9e','#6c4acb','#d3aa54'][[0,13,26,39].indexOf(i)];
    svg('rect',{x:c*30+.5,y:r*30+.5,width:29,height:29,rx:3,fill,stroke:'#e8e1d9','stroke-width':1});
    if(Ludo.SAFE.includes(i))svg('text',{x:c*30+15,y:r*30+21,'text-anchor':'middle','font-size':22,fill:fill==='#fffcf8'?'#c9bca7':'#ffffff',opacity:.9},'★');
  });
  for(let n=1;n<=5;n++){
    [[7,n,'#f1b3a4'],[7,14-n,'#bba5eb'],[n,7,'#b8d8cd'],[14-n,7,'#e9d396']].forEach(([r,c,color])=>svg('rect',{x:c*30+.5,y:r*30+.5,width:29,height:29,rx:3,fill:color,stroke:'#fffcf8','stroke-width':1}));
  }
  [['180,180 270,180 225,225','#b8d8cd'],['270,180 270,270 225,225','#bba5eb'],['270,270 180,270 225,225','#e9d396'],['180,270 180,180 225,225','#f1b3a4']].forEach(([points,fill])=>svg('polygon',{points,fill}));
  svg('circle',{cx:225,cy:225,r:13,fill:'#fffcf8'});
  svg('text',{x:225,y:231,'text-anchor':'middle','font-size':18,fill:'#ad8b4a'},'✦');
  for(let p=0;p<2;p++)for(let i=0;i<4;i++){
    const b=document.createElement('button');b.id=`token-${p}-${i}`;b.className=`token ${p===0?'human':'bot'}`;b.textContent=i+1;
    b.addEventListener('click',()=>humanMove(i));$('tokens').append(b);
  }
}
const PIPS={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
function setPips(n){$('pips').replaceChildren(...Array.from({length:9},(_,i)=>{const e=document.createElement('i');e.className='pip'+(PIPS[n].includes(i)?'':' empty');return e;}));}
async function animateDie(result,token){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration=reduced?360:960;
  const dice=$('dice');
  dice.classList.remove('revealed');dice.classList.add('rolling');
  dice.setAttribute('aria-label','Le dé tourne…');
  let frame=0;
  const faces=setInterval(()=>{
    if(token!==epoch){clearInterval(faces);return;}
    setPips(frame%6+1);frame++;
  },90);
  await new Promise(r=>setTimeout(r,duration));
  clearInterval(faces);
  if(token!==epoch)return false;
  dice.classList.remove('rolling');dice.classList.add('revealed');
  setPips(result);$('dicevalue').textContent=`Dé : ${result}`;
  $('hint').textContent='Résultat du lancer';
  dice.setAttribute('aria-label',`Résultat du dé : ${result}`);
  await new Promise(r=>setTimeout(r,220));
  if(token!==epoch)return false;
  dice.classList.remove('revealed');
  return true;
}
function render(){
  const legal=state.turn===0&&!busy?Ludo.legal(state):[];
  const groups={};
  for(let p=0;p<2;p++)for(let i=0;i<4;i++){
    const v=state.pieces[p][i],pos=Ludo.location(p,i,v),key=pos.join(',');(groups[key]??=[]).push({p,i,v,pos});
  }
  for(const entries of Object.values(groups))entries.forEach(({p,i,v,pos},index)=>{
    const token=$(`token-${p}-${i}`),count=entries.length;
    const offsets=count===1?[[0,0]]:count===2?[[-.2,-.15],[.2,.15]]:count===3?[[-.22,-.2],[.22,-.2],[0,.22]]:[[-.22,-.22],[.22,-.22],[-.22,.22],[.22,.22],[-.1,0],[.1,0],[0,-.1],[0,.1]];
    const [dx,dy]=offsets[index]||[0,0];
    token.style.left=(pos[1]+.5+dx)/15*100+'%';token.style.top=(pos[0]+.5+dy)/15*100+'%';
    const isLegal=p===0&&legal.includes(i);
    token.disabled=!isLegal;token.classList.toggle('legal',isLegal);token.classList.toggle('finished',v===56);
    token.classList.toggle('champion',state.mode==='temptation'&&state.champion[p]===i&&state.pride[p]&&!state.prideDone[p]);
    token.style.zIndex=isLegal?10+index:3+index;
    token.setAttribute('aria-label',`${p===0?'Ton pion':'Pion de la machine'} ${i+1}, ${v===-1?'à la maison':v===56?'arrivé':`case ${v+1}`}${isLegal?', déplacer':''}`);
  });
  for(let p=0;p<2;p++){
    $('player'+p).classList.toggle('active',state.turn===p&&state.phase!=='done');
    $('home'+p).textContent=`${state.pieces[p].filter(v=>v===56).length} / 4 arrivés`;
    $('score'+p).textContent=state.score[p];
  }
  const lastDice=state.lastDice;
  const displayedDie=lastDice&&PIPS[lastDice.value]?lastDice.value:state.dice||6;
  setPips(displayedDie);
  $('turnlabel').textContent=state.phase==='done'?'PARTIE TERMINÉE':state.turn===0?'À TOI DE JOUER':'AU TOUR DE LA MACHINE';
  $('turnlabel').style.color=state.turn===0?'var(--coral)':'var(--purple)';
  $('dicevalue').textContent=busy?'Le dé tourne…':lastDice?.kind==='temptation'?`Tentation : ${displayedDie}`:state.dice?`Dé : ${state.dice}`:'Le prochain coup est entre tes mains.';
  $('hint').textContent=state.phase==='done'?'Les quatre pions décident du gagnant.':state.phase==='select'&&state.turn===0?'Touche un pion entouré de jaune.':state.dice===6?'Un 6 donne un nouveau lancer.':'Un 6 pour sortir un pion.';
  $('status').textContent=busy?(state.turn===0?'Le dé roule…':'La machine lance le dé…'):state.message;
  const canRoll=state.phase==='roll'&&state.turn===0&&!busy;
  $('roll').disabled=!canRoll;$('dice').disabled=!canRoll;
  $('dice').setAttribute('aria-label',canRoll?'Lancer le dé':`Résultat du dé : ${displayedDie}`);
  $('roll').hidden=state.phase==='done'||state.phase==='temptation'&&state.turn===0;
  $('roll').textContent=busy?'Le dé roule…':state.turn===1?'La machine joue…':state.phase==='select'?'Choisis ton pion ↓':'Lancer le dé ↗';
  $('choices').hidden=!legal.length;
  $('choices').replaceChildren(...legal.map(i=>{const b=document.createElement('button');b.textContent=`Pion ${i+1}${state.pieces[0][i]===-1?' · sortir':' · avancer'}`;b.addEventListener('click',()=>humanMove(i));return b;}));
  const tempting=state.phase==='temptation'&&state.turn===0;
  $('temptation').hidden=!tempting;
  if(tempting){const n=state.pending.amount;$('riskexplain').textContent=`Tu as gagné un bonus de ${n} points. Tu peux le conserver ou tenter ${n*2} points.`;$('bank').textContent=`Garder ${n} pts`;$('bank').disabled=busy;$('risk').disabled=busy;}
  $('result').hidden=state.phase!=='done';
  if(state.phase==='done'){
    $('resulttitle').textContent=state.winner===0?'Bien joué, tu as gagné !':'La machine remporte la partie.';
    $('resultbody').textContent=`Tes points : ${state.score[0]}. Machine : ${state.score[1]}. ${state.winner===0?'Tes quatre pions sont arrivés.':'La prochaine partie est une nouvelle chance.'}`;
  }
  document.querySelectorAll('[data-mode]').forEach(b=>{const selected=b.dataset.mode===state.mode;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',selected);});
  if(state.mode==='classic'){
    $('challengetitle').textContent='La course au centre';$('challengedetail').textContent='Capture : +20 points. Arrivée : +30 points. Fais arriver tes quatre pions pour gagner.';$('challengebox').querySelector('.challengeicon').textContent='✦';
  }else{
    $('challengebox').querySelector('.challengeicon').textContent='♛';
    if(state.revenge[0]!==null){$('challengetitle').textContent='Une vengeance à prendre';$('challengedetail').textContent=`Capture le pion ${state.revenge[0]+1} de la machine pour gagner 20 points supplémentaires.`;}
    else if(state.prideDone[0]){$('challengetitle').textContent='Ton défi d’orgueil est terminé';$('challengedetail').textContent=state.pieces[0][state.champion[0]]===56&&state.pride[0]?'Ton champion est arrivé en premier : +50 points !':'Continue la course. Les quatre pions comptent pour la victoire.';}
    else if(!state.pride[0]){$('challengetitle').textContent='Ton champion a été capturé';$('challengedetail').textContent='Le bonus d’orgueil est perdu. Tu peux toujours gagner la partie.';}
    else{$('challengetitle').textContent='Ton défi d’orgueil';$('challengedetail').textContent=`Fais arriver le pion ${state.champion[0]+1} en premier, sans te faire capturer. +50 points.`;}
  }
  $('best').textContent=`Record : ${best} pts`;
}
function afterAction(){
  if(state.phase==='done'){
    best=Math.max(best,state.score[0]);sound(state.winner===0?'win':'loss');if(state.winner===0)confetti();
  }
  save();render();scheduleBot();
}
function confetti(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;for(let i=0;i<35;i++){const e=document.createElement('i');e.className='confetti';e.style.left=Math.random()*100+'%';e.style.background=['#e96d59','#6c4acb','#f1bd61','#69ab9e'][i%4];e.style.animationDelay=i*.025+'s';document.body.append(e);setTimeout(()=>e.remove(),4000);}}
function modalOpen(){return $('rules').open||$('setup').open;}
function scheduleBot(){
  clearTimeout(botTimer);
  if(state.turn!==1||state.phase==='done'||busy||modalOpen())return;
  const token=epoch;
  botTimer=setTimeout(()=>{
    if(token!==epoch||modalOpen())return;
    if(state.phase==='roll')rollDice();
    else if(state.phase==='select'){
      const i=Ludo.chooseBot(state,()=>getDie()/7);if(i!==null){const prev=state.score[1];Ludo.move(state,i);sound(state.phase==='temptation'||state.score[1]>prev?'capture':'move');afterAction();}
    }else if(state.phase==='temptation'){applyTemptation(getDie()<=2);}
  },state.phase==='select'?620:state.phase==='temptation'?1000:800);
}
async function rollDice(){
  if(busy||state.phase!=='roll'||modalOpen())return;
  const token=epoch,result=getDie();busy=true;render();sound('move');
  if(!await animateDie(result,token))return;
  busy=false;Ludo.roll(state,result);state.lastDice={kind:'move',value:result};afterAction();
}
function humanMove(i){if(busy||state.turn!==0||state.phase!=='select'||modalOpen())return;const old=state.score[0];if(Ludo.move(state,i)){sound(state.phase==='temptation'||state.score[0]>old?'capture':'move');afterAction();}}
function tempt(risk){if(state.turn===0)applyTemptation(risk);}
async function applyTemptation(risk){
  if(busy||state.phase!=='temptation'||modalOpen())return;
  const token=epoch;
  const d=risk?getDie():null;
  if(risk){busy=true;render();sound('move');if(!await animateDie(d,token))return;}
  busy=false;Ludo.resolve(state,risk,d);if(risk){state.lastDice={kind:'temptation',value:d};state.message+=` (Le dé de tentation est indépendant du déplacement.)`;sound(d>=4?'capture':'loss');}else sound('move');afterAction();
}
function openSetup(mode=state.mode){
  pendingMode=mode;pendingChampion=state.champion[0];
  $('setuptitle').textContent=state.moves||state.dice?'Une nouvelle partie ?':'Prêt à jouer ?';
  $('setuptext').textContent=state.moves||state.dice?'La partie en cours sera remplacée. Ton record reste conservé.':'Quatre pions. Un adversaire. À toi de faire les bons choix.';
  $('champions').hidden=mode!=='temptation';setChampion(pendingChampion);$('setup').showModal();clearTimeout(botTimer);
}
function setChampion(i){pendingChampion=i;document.querySelectorAll('[data-champion]').forEach(b=>{const selected=Number(b.dataset.champion)===i;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',selected);});}
function start(){epoch++;clearTimeout(botTimer);busy=false;$('dice').classList.remove('rolling','revealed');state=Ludo.create(pendingMode,pendingChampion,getDie()%4);$('setup').close();save();render();sound('move');}
$('roll').addEventListener('click',rollDice);$('dice').addEventListener('click',rollDice);
$('bank').addEventListener('click',()=>tempt(false));$('risk').addEventListener('click',()=>tempt(true));
$('newgame').addEventListener('click',()=>openSetup());$('replay').addEventListener('click',()=>openSetup());
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.mode!==state.mode)openSetup(b.dataset.mode);}));
document.querySelectorAll('[data-champion]').forEach(b=>b.addEventListener('click',()=>setChampion(Number(b.dataset.champion))));
$('startgame').addEventListener('click',start);$('closesetup').addEventListener('click',()=>$('setup').close());
$('help').addEventListener('click',()=>{$('rules').showModal();clearTimeout(botTimer);});$('closerules').addEventListener('click',()=>$('rules').close());
for(const id of ['rules','setup']){$(id).addEventListener('close',scheduleBot);$(id).addEventListener('click',e=>{if(e.target===$(id)){const r=$(id).getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$(id).close();}});}
$('sound').addEventListener('click',()=>{soundOn=!soundOn;$('sound').setAttribute('aria-pressed',soundOn);$('sound').setAttribute('aria-label',soundOn?'Couper le son':'Activer le son');$('sound').title=soundOn?'Couper le son':'Activer le son';sound('move');});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!modalOpen()&&e.target===document.body){e.preventDefault();rollDice();}});
readSaved();drawBoard();render();scheduleBot();
