// ==============================
// state.js
// 試合進行管理
// ==============================

const gameState = {

  currentCard: 0,
  cards: [],

  inning: 1,
  half: "top",
  maxInning: 9,

  outs: 0,
  runners: [],

  isFinished: false,

  scoreboard: {},

  firstCard: {
    top: {},
    bottom: {}
  }

};

// ==============================
// 得点板初期化
// ==============================

function initializeScoreboard(maxInning = 9){

  gameState.maxInning=maxInning;
  gameState.scoreboard={};

  for(let i=1;i<=maxInning;i++){

    gameState.scoreboard[i]={

      top:{
        runs:0,
        status:"pending"
      },

      bottom:{
        runs:0,
        status:"pending"
      }

    };

  }

  gameState.scoreboard.total={

    away:{R:0,H:0,E:0},
    home:{R:0,H:0,E:0}

  };

}

// ==============================
// 攻撃開始
// ==============================

function startHalf(inning,half){

  gameState.inning=inning;
  gameState.half=half;

  // 万一inningが得点板の範囲外になっても、ここで例外を投げて
  // 画面全体が止まってしまわないようにする(念のための安全策)
  const cell=gameState.scoreboard[inning]?.[half];

  if(cell&&cell.status==="pending"){

    cell.status="live";

  }

}

// ==============================
// 得点
// ==============================

function addRuns(side,runs){

  const cell=gameState.scoreboard[gameState.inning][gameState.half];

  cell.runs+=runs;
  cell.status="live";

  gameState.scoreboard.total[side].R+=runs;

}

// ==============================
// H・E
// ==============================

function addHit(side){

  gameState.scoreboard.total[side].H++;

}

function addError(side){

  gameState.scoreboard.total[side].E++;

}

// ==============================
// アウト
// ==============================

function setOuts(value){

  gameState.outs=Math.max(0,Math.min(3,value));

}

// ==============================
// 走者
// ==============================

function setRunners(runners){

  gameState.runners=[...runners];

}

function clearRunners(){

  gameState.runners=[];

}

// ==============================
// イニング終了（チェンジ）
// ==============================

function changeHalf(){

  const cell=gameState.scoreboard[gameState.inning][gameState.half];

  if(cell.status==="live"){

    cell.status="done";

  }

  gameState.outs=0;
  clearRunners();

  if(gameState.half==="top"){

    gameState.half="bottom";
    startHalf(gameState.inning,"bottom");

  }else{

    gameState.half="top";
    gameState.inning++;

    if(gameState.inning<=gameState.maxInning){

      startHalf(gameState.inning,"top");

    }

  }

}

// ==============================
// 試合終了
// walkoff=trueならサヨナラ
// ==============================

function finishGame({walkoff=false}={}){

  gameState.isFinished=true;

  // 「最終回裏が未実施ならx」の判定は、parseScoreboard()が
  // 試合結果表から直接読み取って既に反映済みのため、ここでは行わない。

  const cell=gameState.scoreboard[gameState.inning]?.[gameState.half];

  if(cell){

    if(walkoff){

      // 例：9回裏 5x
      cell.status="walkoff";

    }else if(cell.status==="live"){

      cell.status="done";

    }

  }

}

// ==============================
// 現在スコア
// ==============================

function getCurrentScore(){

  return{

    away:gameState.scoreboard.total.away.R,
    home:gameState.scoreboard.total.home.R

  };

}

// ==============================
// カード管理
// ==============================

function setCards(cards){

  gameState.cards=cards;
  gameState.currentCard=0;

}

function nextCard(){

  if(gameState.currentCard<gameState.cards.length-1){

    gameState.currentCard++;

  }

}

function prevCard(){

  if(gameState.currentCard>0){

    gameState.currentCard--;

  }

}

function getCurrentCard(){

  return gameState.cards[gameState.currentCard];

}

// ==============================
// 試合読込時のリセット
// ==============================

function resetGameState(){

  gameState.currentCard=0;
  gameState.cards=[];

  gameState.inning=1;
  gameState.half="top";
  gameState.maxInning=9;

  gameState.outs=0;
  gameState.runners=[];

  gameState.isFinished=false;

  gameState.scoreboard={};

  gameState.firstCard={
    top:{},
    bottom:{}
  };

}

// ==============================
// カード用スナップショット生成
// ==============================

function createSnapshot(){

  return{

    scoreboard:structuredClone(gameState.scoreboard),
    inning:gameState.inning,
    half:gameState.half,
    outs:gameState.outs,
    runners:[...gameState.runners],
    score:getCurrentScore(),
    isFinished:gameState.isFinished

  };

}