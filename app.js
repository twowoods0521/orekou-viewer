// ==============================
// app.js
// 仮ビューア
// ==============================

// ------------------------------
// 仮データ
// ------------------------------

initializeScoreboard(9);

// ------------------------------
// サンプルスタメン
// parser.js完成後はオーダーから自動生成
// ------------------------------

const sampleAwayLineup = [
  {order:1,pos:"中",name:"近藤"},
  {order:2,pos:"二",name:"小栗"},
  {order:3,pos:"左",name:"菅原"},
  {order:4,pos:"一",name:"藤本"},
  {order:5,pos:"捕",name:"松岡"},
  {order:6,pos:"右",name:"関谷"},
  {order:7,pos:"三",name:"倉林"},
  {order:8,pos:"投",name:"田山"},
  {order:9,pos:"遊",name:"結崎"}
];

const sampleHomeLineup = [
  {order:1,pos:"中",name:"西川"},
  {order:2,pos:"遊",name:"吉留"},
  {order:3,pos:"左",name:"伊藤"},
  {order:4,pos:"一",name:"山田"},
  {order:5,pos:"捕",name:"中村"},
  {order:6,pos:"右",name:"佐藤"},
  {order:7,pos:"三",name:"高橋"},
  {order:8,pos:"投",name:"鈴木"},
  {order:9,pos:"二",name:"森"}
];

const sampleCards = [

  {
    type:"start",
    snapshot:{
      scoreboard:strocturedClone(gameState.scoreboard),
      inning:1,
      half:"top",
      outs:0,
      runners:[],
      score:{away:0,home:0}
    }
  },

  {
    type:"batter",
    title:"1番：近藤",
    history:"",
    snapshot:{
      scoreboard:structuredClone(gameState.scoreboard),
      inning:1,
      half:"top",
      outs:0,
      runners:[],
      score:{away:0,home:0}
    }
  }

];

startHalf(1,"top");
addHit("away");
setRunners(["近藤"]);

sampleCards.push({
  type:"result",
  text:[
    "近藤がレフト前ヒット。"
  ],
  snapshot:{
    scoreboard:structuredClone(gameState.scoreboard),
    inning:1,
    half:"top",
    outs:0,
    runners:["近藤"],
    score:getCurrentScore()
  }
});

setOuts(1);
setRunners(["小栗"]);

sampleCards.push({
  type:"result",
  text:[
    "小栗が送りバント。",
    "1アウト"
  ],
  snapshot:{
    scoreboard:structuredClone(gameState.scoreboard),
    inning:1,
    half:"top",
    outs:1,
    runners:["小栗"],
    score:getCurrentScore()
  }
});

addRuns("away",1);

sampleCards.push({
  type:"result",
  text:[
    "菅原がセンター前ヒット。",
    "小栗が生還し1点。",
    "結崎1-0西西"
  ],
  snapshot:{
    scoreboard:structuredClone(gameState.scoreboard),
    inning:1,
    half:"top",
    outs:1,
    runners:["菅原"],
    score:getCurrentScore()
  }
});

sampleCards.push({
  type:"steal",
  text:["菅原が盗塁成功。"],
  snapshot:{
    scoreboard:structuredClone(gameState.scoreboard),
    inning:1,
    half:"top",
    outs:1,
    runners:["菅原"],
    score:getCurrentScore()
  }
});

sampleCards.push({
  type:"defense",
  text:[
    "田山に代わり藤島が中堅",
    "藤本　遊撃へ",
    "菅原　左翼へ"
  ],
  snapshot:{
    scoreboard:structuredClone(gameState.scoreboard),
    inning:2,
    half:"bottom",
    outs:0,
    runners:[],
    score:getCurrentScore()
  }
});

finishGame();

sampleCards.push({
  type:"end",
  snapshot:{
    scoreboard:structuredClone(gameState.scoreboard),
    inning:9,
    half:"top",
    outs:3,
    runners:[],
    score:getCurrentScore(),
    isFinished:true
  }
});

setCards(sampleCards);
// ------------------------------
// サンプル用ジャンプ位置
// （parser.js完成後は自動生成される）
// ------------------------------

gameState.firstCard.top = {
  1: 0,
  2: 6
};

gameState.firstCard.bottom = {
  1: 5,
  2: 6
};

// ------------------------------
// DOM
// ------------------------------

const cardContainer=document.getElementById("card-container");
const prevBtn=document.getElementById("prev-btn");
const nextBtn=document.getElementById("next-btn");

// ------------------------------
// 描画
// ------------------------------

let lockFinalScore=false;

function renderCard(){

  const card=getCurrentCard();
  const snap=lockFinalScore
    ? gameState.cards.at(-1).snapshot
    : card.snapshot;

  updateStatus(snap);
  highlightCurrentInning(snap);

  // ------------------------------
// 得点板セルタップジャンプ
// ------------------------------

function jumpToHalf(inning, half){

  const target = gameState.firstCard[half][inning];

  if(target === undefined) return;

  gameState.currentCard = target;
  renderCard();

}

function setupScoreboardJump(){

  const awayRow = document.getElementById("away-score-row");
  const homeRow = document.getElementById("home-score-row");

  // TEAM列(0)とR/H/Eを除き、イニングセルだけ設定
  for(let inning = 1; inning <= gameState.maxInning; inning++){

    if(awayRow.children[inning]){

      awayRow.children[inning].onclick = () => jumpToHalf(inning,"top");

    }

    if(homeRow.children[inning]){

      homeRow.children[inning].onclick = () => jumpToHalf(inning,"bottom");

    }

  }

}

  if(card.type==="start"){

  const awayRows = sampleAwayLineup.map(player=>`
    <tr>
      <td>${player.order}</td>
      <td>${player.pos}</td>
      <td>${player.name}</td>
    </tr>
  `).join("");

  const homeRows = sampleHomeLineup.map(player=>`
    <tr>
      <td>${player.order}</td>
      <td>${player.pos}</td>
      <td>${player.name}</td>
    </tr>
  `).join("");

  cardContainer.innerHTML=`

    <div class="card-type">試合開始</div>

    <h2>結崎 vs 西西</h2>

    <div class="opening-subtitle">

      練習試合

    </div>

    <div class="opening-score">

      <span>結崎</span>

      <span>0 - 0</span>

      <span>西西</span>

    </div>

    <div class="opening-order">

      <div class="opening-team">

        <div class="opening-team-title">

          先攻　結崎

        </div>

        <table class="order-table">

          <tbody>

            ${awayRows}

          </tbody>

        </table>

      </div>

      <div class="opening-team">

        <div class="opening-team-title">

          後攻　西西

        </div>

        <table class="order-table">

          <tbody>

            ${homeRows}

          </tbody>

        </table>

      </div>

    </div>

  `;

}

    cardContainer.innerHTML=`
      <div class="card-type">試合開始</div>
      <h2>結崎 vs 西西</h2>
      <p>練習試合</p>
    `;

  }

  if(card.type==="batter"){

    cardContainer.innerHTML=`
      <div class="card-type">打者</div>
      <h2>${card.title}</h2>
      <div class="batter-history">${card.history}</div>
    `;

  }

  if(card.type==="result"){

    cardContainer.innerHTML=`
      <div class="card-type">打席結果</div>
      <p>${card.text.join("<br>")}</p>
    `;

  }

  if(card.type==="steal"){

    cardContainer.innerHTML=`
      <div class="card-type">盗塁</div>
      <p>${card.text.join("<br>")}</p>
    `;

  }

  if(card.type==="defense"){

    cardContainer.innerHTML=`
      <div class="card-type">守備交代</div>
      <p>${card.text.join("<br>")}</p>
    `;

  }

  if(card.type==="end"){

    cardContainer.innerHTML=`
      <div class="card-type">試合終了</div>
      <h2>試合終了</h2>
    `;

  }

  animateCard();

}

function updateStatus(snap){

  document.getElementById("inning-display").textContent=
    `${snap.inning}回${snap.half==="top"?"表":"裏"}`;

  document.getElementById("away-score").textContent=snap.score.away;
  document.getElementById("home-score").textContent=snap.score.home;

  const lights=document.querySelectorAll(".light");

  lights.forEach((light,index)=>{

    light.classList.toggle("on",index<snap.outs);

  });

  document.getElementById("runner-text").textContent=
    snap.runners.length
    ? snap.runners.join("・")
    : "なし";

}

// ------------------------------
// アニメーション
// ------------------------------

function animateCard(){

  cardContainer.classList.remove("slide-in");
  void cardContainer.offsetWidth;
  cardContainer.classList.add("slide-in");

}

// ------------------------------
// 現在イニングのハイライト
// 表・裏を区別
// ------------------------------

function highlightCurrentInning(snapshot){

  // 以前のハイライトを解除
  document
    .querySelectorAll(".current-inning,.current-inning-header")
    .forEach(cell=>{

      cell.classList.remove("current-inning");
      cell.classList.remove("current-inning-header");

    });

  const inning=snapshot.inning;

  const headerRow=document.getElementById("inning-row");
  const awayRow=document.getElementById("away-score-row");
  const homeRow=document.getElementById("home-score-row");

  // TEAM列が0番なのでイニング番号と同じインデックスになる
  const index=inning;

  // ヘッダーは常に現在イニングを強調
  if(headerRow.children[index]){
    headerRow.children[index].classList.add("current-inning-header");
  }

  // 攻撃側だけハイライト
  if(snapshot.half==="top"){

    if(awayRow.children[index]){
      awayRow.children[index].classList.add("current-inning");
    }

  }else{

    if(homeRow.children[index]){
      homeRow.children[index].classList.add("current-inning");
    }

  }

}
// ------------------------------
// ボタン
// ------------------------------

prevBtn.onclick=()=>{

  prevCard();
  renderCard();

};

nextBtn.onclick=()=>{

  nextCard();

  if(gameState.currentCard===gameState.cards.length-1){

    lockFinalScore=true;

  }

  renderCard();

};

setupScoreboardJump();
renderCard();