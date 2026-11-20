const GAMES = [
 {id:"dice",name:"Кости",icon:"dice",desc:"Брось кубик и поймай высокий результат.",type:"luck",category:"LUCK",hint:"Выпало 4–6 — выигрыш ×2"},
 {id:"coin",name:"Монетка",icon:"coin",desc:"Орёл или решка — решает один бросок.",type:"luck",category:"LUCK",hint:"Угадай сторону — ×1.9"},
 {id:"roulette",name:"Рулетка",icon:"roulette",desc:"Крути колесо и лови редкий сектор.",type:"luck",category:"LUCK",hint:"Красное ×2 · Золото ×8"},
 {id:"mines",name:"Мины",icon:"mines",desc:"Открой безопасную ячейку и забери множитель.",type:"skill",category:"SKILL",hint:"Безопасный ход — ×1.7"},
 {id:"slots",name:"Слоты",icon:"slots",desc:"Собери одинаковые символы на барабанах.",type:"luck",category:"LUCK",hint:"Комбинации до ×8"},
 {id:"plinko",name:"Плинко",icon:"plinko",desc:"Отпусти шар и смотри, куда он упадёт.",type:"luck",category:"LUCK",hint:"Множители от ×0.2 до ×5"},
 {id:"wheel",name:"Колесо",icon:"wheel",desc:"Испытай удачу на секторном колесе.",type:"luck",category:"LUCK",hint:"Случайный множитель до ×10"},
 {id:"hilo",name:"Выше-ниже",icon:"hilo",desc:"Угадай, будет следующая карта выше или ниже.",type:"skill",category:"SKILL",hint:"Верный прогноз — ×1.8"},
 {id:"blackjack",name:"Блэкджек",icon:"blackjack",desc:"Набери ближе к 21, чем дилер.",type:"skill",category:"SKILL",hint:"Победа — ×1.9"},
 {id:"baccarat",name:"Баккара",icon:"baccarat",desc:"Предскажи, чья сумма будет ближе к девяти.",type:"luck",category:"LUCK",hint:"Победа ×1.95 · ничья ×8"},
 {id:"keno",name:"Кено",icon:"keno",desc:"Выбери удачное число из случайного тиража.",type:"luck",category:"LUCK",hint:"Попадание — ×5"},
 {id:"crash",name:"Краш",icon:"crash",desc:"Забери выигрыш до того, как график рухнет.",type:"skill",category:"SKILL",hint:"Множитель до ×4"},
 {id:"limbo",name:"Лимбо",icon:"limbo",desc:"Поймай случайный множитель выше цели.",type:"skill",category:"SKILL",hint:"Цель ×2 · выплата ×2"},
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
   telegramUser=d.user||telegramUser;isCoinAdmin=!!d.admin;
   state.nickname=d.player.nickname||state.nickname;state.balance=Number(d.player.balance??state.balance);
   state.telegramUsername=d.player.username||"";state.telegramPhoto=d.player.photoUrl||"";
   save();updateStats();if(isCoinAdmin)document.getElementById("adminEntry")?.classList.remove("hidden");
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
  updateStats();renderBoard("previewBoard",5);renderBoard("fullBoard",20);
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
 currentGame=GAMES.find(g=>g.id===id);if(!currentGame)return;
 $("stageIcon").innerHTML=svgIcon(currentGame.id);$("stageTitle").textContent=currentGame.name;$("stageDesc").textContent=currentGame.desc;$("stageCategory").textContent=currentGame.category;
 $("displayResult").textContent="?";$("displayCaption").textContent="ГОТОВ К ИГРЕ";$("resultNote").textContent=currentGame.hint+" · Выбери ставку и нажми «Играть».";
 $("resultNote").className="result-note";$("gameStage").classList.remove("hidden");
 $("gamesSection").classList.add("hidden");$("leaderboardPreview").classList.add("hidden");
 $("gameStage").scrollIntoView({behavior:"smooth",block:"start"});
}
function showMore(){["gameStage","gamesSection","leaderboardPreview","leaderboardPage","transferPage"].forEach(id=>$(id).classList.add("hidden"));$("morePage").classList.remove("hidden");document.querySelectorAll("[data-bottom]").forEach(b=>b.classList.toggle("active",b.dataset.bottom==="more"));if(isCoinAdmin)$("adminEntry")?.classList.remove("hidden");$("morePage").scrollIntoView({behavior:"smooth",block:"start"});}
function setProfileAvatar(el,url,name){if(!el)return;if(url){el.innerHTML='<img src="'+escapeHtml(url)+'" alt="" referrerpolicy="no-referrer">';}else el.textContent=(name||"И").slice(0,1).toUpperCase();}
function showCasino(){
 $("gameStage").classList.add("hidden");$("gamesSection").classList.remove("hidden");$("leaderboardPreview").classList.remove("hidden");$("leaderboardPage").classList.add("hidden");$("transferPage").classList.add("hidden");$("morePage").classList.add("hidden");
 document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page==="casino"));
 document.querySelectorAll("[data-bottom]").forEach(b=>b.classList.toggle("active",b.dataset.bottom==="casino"));
}
function showLeaderboard(){
 $("gameStage").classList.add("hidden");$("gamesSection").classList.add("hidden");$("leaderboardPreview").classList.add("hidden");$("transferPage").classList.add("hidden");$("morePage").classList.add("hidden");$("leaderboardPage").classList.remove("hidden");
 document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page==="leaderboard"));
 document.querySelectorAll("[data-bottom]").forEach(b=>b.classList.toggle("active",b.dataset.bottom==="leaderboard"));
 renderBoard("fullBoard",20);refreshBoard(activePeriod);$("leaderboardPage").scrollIntoView({behavior:"smooth",block:"start"});
}
function showTransfer(){
 $("gameStage").classList.add("hidden");$("gamesSection").classList.add("hidden");$("leaderboardPreview").classList.add("hidden");$("leaderboardPage").classList.add("hidden");$("morePage").classList.add("hidden");$("transferPage").classList.remove("hidden");updateStats();$("transferPage").scrollIntoView({behavior:"smooth",block:"start"});
 document.querySelectorAll("[data-bottom]").forEach(b=>b.classList.toggle("active",b.dataset.bottom==="transfer"));
}
function randomInt(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
function outcome(id){
 switch(id){
  case "dice":{const n=randomInt(1,6);return {label:String(n),caption:"БРОСОК КУБИКА",mult:n>=4?2:0,detail:n>=4?"Высокий бросок — победа!":"Не хватило до четырёх."};}
  case "coin":{const side=Math.random()<.5?"ОРЁЛ":"РЕШКА";return {label:side,caption:side,mult:Math.random()<.5?1.9:0,detail:"Монетка выбрала: "+side};}
  case "roulette":{const n=randomInt(0,36);const mult=n===0?8:(n%2===0?0:2);return {label:String(n),caption:n===0?"ЗОЛОТОЙ СЕКТОР":n%2===0?"ЧЁРНОЕ":"КРАСНОЕ",mult,detail:n===0?"Редкий золотой сектор!":mult?"Красный сектор — выигрыш.":"Чёрный сектор в этот раз."};}
  case "mines":{const safe=Math.random()<.57;return {label:safe?"SAFE":"МИНА",caption:safe?"БЕЗОПАСНО":"МИНА",mult:safe?1.7:0,detail:safe?"Ты нашёл безопасную ячейку.":"Мина! Ставка сгорела."};}
  case "slots":{const symbols=["7","◆","●","✦","◇"];const a=symbols[randomInt(0,4)],b=symbols[randomInt(0,4)],c=symbols[randomInt(0,4)];const mult=a===b&&b===c?(a==="7"?8:a==="✦"?5:3):(a===b||b===c||a===c?1.5:0);return {label:a+" "+b+" "+c,caption:mult?"КОМБИНАЦИЯ":"НЕТ КОМБИНАЦИИ",mult,detail:mult>=3?"Три одинаковых символа!":mult?"Есть совпадение — небольшой выигрыш.":"Попробуй ещё раз."};}
  case "plinko":{const vals=[.2,.5,.5,1,1,1.5,2,5];const m=vals[randomInt(0,vals.length-1)];return {label:"×"+m,caption:"ШАР ОСТАНОВИЛСЯ",mult:m,detail:"Шар попал в сектор ×"+m};}
  case "wheel":{const vals=[0,.5,1,1.5,2,3,5,10];const m=vals[randomInt(0,vals.length-1)];return {label:"×"+m,caption:"СЕКТОР КОЛЕСА",mult:m,detail:m>=5?"Редкий сектор! Отличный результат.":"Колесо остановилось на ×"+m};}
  case "hilo":{const a=randomInt(2,14),b=randomInt(2,14),higher=Math.random()<.5;const win=higher?b>a:b<a;return {label:a+" → "+b,caption:higher?"ПРОГНОЗ: ВЫШЕ":"ПРОГНОЗ: НИЖЕ",mult:win?1.8:0,detail:win?"Верный прогноз!":"На этот раз прогноз не сбылся."};}
  case "blackjack":{const p=randomInt(15,22),d=randomInt(15,22);const win=p<=21&&(d>21||p>d);const push=p===d;return {label:p+" : "+d,caption:"ТЫ  /  ДИЛЕР",mult:push?1:win?1.9:0,detail:push?"Ничья — ставка возвращена.":win?"Ты обошёл дилера!": "Дилер победил."};}
  case "baccarat":{const p=randomInt(0,9),b=randomInt(0,9);const win=p>b;const tie=p===b;return {label:p+" : "+b,caption:"ИГРОК  /  БАНК",mult:tie?8:win?1.95:0,detail:tie?"Ничья — ×8!":win?"Победил игрок.":"Победил банк."};}
  case "keno":{const hit=Math.random()<.2;return {label:hit?"ПОПАДАНИЕ":"МИМО",caption:hit?"ЧИСЛО УГАДАНО":"МИМО",mult:hit?5:0,detail:hit?"Есть попадание — ×5!":"Тираж не совпал с твоим числом."};}
  case "crash":{const crash=+(1+Math.random()*3).toFixed(2);const cashout=+(1+Math.random()*2.5).toFixed(2);const win=cashout<crash;return {label:"×"+(win?cashout:crash),caption:win?"УСПЕЛ ЗАБРАТЬ":"КРАШ",mult:win?cashout:0,detail:win?"Ты забрал до падения графика!":"График рухнул раньше вывода."};}
  case "limbo":{const m=+(Math.random()*4.8+.2).toFixed(2);return {label:"×"+m,caption:"СЛУЧАЙНЫЙ МНОЖИТЕЛЬ",mult:m>=2?2:0,detail:m>=2?"Цель ×2 пройдена!":"Множитель ниже цели ×2."};}
  case "towers":{let steps=0;for(let i=0;i<4;i++){if(Math.random()<.68)steps++;else break;}const mult=steps===0?0:+Math.pow(1.35,steps).toFixed(2);return {label:steps+" / 4",caption:"ПРОЙДЕНО ЭТАЖЕЙ",mult,detail:steps===4?"Ты покорил башню!":steps?"Ты поднялся на "+steps+" этаж(а).":"Ловушка на первом этаже."};}
  default:return {label:"?",caption:"РЕЗУЛЬТАТ",mult:0,detail:"Попробуй ещё раз."};
 }
}
function play(){
 if(!currentGame)return;
 const input=$("betInput");let bet=Math.floor(Number(input.value));
 if(!Number.isFinite(bet)||bet<10){notify("Минимальная ставка — 10 CR");return;}
 if(bet>state.balance){notify("Недостаточно виртуальных кредитов");return;}
 const button=$("playButton");button.disabled=true;button.textContent="ИГРА ИДЁТ…";
 const display=$("displayResult");display.classList.remove("rolling");void display.offsetWidth;display.classList.add("rolling");
 $("displayCaption").textContent="ПРОВЕРЯЕМ УДАЧУ…";$("resultNote").className="result-note";$("resultNote").textContent="Результат формируется…";
 setTimeout(()=>{
  const res=outcome(currentGame.id);const payout=Math.floor(bet*res.mult);const delta=payout-bet;
  state.balance+=delta;state.played++;if(delta>0)state.wins++;const points=Math.max(0,delta)+Math.max(1,Math.floor(bet*.04));state.score+=points;state.history.unshift({game:currentGame.name,delta,at:Date.now()});state.history=state.history.slice(0,20);save();updateStats();syncScore(points,delta>0);renderBoard("previewBoard",5);renderBoard("fullBoard",20);
  display.textContent=res.label;$("displayCaption").textContent=res.caption;
  const note=$("resultNote");note.textContent=res.detail+" "+(delta>0?"+"+fmt(delta)+" CR":delta<0?"−"+fmt(Math.abs(delta))+" CR":"Ставка возвращена.");note.className="result-note "+(delta>0?"win":delta<0?"lose":"");
  button.disabled=false;button.innerHTML='ИГРАТЬ <span>→</span>';
 },750);
}
document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>b.dataset.page==="leaderboard"?showLeaderboard():showCasino()));
document.querySelectorAll("[data-bottom]").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.bottom==="casino")showCasino();else if(b.dataset.bottom==="leaderboard")showLeaderboard();else if(b.dataset.bottom==="transfer")showTransfer();else if(b.dataset.bottom==="more")showMore();}));
$("bottomProfile").addEventListener("click",()=>{$("nicknameInput").value=state.nickname||"Игрок";setProfileAvatar($("profileAvatar"),state.telegramPhoto,state.nickname);$("profileModal").classList.remove("hidden");});
$("sendTransfer").addEventListener("click",async()=>{const username=$("transferUsername").value.trim().replace(/^@/,""),amount=Math.floor(Number($("transferAmount").value));if(!username||!amount||amount<1){notify("Укажи username и сумму перевода");return;}const b=$("sendTransfer");b.disabled=true;try{const r=await fetch("/api/transfer",{method:"POST",headers:apiHeaders(),body:JSON.stringify({username,amount})}),d=await r.json();if(!r.ok)throw new Error(d.error||"Перевод не выполнен");state.balance=d.balance;save();updateStats();await syncPlayer();$("transferAmount").value="";notify("Переведено "+fmt(amount)+" CR игроку "+d.recipient);}catch(e){notify(e.message);}finally{b.disabled=false;}});
$("openAdmin").addEventListener("click",()=>{if(!isCoinAdmin)return notify("Нет доступа");$("adminPanel").classList.remove("hidden");});
$("closeAdmin").addEventListener("click",()=>$("adminPanel").classList.add("hidden"));
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
