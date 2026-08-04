/* 北疆行程 · 初始数据 v4(2026-08-04)
   —— 来自「北疆行程存档.json」,修正三处:
   1) D1 的 721 拆成两条:巴巴 357 / 柠檬 364(原来全记在巴巴头上,差 364)
   2) D8/D9 用美团实付 566.34(原来是 141.59×4=566.36 反算,各多 2 分)
   3) 手工改过金额的房费条目打上 manual:true,「刷新房费」不会再覆盖它们

   ⚠️ v4 起所有条目带稳定 id,这里的 id 必须是【写死的常量】。
   原因:5 个人各自第一次打开 App 时拿到的都是这份 DEFAULT,
   如果 id 是随机生成的,一同步就会合并出 5 份重复的行程和账目。
   写死之后大家的默认数据完全一致,合并是干净的无操作。
   —— 所以往后加内置条目,id 也要手写,不要用随机数。

   字段说明:
     mt   = 最后修改时间戳(合并时比大小,内置数据一律 0,谁改过谁的 mt 就大)
     by   = 最后修改人的设备 id(同一毫秒撞车时用来稳定裁决)
     del  = 墓碑。删除不是真删,是打标记 —— 否则别人的旧数据一同步就把它「复活」了
     seq  = 创建序号,决定显示顺序。合并后按 seq 排序,两台设备才会排出完全一样的
            顺序 —— 否则内容明明一致却比不出相等,会无限互相提交 commit
*/
var DEFAULT = {
  ver: 4,
  people4: 4,
  people6: 6,
  mt: { people4: 0, people6: 0, car: 0 },
  car: { days: 8, perday: 930, km: 2420, oil: 0.8 },

  members: [
    { id: "m1", seq: 1, name: "巴巴",  noTrip: false, mt: 0 },
    { id: "m2", seq: 2, name: "柠檬",  noTrip: true,  mt: 0 },
    { id: "m3", seq: 3, name: "njw",   noTrip: false, mt: 0 },
    { id: "m4", seq: 4, name: "老A",   noTrip: false, mt: 0 },
    { id: "m5", seq: 5, name: "阿菜",  noTrip: false, mt: 0 }
  ],

  days: [
    { id:"d1", seq:1, b:"D1", rest:false, route:"厦门 → 乌鲁木齐", km:50,
      plan:"赶路-取车-换雪地胎", area:"乌鲁木齐",
      hotel:"亚朵酒店(奥体中心红光山景区)", room:"双床房×2", price:180.25,
      booked:true, cancel:"9.26 12:00前", payer:"巴巴357/柠檬364", mt:0 },
    { id:"d2", seq:2, b:"D2", rest:false, route:"乌鲁木齐 → 赛里木湖", km:550,
      plan:"赶路-赛里木湖日落", area:"赛里木湖东门入口",
      hotel:"桔子酒店(博乐赛里木湖店)", room:"双床房x2 721", price:360.5,
      booked:false, cancel:"", payer:"", mt:0 },
    { id:"d3", seq:3, b:"D3", rest:false, route:"赛里木湖 → 克拉玛依", km:550,
      plan:"赛里木湖环湖-赶路转场", area:"克拉玛依",
      hotel:"全季酒店(克拉玛依泰富广场一号井店)", room:"双床房x2 423", price:211.5,
      booked:false, cancel:"", payer:"", mt:0 },
    { id:"d4", seq:4, b:"D4", rest:false, route:"克拉玛依 → 布尔津", km:300,
      plan:"魔鬼城、五彩滩", area:"布尔津",
      hotel:"布尔津泰悦假日酒店", room:"双床房x2 432", price:182.475,
      booked:true, cancel:"9.29 20:00", payer:"巴巴729.9", mt:0 },
    { id:"d5", seq:5, b:"D5", rest:false, route:"布尔津 → 贾登峪 → 喀纳斯", km:120,
      plan:"走走村里", area:"喀纳斯村里",
      hotel:"牧马星河云境别苑", room:"四人家庭房×1", price:616.5,
      booked:true, cancel:"9.29 12:00前", payer:"携程 njw 2466", mt:0 },
    { id:"d6", seq:6, b:"D6", rest:false, route:"喀纳斯 → 贾登峪 → 禾木", km:50,
      plan:"晨雾、三湾、转场禾木", area:"禾木村外游客中心",
      hotel:"禾木全季", room:"全季双床x2 2834", price:708.5,
      booked:false, cancel:"", payer:"", mt:0 },
    { id:"d7", seq:7, b:"D7", rest:false, route:"禾木 → 阿禾公路 → 阿勒泰", km:250,
      plan:"禾木村 + 阿禾公路", area:"阿勒泰",
      hotel:"汉庭酒店(阿勒泰五百里风情街店)", room:"双床房 415", price:207.5,
      booked:false, cancel:"", payer:"", mt:0 },
    { id:"d8", seq:8, b:"D8", rest:false, route:"阿勒泰 → 乌鲁木齐", km:550,
      plan:"乌伦古湖、S21沙漠公路", area:"乌鲁木齐",
      hotel:"全季酒店(乌鲁木齐天山国际机场新天润店)", room:"双床房×2", price:141.59,
      booked:true, cancel:"10.3 12:00前", payer:"美团 巴巴 566.34", mt:0 },
    { id:"d9", seq:9, b:"D9", rest:true, route:"乌鲁木齐", km:0,
      plan:"城内乱逛、天山之类的备选", area:"乌鲁木齐机场附近",
      hotel:"全季酒店(乌鲁木齐天山国际机场新天润店)", room:"双床房×2", price:141.59,
      booked:true, cancel:"10.4 12:00前", payer:"美团 柠檬 566.34", mt:0 }
  ],

  expenses: [
    // --- D1 实际两间房分别付款,拆成两条 ---
    { id:"e1", seq:1, t:"亚朵酒店 · 巴巴那间", amt:357, payer:"m1",
      share:["m1","m3","m4","m5"], dayId:"d1", src:"room", manual:true, mt:0 },
    { id:"e2", seq:2, t:"亚朵酒店 · 柠檬那间", amt:364, payer:"m2",
      share:["m1","m3","m4","m5"], dayId:"d1", src:"room", manual:true, mt:0 },

    { id:"e3", seq:3, t:"桔子酒店(博乐赛里木湖店)", amt:0, payer:"m1",
      share:["m1","m3","m4","m5"], dayId:"d2", src:"room", unit:360.5, mt:0 },
    { id:"e4", seq:4, t:"全季酒店(克拉玛依泰富广场一号井店)", amt:0, payer:"m1",
      share:["m1","m3","m4","m5"], dayId:"d3", src:"room", unit:211.5, mt:0 },
    { id:"e5", seq:5, t:"布尔津泰悦假日酒店", amt:729.9, payer:"m1",
      share:["m1","m3","m4","m5"], dayId:"d4", src:"room", unit:182.475, mt:0 },
    { id:"e6", seq:6, t:"牧马星河云境别苑", amt:2466, payer:"m3",
      share:["m1","m3","m4","m5"], dayId:"d5", src:"room", unit:616.5, mt:0 },
    { id:"e7", seq:7, t:"禾木全季", amt:0, payer:"m1",
      share:["m1","m3","m4","m5"], dayId:"d6", src:"room", unit:708.5, mt:0 },
    { id:"e8", seq:8, t:"汉庭酒店(阿勒泰五百里风情街店)", amt:0, payer:"m1",
      share:["m1","m3","m4","m5"], dayId:"d7", src:"room", unit:207.5, mt:0 },
    { id:"e9", seq:9, t:"全季酒店(乌鲁木齐机场新天润店)", amt:566.34, payer:"m1",
      share:["m1","m3","m4","m5"], dayId:"d8", src:"room", unit:141.59, manual:true, mt:0 },
    { id:"e10", seq:10, t:"全季酒店(乌鲁木齐机场新天润店)", amt:566.34, payer:"m2",
      share:["m1","m3","m4","m5"], dayId:"d9", src:"room", unit:141.59, manual:true, mt:0 }
  ]
};
