// ==============================
// parser.js
// 俺の甲子園 パーサー
// ==============================

const WORKER_URL="https://YOUR-WORKER.workers.dev/?url=";

// ------------------------------
// URL読込
// ------------------------------

async function loadGame(url){

  lockFinalScore=false;

  try{

    resetGameState();

    const html=await fetchGameHTML(url);

    const gameData=parseGameHTML(html,url);

    const cards=buildCards(gameData);

    setCards(cards);

    renderCard();

  }catch(error){

    alert("試合データを取得できませんでした");

    console.error(error);

  }

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

  return{

    url,

    game:parseGameInfo(doc),

    scoreboard:parseScoreboard(doc),

    awayLineup:parseLineup(doc,0),

    homeLineup:parseLineup(doc,1),

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
        cell.walkoff=false;

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
// オーダー取得
// ------------------------------

function parseLineup(doc,index){

  const tables=[...doc.querySelectorAll("table")];

  const lineupTable=tables.filter(table=>

    table.textContent.includes("打順")&&
    table.textContent.includes("名前")

  )[index];

  if(!lineupTable)return[];

  const rows=[...lineupTable.querySelectorAll("tr")].slice(1);

  return rows.map(row=>{

    const cells=[...row.querySelectorAll("td")];

    return{

      order:Number(cells[0]?.textContent.trim()||0),

      pos:cells[1]?.textContent.trim()||"",

      form:cells[2]?.textContent.trim()||"",

      rarity:cells[3]?.textContent.trim()||"",

      name:cells[4]?.textContent.trim()||"",

      hand:cells[5]?.textContent.trim()||"",

      history:[]

    };

  });

}

// ------------------------------
// 試合経過取得
// ------------------------------

function parsePlayByPlay(doc){

  const header=parseInningHeader(line);

  if(header){

   startHalf(header.inning,header.half);

   continue;

  }

  const heading=[...doc.querySelectorAll("h2,h3,strong")]

    .find(node=>node.textContent.includes("試合経過"));

  if(!heading)return[];

  const lines=[];

  let node=heading.nextElementSibling;

  while(node){

    const text=node.textContent.trim();

    // 「戦評」「個人成績」「オーダー」のいずれかの見出しが来たら
    // そこで打ち切る（この見出し行自体はlinesに含めない）
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
// カード生成
// ==============================

function buildCards(gameData){

  const cards=[];

  cards.push({

    type:"start",

    game:gameData.game,

    awayLineup:gameData.awayLineup,

    homeLineup:gameData.homeLineup,

    snapshot:createSnapshot()

  });

  const plateBuffer=[];

  const defenseBuffer=[];

  for(const line of gameData.playByPlay){

    // --------------------------
    // 守備交代
    // --------------------------

    const defense=extractSpecial(line);

    if(

      defense&&

      [

        "pinchHitter",

        "pinchRunner",

        "stayDefense",

        "positionSub",

        "positionChange",

        "pitcherChange"

      ].includes(defense.type)

    ){

      defenseBuffer.push(line);

      continue;

    }

    if(defenseBuffer.length){

      cards.push(buildDefenseCard(defenseBuffer));

      defenseBuffer.length=0;

    }

    // --------------------------
    // 打席バッファ
    // --------------------------

    if(isNewBatter(line)&&plateBuffer.length){

      cards.push(...finalizePlateAppearance(plateBuffer,cards.length));

      plateBuffer.length=0;

    }

    plateBuffer.push(line);

  }

  if(plateBuffer.length){

    cards.push(...finalizePlateAppearance(plateBuffer,cards.length));

  }

  cards.push({

    type:"end",

    snapshot:createSnapshot()

  });

  return cards;

}

// ==============================
// 新しい打者判定
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

  const batter=lines[0].match(/^(.+?)が/)?.[1]||"";

  cards.push({

    type:"batter",

    title:batter,

    snapshot:createSnapshot()

  });

  registerJump(baseIndex+cards.length-1);

  let result=null;

  let position=null;

  const display=[];

  const steals=[];

  let totalScore=0;

  for(const event of events){

    display.push(event.text);

    if(event.position){

      position=event.position;

    }

    if(event.type==="score"){

      totalScore+=event.score||0;

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

      case"doublePlay":
        result={

          ...event,

          abbr:position+"併殺"

        };
        break;

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
        break;

      default:
        if(!result){

          result=event;

        }

    }

  }

  if(totalScore>0){

    const team=gameState.half==="top"
      ?"away"
      :"home";

    addRuns(team,totalScore);

    for(let i=0;i<totalScore;i++){

      gameState.runners.pop();

    }

  }

  applyEventToState(result,batter);

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

  return cards;

}


function applyEventToState(event,batter){

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

  if(gameState.outs>=3){

    advanceHalf();
    
  }

}

function advanceHalf(){

  if(gameState.half==="top"){

    startHalf(gameState.inning,"bottom");

  }else{

    startHalf(gameState.inning+1,"top");

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
// 守備交代カード
// ==============================

function buildDefenseCard(lines){

  const stayMap={};

  const output=[];

  lines.forEach(line=>{

    const stay=line.match(/代(?:打|走)で出た(.+?)、そのまま(.+?)手の守備につく/);

    if(stay){

      stayMap[stay[1]]=stay[2];

      return;

    }

    const sub=line.match(/(.+?)手の(.+?)を(.+?)に交代/);

    if(sub){

      const[,pos,outPlayer,inPlayer]=sub;

      if(stayMap[outPlayer]){

        output.push(

          `${outPlayer}に代わり${inPlayer}が${pos}`

        );

        delete stayMap[outPlayer];

      }else{

        output.push(

          `${outPlayer}に代わり${inPlayer}が${pos}`

        );

      }

      return;

    }

    const move=line.match(/(.+?)を(.+?)手に守備位置変更/);

    if(move){

      output.push(

        `${move[1]}　${move[2]}へ`

      );

      return;

    }

    const pitcher=line.match(/(.+?)に代え、(.+?)が登板/);

    if(pitcher){

      output.push(

        `${pitcher[1]}に代わり${pitcher[2]}が登板`

      );

    }

  });

  Object.entries(stayMap).forEach(([player,pos])=>{

  output.push(`${player}　${pos}へ`);

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