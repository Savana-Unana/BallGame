const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

canvas.width = 500;
canvas.height = 500;
ctx.textAlign = "center";
ctx.textBaseline = "middle";

const ui = {
  menu: document.getElementById("menu"),
  leftSelect: document.getElementById("leftSelect"),
  rightSelect: document.getElementById("rightSelect"),
  leftPreview: document.getElementById("leftPreview"),
  rightPreview: document.getElementById("rightPreview"),
  leftDetailName: document.getElementById("leftDetailName"),
  rightDetailName: document.getElementById("rightDetailName"),
  leftDetails: document.getElementById("leftDetails"),
  rightDetails: document.getElementById("rightDetails"),
  randomButton: document.getElementById("randomButton"),
  startButton: document.getElementById("startButton"),
  leftName: document.getElementById("leftName"),
  rightName: document.getElementById("rightName"),
  leftStats: document.getElementById("leftStats"),
  rightStats: document.getElementById("rightStats"),
  restartButton: document.getElementById("restartButton"),
};

const CONFIG = {
  gravity: 0.1,
  hitCooldownMs: 300,
  knockback: 10,
  freezeFrames: 10,
};

const fighters = [];
const projectiles = [];
const hazards = [];
let freezeFrames = 0;
let roster = null;
let selections = { left: "", right: "" };
let selectableBalls = new Set();
const defaultPalette = [
  "cyan",
  "red",
  "green",
  "orange",
  "purple",
  "brown",
  "magenta",
  "lime",
  "gray",
  "gold",
  "deepskyblue",
  "crimson",
];

const images = Object.fromEntries(
  ["Sword", "Dagger", "Axe", "Shovel", "Bow"].map((name) => {
    const image = new Image();
    image.src = `assets/${name}.png`;
    return [name, image];
  }),
);

const arrowImage = new Image();
arrowImage.src = "assets/Arrow.png";

const sounds = {
  hit: new Audio("assets/hit.mp3"),
  arrow: new Audio("assets/yoink.mp3"),
  yoink: new Audio("assets/yoink.mp3"),
};

const weaponFactories = {
  Sword() {
    return {
      name: "Sword",
      damage: 1,
      hitRadius: 16,
      angle: 0,
      rotationSpeed: 0.1,
      onHit(target) {
        target.hp -= this.damage;
        this.damage += 1;
      },
    };
  },
  Bow() {
    return {
      name: "Bow",
      angle: 0,
      rotationSpeed: 0.1,
      cooldown: 0,
      fireRate: 30,
    };
  },
  Dagger() {
    return {
      name: "Dagger",
      speedScale: 0.15,
      hitRadius: 12,
      angle: 0,
      rotationSpeed: 0.02,
      onHit(target) {
        target.hp -= 1;
        this.speedScale += 0.1;
      },
    };
  },
  Axe() {
    return {
      name: "Axe",
      baseDamage: 1,
      critChance: 0,
      critDamage: 1,
      hitRadius: 18,
      angle: 0,
      rotationSpeed: 0.1,
      onHit(target) {
        const damage =
          Math.random() < this.critChance ? this.critDamage : this.baseDamage;
        target.hp -= damage;
        this.critDamage += 2;
        this.critChance += 0.01;
      },
    };
  },
  Shovel() {
    return {
      name: "Shovel",
      digLeft: 100,
      hitRadius: 18,
      angle: 0,
      rotationSpeed: 0.1,
      onHit(target) {
        applyShovelEffect(this.owner, target);
        this.digLeft = Math.max(0, this.digLeft - 100 / 12);
      },
    };
  },
};

const abilityFactories = {
  Speed() {
    return {
      owner: null,
      speedGain: 0.15,
      maxSpeed: 8,
      init(owner) {
        this.owner = owner;
      },
      onHit() {
        const { owner, speedGain, maxSpeed } = this;
        owner.vx = clamp(owner.vx * (1 + speedGain), -maxSpeed, maxSpeed);
        owner.vy = clamp(owner.vy * (1 + speedGain), -maxSpeed, maxSpeed);
      },
    };
  },
  Duplicate() {
    return {
      owner: null,
      timer: 900,
      init(owner) {
        this.owner = owner;
      },
      tick() {
        this.timer -= 1;
        if (this.timer <= 0) {
          spawnDuplicate(this.owner);
          this.timer = 900;
        }
      },
      onHit() {
        this.timer = Math.max(60, this.timer - 1);
      },
    };
  },
  Yoink() {
    return {
      owner: null,
      timer: 180,
      activeTimer: 0,
      stolenThing: null,
      originalWeapon: null,
      originalWeaponLabel: null,
      init(owner) {
        this.owner = owner;
        this.originalWeapon = owner.weapon ? { ...owner.weapon } : null;
        if (this.originalWeapon) {
          this.originalWeapon.owner = owner;
        }
        this.originalWeaponLabel = owner.base.Weapon;
      },
      tick() {
        this.timer -= 1;
        if (this.activeTimer > 0) {
          this.activeTimer -= 1;
          if (this.activeTimer === 0) {
            this.owner.weapon = this.originalWeapon ? { ...this.originalWeapon } : null;
            if (this.owner.weapon) {
              this.owner.weapon.owner = this.owner;
            }
            this.stolenThing = null;
          }
        }
      },
      onDamaged(target) {
        if (this.timer > 0) {
          return;
        }

        if (target.weapon) {
          this.owner.weapon = { ...target.weapon };
          this.owner.weapon.owner = this.owner;
          this.stolenThing = target.base.Weapon ?? target.weapon.name;
        } else if (target.base.Ability) {
          this.stolenThing = target.base.Ability;
        } else {
          this.stolenThing = "None";
        }
        this.activeTimer = 240;
        this.timer = 180;
        playSound(sounds.yoink);
      },
    };
  },
  Lasso() {
    return {
      owner: null,
      rope: null,
      cooldown: 0,
      hooked: null,
      init(owner) {
        this.owner = owner;
      },
      tick() {
        this.cooldown = Math.max(0, this.cooldown - 1);

        if (!this.rope && !this.hooked && this.cooldown === 0) {
          const target = fighters.find((fighter) => fighter !== this.owner);
          if (target) {
            const angle = Math.atan2(target.y - this.owner.y, target.x - this.owner.x);
            this.rope = {
              x: this.owner.x,
              y: this.owner.y,
              vx: Math.cos(angle) * 7,
              vy: Math.sin(angle) * 7,
              ttl: 60,
            };
          }
        }

        if (this.rope) {
          this.rope.x += this.rope.vx;
          this.rope.y += this.rope.vy;
          this.rope.ttl -= 1;

          for (const target of fighters) {
            if (target === this.owner) {
              continue;
            }

            if (Math.hypot(target.x - this.rope.x, target.y - this.rope.y) <= target.size) {
              this.hooked = target;
              this.rope = null;
              this.cooldown = 90;
              break;
            }
          }

          if (
            this.rope &&
            (this.rope.ttl <= 0 ||
              this.rope.x < 0 ||
              this.rope.x > canvas.width ||
              this.rope.y < 0 ||
              this.rope.y > canvas.height)
          ) {
            this.rope = null;
            this.cooldown = 45;
          }
        }

        if (!this.hooked) {
          return;
        }

        if (this.hooked.hp <= 0) {
          this.hooked = null;
          return;
        }

        const dx = this.owner.x - this.hooked.x;
        const dy = this.owner.y - this.hooked.y;
        const distance = Math.hypot(dx, dy);

        if (distance <= this.owner.size + this.hooked.size) {
          this.hooked = null;
          this.cooldown = 180;
          return;
        }

        this.hooked.vx = clamp(this.hooked.vx + dx * 0.012, -3, 3);
        this.hooked.vy = clamp(this.hooked.vy + dy * 0.012, -3, 3);
      },
    };
  },
  BladeAura() {
    return {
      owner: null,
      timer: 180,
      init(owner) {
        this.owner = owner;
      },
      tick() {
        this.timer -= 1;
        if (this.timer > 0) {
          return;
        }

        this.timer = 180;
        for (const target of fighters) {
          if (target === this.owner) {
            continue;
          }

          const dx = this.owner.x - target.x;
          const dy = this.owner.y - target.y;
          const distance = Math.max(Math.hypot(dx, dy), 1);
          target.vx += (dx / distance) * 4;
          target.vy += (dy / distance) * 4;
        }
      },
    };
  },
  Crybaby() {
    return {
      owner: null,
      healTimer: 120,
      init(owner) {
        this.owner = owner;
      },
      tick() {
        this.healTimer -= 1;
        if (this.healTimer <= 0) {
          this.owner.hp = Math.min(this.owner.maxHp, this.owner.hp + 1);
          this.healTimer = 120;
        }

        for (const target of fighters) {
          if (target === this.owner) {
            continue;
          }

          const dx = target.x - this.owner.x;
          const dy = target.y - this.owner.y;
          const distance = Math.hypot(dx, dy);
          if (distance === 0 || distance > 180) {
            continue;
          }

          target.vx += (dx / distance) * 0.2;
          target.vy += (dy / distance) * 0.2;
        }
      },
    };
  },
  Vampire() {
    return {
      owner: null,
      init(owner) {
        this.owner = owner;
      },
      onHit() {
        this.owner.hp += 1;
      },
    };
  },
  Consume() {
    return {
      owner: null,
      hits: 0,
      init(owner) {
        this.owner = owner;
      },
      onHit() {
        this.hits += 1;
        this.owner.size += 1;
        this.owner.maxSize += 1;
        if (this.hits % 5 === 0) {
          this.owner.hp += 3;
          this.owner.maxHp += 3;
        }
      },
    };
  },
  Glass() {
    return {
      owner: null,
      init(owner) {
        this.owner = owner;
      },
      onDamaged() {
        spawnShards(this.owner.x, this.owner.y, 6, this.owner);
      },
    };
  },
  Grapple() {
    return {
      owner: null,
      target: null,
      init(owner) {
        this.owner = owner;
      },
      tick() {
        if (this.target) {
          this.owner.x = this.target.x;
          this.owner.y = this.target.y;
        }
      },
    };
  },
  Portal() {
    return {
      owner: null,
      target: null,
      init(owner) {
        this.owner = owner;
        this.target = { x: owner.x, y: owner.y };
      },
      onHit(target) {
        const swap = { x: target.x, y: target.y };
        target.x = this.target.x;
        target.y = this.target.y;
        this.target = swap;
      },
    };
  },
  Math() {
    return {
      owner: null,
      history: [],
      init(owner) {
        this.owner = owner;
      },
      onHit(target) {
        this.history.push(target.hp);
      },
    };
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function playSound(sound) {
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

function spawnShards(x, y, count, owner) {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count;
    hazards.push({
      type: "shard",
      x: x + Math.cos(angle) * 28,
      y: y + Math.sin(angle) * 28,
      radius: 8,
      ttl: 600,
      damage: 1,
      owner,
    });
  }
}

function spawnHealCube(x, y, amount) {
  hazards.push({
    type: "heal",
    x,
    y,
    radius: 10,
    ttl: 900,
    amount,
  });
}

function getWeaponPoint(fighter) {
  const weapon = fighter.weapon;
  if (!weapon) {
    return null;
  }

  const reach = fighter.size + 15;
  return {
    x: fighter.x + reach * Math.cos(weapon.angle),
    y: fighter.y + reach * Math.sin(weapon.angle),
  };
}

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
    rotation: 0,
    spinSpeed: Math.random() * 0.2 + 0.1,
    weapon: engineWeapon ? weaponFactories[engineWeapon]?.() ?? null : null,
    ability: null,
    abilityName: engineAbility,
    isDuplicate,
    hitCooldowns: new Map(),
  };

  if (fighter.weapon) {
    fighter.weapon.owner = fighter;
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

function startMatch() {
  if (!selections.left || !selections.right || !roster) {
    return;
  }

  resetMatch();
  document.body.classList.add("playing");
  createFighter(selections.left, roster[selections.left], 150, 250);
  createFighter(selections.right, roster[selections.right], 350, 250);
}

function restartBattle() {
  if (!document.body.classList.contains("playing")) {
    return;
  }

  startMatch();
}

function randomizeBattle() {
  const names = [...selectableBalls];
  if (names.length < 2) {
    return;
  }

  const leftIndex = Math.floor(Math.random() * names.length);
  let rightIndex = Math.floor(Math.random() * names.length);
  while (rightIndex === leftIndex && names.length > 1) {
    rightIndex = Math.floor(Math.random() * names.length);
  }

  setSelection("left", names[leftIndex]);
  setSelection("right", names[rightIndex]);
}

function spawnDuplicate(owner) {
  const duplicate = createFighter(
    owner.name,
    owner.base,
    owner.x + 20,
    owner.y + 20,
    true,
  );

  if (owner.weapon) {
    duplicate.weapon = { ...owner.weapon };
    duplicate.weapon.owner = duplicate;
  }

  if (owner.abilityName) {
    duplicate.ability = abilityFactories[owner.abilityName]?.() ?? null;
    duplicate.ability?.init(duplicate);
  }

  duplicate.hp = owner.hp;
  duplicate.maxHp = owner.maxHp;
  duplicate.size = owner.size;
  duplicate.maxSize = owner.maxSize;
}

function resolveHit(a, b) {
  if (freezeFrames > 0) {
    return;
  }

  const now = performance.now();
  const lastHit = a.hitCooldowns.get(b);
  if (lastHit && now - lastHit < CONFIG.hitCooldownMs) {
    return;
  }

  a.hitCooldowns.set(b, now);
  b.hitCooldowns.set(a, now);

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.max(Math.hypot(dx, dy), 0.1);
  const nx = dx / distance;
  const ny = dy / distance;
  const knockbackScale = isLassoCollisionPair(a, b) ? 0.2 : 1;

  a.vx -= (nx * CONFIG.knockback * knockbackScale) / a.base.Weight;
  a.vy -= (ny * CONFIG.knockback * knockbackScale) / a.base.Weight;
  b.vx += (nx * CONFIG.knockback * knockbackScale) / b.base.Weight;
  b.vy += (ny * CONFIG.knockback * knockbackScale) / b.base.Weight;

  freezeFrames = CONFIG.freezeFrames;
  playSound(sounds.hit);

  const aBodyDamage = getBodyDamage(a, b);
  const bBodyDamage = getBodyDamage(b, a);

  if (!a.weapon) {
    b.hp -= aBodyDamage;
  }
  if (!b.weapon) {
    a.hp -= bBodyDamage;
  }

  a.ability?.onHit?.(b);
  b.ability?.onHit?.(a);
  a.ability?.onDamaged?.(b);
  b.ability?.onDamaged?.(a);
}

function getBodyDamage(attacker, target) {
  if (attacker.name === "Heavy" && attacker.y < target.y) {
    return 2;
  }

  return 1;
}

function isLassoCollisionPair(a, b) {
  return (
    a.abilityName === "Lasso" &&
    a.ability?.hooked === b
  ) || (
    b.abilityName === "Lasso" &&
    b.ability?.hooked === a
  );
}

function updateDaggerTracking(fighter) {
  const weapon = fighter.weapon;
  if (!weapon || weapon.name !== "Dagger") {
    return;
  }

  let closest = null;
  let closestDistance = Infinity;

  for (const other of fighters) {
    if (other === fighter) {
      continue;
    }

    const distance = Math.hypot(other.x - fighter.x, other.y - fighter.y);
    if (distance < closestDistance) {
      closest = other;
      closestDistance = distance;
    }
  }

  if (!closest) {
    return;
  }

  const desiredAngle = Math.atan2(closest.y - fighter.y, closest.x - fighter.x);
  const delta =
    ((desiredAngle - weapon.angle + Math.PI) % (Math.PI * 2)) - Math.PI;

  weapon.angle += clamp(
    delta,
    -weapon.rotationSpeed * weapon.speedScale,
    weapon.rotationSpeed * weapon.speedScale,
  );
}

function fireArrow(owner, weapon) {
  projectiles.push({
    x: owner.x + Math.cos(weapon.angle) * (owner.size + 5),
    y: owner.y + Math.sin(weapon.angle) * (owner.size + 5),
    vx: Math.cos(weapon.angle) * 8,
    vy: Math.sin(weapon.angle) * 8,
    owner,
    damage: 1,
    size: owner.size / 2,
  });

  weapon.cooldown = weapon.fireRate;
  playSound(sounds.arrow);
}

function updateWeapon(fighter) {
  const weapon = fighter.weapon;
  if (!weapon) {
    return;
  }

  if (weapon.name === "Bow") {
    weapon.angle += weapon.rotationSpeed;
    weapon.cooldown = Math.max(0, weapon.cooldown - 1);

    if (weapon.cooldown === 0) {
      fireArrow(fighter, weapon);
    }
    return;
  }

  if (weapon.name !== "Dagger") {
    weapon.angle += weapon.rotationSpeed;
  }
  weapon.hitCooldowns ??= new Map();

  const point = getWeaponPoint(fighter);
  const weaponX = point.x;
  const weaponY = point.y;
  const weaponRadius = weapon.hitRadius ?? 15;

  for (const other of fighters) {
    if (other === fighter) {
      continue;
    }

    const now = performance.now();
    const lastHit = weapon.hitCooldowns.get(other);
    if (lastHit && now - lastHit < CONFIG.hitCooldownMs) {
      continue;
    }

    if (Math.hypot(other.x - weaponX, other.y - weaponY) < other.size + weaponRadius) {
      weapon.hitCooldowns.set(other, now);
      weapon.onHit?.(other);
      fighter.ability?.onHit?.(other);
      other.ability?.onDamaged?.(fighter);
    }
  }
}

function applyShovelEffect(attacker, target) {
  const reduction = Math.max(target.maxSize / 12, 1);
  target.size = Math.max(target.maxSize / 12, target.size - reduction);

  if (attacker.base.Weapon === "Split") {
    const hpLoss = Math.max(target.maxHp / 12, 1);
    target.hp -= hpLoss;
    spawnHealCube(target.x, target.y, hpLoss);
  }
}

function updateProjectiles() {
  for (const projectile of projectiles) {
    projectile.x += projectile.vx;
    projectile.y += projectile.vy;

    for (const fighter of fighters) {
      if (fighter === projectile.owner) {
        continue;
      }

      if (Math.hypot(fighter.x - projectile.x, fighter.y - projectile.y) < fighter.size) {
        fighter.hp -= projectile.damage;
        projectile.dead = true;
        projectile.owner.ability?.onHit?.(fighter);
        fighter.ability?.onDamaged?.(projectile.owner);

        if (projectile.owner.weapon?.name === "Bow") {
          const bow = projectile.owner.weapon;
          bow.fireRate = Math.max(5, bow.fireRate - 1);
          bow.cooldown = Math.min(bow.cooldown, bow.fireRate);
        }
      }
    }
  }

  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = projectiles[index];
    const offscreen =
      projectile.x < -50 ||
      projectile.x > canvas.width + 50 ||
      projectile.y < -50 ||
      projectile.y > canvas.height + 50;

    if (projectile.dead || offscreen) {
      projectiles.splice(index, 1);
    }
  }
}

function confineToArena(fighter) {
  if (fighter.x < fighter.size) {
    fighter.x = fighter.size;
    fighter.vx = Math.abs(fighter.vx);
  }
  if (fighter.x > canvas.width - fighter.size) {
    fighter.x = canvas.width - fighter.size;
    fighter.vx = -Math.abs(fighter.vx);
  }
  if (fighter.y < fighter.size) {
    fighter.y = fighter.size;
    fighter.vy = Math.abs(fighter.vy);
  }
  if (fighter.y > canvas.height - fighter.size) {
    fighter.y = canvas.height - fighter.size;
    fighter.vy = -Math.abs(fighter.vy);
  }
}

function updateHazards() {
  for (const hazard of hazards) {
    hazard.ttl -= 1;

    for (const fighter of fighters) {
      if (hazard.type === "shard" && hazard.owner === fighter) {
        continue;
      }

      if (Math.hypot(fighter.x - hazard.x, fighter.y - hazard.y) > fighter.size + hazard.radius) {
        continue;
      }

      if (hazard.type === "shard") {
        fighter.hp -= hazard.damage;
        hazard.dead = true;
      }

      if (hazard.type === "heal") {
        fighter.hp = Math.min(fighter.maxHp, fighter.hp + hazard.amount);
        hazard.dead = true;
      }
    }
  }

  for (let index = hazards.length - 1; index >= 0; index -= 1) {
    if (hazards[index].dead || hazards[index].ttl <= 0) {
      hazards.splice(index, 1);
    }
  }
}

function resolveFighterCollisions() {
  for (let i = 0; i < fighters.length; i += 1) {
    for (let j = i + 1; j < fighters.length; j += 1) {
      const a = fighters[i];
      const b = fighters[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      const minDistance = a.size + b.size;

      if (distance >= minDistance) {
        continue;
      }

      const safeDistance = distance || 0.1;
      const nx = distance ? dx / safeDistance : 1;
      const ny = distance ? dy / safeDistance : 0;
      const overlap = minDistance - safeDistance;

      a.x -= (nx * overlap) / 2;
      a.y -= (ny * overlap) / 2;
      b.x += (nx * overlap) / 2;
      b.y += (ny * overlap) / 2;
      resolveHit(a, b);
    }
  }
}

function drawProjectile(projectile) {
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(Math.atan2(projectile.vy, projectile.vx));
  ctx.drawImage(
    arrowImage,
    -projectile.size / 2,
    -projectile.size / 8,
    projectile.size,
    projectile.size / 4,
  );
  ctx.restore();
}

function drawHazard(hazard) {
  ctx.save();
  ctx.translate(hazard.x, hazard.y);

  if (hazard.type === "shard") {
    ctx.fillStyle = "#8ed1ff";
    ctx.beginPath();
    ctx.moveTo(0, -hazard.radius);
    ctx.lineTo(hazard.radius, hazard.radius);
    ctx.lineTo(-hazard.radius, hazard.radius);
    ctx.closePath();
    ctx.fill();
  }

  if (hazard.type === "heal") {
    ctx.fillStyle = "#7ad66d";
    ctx.fillRect(-hazard.radius, -hazard.radius, hazard.radius * 2, hazard.radius * 2);
  }

  ctx.restore();
}

function drawFighter(fighter) {
  if (fighter.abilityName === "Lasso" && fighter.ability?.rope) {
    ctx.strokeStyle = "#7a4b21";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fighter.x, fighter.y);
    ctx.lineTo(fighter.ability.rope.x, fighter.ability.rope.y);
    ctx.stroke();

    ctx.fillStyle = "#7a4b21";
    ctx.beginPath();
    ctx.arc(fighter.ability.rope.x, fighter.ability.rope.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  if (fighter.abilityName === "Lasso" && fighter.ability?.hooked) {
    ctx.strokeStyle = "#7a4b21";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fighter.x, fighter.y);
    ctx.lineTo(fighter.ability.hooked.x, fighter.ability.hooked.y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(fighter.x, fighter.y, fighter.size, 0, Math.PI * 2);
  ctx.fillStyle = fighter.base.Color;
  ctx.fill();

  ctx.fillStyle = fighter.base.HPColor;
  ctx.font = `${fighter.size * 0.8}px Courier New`;
  ctx.fillText(Math.floor(fighter.hp), fighter.x, fighter.y);

  if (!fighter.weapon || !images[fighter.weapon.name]) {
    return;
  }

  const point = getWeaponPoint(fighter);
  const weaponX = point.x;
  const weaponY = point.y;

  ctx.save();
  ctx.translate(weaponX, weaponY);
  ctx.rotate(fighter.weapon.angle);
  ctx.drawImage(images[fighter.weapon.name], -15, -15, 30, 30);
  ctx.restore();
}

function getBattleDetails(fighter) {
  const weapon = fighter.weapon;
  const ability = fighter.base.Ability;
  if (ability === "Yoink" || ability === "Hoarder") {
    const lines = [`HP: ${Math.floor(fighter.hp)}`, `ABL: ${ability}`];
    const yoink = fighter.ability;
    lines.push(`STOLEN: ${yoink?.stolenThing ?? "None"}`);
    if (yoink?.activeTimer > 0) {
      lines.push(`LEFT: ${(yoink.activeTimer / 60).toFixed(1)}s`);
    }
    return lines;
  }

  if (!weapon) {
    const lines = [`HP: ${Math.floor(fighter.hp)}`];
    if (ability) {
      lines.push(`ABL: ${ability}`);
    }
    return lines;
  }

  if (weapon.name === "Sword") {
    const lines = [`HP: ${Math.floor(fighter.hp)}`, `DMG: ${weapon.damage}`];
    if (ability) {
      lines.push(`ABL: ${ability}`);
    }
    return lines;
  }
  if (weapon.name === "Axe") {
    const lines = [
      `HP: ${Math.floor(fighter.hp)}`,
      `CRIT: ${(weapon.critChance * 100).toFixed(1)}%`,
      `CRIT DMG: ${weapon.critDamage}`,
    ];
    if (ability) {
      lines.push(`ABL: ${ability}`);
    }
    return lines;
  }
  if (weapon.name === "Bow") {
    const lines = [
      `HP: ${Math.floor(fighter.hp)}`,
      `CD: ${weapon.fireRate}`,
    ];
    if (ability) {
      lines.push(`ABL: ${ability}`);
    }
    return lines;
  }
  if (weapon.name === "Shovel") {
    const lines = [
      `HP: ${Math.floor(fighter.hp)}`,
      `DUG: ${Math.floor(100 - weapon.digLeft)}%`,
    ];
    if (ability) {
      lines.push(`ABL: ${ability}`);
    }
    return lines;
  }
  if (weapon.name === "Dagger") {
    const lines = [
      `HP: ${Math.floor(fighter.hp)}`,
      `SPD: ${weapon.speedScale.toFixed(1)}`,
    ];
    if (ability) {
      lines.push(`ABL: ${ability}`);
    }
    return lines;
  }

  return [`HP: ${Math.floor(fighter.hp)}`];
}

function renderHud() {
  const left = fighters[0];
  const right = fighters[1];

  ui.leftName.textContent = left?.name ?? "";
  ui.rightName.textContent = right?.name ?? "";
  ui.leftStats.innerHTML = left ? getBattleDetails(left).join("<br>") : "";
  ui.rightStats.innerHTML = right ? getBattleDetails(right).join("<br>") : "";
}

function updateFighters() {
  for (const fighter of fighters) {
    fighter.rotation += fighter.spinSpeed;
    fighter.vy += CONFIG.gravity;
    fighter.x += fighter.vx;
    fighter.y += fighter.vy;

    confineToArena(fighter);
    fighter.ability?.tick?.();
    updateDaggerTracking(fighter);
    updateWeapon(fighter);
  }
}

function pruneDefeated() {
  for (let index = fighters.length - 1; index >= 0; index -= 1) {
    if (fighters[index].hp <= 0) {
      fighters.splice(index, 1);
    }
  }
}

function frame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (freezeFrames > 0) {
    freezeFrames -= 1;
  } else {
    updateFighters();
  }

  updateProjectiles();
  updateHazards();
  resolveFighterCollisions();
  pruneDefeated();

  for (const hazard of hazards) {
    drawHazard(hazard);
  }

  for (const projectile of projectiles) {
    drawProjectile(projectile);
  }

  for (const fighter of fighters) {
    drawFighter(fighter);
  }

  renderHud();
  requestAnimationFrame(frame);
}

Promise.all([
  fetch("balls.json").then((response) => response.json()),
  fetch("IMPLEMENTATION_STATUS.md").then((response) => response.text()),
]).then(([data, statusMarkdown]) => {
  setupMenu(data, statusMarkdown);
  frame();
});
