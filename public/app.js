(()=>{
const tg=window.Telegram?.WebApp;try{tg?.ready();tg?.expand();}catch{}
const $=id=>document.getElementById(id),fmt=n=>Math.floor(Number(n)||0).toLocaleString("ru-RU");
const uidKey="donut_clicker_player_v1";let playerId=localStorage.getItem(uidKey);if(!playerId){playerId="p_"+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem(uidKey,playerId);}
let state=null,isAdmin=false,botUsername="",chosenOutcome="player",gameActive=false,actionMode="";
const costs={power:120,capacity:180,regen:240,critical:420,bonus:650,discount:900,fortune:1300};
function authHeaders(){return tg?.initData?{"X-Telegram-Init-Data":tg.initData}:{};}
async function api(url,data){const r=await fetch(url,{method:data?"POST":"GET",headers:{"Content-Type":"application/json",...authHeaders()},body:data?JSON.stringify({...data,playerId,initData:tg?.initData||""}):undefined});const d=await r.json();if(!r.ok)throw Object.assign(new Error(d.error||"Ошибка"),{data:d,status:r.status});return d;}
function toast(s){const el=$("toast");el.textContent=s;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2500);}
function setState(p){state=p;render();}
function render(){if(!state)return;
["headerBalance","balanceValue"].forEach(id=>$(id).textContent=fmt(state.balance));
$("levelValue").textContent=state.level;$("levelInline").textContent=state.level;$("tapPower").textContent=state.clickPower;
$("xpLabel").textContent=fmt(state.xp)+" / 50 кликов";$("xpBar").style.width=Math.min(100,state.xp/50*100)+"%";
$("energyValue").textContent=fmt(state.energy)+" / "+fmt(state.maxEnergy);$("energyBar").style.width=(state.energy/state.maxEnergy*100)+"%";$("tapButton").classList.toggle("energy-empty",state.energy<1);
for(const k of Object.keys(costs)){const level=state.upgrades[k]||0;$(k+"Level").textContent=level;let cost=Math.floor(costs[k]*Math.pow(1.72,level));if(k!=="discount")cost=Math.floor(cost*(1-Math.min(.4,(state.upgrades.discount||0)*.05)));$(k+"Cost").textContent=fmt(cost);document.querySelector('[data-upgrade="'+k+'"]').disabled=state.balance<cost;}
$("referralCode").textContent=state.referralCode||"—";$("energyTimer").textContent=state.energy>=state.maxEnergy?"Полная":"+1 каждые 4 сек.";
}
async function load(){try{const d=await api("/api/state",{initData:tg?.initData||""});setState(d.player);isAdmin=!!d.admin;botUsername=d.botUsername||"";if(isAdmin)$("adminEntry").classList.remove("hidden");if(tg?.initData&&!d.telegram)toast("Не удалось подтвердить Telegram-профиль");}catch(e){toast(e.message);}}
function showPage(name){document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+name));document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.page===name));if(name==="top")loadTop();if(name==="donuts")refreshProfile();window.scrollTo({top:0,behavior:"smooth"});}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function loadTop(){const box=$("leaderboard");box.innerHTML='<div class="loading">Загружаем рейтинг…</div>';try{const d=await api("/api/top"),me=d.players.find(x=>x.id===state?.id);$("myRank").textContent=me?"Твоё место: №"+me.rank:"Твоего места пока нет в первой сотне";box.innerHTML=d.players.length?d.players.map(p=>'<button type="button" class="leader-row leader-click" data-player-id="'+escapeHtml(p.id)+'"><div class="rank">'+p.rank+'</div><div class="avatar">'+(p.photoUrl?'<img src="'+escapeHtml(p.photoUrl)+'" referrerpolicy="no-referrer">':'<span>'+escapeHtml((p.name||"И").slice(0,1).toUpperCase())+'</span>')+'</div><div class="leader-name"><b>'+escapeHtml(p.name)+'</b><small>Уровень '+p.level+'</small></div><div class="leader-meta"><div class="leader-balance"><i class="donut-mini"></i>'+fmt(p.balance)+'</div><small>пончиков</small></div><span class="leader-chevron">›</span></button>').join(""):'<div class="loading">Пока нет игроков. Стань первым!</div>';}catch{box.innerHTML='<div class="loading">Не удалось загрузить топ</div>';}}

async function openPlayerCard(id){
 try{
  const d=await api("/api/player/"+encodeURIComponent(id)),p=d.player;
  $("playerModalName").textContent=p.name||"Игрок";
  $("playerModalAvatar").innerHTML=p.photoUrl?'<img src="'+escapeHtml(p.photoUrl)+'" referrerpolicy="no-referrer">':escapeHtml((p.name||"И").slice(0,1).toUpperCase());
  $("playerModalUsername").textContent=p.username?"@"+p.username:"Без username";
  $("playerModalBalance").textContent=fmt(p.balance);
  $("playerModalFriends").textContent=fmt(p.friendsInvited);
  $("playerModalClicks").textContent=fmt(p.clicks);
  $("playerModalJoined").textContent=p.firstVisitAt?new Date(p.firstVisitAt).toLocaleString("ru-RU",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}):"Нет данных";
  $("playerModalOnline").textContent=p.onlineInApp?"Онлайн в приложении":"Не в сети в приложении";
  $("playerModalOnline").classList.toggle("online",p.onlineInApp);
  $("playerModalTelegram").textContent="Статус «в сети» самого Telegram недоступен ботам";
  $("playerModal").classList.add("open");
 }catch(e){toast(e.message||"Не удалось открыть профиль");}
}
$("leaderboard").addEventListener("click",e=>{const row=e.target.closest("[data-player-id]");if(row)openPlayerCard(row.dataset.playerId);});
$("playerModalClose").addEventListener("click",()=>$("playerModal").classList.remove("open"));
async function refreshProfile(){try{const d=await api("/api/profile",{});setState(d.player);}catch{}}
function feedback(gain){const f=$("tapFeedback");f.textContent="+"+fmt(gain)+" 🍩";f.classList.remove("pop");void f.offsetWidth;f.classList.add("pop");const btn=$("tapButton");btn.classList.add("pressed");clearTimeout(feedback.timer);feedback.timer=setTimeout(()=>btn.classList.remove("pressed"),130);}
let tapBusy=false;
$("tapButton").addEventListener("click",async()=>{if(tapBusy||!state)return;if(state.energy<1){toast("Энергия закончилась — подожди восстановления");return;}tapBusy=true;try{const d=await api("/api/tap",{});setState(d.player);feedback(d.gain);}catch(e){if(e.data?.player)setState(e.data.player);toast(e.message);}finally{tapBusy=false;}});
document.querySelectorAll("[data-upgrade]").forEach(btn=>btn.addEventListener("click",async()=>{try{const d=await api("/api/upgrade",{kind:btn.dataset.upgrade});setState(d.player);toast("Улучшение куплено");}catch(e){if(e.data?.player)setState(e.data.player);toast(e.message);}}));
$("copyCode").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(state.referralCode);toast("Код скопирован");}catch{toast("Не удалось скопировать");}});
$("inviteButton").addEventListener("click",()=>{const link=botUsername?"https://t.me/"+botUsername+"?startapp="+encodeURIComponent(state.referralCode):location.origin+"/?ref="+encodeURIComponent(state.referralCode);const share="https://t.me/share/url?url="+encodeURIComponent(link)+"&text="+encodeURIComponent("Заходи в мой Пончик-кликер! Достигни 3 уровня, и я получу 122 пончика.");if(tg?.openTelegramLink)tg.openTelegramLink(share);else window.open(share,"_blank","noopener");});
async function useReferral(){const code=new URLSearchParams(location.search).get("ref")||tg?.initDataUnsafe?.start_param;if(!code)return;try{const d=await api("/api/referral",{code});$("referralStatus").textContent=d.message;history.replaceState({}, "",location.pathname);}catch(e){$("referralStatus").textContent=e.message;}}
function openAction(mode){actionMode=mode;const titles={ref:"Активировать реф-код",promo:"Активировать промо-код",transfer:"Перевести другу",withdraw:"Когда можно будет вывести?"};$("actionTitle").textContent=titles[mode];$("actionEyebrow").textContent="ПОНЧИК";const f=$("actionFields");f.innerHTML="";
if(mode==="ref"||mode==="promo"){f.innerHTML='<label>Код</label><input id="actionCode" maxlength="32" placeholder="Введи код" autocomplete="off">';}
else if(mode==="transfer"){f.innerHTML='<label>Telegram username получателя</label><input id="actionTo" placeholder="@username"><label>Количество пончиков</label><input id="actionAmount" type="number" min="1" placeholder="Сумма">';}
else{f.innerHTML='<p class="modal-copy">Вывод пончиков пока не подключён. Дата запуска и условия появятся в новостном канале.</p><a class="primary wide modal-link" href="https://t.me/+cB3iJtgVuoBjZjBi" target="_blank" rel="noopener">Открыть канал новостей</a>';}
$("actionSubmit").classList.toggle("hidden",mode==="withdraw");$("actionModal").classList.add("open");}
document.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",()=>openAction(b.dataset.action)));
$("actionClose").addEventListener("click",()=>$("actionModal").classList.remove("open"));
$("actionSubmit").addEventListener("click",async()=>{if(actionMode.startsWith("admin:"))return;try{let d;if(actionMode==="ref")d=await api("/api/referral",{code:$("actionCode").value.trim()});if(actionMode==="promo")d=await api("/api/promo",{code:$("actionCode").value.trim()});if(actionMode==="transfer")d=await api("/api/transfer",{to:$("actionTo").value.trim(),amount:$("actionAmount").value});if(d?.player)setState(d.player);toast(d?.message||"Готово");$("actionModal").classList.remove("open");}catch(e){toast(e.message);}});
$("openGame").addEventListener("click",()=>showPage("game"));
document.querySelectorAll("[data-outcome]").forEach(b=>b.addEventListener("click",()=>{chosenOutcome=b.dataset.outcome;document.querySelectorAll("[data-outcome]").forEach(x=>x.classList.toggle("selected",x===b));}));
function cardHTML(c,hidden=false){if(hidden)return '<div class="card-back"></div>';const red=c.s==="♥"||c.s==="♦";return '<div class="playing-card '+(red?'red':'')+'"><b>'+c.r+'</b><span>'+c.s+'</span></div>';}
function renderGame(g){$("playerCards").innerHTML=(g?.player||[]).map(c=>cardHTML(c)).join("");$("dealerCards").innerHTML=(g?.dealer||[]).map((c,i)=>cardHTML(c,!g.done&&i===1)).join("");$("playerScore").textContent=g?g.playerScore??g.player.reduce((a,c)=>a+c.v,0):"—";$("dealerScore").textContent=g?(g.done?g.dealerScore:"?"):"—";$("gameResult").textContent=!g?"Выбери ставку и исход раунда":g.done?(g.result==="player"?"Победа игрока":g.result==="dealer"?"Победа дилера":"Ничья")+(g.payout?" · Выплата "+g.payout+" 🍩":" · Ставка проиграна"):"Твой ход — добери карту или остановись";gameActive=!!g&&!g.done;$("hitGame").disabled=!gameActive;$("standGame").disabled=!gameActive;$("dealGame").disabled=gameActive;$("dealGame").textContent=gameActive?"Раунд идёт":"Раздать карты";}
async function gameAction(path,data={}){try{const d=await api(path,data);setState(d.player);renderGame(d.game);if(d.game?.done)toast(d.game.payout?"Ты выиграл!":"Раунд завершён");}catch(e){toast(e.message);}}
$("dealGame").addEventListener("click",()=>gameAction("/api/game/start",{bet:$("gameBet").value,choice:chosenOutcome}));$("hitGame").addEventListener("click",()=>gameAction("/api/game/hit",{}));$("standGame").addEventListener("click",()=>gameAction("/api/game/stand",{}));
$("openAdmin").addEventListener("click",()=>showPage("admin"));
document.querySelectorAll("[data-admin]").forEach(b=>b.addEventListener("click",()=>adminAction(b.dataset.admin)));
function adminAction(mode){if(!isAdmin){toast("Нет доступа");return;}const config={broadcast:["Рассылка",'<label>Кому отправить</label><select id="admAudience"><option value="self">Только мне в Telegram</option><option value="users">Всем зарегистрированным пользователям бота</option></select><label>Текст сообщения</label><textarea id="admMessage" rows="4" placeholder="Введи текст рассылки"></textarea>'],promo:["Создать промокод",'<label>Название промокода</label><input id="admCode" placeholder="DONUT2026"><label>Награда в пончиках</label><input id="admAmount" type="number" value="100"><label>Лимит активаций (0 — без лимита)</label><input id="admLimit" type="number" value="0">'],give:["Выдать баланс",'<label>Игрок (@username)</label><input id="admTo" placeholder="@username"><label>Количество</label><input id="admAmount" type="number" min="1">'],take:["Снять баланс",'<label>Игрок (@username)</label><input id="admTo" placeholder="@username"><label>Количество</label><input id="admAmount" type="number" min="1">'],ban:["Заблокировать игрока",'<label>Игрок (@username)</label><input id="admTo" placeholder="@username">']};actionMode="admin:"+mode;$("actionTitle").textContent=config[mode][0];$("actionEyebrow").textContent="АДМИН ПАНЕЛЬ";$("actionFields").innerHTML=config[mode][1];$("actionSubmit").classList.remove("hidden");$("actionModal").classList.add("open");}
$("actionSubmit").addEventListener("click",async()=>{if(!actionMode.startsWith("admin:"))return;const mode=actionMode.slice(6);let url,data;if(mode==="broadcast"){url="/api/admin/broadcast";data={message:$("admMessage").value,audience:$("admAudience").value};}if(mode==="promo"){url="/api/admin/promo";data={code:$("admCode").value,amount:$("admAmount").value,limit:$("admLimit").value};}if(mode==="give"||mode==="take"){url="/api/admin/balance";data={to:$("admTo").value,amount:$("admAmount").value,action:mode==="take"?"remove":"add"};}if(mode==="ban"){url="/api/admin/ban";data={to:$("admTo").value,banned:true};}try{const d=await api(url,data);toast(d.message||"Готово");$("actionModal").classList.remove("open");if(mode==="give"||mode==="take")refreshProfile();}catch(e){toast(e.message);}});
$("channelDone").addEventListener("click",()=>$("channelModal").classList.remove("open"));
load().then(()=>{useReferral();$("channelModal").classList.add("open");});
setInterval(()=>{if(state&&state.energy<state.maxEnergy){state.energy=Math.min(state.maxEnergy,state.energy+1);render();}},4000);
setInterval(async()=>{if(!state)return;try{const d=await api("/api/profile",{});setState(d.player);}catch{}},5000);
})();