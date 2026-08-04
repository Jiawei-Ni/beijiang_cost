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
/* 支出的日期徽章:优先关联的那天,其次自带标签。
   那天被删掉之后不再顶着旧徽章 —— 条目留着(钱还在账上),只是不再属于任何一天 */
function exBadge(e){ var d=D(e.dayId); return (d && !d.del) ? d.b : (e.badge||''); }

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
/* 付款人是不是一个还在的成员 —— 空的(代记还没认领)和已删的都算不是 */
function isLiveMember(id){ var m=M(id); return !!(m && !m.del); }
/* 记了金额但还没认领付款人的条目:不进账目,但要在界面上显眼地提醒,不能悄悄吞掉 */
function pendingExpenses(){
  return EXPENSES().filter(function(e){ return num(e.amt)>0 && !isLiveMember(e.payer); });
}
/* 某一天花了多少(含房费,含还没认领的) */
function dayTotal(dayId){
  return EXPENSES().reduce(function(s,e){ return e.dayId===dayId ? s+num(e.amt) : s; },0);
}
/* 每日页里手记的当天开销:房费/车费由「刷新」按钮维护,不在这儿编辑 */
function dayExpenses(dayId){
  return EXPENSES().filter(function(e){ return e.dayId===dayId && e.src!=='room' && e.src!=='car'; });
}

/* ===== 结算代表 =====
   settleTo 只影响最后的转账建议,不改个人垫付/应摊,也不改支出的真实付款人。
   链式绑定取链末;并发同步万一合出环,按 (seq,id) 最小者裁决,每台设备结果一致。 */
function memberOrder(a,b){
  var d=(+a.seq||0)-(+b.seq||0);
  if(d) return d;
  return a.id<b.id ? -1 : (a.id>b.id ? 1 : 0);
}
function settlementRoots(){
  var Ms=MEMBERS().slice().sort(memberOrder), alive={}, roots={};
  Ms.forEach(function(m){ alive[m.id]=m; });

  function resolve(start){
    if(roots[start]) return roots[start];
    var path=[], pos={}, cur=start, root=start;
    while(alive[cur]){
      if(roots[cur]){ root=roots[cur]; break; }
      if(pos[cur]!=null){
        var cycle=path.slice(pos[cur]).map(function(id){return alive[id];}).sort(memberOrder);
        root=cycle[0].id;
        cycle.forEach(function(m){ roots[m.id]=root; });
        break;
      }
      pos[cur]=path.length; path.push(cur);
      var to=alive[cur].settleTo;
      if(!to || to===cur || !alive[to]){ root=cur; break; }
      cur=to;
    }
    path.forEach(function(id){ roots[id]=root; });
    return root;
  }
  Ms.forEach(function(m){ resolve(m.id); });
  return roots;
}
function settlementRepId(id){ return settlementRoots()[id] || id; }
function settlementRepName(id){ return mName(settlementRepId(id)); }
function setSettlementRep(id,target){
  var m=M(id); if(!m || m.del) return;
  target=target||'';
  if(!target || target===id){
    if(!m.settleTo) return;
    delete m.settleTo;
  }else{
    var t=M(target); if(!t || t.del) return;
    // 本机不允许直接造环;同步并发造出的环由 settlementRoots() 确定性兜底
    var seen={}, cur=target;
    while(cur && !seen[cur]){
      if(cur===id){ toast('不能循环绑定结算人'); renderSplit(); return; }
      seen[cur]=1;
      var x=M(cur);
      if(!x || x.del || !x.settleTo) break;
      cur=x.settleTo;
    }
    if(m.settleTo===target) return;
    m.settleTo=target;
  }
  stamp(m); markDirty(); renderSplit();
}

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
  // 代表删掉后,直接绑定到他的人恢复本人结算;链上更远的人仍可落到最后有效成员
  data.members.forEach(function(x){
    if(!x.del && x.settleTo===id){ delete x.settleTo; stamp(x); }
  });
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
    // 付款人还没选(代记的)或者已被删掉 —— 整条跳过。
    // 只跳垫付那一半的话,分摊照记,这笔钱就凭空消失了:净额求和不再是 0,
    // 结算时那点差额会被摊到别人头上,而且是悄悄的。
    if(!isLiveMember(e.payer)) return;
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
function settlementGroups(){
  var Ms=MEMBERS().slice().sort(memberOrder), roots=settlementRoots(), byMember={};
  balances().forEach(function(x){ byMember[x.id]=x; });
  var groups={};
  Ms.forEach(function(m){
    var rid=roots[m.id]||m.id;
    if(!groups[rid]) groups[rid]={id:rid,name:mName(rid),members:[],net:0,order:M(rid)||m};
    groups[rid].members.push(m);
    groups[rid].net+=(byMember[m.id]||{net:0}).net;
  });
  return Object.keys(groups).map(function(id){
    var g=groups[id];
    g.members.sort(memberOrder);
    var included=g.members.filter(function(m){return m.id!==g.id;}).map(function(m){return m.name;});
    g.label=g.name+(included.length?'（含'+included.join('、')+'）':'');
    return g;
  }).sort(function(a,b){ return memberOrder(a.order,b.order); });
}
function settlements(){
  var groups=settlementGroups();
  // 全程用「分」算 —— 浮点上直接贪心会出现「转账总额比债权总额差一两分」
  var rows=groups.map(function(g){ return {id:g.id, name:g.label, order:g.order, c:Math.round(g.net*100)}; });
  // 每组各自四舍五入之后,收和付可能不再刚好抵消(差 1~2 分)。
  // 把这点残差算到金额最大的那组头上:转出总额和转入总额必须严格相等,否则最后总有人差一分钱结不掉。
  var resid=rows.reduce(function(s,x){ return s+x.c; },0);
  if(resid!==0 && rows.length){
    var big=rows.slice().sort(function(a,b){ return Math.abs(b.c)-Math.abs(a.c) || memberOrder(a.order,b.order); })[0];
    big.c-=resid;
  }
  var debt=rows.filter(function(x){return x.c<0;}).map(function(x){return {id:x.id,name:x.name,order:x.order,v:-x.c};})
               .sort(function(a,c){return (c.v-a.v)||memberOrder(a.order,c.order);});
  var cred=rows.filter(function(x){return x.c>0;}).map(function(x){return {id:x.id,name:x.name,order:x.order,v: x.c};})
               .sort(function(a,c){return (c.v-a.v)||memberOrder(a.order,c.order);});
  var out=[], i=0, j=0, guard=0;
  while(i<debt.length && j<cred.length && guard++<400){
    var v=Math.min(debt[i].v,cred[j].v);
    if(v>0) out.push({from:debt[i].name,to:cred[j].name,fromId:debt[i].id,toId:cred[j].id,amt:v/100});
    debt[i].v-=v; cred[j].v-=v;
    if(debt[i].v===0) i++;
    if(cred[j].v===0) j++;
  }
  return out;
}
