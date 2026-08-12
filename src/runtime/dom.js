/** Returns the game interface elements used by the runtime. */
export function getGameElements() {
  const upgradeButtons = Object.fromEntries(Object.keys({damage: 0, range: 0, fireRate: 0}).map((stat) => [
    stat,
    {
      button: document.getElementById(`upgrade${stat[0].toUpperCase()}${stat.slice(1)}Btn`),
      cost: document.getElementById(`${stat}UpgradeCost`)
    }
  ]));
  return {
    canvas: document.getElementById('gameCanvas'),
    goldVal: document.getElementById('goldVal'),
    livesVal: document.getElementById('livesVal'),
    waveVal: document.getElementById('waveVal'),
    waveBtn: document.getElementById('waveBtn'),
    speedButtons: [...document.querySelectorAll('.speed-btn')],
    wallModeButtons: [...document.querySelectorAll('.wall-mode-btn')],
    nodeCards: document.getElementById('nodeCards'),
    selectedPanel: document.getElementById('selectedPanel'),
    towerDetails: document.getElementById('towerDetails'),
    tileTooltip: document.getElementById('tileTooltip'),
    tileTooltipName: document.getElementById('tileTooltipName'),
    tileTooltipDescription: document.getElementById('tileTooltipDescription'),
    message: document.getElementById('message'),
    rewardOverlay: document.getElementById('rewardOverlay'),
    rewardCards: document.getElementById('rewardCards'),
    overlay: document.getElementById('overlay'),
    overlayTitle: document.getElementById('overlayTitle'),
    overlaySubtitle: document.getElementById('overlaySubtitle'),
    selName: document.getElementById('selName'),
    selDmg: document.getElementById('selDmg'),
    selRange: document.getElementById('selRange'),
    selRate: document.getElementById('selRate'),
    selKills: document.getElementById('selKills'),
    selEnchantments: document.getElementById('selEnchantments'),
    purgeBtn: document.getElementById('purgeBtn'),
    upgradeButtons
  };
}
