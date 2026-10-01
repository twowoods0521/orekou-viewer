// ==============================
// team.js
// 選手・オーダー管理
// ==============================

// チーム情報
const gameData = {
  away: {
    teamName: "",
    teamNameShort: "",
    teamUrl: "",
    lineup: [],
    bench: []
  },

  home: {
    teamName: "",
    teamNameShort: "",
    teamUrl: "",
    lineup: [],
    bench: []
  }
};

// ==============================
// 選手オブジェクトを作成
// ==============================

function createPlayer(player) {
  return {
    order: player.order,                 // 打順(ベンチは"-")
    pos: player.pos,                     // 元の守備位置
    currentPosition: player.pos,         // 現在の守備位置

    form: player.form,                   // 調子
    rarity: player.rarity,               // レア度

    name: player.name,                   // フルネーム(姓 名)
    url: player.url || "",               // 選手ページへのリンク

    hand: player.hand,                   // 投打(例:「右投右打」)

    history: [],                         // 打席履歴
    isSubstitute: false                  // 代打・代走で入った選手かどうか
  };
}

// ==============================
// スタメン・ベンチ登録
// ==============================

function setLineup(side, players) {
  gameData[side].lineup = players.map(createPlayer);
}

function setBench(side, players) {
  gameData[side].bench = players.map(createPlayer);
}

// ==============================
// リセット(URL読込のたびに呼ぶ)
// ==============================

function resetTeamData() {
  gameData.away = { teamName: "", teamNameShort: "", teamUrl: "", lineup: [], bench: [] };
  gameData.home = { teamName: "", teamNameShort: "", teamUrl: "", lineup: [], bench: [] };
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

function updatePosition(side, order, newPosition) {
  const player = getPlayer(side, order);

  if (!player) return;

  player.currentPosition = newPosition;
}

// ==============================
// 代打・代走・守備交代でベンチ選手を組み込む
// outOrder: 交代前の選手の打順
// inToken : 試合経過に出てくる交代後の選手の表記(例:「熊坂」「山田(裕)」)
// ==============================

function substitutePlayer(side, outOrder, inToken) {

  const outPlayer = getPlayer(side, outOrder);

  if (!outPlayer) return null;

  const inPlayer = findPlayerByToken(side, inToken);

  if (!inPlayer) return null;

  // ベンチから除外
  gameData[side].bench = gameData[side].bench.filter(p => p !== inPlayer);

  // 打順スロットを引き継ぐ
  inPlayer.order = outPlayer.order;
  inPlayer.currentPosition = outPlayer.currentPosition;
  inPlayer.isSubstitute = true;

  const idx = gameData[side].lineup.indexOf(outPlayer);

  if (idx !== -1) {
    gameData[side].lineup[idx] = inPlayer;
  }

  return inPlayer;
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
// スタメン・ベンチの両方から、指定したside内のみを検索する
// ==============================

function findPlayerByToken(side, token) {

  const m = token.match(/^(.+?)(?:\((.)\))?$/);

  if (!m) return null;

  const surname = m[1];
  const disambiguator = m[2] || null;

  const pool = [...gameData[side].lineup, ...gameData[side].bench];

  const candidates = pool.filter(player => {

    const { surname: pSurname, given: pGiven } = splitFullName(player.name);

    if (pSurname !== surname) return false;

    if (disambiguator) {
      return pGiven.charAt(0) === disambiguator;
    }

    return true;

  });

  return candidates[0] || null;

}