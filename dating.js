const crypto = require("crypto");

const ensure = db => {
  db.dating ||= { profiles: {}, states: {}, likes: {}, blocked: {}, reports: [] };
  const d = db.dating;
  d.profiles ||= {}; d.states ||= {}; d.likes ||= {}; d.blocked ||= {}; d.reports ||= [];
  return d;
};
const key = id => String(id);
const esc = s => String(s || "").replace(/[<>]/g, "").trim();
const send = (tg, chat_id, text, reply_markup) => tg("sendMessage", { chat_id, text, ...(reply_markup ? { reply_markup } : {}) });
const edit = (tg, q, text, reply_markup) => tg("editMessageText", {
  chat_id: q.message.chat.id, message_id: q.message.message_id, text,
  ...(reply_markup ? { reply_markup } : {})
});
const kb = rows => ({ inline_keyboard: rows });

async function showMenu(tg, chatId, text) {
  return send(tg, chatId, text, kb([
    [{text:"❤️ Смотреть анкеты",callback_data:"dating:discover"}],
    [{text:"👤 Моя анкета",callback_data:"dating:profile"},{text:"✏️ Изменить анкету",callback_data:"dating:edit"}]
  ]));
}
async function showProfile(tg, chatId, p, isSelf=false) {
  const text = (isSelf ? "Твоя анкета\n\n" : "Анкета\n\n") +
    "👤 " + p.name + ", " + p.age + "\n📍 " + p.city +
    (p.about ? "\n\n" + p.about : "") +
    (isSelf ? "\n\nАнкета видна другим пользователям." : "");
  return send(tg, chatId, text, isSelf ? kb([
    [{text:"❤️ Смотреть анкеты",callback_data:"dating:discover"}],
    [{text:"✏️ Изменить анкету",callback_data:"dating:edit"}]
  ]) : kb([
    [{text:"❤️ Нравится",callback_data:"dating:like:"+p.id},{text:"👎 Дальше",callback_data:"dating:skip:"+p.id}],
    [{text:"🚩 Пожаловаться",callback_data:"dating:report:"+p.id},{text:"⛔ Заблокировать",callback_data:"dating:block:"+p.id}]
  ]));
}
async function nextProfile(db, tg, chatId, viewerId) {
  const d=ensure(db), viewer=d.profiles[key(viewerId)];
  if(!viewer || !viewer.active) return send(tg,chatId,"Сначала создай анкету ❤️",kb([[{text:"Создать анкету",callback_data:"dating:begin"}]]));
  const excluded=new Set([key(viewerId),...(d.blocked[key(viewerId)]||[])]);
  for(const id of Object.keys(d.blocked)) if((d.blocked[id]||[]).includes(key(viewerId))) excluded.add(id);
  const candidates=Object.values(d.profiles).filter(p=>p.active && p.id && !excluded.has(key(p.id)) && !(d.likes[key(viewerId)]||[]).includes(key(p.id)));
  if(!candidates.length) return send(tg,chatId,"Пока больше нет новых анкет. Загляни позже ❤️",kb([[{text:"Моя анкета",callback_data:"dating:profile"}]]));
  const p=candidates[Math.floor(Math.random()*candidates.length)];
  return showProfile(tg,chatId,p,false);
}
async function begin(db,tg,chatId,userId,editMode=false) {
  const d=ensure(db);
  d.states[key(userId)]={step:"name",editMode};
  await send(tg,chatId,editMode?"Изменим анкету. Как тебя показывать в анкете?":"Давай создадим анкету ❤️\n\nКак тебя показывать в анкете? Напиши имя или ник.");
}
async function messageHandler(m,ctx) {
  if(!m?.from?.id || m.chat?.type!=="private" || typeof m.text!=="string" || m.text.startsWith("/")) return false;
  const db=ctx.dbRead(), d=ensure(db), id=key(m.from.id), state=d.states[id];
  if(!state) return false;
  const value=esc(m.text).slice(0,300);
  if(!value){await send(ctx.telegram,m.chat.id,"Напиши текстом, пожалуйста.");return true;}
  if(state.step==="name"){
    if(value.length<2 || value.length>32){await send(ctx.telegram,m.chat.id,"Имя должно быть от 2 до 32 символов. Попробуй ещё раз.");return true;}
    state.name=value;state.step="age";await send(ctx.telegram,m.chat.id,"Сколько тебе лет? Раздел знакомств доступен только совершеннолетним (18+).");return true;
  }
  if(state.step==="age"){
    const age=Number(value);
    if(!Number.isInteger(age)||age<18||age>99){await send(ctx.telegram,m.chat.id,"Укажи возраст от 18 до 99 лет. Если тебе нет 18, раздел знакомств недоступен.");return true;}
    state.age=age;state.step="city";await send(ctx.telegram,m.chat.id,"Из какого ты города?");return true;
  }
  if(state.step==="city"){
    if(value.length<2||value.length>48){await send(ctx.telegram,m.chat.id,"Укажи город (до 48 символов).");return true;}
    state.city=value;state.step="about";await send(ctx.telegram,m.chat.id,"Расскажи немного о себе — до 250 символов. Или отправь «Пропустить».");return true;
  }
  if(state.step==="about"){
    const old=d.profiles[id]||{};
    d.profiles[id]={id,name:state.name||old.name,age:state.age||old.age,city:state.city||old.city,about:value.toLowerCase()==="пропустить"?"":value.slice(0,250),username:m.from.username||old.username||"",active:true,updatedAt:ctx.now()};
    delete d.states[id];ctx.dbWrite(db);
    await send(ctx.telegram,m.chat.id,"Готово! Анкета создана ❤️",kb([
      [{text:"❤️ Смотреть анкеты",callback_data:"dating:discover"}],
      [{text:"👤 Моя анкета",callback_data:"dating:profile"}]
    ]));
    return true;
  }
  return false;
}
async function callbackHandler(q,ctx) {
  if(!q?.from?.id || !q.message?.chat?.id) return false;
  const db=ctx.dbRead(),d=ensure(db),id=key(q.from.id),chatId=q.message.chat.id;
  const data=String(q.data||"");
  await ctx.telegram("answerCallbackQuery",{callback_query_id:q.id});
  if(data==="dating:begin"){await begin(db,ctx.telegram,chatId,id);ctx.dbWrite(db);return true;}
  if(data==="dating:edit"){await begin(db,ctx.telegram,chatId,id,true);ctx.dbWrite(db);return true;}
  if(data==="dating:profile"){
    const p=d.profiles[id];if(!p)return begin(db,ctx.telegram,chatId,id);
    await showProfile(ctx.telegram,chatId,p,true);return true;
  }
  if(data==="dating:discover"){await nextProfile(db,ctx.telegram,chatId,id);return true;}
  const match=data.match(/^dating:(like|skip|report|block):(\d+)$/);
  if(!match)return false;
  const [,action,target]=match,other=d.profiles[target];
  if(!other){await send(ctx.telegram,chatId,"Эта анкета больше недоступна.");return true;}
  if(action==="skip"){await nextProfile(db,ctx.telegram,chatId,id);return true;}
  if(action==="block"){
    d.blocked[id]||=[];if(!d.blocked[id].includes(target))d.blocked[id].push(target);
    ctx.dbWrite(db);await send(ctx.telegram,chatId,"Пользователь заблокирован. Его анкета больше не будет показываться.");await nextProfile(db,ctx.telegram,chatId,id);return true;
  }
  if(action==="report"){
    d.reports.push({from:id,to:target,at:ctx.now()});ctx.dbWrite(db);
    await send(ctx.telegram,chatId,"Жалоба отправлена модерации. Спасибо.");await nextProfile(db,ctx.telegram,chatId,id);return true;
  }
  if(action==="like"){
    d.likes[id]||=[];if(!d.likes[id].includes(target))d.likes[id].push(target);
    const mutual=(d.likes[target]||[]).includes(id);
    ctx.dbWrite(db);
    if(mutual){
      const me=d.profiles[id],them=d.profiles[target];
      await send(ctx.telegram,chatId,"💞 Это взаимно! Вы понравились друг другу.\n\nСвязаться: "+(them.username?"@"+them.username:"Пользователь пока не указал username."));
      if(other.id)await ctx.telegram("sendMessage",{chat_id:other.id,text:"💞 У тебя взаимная симпатия! Вы понравились друг другу.\n\nСвязаться: "+(me.username?"@"+me.username:"Пользователь пока не указал username.")});
    } else {
      if(other.id)await ctx.telegram("sendMessage",{chat_id:other.id,text:"❤️ Кому-то понравилась твоя анкета! Если симпатия будет взаимной, вы получите уведомление."});
      await send(ctx.telegram,chatId,"Лайк отправлен ❤️ Если симпатия будет взаимной, я сообщу тебе.");
    }
    await nextProfile(db,ctx.telegram,chatId,id);return true;
  }
  return false;
}
module.exports = async function(update,ctx) {
  try {
    if(update?.callback_query) return await callbackHandler(update.callback_query,ctx);
    if(update?.message) return await messageHandler(update.message,ctx);
  } catch(e) {
    const chatId=update?.callback_query?.message?.chat?.id||update?.message?.chat?.id;
    if(chatId) await ctx.telegram("sendMessage",{chat_id:chatId,text:"Не получилось обработать действие. Попробуй ещё раз."});
    return true;
  }
  return false;
};
