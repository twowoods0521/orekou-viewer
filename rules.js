// ==============================
// rules.js
// 俺の甲子園 試合経過ルール
// ==============================

// ------------------------------
// 守備位置
// ------------------------------

const POSITION_RULES = {
  "ピッチャー":"投",
  "キャッチャー":"捕",
  "ファースト":"一",
  "セカンド":"二",
  "サード":"三",
  "ショート":"遊",
  "レフト":"左",
  "センター":"中",
  "ライト":"右"
};

// ------------------------------
// 打球種
// 守備位置と組み合わせて略称を作る
// ------------------------------

const BALL_RULES = {
  "ゴロ":{
    type:"ground",
    suffix:"ゴロ",
    outs:1
  },

  "フライ":{
    type:"fly",
    suffix:"飛",
    outs:1
  },

  "ライナー":{
    type:"line",
    suffix:"直",
    outs:1
  },

  "前ヒット":{
    type:"hit",
    suffix:"安",
    runner:true
  },

  "エラー":{
    type:"error",
    suffix:"失",
    runner:true
  }
};

// ------------------------------
// 特殊イベント
// ------------------------------

const SPECIAL_RULES = [
  // ===== 出塁 =====

  {
    match:"内野安打",
    type:"infieldHit",
    abbr:"内野安打",
    runner:true
  },

  {
    match:"二塁打",
    type:"double",
    abbr:"二塁打",
    runner:true
  },

  {
    match:"三塁打",
    type:"triple",
    abbr:"三塁打",
    runner:true
  },

  {
    match:"ランニングホームラン",
    type:"homeRun",
    abbr:"走本",
    runner:false
  },

  {
    match:"ホームラン",
    type:"homeRun",
    abbr:"本塁打",
    runner:false
  },

  {
    match:"長打性のヒット",
    type:"hit",
    abbr:"安打",
    runner:true
  },

  {
    match:"セーフティバント成功",
    type:"buntHit",
    abbr:"内野安打",
    runner:true
  },

  {
    match:"セーフティ気味のバント",
    type:"buntHit",
    abbr:"内野安打",
    runner:true
  },

{
    match:"エンドラン成功",
    type:"hitAndRun",
    abbr:"安打",
    runner:true
  },

  {
    match:"フォアボール",
    type:"walk",
    abbr:"四球",
    runner:true
  },

  {
    match:"敬遠",
    type:"walk",
    abbr:"四球",
    runner:true
  },

  {
    match:"満塁策",
    type:"walk",
    abbr:"四球",
    runner:true
  },

  {
    match:"デッドボール",
    type:"hbp",
    abbr:"死球",
    runner:true
  },

  {
    match:"フィルダースチョイス",
    type:"fielderChoice",
    abbr:"野選",
    runner:true
  },

  // ===== アウト =====

  {
    match:"三振",
    type:"strikeout",
    abbr:"三振",
    outs:1
  },

  {
    match:"ゲッツー崩れ",
    type:"fielderChoiceDoublePlay",
    abbr:"ゴロ",
    outs:1,
    removeRearRunner:true,
    runner:true
  },

  {
  match:"ゲッツー",
  type:"doublePlay",
  outs:2,
  removeRearRunner:true
  },

  {
    match:"バント成功",
    type:"sacrificeBunt",
    abbr:"犠打",
    outs:1,
  },

    {
    match:"バント失敗",
    type:"failedBunt",
    abbr:"捕飛",
    outs:1,
  },

  // ===== 得点 =====

  {
    match:"生還して1点",
    type:"score",
    score:1
  },

  // ===== カード表示用 =====

  {
    match:"走者進塁",
    type:"advance"
  },

  {
    match:"タッチアップ",
    type:"tagUp"
  },

  {
    match:"好返球でアウト",
    type:"tagUpOut"
  },

  {
    match:"三塁走者動けず",
    type:"holdThird"
  },

  {
    match:"押し出し",
    type:"forceScore"
  },

  // ===== 盗塁 =====

  {
    match:"盗塁成功",
    type:"steal",
    success:true
  },

  {
    match:"盗塁失敗",
    type:"caughtStealing",
    success:false,
    outs:1
  },

  {
    match:"三盗成功",
    type:"stealThird",
    success:true
  },

  {
    match:"三盗失敗",
    type:"caughtStealingThird",
    success:false,
    outs:1
  },

  {
    match:"牽制死",
    type:"pickoff",
    outs:1
  },

  // ===== 交代 =====

  {
    match:"代打",
    type:"pinchHitter"
  },

  {
    match:"代走",
    type:"pinchRunner"
  },

  {
  match:"そのまま",
  type:"stayDefense"
},

{
  match:"に交代",
  type:"positionSub"
},

  {
    match:"守備位置変更",
    type:"positionChange"
  },

  {
    match:"登板",
    type:"pitcherChange"
  }
];

// ==============================
// 守備位置抽出
// ==============================

function extractPosition(line){
  for(const [word,abbr] of Object.entries(POSITION_RULES)){
    if(line.includes(word)){
      return{
        word,
        abbr
      };
    }
  }

  return null;
}

// ==============================
// 打球種抽出
// 長い文字列を優先
// ==============================

function extractBallType(line){
  const entries = Object.entries(BALL_RULES)
    .sort((a,b)=>b[0].length-a[0].length);

  for(const [word,data] of entries){
    if(line.includes(word)){
      return{
        word,
        ...data
      };
    }
  }

  return null;
}

// ==============================
// 特殊イベント抽出
// ==============================

function extractSpecial(line){
  return SPECIAL_RULES.find(rule=>

    line.includes(rule.match)

  ) || null;
}

// ==============================
// 1行分類
// ==============================

function classifyLine(line){
     if(line.includes("バント失敗") && line.includes("フォースアウト")){
    return{
      type:"failedBuntForceOut",
      abbr:"捕ゴロ",
      outs:1,
      removeFrontRunner:true,
      runner:true,
      text:line
    };
}  

  const special = extractSpecial(line);

  if(special){
    return{
      ...special,
      text:line
    };
  }

  const position = extractPosition(line);
  const ball = extractBallType(line);

  if(position && ball){
    return{
      type:ball.type,

      position:position.abbr,

      abbr:position.abbr + ball.suffix,

      runner:ball.runner || false,

      outs:ball.outs || 0,

      removeRearRunner:ball.removeRearRunner || false,

      text:line
    };
  }

  return{
    type:"unknown",
    text:line
  };
}