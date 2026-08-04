/* 北疆行程 · 界面渲染 + 导入导出 + 设置(v4:全部按 id 寻址)
   为什么不能再用下标:删除改成墓碑之后,数组里混着已删条目,
   下标随时会错位 —— 点「删第 3 条」可能删掉别的。 */

/* ===== 每日 ===== */
var CURTAB='days';               // 当前在哪个页签 —— 决定改完之后刷新哪个列表

/* 一条支出的编辑行(每日页用):项目名 / 金额 / 付款人 / 分摊
   付款人可以先不选 —— 帮别人代记时很常见。没选之前这笔不进分账,界面上会明说。 */
function expenseRowHTML(e){
  var q="'"+e.id+"'";
  var Ms=MEMBERS(), T=travelers(), Tids=travelerIds();
  var sh=(Array.isArray(e.share)?e.share:Tids).filter(function(x){ return Tids.indexOf(x)>=0; });
  var claimed=isLiveMember(e.payer);
  return '<div class="dayex'+(claimed?'':' unclaimed')+'">'+
    '<div class="exhead">'+
      '<input class="t" value="'+esc(e.t)+'" placeholder="花在哪(如 晚饭/门票/加油)" onchange="EX('+q+',\'t\',this.value)">'+
      '<span class="del" onclick="delExpense('+q+')">✕</span>'+
    '</div>'+
    '<div class="g2">'+
      '<div class="fl"><label>金额 ¥(总额)</label>'+
        '<input type="number" inputmode="decimal" value="'+esc(e.amt)+'" oninput="EXamt('+q+',this.value)"></div>'+
      '<div class="fl"><label>谁付的钱</label><select onchange="EX('+q+',\'payer\',this.value)">'+
        '<option value="">— 选付款人 —</option>'+
        Ms.map(function(m){ return '<option value="'+esc(m.id)+'" '+(e.payer===m.id?'selected':'')+'>'+esc(m.name)+'</option>'; }).join('')+
      '</select></div>'+
    '</div>'+
    (claimed?'':'<div class="warnline">⚠️ 还没选付款人,这笔暂不计入分账</div>')+
    '<div class="shline">分摊给谁(点一下切换,'+sh.length+'人均摊 ¥'+money(num(e.amt)/(sh.length||1))+'/人)</div>'+
    '<div class="chips">'+T.map(function(m){
      return '<span class="chip '+(sh.indexOf(m.id)>=0?'on':'')+'" onclick="toggleShare('+q+',\''+m.id+'\')">'+esc(m.name)+'</span>';
    }).join('')+'</div>'+
  '</div>';
}

function renderDays(){
  var box=el('v_days'); box.innerHTML='';
  DAYS().forEach(function(d){
    var q="'"+d.id+"'";
    var c=document.createElement('div'); c.className='card';
    c.innerHTML=
      '<div class="cardtop">'+
        '<span class="dbadge '+(d.rest?'rest':'')+'">'+esc(d.b)+'</span>'+
        '<span class="droute">'+esc(d.route)+'</span>'+
        '<span class="pill '+(d.booked?'ok':'no')+'">'+(d.booked?'已订':'未订')+'</span>'+
      '</div>'+
      '<div class="fl"><label>行程 / 路线</label><input value="'+esc(d.route)+'" oninput="U('+q+',\'route\',this.value)"></div>'+
      '<div class="g2">'+
        '<div class="fl"><label>里程 km</label><input type="number" inputmode="decimal" value="'+esc(d.km)+'" oninput="U('+q+',\'km\',this.value)"></div>'+
        '<div class="fl"><label>住宿区域 📍</label><input value="'+esc(d.area)+'" oninput="U('+q+',\'area\',this.value)"></div>'+
      '</div>'+
      '<div class="fl"><label>当天安排 / 景点</label><textarea oninput="U('+q+',\'plan\',this.value)">'+esc(d.plan)+'</textarea></div>'+
      '<div class="fl"><label>酒店名</label><input value="'+esc(d.hotel)+'" oninput="U('+q+',\'hotel\',this.value)"></div>'+
      '<div class="g3">'+
        '<div class="fl"><label>房型</label><input value="'+esc(d.room)+'" oninput="U('+q+',\'room\',this.value)"></div>'+
        '<div class="fl"><label>单人价 ¥</label><input type="number" inputmode="decimal" value="'+esc(d.price)+'" oninput="U('+q+',\'price\',this.value)"></div>'+
        '<div class="fl"><label>是否预订</label><select onchange="U('+q+',\'booked\',this.value===\'1\')">'+
          '<option value="0" '+(!d.booked?'selected':'')+'>未订</option>'+
          '<option value="1" '+( d.booked?'selected':'')+'>已订</option></select></div>'+
      '</div>'+
      '<div class="g2">'+
        '<div class="fl"><label>退订最晚日期 ⏰</label><input value="'+esc(d.cancel)+'" oninput="U('+q+',\'cancel\',this.value)" placeholder="如 9.26 12:00前"></div>'+
        '<div class="fl"><label>预订人 / 付款</label><input value="'+esc(d.payer)+'" oninput="U('+q+',\'payer\',this.value)" placeholder="谁订的/平台/金额"></div>'+
      '</div>'+
      '<div class="dayexhd"><span>🧾 当天开销</span>'+
        '<span class="daytot" id="daytot_'+d.id+'">当天合计 ¥'+money(dayTotal(d.id))+'</span></div>'+
      dayExpenses(d.id).map(expenseRowHTML).join('')+
      '<button class="addbtn" style="margin:0;" onclick="addDayExpense('+q+')">＋ 记一笔当天开销</button>'+
      '<div class="dayexnote">房费不在这里改(用「预订」页的刷新房费)。合计含房费,记完自动进分账。</div>';
    box.appendChild(c);
  });
}
function U(id,k,v){
  var d=D(id); if(!d) return;
  d[k]=v; stamp(d);
  markDirty();
  renderCost(); renderBook();
  if(k==='booked'||k==='route') renderDays();
  if(k==='price') refreshDayTotals();     // 房价改了,当天合计跟着变
}

/* ===== 费用 ===== */
function setPeople(k,v){ data[k]=v; data.mt[k]=now(); markDirty(); renderCost(); }
function setCar(k,v){ data.car[k]=v; data.mt.car=now(); markDirty(); renderCost(); }

function renderCost(){
  var r=calc();
  el('v_cost').innerHTML=
    '<div class="peoplebar"><label>👥 分摊人数(方案A)</label><input type="number" inputmode="numeric" value="'+esc(data.people4)+'" oninput="setPeople(\'people4\',this.value)"></div>'+
    '<div class="sum">'+
      '<h3>💰 车+房人均('+esc(data.people4)+'人)</h3>'+
      '<div class="bigrow"><span class="lbl">人均总花费</span><span class="val">¥'+money(r.per4)+'</span></div>'+
      '<div class="divider"></div>'+
      '<div class="miniline"><span>房费(每日单人价合计)</span><span>¥'+money(r.roomTotal)+'</span></div>'+
      '<div class="miniline"><span>车费 ÷ '+esc(data.people4)+'人</span><span>¥'+money(r.carTotal/num(data.people4||4))+'</span></div>'+
    '</div>'+
    '<div class="peoplebar"><label>👥 分摊人数(方案B)</label><input type="number" inputmode="numeric" value="'+esc(data.people6)+'" oninput="setPeople(\'people6\',this.value)"></div>'+
    '<div class="sum" style="background:linear-gradient(135deg,#2a5c9d,#3577c9);">'+
      '<h3>💰 车+房人均('+esc(data.people6)+'人)</h3>'+
      '<div class="bigrow"><span class="lbl">人均总花费</span><span class="val">¥'+money(r.per6)+'</span></div>'+
      '<div class="divider"></div>'+
      '<div class="miniline"><span>房费(每日单人价合计)</span><span>¥'+money(r.roomTotal)+'</span></div>'+
      '<div class="miniline"><span>车费 ÷ '+esc(data.people6)+'人</span><span>¥'+money(r.carTotal/num(data.people6||6))+'</span></div>'+
    '</div>'+
    '<div class="card">'+
      '<div class="cardtop"><span class="droute">🚙 车费参数(改这里自动重算)</span></div>'+
      '<div class="g2">'+
        '<div class="fl"><label>租车天数</label><input type="number" inputmode="decimal" value="'+esc(data.car.days)+'" oninput="setCar(\'days\',this.value)"></div>'+
        '<div class="fl"><label>每日租金 ¥</label><input type="number" inputmode="decimal" value="'+esc(data.car.perday)+'" oninput="setCar(\'perday\',this.value)"></div>'+
        '<div class="fl"><label>综合里程 km</label><input type="number" inputmode="decimal" value="'+esc(data.car.km)+'" oninput="setCar(\'km\',this.value)"></div>'+
        '<div class="fl"><label>每公里油费 ¥</label><input type="number" inputmode="decimal" value="'+esc(data.car.oil)+'" oninput="setCar(\'oil\',this.value)"></div>'+
      '</div>'+
      '<div class="divider" style="background:#eee;"></div>'+
      '<div class="miniline" style="color:#666;"><span>租车 '+esc(data.car.days)+'×'+esc(data.car.perday)+'</span><span>¥'+money(r.carRent)+'</span></div>'+
      '<div class="miniline" style="color:#666;"><span>油费 '+esc(data.car.km)+'×'+esc(data.car.oil)+'</span><span>¥'+money(r.oil)+'</span></div>'+
      '<div class="miniline" style="color:#333;font-weight:800;"><span>车费合计</span><span>¥'+money(r.carTotal)+'</span></div>'+
    '</div>'+
    '<div class="note">口径:人均 = 每日单人价合计(房) + 车费÷人数。油费已含在车费里。<br>⚠️ 这里的「单人价」就是每人每晚的价,<b>不要再乘人数</b>;分账页的房费总额会自动 = 单人价 × 实际参与人数。</div>';
}

/* ===== 预订 ===== */
function renderBook(){
  var L=DAYS();
  var un=L.filter(function(d){ return !d.booked; });
  var h = un.length
    ? '<div class="card" style="background:#fff8ec;"><b style="color:#9a5c05;">⚠️ 待预订 '+un.length+' 晚</b></div>'
    : '<div class="card" style="background:#eef7f0;"><b style="color:#1e8a4d;">🎉 全部已预订</b></div>';
  L.forEach(function(d){
    h+='<div class="bkrow">'+
      '<span class="bd">'+esc(d.b)+'</span>'+
      '<div class="binfo">'+
        '<div class="bh">'+esc(d.area)+' · '+esc(d.hotel)+'</div>'+
        '<div class="bsub">'+esc(d.room)+' · ¥'+esc(d.price)+'/人 '+(d.payer?'· '+esc(d.payer):'')+'</div>'+
      '</div>'+
      '<div style="text-align:right;">'+
        '<span class="pill '+(d.booked?'ok':'no')+'">'+(d.booked?'已订':'未订')+'</span>'+
        (d.cancel?'<div class="bcancel">⏰ '+esc(d.cancel)+'</div>':'')+
      '</div>'+
    '</div>';
  });
  el('v_book').innerHTML=h;
}

/* ===== 分账:条目增删改 ===== */
function addExpense(){
  // 付款人默认【不填】—— 以前用 meId()||第一个成员 兜底,
  // 结果没选「我是谁」的人一记账就全挂到巴巴头上,而且没人看得出来
  data.expenses.push(stamp({
    id:'e_'+DEV+'_'+now().toString(36)+Math.random().toString(36).slice(2,5), seq:now(),
    t:'', amt:'', payer:'', share:travelerIds(), dayId:'', manual:true
  }));
  markDirty(); renderSplit();
}
/* 每日页:给某一天记一笔 */
function addDayExpense(dayId){
  data.expenses.push(stamp({
    id:'e_'+DEV+'_'+now().toString(36)+Math.random().toString(36).slice(2,5), seq:now(),
    t:'', amt:'', payer:'', share:travelerIds(), dayId:dayId||'', manual:true
  }));
  markDirty(); renderDays(); renderSplitBal();
}
function delExpense(id){
  var e=E(id); if(!e) return;
  e.del=true; stamp(e);           // 墓碑,不是真删
  markDirty(); reRenderLists();
}
function EX(id,k,v){ var e=E(id); if(!e) return; e[k]=v; stamp(e); markDirty(); reRenderLists(); }
function EXamt(id,v){
  var e=E(id); if(!e) return;
  e.amt=v;
  if(e.src==='room') e.manual=true;   // 手改过金额 → 「刷新房费」不再覆盖
  stamp(e); markDirty();
  // 金额是 oninput,整页重渲染会把正在打字的输入框冲掉 —— 只原地更新合计
  if(CURTAB==='days') refreshDayTotals(); else renderSplitBal();
}
function toggleShare(eid,mid){
  var e=E(eid); if(!e) return;
  if(!Array.isArray(e.share)) e.share=travelerIds();
  var k=e.share.indexOf(mid);
  if(k>=0) e.share.splice(k,1); else e.share.push(mid);
  stamp(e); markDirty(); reRenderLists();
}
/* 同一条支出在「每日」和「分账」两个页面都能改,只重渲染当前这个页面;
   另一个页面切过去时 tab() 会重新渲染,不会看到旧数据 */
function reRenderLists(){
  if(CURTAB==='days') renderDays(); else renderSplit();
}
function refreshDayTotals(){
  DAYS().forEach(function(d){
    var t=el('daytot_'+d.id);
    if(t) t.textContent='当天合计 ¥'+money(dayTotal(d.id));
  });
}

/* ===== 分账:一键刷新 ===== */
function importRooms(){
  var T=travelers();
  if(!T.length){ alert('没有参与旅行的成员'); return; }
  if(!confirm('按每日「单人价 × '+T.length+' 人」刷新房费金额?\n\n· 已有条目的付款人、分摊名单一律保留\n· 你手改过金额的条目不会被覆盖\n· 未预订的天数金额记 0')) return;

  var kept=0, added=0, skipped=0;
  var live=DAYS(), alive={};
  live.forEach(function(d){ alive[d.id]=1; });

  // 1) 天数已经删掉的房费条目 → 打墓碑
  data.expenses.forEach(function(e){
    if(e.del || e.src!=='room') return;
    if(!alive[e.dayId]){ e.del=true; stamp(e); }
  });

  // 2) 逐天刷新
  live.forEach(function(d){
    var rows=EXPENSES().filter(function(e){ return e.src==='room' && e.dayId===d.id; });
    var p=num(d.price);
    if(rows.length===0){
      // id 用 e_room_<dayId> 而不是随机数 —— 否则两个人各点一次「刷新房费」,
      // 一同步就会变成同一天两条房费
      data.expenses.push(stamp({
        id:'e_room_'+d.id, seq:(+d.seq||0)+0.5,   // 挂在对应那天后面
        t: d.hotel || (d.area+'住宿'),
        amt: d.booked ? r2(p*T.length) : 0,
        payer: '', share: travelerIds(),     // 付款人留空等人认领,不硬塞第一个成员
        dayId: d.id, src:'room', unit:p
      }));
      added++;
    }else if(rows.length===1){
      var e=rows[0];
      e.unit=p;
      if(!e.t) e.t=d.hotel||(d.area+'住宿');
      if(e.manual){ skipped++; }
      else{
        var T2=travelerIds();
        var sh=(Array.isArray(e.share)&&e.share.length)?e.share.filter(function(x){ return T2.indexOf(x)>=0; }):T2;
        e.amt = d.booked ? r2(p*(sh.length||T2.length)) : 0;
        kept++;
      }
      stamp(e);
    }else{
      skipped+=rows.length;   // 一天多条 = 拆了付款人,金额一律不动
    }
  });

  markDirty(); renderSplit();
  toast('房费已刷新:更新'+kept+' 新增'+added+' 保留'+skipped);
}

function importCar(){
  var r=calc();
  [['rent','e_car_rent'],['oil','e_car_oil']].forEach(function(pair){
    var tag=pair[0], fixedId=pair[1];       // 固定 id:两个人各刷一次也不会变成四条
    var e=E(fixedId);
    var title = tag==='rent' ? ('租车 '+data.car.days+'天') : ('油费 '+data.car.km+'km');
    var amt   = tag==='rent' ? r2(r.carRent) : r2(r.oil);
    if(e){ e.del=false; e.t=title; if(!e.manual) e.amt=amt; stamp(e); }
    else data.expenses.push(stamp({
      id:fixedId, seq:(tag==='rent'?900001:900002), t:title, amt:amt, payer:'',
      share:travelerIds(), dayId:'', badge:'车', src:'car', tag:tag
    }));
  });
  markDirty(); renderSplit(); toast('车费已刷新,记得改付款人');
}

/* ===== 分账:渲染 ===== */
function renderSplitBal(){
  var box=el('sp_bal'); if(!box) return;
  var B=balances(), S=settlements(), roots=settlementRoots();
  var total=EXPENSES().reduce(function(s,e){ return s+num(e.amt); },0);
  var T=travelers();
  var avg=total/(T.length||1);
  var nOnly=MEMBERS().filter(function(m){ return m.noTrip; }).length;
  var pend=pendingExpenses();
  var pendAmt=pend.reduce(function(s,e){ return s+num(e.amt); },0);
  box.innerHTML=
    '<div class="sum" style="background:linear-gradient(135deg,#7a4d1e,#c9832a);">'+
      '<h3>💸 分账总览</h3>'+
      '<div class="bigrow"><span class="lbl">总支出</span><span class="val">¥'+money(total)+'</span></div>'+
      '<div class="divider"></div>'+
      '<div class="miniline"><span>'+T.length+' 位参与者人均(仅参考)</span><span>¥'+money(avg)+'</span></div>'+
      '<div class="miniline"><span>条目数 · 成员</span><span>'+EXPENSES().length+' 笔 · '+MEMBERS().length+'人('+nOnly+'人只代付)</span></div>'+
      (pend.length?'<div class="miniline" style="font-weight:800;"><span>⚠️ '+pend.length+' 笔还没选付款人</span><span>¥'+money(pendAmt)+' 未计入</span></div>':'')+
    '</div>'+
    '<div class="card">'+
      '<div class="cardtop"><span class="droute">📊 每人账目</span></div>'+
      '<table class="bal">'+
        '<tr><th>成员</th><th>已垫付</th><th>应分摊</th><th>净额</th></tr>'+
        B.map(function(x){
          var n = Math.abs(x.net)<0.005 ? 0 : x.net;   // 浮点残渣不显示成 −¥0.00
          var rid=roots[x.id]||x.id;
          var bind=rid!==x.id ? '<div class="settlebind-badge">结算并入 '+esc(mName(rid))+'</div>' : '';
          return '<tr><td><div>'+esc(x.name)+(isPayerOnly(x.id)?' <span style="font-size:10px;color:#c9832a;font-weight:700;">代付</span>':'')+'</div>'+bind+'</td>'+
                 '<td>¥'+money(x.paid)+'</td><td>¥'+money(x.owe)+'</td>'+
                 '<td class="'+(n>=0?'pos':'neg')+'">'+(n>=0?'+':'−')+'¥'+money(Math.abs(n))+'</td></tr>';
        }).join('')+
      '</table>'+
      '<div style="font-size:11px;color:#aab;padding-top:7px;">净额 <span class="pos">正</span>=垫多了该收回,<span class="neg">负</span>=该补钱</div>'+
    '</div>'+
    '<div class="card">'+
      '<div class="cardtop"><span class="droute">🤝 最简结算方案</span></div>'+
      (S.length
        ? S.map(function(s){ return '<div class="settle"><span class="settlewho">'+esc(s.from)+' → '+esc(s.to)+'</span><span class="amt">¥'+money(s.amt)+'</span></div>'; }).join('')
        : '<div style="color:#1e8a4d;font-weight:700;font-size:13.5px;">🎉 已经平账,谁也不欠谁</div>')+
      (S.length?'<div style="font-size:11px;color:#aab;padding-top:5px;">共 '+S.length+' 笔转账即可全部结清</div>':'')+
    '</div>';
}

function renderSplit(){
  var Ms=MEMBERS(), T=travelers(), Tids=travelerIds(), roots=settlementRoots();
  var h='<div class="card">'+
    '<div class="cardtop"><span class="droute">👥 同行成员</span><span style="font-size:11px;color:#8a8f99;">实际参与 '+T.length+' 人</span></div>'+
    Ms.map(function(m){
      var q="'"+m.id+"'";
      var direct=(m.settleTo&&M(m.settleTo)&&!M(m.settleTo).del)?m.settleTo:'';
      var rid=roots[m.id]||m.id;
      var hint=direct&&rid!==direct ? '<span class="bindhint">最终归到 '+esc(mName(rid))+'</span>' : '';
      return '<div class="memberbox">'+
        '<div class="mrow"><input value="'+esc(m.name)+'" onchange="setMember('+q+',this.value)">'+
          '<span class="chip '+(m.noTrip?'':'on')+'" style="white-space:nowrap;" onclick="togglePayerOnly('+q+')">'+(m.noTrip?'💳只代付':'🧳参与')+'</span>'+
          '<span class="del" onclick="delMember('+q+')">✕</span></div>'+
        '<div class="bindrow"><label>统一结算给</label><select onchange="setSettlementRep('+q+',this.value)">'+
          '<option value="">本人结算</option>'+
          Ms.filter(function(x){return x.id!==m.id;}).map(function(x){ return '<option value="'+esc(x.id)+'" '+(direct===x.id?'selected':'')+'>'+esc(x.name)+'</option>'; }).join('')+
        '</select>'+hint+'</div></div>';
    }).join('')+
    '<button class="addbtn" style="margin:4px 0 0;" onclick="addMember()">＋ 加成员</button>'+
    '<div style="font-size:11px;color:#aab;padding-top:6px;">点「参与/只代付」切换。<b>只代付</b>的人不占人头、不分摊任何费用,只记录他垫付了多少、最后该收回多少。<br><b>统一结算</b>只把最终转账并到代表名下,不改变每人账目和真实付款人。改名字不会影响账目。</div>'+
  '</div>'+
  '<div class="sechd">🧾 支出明细(谁付的 / 谁分摊)</div>'+
  '<div style="display:flex;gap:7px;margin-bottom:9px;">'+
    '<button class="addbtn" style="margin:0;" onclick="importRooms()">⤵ 刷新房费</button>'+
    '<button class="addbtn" style="margin:0;" onclick="importCar()">⤵ 刷新车费</button>'+
  '</div>';

  EXPENSES().forEach(function(e){
    var q="'"+e.id+"'";
    var sh=(Array.isArray(e.share)?e.share:Tids).filter(function(x){ return Tids.indexOf(x)>=0; });
    var uh=e.unit?(' · 单人 ¥'+money(num(e.unit))+' × '+sh.length+'人'):'';
    var badge=exBadge(e);
    var claimed=isLiveMember(e.payer);
    h+='<div class="exrow'+(e.manual&&e.src?' locked':'')+(claimed?'':' unclaimed')+'">'+
      '<div class="exhead">'+
        (badge?'<span class="bd">'+esc(badge)+'</span>':'')+
        '<input class="t" value="'+esc(e.t)+'" placeholder="项目名(如 D3晚饭/加油/门票)" onchange="EX('+q+',\'t\',this.value)" style="border:none;padding:2px 0;font-weight:700;">'+
        '<span class="del" onclick="delExpense('+q+')">✕</span>'+
      '</div>'+
      '<div class="g2">'+
        '<div class="fl"><label>金额 ¥(总额)'+(e.manual&&e.src?' 🔒手填':'')+'</label><input type="number" inputmode="decimal" value="'+esc(e.amt)+'" oninput="EXamt('+q+',this.value)"></div>'+
        '<div class="fl"><label>谁付的钱</label><select onchange="EX('+q+',\'payer\',this.value)">'+
          '<option value="">— 选付款人 —</option>'+
          Ms.map(function(m){ return '<option value="'+esc(m.id)+'" '+(e.payer===m.id?'selected':'')+'>'+esc(m.name)+'</option>'; }).join('')+
        '</select></div>'+
      '</div>'+
      (claimed?'':'<div class="warnline">⚠️ 还没选付款人,这笔暂不计入分账</div>')+
      // 房费/车费的归属由「刷新」按钮维护,给改反而会和它打架;手记的才让挂
      (e.src ? '' :
        '<div class="fl" style="margin-bottom:7px;"><label>挂到哪天</label><select onchange="EX('+q+',\'dayId\',this.value)">'+
          '<option value="">— 不挂 —</option>'+
          DAYS().map(function(d){ return '<option value="'+esc(d.id)+'" '+(e.dayId===d.id?'selected':'')+'>'+esc(d.b)+' '+esc(d.route)+'</option>'; }).join('')+
        '</select></div>')+
      '<div class="shline">分摊给谁(点一下切换,'+sh.length+'人均摊 ¥'+money(num(e.amt)/(sh.length||1))+'/人'+uh+')</div>'+
      '<div class="chips">'+T.map(function(m){
        return '<span class="chip '+(sh.indexOf(m.id)>=0?'on':'')+'" onclick="toggleShare('+q+',\''+m.id+'\')">'+esc(m.name)+'</span>';
      }).join('')+'</div>'+
    '</div>';
  });

  h+='<button class="addbtn" onclick="addExpense()">＋ 加一笔支出</button>'+
     '<div id="sp_bal"></div>'+
     '<div class="note" style="padding-bottom:20px;">口径:金额填「这笔总共花了多少」,工具按分摊人数自动均摊;净额正=该收回,负=该补。<br>🔒 标记的条目金额是你手填的,点「刷新房费」不会被覆盖。</div>';

  el('v_split').innerHTML=h;
  renderSplitBal();
}

/* ===== tab ===== */
function tab(t){
  CURTAB=t;
  ['days','cost','book','split'].forEach(function(x){
    el('v_'+x).classList.toggle('hide',x!==t);
    document.querySelector('.tab[data-t='+x+']').classList.toggle('on',x===t);
  });
  if(t==='days') renderDays();     // 分账页改过的条目,切回来要看到最新的
  if(t==='cost') renderCost();
  if(t==='book') renderBook();
  if(t==='split') renderSplit();
  window.scrollTo(0,0);
}

/* ===== 设置弹层 ===== */
function openSettings(){
  var c=ghCfg(), me=meId();
  el('setbody').innerHTML=
    '<div class="fl"><label>我是谁(新记的支出默认算在他头上)</label>'+
      '<select id="s_me">'+
        '<option value="">— 没选 —</option>'+
        MEMBERS().map(function(m){ return '<option value="'+esc(m.id)+'" '+(me===m.id?'selected':'')+'>'+esc(m.name)+'</option>'; }).join('')+
      '</select></div>'+
    '<div class="sechd" style="padding:12px 0 4px;">☁ 多人同步(GitHub)</div>'+
    '<div class="modaltip">仓库已经<b>预填好</b>了,你只要填最下面的<b>访问令牌</b>,点保存就能和大家同步。<br>令牌只存在你自己手机上,不会上传到仓库里。不填也能用 —— 就是个纯本地记账工具。<br>第一次用请先在上面选<b>我是谁</b>,新记的账会默认算在他头上。</div>'+
    '<div class="g2">'+
      '<div class="fl"><label>GitHub 用户名</label><input id="s_owner" value="'+esc(c.owner)+'" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="如 zhangsan"></div>'+
      '<div class="fl"><label>仓库名</label><input id="s_repo" value="'+esc(c.repo)+'" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="如 beijiang-data"></div>'+
    '</div>'+
    '<div class="g2">'+
      '<div class="fl"><label>分支</label><input id="s_branch" value="'+esc(c.branch)+'" autocapitalize="off" autocorrect="off" spellcheck="false"></div>'+
      '<div class="fl"><label>账本文件名</label><input id="s_path" value="'+esc(c.path)+'" autocapitalize="off" autocorrect="off" spellcheck="false"></div>'+
    '</div>'+
    '<div class="fl"><label>访问令牌 Token'+(c.token?' <span style="color:#1e8a4d;">· 已填</span>':'')+'</label>'+
      '<input id="s_token" type="password" value="'+esc(c.token)+'" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="github_pat_..."></div>'+
    '<label style="display:flex;align-items:center;gap:7px;font-size:13px;color:#333;font-weight:600;padding:2px 0 8px;">'+
      '<input type="checkbox" id="s_auto" '+(c.auto?'checked':'')+' style="width:18px;height:18px;flex:0 0 auto;">打开 App 时如果有网,自动拉一次</label>'+
    '<div class="modalbtns" style="margin-top:2px;">'+
      '<button class="act b-green" onclick="saveSettings()">保存</button>'+
      '<button class="act b-gray" onclick="ghTest()">测试连接</button>'+
    '</div>'+
    '<div class="modalbtns">'+
      '<button class="act b-gray" onclick="clearToken()">清除令牌</button>'+
      '<button class="act b-gray" style="color:#d94a4a;" onclick="if(confirm(\'恢复到内置的初始行程?\\n\\n本地当前修改会没掉。\\n注意:如果已经开了同步,下次同步会把云端的数据再拉回来。\'))resetData()">↺ 恢复初始数据</button>'+
    '</div>'+
    '<div class="note" style="text-align:left;padding:8px 2px 0;">本机设备号 '+esc(DEV)+' · 数据版本 v'+DATA_VERSION+'</div>';
  el('setmodal').classList.remove('hide');
}
function closeSettings(){ el('setmodal').classList.add('hide'); }
function saveSettings(){
  setMeId(el('s_me').value);
  ghSave({
    owner:(el('s_owner').value||'').trim(),
    repo:(el('s_repo').value||'').trim(),
    branch:(el('s_branch').value||'').trim()||'main',
    path:(el('s_path').value||'').trim()||'ledger.json',
    token:(el('s_token').value||'').trim(),
    auto:el('s_auto').checked
  });
  closeSettings(); renderSplit(); toast('设置已保存 ✓');
}
function clearToken(){
  if(!confirm('清除本机保存的令牌?清了就不能同步,要重新填。')) return;
  lsDel(LS_TOKEN); closeSettings(); toast('令牌已清除');
}

/* ===== 导入 / 导出 / 重置 ===== */
function resetData(){
  data=JSON.parse(JSON.stringify(DEFAULT));
  saveNow(); renderAll(); closeSettings(); toast('已恢复内置数据');
}
function exportJSON(){
  saveNow();
  var txt=JSON.stringify(data,null,2);
  var name='北疆行程存档.json';
  // 1) 系统分享(iOS 首选:能存到「文件」/发微信)
  try{
    if(navigator.share && navigator.canShare && window.File){
      var f=new File([txt],name,{type:'application/json'});
      if(navigator.canShare({files:[f]})){
        navigator.share({files:[f],title:name}).then(function(){ toast('已调起分享 ✓'); },
                                                     function(){ openModal(txt); });
        return;
      }
    }
  }catch(e){}
  // 2) 桌面浏览器:直接下载
  try{
    var a=document.createElement('a');
    if('download' in a){
      var b=new Blob([txt],{type:'application/json;charset=utf-8'});
      a.href=URL.createObjectURL(b); a.download=name;
      document.body.appendChild(a); a.click();
      setTimeout(function(){ URL.revokeObjectURL(a.href); a.parentNode&&a.parentNode.removeChild(a); },1000);
      toast('已导出,可发同伴');
      return;
    }
  }catch(e){}
  // 3) 兜底:弹框复制
  openModal(txt);
}
function openModal(txt){
  el('modaltext').value=txt;
  el('modaltip').textContent='这台设备不支持直接下载文件。点「复制全部」,然后粘到微信/备忘录发给自己就是一份备份。';
  el('modal').classList.remove('hide');
}
function closeModal(){ el('modal').classList.add('hide'); }
function copyModal(){
  var t=el('modaltext');
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(t.value).then(function(){ toast('已复制 ✓'); },function(){ legacyCopy(t); });
      return;
    }
  }catch(e){}
  legacyCopy(t);
}
function legacyCopy(t){
  t.focus(); t.setSelectionRange(0,t.value.length);
  try{ document.execCommand('copy'); toast('已复制 ✓'); }
  catch(e){ toast('请长按文本框手动复制'); }
}
function importJSON(ev){
  var f=ev.target.files[0]; if(!f) return;
  var r=new FileReader();
  r.onload=function(){
    try{
      var raw=JSON.parse(r.result);
      if(!Array.isArray(raw.days)||!raw.days.length) throw new Error('缺 days');
      var d=migrate(raw);
      lsSet('xj_cost_prev', JSON.stringify(data));   // 留一份被覆盖前的
      data=d;
      if(!Array.isArray(data.members)||!data.members.length) data.members=JSON.parse(JSON.stringify(DEFAULT.members));
      if(!Array.isArray(data.expenses)) data.expenses=[];
      if(!data.car) data.car=JSON.parse(JSON.stringify(DEFAULT.car));
      if(!data.mt)  data.mt ={people4:0,people6:0,car:0};
      saveNow(); renderAll(); toast('导入成功 ✓');
    }catch(err){ alert('文件格式不对:'+err.message); }
  };
  r.readAsText(f);
  ev.target.value='';
}

/* ===== 启动 ===== */
function renderAll(){ renderDays(); renderCost(); renderBook(); renderSplit(); }
renderAll();

(function boot(){
  var ts=lsGet(LS_TS);
  setSaveState(ts ? ('上次 '+hhmm(+ts)) : '自动保存中', false);
  if(!lsSet('__probe','1')){
    toast('⚠️ 这台设备存不了本地数据(可能是无痕模式),记得用「导出」备份');
  }
  var v=parseInt(lsGet(LS_VER)||'0',10);
  if(ts && v && v<DATA_VERSION){
    saveNow();   // 刚迁移过,落一次盘
    setTimeout(function(){ toast('数据已升级到 v'+DATA_VERSION+'(支持多人同步)'); },1200);
  }
})();
