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

  // 試合結果表で「x」(未実施)になっている枠 [{inning, half}]
  // 試合終了のカードで初めて得点板に反映する
  skipCells: [],

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
// 未実施(x)の枠かどうか
// ==============================

function isSkipCell(inning,half){
  return gameState.skipCells.some(
    c=>c.inning===inning&&c.half===half
  );
}

// ==============================
// 攻撃開始
// ==============================

function startHalf(inning,half){
  gameState.inning=inning;
  gameState.half=half;

  // 万一inningが得点板の範囲外になっても、例外で止まらないようにする
  const cell=gameState.scoreboard[inning]?.[half];

  if(cell&&cell.status==="pending"&&!isSkipCell(inning,half)){
    cell.status="live";
  }
}

// ==============================
// 得点
// ==============================

function addRuns(side,runs){
  const cell=gameState.scoreboard[gameState.inning]?.[gameState.half];

  if(cell){
    cell.runs+=runs;
    cell.status="live";
  }

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
// 次の攻撃(回・表裏)
// ==============================

function getNextHalf(){
  if(gameState.half==="bottom"){
    return{inning:gameState.inning+1,half:"top"};
  }

  return{inning:gameState.inning,half:"bottom"};
}

// 次の攻撃があるか(最終回の裏が終わった・未実施の裏になる場合はfalse)
function hasNextHalf(){
  const next=getNextHalf();

  return !(next.inning>gameState.maxInning||isSkipCell(next.inning,next.half));
}

// ==============================
// 3アウトでその回の攻撃が終わった(枠を「終了」にする)
// ==============================

function endHalf(){
  const cell=gameState.scoreboard[gameState.inning]?.[gameState.half];

  if(cell&&cell.status==="live"){
    cell.status="done";
  }
}

// ==============================
// イニング終了(チェンジ)
// 次の攻撃が無い場合は最後の攻撃に留まり、アウトカウントは3のままにする
// ==============================

function changeHalf(){
  endHalf();

  clearRunners();

  if(!hasNextHalf()){
    return;
  }

  const next=getNextHalf();

  gameState.outs=0;

  startHalf(next.inning,next.half);
}

// ==============================
// 試合終了
// walkoff=trueならサヨナラ
// ==============================

function finishGame({walkoff=false}={}){
  gameState.isFinished=true;

  const cell=gameState.scoreboard[gameState.inning]?.[gameState.half];

  if(cell){
    if(walkoff){
      // 例:9回裏 5x
      cell.status="walkoff";

    }else if(cell.status==="live"){
      cell.status="done";
    }
  }

  // 「未実施(x)」の枠は、ここで初めて反映する
  gameState.skipCells.forEach(c=>{
    const target=gameState.scoreboard[c.inning]?.[c.half];

    if(target){
      target.status="skip";
      target.runs=0;
    }
  });
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

  gameState.skipCells=[];

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