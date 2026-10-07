// ==============================
// parser.js
// 俺の甲子園 パーサー
// ==============================

const WORKER_URL="https://orekou-proxy.twowoods0521.workers.dev/?url=";
// ↑お使いの正しいWorker URLのまま維持してください

// 走者に関する出来事(盗塁・盗塁死・三盗・牽制死)
const RUNNER_EVENT_TYPES=[
  "steal","caughtStealing","stealThird","caughtStealingThird","pickoff"
];

// 守備・交代に関する行
const DEFENSE_TYPES=[
  "pinchHitter","pinchRunner","stayDefense",
  "positionSub","positionChange","pitcherChange"
];

// ------------------------------
// URL読込
// ------------------------------

async function loadGame(url){
  lockFinalScore=false;
  previousScore=null;

  try{
    resetGameState();
    resetTeamData();

    const html=await fetchGameHTML(url);

    const matchData=parseGameHTML(html,url);

    initializeScoreboard(matchData.maxInning);
    gameState.skipCells=matchData.skipCells;

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
    alert("試合データを取得できませんでした");

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
// 相対パスのリンクをorekou.net基準の絶対URLに変換する
// ------------------------------

function resolveOrekouUrl(href){
  if(!href)return"";

  try{
    return new URL(href,"https://orekou.net").href;

  }catch{
    return href;
  }
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

  const playByPlay=parsePlayByPlay(doc);

  const board=parseScoreboard(doc);

  // 得点板の回数は、試合経過に出てくる最大の回(最低9回)
  const lastInning=playByPlay.reduce((m,e)=>Math.max(m,e.inning),0);

  return{
    url,

    game:parseGameInfo(doc),

    teamNames:parseTeamNames(doc),

    skipCells:board.skipCells,

    maxInning:Math.max(9,lastInning),

    awayLineup:awayData.lineup,
    awayBench:awayData.bench,

    homeLineup:homeData.lineup,
    homeBench:homeData.bench,

    playByPlay
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
      url:resolveOrekouUrl(links[0]?.getAttribute("href"))
    },

    home:{
      name:links[1]?.textContent.trim()||"",
      url:resolveOrekouUrl(links[1]?.getAttribute("href"))
    }
  };
}

// ------------------------------
// 得点板(結果表)から「x」(未実施)の枠だけを読み取る
// 延長戦では表が2つ(1〜9回 / 10回以降)に分かれているため、
// 見出しの回数を基準に、すべての表を調べる。
// 各回の得点そのものは、カードをめくる再現の中で進めるため読まない。
// ------------------------------

function parseScoreboard(doc){
  const skipCells=[];

  [...doc.querySelectorAll("table")].forEach(table=>{
    if(table.textContent.includes("選手"))return;

    const rows=[...table.querySelectorAll("tr")];

    if(rows.length<3)return;

    const header=[...rows[0].querySelectorAll("th,td")]
      .map(c=>c.textContent.trim());

    if(header.filter(t=>/^\d+$/.test(t)).length<2)return;

    [rows[1],rows[2]].forEach((row,index)=>{
      const cells=[...row.querySelectorAll("th,td")]
        .map(c=>c.textContent.trim());

      // 見出しと列数が違う場合は、右端を基準にそろえる
      const offset=cells.length-header.length;

      header.forEach((h,c)=>{
        if(!/^\d+$/.test(h))return;

        if(cells[c+offset]==="x"){
          skipCells.push({
            inning:Number(h),
            half:index===0 ? "top" : "bottom"
          });
        }
      });
    });
  });

  return{skipCells};
}

// ------------------------------
// 調子(画像ファイル名c1〜c6から判定)
// c1〜c5:絶不調→絶好調 / c6:静養
// ------------------------------

const CONDITION_MAP={
  c1:"絶不調",
  c2:"不調",
  c3:"平常",
  c4:"好調",
  c5:"絶好調",
  c6:"静養"
};

function parseCondition(cell){
  const img=cell?.querySelector("img");

  const src=img?.getAttribute("src")||"";

  const m=src.match(/c([1-6])\.png/);

  if(!m)return"";

  return CONDITION_MAP["c"+m[1]]||"";
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

      form:parseCondition(cells[2]),

      rarity:cells[3]?.textContent.trim()||"",

      name:nameCell?.textContent.trim()||"",

      url:resolveOrekouUrl(nameLink?.getAttribute("href")),

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
// 「○回表/裏」列 と「内容」列の2列からなる表を探して読み取る。
// 「内容」列の中に<br>で複数の出来事が入っていることがあるため分割し、
// 「、」で終わる行は次の行とつなげる
// (例:「代走で出た尾原、」+「そのまま中堅手の守備につく」)。
// 戻り値は {inning, half, text} の配列。
// ------------------------------

function mergeFragments(parts){
  const merged=[];

  parts.forEach(p=>{
    if(merged.length&&merged[merged.length-1].endsWith("、")){
      merged[merged.length-1]+=p;

    }else{
      merged.push(p);
    }
  });

  return merged;
}

function splitByBr(doc,cell){
  const html=cell?.innerHTML||"";

  const parts=html

    .split(/<br\s*\/?>/i)

    .map(fragment=>{
      const tmp=doc.createElement("div");
      tmp.innerHTML=fragment;

      return tmp.textContent.replace(/\s+/g,"");
    })

    .filter(Boolean);

  return mergeFragments(parts);
}

function parsePlayByPlay(doc){
  const tables=[...doc.querySelectorAll("table")];

  const ppTable=tables.find(table=>

    [...table.querySelectorAll("tr")].some(row=>{
      const cells=[...row.querySelectorAll("td")];

      return cells.length>=2&&/^\d+回[表裏]$/.test(cells[0]?.textContent.trim()||"");
    })
  );

  if(!ppTable)return[];

  const entries=[];

  [...ppTable.querySelectorAll("tr")].forEach(row=>{
    const cells=[...row.querySelectorAll("td")];

    if(cells.length<2)return;

    const headerText=cells[0]?.textContent.trim()||"";

    const m=headerText.match(/^(\d+)回([表裏])$/);

    if(!m)return;

    const inning=Number(m[1]);
    const half=m[2]==="表" ? "top" : "bottom";

    splitByBr(doc,cells[1]).forEach(text=>{
      entries.push({inning,half,text});
    });
  });

  return entries;
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

  // 試合開始時点のスタメンのコピーを持たせる
  cards.push({
    type:"start",

    awayLineup:getLineupCopy("away"),
    homeLineup:getLineupCopy("home"),

    snapshot:createSnapshot()
  });

  let atBat=null;        // 進行中の打席 {lines, carry, inning, half}
  let defenseBuffer=[];  // 守備・交代の行 [{line, half}]
  let pending=[];        // 保留中の走者イベント(次の打席で表示する)
  let currentHalfKey=null;
  let jumpTarget=null;   // 次に追加するカードを、このイニングの先頭として登録する

  const pushCards=list=>{
    if(!list.length)return;

    if(jumpTarget){
      const{inning,half}=jumpTarget;

      if(gameState.firstCard[half][inning]===undefined){
        gameState.firstCard[half][inning]=cards.length;
      }

      jumpTarget=null;
    }

    cards.push(...list);
  };

  const flushAtBat=()=>{
    if(atBat){
      const target=atBat;

      atBat=null;

      pushCards(finalizePlateAppearance(target));
    }
  };

  // 次の打席が無いまま残った走者イベントは、直前の打席の後に単独で表示する
  const flushPending=()=>{
    if(pending.length){
      pushCards(pending.splice(0).map(makeRunnerEventCard));
    }
  };

  const flushDefense=()=>{
    if(defenseBuffer.length){
      pushCards(buildDefenseCards(defenseBuffer.splice(0)));
    }
  };

  for(const entry of matchData.playByPlay){
    const line=entry.text;

    // --------------------------
    // イニングが切り替わったら、ここまでの分を確定してから進む
    // --------------------------

    const halfKey=`${entry.inning}-${entry.half}`;

    if(halfKey!==currentHalfKey){
      flushAtBat();
      flushPending();
      flushDefense();

      clearPinchFlags();

      startHalf(entry.inning,entry.half);

      currentHalfKey=halfKey;

      jumpTarget={inning:entry.inning,half:entry.half};
    }

    const special=extractSpecial(line);
    const type=special?.type;

    // --------------------------
    // 盗塁・牽制死など:次の打席で表示するため保留する
    // --------------------------

    if(RUNNER_EVENT_TYPES.includes(type)){
      pending.push({line,event:{...special,text:line}});

      continue;
    }

    // --------------------------
    // 守備交代・代打・代走・登板
    // 直前の打席を先に確定させてからバッファへ
    // --------------------------

    if(DEFENSE_TYPES.includes(type)){
      flushAtBat();

      defenseBuffer.push({line,half:entry.half});

      continue;
    }

    // --------------------------
    // 打席の行
    // --------------------------

    flushDefense();

    if(!atBat||isNewBatter(line)){
      flushAtBat();

      atBat={
        lines:[line],
        carry:pending.splice(0),
        inning:entry.inning,
        half:entry.half
      };

    }else{
      atBat.lines.push(line);
    }
  }

  flushAtBat();
  flushPending();
  flushDefense();

  // 3アウトを待たずに試合経過が終わっている場合はサヨナラ
  finishGame({walkoff:gameState.outs<3});

  cards.push({
    type:"end",

    snapshot:createSnapshot()
  });

  return cards;
}

// ==============================
// 新しい打者判定
// ==============================

function isNewBatter(line){
  // フィルダースチョイスの行は、新しい打席の開始
  // (打者名は続く「打った〇〇、」の行から取る)
  if(/フィルダースチョイス/.test(line)){
    return true;
  }

  if(/^(一塁走者|二塁走者|三塁走者)の/.test(line)){
    return false;
  }

  if(/^打った/.test(line)){
    return false;
  }

  if(/生還し|進塁|タッチアップ|動けず/.test(line)){
    return false;
  }

  // 守備側の選手の名前が主語になる行などは、進行中の打席の続き
  if(/エラー|好返球でアウト/.test(line)){
    return false;
  }

  return /^[^　\s]+が/.test(line);
}

// ==============================
// 打者名の取得
// ==============================

function extractBatterToken(lines){
  const first=lines[0]||"";

  // 「敬遠、〇〇が歩かされる」「満塁策、〇〇が歩かされる」
  const walk=first.match(/^(?:敬遠|満塁策)、(.+?)が歩かされる/);

  if(walk)return walk[1];

  // フィルダースチョイス:「打った〇〇、…」の行に打者名がある
  if(/フィルダースチョイス/.test(first)){
    for(const l of lines){
      const m=l.match(/^打った(.+?)、/);

      if(m)return m[1];
    }
  }

  return first.match(/^(.+?)が/)?.[1]||"";
}

// ==============================
// 走者イベント(盗塁など)の反映とカード
// ==============================

function applyRunnerEvent(event){
  if(!event.outs)return;

  const runnerToken=
    event.text.match(/^(?:(?:一塁|二塁|三塁)走者の?)?(.+?)が/)?.[1]||"";

  setOuts(gameState.outs+event.outs);

  const idx=gameState.runners.indexOf(runnerToken);

  if(idx!==-1){
    gameState.runners.splice(idx,1);

  }else{
    gameState.runners.shift();
  }

  setRunners([...gameState.runners]);

  if(gameState.outs>=3){
    changeHalf();
  }
}

function makeRunnerEventCard(item){
  applyRunnerEvent(item.event);

  return{
    type:item.event.type==="pickoff" ? "pickoff" : "steal",

    text:[item.line],

    snapshot:createSnapshot()
  };
}

// ==============================
// 打席確定
// ==============================

function finalizePlateAppearance(atBat){
  const cards=[];

  const lines=atBat.lines;

  const events=lines.map(classifyLine);

  const side=battingSideOf(atBat.half);

  const runnersAtStart=gameState.runners.length;

  const batterToken=extractBatterToken(lines);

  const batterPlayer=findPlayerByToken(side,batterToken);

  const isPinchHit=!!batterPlayer?.pinchHit;

  if(batterPlayer)batterPlayer.pinchHit=false;

  // 打者紹介カード(打席開始時点の状態)
  cards.push({
    type:"batter",

    title:batterToken,

    player:batterPlayer ? snapshotPlayer(batterPlayer) : null,

    isPinchHit,

    snapshot:createSnapshot()
  });

  // 保留されていた走者イベント(盗塁など)を、打者紹介と打席結果の間に表示
  atBat.carry.forEach(item=>{
    cards.push(makeRunnerEventCard(item));
  });

  // 得点(生還)
  const scoreEvents=events.filter(e=>e.type==="score");

  const totalScore=scoreEvents.reduce((sum,e)=>sum+(e.score||0),0);

  if(totalScore>0){
    addRuns(side,totalScore);

    scoreEvents.forEach(e=>{
      const scorer=e.text.match(/^(.+?)が生還/)?.[1]||"";

      // 打者自身が生還(本塁打など)した場合は走者を消さない
      if(scorer===batterToken)return;

      const idx=gameState.runners.indexOf(scorer);

      if(idx!==-1){
        gameState.runners.splice(idx,1);

      }else{
        gameState.runners.pop();
      }
    });
  }

  // 打席結果の判定
  let result=null;
  let position=null;
  let tagUpOut=false;

  events.forEach((event,i)=>{
    if(event.position)position=event.position;

    if(event.type==="score")return;

    if(event.type==="tagUp")return;

    // 「タッチアップ」→「好返球でアウト」が続く場合は走者アウト
    if(event.type==="tagUpOut"){
      if(events[i-1]?.type==="tagUp")tagUpOut=true;

      return;
    }

    // 守備側の選手の名前が主語の行も含め、直前の打球をエラー出塁に切り替える
    if(/エラー/.test(event.text)){
      result={
        type:"error",
        abbr:(position||"")+"失",
        runner:true,
        text:event.text
      };

      return;
    }

    if(/フィルダースチョイス/.test(event.text)){
      result={
        type:"fielderChoice",
        abbr:"野選",
        runner:true,
        text:event.text
      };

      return;
    }

    switch(event.type){
      case"ground":
      case"fly":
      case"line":
        result=event;
        break;

      case"doublePlay":{
        const pos=position||extractPosition(event.text)?.abbr||"";

        // 満塁かつこの打席で得点が無い場合のみ、前の走者(三塁走者)を消す
        const useFrontRunner=runnersAtStart===3&&totalScore===0;

        result={
          ...event,

          abbr:pos+"併殺",

          removeRearRunner:!useFrontRunner,
          removeFrontRunner:useFrontRunner
        };

        break;
      }

      case"fielderChoiceDoublePlay":
        result={
          ...event,

          abbr:(position||"")+"ゴロ"
        };
        break;

      default:
        if(!result){
          result=event;
        }
    }
  });

  // アウト・走者・H/Eをまとめて反映(3アウト判定は1回だけ)
  applyAtBatResult(result,batterToken,tagUpOut ? 1 : 0);

  if(batterPlayer){
    addPlayerHistory(side,batterPlayer.order,{
      short:result?.abbr||"",
      rbi:totalScore
    });
  }

  cards.push({
    type:"result",

    text:lines,
    result,

    snapshot:createSnapshot()
  });

  return cards;
}

// ==============================
// 打席結果の反映
// extraOuts: タッチアップアウトなど、打者の結果とは別に増えるアウト
//            (一番前の走者も1人消える)
// ==============================

function applyAtBatResult(result,batterToken,extraOuts){
  const e=result||{};

  const outs=(e.outs||0)+extraOuts;

  if(outs){
    setOuts(gameState.outs+outs);
  }

  if(e.removeRearRunner){
    gameState.runners.shift();
  }

  if(e.removeFrontRunner){
    gameState.runners.pop();
  }

  for(let i=0;i<extraOuts;i++){
    gameState.runners.pop();
  }

  if(e.runner){
    gameState.runners.unshift(batterToken);
  }

  setRunners([...gameState.runners]);

  const battingSide=battingSideOf(gameState.half);
  const fieldingSide=fieldingSideOf(gameState.half);

  const hitTypes=[
    "hit","infieldHit","double","triple",
    "homeRun","buntHit","hitAndRun"
  ];

  if(hitTypes.includes(e.type)){
    addHit(battingSide);
  }

  if(e.type==="error"){
    addError(fieldingSide);
  }

  if(gameState.outs>=3){
    changeHalf();
  }
}

// ==============================
// 代打・代走・守備交代・投手交代のカード
// 連続する行をまとめて処理し、最大3枚のカードを返す
//   代打/代走カード → 守備交代カード → 投手交代カード
// ==============================

function buildDefenseCards(entries){
  const offenseLines=[];
  let hasPinchHit=false;
  let hasPinchRun=false;

  // 守備位置の変更(1人につき最後の1件だけ、最後に書かれた順)
  const ordered=[];

  const explicitPitching=[];
  const explicitSides=new Set();
  const touchedSides=new Set();

  const removeEntry=player=>{
    const i=ordered.findIndex(e=>e.player===player);

    if(i!==-1)ordered.splice(i,1);
  };

  const upsert=entry=>{
    const i=ordered.findIndex(e=>e.player===entry.player);

    if(i!==-1){
      // 交代で入った選手がその後に動いた場合は、「〇〇に代わり…」の表示を維持する
      if(ordered[i].kind==="sub"&&entry.kind==="move")return;

      ordered.splice(i,1);
    }

    ordered.push(entry);
  };

  entries.forEach(({line,half})=>{
    // 代打
    let m=line.match(/^(.+?)に代打、(.+?)！?$/);

    if(m){
      const[,outToken,inToken]=m;
      const side=battingSideOf(half);

      const outPlayer=findPlayerByToken(side,outToken);

      if(outPlayer){
        substitutePlayer(side,outPlayer.order,inToken,{pinchHit:true});
      }

      offenseLines.push(`${outToken}に代打、${inToken}`);
      hasPinchHit=true;

      return;
    }

    // 代走
    m=line.match(/^(一塁|二塁|三塁)走者(.+?)に代走、(.+?)！?$/);

    if(m){
      const[,base,outToken,inToken]=m;
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

      offenseLines.push(`${base}走者${outToken}に代走、${inToken}`);
      hasPinchRun=true;

      return;
    }

    const side=fieldingSideOf(half);

    // 代打・代走で出た選手が、そのまま守備につく
    const stay=line.match(/代(?:打|走)で出た(.+?)、そのまま(.+?)手の守備につく/);

    if(stay){
      const[,token,posText]=stay;

      touchedSides.add(side);

      const player=findPlayerByToken(side,token);

      if(player){
        setPosition(player,posText);

        upsert({player,kind:"move",token});
      }

      return;
    }

    // 守備の選手交代(ベンチから新しい選手)
    const sub=line.match(/(.+?)手の(.+?)を(.+?)に交代/);

    if(sub){
      const[,posText,outToken,inToken]=sub;

      touchedSides.add(side);

      const outPlayer=findPlayerByToken(side,outToken);

      const inPlayer=outPlayer
        ? substitutePlayer(side,outPlayer.order,inToken)
        : null;

      if(inPlayer){
        setPosition(inPlayer,posText);

        removeEntry(outPlayer);

        upsert({player:inPlayer,kind:"sub",token:inToken,outToken});
      }

      return;
    }

    // 守備位置変更(同じ選手のまま)
    const move=line.match(/(.+?)を(.+?)手に守備位置変更/);

    if(move){
      const[,token,posText]=move;

      touchedSides.add(side);

      const player=findPlayerByToken(side,token);

      if(player){
        setPosition(player,posText);

        upsert({player,kind:"move",token});
      }

      return;
    }

    // 登板(投手交代)
    const pitcher=line.match(/(.+?)に代え、(.+?)が登板/);

    if(pitcher){
      const[,outToken,inToken]=pitcher;

      touchedSides.add(side);
      explicitSides.add(side);

      const outPlayer=findPlayerByToken(side,outToken);

      const inPlayer=outPlayer
        ? substitutePlayer(side,outPlayer.order,inToken)
        : findPlayerByToken(side,inToken);

      if(inPlayer){
        setPosition(inPlayer,"投");

        gameData[side].currentPitcher=inPlayer;

        removeEntry(inPlayer);
      }

      if(outPlayer)removeEntry(outPlayer);

      explicitPitching.push(`${outToken}に代わり${inToken}が登板`);
    }
  });

  // 「〇〇を投手に守備位置変更」だけで登板の文言が無い場合は、
  // 直近までマウンドに立っていた投手から、最終的な投手への交代とする
  const implicitPitching=[];

  touchedSides.forEach(side=>{
    if(explicitSides.has(side))return;

    const finalPitcher=gameData[side].lineup.find(p=>p.currentPosition==="投");
    const prevPitcher=gameData[side].currentPitcher;

    if(finalPitcher&&prevPitcher&&finalPitcher!==prevPitcher){
      implicitPitching.push(
        `${makeToken(side,prevPitcher)}に代わり${makeToken(side,finalPitcher)}が登板`
      );

      gameData[side].currentPitcher=finalPitcher;
    }
  });

  const result=[];

  if(offenseLines.length){
    result.push({
      type:"offenseSub",

      title:hasPinchHit&&hasPinchRun
        ? "代打・代走"
        : (hasPinchHit ? "代打" : "代走"),

      text:offenseLines,

      snapshot:createSnapshot()
    });
  }

  // 投手になった選手は投手交代カードに回す
  const defenseLines=ordered

    .filter(e=>e.player.currentPosition!=="投")

    .map(e=>{
      const posName=positionName(e.player.currentPosition);

      return e.kind==="sub"
        ? `${e.outToken}に代わり${e.token}が${posName}`
        : `${e.token}　${posName}へ`;
    });

  if(defenseLines.length){
    result.push({
      type:"defense",

      text:defenseLines,

      snapshot:createSnapshot()
    });
  }

  const pitchingLines=[...explicitPitching,...implicitPitching];

  if(pitchingLines.length){
    result.push({
      type:"pitcherChange",

      text:pitchingLines,

      snapshot:createSnapshot()
    });
  }

  return result;
}

// ------------------------------
// 読み込み開始(ボタン・Enterキー)
// ------------------------------

async function startLoadFromInput(){
  const url=document

    .getElementById("game-url")

    .value.trim();

  if(!url)return;

  await loadGame(url);
}

document

  .getElementById("load-game-btn")

  ?.addEventListener("click",startLoadFromInput);

document

  .getElementById("game-url")

  ?.addEventListener("keydown",e=>{
    if(e.key==="Enter"&&!e.isComposing){
      e.preventDefault();

      startLoadFromInput();
    }
  });