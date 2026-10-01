// ==============================
// parser.js
// 俺の甲子園 パーサー
// ==============================

const WORKER_URL="https://orekou-proxy.twowoods0521.workers.dev/?url=";

// ------------------------------
// URL読込
// ------------------------------

async function loadGame(url){

  lockFinalScore=false;

  try{

    resetGameState();
    resetTeamData();

    const html=await fetchGameHTML(url);

    const matchData=parseGameHTML(html,url);

    gameData.away.teamName=matchData.teamNames.away?.name||"";
    gameData.away.teamNameShort=shortenTeamName(gameData.away.teamName);
    gameData.away.teamUrl=matchData.teamNames.away?.url||"";

    gameData.home.teamName=matchData.teamNames.home?.name||"";
    gameData.home.teamNameShort=shortenTeamName(gameData.home.teamName);
    gameData.home.teamUrl=matchData.teamNames.home?.url||"";

    setLineup("away",matchData.awayLineup);
    setBench("away",matchData.awayBench);
    setLineup("home",matchData.homeLineup);
    setBench("home",matchData.homeBench);

    const cards=buildCards(matchData);

    setCards(cards);

    renderCard();

  }catch(error){

    alert("試合データを取得できませんでした" + error.message);

    console.error(error);

  }

}

// チーム名の冒頭2文字(得点板用の略称)
function shortenTeamName(name){

  if(!name)return"";

  return name.length<=2 ? name : name.slice(0,2);

}

// ------------------------------
// HTML取得
// ------------------------------

async function fetchGameHTML(url){

  const res=await fetch(
    WORKER_URL+encodeURIComponent(url)
  );

  if(!res.ok){

    throw new Error("HTML取得失敗");

  }

  return await res.text();

}

// ------------------------------
// HTML解析
// ------------------------------

function parseGameHTML(html,url){

  const doc=new DOMParser().parseFromString(
    html,
    "text/html"
  );

  const awayData=parseLineup(doc,0);
  const homeData=parseLineup(doc,1);

  return{

    url,

    game:parseGameInfo(doc),

    scoreboard:parseScoreboard(doc),

    teamNames:parseTeamNames(doc),

    awayLineup:awayData.lineup,
    awayBench:awayData.bench,

    homeLineup:homeData.lineup,
    homeBench:homeData.bench,

    playByPlay:parsePlayByPlay(doc)

  };

}

// ------------------------------
// 試合情報
// ------------------------------

function parseGameInfo(doc){

  return{

    title:doc.querySelector("title")?.textContent.trim()

  };

}

// ------------------------------
// チーム名(行政区分・学校種別を除いた略称)+ リンク
// 得点結果の「◯◯ 数字 - 数字 ◯◯」の行にある
// 直近の2つのaタグをチーム名として取得する
// ------------------------------

function parseTeamNames(doc){

  const elements=[...doc.querySelectorAll("body *")];

  const target=elements.find(el=>{

    const links=el.querySelectorAll(":scope > a");

    if(links.length<2)return false;

    return /\d+\s*-\s*\d+/.test(el.textContent);

  });

  if(!target){

    return{away:null,home:null};

  }

  const links=[...target.querySelectorAll(":scope > a")];

  return{

    away:{
      name:links[0]?.textContent.trim()||"",
      url:links[0]?.getAttribute("href")||""
    },

    home:{
      name:links[1]?.textContent.trim()||"",
      url:links[1]?.getAttribute("href")||""
    }

  };

}

// ------------------------------
// 得点板取得
// ------------------------------

function parseScoreboard(doc){

  const tables=[...doc.querySelectorAll("table")];

  const board=tables.find(table=>

    table.textContent.includes("H")&&
    table.textContent.includes("E")

  );

  if(!board)return null;

  const rows=[...board.querySelectorAll("tr")];

  const inningCount=rows[0].querySelectorAll("th,td").length-4;

  initializeScoreboard(inningCount);

  const teams=["away","home"];

  rows.slice(1,3).forEach((row,index)=>{

    const cells=[...row.querySelectorAll("td")];

    const team=teams[index];

    for(let i=1;i<=inningCount;i++){

      const text=cells[i-1]?.textContent.trim()||"";

      const cell=gameState.scoreboard[i][team==="away"?"top":"bottom"];

      if(text===""){

        cell.status="pending";

      }else if(text==="×"){

        cell.status="skip";
        cell.runs=0;

      }else if(text.endsWith("×")){

        cell.status="walkoff";
        cell.runs=Number(text.replace("×",""));

        if(i>gameState.maxInning){

          gameState.maxInning=i;

        }

      }else{

        cell.status="done";
        cell.runs=Number(text);

      }

    }

    const total=cells.slice(-3);

    gameState.scoreboard.total[team]={

      R:Number(total[0]?.textContent||0),
      H:Number(total[1]?.textContent||0),
      E:Number(total[2]?.textContent||0)

    };

  });

  return structuredClone(gameState.scoreboard);

}

// ------------------------------
// オーダー取得(スタメン+ベンチ)
// ------------------------------

function parseLineup(doc,index){

  const tables=[...doc.querySelectorAll("table")];

  const lineupTable=tables.filter(table=>

    table.textContent.includes("選手")&&
    table.textContent.includes("守")

  )[index];

  if(!lineupTable)return{lineup:[],bench:[]};

  const rows=[...lineupTable.querySelectorAll("tr")].slice(1);

  const lineup=[];
  const bench=[];
  let inBench=false;

  rows.forEach(row=>{

    const cells=[...row.querySelectorAll("td")];

    // 「+ベンチ」の行は列数が少ない見出し行なので、ここでベンチ扱いに切り替える
    if(cells.length<6){

      inBench=true;
      return;

    }

    const orderText=cells[0]?.textContent.trim()||"";
    const nameCell=cells[4];
    const nameLink=nameCell?.querySelector("a");

    const player={

      order:orderText==="-" ? "-" : Number(orderText||0),

      pos:cells[1]?.textContent.trim()||"",

      form:cells[2]?.textContent.trim()||"",

      rarity:cells[3]?.textContent.trim()||"",

      name:nameCell?.textContent.trim()||"",

      url:nameLink?.getAttribute("href")||"",

      hand:`${cells[5]?.textContent.trim()||""}投${cells[6]?.textContent.trim()||""}打`

    };

    if(inBench){

      bench.push(player);

    }else{

      lineup.push(player);

    }

  });

  return{lineup,bench};

}

// ------------------------------
// 試合経過取得
// ------------------------------

function parsePlayByPlay(doc){

  const heading=[...doc.querySelectorAll("h2,h3,strong")]

    .find(node=>node.textContent.includes("試合経過"));

  if(!heading)return[];

  const lines=[];

  let node=heading.nextElementSibling;

  while(node){

    const text=node.textContent.trim();

    // 「戦評」「個人成績」「オーダー」のいずれかの見出しが来たら
    // そこで打ち切る(この見出し行自体はlinesに含めない)
    if(/^(戦評|個人成績|オーダー)/.test(text)){

      break;

    }

    if(text){

      lines.push(text);

    }

    node=node.nextElementSibling;

  }

  return lines;

}

// ==============================
// side判定用ヘルパー
// ==============================

function battingSideOf(half){

  return half==="top" ? "away" : "home";

}

function fieldingSideOf(half){

  return half==="top" ? "home" : "away";

}

// ==============================
// カード生成
// ==============================

function buildCards(matchData){

  const cards=[];

  cards.push({

    type:"start",

    game:matchData.game,

    awayLineup:gameData.away.lineup,
    homeLineup:gameData.home.lineup,

    snapshot:createSnapshot()

  });

  const plateBuffer=[];
  const defenseBuffer=[]; // { line, half } の配列

  const flushPlate=()=>{

    if(plateBuffer.length){

      cards.push(...finalizePlateAppearance(plateBuffer.splice(0),cards.length));

    }

  };

  const flushDefense=()=>{

    if(defenseBuffer.length){

      cards.push(buildDefenseCard(defenseBuffer.splice(0)));

    }

  };

  for(const line of matchData.playByPlay){

    // --------------------------
    // イニング見出し
    // --------------------------

    const header=parseInningHeader(line);

    if(header){

      flushPlate();
      flushDefense();

      startHalf(header.inning,header.half);

      continue;

    }

    // --------------------------
    // 守備交代・代打・代走の宣言
    // --------------------------

    const special=extractSpecial(line);

    if(

      special&&

      [

        "pinchHitter",

        "pinchRunner",

        "stayDefense",

        "positionSub",

        "positionChange",

        "pitcherChange"

      ].includes(special.type)

    ){

      defenseBuffer.push({line,half:gameState.half});

      continue;

    }

    if(defenseBuffer.length){

      flushDefense();

    }

    // --------------------------
    // 打席バッファ
    // --------------------------

    if(isNewBatter(line)&&plateBuffer.length){

      flushPlate();

    }

    plateBuffer.push(line);

  }

  flushPlate();
  flushDefense();

  // 3アウトを待たずに試合経過が終わっている場合はサヨナラ
  finishGame({walkoff:!lastHalfChanged});

  cards.push({

    type:"end",

    snapshot:createSnapshot()

  });

  return cards;

}

// ==============================
// イニング見出し判定
// ==============================

function parseInningHeader(line){

  const m=line.match(/^(\d+)回([表裏])$/);

  if(!m)return null;

  return{

    inning:Number(m[1]),

    half:m[2]==="表"
      ?"top"
      :"bottom"

  };

}

// ==============================
// 新しい打者判定
// ==============================

function isNewBatter(line){

  if(/^(一塁走者|二塁走者|三塁走者)の/.test(line)){
    return false;
  }

  if(/^打った/.test(line)){
    return false;
  }

  if(/生還し|進塁|タッチアップ|動けず/.test(line)){
  return false;
  }

  return /^[^　\s]+が/.test(line);

}

// ==============================
// 打席確定
// ==============================

function finalizePlateAppearance(lines,baseIndex){

  const cards=[];

  const events=lines.map(classifyLine);

  const side=battingSideOf(gameState.half);

  const runnersAtStart=gameState.runners.length;

  const rawToken=lines[0].match(/^(.+?)が/)?.[1]||"";

  const batterPlayer=findPlayerByToken(side,rawToken);

  cards.push({

    type:"batter",

    title:rawToken,

    player:batterPlayer,

    snapshot:createSnapshot()

  });

  registerJump(baseIndex+cards.length-1);

  // 得点は打席全体を通して先に集計しておく(満塁ゲッツーの判定に使うため)
  const totalScore=events

    .filter(e=>e.type==="score")

    .reduce((sum,e)=>sum+(e.score||0),0);

  let result=null;

  let position=null;

  const display=[];

  const steals=[];
  const pickoffs=[];
  const extraEvents=[]; // 盗塁・牽制死など、打者本人以外に影響するイベント

  for(const event of events){

    display.push(event.text);

    if(event.position){

      position=event.position;

    }

    if(event.type==="score"){

      continue;

    }

    switch(event.type){

      case"ground":
      case"fly":
      case"line":
        result=event;
        break;

      case"error":
        if(position){

          result={

            ...event,

            abbr:position+"失"

          };

        }
        break;

      case"doublePlay":{

        // 満塁かつこの打席で得点が無い場合のみ、前の走者(三塁走者)を消す
        const useFrontRunner=runnersAtStart===3&&totalScore===0;

        result={

          ...event,

          abbr:position+"併殺",

          removeRearRunner:!useFrontRunner,
          removeFrontRunner:useFrontRunner

        };

        break;

      }

      case"fielderChoiceDoublePlay":
        result={

          ...event,

          abbr:position+"ゴロ"

        };
        break;

      case"steal":
      case"caughtStealing":
      case"stealThird":
      case"caughtStealingThird":
        steals.push(event.text);
        extraEvents.push(event);
        break;

      case"pickoff":
        pickoffs.push(event.text);
        extraEvents.push(event);
        break;

      default:
        if(!result){

          result=event;

        }

    }

  }

  if(totalScore>0){

    addRuns(side,totalScore);

    for(let i=0;i<totalScore;i++){

      gameState.runners.pop();

    }

  }

  // 打者本人の結果を適用
  applyEventToState(result,rawToken);

  // 盗塁・牽制死など、打者以外に影響するイベントを順番に適用
  extraEvents.forEach(event=>{

    applyEventToState(event,null);

  });

  if(batterPlayer){

    addPlayerHistory(side,batterPlayer.order,{

      short:result?.abbr||"",
      rbi:totalScore

    });

  }

  cards.push({

    type:"result",

    text:display,
    result,

    snapshot:createSnapshot()

  });

  steals.forEach(text=>{

    cards.push({

      type:"steal",

      text:[text],

      snapshot:createSnapshot()

    });

  });

  pickoffs.forEach(text=>{

    cards.push({

      type:"pickoff",

      text:[text],

      snapshot:createSnapshot()

    });

  });

  return cards;

}


let lastHalfChanged=false;

function applyEventToState(event,batter){

  lastHalfChanged=false;

  if(!event)return;

  if(event.outs){

    setOuts(gameState.outs+event.outs);

  }

  if(event.removeRearRunner){

    gameState.runners.shift();

  }

  if(event.removeFrontRunner){

    gameState.runners.pop();

  }

  if(event.runner){

    gameState.runners.unshift(batter);

  }

  setRunners([...gameState.runners]);

  const battingSide=battingSideOf(gameState.half);
  const fieldingSide=fieldingSideOf(gameState.half);

  const hitTypes=[

    "hit","infieldHit","double","triple",
    "homeRun","buntHit","hitAndRun"

  ];

  if(hitTypes.includes(event.type)){

    addHit(battingSide);

  }

  if(event.type==="error"){

    addError(fieldingSide);

  }

  if(gameState.outs>=3){

    changeHalf();

    lastHalfChanged=true;

  }

}

// ==============================
// ジャンプ位置登録
// ==============================

function registerJump(cardIndex){

  const half=gameState.half;
  const inning=gameState.inning;

    if(gameState.firstCard[half][inning]===undefined){

      gameState.firstCard[half][inning]=cardIndex;

    }
 
}

// ==============================
// 守備交代カード(代打・代走の宣言も含む)
// ==============================

function buildDefenseCard(entries){

  const stayMap={};
  const output=[];

  entries.forEach(({line,half})=>{

    // 代打
    let m=line.match(/^(.+?)に代打、(.+?)！?$/);

    if(m){

      const[,outToken,inToken]=m;
      const side=battingSideOf(half);

      const outPlayer=findPlayerByToken(side,outToken);

      if(outPlayer){

        substitutePlayer(side,outPlayer.order,inToken);

      }

      output.push(`${outToken}に代打、${inToken}`);

      return;

    }

    // 代走
    m=line.match(/^(一塁|二塁|三塁)走者(.+?)に代走、(.+?)！?$/);

    if(m){

      const[,,outToken,inToken]=m;
      const side=battingSideOf(half);

      const outPlayer=findPlayerByToken(side,outToken);

      if(outPlayer){

        substitutePlayer(side,outPlayer.order,inToken);

      }

      const runnerIdx=gameState.runners.indexOf(outToken);

      if(runnerIdx!==-1){

        gameState.runners[runnerIdx]=inToken;
        setRunners([...gameState.runners]);

      }

      output.push(`${m[1]}走者${outToken}に代走、${inToken}`);

      return;

    }

    // 代打・代走で出た選手が、そのまま守備につく
    const stay=line.match(/代(?:打|走)で出た(.+?)、そのまま(.+?)手の守備につく/);

    if(stay){

      const[,token,pos]=stay;
      const side=fieldingSideOf(half);

      stayMap[token]=pos;

      const player=findPlayerByToken(side,token);

      if(player){

        updatePosition(side,player.order,pos);

      }

      return;

    }

    // 守備の選手交代(ベンチから新しい選手)
    const sub=line.match(/(.+?)手の(.+?)を(.+?)に交代/);

    if(sub){

      const[,pos,outToken,inToken]=sub;
      const side=fieldingSideOf(half);

      const outPlayer=findPlayerByToken(side,outToken);

      if(outPlayer){

        substitutePlayer(side,outPlayer.order,inToken);

      }

      delete stayMap[outToken];

      output.push(`${outToken}に代わり${inToken}が${pos}`);

      return;

    }

    // 守備位置変更(同じ選手のまま)
    const move=line.match(/(.+?)を(.+?)手に守備位置変更/);

    if(move){

      const[,token,pos]=move;
      const side=fieldingSideOf(half);

      const player=findPlayerByToken(side,token);

      if(player){

        updatePosition(side,player.order,pos);

      }

      output.push(`${token}　${pos}へ`);

      return;

    }

    // 登板(投手交代)
    const pitcher=line.match(/(.+?)に代え、(.+?)が登板/);

    if(pitcher){

      const[,outToken,inToken]=pitcher;
      const side=fieldingSideOf(half);

      const outPlayer=findPlayerByToken(side,outToken);

      if(outPlayer){

        const inPlayer=substitutePlayer(side,outPlayer.order,inToken);

        if(inPlayer){

          updatePosition(side,inPlayer.order,"投");

        }

      }

      output.push(`${outToken}に代わり${inToken}が登板`);

    }

  });

  Object.entries(stayMap).forEach(([token,pos])=>{

    output.push(`${token}　${pos}へ`);

  });

  return{

    type:"defense",

    text:output,

    snapshot:createSnapshot()

  };

}

// ------------------------------
// ボタン
// ------------------------------

document

  .getElementById("load-game-btn")

  ?.addEventListener("click",async()=>{

    const url=document

      .getElementById("game-url")

      .value.trim();

    if(!url)return;

    await loadGame(url);

  });