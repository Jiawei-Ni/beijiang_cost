/* 北疆行程 · 费用管理 —— 逻辑(v4:稳定 ID)
   v3 → v4 的改动:
   A. members/days/expenses 每条都有永不变的 id;payer/share 存 id 不存名字
      (以前存名字 —— 谁把「老A」改成「老 A」,他名下所有分账当场断掉)
   B. 删除 = 打墓碑 del:true,不是真删
      (真删的话,别人的旧数据一同步就把删掉的条目「复活」了)
   C. 每条带 mt(最后修改时间)+ by(改的人),合并时按 mt 比大小
   D. 老版本数据自动迁移,不用手工重录
*/
var DATA_VERSION = 4;          // 内置数据版本,改 data.js 时 +1
var LS_KEY = 'xj_cost';
var LS_TS  = 'xj_cost_ts';
var LS_VER = 'xj_cost_ver';
var LS_DEV = 'xj_dev';

/* ===== 存取(全部包 try/catch:iOS 无痕模式写入会抛错) ===== */
function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,v); return true; }catch(e){ return false; } }
function lsDel(k){ try{ localStorage.removeItem(k); return true; }catch(e){ return false; } }

function now(){ return Date.now(); }

/* 本机设备 id:用于「谁改的」和同一毫秒撞车时的稳定裁决 */
var DEV = lsGet(LS_DEV);
if(!DEV){ DEV = 'dv' + Math.random().toString(36).slice(2,8); lsSet(LS_DEV, DEV); }

/* ===== 小工具 ===== */
function el(i){ return document.getElementById(i); }
function esc(s){ return (s==null?'':(''+s)).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function num(v){ var n=parseFloat(v); return isNaN(n)?0:n; }
function r2(n){ return Math.round(n*100)/100; }
function money(n){ return n.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function toast(m){ var t=el('toast'); if(!t) return; t.textContent=m; t.classList.add('show'); clearTimeout(t._h); t._h=setTimeout(function(){t.classList.remove('show');},2200); }
function pad(n){ return n<10?'0'+n:''+n; }
function hhmm(ts){ var d=new Date(ts); return pad(d.getHours())+':'+pad(d.getMinutes()); }

/* 内容散列 → 稳定 id。老数据迁移时用:同一份 json 在任何人手机上都迁出同样的 id,
   否则 5 个人各导入一次同一个文件,合并出来就是 5 份重复账目。 */
function hashId(pre, s){
  var h = 5381;
  for(var i=0;i<s.length;i++){ h = ((h<<5)+h+s.charCodeAt(i)) | 0; }
  return pre + (h>>>0).toString(36);
}

/* ===== 老数据迁移 ===== */
function migrate(d){
  if(!d || typeof d!=='object') return null;
  if(+d.ver >= 4){                       // 已是新版,只补齐可能缺的字段
    d.mt = d.mt || {people4:0,people6:0,car:0};
    ['members','days','expenses'].forEach(function(k){
      (d[k]||[]).forEach(function(x,i){
        if(x.mt==null) x.mt=0;
        if(x.seq==null) x.seq=i+1;
      });
    });
    return d;
  }

  // --- v3 及更早:members 是字符串数组,noTrip 是名字数组,条目没有 id ---
  var out = {
    ver: 4,
    people4: d.people4!=null ? d.people4 : 4,
    people6: d.people6!=null ? d.people6 : 6,
    mt: {people4:0, people6:0, car:0},
    car: d.car ? JSON.parse(JSON.stringify(d.car)) : JSON.parse(JSON.stringify(DEFAULT.car)),
    members: [], days: [], expenses: []
  };

  var noTrip = Array.isArray(d.noTrip) ? d.noTrip : [];
  var nameToId = {};
  var oldMembers = Array.isArray(d.members)&&d.members.length ? d.members : ['巴巴','柠檬','njw','老A','阿菜'];
  oldMembers.forEach(function(nm, i){
    var name = (typeof nm==='string') ? nm : (nm && nm.name) || ('成员'+(i+1));
    var id = 'm'+(i+1);                  // 按下标 —— 同一份老文件在谁手机上迁移都一样
    nameToId[name] = id;
    out.members.push({ id:id, seq:i+1, name:name, noTrip: noTrip.indexOf(name)>=0, mt:0 });
  });
  function mid(name){ return nameToId[name] || ''; }

  var bToId = {};
  var oldDays = Array.isArray(d.days)&&d.days.length ? d.days : DEFAULT.days;
  oldDays.forEach(function(x, i){
    var id = 'd'+(i+1);
    bToId[x.b] = id;
    var nd = JSON.parse(JSON.stringify(x));
    nd.id = id; nd.seq = i+1; nd.mt = 0;
    out.days.push(nd);
  });

  (Array.isArray(d.expenses)?d.expenses:[]).forEach(function(x, i){
    var ne = JSON.parse(JSON.stringify(x));
    // id 由内容 + 下标散列而来,保证同一份文件迁出同样的 id
    ne.id = hashId('e', [i, x.day||'', x.t||'', x.payer||'', x.amt||''].join('|'));
    ne.seq = i+1;
    ne.payer = mid(x.payer);
    ne.share = (Array.isArray(x.share)?x.share:[]).map(mid).filter(Boolean);
    ne.dayId = bToId[x.day] || '';
    if(!ne.dayId && x.day) ne.badge = x.day;   // 「车」这种不对应具体某天的标签
    delete ne.day;
    ne.mt = 0;
    out.expenses.push(ne);
  });

  return out;
}

/* ===== 载入 ===== */
function loadRaw(){
  var s = lsGet(LS_KEY);
  if(!s) return null;
  try{ return JSON.parse(s); }catch(e){ return null; }
}

var data = migrate(loadRaw()) || JSON.parse(JSON.stringify(DEFAULT));
(function heal(){
  if(!Array.isArray(data.members) || !data.members.length) data.members = JSON.parse(JSON.stringify(DEFAULT.members));
  if(!Array.isArray(data.expenses)) data.expenses = [];
  if(!Array.isArray(data.days) || !data.days.length) data.days = JSON.parse(JSON.stringify(DEFAULT.days));
  if(!data.car) data.car = JSON.parse(JSON.stringify(DEFAULT.car));
  if(!data.mt)  data.mt  = {people4:0,people6:0,car:0};
  data.ver = 4;
})();

/* ===== 活条目访问器(过滤墓碑) ===== */
function MEMBERS(){ return data.members.filter(function(x){ return !x.del; }); }
function DAYS(){    return data.days.filter(function(x){ return !x.del; }); }
function EXPENSES(){return data.expenses.filter(function(x){ return !x.del; }); }
function byId(list,id){ for(var i=0;i<list.length;i++) if(list[i].id===id) return list[i]; return null; }
function M(id){ return byId(data.members,id); }
function mName(id){ var m=M(id); return m?m.name:'(已删)'; }
function D(id){ return byId(data.days,id); }
function E(id){ return byId(data.expenses,id); }
/* 支出的日期徽章:优先关联的那天,其次自带标签 */
function exBadge(e){ var d=D(e.dayId); return d ? d.b : (e.badge||''); }

/* 盖时间戳 —— 所有改动都必须走这里,否则合并时会被别人的旧数据盖掉 */
function stamp(o){ o.mt = now(); o.by = DEV; return o; }

/* ===== 自动保存 ===== */
var saveTimer=null, saveOK=true;
function setSaveState(txt,dirty){
  var s=el('savestate'); if(!s) return;
  s.textContent=txt; s.classList.toggle('dirty',!!dirty);
}
function saveNow(){
  clearTimeout(saveTimer); saveTimer=null;
  var ok = lsSet(LS_KEY, JSON.stringify(data));
  lsSet(LS_TS, ''+now()); lsSet(LS_VER, ''+DATA_VERSION);
  saveOK = ok;
  if(ok) setSaveState('已保存 '+hhmm(now()),false);
  else   setSaveState('⚠️ 存不进,记得导出',true);
  return ok;
}
function markDirty(){
  setSaveState('保存中…',true);
  clearTimeout(saveTimer);
  saveTimer=setTimeout(saveNow,600);
}
document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='hidden') saveNow(); });
window.addEventListener('pagehide',saveNow);
window.addEventListener('beforeunload',saveNow);

/* ===== 成员 ===== */
function travelers(){ return MEMBERS().filter(function(m){ return !m.noTrip; }); }
function travelerIds(){ return travelers().map(function(m){ return m.id; }); }
function isPayerOnly(id){ var m=M(id); return !!(m&&m.noTrip); }

function togglePayerOnly(id){
  var m=M(id); if(!m) return;
  m.noTrip = !m.noTrip;
  stamp(m);
  if(m.noTrip){                                   // 转成只代付 → 从所有分摊名单里摘掉
    data.expenses.forEach(function(e){
      if(e.del || !Array.isArray(e.share)) return;
      var k=e.share.indexOf(id);
      if(k>=0){ e.share.splice(k,1); stamp(e); }
    });
  }
  markDirty(); renderSplit();
}
function setMember(id,v){
  var m=M(id); if(!m) return;
  var nv=(v||'').trim(); if(!nv || nv===m.name) return;
  m.name=nv; stamp(m);
  // 改名不再需要跟着改 expenses —— 那边存的是 id,这正是稳定 ID 改造的意义
  markDirty(); renderSplitBal();
}
function addMember(){
  data.members.push(stamp({ id:'m_'+DEV+'_'+now().toString(36), seq:now(), name:'成员'+(MEMBERS().length+1), noTrip:false }));
  markDirty(); renderSplit();
}
function delMember(id){
  if(MEMBERS().length<=1) return;
  var m=M(id); if(!m) return;
  m.del=true; stamp(m);
  data.expenses.forEach(function(e){
    if(e.del || !Array.isArray(e.share)) return;
    var k=e.share.indexOf(id);
    if(k>=0){ e.share.splice(k,1); stamp(e); }
  });
  markDirty(); renderSplit();
}

/* ===== 计算 ===== */
function calc(){
  var roomTotal = DAYS().reduce(function(s,d){ return s+num(d.price); },0);
  var carRent = num(data.car.days)*num(data.car.perday);
  var oil     = num(data.car.km)*num(data.car.oil);
  var carTotal= carRent+oil;
  return {
    roomTotal: roomTotal, carRent: carRent, oil: oil, carTotal: carTotal,
    per4: roomTotal + carTotal/num(data.people4||4),
    per6: roomTotal + carTotal/num(data.people6||6)
  };
}
function balances(){
  var Ms=MEMBERS(), paid={}, owe={}, T=travelerIds();
  Ms.forEach(function(m){ paid[m.id]=0; owe[m.id]=0; });
  EXPENSES().forEach(function(e){
    var amt=num(e.amt); if(!amt) return;
    if(paid[e.payer]===undefined) paid[e.payer]=0;
    paid[e.payer]+=amt;
    var sh=(e.share||[]).filter(function(x){ return T.indexOf(x)>=0; });
    if(!sh.length) sh=T;
    if(!sh.length) return;
    var per=amt/sh.length;
    sh.forEach(function(id){ owe[id]=(owe[id]||0)+per; });
  });
  return Ms.map(function(m){
    // 不在这里 r2:先四舍五入再相加会让「净额求和」差一两分,显示时再 round
    return { id:m.id, name:m.name, paid:(paid[m.id]||0), owe:(owe[m.id]||0), net:(paid[m.id]||0)-(owe[m.id]||0) };
  });
}
function settlements(){
  var b=balances();
  var debt=b.filter(function(x){return x.net<-0.005;}).map(function(x){return {name:x.name,v:-x.net};}).sort(function(a,c){return c.v-a.v;});
  var cred=b.filter(function(x){return x.net> 0.005;}).map(function(x){return {name:x.name,v: x.net};}).sort(function(a,c){return c.v-a.v;});
  var out=[], i=0, j=0, guard=0;
  while(i<debt.length && j<cred.length && guard++<200){
    var v=Math.min(debt[i].v,cred[j].v);
    if(v>0.005) out.push({from:debt[i].name,to:cred[j].name,amt:r2(v)});
    debt[i].v=r2(debt[i].v-v); cred[j].v=r2(cred[j].v-v);
    if(debt[i].v<=0.005) i++;
    if(cred[j].v<=0.005) j++;
  }
  return out;
}
