// ==============================
// team.js
// 選手・オーダー管理
// ==============================

// チーム情報
const gameData = {
  away: {
    teamName: "",
    lineup: [],
    bench: []
  },

  home: {
    teamName: "",
    lineup: [],
    bench: []
  }
};

// 選手オブジェクトを作成
function createPlayer(player) {
  return {
    order: player.order,                 // 打順
    position: player.position,           // 元の守備位置
    currentPosition: player.position,    // 現在の守備位置

    condition: player.condition,         // 調子
    rarity: player.rarity,               // レア度

    name: player.name,

    throwHand: player.throwHand,         // 投
    batHand: player.batHand,             // 打

    history: [],                         // 打席履歴
    isSubstitute: false                  // 代打・代走フラグ
  };
}

// スタメン登録
function setLineup(side, players) {
  gameData[side].lineup = players.map(createPlayer);
}

// ベンチ登録
function setBench(side, players) {
  gameData[side].bench = players.map(createPlayer);
}

// 打順から選手取得
function getPlayer(side, order) {
  return gameData[side].lineup.find(player => player.order === order);
}

// 打席履歴追加
function addPlayerHistory(side, order, result) {
  const player = getPlayer(side, order);

  if (!player) return;

  player.history.push(result);
}