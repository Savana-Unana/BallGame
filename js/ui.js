function formatValue(value) {
  return value == null ? "None" : String(value);
}

function getBallDetails(base) {
  const details = [
    ["HP", base.HP],
    ["Size", base.Size],
    ["Speed", base.Speed],
    ["Weight", base.Weight],
  ];

  if ("Ability" in base) {
    details.push(["Ability", formatValue(base.Ability)]);
  }
  if ("Weapon" in base) {
    details.push(["Weapon", formatValue(base.Weapon)]);
  }
  if (base.Effect) {
    details.push(["Effect", base.Effect]);
  }

  return details;
}

function renderDetails(container, base) {
  container.innerHTML = "";
  for (const [label, value] of getBallDetails(base)) {
    const card = document.createElement("div");
    card.className = "detailCard";
    card.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
    container.appendChild(card);
  }
}

function updatePreview(side, name) {
  const preview = side === "left" ? ui.leftPreview : ui.rightPreview;
  const detailName = side === "left" ? ui.leftDetailName : ui.rightDetailName;
  const details = side === "left" ? ui.leftDetails : ui.rightDetails;

  if (!name || !roster?.[name]) {
    preview.style.setProperty("--ball-color", "transparent");
    detailName.textContent = "Choose a ball";
    details.innerHTML = "";
    return;
  }

  const base = roster[name];
  preview.style.setProperty("--ball-color", base.Color);
  detailName.textContent = name;
  renderDetails(details, base);
}

function refreshStartButton() {
  ui.startButton.disabled = !(selections.left && selections.right);
}

function handleSelection(side, value) {
  selections = { ...selections, [side]: value };
  updatePreview(side, value);
  refreshStartButton();
}

function setSelection(side, value) {
  const select = side === "left" ? ui.leftSelect : ui.rightSelect;
  select.value = value;
  handleSelection(side, value);
}

function parseDoneBalls(markdown) {
  const doneSection = markdown.match(/## Done\s+([\s\S]*?)\s+## /);
  if (!doneSection) {
    return new Set();
  }

  return new Set(
    doneSection[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2).trim()),
  );
}

function populateSelect(select) {
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a ball";
  select.appendChild(placeholder);

  for (const name of Object.keys(roster)) {
    const option = document.createElement("option");
    option.value = name;
    option.disabled = !selectableBalls.has(name);
    option.textContent = selectableBalls.has(name)
      ? name
      : `${name} (Not Ready)`;
    select.appendChild(option);
  }
}

function normalizeRoster(data) {
  return Object.fromEntries(
    Object.entries(data).map(([name, base], index) => {
      const color = base.Color ?? defaultPalette[index % defaultPalette.length];
      return [
        name,
        {
          Size: base.Size ?? 40,
          HPColor: base.HPColor ?? "black",
          Color: color,
          Speed: base.Speed ?? 2,
          Weight: base.Weight ?? 1,
          EngineWeapon: base.EngineWeapon ?? null,
          EngineAbility: base.EngineAbility ?? null,
          ...base,
        },
      ];
    }),
  );
}

function setupMenu(data, statusMarkdown) {
  roster = normalizeRoster(data);
  selectableBalls = parseDoneBalls(statusMarkdown);
  populateSelect(ui.leftSelect);
  populateSelect(ui.rightSelect);
  ui.leftSelect.addEventListener("change", (event) => {
    handleSelection("left", event.target.value);
  });
  ui.rightSelect.addEventListener("change", (event) => {
    handleSelection("right", event.target.value);
  });
  ui.randomButton.addEventListener("click", randomizeBattle);
  ui.startButton.addEventListener("click", startMatch);
  ui.restartButton.addEventListener("click", restartBattle);
  ui.slowButton.addEventListener("click", slowBattle);
  ui.fastButton.addEventListener("click", speedBattle);
  updatePreview("left", "");
  updatePreview("right", "");
  refreshStartButton();
}

function createFighter(name, base, x, y, isDuplicate = false) {
  const engineWeapon = base.EngineWeapon ?? null;
  const engineAbility = base.EngineAbility ?? null;
  const fighter = {
    name,
    base,
    x,
    y,
    vx: (base.Speed ?? 0) + 1,
    vy: -1 + Math.random() * 2,
    hp: base.HP,
    maxHp: base.HP,
    size: base.Size,
    maxSize: base.Size,
    shield: 0,
    isPhasing: false,
    isParrying: false,
    isDisarmed: false,
    stunTimer: 0,
    disarmTimer: 0,
    disabledWeapon: null,
    disabledAbility: null,
    disabledAbilityName: null,
    needleInterval: 0,
    needleTimer: 0,
    rotation: 0,
    spinSpeed: Math.random() * 0.2 + 0.1,
    weapon: engineWeapon ? weaponFactories[engineWeapon]?.() ?? null : null,
    ability: null,
    abilityName: engineAbility,
    isDuplicate,
    pendingHeal: 0,
    hitCooldowns: new Map(),
  };

  if (fighter.weapon) {
    fighter.weapon.owner = fighter;
    if (fighter.weapon.name === "Bow") {
      fighter.weapon.fireRate = 35;
      fighter.weapon.cooldown = 14;
    }
  }

  if (engineAbility) {
    fighter.ability = abilityFactories[engineAbility]?.() ?? null;
    fighter.ability?.init(fighter);
  }

  fighters.push(fighter);
  return fighter;
}

function resetMatch() {
  fighters.length = 0;
  projectiles.length = 0;
  hazards.length = 0;
  freezeFrames = 0;
}

sounds.explosionQuiet = new Audio("assets/hit.mp3");
sounds.explosionQuiet.volume = 0.12;

