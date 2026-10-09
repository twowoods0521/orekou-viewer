// ==============================
// app.js
// ビューア本体
// ==============================

// ------------------------------
// DOM
// ------------------------------

const cardContainer=document.getElementById("card-container");
const prevBtn=document.getElementById("prev-btn");
const nextBtn=document.getElementById("next-btn");

// ------------------------------
// 描画用の状態
// ------------------------------

let lockFinalScore=false;
let previousScore=null;

// ------------------------------
// 補助関数
// ------------------------------

function conditionClass(form){
  switch(form){
    case"絶好調": return"condition-great";
    case"好調":   return"condition-good";
    case"平常":   return"condition-normal";
    case"不調":   return"condition-bad";
    case"絶不調": return"condition-worst";
    case"静養":   return"condition-rest";
    default:      return"condition-normal";
  }
}

function rarityClass(rarity){
  return "rarity-"+(rarity||"").toLowerCase();
}

function splitHand(hand){
  const m=(hand||"").match(/^(.+?)投(.+?)打$/);

  if(!m)return{throwHand:"",batHand:""};

  return{throwHand:m[1],batHand:m[2]};
}

function renderPlayerLink(name,url){
  if(url){
    return `<a href="${url}" target="_blank" rel="noopener">${name}</a>`;
  }

  return name;
}

// 走者の表示:「名前・」を1つのかたまりにして、折り返しは「・」の直後だけにする
function renderRunners(runners){
  if(!runners.length)return "なし";

  return runners
    .map((r,i)=>`<span class="runner-unit">${r}${i<runners.length-1 ? "・" : ""}</span>`)
    .join("");
}

// 打席のそれまでの結果(打点がついた打席は赤文字)
function renderHistory(history){
  return (history||[])
    .map(h=>h.rbi
      ? `<span class="history-rbi">${h.short}</span>`
      : `<span>${h.short}</span>`)
    .join("");
}

// カードの文(名前がリンクになる部分を含む)
function renderLines(card){
  if(card.rich){
    return card.rich
      .map(segs=>segs
        .map(s=>s.n!==undefined ? renderPlayerLink(s.n,s.u) : s.t)
        .join(""))
      .join("<br>");
  }

  return card.text.join("<br>");
}

function renderLineupTable(lineup){
  const rows=(lineup||[]).map(player=>{
    const hand=splitHand(player.hand);

    return `
      <tr>
        <td>${player.order}</td>
        <td class="lineup-pos">${player.currentPosition||player.pos}</td>
        <td><span class="condition-dot ${conditionClass(player.form)}"></span></td>
        <td class="rarity ${rarityClass(player.rarity)}">${player.rarity}</td>
        <td class="lineup-name">${renderPlayerLink(player.name,player.url)}</td>
        <td>${hand.throwHand}</td>
        <td>${hand.batHand}</td>
      </tr>
    `;

  }).join("");

  return `
    <table class="lineup-table">
      <thead>
        <tr><th>打</th><th>守</th><th>調</th><th>才</th><th>選手</th><th>投</th><th>打</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ------------------------------
// ヘッダーのチーム名更新
// ------------------------------

function updateTeamHeader(){
  const awayNameEl=document.getElementById("away-name");
  const homeNameEl=document.getElementById("home-name");

  if(awayNameEl){
    awayNameEl.innerHTML=renderPlayerLink(gameData.away.teamName||"",gameData.away.teamUrl);
  }

  if(homeNameEl){
    homeNameEl.innerHTML=renderPlayerLink(gameData.home.teamName||"",gameData.home.teamUrl);
  }
}

// ------------------------------
// 得点強調(score-pop)
// ------------------------------

function flashScore(el){
  if(!el)return;

  el.classList.remove("score-pop");
  void el.offsetWidth;
  el.classList.add("score-pop");
}

function triggerScorePop(scoreSnap){
  if(previousScore){
    if(scoreSnap.score.away!==previousScore.away){
      flashScore(document.getElementById("away-score"));
    }

    if(scoreSnap.score.home!==previousScore.home){
      flashScore(document.getElementById("home-score"));
    }
  }

  previousScore={...scoreSnap.score};
}

// ------------------------------
// 描画
// snap     : 表示中のカードの状況(回・アウト・走者・ハイライト)
// scoreSnap: 得点板の数字と上部の得点
//            試合終了のカードを表示した後は、最終結果で固定する
// ------------------------------

function renderCard(){
  const card=getCurrentCard();

  if(!card)return;

  const snap=card.snapshot;

  const scoreSnap=lockFinalScore
    ? gameState.cards.at(-1).snapshot
    : snap;

  updateTeamHeader();
  updateStatus(snap,scoreSnap,card);
  renderScoreboard(scoreSnap,snap,card);
  triggerScorePop(scoreSnap);

  if(card.type==="start"){
    cardContainer.innerHTML=`

      <div class="card-type">試合開始</div>

      <h2>${renderPlayerLink(gameData.away.teamName||"",gameData.away.teamUrl)} vs ${renderPlayerLink(gameData.home.teamName||"",gameData.home.teamUrl)}</h2>

      <div class="opening-order">

        <div class="opening-team">

          <div class="opening-team-title">先攻　${gameData.away.teamName||""}</div>

          ${renderLineupTable(card.awayLineup)}

        </div>

        <div class="opening-team">

          <div class="opening-team-title">後攻　${gameData.home.teamName||""}</div>

          ${renderLineupTable(card.homeLineup)}

        </div>

      </div>

    `;
  }

  if(card.type==="batter"){
    const player=card.player;

    // 選手が見つからない場合は、試合経過の表記をそのまま1回だけ表示する
    const orderLabel=player
      ? (card.isPinchHit ? "代打" : `${player.order}番`)
      : "";

    const rarityHtml=player
      ? `<span class="batter-rarity rarity ${rarityClass(player.rarity)}">${player.rarity}</span>`
      : "";

    const nameHtml=player
      ? renderPlayerLink(player.name,player.url)
      : card.title;

    const hand=splitHand(player?.hand);

    const metaHtml=player
      ? `<span class="batter-meta">${hand.throwHand}投${hand.batHand}打・<span class="condition-dot ${conditionClass(player.form)}" style="vertical-align:-2px;"></span></span>`
      : "";

    const historyHtml=card.history&&card.history.length
      ? `<div class="batter-history"><span class="batter-history-label">ここまで:</span>${renderHistory(card.history)}</div>`
      : "";

    cardContainer.innerHTML=`

      <div class="card-type">打者</div>

      <div class="batter-info">

        ${orderLabel ? `<span class="batter-order">${orderLabel}</span>` : ""}

        ${rarityHtml}

        <span class="batter-name">${nameHtml}</span>

        ${metaHtml}

      </div>

      <div class="batter-runners">走者:${renderRunners(snap.runners)}</div>

      ${historyHtml}

    `;
  }

  if(card.type==="result"){
    cardContainer.innerHTML=`
      <div class="card-type">打席結果</div>
      <p>${renderLines(card)}</p>
    `;
  }

  if(card.type==="steal"){
    cardContainer.innerHTML=`
      <div class="card-type">盗塁</div>
      <p>${renderLines(card)}</p>
    `;
  }

  if(card.type==="pickoff"){
    cardContainer.innerHTML=`
      <div class="card-type">牽制</div>
      <p>${renderLines(card)}</p>
    `;
  }

  if(card.type==="offenseSub"){
    cardContainer.innerHTML=`
      <div class="card-type">${card.title}</div>
      <p>${renderLines(card)}</p>
    `;
  }

  if(card.type==="defense"){
    cardContainer.innerHTML=`
      <div class="card-type">守備交代</div>
      <p>${renderLines(card)}</p>
    `;
  }

  if(card.type==="pitcherChange"){
    cardContainer.innerHTML=`
      <div class="card-type">投手交代</div>
      <p>${renderLines(card)}</p>
    `;
  }

  if(card.type==="change"){
    cardContainer.innerHTML=`
      <div class="card-type">チェンジ</div>
      <h2>${card.text[0]}</h2>
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

// ------------------------------
// 得点板に表示する回数
// 9回までは常に表示し、延長戦は到達した回まで(試合終了後は行われた回まで)
// ------------------------------

function visibleInnings(scoreSnap){
  return Math.min(gameState.maxInning,Math.max(9,scoreSnap.inning));
}

// ------------------------------
// 得点板描画
// scoreSnap: 各回の得点・R/H/E
// snap     : 現在のイニングのハイライト
// ------------------------------

function renderScoreboard(scoreSnap,snap,card){
  const table=document.getElementById("scoreboard");
  const inningRow=document.getElementById("inning-row");
  const tbody=document.getElementById("scoreboard-body");

  // 延長戦の枠は、その回に入ったときに初めて表示する(最初は9回まで)
  const visible=visibleInnings(scoreSnap);

  // 延長なら横スクロール
  table.classList.toggle(
    "extra-innings",
    visible>9
  );

  // ---------- ヘッダー ----------

  inningRow.innerHTML="<th></th>";

  for(let i=1;i<=visible;i++){
    inningRow.innerHTML+=`<th>${i}</th>`;
  }

  inningRow.innerHTML+="<th>R</th><th>H</th><th>E</th>";

  // ---------- 行生成 ----------

  tbody.innerHTML=`
    <tr id="away-score-row"></tr>
    <tr id="home-score-row"></tr>
  `;

  const awayRow=document.getElementById("away-score-row");
  const homeRow=document.getElementById("home-score-row");

  awayRow.innerHTML=`<th>${renderPlayerLink(gameData.away.teamNameShort||"",gameData.away.teamUrl)}</th>`;
  homeRow.innerHTML=`<th>${renderPlayerLink(gameData.home.teamNameShort||"",gameData.home.teamUrl)}</th>`;

  // ---------- イニング ----------

  for(let i=1;i<=visible;i++){
    awayRow.innerHTML+=`
      <td data-inning="${i}" data-half="top">
        ${getScoreboardDisplayFromSnapshot(scoreSnap,i,"top")}
      </td>
    `;

    homeRow.innerHTML+=`
      <td data-inning="${i}" data-half="bottom">
        ${getScoreboardDisplayFromSnapshot(scoreSnap,i,"bottom")}
      </td>
    `;
  }

  // ---------- R H E ----------

  awayRow.innerHTML+=`
    <td>${scoreSnap.scoreboard.total.away.R}</td>
    <td>${scoreSnap.scoreboard.total.away.H}</td>
    <td>${scoreSnap.scoreboard.total.away.E}</td>
  `;

  homeRow.innerHTML+=`
    <td>${scoreSnap.scoreboard.total.home.R}</td>
    <td>${scoreSnap.scoreboard.total.home.H}</td>
    <td>${scoreSnap.scoreboard.total.home.E}</td>
  `;

  // ---------- ハイライト ----------

  highlightCurrentInning(scoreSnap,snap,card);

  // ---------- タップ ----------

  setupScoreboardJump();
}

// ------------------------------
// スナップショット用表示
// ------------------------------

function getScoreboardDisplayFromSnapshot(snapshot,inning,half){
  const cell=snapshot.scoreboard[inning]?.[half];

  if(!cell)return "";

  switch(cell.status){
    case "pending":
      return "";

    case "live":
      return cell.runs===0 ? "-" : String(cell.runs);

    case "done":
      return String(cell.runs);

    case "skip":
      return "×";

    case "walkoff":

      if(half==="bottom"){
        return `${cell.runs}x`;
      }

      return String(cell.runs);

    default:
      return "";
  }
}

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
  document
    .querySelectorAll("#scoreboard td[data-inning]")
    .forEach(cell=>{
      cell.onclick=()=>{
        jumpToHalf(
          Number(cell.dataset.inning),

          cell.dataset.half
        );
      };
    });
}

// ------------------------------
// 上部の表示・アウト・走者
// ------------------------------

function updateStatus(snap,scoreSnap,card){
  let inningText;

  if(card.type==="start"){
    inningText="試合開始";

  }else if(card.type==="end"){
    inningText="試合終了";

  }else{
    inningText=`${snap.inning}回${snap.half==="top"?"表":"裏"}`;
  }

  document.getElementById("inning-display").textContent=inningText;

  document.getElementById("away-score").textContent=scoreSnap.score.away;
  document.getElementById("home-score").textContent=scoreSnap.score.home;

  document.getElementById("out-text").textContent=`${snap.outs} OUT`;

  const lights=document.querySelectorAll(".light");

  lights.forEach((light,index)=>{
    light.classList.toggle("on",index<snap.outs);
  });

  document.getElementById("runner-text").innerHTML=renderRunners(snap.runners);
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
// 表・裏を区別。開始・終了カード、範囲外の回、
// まだ始まっていない枠にはハイライトを付けない
// ------------------------------

function highlightCurrentInning(scoreSnap,snap,card){
  document
    .querySelectorAll(".current-inning,.current-inning-header")
    .forEach(cell=>{
      cell.classList.remove("current-inning");
      cell.classList.remove("current-inning-header");
    });

  if(card.type==="start"||card.type==="end")return;

  const inning=snap.inning;

  if(inning<1||inning>visibleInnings(scoreSnap))return;

  const cell=scoreSnap.scoreboard[inning]?.[snap.half];

  if(!cell||cell.status==="pending"||cell.status==="skip")return;

  const headerRow=document.getElementById("inning-row");
  const awayRow=document.getElementById("away-score-row");
  const homeRow=document.getElementById("home-score-row");

  // TEAM列が0番なのでイニング番号と同じインデックスになる
  const index=inning;

  // ヘッダーは現在イニングを強調
  if(headerRow.children[index]){
    headerRow.children[index].classList.add("current-inning-header");
  }

  // 攻撃側だけハイライト
  if(snap.half==="top"){
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