const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const playersFile = path.join(dataDir, "players.json");
const types = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml" };
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ADMIN_USERNAME = "vladubrat7";

function readPlayers(){try{return JSON.parse(fs.readFileSync(playersFile,"utf8"));}catch{return {};}}
function writePlayers(players){fs.mkdirSync(dataDir,{recursive:true});fs.writeFileSync(playersFile,JSON.stringify(players,null,2));}
function send(res,status,data){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Access-Control-Allow-Origin":"same-origin"});res.end(JSON.stringify(data));}
function readBody(req){return new Promise((resolve,reject)=>{let raw="";req.on("data",chunk=>{raw+=chunk;if(raw.length>20000)reject(new Error("Payload too large"));});req.on("end",()=>{try{resolve(JSON.parse(raw||"{}"));}catch{reject(new Error("Invalid JSON"));}});req.on("error",reject);});}
function cleanName(v){return String(v||"Игрок").replace(/[<>\u0000-\u001f]/g,"").trim().slice(0,32)||"Игрок";}
function cleanUsername(v){return String(v||"").replace(/^@/,"").replace(/[^a-zA-Z0-9_]/g,"").slice(0,32).toLowerCase();}
function validateTelegram(initData){
 if(!BOT_TOKEN||!initData)return null;
 try{
  const params=new URLSearchParams(initData),hash=params.get("hash");if(!hash)return null;
  params.delete("hash");const dataCheck=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+"="+v).join("\n");
  const secret=crypto.createHmac("sha256","WebAppData").update(BOT_TOKEN).digest();
  const expected=crypto.createHmac("sha256",secret).update(dataCheck).digest("hex");
  const a=Buffer.from(hash,"hex"),b=Buffer.from(expected,"hex");if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
  const authDate=Number(params.get("auth_date")||0);if(!authDate||Date.now()/1000-authDate>86400)return null;
  const user=JSON.parse(params.get("user")||"{}");if(!user.id)return null;
  return {id:String(user.id),username:cleanUsername(user.username),firstName:cleanName(user.first_name),lastName:cleanName(user.last_name||""),photoUrl:/^https:\/\//.test(user.photo_url||"")?user.photo_url:""};
 }catch{return null;}
}
function auth(req){return validateTelegram(req.headers["x-telegram-init-data"]||"");}
function playerFor(players,user){
 const id="tg_"+user.id;
 if(!players[id])players[id]={id,nickname:user.firstName,username:user.username,telegramId:user.id,photoUrl:user.photoUrl,balance:10000,score:0,dailyScore:0,weeklyScore:0,dailyKey:"",weeklyKey:"",games:0,wins:0,createdAt:Date.now()};
 const p=players[id];p.nickname=user.firstName||p.nickname;p.username=user.username||p.username;p.photoUrl=user.photoUrl||p.photoUrl;p.telegramId=user.id;
 return p;
}
async function telegramSend(chatId,textValue){
 const response=await fetch("https://api.telegram.org/bot"+BOT_TOKEN+"/sendMessage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:chatId,text:textValue,disable_web_page_preview:true})});
 const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.description||"Telegram send failed");return data;
}
const server=http.createServer(async(req,res)=>{
 const pathname=decodeURIComponent((req.url||"/").split("?")[0]);
 if(pathname.startsWith("/api/")&&req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"same-origin","Access-Control-Allow-Headers":"Content-Type, X-Telegram-Init-Data","Access-Control-Allow-Methods":"GET,POST,OPTIONS"});return res.end();}
 if(pathname==="/api/auth"&&req.method==="POST"){
  try{if(!BOT_TOKEN)return send(res,200,{telegramEnabled:false,admin:false});const body=await readBody(req);const user=validateTelegram(body.initData);if(!user)return send(res,401,{error:"Telegram authentication failed"});const players=readPlayers(),p=playerFor(players,user);writePlayers(players);return send(res,200,{telegramEnabled:true,admin:user.username===ADMIN_USERNAME,player:p,user});}catch(e){return send(res,400,{error:e.message});}
 }
 if(pathname==="/api/leaderboard"&&req.method==="GET"){
  const period=new URL(req.url,"http://localhost").searchParams.get("period")||"season",key=period==="daily"?"dailyScore":period==="weekly"?"weeklyScore":"score";
  const all=Object.values(readPlayers()).map(p=>({...p,score:p[key]||0}));
  return send(res,200,{players:all.sort((a,b)=>b.score-a.score).slice(0,100),total:all.length,period,telegramRequired:!!BOT_TOKEN});
 }
 if(pathname==="/api/player"&&req.method==="POST"){
  try{
   const body=await readBody(req),user=auth(req);if(BOT_TOKEN&&!user)return send(res,401,{error:"Open Coin inside Telegram"});
   const id=user?"tg_"+user.id:String(body.playerId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);if(!id)return send(res,400,{error:"playerId required"});
   const players=readPlayers();const p=user?playerFor(players,user):(players[id]||{id,nickname:"Игрок",score:0,dailyScore:0,weeklyScore:0,dailyKey:"",weeklyKey:"",games:0,wins:0,createdAt:Date.now()});
   if(!user)p.nickname=cleanName(body.nickname||p.nickname);
   if(Number.isFinite(Number(body.balance)))p.balance=Math.max(0,Math.min(100000000,Math.floor(Number(body.balance))));
   players[id]=p;writePlayers(players);return send(res,200,{player:p});
  }catch(e){return send(res,400,{error:e.message});}
 }
 if(pathname==="/api/score"&&req.method==="POST"){
  try{
   const body=await readBody(req),user=auth(req);if(BOT_TOKEN&&!user)return send(res,401,{error:"Open Coin inside Telegram"});
   const id=user?"tg_"+user.id:String(body.playerId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);if(!id)return send(res,400,{error:"playerId required"});
   const players=readPlayers(),p=user?playerFor(players,user):(players[id]||{id,nickname:"Игрок",score:0,dailyScore:0,weeklyScore:0,dailyKey:"",weeklyKey:"",games:0,wins:0,createdAt:Date.now()});
   if(!user)p.nickname=cleanName(body.nickname||p.nickname);
   const points=Math.max(0,Math.min(1000000,Math.floor(Number(body.points)||0))),now=new Date(),day=now.toISOString().slice(0,10),monday=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
   monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));const week=monday.toISOString().slice(0,10);
   if(p.dailyKey!==day){p.dailyKey=day;p.dailyScore=0;}if(p.weeklyKey!==week){p.weeklyKey=week;p.weeklyScore=0;}
   p.score+=points;p.dailyScore+=points;p.weeklyScore+=points;p.games+=1;if(body.won===true)p.wins+=1;
   if(Number.isFinite(Number(body.balance)))p.balance=Math.max(0,Math.min(100000000,Math.floor(Number(body.balance))));
   players[id]=p;writePlayers(players);return send(res,200,{player:p});
  }catch(e){return send(res,400,{error:e.message});}
 }
 if(pathname==="/api/transfer"&&req.method==="POST"){
  try{
   const user=auth(req);if(!user)return send(res,401,{error:"Переводы доступны после входа через Telegram"});
   const body=await readBody(req),to=cleanUsername(body.username),amount=Math.floor(Number(body.amount));
   if(!to||!Number.isFinite(amount)||amount<1)return send(res,400,{error:"Укажи username и сумму"});
   const players=readPlayers(),sender=playerFor(players,user),recipient=Object.values(players).find(p=>p.username===to);
   if(!recipient)return send(res,404,{error:"Игрок с таким username ещё не зарегистрирован в Coin"});
   if(recipient.id===sender.id)return send(res,400,{error:"Нельзя переводить самому себе"});
   if(sender.balance<amount)return send(res,400,{error:"Недостаточно CR на балансе"});
   sender.balance-=amount;recipient.balance=(recipient.balance||0)+amount;sender.updatedAt=recipient.updatedAt=Date.now();
   writePlayers(players);return send(res,200,{ok:true,balance:sender.balance,recipient:recipient.nickname,amount});
  }catch(e){return send(res,400,{error:e.message});}
 }
 if(pathname==="/api/admin/broadcast"&&req.method==="POST"){
  try{
   const user=auth(req);if(!user||user.username!==ADMIN_USERNAME)return send(res,403,{error:"Forbidden"});
   if(!BOT_TOKEN)return send(res,503,{error:"TELEGRAM_BOT_TOKEN is not configured"});
   const body=await readBody(req),message=String(body.message||"").trim().slice(0,3500),mode=body.mode==="self"?"self":"all";if(!message)return send(res,400,{error:"Введите текст рассылки"});
   const players=readPlayers(),targets=mode==="self"?[players["tg_"+user.id]].filter(Boolean):Object.values(players).filter(p=>p.telegramId);
   let sent=0,failed=0;for(const p of targets){try{await telegramSend(p.telegramId,message);sent++;}catch{failed++;}}
   return send(res,200,{ok:true,sent,failed,mode});
  }catch(e){return send(res,400,{error:e.message});}
 }
 if(pathname==="/api/round-hash"&&req.method==="POST"){
  try{const body=await readBody(req),record={game:String(body.game||"").slice(0,40),result:String(body.result||"").slice(0,100),nonce:crypto.randomBytes(16).toString("hex"),at:Date.now()};const hash=crypto.createHash("md5").update(JSON.stringify(record)).digest("hex");return send(res,200,{hash,algorithm:"MD5"});}catch(e){return send(res,400,{error:e.message});}
 }
 if(pathname.startsWith("/api/"))return send(res,404,{error:"API route not found"});
 const requestPath=pathname==="/"?"/index.html":pathname,file=path.resolve(root,"."+requestPath);
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end("Forbidden");}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"});return res.end("Not found");}res.writeHead(200,{"Content-Type":types[path.extname(file)]||"application/octet-stream","Cache-Control":"no-cache"});res.end(data);});
});
const port=process.env.PORT||8080;server.listen(port,"0.0.0.0",()=>console.log("Coin Casino listening on "+port));
