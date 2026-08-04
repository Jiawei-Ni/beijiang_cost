/* 北疆行程 · 多人同步(方案 C:离线优先 + 手动云同步 + 按条目合并)
   ------------------------------------------------------------------
   后端:GitHub 仓库里的一个 ledger.json,用 Contents API 读写。
   为什么能用 GitHub:
     · Contents API 的 sha 天然就是「乐观锁」—— PUT 时带上你读到的 sha,
       如果这期间别人改过,GitHub 直接回 409,我们重新拉取合并再推,不会覆盖别人。
     · api.github.com 支持浏览器跨域(CORS),不用自己搭服务。
   令牌怎么处理:
     · 令牌【绝不进代码仓库】—— 进了就是公开的,而且 GitHub 的 secret scanning
       会检测到并直接把它吊销。这里是每个人在 App 的 ⚙ 里手填一次,
       只存在各自手机的 localStorage,永远不上传。
   合并策略:按条目 id 取并集,同 id 比 mt(最后修改时间)取新的;
   删除走墓碑 del:true —— 真删的话别人的旧数据一同步就把它复活了。
*/

var LS_GH    = 'xj_gh';        // {owner,repo,path,branch,auto}
var LS_TOKEN = 'xj_gh_token';  // 单独存,方便「清除令牌」
var LS_SYNC  = 'xj_sync_ts';
var LS_ME    = 'xj_me';        // 我是哪个成员

/* ===== 配置 =====
   仓库坐标写成默认值 —— 全队用的是同一个账本仓库,同伴拿到网址后只要填一个令牌就能同步。
   ⚠️ 这里只放「仓库在哪」,令牌绝不写进代码(进了仓库就是公开的,GitHub 还会直接吊销它)。
   「我是谁」也故意不预设:预设成某个人的话,同伴新记的账会默认记到他头上。 */
var GH_DEFAULT = { owner:'Jiawei-Ni', repo:'beijiang_data', path:'ledger.json', branch:'main', auto:true };

function ghCfg(){
  var c = {owner:GH_DEFAULT.owner, repo:GH_DEFAULT.repo, path:GH_DEFAULT.path, branch:GH_DEFAULT.branch, auto:GH_DEFAULT.auto};
  // 存过的值优先;但空字符串当没填过 —— 否则以前存过空配置的人永远拿不到新默认值
  try{
    var s=JSON.parse(lsGet(LS_GH)||'{}');
    for(var k in s){
      if(s[k]==null) continue;
      if(typeof s[k]==='string' && !s[k].trim()) continue;
      c[k]=s[k];
    }
  }catch(e){}
  c.token = lsGet(LS_TOKEN) || '';
  return c;
}
function ghSave(c){
  lsSet(LS_GH, JSON.stringify({owner:c.owner,repo:c.repo,path:c.path,branch:c.branch,auto:!!c.auto}));
  if(c.token) lsSet(LS_TOKEN, c.token);
}
function ghReady(){ var c=ghCfg(); return !!(c.owner && c.repo && c.token); }
function meId(){ return lsGet(LS_ME) || ''; }
function setMeId(id){ lsSet(LS_ME, id||''); }

/* ===== UTF-8 安全的 base64 =====
   直接 btoa(中文) 会抛 InvalidCharacterError,必须先转成字节 */
function b64enc(str){
  var bytes = new TextEncoder().encode(str), bin = '';
  for(var i=0;i<bytes.length;i+=0x8000){
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i+0x8000));
  }
  return btoa(bin);
}
function b64dec(b64){
  var bin = atob((b64||'').replace(/\s/g,''));       // GitHub 返回的 base64 带换行
  var bytes = new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

/* ===== 合并 ===== */
/* 递归排序 key,让两份内容相同但字段顺序不同的 json 能比出相等 */
function canon(v){
  if(Array.isArray(v)) return v.map(canon);
  if(v && typeof v==='object'){
    var o={}, ks=Object.keys(v).sort();
    for(var i=0;i<ks.length;i++) o[ks[i]]=canon(v[ks[i]]);
    return o;
  }
  return v;
}
function same(a,b){ return JSON.stringify(canon(a))===JSON.stringify(canon(b)); }

function mergeList(local, remote, stats){
  local  = Array.isArray(local)  ? local  : [];
  remote = Array.isArray(remote) ? remote : [];
  var pick = {}, i;
  for(i=0;i<local.length;i++) if(local[i] && local[i].id) pick[local[i].id]=local[i];
  for(i=0;i<remote.length;i++){
    var r = remote[i]; if(!r || !r.id) continue;
    var l = pick[r.id];
    if(!l){ pick[r.id]=r; stats.added++; continue; }
    var lm=+l.mt||0, rm=+r.mt||0;
    if(rm>lm){ pick[r.id]=r; if(!same(l,r)) stats.updated++; }
    else if(rm===lm && rm!==0 && !same(l,r)){
      // 同一毫秒改了同一条:按设备 id 字典序裁决,保证两边算出同样的结果
      if((r.by||'') > (l.by||'')){ pick[r.id]=r; stats.updated++; }
    }
  }
  // 排序:必须两台设备排出【完全一样】的顺序,不能「本地的排前面」——
  // 否则内容一致却比不出相等,双方会永远觉得对方有新东西,无限互相提交 commit
  var out=[], seen={};
  for(i=0;i<local.length;i++){ var a=local[i]; if(a&&a.id&&!seen[a.id]){ out.push(pick[a.id]); seen[a.id]=1; } }
  for(i=0;i<remote.length;i++){ var b=remote[i]; if(b&&b.id&&!seen[b.id]){ out.push(pick[b.id]); seen[b.id]=1; } }
  out.sort(function(x,y){
    var d=(+x.seq||0)-(+y.seq||0);
    if(d) return d;
    return x.id<y.id ? -1 : (x.id>y.id ? 1 : 0);   // seq 撞车时按 id,保证是全序
  });
  return out;
}

function mergeData(local, remote){
  var stats = {added:0, updated:0};
  var lmt = local.mt || {}, rmt = remote.mt || {};
  var out = { ver:4, mt:{} };

  ['people4','people6'].forEach(function(k){
    var lm=+lmt[k]||0, rm=+rmt[k]||0;
    if(rm>lm){ out[k]=remote[k]; out.mt[k]=rm; if(remote[k]!==local[k]) stats.updated++; }
    else     { out[k]=local[k];  out.mt[k]=lm; }
  });
  var lc=+lmt.car||0, rc=+rmt.car||0;
  if(rc>lc){ out.car=remote.car; if(!same(local.car,remote.car)) stats.updated++; }
  else out.car=local.car;
  out.mt.car = Math.max(lc,rc);

  out.members  = mergeList(local.members,  remote.members,  stats);
  out.days     = mergeList(local.days,     remote.days,     stats);
  out.expenses = mergeList(local.expenses, remote.expenses, stats);
  return { data: out, stats: stats };
}

/* ===== GitHub Contents API ===== */
function ghHeaders(c){
  return {
    'Authorization': 'Bearer ' + c.token,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}
function ghUrl(c){
  return 'https://api.github.com/repos/'+encodeURIComponent(c.owner)+'/'+encodeURIComponent(c.repo)+
         '/contents/'+c.path.split('/').map(encodeURIComponent).join('/');
}

/* 把 HTTP 状态翻译成人话 —— 旅途中出问题,同伴看得懂才有意义 */
function ghErrMsg(res){
  if(res.status===401) return '令牌无效或已过期,点 ⚙ 重新填一个';
  if(res.status===403){
    if(res.headers.get('X-RateLimit-Remaining')==='0') return 'GitHub 限流了,过一会儿再点';
    return '令牌权限不够(要 Contents 读写)';
  }
  if(res.status===404) return '找不到仓库或文件 —— 检查 ⚙ 里的用户名/仓库名,或令牌没授权这个仓库';
  if(res.status===422) return '提交被拒(分支名对吗?)';
  return 'GitHub 返回 ' + res.status;
}

async function ghRead(c){
  var res = await fetch(ghUrl(c)+'?ref='+encodeURIComponent(c.branch), {
    headers: ghHeaders(c),
    cache: 'no-store'          // 不加这句会吃到浏览器缓存,拿到旧账本
  });
  if(res.status===404) return {text:null, sha:null};   // 首次同步,文件还没建
  if(!res.ok){ var e=new Error(ghErrMsg(res)); e.status=res.status; throw e; }
  var j = await res.json();
  if(!j.content && j.size > 900000) throw new Error('账本太大了(超过 1MB),GitHub 接口读不了');
  return { text: b64dec(j.content||''), sha: j.sha };
}

async function ghWrite(c, text, sha, msg){
  var body = { message: msg, content: b64enc(text), branch: c.branch };
  if(sha) body.sha = sha;                               // 没 sha = 新建文件
  var res = await fetch(ghUrl(c), {
    method:'PUT', headers: ghHeaders(c), cache:'no-store',
    body: JSON.stringify(body)
  });
  if(res.status===409 || res.status===422){ var e=new Error('conflict'); e.conflict=true; throw e; }
  if(!res.ok) throw new Error(ghErrMsg(res));
  return await res.json();
}

/* ===== 同步主流程 ===== */
var syncing = false;
function setSyncState(txt, busy){
  var b = el('btnsync'); if(!b) return;
  b.textContent = txt;
  b.disabled = !!busy;
  b.classList.toggle('busy', !!busy);
}
function syncLabel(){
  var ts = +(lsGet(LS_SYNC)||0);
  return ts ? '☁ 同步 '+hhmm(ts) : '☁ 同步';
}
function refreshSyncBtn(){ setSyncState(syncLabel(), false); }

async function syncNow(silent){
  if(syncing) return;
  var c = ghCfg();
  if(!ghReady()){
    if(!silent){ toast('先在 ⚙ 里填一个访问令牌就能同步'); openSettings(); }
    return;
  }
  syncing = true; setSyncState('同步中…', true);

  try{
    var total = {added:0, updated:0}, pushed = false;

    for(var attempt=0; attempt<3; attempt++){
      var got = await ghRead(c);
      var remote = got.text ? migrate(JSON.parse(got.text)) : null;

      if(remote){
        var m = mergeData(data, remote);
        total.added += m.stats.added; total.updated += m.stats.updated;
        data = m.data;
        saveNow();
        renderAll();
        if(same(data, remote)){ pushed = true; break; }   // 两边已经一致,不用推
      }

      var txt = JSON.stringify(data, null, 1);
      var who = meId() ? mName(meId()) : DEV;
      try{
        await ghWrite(c, txt, got.sha, '同步 · ' + who + ' ' + hhmm(now()));
        pushed = true; break;
      }catch(err){
        if(err.conflict) continue;                        // 别人抢先提交了,重新拉取合并
        throw err;
      }
    }

    if(!pushed) throw new Error('连续 3 次都被别人抢先了,过几秒再点一次');

    lsSet(LS_SYNC, ''+now());
    refreshSyncBtn();
    if(!silent || total.added || total.updated){
      toast(total.added||total.updated
        ? ('已同步 ✓ 新增 '+total.added+' 条,更新 '+total.updated+' 条')
        : '已同步 ✓ 大家的数据一致');
    }
  }catch(err){
    refreshSyncBtn();
    // fetch 抛 TypeError 基本就是断网/被拦截
    var msg = (err && err.name==='TypeError') ? '现在没网,有信号了再点一次(本地记账不受影响)'
                                              : (err && err.message) || '同步失败';
    if(!silent) toast('⚠️ ' + msg);
  }finally{
    syncing = false;
  }
}

/* 测试连接:只读,不写任何东西 */
async function ghTest(){
  var c = ghCfg();
  if(!c.owner || !c.repo || !c.token){ toast('用户名、仓库名、令牌都要填'); return; }
  toast('连接中…');
  try{
    var got = await ghRead(c);
    toast(got.text===null ? '连上了 ✓ 账本还不存在,点同步会自动建' : '连上了 ✓ 已读到云端账本');
  }catch(err){
    toast('⚠️ ' + ((err && err.name==='TypeError') ? '连不上网' : (err.message||'失败')));
  }
}

/* 开 App 时如果有网,自动拉一次 —— 早上在酒店 wifi 下打开就能看到大家昨晚记的账 */
window.addEventListener('load', function(){
  refreshSyncBtn();
  var c = ghCfg();
  if(c.auto && ghReady() && navigator.onLine !== false){
    setTimeout(function(){ syncNow(true); }, 1500);
  }
});
