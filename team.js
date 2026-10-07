// ==============================
// team.js
// 選手・オーダー管理
// ==============================

// チーム情報
// roster      : スタメン+ベンチの全選手(交代で退いた選手も残す)
// lineup      : 現在の打順(交代に合わせて書き換わる)
// currentPitcher : 実際に直近でマウンドに立っていた投手
const gameData = {
  away: {
    teamName: "",
    teamNameShort: "",
    teamUrl: "",
    lineup: [],
    bench: [],
    roster: [],
    currentPitcher: null
  },

  home: {
    teamName: "",
    teamNameShort: "",
    teamUrl: "",
    lineup: [],
    bench: [],
    roster: [],
    currentPitcher: null
  }
};

// ==============================
// 守備位置の表記
// 内部では1文字(投捕一二三遊左中右)に統一する
// ==============================

const POSITION_FULLNAME = {
  "投": "ピッチャー",
  "捕": "キャッチャー",
  "一": "ファースト",
  "二": "セカンド",
  "三": "サード",
  "遊": "ショート",
  "左": "レフト",
  "中": "センター",
  "右": "ライト"
};

// 「遊撃」「中堅手」「捕」などの文言を1文字に変換
function normalizePos(text) {
  const first = (text || "").trim().charAt(0);

  return "投捕一二三遊左中右".includes(first) && first !== "" ? first : "";
}

// 守備交代カード用のポジション名
function positionName(pos) {
  return POSITION_FULLNAME[pos] || pos || "";
}

// ==============================
// 選手オブジェクトを作成
// ==============================

function createPlayer(player) {
  return {
    order: player.order,                 // 打順(ベンチは"-")
    pos: player.pos,                     // 元の守備位置
    currentPosition: normalizePos(player.pos) || player.pos, // 現在の守備位置

    form: player.form,                   // 調子
    rarity: player.rarity,               // レア度

    name: player.name,                   // フルネーム(姓 名)
    url: player.url || "",               // 選手ページへのリンク

    hand: player.hand,                   // 投打(例:「右投右打」)

    history: [],                         // 打席履歴
    isSubstitute: false,                 // 代打・代走などで入った選手かどうか
    pinchHit: false                      // 「代打」と告げられた直後の打席かどうか
  };
}

// ==============================
// スタメン・ベンチ登録
// ==============================

function setLineup(side, players) {
  gameData[side].lineup = players.map(createPlayer);

  gameData[side].roster = [...gameData[side].lineup, ...gameData[side].bench];

  gameData[side].currentPitcher =
    gameData[side].lineup.find(p => p.currentPosition === "投") || null;
}

function setBench(side, players) {
  gameData[side].bench = players.map(createPlayer);

  gameData[side].roster = [...gameData[side].lineup, ...gameData[side].bench];
}

// ==============================
// リセット(URL読込のたびに呼ぶ)
// ==============================

function resetTeamData() {
  ["away", "home"].forEach(side => {
    gameData[side] = {
      teamName: "",
      teamNameShort: "",
      teamUrl: "",
      lineup: [],
      bench: [],
      roster: [],
      currentPitcher: null
    };
  });
}

// ==============================
// 試合開始時のスタメンのコピー
// (試合の再現中に選手データが書き換わっても影響を受けない)
// ==============================

function getLineupCopy(side) {
  return structuredClone(gameData[side].lineup);
}

// 打者紹介カード用:選手情報のコピー
function snapshotPlayer(player) {
  return {
    order: player.order,
    name: player.name,
    rarity: player.rarity,
    form: player.form,
    hand: player.hand,
    url: player.url
  };
}

// ==============================
// 打順から選手取得
// ==============================

function getPlayer(side, order) {
  return gameData[side].lineup.find(player => player.order === order);
}

// ==============================
// 打席履歴追加
// ==============================

function addPlayerHistory(side, order, result) {
  const player = getPlayer(side, order);

  if (!player) return;

  player.history.push(result);
}

// ==============================
// 守備位置の変更
// ==============================

function setPosition(player, newPosition) {
  if (!player) return;

  const pos = normalizePos(newPosition);

  if (pos) player.currentPosition = pos;
}

function updatePosition(side, order, newPosition) {
  setPosition(getPlayer(side, order), newPosition);
}

// ==============================
// 代打・代走・守備交代でベンチ選手を組み込む
// outOrder: 交代前の選手の打順
// inToken : 試合経過に出てくる交代後の選手の表記(例:「熊坂」「山田(裕)」)
// options.pinchHit : 代打として入る場合true
// ==============================

function substitutePlayer(side, outOrder, inToken, options = {}) {
  const outPlayer = getPlayer(side, outOrder);

  if (!outPlayer) return null;

  const inPlayer = findPlayerByToken(side, inToken);

  if (!inPlayer || inPlayer === outPlayer) return null;

  // ベンチから除外
  gameData[side].bench = gameData[side].bench.filter(p => p !== inPlayer);

  // 打順スロットと守備位置を引き継ぐ
  inPlayer.order = outPlayer.order;
  inPlayer.currentPosition = outPlayer.currentPosition;
  inPlayer.isSubstitute = true;

  if (options.pinchHit) inPlayer.pinchHit = true;

  const idx = gameData[side].lineup.indexOf(outPlayer);

  if (idx !== -1) {
    gameData[side].lineup[idx] = inPlayer;
  }

  return inPlayer;
}

// イニングが替わったら「代打」の表示フラグを消す
function clearPinchFlags() {
  ["away", "home"].forEach(side => {
    gameData[side].roster.forEach(p => { p.pinchHit = false; });
  });
}

// ==============================
// フルネームを「姓」「名」に分割
// 全角・半角どちらのスペースにも対応
// ==============================

function splitFullName(fullName) {
  const parts = (fullName || "").trim().split(/[\s　]+/);

  return {
    surname: parts[0] || "",
    given: parts.slice(1).join("") || ""
  };
}

// ==============================
// 試合経過中の表記(トークン)から選手を特定
// 例:"近藤"          → 姓が完全一致する選手
// 例:"山田(裕)"      → 姓が完全一致し、名の1文字目が「裕」の選手
// スタメン・ベンチ・交代で退いた選手を含むチーム全員から、side内のみ検索する
// ==============================

function findPlayerByToken(side, token) {
  const m = (token || "").match(/^(.+?)(?:\((.)\))?$/);

  if (!m) return null;

  const surname = m[1];
  const disambiguator = m[2] || null;

  const candidates = gameData[side].roster.filter(player => {
    const { surname: pSurname, given: pGiven } = splitFullName(player.name);

    if (pSurname !== surname) return false;

    if (disambiguator) {
      return pGiven.charAt(0) === disambiguator;
    }

    return true;
  });

  return candidates[0] || null;
}

// ==============================
// 選手から試合経過の表記(トークン)を作る
// 同じ苗字の選手がチームにいる場合は「小林(聖)」のようにする
// ==============================

function makeToken(side, player) {
  const { surname, given } = splitFullName(player.name);

  const sameSurname = gameData[side].roster.filter(
    p => splitFullName(p.name).surname === surname
  );

  if (sameSurname.length > 1 && given) {
    return `${surname}(${given.charAt(0)})`;
  }

  return surname;
}