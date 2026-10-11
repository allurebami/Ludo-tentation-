(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Ludo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PATH = [[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]];
  const SAFE = [0,8,13,21,26,34,39,47];
  const START = [0,26];
  const HOME = [[[1.8,1.8],[1.8,4.2],[4.2,1.8],[4.2,4.2]],[[10.8,10.8],[10.8,13.2],[13.2,10.8],[13.2,13.2]]];
  function create(mode = 'temptation', champion = 0, botChampion = 0) {
    return {mode, pieces: [[-1,-1,-1,-1],[-1,-1,-1,-1]], turn:0, phase:'roll', dice:0, sixes:0, score:[0,0], champion:[champion,botChampion], pride:[true,true], prideDone:[false,false], revenge:[null,null], winner:null, moves:0, pending:null, message:'À toi de jouer. Lance le dé !'};
  }
  function absolute(p, progress) { return (START[p] + progress) % 52; }
  function location(p, i, progress) {
    if (progress === -1) return HOME[p][i];
    if (progress <= 50) return PATH[absolute(p, progress)];
    if (progress <= 55) return p === 0 ? [7,progress-50] : [7,64-progress];
    return [7,7];
  }
  function legal(s) {
    if(s.phase !== 'select') return [];
    return s.pieces[s.turn].map((v,i)=>({v,i})).filter(({v})=>v === -1 ? s.dice === 6 : v < 56 && v+s.dice <= 56).map(({i})=>i);
  }
  function endTurn(s, extra = false) {
    if (!extra) { s.turn = 1-s.turn; s.sixes = 0; }
    s.phase = 'roll';
    s.pending = null;
  }
  function roll(s, dice) {
    if(s.phase !== 'roll' || s.winner !== null || !Number.isInteger(dice) || dice<1 || dice>6) return false;
    s.dice = dice;
    if (dice === 6) s.sixes++; else s.sixes=0;
    if(s.sixes === 3) { s.message='Trois 6 de suite : le tour passe.'; endTurn(s); return true; }
    s.phase='select';
    if(!legal(s).length) { s.message=dice===6 ? 'Aucun déplacement possible.' : 'Aucun pion ne peut avancer. Le tour passe.'; endTurn(s,dice===6); }
    else s.message=s.turn===0 ? 'Choisis un pion à déplacer.' : 'La machine choisit son pion…';
    return true;
  }
  function move(s, i) {
    if(!legal(s).includes(i)) return false;
    const p=s.turn, other=1-p;
    const prev=s.pieces[p][i], next=prev === -1 ? 0 : prev+s.dice;
    s.pieces[p][i]=next; s.moves++;
    let captured=[], prideBonus=0, revengeBonus=0;
    if(next<=50 && !SAFE.includes(absolute(p,next))) {
      s.pieces[other].forEach((value,j)=>{
        if(value>=0 && value<=50 && absolute(other,value)===absolute(p,next)) {
          s.pieces[other][j]=-1; captured.push(j);
          if(j===s.champion[other] && !s.prideDone[other]) s.pride[other]=false;
          if(s.mode==='temptation') {
            s.revenge[other]=i;
            if(s.revenge[p]===j) { revengeBonus=20; s.revenge[p]=null; }
          }
        }
      });
    }
    if(next===56) {
      s.score[p]+=30;
      if(s.mode==='temptation' && !s.prideDone[p]) {
        s.prideDone[p]=true;
        if(i===s.champion[p] && s.pride[p]) { prideBonus=50; s.score[p]+=prideBonus; }
        else s.pride[p]=false;
      }
    }
    s.score[p]+=revengeBonus;
    const name=p===0?'Tu':'La machine';
    s.message=next===56 ? `${name} ${p===0?'as':'a'} un pion à l’arrivée ! +30 points.${prideBonus?' Orgueil réussi : +50.':''}` : captured.length ? `${name} ${p===0?'as':'a'} capturé ${captured.length} pion${captured.length>1?'s':''} !${revengeBonus?' Vengeance : +20.':''}` : prev===-1 ? `${name} ${p===0?'as':'a'} sorti un pion.` : `${name} ${p===0?'avances':'avance'} de ${s.dice} cases.`;
    const extra=s.dice===6 || captured.length>0 || next===56;
    if(captured.length && s.mode==='temptation') {
      s.pending={player:p,amount:captured.length*20,extra}; s.phase='temptation';
    } else {
      s.score[p]+=captured.length*20;
      if(s.pieces[p].every(v=>v===56)) { s.winner=p; s.phase='done'; }
      else endTurn(s,extra);
    }
    return true;
  }
  function resolve(s, risk, dice) {
    if(s.phase!=='temptation' || !s.pending || (risk && (!Number.isInteger(dice)||dice<1||dice>6))) return false;
    const {player,amount,extra}=s.pending;
    const reward=risk ? (dice>=4 ? amount*2 : 0) : amount;
    s.score[player]+=reward;
    const name=player===0?'Tu':'La machine';
    s.message=risk ? `${name} ${player===0?'as':'a'} tenté le double : dé ${dice}. ${reward?`+${reward} points !`:'Le bonus de capture est perdu.'}` : `${name} ${player===0?'gardes':'garde'} ${reward} points.`;
    endTurn(s,extra); return true;
  }
  function chooseBot(s, random = ()=>0.5) {
    const p=s.turn, other=1-p;
    let best=-Infinity, candidates=[];
    for(const i of legal(s)) {
      const v=s.pieces[p][i], next=v===-1?0:v+s.dice;
      let score=next===56?120: next>50?35+next:next/5;
      if(v===-1) score+=20;
      if(next<=50) {
        const dest=absolute(p,next);
        if(SAFE.includes(dest)) score+=15;
        else {
          for(let j=0;j<4;j++) {
            const enemy=s.pieces[other][j];
            if(enemy<0 || enemy>50) continue;
            if(absolute(other,enemy)===dest) score+=70+(s.revenge[p]===j?25:0);
            const gap=(dest-absolute(other,enemy)+52)%52;
            if(gap>=1 && gap<=6 && enemy+gap<=50) score-=12;
          }
        }
      }
      if(s.mode==='temptation' && i===s.champion[p] && s.pride[p] && !s.prideDone[p]) score+=6;
      if(score>best) { best=score; candidates=[i]; } else if(score===best) candidates.push(i);
    }
    return candidates.length?candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))]:null;
  }
  return {PATH,SAFE,START,HOME,create,absolute,location,legal,roll,move,resolve,chooseBot};
});
