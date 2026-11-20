const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const root = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const dbFile = path.join(dataDir, "players.json");
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || "";
const PORT = process.env.PORT || 8080;
const MIME = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml"};
const MAX_ENERGY = 100;
const ENERGY_REGEN_MS = 30000;
const DONUT_REWARD = 250;
const START_BALANCE = 0;
const START_ENERGY = 100;
const now = () => Date.now();
function dbRead(){ try{return JSON.parse(fs.readFileSync(dbFile,"utf8"));}catch{return {players:{}, referrals:{}};} }
function dbWrite(db){ fs.mkdirSync(dataDir,{recursive:true}); const tmp=dbFile+".tmp"; fs.writeFileSync(tmp,JSON.stringify(db,null,2)); fs.renameSync(tmp,dbFile); }
function send(res,status,data){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, X-Telegram-Init-Data","Access-Control-Allow-Methods":"GET,POST,OPTIONS"});res.end(JSON.stringify(data));}
function body(req){return new Promise((resolve,reject)=>{let s="";req.on("data",c=>{s+=c;if(s.length>20000)reject(Error("Too large"));});req.on("end",()=>{try{resolve(JSON.parse(s||"{}"));}catch{reject(Error("Bad JSON"));}});req.on("error",reject);});}
function clean(s,n=32){return String(s||"").replace(/[<>\u0000-\u001f]/g,"").trim().slice(0,n);}
function telegramUser(initData){
 if(!BOT_TOKEN||!initData)return null;
 try{
  const p=new URLSearchParams(initData),hash=p.get("hash");if(!hash)return null;p.delete("hash");
  const check=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+"="+v).join("\n");
  const secret=crypto.createHmac("sha256","WebAppData").update(BOT_TOKEN).digest();
  const expected=crypto.createHmac("sha256",secret).update(check).digest("hex");
  const a=Buffer.from(hash,"hex"),b=Buffer.from(expected,"hex");if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
  const authDate=Number(p.get("auth_date")||0);if(!authDate||now()/1000-authDate>86400)return null;
  const u=JSON.parse(p.get("user")||"{}");if(!u.id)return null;
  return {id:"tg_"+u.id,telegramId:String(u.id),name:clean([u.first_name,u.last_name].filter(Boolean).join(" "),32)||"Игрок",username:clean(u.username,32),photoUrl:/^https:\/\//.test(u.photo_url||"")?u.photo_url:""};
 }catch{return null;}
}
function regen(p){const t=now(),last=Number(p.energyAt||t),ticks=Math.floor((t-last)/ENERGY_REGEN_MS);if(ticks>0){p.energy=Math.min(MAX_ENERGY,Number(p.energy||0)+ticks);p.energyAt=last+ticks*ENERGY_REGEN_MS;}return p;}
function publicPlayer(p){return {id:p.id,name:p.name,username:p.username,photoUrl:p.photoUrl||"",balance:p.balance,level:p.level,xp:p.xp,energy:p.energy,maxEnergy:MAX_ENERGY,energyAt:p.energyAt,clickPower:p.clickPower,upgrades:p.upgrades,referralCode:p.referralCode,referrals:p.referrals||0,donuts:p.donuts||0};}
function makePlayer(id,meta={}){return {id,name:meta.name||"Игрок",username:meta.username||"",photoUrl:meta.photoUrl||"",balance:START_BALANCE,level:1,xp:0,energy:START_ENERGY,energyAt:now(),clickPower:1,upgrades:{power:0,capacity:0,regen:0},referralCode:crypto.randomBytes(4).toString("hex").toUpperCase(),referrals:0,donuts:0,createdAt:now()};}
function playerFor(db,user,guestId){const id=user?.id||("guest_"+String(guestId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,48));if(!id||id==="guest_")return null;let p=db.players[id];if(!p){p=makePlayer(id,user||{});db.players[id]=p;}if(user){p.name=user.name||p.name;p.username=user.username||p.username;p.photoUrl=user.photoUrl||p.photoUrl;}regen(p);return p;}
function upgradeCost(kind,level){const base={power:120,capacity:180,regen:240}[kind];return Math.floor(base*Math.pow(1.72,level));}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,"http://localhost"),pathname=url.pathname;
 if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, X-Telegram-Init-Data","Access-Control-Allow-Methods":"GET,POST,OPTIONS"});return res.end();}
 try{
  if(pathname==="/api/state"&&req.method==="POST"){
   const b=await body(req),user=telegramUser(b.initData),db=dbRead(),p=playerFor(db,user,b.playerId);if(!p)return send(res,400,{error:"playerId required"});dbWrite(db);return send(res,200,{player:publicPlayer(p),telegram:!!user,botConfigured:!!BOT_TOKEN});
  }
  if(pathname==="/api/tap"&&req.method==="POST"){
   const b=await body(req),user=telegramUser(req.headers["x-telegram-init-data"]||b.initData),db=dbRead(),p=playerFor(db,user,b.playerId);if(!p)return send(res,400,{error:"playerId required"});
   if(p.energy<1){dbWrite(db);return send(res,409,{error:"Нет энергии",player:publicPlayer(p)});}
   const gain=Math.max(1,Number(p.clickPower)||1);p.energy-=1;p.balance+=gain;p.xp+=1;
   const need=p.level*35;if(p.xp>=need){p.xp-=need;p.level+=1;}
   dbWrite(db);return send(res,200,{gain,player:publicPlayer(p)});
  }
  if(pathname==="/api/upgrade"&&req.method==="POST"){
   const b=await body(req),user=telegramUser(req.headers["x-telegram-init-data"]||b.initData),db=dbRead(),p=playerFor(db,user,b.playerId);if(!p)return send(res,400,{error:"playerId required"});
   const kind=String(b.kind||""),level=Number(p.upgrades[kind]);if(!["power","capacity","regen"].includes(kind))return send(res,400,{error:"Unknown upgrade"});
   const cost=upgradeCost(kind,level);if(p.balance<cost)return send(res,409,{error:"Не хватает пончиков",player:publicPlayer(p),cost});
   p.balance-=cost;p.upgrades[kind]++;
   if(kind==="power")p.clickPower+=1;
   if(kind==="capacity"){p.energy+=20;p.energyAt=now();}
   if(kind==="regen")p.energyAt=now()-Math.max(0,ENERGY_REGEN_MS-5000);
   dbWrite(db);return send(res,200,{cost,player:publicPlayer(p)});
  }
  if(pathname==="/api/top"&&req.method==="GET"){
   const db=dbRead(),all=Object.values(db.players).map(p=>{regen(p);return p;}).sort((a,b)=>b.balance-a.balance).slice(0,100);
   dbWrite(db);return send(res,200,{players:all.map((p,i)=>({...publicPlayer(p),rank:i+1})),total:Object.keys(db.players).length});
  }
  if(pathname==="/api/referral"&&req.method==="POST"){
   const b=await body(req),user=telegramUser(req.headers["x-telegram-init-data"]||b.initData),db=dbRead(),p=playerFor(db,user,b.playerId);if(!p)return send(res,400,{error:"playerId required"});
   const code=String(b.code||"").toUpperCase();if(!code)return send(res,400,{error:"Referral code missing"});
   if(db.referrals[p.id])return send(res,409,{error:"Приглашение уже использовано"});
   const inviter=Object.values(db.players).find(x=>x.referralCode===code);if(!inviter||inviter.id===p.id)return send(res,404,{error:"Код не найден"});
   // Reward only after the invited account has reached level 3, preventing instant farming.
   db.referrals[p.id]={inviter:inviter.id,createdAt:now(),paid:false};dbWrite(db);
   return send(res,200,{ok:true,message:"Приглашение связано. Награда начислится после 3 уровня.",player:publicPlayer(p)});
  }
  if(pathname==="/api/profile"&&req.method==="POST"){
   const b=await body(req),user=telegramUser(req.headers["x-telegram-init-data"]||b.initData),db=dbRead(),p=playerFor(db,user,b.playerId);if(!p)return send(res,400,{error:"playerId required"});
   // Process pending referral once the new player reaches level 3.
   if(p.level>=3&&db.referrals[p.id]&&!db.referrals[p.id].paid){const inviter=db.players[db.referrals[p.id].inviter];if(inviter){inviter.donuts=(inviter.donuts||0)+1;inviter.referrals=(inviter.referrals||0)+1;db.referrals[p.id].paid=true;}}
   dbWrite(db);return send(res,200,{player:publicPlayer(p)});
  }
  if(pathname.startsWith("/api/"))return send(res,404,{error:"Not found"});
  const file=path.resolve(root,pathname==="/"?"index.html":"."+pathname);if(!file.startsWith(root+path.sep)&&file!==root)return send(res,403,{error:"Forbidden"});
  fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);return res.end("Not found");}res.writeHead(200,{"Content-Type":MIME[path.extname(file)]||"application/octet-stream","Cache-Control":"no-cache"});res.end(data);});
 }catch(e){send(res,400,{error:e.message||"Bad request"});}
});
server.listen(PORT,"0.0.0.0",()=>console.log("Donut Clicker listening on "+PORT));
