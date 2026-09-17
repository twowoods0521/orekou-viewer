// ==============================
// parser.js
// 俺の甲子園 試合データ取得
// ==============================

const WORKER_URL="https://YOUR-WORKER.workers.dev/?url=";

// ------------------------------
// URL読込
// ------------------------------

async function loadGame(url){

  lockFinalScore=false;

  try{

    const html=await fetchGameHTML(url);

    const gameData=parseGameHTML(html,url);

    console.log("取得成功",gameData);

    return gameData;

  }catch(error){

    alert("試合データを取得できませんでした");

    console.error(error);

  }

}

// ------------------------------
// HTML取得
// ------------------------------

async function fetchGameHTML(url){

  const response=await fetch(
    WORKER_URL+encodeURIComponent(url)
  );

  if(!response.ok){

    throw new Error("HTML取得失敗");

  }

  return await response.text();

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

  const title=
    doc.querySelector("title")?.textContent.trim() || "";

  const teamNames=[
    ...doc.querySelectorAll("h2,h3,.team")
  ];

  return{

    title,
    away:teamNames[0]?.textContent.trim() || "先攻",
    home:teamNames[1]?.textContent.trim() || "後攻"

  };

}

// ------------------------------
// 得点板
// ------------------------------

function parseScoreboard(doc){

  const tables=[...doc.querySelectorAll("table")];

  const scoreTable=tables.find(table=>{

    const text=table.textContent;

    return text.includes("H")&&text.includes("E");

  });

  if(!scoreTable){

    return null;

  }

  const rows=[...scoreTable.querySelectorAll("tr")];

  return rows.map(row=>

    [...row.querySelectorAll("th,td")].map(cell=>

      cell.textContent.trim()

    )

  );

}

// ------------------------------
// オーダー取得
// ------------------------------

function parseLineup(doc,index){

  const tables=[...doc.querySelectorAll("table")];

  const lineupTables=tables.filter(table=>{

    const text=table.textContent;

    return text.includes("投")&&text.includes("打");

  });

  const target=lineupTables[index];

  if(!target){

    return [];

  }

  const rows=[...target.querySelectorAll("tr")];

  return rows.slice(1).map(row=>{

    const cells=[...row.querySelectorAll("td")];

    return{

      order:cells[0]?.textContent.trim(),
      position:cells[1]?.textContent.trim(),
      condition:cells[2]?.textContent.trim(),
      rarity:cells[3]?.textContent.trim(),
      name:cells[4]?.textContent.trim(),
      bats:cells[5]?.textContent.trim()

    };

  });

}

// ------------------------------
// 試合経過取得
// ------------------------------

function parsePlayByPlay(doc){

  const headings=[...doc.querySelectorAll("h2,h3,h4,strong")];

  const target=headings.find(node=>

    node.textContent.includes("試合経過")

  );

  if(!target){

    return[];

  }

  const events=[];

  let node=target.nextElementSibling;

  while(node){

    if(/^(戦評|個人成績|オーダー)/.test(node.textContent.trim())){
  break;
     }

    const text=node.textContent.trim();

    if(text){

      events.push(text);

    }

    node=node.nextElementSibling;

  }

  return events;

}

// ------------------------------
// ボタン接続
// ------------------------------

document
  .getElementById("load-game-btn")
  ?.addEventListener("click",async()=>{

    const url=document
      .getElementById("game-url")
      .value
      .trim();

    if(!url){

      alert("URLを入力してください");

      return;

    }

    await loadGame(url);

  });