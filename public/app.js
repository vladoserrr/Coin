const GAMES = [
 {id:"dice",name:"Кости",icon:"dice",desc:"Брось кубик и поймай высокий результат.",type:"luck",category:"LUCK",hint:"Выпало 5–6 — выигрыш ×1.9"},
 {id:"coin",name:"Монетка",icon:"coin",desc:"Орёл или решка — решает один бросок.",type:"luck",category:"LUCK",hint:"Шанс выигрыша 46% · ×1.85"},
 {id:"roulette",name:"Рулетка",icon:"roulette",desc:"Крути колесо и лови редкий сектор.",type:"luck",category:"LUCK",hint:"Красное ×1.85 · Золото ×7"},
 {id:"mines",name:"Мины",icon:"mines",desc:"Открой безопасную ячейку и забери множитель.",type:"skill",category:"SKILL",hint:"Безопасная ячейка 49% · ×1.8"},
 {id:"slots",name:"Слоты",icon:"slots",desc:"Собери одинаковые символы на барабанах.",type:"luck",category:"LUCK",hint:"Комбинации до ×7"},
 {id:"plinko",name:"Плинко",icon:"plinko",desc:"Отпусти шар и смотри, куда он упадёт.",type:"luck",category:"LUCK",hint:"Множители от ×0.2 до ×3"},
 {id:"wheel",name:"Колесо",icon:"wheel",desc:"Испытай удачу на секторном колесе.",type:"luck",category:"LUCK",hint:"Случайный множитель до ×5"},
 {id:"hilo",name:"Выше-ниже",icon:"hilo",desc:"Угадай, будет следующая карта выше или ниже.",type:"skill",category:"SKILL",hint:"Верный прогноз — ×1.75"},
 {id:"blackjack",name:"Блэкджек",icon:"blackjack",desc:"Набери ближе к 21, чем дилер.",type:"skill",category:"SKILL",hint:"Победа — ×1.8"},
 {id:"baccarat",name:"Баккара",icon:"baccarat",desc:"Предскажи, чья сумма будет ближе к девяти.",type:"luck",category:"LUCK",hint:"Победа ×1.85 · ничья ×2"},
 {id:"keno",name:"Кено",icon:"keno",desc:"Выбери удачное число из случайного тиража.",type:"luck",category:"LUCK",hint:"Попадание 16% · ×5"},
 {id:"crash",name:"Краш",icon:"crash",desc:"Забери выигрыш до того, как график рухнет.",type:"skill",category:"SKILL",hint:"Множитель до ×4"},
 {id:"limbo",name:"Лимбо",icon:"limbo",desc:"Поймай случайный множитель выше цели.",type:"skill",category:"SKILL",hint:"Цель ×3 · выплата ×2.1"},
 {id:"towers",name:"Башни",icon:"towers",desc:"Поднимайся выше, не попав на ловушку.",type:"skill",category:"SKILL",hint:"Каждый шаг повышает множитель"}
];

const DEMO_PLAYERS = [
 {name:"LuckyFox",score:18420,games:126,initial:"L"},
 {name:"NeonWolf",score:15280,games:98,initial:"N"},
 {name:"GoldRush",score:11950,games:84,initial:"G"},
 {name:"MisterX",score:9750,games:71,initial:"M"},
 {name:"PixelKing",score:8320,games:65,initial:"P"},
 {name:"DarkAce",score:7210,games:53,initial:"D"},
 {name:"StarBoy",score:6150,games:47,initial:"S"}
];

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString("ru-RU");
const load = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } };
let state = load("coinState", {balance:10000,wins:0,played:0,score:0,nickname:"Vlad",history:[]});
let currentGame = null;
let activeFilter = "all";
let remotePlayers = [];
let activePeriod = "season";
let playerId = load("coinPlayerId", "");
if (!playerId) {
 playerId = "coin_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
 localStorage.setItem("coinPlayerId", playerId);
}
let toastTimer;
let telegramInitData = window.Telegram?.WebApp?.initData || "";
let telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user || null;
let isCoinAdmin = false;
let roundCounter = 0;
let animationTimers = [];
let animationToken = 0;
let blackjackRound = null;
function clearGameAnimation(){animationToken++;animationTimers.forEach(clearTimeout);animationTimers=[];}
function apiHeaders(){return {"Content-Type":"application/json",...(telegramInitData?{"X-Telegram-Init-Data":telegramInitData}:{})};}
async function initTelegram(){
 const tg=window.Telegram?.WebApp;
 if(tg){tg.ready();tg.expand();telegramUser=tg.initDataUnsafe?.user||null;telegramInitData=tg.initData||"";}
 if(!telegramInitData)return;
 try{
  const r=await fetch("/api/auth",{method:"POST",headers:apiHeaders(),body:JSON.stringify({initData:telegramInitData})});
  if(!r.ok)throw new Error("Telegram auth failed");
  const d=await r.json();
  if(d.telegramEnabled&&d.player){
   telegramUser=d.user||telegramUser;playerId=d.player.id||playerId;isCoinAdmin=!!d.admin;
   state.nickname=d.player.nickname||state.nickname;state.balance=Number(d.player.balance??state.balance);
   state.telegramUsername=d.player.username||"";state.telegramPhoto=d.player.photoUrl||"";
   save();updateStats();const profileLine=document.getElementById("profileTelegram");if(profileLine)profileLine.textContent=(d.player.username?"@"+d.player.username:"Telegram аккаунт без username")+" · профиль и аватар синхронизированы";if(state.telegramPhoto){const avatar=document.getElementById("profileOpen");avatar.innerHTML='<img src="'+escapeHtml(state.telegramPhoto)+'" alt="" referrerpolicy="no-referrer">';}if(isCoinAdmin)document.getElementById("adminEntry")?.classList.remove("hidden");
  }
 }catch(e){console.warn("Coin Telegram auth:",e.message);}
}


function save(){ localStorage.setItem("coinState",JSON.stringify(state)); }
function notify(message){ const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2400); }
function updateStats(){
 $("headerBalance").textContent=fmt(state.balance);
 $("statBalance").textContent=fmt(state.balance)+" CR";
 $("statWins").textContent=fmt(state.wins);
 $("statPlayed").textContent=fmt(state.played);
 if($("transferBalance"))$("transferBalance").textContent=fmt(state.balance)+" CR";
 const rank=buildBoard().findIndex(p=>p.me);
 $("statRank").textContent=rank<0?"—":"#"+(rank+1);
}
function buildBoard(){
 if(remotePlayers.length){
  return remotePlayers.map(p=>({name:p.nickname,username:p.username||"",photoUrl:p.photoUrl||"",score:p.score,games:p.games,initial:(p.nickname||"И").slice(0,1).toUpperCase(),me:p.id===playerId}));
 }
 const players=DEMO_PLAYERS.map(p=>({...p,me:false}));
 players.push({name:state.nickname||"Игрок",score:state.score,games:state.played,initial:(state.nickname||"V").slice(0,1).toUpperCase(),me:true});
 return players.sort((a,b)=>b.score-a.score);
}
async function refreshBoard(period=activePeriod){
 try{
  const response=await fetch("/api/leaderboard?period="+encodeURIComponent(period),{cache:"no-store"});
  if(!response.ok)throw new Error("leaderboard unavailable");
  const data=await response.json();remotePlayers=data.players||[];
  updateStats();renderBoard("previewBoard",5);renderBoard("fullBoard",100);
 }catch(error){console.warn("Coin leaderboard:",error.message);}
}
async function syncPlayer(){
 try{
  await fetch("/api/player",{method:"POST",headers:apiHeaders(),body:JSON.stringify({playerId,nickname:state.nickname||"Игрок",balance:state.balance})});
  await refreshBoard();
 }catch(error){console.warn("Coin player sync:",error.message);}
}
async function syncScore(points,won){
 try{
  await fetch("/api/score",{method:"POST",headers:apiHeaders(),body:JSON.stringify({playerId,nickname:state.nickname||"Игрок",points,won,balance:state.balance})});
  await refreshBoard();
 }catch(error){console.warn("Coin score sync:",error.message);}
}
function renderBoard(target,limit){
 const board=buildBoard().slice(0,limit);
 const head='<div class="leader-row leader-head"><span>МЕСТО</span><span>УЧАСТНИК</span><span class="leader-games">СЫГРАНО</span><span style="text-align:right">ОЧКИ</span></div>';
 const rows=board.map((p,i)=>'<div class="leader-row player-row"><span class="rank '+(i<3?'r'+(i+1):'')+'">'+String(i+1).padStart(2,"0")+'</span><span class="player-cell">'+(p.photoUrl?'<img class="player-avatar player-photo" src="'+escapeHtml(p.photoUrl)+'" alt="" referrerpolicy="no-referrer">':'<span class="player-avatar">'+escapeHtml(p.initial)+'</span>')+'<span>'+escapeHtml(p.name)+(p.username?'<small>@'+escapeHtml(p.username)+'</small>':(p.me?'<small>ТВОЙ ПРОФИЛЬ</small>':'<small>УЧАСТНИК COIN</small>'))+'</span></span><span class="score-cell leader-games">'+fmt(p.games)+'<small>ИГР</small></span><span class="score-cell">'+fmt(p.score)+'<small>ОЧКОВ</small></span></div>').join("");
 $(target).innerHTML=head+rows;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

const GAME_PATHS = {
 dice:'<path d="M28 28h44v44H28z"/><circle cx="40" cy="40" r="3"/><circle cx="60" cy="60" r="3"/><circle cx="60" cy="40" r="3"/><circle cx="40" cy="60" r="3"/>',
 coin:'<circle cx="50" cy="50" r="27"/><circle cx="50" cy="50" r="19"/><path d="M43 39h12a7 7 0 0 1 0 14H43m7-20v34"/>',
 roulette:'<circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="8"/><path d="M50 20v22m21-13L56 45m24 5H58m-8 30V58M29 71l15-15M20 50h22M29 29l15 15"/>',
 mines:'<path d="M50 24v52M24 50h52M32 32l36 36m0-36L32 68"/><circle cx="50" cy="50" r="18"/>',
 slots:'<rect x="22" y="29" width="56" height="42" rx="8"/><path d="M40 29v42m20-42v42"/><path d="M31 50h5m17 0h5m13 0h5"/>',
 plinko:'<path d="M50 20 25 73h50L50 20Z"/><circle cx="40" cy="42" r="2"/><circle cx="60" cy="42" r="2"/><circle cx="34" cy="55" r="2"/><circle cx="50" cy="55" r="2"/><circle cx="66" cy="55" r="2"/>',
 wheel:'<circle cx="50" cy="50" r="29"/><path d="M50 21v58M21 50h58M29 29l42 42m0-42L29 71"/><circle cx="50" cy="50" r="7"/>',
 hilo:'<rect x="29" y="22" width="42" height="56" rx="7"/><path d="M40 39h20m-20 9h13m-13 9h17"/>',
 blackjack:'<rect x="23" y="28" width="40" height="52" rx="6" transform="rotate(-9 23 28)"/><rect x="38" y="22" width="40" height="52" rx="6" transform="rotate(9 38 22)"/><path d="m49 37 4 8 8 1-6 6 1 8-7-4-7 4 1-8-6-6 8-1 4-8Z"/>',
 baccarat:'<path d="M50 20 77 50 50 80 23 50 50 20Z"/><path d="M50 35v30m-9-15h18"/>',
 keno:'<circle cx="50" cy="50" r="29"/><path d="M50 32v36m-18-18h36m-31-13 26 26m0-26L37 63"/>',
 crash:'<path d="M24 68 43 49l11 10 23-30"/><path d="M61 29h16v16"/><path d="M24 77h54"/>',
 limbo:'<path d="M22 70 39 54l11 8 27-34"/><path d="M64 28h13v13"/><path d="M22 78h56"/>',
 towers:'<path d="M30 76h40M35 76V55h30v21M39 55V39h22v16M44 39V25h12v14"/><path d="M26 48h9m30 0h9"/>'
};
function svgIcon(id){return '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">'+(GAME_PATHS[id]||GAME_PATHS.dice)+'</svg>';}
function gameArt(game){return '<div class="cover-art cover-'+game.id+'"><div class="cover-light"></div><div class="cover-lines"></div><span class="cover-index">'+String(GAMES.indexOf(game)+1).padStart(2,"0")+'</span>'+svgIcon(game.id)+'</div>';}
function renderGames(){
 $("gamesGrid").innerHTML=GAMES.filter(g=>activeFilter==="all"||g.type===activeFilter).map(g=>'<button class="game-card" data-game="'+g.id+'" style="--glow:'+(g.type==="skill"?"#61d9dc":"#f3c76a")+'"><div class="game-card-top"><span class="game-icon">'+gameArt(g)+'</span><span class="game-type">'+(g.type==="skill"?"SKILL GAME":"LUCK GAME")+'</span></div><h3>'+g.name+'</h3><p>'+g.desc+'</p><div class="game-card-foot"><span>'+g.hint.toUpperCase()+'</span><span>↗</span></div></button>').join("");
 document.querySelectorAll("[data-game]").forEach(el=>el.addEventListener("click",()=>openGame(el.dataset.game)));
}
function openGame(id){
 clearGameAnimation();
 const playBtn=$("playButton");if(playBtn){playBtn.disabled=false;playBtn.innerHTML='ИГРАТЬ <span>→</span>';}
 document.querySelector(".hero").classList.add("hidden");document.querySelector(".stats-row").classList.add("hidden");
 currentGame=GAMES.find(g=>g.id===id);if(!currentGame)return;gameChoice="";renderGameOptions();
 $("stageIcon").innerHTML=svgIcon(currentGame.id);$("stageTitle").textContent=currentGame.name;$("stageDesc").textContent=currentGame.desc;$("stageCategory").textContent=currentGame.category;
 $("displayResult").textContent="?";$("displayCaption").textContent="ГОТОВ К ИГРЕ";$("resultNote").textContent=currentGame.hint+" · Выбери ставку и нажми «Играть».";
 $("resultNote").className="result-note";$("blackjackActions").classList.toggle("hidden",!(currentGame.id==="blackjack"&&blackjackRound));if(currentGame.id==="blackjack"&&blackjackRound)renderBlackjack();$("gameStage").classList.remove("hidden");
 $("gamesSection").classList.add("hidden");$("leaderboardPreview").classList.add("hidden");
 $("gameStage").scrollIntoView({behavior:"smooth",block:"start"});
}
function showMore(){["gameStage","gamesSection","leaderboardPreview","leaderboardPage","transferPage"].forEach(id=>$(id).classList.add("hidden"));document.querySelector(".hero").classList.add("hidden");document.querySelector(".stats-row").classList.add("hidden");$("morePage").classList.remove("hidden");document.querySelectorAll("[data-bottom]").forEach(b=>b.classList.toggle("active",b.dataset.bottom==="more"));if(isCoinAdmin)$("adminEntry")?.classList.remove("hidden");$("morePage").scrollIntoView({behavior:"smooth",block:"start"});}
function setProfileAvatar(el,url,name){if(!el)return;if(url){el.innerHTML='<img src="'+escapeHtml(url)+'" alt="" referrerpolicy="no-referrer">';}else el.textContent=(name||"И").slice(0,1).toUpperCase();}
function showCasino(){
 document.querySelector(".hero").classList.remove("hidden");document.querySelector(".stats-row").classList.remove("hidden");
 $("gameStage").classList.add("hidden");$("gamesSection").classList.remove("hidden");$("leaderboardPreview").classList.remove("hidden");$("leaderboardPage").classList.add("hidden");$("transferPage").classList.add("hidden");$("morePage").classList.add("hidden");
 document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page==="casino"));
 document.querySelectorAll("[data-bottom]").forEach(b=>b.classList.toggle("active",b.dataset.bottom==="casino"));
}
function showLeaderboard(){
 document.querySelector(".hero").classList.add("hidden");document.querySelector(".stats-row").classList.add("hidden");
 $("gameStage").classList.add("hidden");$("gamesSection").classList.add("hidden");$("leaderboardPreview").classList.add("hidden");$("transferPage").classList.add("hidden");$("morePage").classList.add("hidden");$("leaderboardPage").classList.remove("hidden");
 document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page==="leaderboard"));
 document.querySelectorAll("[data-bottom]").forEach(b=>b.classList.toggle("active",b.dataset.bottom==="leaderboard"));
 renderBoard("fullBoard",20);refreshBoard(activePeriod);$("leaderboardPage").scrollIntoView({behavior:"smooth",block:"start"});
}
function showTransfer(){
 document.querySelector(".hero").classList.add("hidden");document.querySelector(".stats-row").classList.add("hidden");
 $("gameStage").classList.add("hidden");$("gamesSection").classList.add("hidden");$("leaderboardPreview").classList.add("hidden");$("leaderboardPage").classList.add("hidden");$("morePage").classList.add("hidden");$("transferPage").classList.remove("hidden");updateStats();$("transferPage").scrollIntoView({behavior:"smooth",block:"start"});
 document.querySelectorAll("[data-bottom]").forEach(b=>b.classList.toggle("active",b.dataset.bottom==="transfer"));
}
function randomInt(a,b){return Math.floor(Math.random()*(b-a+1))+a;}

let gameChoice = "";
const GAME_CHOICES = {
 dice:{label:"Выбери прогноз",items:[["low","2–6"],["seven","Ровно 7"],["high","8–12"],["even","Чётное"],["odd","Нечётное"]]},
 coin:{label:"Как упадёт монета?",items:[["heads","Орёл"],["tails","Решка"]]},
 roulette:{label:"Выбери сектор",items:[["red","Красное"],["black","Чёрное"],["green","Зеро · 0"]]},
 mines:{label:"Уровень риска",items:[["safe1","1 мина"],["safe3","3 мины"],["safe5","5 мин"]]},
 slots:{label:"Выбери комбинацию",items:[["any","Любая комбинация"],["seven","Три семёрки"],["bar","Три BAR"]]},
 plinko:{label:"Риск и таблица выплат",items:[["low","Низкий"],["medium","Средний"],["high","Высокий"]]},
 wheel:{label:"На какой сектор ставим?",items:[["blue","Синий"],["red","Красный"],["gold","Золотой"]]},
 hilo:{label:"Следующая карта будет…",items:[["higher","Выше"],["lower","Ниже"]]},
 blackjack:{label:"Решение игрока",items:[["hit","Взять карту"],["stand","Остановиться"]]},
 baccarat:{label:"На кого ставим?",items:[["player","Игрок"],["banker","Банк"],["tie","Ничья"]]},
 keno:{label:"Выбери комбинацию из 3 чисел",items:[["1,12,24","01 · 12 · 24"],["7,17,27","07 · 17 · 27"],["9,19,29","09 · 19 · 29"]]},
 crash:{label:"Автовывод на множителе",items:[["1.5","×1.50"],["2","×2.00"],["3","×3.00"],["5","×5.00"]]},
 limbo:{label:"Выбери целевой множитель",items:[["1.5","×1.50"],["2","×2.00"],["3","×3.00"],["5","×5.00"]]},
 towers:{label:"Сколько этажей пройти?",items:[["1","1 этаж"],["2","2 этажа"],["3","3 этажа"],["4","4 этажа"]]}
};
function renderGameOptions(){
 const cfg=GAME_CHOICES[currentGame?.id];if(!cfg)return;
 if(!gameChoice)gameChoice=cfg.items[0][0];
 $("gameOptions").innerHTML='<div class="choice-heading">'+cfg.label+'</div><div class="choice-list">'+cfg.items.map(([v,t])=>'<button type="button" class="choice-btn '+(gameChoice===v?'selected':'')+'" data-choice="'+v+'">'+t+'</button>').join("")+'</div><div class="choice-hint">Раунд будет рассчитан с учётом выбранного варианта</div>';
 $("gameOptions").querySelectorAll("[data-choice]").forEach(b=>b.addEventListener("click",()=>{gameChoice=b.dataset.choice;renderGameOptions();}));
}
function visualMarkup(id,r={},rolling=false){
 if(id==="dice")return '<div class="dice-scene '+(rolling?'rolling':'')+'"><div class="die"><b>'+(r.d1||"")+'</b></div><div class="die"><b>'+(r.d2||"")+'</b></div></div>';
 if(id==="coin")return '<div class="coin-scene '+(rolling?'rolling':'')+'"><div class="coin-disc">'+(r.side==="heads"?"О":"Р")+'</div></div>';
 if(id==="roulette"||id==="wheel"){const roulette=id==="roulette";const nums=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];const reds=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];const count=roulette?37:8;const labels=roulette?nums:["×1.5","×2","×0.5","×5","×0","×1","×3","×0"];const spans=labels.map((v,i)=>{const col=roulette?(i===0?"#16865f":reds.includes(v)?"#bd3448":"#182c50"):["#245b91","#b72f43","#245b91","#d5a64e","#b72f43","#245b91","#b72f43","#d5a64e"][i];return '<span style="--i:'+i+';--sector:'+col+'">'+v+'</span>';}).join("");const idx=Number.isInteger(r.index)?r.index:0;const angle=r.landingAngle??(360-((idx+.5)*360/count));return '<div class="wheel-scene '+(rolling?"rolling":"")+'"><div class="wheel-pointer"></div><div class="wheel-disc '+(roulette?"roulette-disc":"prize-disc")+(rolling?"":" landed")+'" style="--landing-angle:'+angle+'deg;--sector-count:'+count+'"><div class="wheel-labels">'+spans+'</div><b>'+(roulette?"ROULETTE":"COIN")+'</b></div></div>';}
 if(id==="slots")return '<div class="slot-machine '+(rolling?'rolling':'')+'"><div class="slot-reel">'+(r.symbols?.[0]||"7")+'</div><div class="slot-reel">'+(r.symbols?.[1]||"◆")+'</div><div class="slot-reel">'+(r.symbols?.[2]||"●")+'</div></div>';
 if(id==="plinko")return '<div class="plinko-board '+(rolling?'rolling':'')+'"><div class="plinko-ball"></div><div class="plinko-pegs">'+Array.from({length:6},(_,i)=>'<span>'+Array.from({length:i+3},()=>'<i></i>').join("")+'</span>').join("")+'</div><div class="plinko-bins"><i>0.2</i><i>0.5</i><i>1</i><i>2</i><i>3</i></div></div>';
 if(id==="mines"||id==="towers")return '<div class="tile-board">'+Array.from({length:id==="mines"?9:4},(_,i)=>'<span class="'+(r.safeIndex===i?(r.safe?"safe":"danger"):"")+'">'+(r.safeIndex===i?(r.safe?"✓":"×"):"")+'</span>').join("")+'</div>';
 if(id==="hilo"||id==="blackjack"||id==="baccarat")return '<div class="card-table"><div class="playing-card">'+(r.cardA||"A")+'<small>♠</small></div><div class="card-vs">VS</div><div class="playing-card">'+(r.cardB||"K")+'<small>♥</small></div></div>';
 if(id==="keno")return '<div class="keno-board">'+Array.from({length:25},(_,i)=>'<span class="'+((r.hits||[]).includes(i+1)?"hit":"")+'">'+String(i+1).padStart(2,"0")+'</span>').join("")+'</div>';
 if(id==="crash")return '<div class="crash-chart '+(rolling?'rolling':'')+'"><svg viewBox="0 0 320 140"><path d="M8 128 Q55 118 82 98 T150 70 T220 22 T300 10" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg><b>'+(r.label||"×1.00")+'</b></div>';
 if(id==="limbo")return '<div class="limbo-meter '+(rolling?'rolling':'')+'"><div class="limbo-needle"></div><b>'+(r.label||"×?.??")+'</b></div>';
 return '<div class="generic-scene"><div class="generic-orb"></div><b>'+(r.label||"COIN")+'</b></div>';
}
function choiceOutcome(id,choice){
 const ri=(a,b)=>randomInt(a,b);
 switch(id){
 case "dice":{const d1=ri(1,6),d2=ri(1,6),n=d1+d2,win=choice==="low"?n<=6:choice==="seven"?n===7:choice==="high"?n>=8:choice==="even"?n%2===0:n%2===1;const odds={low:1.65,seven:5,high:1.65,even:1.85,odd:1.85};return {label:n+" · "+d1+"+"+d2,caption:"СУММА НА КОСТЯХ",mult:win?odds[choice]:0,detail:"Выпало "+n+". "+(win?"Прогноз совпал!":"Прогноз не совпал."),d1,d2};}
 case "coin":{const side=Math.random()<.5?"heads":"tails",win=side===choice;return {label:side==="heads"?"ОРЁЛ":"РЕШКА",caption:"БРОСОК МОНЕТЫ",mult:win?1.9:0,detail:win?"Ты угадал сторону монеты.":"Выпала другая сторона.",side};}
 case "roulette":{const wheel=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26],n=ri(0,36),index=wheel.indexOf(n),red=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(n),color=n===0?"green":red?"red":"black",win=color===choice;return {label:String(n),caption:color==="green"?"ЗЕЛЁНОЕ ЗЕРО":color==="red"?"КРАСНОЕ":"ЧЁРНОЕ",mult:win?(choice==="green"?30:1.9):0,detail:"Шар остановился на "+n+". "+(win?"Твой сектор!":"Ставка не сыграла."),number:n,color,index,landingAngle:360-((index+.5)*(360/37))};}
 case "mines":{const mines=Number(choice.slice(4)),safe=Math.random()<1-mines/9;return {label:safe?"БЕЗОПАСНО":"МИНА",caption:mines+" МИН · ПОЛЕ 3×3",mult:safe?({1:1.12,3:1.48,5:2.1}[mines]):0,detail:safe?"Ячейка открыта.":"Попалась мина.",safeIndex:ri(0,8),safe};}
 case "slots":{const symbols=["7","◆","●","★","BAR","♦"],a=symbols[ri(0,5)],b=symbols[ri(0,5)],c=symbols[ri(0,5)],triple=a===b&&b===c,pair=a===b||b===c||a===c,eligible=choice==="any"?(triple||pair):triple&&(choice==="seven"?a==="7":a==="BAR"),m=eligible?(triple?(a==="7"?8:a==="BAR"?5:4):1.4):0;return {label:a+"  "+b+"  "+c,caption:"ТРИ БАРАБАНА",mult:m,detail:eligible?(triple?"Джекпот! Три одинаковых символа.":"Два символа совпали."):"Выбранная комбинация не собрана.",symbols:[a,b,c]};}
 case "plinko":{const sets={low:[.4,.5,.7,.8,1,1,1.2],medium:[0,.2,.4,.5,.8,1.5,3],high:[0,0,.1,.2,.5,1.5,4]},arr=sets[choice],m=arr[ri(0,arr.length-1)];return {label:"×"+m,caption:"ШАР ДОСТИГ НИЖНЕГО СЕКТОРА",mult:m,detail:"Шар прошёл через пегборд и попал в сектор ×"+m};}
 case "wheel":{const sectors=[{c:"blue",m:1.5},{c:"red",m:2},{c:"blue",m:.5},{c:"gold",m:5},{c:"red",m:0},{c:"blue",m:1},{c:"red",m:3},{c:"gold",m:0}],index=ri(0,7),s=sectors[index],win=s.c===choice;return {label:"×"+s.m,caption:s.c.toUpperCase()+" СЕКТОР",mult:win?s.m:0,detail:"Колесо остановилось на секторе "+s.c+". "+(win?"Цвет совпал!":"Цвет не совпал."),color:s.c,index,landingAngle:360-((index+.5)*45)};}
 case "hilo":{const a=ri(2,14),b=ri(2,14),win=choice==="higher"?b>a:b<a;return {label:a+" → "+b,caption:"СЛЕДУЮЩАЯ КАРТА",mult:win?1.85:0,detail:"Первая карта "+a+", следующая "+b+". "+(win?"Ты угадал направление.":"Направление не угадано."),cardA:a,cardB:b};}
 case "blackjack":{let p=ri(10,20),d=ri(12,21);if(choice==="hit")p+=ri(2,10);const win=p<=21&&(d>21||p>d),push=p===d;return {label:p+" : "+d,caption:"ИГРОК / ДИЛЕР",mult:push?1:win?1.95:0,detail:push?"Ничья — возврат ставки.":win?"Ты победил дилера.":"Дилер выиграл.",cardA:p,cardB:d};}
 case "baccarat":{const p=ri(0,9),b=ri(0,9),winner=p===b?"tie":p>b?"player":"banker",win=choice===winner;return {label:p+" : "+b,caption:"ИГРОК / БАНК",mult:win?(winner==="tie"?8:winner==="banker"?1.9:2):0,detail:"Результат: "+(winner==="tie"?"ничья":winner==="player"?"игрок":"банк")+". "+(win?"Ставка сыграла.":"Не угадано."),cardA:p,cardB:b};}
 case "keno":{const picks=choice.split(",").map(Number),draw=Array.from({length:10},()=>ri(1,25)),hits=picks.filter(n=>draw.includes(n)).length,mult=hits===3?8:hits===2?1.8:0;return {label:hits+" / 3 ПОПАДАНИЙ",caption:"ТИРАЖ KENO",mult,detail:"Выпавшие числа: "+draw.slice(0,7).join(", ")+". Совпадений: "+hits+".",hits:draw};}
 case "crash":{const target=Number(choice),crash=+(0.95/Math.random()).toFixed(2),win=crash>=target;return {label:"×"+(win?target:crash),caption:win?"АВТОВЫВОД УСПЕШЕН":"ГРАФИК ОБРУШИЛСЯ",mult:win?target:0,detail:"Цель ×"+target+" · краш ×"+crash+". "+(win?"Ты успел забрать.":"Цель не достигнута.")};}
 case "limbo":{const target=Number(choice),m=+(0.96/Math.random()).toFixed(2),win=m>=target;return {label:"×"+m,caption:win?"ЦЕЛЬ ДОСТИГНУТА":"НИЖЕ ЦЕЛИ",mult:win?target:0,detail:"Выпало ×"+m+" при цели ×"+target+". "+(win?"Выигрыш!":"Попробуй ещё раз.")};}
 case "towers":{const floors=Number(choice);let done=0;for(let i=0;i<floors;i++){if(Math.random()<.62)done++;else break;}const win=done===floors,mults={1:1.45,2:2.2,3:3.5,4:5.8};return {label:done+" / "+floors,caption:"ПРОЙДЕНО ЭТАЖЕЙ",mult:win?mults[floors]:0,detail:win?"Ты прошёл все этажи башни!":"Ловушка на "+(done+1)+" этаже.",safeIndex:done-1,safe:win};}
 default:return {label:"—",caption:"РАУНД",mult:0,detail:"Нет результата."};
 }
}

const ROUND_FRAMES={
 dice:["◆","◈","●","◇","…"],coin:["ОРЁЛ","РЕШКА","ОРЁЛ","РЕШКА","…"],roulette:["●","◉","◌","◉","…"],mines:["□ □ □","■ □ □","■ ■ □","■ ■ ■","…"],slots:["7 ◆ ●","◆ 7 ◇","● ● 7","✦ 7 ✦","…"],plinko:["●","●","●","●","…"],wheel:["×0.5","×1.2","×2","×0.8","…"],hilo:["2 → ?","? → 9","? → 6","? → 12","…"],blackjack:["♠ 8","♠ 14","♠ 18","♠ 20","…"],baccarat:["ИГРОК 2","БАНК 5","ИГРОК 7","БАНК 6","…"],keno:["04 · 11 · 19","08 · 14 · 23","03 · 17 · 31","06 · 22 · 35","…"],crash:["×1.02","×1.18","×1.43","×1.86","…"],limbo:["×0.8","×1.4","×1.9","×2.3","…"],towers:["ЭТАЖ 01","ЭТАЖ 02","ЭТАЖ 03","ЭТАЖ 04","…"]
};

function animateRound(id,done,result){
 clearGameAnimation();const token=animationToken,stage=$("gameDisplay");
 stage.innerHTML='<div class="display-orbit"></div><div class="display-caption" id="displayCaption">ПОДГОТОВКА РАУНДА</div><div id="visualHost">'+visualMarkup(id,result,true)+'</div><div class="display-result" id="displayResult">…</div>';
 let i=0;const frames=12;$("displayCaption").textContent="РАУНД "+String(roundCounter).padStart(4,"0")+" · АНИМАЦИЯ";
 const tick=()=>{if(token!==animationToken)return;if(i<frames){const host=$("visualHost");if(host){host.innerHTML=visualMarkup(id,result,true);host.querySelectorAll(".die b").forEach(x=>x.textContent=randomInt(1,6));host.querySelectorAll(".slot-reel").forEach(x=>x.textContent=["7","◆","●","★","BAR"][randomInt(0,4)]);}const d=$("displayResult");if(d)d.textContent=["ПОДГОТОВКА","РАЗДАЧА","РАЗДАЧА","ВРАЩЕНИЕ","ВРАЩЕНИЕ","БРОСОК","РАУНД","РАУНД","РАУНД","ФИНИШ","ФИНИШ",""][i];i++;animationTimers.push(setTimeout(tick,170));}else{const host=$("visualHost");if(host)host.innerHTML=visualMarkup(id,result,false);$("displayCaption").textContent=result.caption;$("displayResult").textContent=result.label;done();}};
 tick();
}
async function publishRoundHash(game,result){
 try{const r=await fetch("/api/round-hash",{method:"POST",headers:apiHeaders(),body:JSON.stringify({game,result})});if(!r.ok)throw new Error("hash unavailable");const d=await r.json();$("roundHash").textContent=d.hash;$("roundNumber").textContent="РАУНД "+String(roundCounter).padStart(4,"0");}
 catch{$("roundHash").textContent="Хеш временно недоступен";}
}

function blackjackValue(cards){return cards.reduce((sum,c)=>sum+(c===1?11:c>=10?10:c),0);}
function blackjackCard(v){return v===1?"A":v===11?"J":v===12?"Q":v===13?"K":String(v);}
function renderBlackjack(reveal=false){
 const r=blackjackRound;if(!r)return;const total=blackjackValue(r.player),dealer=blackjackValue(r.dealer);
 const card=(v,hidden=false)=>'<div class="playing-card '+(hidden?"card-hidden":"")+'">'+(hidden?"?":blackjackCard(v))+'<small>'+(hidden?"◆":v===1||v>=11?"♠":"♥")+'</small></div>';
 $("gameDisplay").innerHTML='<div class="display-caption">БЛЭКДЖЕК · ТВОЙ ХОД</div><div class="blackjack-hands"><div class="blackjack-hand"><small>ТВОИ КАРТЫ · '+total+'</small><div class="card-table">'+r.player.map(v=>card(v)).join("")+'</div></div><div class="blackjack-hand"><small>ДИЛЕР · '+(reveal?dealer:"?")+'</small><div class="card-table">'+r.dealer.map((v,i)=>card(v,!reveal&&i===1)).join("")+'</div></div></div><div class="display-result">'+(total>21?"ПЕРЕБОР":total===21?"21":"ТВОЙ ХОД")+'</div>';
 $("blackjackActions").classList.toggle("hidden",r.finished);$("playButton").disabled=!r.finished;$("playButton").innerHTML=r.finished?'ИГРАТЬ СНОВА <span>→</span>':'РАУНД ИДЁТ…';
}
function finishBlackjack(reason){
 const r=blackjackRound;if(!r||r.finished)return;r.finished=true;
 let dealer=blackjackValue(r.dealer),player=blackjackValue(r.player);
 if(reason==="stand"){while(dealer<17&&r.dealer.length<8){r.dealer.push(randomInt(1,13));dealer=blackjackValue(r.dealer);}}
 const win=player<=21&&(dealer>21||player>dealer),push=player<=21&&player===dealer;
 const payout=push?r.bet:win?Math.floor(r.bet*1.95):0;state.balance+=payout;
 const delta=payout-r.bet;state.played++;if(win)state.wins++;
 const points=Math.max(0,delta)+Math.max(1,Math.floor(r.bet*.04));state.score+=points;
 const label=player+" : "+dealer;state.history.unshift({game:"Блэкджек",delta,at:Date.now(),result:label});state.history=state.history.slice(0,30);
 save();updateStats();renderBlackjack(true);
 $("resultNote").textContent=(push?"Ничья — ставка возвращена.":win?"Ты выиграл у дилера.":"Дилер выиграл.")+" "+(delta>0?"+"+fmt(delta)+" CR":delta<0?"−"+fmt(Math.abs(delta))+" CR":"");$("resultNote").className="result-note "+(delta>0?"win":delta<0?"lose":"");
 $("blackjackActions").classList.add("hidden");$("playButton").disabled=false;$("playButton").innerHTML='ИГРАТЬ СНОВА <span>→</span>';
 Promise.resolve(syncScore(points,win)).catch(console.warn);Promise.resolve(publishRoundHash("Блэкджек",label)).catch(console.warn);
}
function startBlackjack(bet){
 if(blackjackRound&&!blackjackRound.finished){notify("Сначала заверши текущую раздачу");return;}
 state.balance-=bet;save();updateStats();blackjackRound={bet,player:[randomInt(1,13),randomInt(1,13)],dealer:[randomInt(1,13),randomInt(1,13)],finished:false};
 $("resultNote").textContent="Нажми «Взять ещё», чтобы добрать карту, или «Стоп», чтобы завершить раздачу.";renderBlackjack();
}
$("blackjackHit").addEventListener("click",()=>{const r=blackjackRound;if(!r||r.finished)return;r.player.push(randomInt(1,13));renderBlackjack();const total=blackjackValue(r.player);if(total>21)finishBlackjack("bust");else if(total===21)finishBlackjack("stand");});
$("blackjackStand").addEventListener("click",()=>finishBlackjack("stand"));
function play(){
 if(!currentGame)return;
 const playedGame=currentGame;
 if(!gameChoice){notify("Сначала выбери исход");return;}
 const input=$("betInput");const bet=Math.floor(Number(input.value));
 if(!Number.isFinite(bet)||bet<10){notify("Минимальная ставка — 10 CR");return;}
 if(bet>state.balance){notify("Недостаточно виртуальных кредитов");return;}
 if(currentGame.id==="blackjack"){startBlackjack(bet);return;}
 const button=$("playButton");
 if(button.disabled)return;
 button.disabled=true;button.textContent="РАУНД ИДЁТ…";roundCounter++;
 $("roundHash").textContent="Формируется MD5-хеш…";
 $("roundNumber").textContent="РАУНД "+String(roundCounter).padStart(4,"0");
 $("resultNote").className="result-note";
 $("resultNote").textContent="Запускаем игровой раунд…";
 let res;
 try{res=choiceOutcome(currentGame.id,gameChoice);}
 catch(error){console.error("Coin round result error:",error);$("resultNote").textContent="Не удалось рассчитать исход: "+error.message;button.disabled=false;button.innerHTML='ИГРАТЬ <span>→</span>';return;}
 let settled=false;
 const settle=()=>{
  if(settled)return;settled=true;
  try{
   const payout=Math.floor(bet*res.mult),delta=payout-bet;
   state.balance+=delta;state.played++;if(delta>0)state.wins++;
   const points=Math.max(0,delta)+Math.max(1,Math.floor(bet*.04));state.score+=points;
   state.history.unshift({game:playedGame.name,delta,at:Date.now(),result:res.label});
   state.history=state.history.slice(0,30);save();updateStats();
   const note=$("resultNote");
   note.textContent=res.detail+" "+(delta>0?"+"+fmt(delta)+" CR":delta<0?"−"+fmt(Math.abs(delta))+" CR":"Ставка возвращена.");
   note.className="result-note "+(delta>0?"win":delta<0?"lose":"");
   button.disabled=false;button.innerHTML='ИГРАТЬ <span>→</span>';
   try{renderBoard("previewBoard",5);renderBoard("fullBoard",20);}catch(e){console.warn("Coin board render:",e);}
   Promise.resolve(syncScore(points,delta>0)).catch(e=>console.warn("Coin score sync:",e));
   Promise.resolve(publishRoundHash(playedGame.name,res.label)).catch(e=>console.warn("Coin hash:",e));
  }catch(error){
   console.error("Coin settle error:",error);
   $("resultNote").textContent="Раунд завершён, но обновление баланса вызвало ошибку: "+error.message;
   button.disabled=false;button.innerHTML='ИГРАТЬ <span>→</span>';
  }
 };
 try{
  animateRound(playedGame.id,settle,res);
  setTimeout(settle,3500);
 }catch(error){
  console.error("Coin animation error:",error);
  $("displayCaption").textContent="РЕЗУЛЬТАТ РАУНДА";
  $("displayResult").textContent=res.label;
  settle();
 }
}
document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>b.dataset.page==="leaderboard"?showLeaderboard():showCasino()));
document.querySelectorAll("[data-bottom]").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.bottom==="casino")showCasino();else if(b.dataset.bottom==="leaderboard")showLeaderboard();else if(b.dataset.bottom==="transfer")showTransfer();else if(b.dataset.bottom==="more")showMore();}));
$("bottomProfile").addEventListener("click",()=>{$("nicknameInput").value=state.nickname||"Игрок";setProfileAvatar($("profileAvatar"),state.telegramPhoto,state.nickname);$("profileModal").classList.remove("hidden");});
$("sendTransfer").addEventListener("click",async()=>{const username=$("transferUsername").value.trim().replace(/^@/,""),amount=Math.floor(Number($("transferAmount").value));if(!username||!amount||amount<1){notify("Укажи username и сумму перевода");return;}const b=$("sendTransfer");b.disabled=true;try{const r=await fetch("/api/transfer",{method:"POST",headers:apiHeaders(),body:JSON.stringify({username,amount})}),d=await r.json();if(!r.ok)throw new Error(d.error||"Перевод не выполнен");state.balance=d.balance;save();updateStats();await syncPlayer();$("transferAmount").value="";notify("Переведено "+fmt(amount)+" CR игроку "+d.recipient);}catch(e){notify(e.message);}finally{b.disabled=false;}});
$("openAdmin").addEventListener("click",()=>{if(!isCoinAdmin)return notify("Нет доступа");$("adminPanel").classList.remove("hidden");});
$("closeAdmin").addEventListener("click",()=>$("adminPanel").classList.add("hidden"));
async function redeemPromo(){const code=$("promoCodeInput").value.trim().toUpperCase();if(!code)return notify("Введи промокод");const status=$("promoStatus");status.textContent="Проверяем код…";$("redeemPromo").disabled=true;try{const r=await fetch("/api/promo/redeem",{method:"POST",headers:apiHeaders(),body:JSON.stringify({code,playerId})}),d=await r.json();if(!r.ok)throw new Error(d.error||"Не удалось активировать код");state.balance=Number(d.balance??(state.balance+d.reward));save();updateStats();status.textContent="Промокод активирован: +"+fmt(d.reward)+" CR";$("promoCodeInput").value="";notify("Начислено "+fmt(d.reward)+" CR");}catch(e){status.textContent=e.message;notify(e.message);}finally{$("redeemPromo").disabled=false;}}
$("redeemPromo").addEventListener("click",redeemPromo);$("promoCodeInput").addEventListener("keydown",e=>{if(e.key==="Enter")redeemPromo();});
$("createPromo").addEventListener("click",async()=>{if(!isCoinAdmin)return notify("Нет доступа");const code=$("adminPromoCode").value.trim().toUpperCase(),reward=Number($("adminPromoReward").value),maxUses=Number($("adminPromoLimit").value),status=$("adminPromoStatus");status.textContent="Создаём…";$("createPromo").disabled=true;try{const r=await fetch("/api/admin/promos",{method:"POST",headers:apiHeaders(),body:JSON.stringify({code,reward,maxUses})}),d=await r.json();if(!r.ok)throw new Error(d.error||"Не удалось создать код");status.textContent="Промокод "+d.promo.code+" создан · "+fmt(d.promo.reward)+" CR · лимит: "+(d.promo.maxUses||"без ограничений");$("adminPromoCode").value="";notify("Промокод создан");}catch(e){status.textContent=e.message;notify(e.message);}finally{$("createPromo").disabled=false;}});
async function sendBroadcast(mode){if(!isCoinAdmin)return notify("Нет доступа");const message=$("broadcastText").value.trim();if(!message)return notify("Введи текст рассылки");if(mode==="all"&&!confirm("Отправить сообщение всем игрокам Coin?"))return;const status=$("broadcastStatus");status.textContent="Отправка…";try{const r=await fetch("/api/admin/broadcast",{method:"POST",headers:apiHeaders(),body:JSON.stringify({message,mode})}),d=await r.json();if(!r.ok)throw new Error(d.error||"Ошибка рассылки");status.textContent="Отправлено: "+d.sent+" · Не доставлено: "+d.failed;notify("Рассылка завершена");}catch(e){status.textContent=e.message;notify(e.message);}}
$("sendSelf").addEventListener("click",()=>sendBroadcast("self"));$("sendAll").addEventListener("click",()=>sendBroadcast("all"));

document.querySelectorAll("[data-filter]").forEach(b=>b.addEventListener("click",()=>{activeFilter=b.dataset.filter;document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("active",x===b));renderGames();}));
document.querySelectorAll("[data-period]").forEach(b=>b.addEventListener("click",()=>{activePeriod=b.dataset.period;document.querySelectorAll("[data-period]").forEach(x=>x.classList.toggle("active",x===b));refreshBoard(activePeriod);}));
$("jumpGames").addEventListener("click",()=>{showCasino();$("gamesSection").scrollIntoView({behavior:"smooth"});});
$("backGames").addEventListener("click",showCasino);
$("playButton").addEventListener("click",play);
$("betMinus").addEventListener("click",()=>{$("betInput").value=Math.max(10,(Number($("betInput").value)||10)-10);});
$("betPlus").addEventListener("click",()=>{$("betInput").value=Math.min(state.balance,(Number($("betInput").value)||0)+10);});
document.querySelectorAll("[data-bet]").forEach(b=>b.addEventListener("click",()=>{$("betInput").value=b.dataset.bet==="max"?state.balance:Math.min(state.balance,Number(b.dataset.bet));}));
$("profileOpen").addEventListener("click",()=>{$("nicknameInput").value=state.nickname||"Игрок";setProfileAvatar($("profileAvatar"),state.telegramPhoto,state.nickname);$("profileModal").classList.remove("hidden");});
$("profileClose").addEventListener("click",()=>$("profileModal").classList.add("hidden"));
$("profileModal").addEventListener("click",e=>{if(e.target===$("profileModal"))$("profileModal").classList.add("hidden");});
$("saveProfile").addEventListener("click",()=>{if(telegramUser){notify("Имя профиля берётся из Telegram");$("profileModal").classList.add("hidden");return;}const name=$("nicknameInput").value.trim().slice(0,18);if(!name){notify("Введи игровое имя");return;}state.nickname=name;save();$("profileModal").classList.add("hidden");updateStats();syncPlayer();renderBoard("previewBoard",5);renderBoard("fullBoard",20);notify("Профиль сохранён");});
renderGames();updateStats();renderBoard("previewBoard",5);renderBoard("fullBoard",20);initTelegram().then(()=>syncPlayer());
