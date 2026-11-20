(()=>{
const tg=window.Telegram?.WebApp;try{tg?.ready();tg?.expand();}catch{}
const $=id=>document.getElementById(id),fmt=n=>Math.floor(Number(n)||0).toLocaleString("ru-RU");
const uidKey="donut_clicker_player_v1";let playerId=localStorage.getItem(uidKey);if(!playerId){playerId="p_"+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem(uidKey,playerId);}
let state=null,telegram=!!tg?.initData,refreshTimer=null;
const costs={power:120,capacity:180,regen:240};
function authHeaders(){return telegram?{"X-Telegram-Init-Data":tg.initData}:{};}
async function api(url,bodyData){const r=await fetch(url,{method:bodyData?"POST":"GET",headers:{"Content-Type":"application/json",...authHeaders()},body:bodyData?JSON.stringify({...bodyData,playerId,initData:tg?.initData||""}):undefined});const d=await r.json();if(!r.ok)throw Object.assign(new Error(d.error||"Ошибка"),{data:d,status:r.status});return d;}
function toast(s){const el=$("toast");el.textContent=s;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2200);}
function setState(p){state=p;render();}
function render(){
 if(!state)return;
 ["headerBalance","balanceValue"].forEach(id=>$(id).textContent=fmt(state.balance));
 $("levelValue").textContent=state.level;$("levelInline").textContent=state.level;$("tapPower").textContent=state.clickPower;
 const maxXp=state.level*35;$("xpLabel").textContent=fmt(state.xp)+" / "+fmt(maxXp)+" XP";$("xpBar").style.width=Math.min(100,state.xp/maxXp*100)+"%";
 $("energyValue").textContent=fmt(state.energy)+" / "+fmt(state.maxEnergy);$("energyBar").style.width=(state.energy/state.maxEnergy*100)+"%";
 $("tapButton").classList.toggle("energy-empty",state.energy<1);
 $("powerLevel").textContent=state.upgrades.power;$("capacityLevel").textContent=state.upgrades.capacity;$("regenLevel").textContent=state.upgrades.regen;
 for(const k of Object.keys(costs)){const cost=Math.floor(costs[k]*Math.pow(1.72,state.upgrades[k]));$(""+k+"Cost").textContent=fmt(cost);document.querySelector('[data-upgrade="'+k+'"]').disabled=state.balance<cost;}
 $("referralCode").textContent=state.referralCode||"—";
 $("energyTimer").textContent=state.energy>=state.maxEnergy?"Полная":"+1 каждые "+Math.round(state.regenMs/1000)+" сек.";
}
async function load(){try{const d=await api("/api/state",{initData:tg?.initData||""});setState(d.player);if(telegram&&!d.telegram)toast("Открой приложение из меню Telegram-бота");}catch(e){toast(e.message);}}
function feedback(gain){const f=$("tapFeedback");f.textContent="+"+fmt(gain)+" 🍩";f.classList.remove("pop");void f.offsetWidth;f.classList.add("pop");const btn=$("tapButton");btn.classList.add("pressed");clearTimeout(feedback.timer);feedback.timer=setTimeout(()=>btn.classList.remove("pressed"),115);}
let tapBusy=false;
$("tapButton").addEventListener("click",async()=>{
 if(tapBusy||!state)return;if(state.energy<1){toast("Энергия закончилась — подожди восстановления");return;}
 tapBusy=true;
 try{const d=await api("/api/tap",{});setState(d.player);feedback(d.gain);}
 catch(e){if(e.data?.player)setState(e.data.player);toast(e.message);}
 finally{tapBusy=false;}
});
document.querySelectorAll("[data-upgrade]").forEach(btn=>btn.addEventListener("click",async()=>{
 try{const d=await api("/api/upgrade",{kind:btn.dataset.upgrade});setState(d.player);toast("Улучшение куплено");}
 catch(e){if(e.data?.player)setState(e.data.player);toast(e.message);}
}));
function showPage(name){
 document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+name));
 document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
 if(name==="top")loadTop();if(name==="donuts")refreshProfile();
 window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
async function loadTop(){
 const box=$("leaderboard");box.innerHTML='<div class="loading">Загружаем рейтинг…</div>';
 try{const d=await api("/api/top");const my=d.players.find(x=>x.id===state?.id);$("myRank").textContent=my?"Твоё место: №"+my.rank:"Твоего места пока нет в первой сотне";
 box.innerHTML=d.players.length?d.players.map(p=>'<div class="leader-row"><div class="rank">'+p.rank+'</div><div class="leader-name"><b>'+escapeHtml(p.name)+'</b><small>Уровень '+p.level+'</small></div><div class="leader-meta"><div class="leader-balance"><i class="donut-mini"></i>'+fmt(p.balance)+'</div><small>пончиков</small></div></div>').join(""):'<div class="loading">Пока нет игроков. Стань первым!</div>';
 }catch(e){box.innerHTML='<div class="loading">Не удалось загрузить топ</div>';}
}
function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function refreshProfile(){try{const d=await api("/api/profile",{});setState(d.player);}catch{}}
$("copyCode").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(state.referralCode);toast("Код скопирован");}catch{toast("Не удалось скопировать");}});
$("inviteButton").addEventListener("click",()=>{
 const bot=window.BOT_USERNAME||"";
 const link=bot?"https://t.me/"+bot+"?startapp="+encodeURIComponent(state.referralCode):location.origin+"/?ref="+encodeURIComponent(state.referralCode);
 const share="https://t.me/share/url?url="+encodeURIComponent(link)+"&text="+encodeURIComponent("Заходи в мой Пончик-кликер! Достигни 3 уровня, и я получу пончик.");
 if(tg?.openTelegramLink)tg.openTelegramLink(share);else window.open(share,"_blank","noopener");
});
async function useReferral(){const code=new URLSearchParams(location.search).get("ref")||tg?.initDataUnsafe?.start_param;if(!code)return;try{const d=await api("/api/referral",{code});$("referralStatus").textContent=d.message;history.replaceState({}, "", location.pathname);}catch(e){$("referralStatus").textContent=e.message;}}
load().then(()=>useReferral());
setInterval(async()=>{if(!state)return;try{const d=await api("/api/profile",{});setState(d.player);}catch{}},10000);
})();