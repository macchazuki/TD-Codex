const GAME_HUD_TEMPLATE = `
  <div id="tileTooltip" class="hidden" role="status" aria-live="polite">
    <h3 id="tileTooltipName"></h3>
    <p id="tileTooltipDescription"></p>
  </div>
  <div id="hud">
    <div class="hud-top brackets">
      <div class="brand">CORE<span>://</span>DEFENSE</div>
      <div class="stats">
        <div class="stat gold"><span class="glyph">⬡</span><span id="goldVal">150</span><label>GOLD</label></div>
        <div class="stat integrity"><span class="glyph">◈</span><span id="livesVal">20</span><label>INTEGRITY</label></div>
        <div class="stat wave"><span class="glyph">▣</span><span id="waveVal">0</span>/<span id="waveMax">10</span><label>WAVE</label></div>
      </div>
      <button id="waveBtn">INITIATE WAVE</button>
      <div id="wallModeControls" aria-label="Wall editing mode">
        <button class="wall-mode-btn active" type="button" data-wall-mode="normal" aria-pressed="true">Normal</button>
        <button class="wall-mode-btn" type="button" data-wall-mode="build" aria-pressed="false">Build</button>
        <button class="wall-mode-btn" type="button" data-wall-mode="remove" aria-pressed="false">Remove</button>
      </div>
      <div id="speedControls" aria-label="Game speed">
        <button class="speed-btn" type="button" data-speed="0.5" aria-label="Set game speed to 0.5x" aria-pressed="false">0.5x</button>
        <button class="speed-btn active" type="button" data-speed="1" aria-label="Set game speed to 1x" aria-pressed="true">1x</button>
        <button class="speed-btn" type="button" data-speed="2" aria-label="Set game speed to 2x" aria-pressed="false">2x</button>
      </div>
    </div>
    <div id="message"></div>
    <div class="hud-bottom">
      <div id="nodeCards" class="brackets"></div>
      <div id="selectedPanel" class="hidden brackets">
        <h3 id="selName">NODE</h3>
        <div id="towerDetails">
          <div class="row"><span>DAMAGE</span><b id="selDmg">-</b></div>
          <div class="row"><span>RANGE</span><b id="selRange">-</b></div>
          <div class="row"><span>RATE</span><b id="selRate">-</b></div>
          <div class="row"><span>KILLS</span><b id="selKills">-</b></div>
          <div class="row"><span>ENCHANTMENTS</span><b id="selEnchantments">-</b></div>
          <div class="upgrade-actions" aria-label="Tower upgrades">
            <button id="upgradeDamageBtn" class="upgrade-btn" data-stat="damage"><span>DAMAGE +20%</span><b id="damageUpgradeCost">⬡ 40</b></button>
            <button id="upgradeRangeBtn" class="upgrade-btn" data-stat="range"><span>RANGE +10%</span><b id="rangeUpgradeCost">⬡ 35</b></button>
            <button id="upgradeFireRateBtn" class="upgrade-btn" data-stat="fireRate"><span>RATE +15%</span><b id="fireRateUpgradeCost">⬡ 45</b></button>
          </div>
          <button id="purgeBtn">PURGE NODE</button>
        </div>
      </div>
    </div>
    <div id="hint"><span id="desktopHint">NORMAL: select nodes/tiles · BUILD: left-drag walls · REMOVE: left-drag walls · MIDDLE-DRAG: pan · SCROLL: zoom</span><span id="mobileHint">NORMAL: TAP TO SELECT · BUILD/REMOVE: 1-FINGER TAP/DRAG · 2-FINGER DRAG: PAN · PINCH: ZOOM</span></div>
  </div>
  <div id="rewardOverlay" class="hidden" aria-labelledby="rewardTitle">
    <div id="rewardBox" class="brackets">
      <div id="rewardTitle">WAVE REWARD</div>
      <div id="rewardSubtitle">SELECT ONE NODE OR TILE TO ADD TO YOUR INVENTORY</div>
      <div id="rewardCards"></div>
    </div>
  </div>
  <div id="overlay" class="hidden">
    <div id="overlayBox" class="brackets">
      <div id="overlayTitle"></div>
      <div id="overlaySubtitle"></div>
      <button id="restartBtn">REINITIALIZE</button>
    </div>
  </div>`;

/** Returns the menu elements needed before the game starts. */
export function getMenuElements() {
  return {
    canvas: document.getElementById('gameCanvas'),
    mainMenu: document.getElementById('mainMenu'),
    startGameBtn: document.getElementById('startGameBtn'),
    settingsBtn: document.getElementById('settingsBtn')
  };
}

/** Creates and returns the game interface after the game starts. */
export function createGameElements() {
  document.getElementById('app').insertAdjacentHTML('beforeend', GAME_HUD_TEMPLATE);
  const upgradeButtons = Object.fromEntries(Object.keys({damage: 0, range: 0, fireRate: 0}).map((stat) => [
    stat,
    {
      button: document.getElementById(`upgrade${stat[0].toUpperCase()}${stat.slice(1)}Btn`),
      cost: document.getElementById(`${stat}UpgradeCost`)
    }
  ]));
  return {
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
