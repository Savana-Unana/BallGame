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
  slowButton: document.getElementById("slowButton"),
  fastButton: document.getElementById("fastButton"),
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
let battleSpeed = 1;
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
  arrow: new Audio("assets/shot.mp3"),
  yoink: new Audio("assets/yoink.mp3"),
  clash: new Audio("assets/clash.mp3"),
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
        applyDamage(this.owner, target, this.damage);
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
        applyDamage(this.owner, target, 1);
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
        applyDamage(this.owner, target, damage);
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
        applyDamage(this.owner, target, 1);
        this.digLeft = Math.max(0, this.digLeft - 100 / 5);
      },
    };
  },
  RPG() {
    return {
      name: "RPG",
      angle: 0,
      rotationSpeed: 0.1,
      cooldown: 0,
      fireRate: 90,
      explosionRadius: 50,
    };
  },
  Demo() {
    return {
      name: "Demo",
      angle: 0,
      rotationSpeed: 0.1,
      cooldown: 0,
      grenadeCooldown: 0,
      fireRate: 90,
      grenadeRate: 75,
      explosionRadius: 50,
    };
  },
  Staff() {
    return {
      name: "Staff",
      hitRadius: 16,
      angle: 0,
      rotationSpeed: 0.09,
      onHit(target) {
        applyDamage(this.owner, target, 1);
        this.owner.pendingHeal = (this.owner.pendingHeal ?? 0) + 1;
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
      disabledTarget: null,
      disabledWeapon: null,
      disabledAbility: null,
      disabledAbilityName: null,
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
            this.restoreYoinkState();
          }
        }
      },
      onDamaged(target) {
        if (this.timer > 0) {
          return;
        }

        if (this.activeTimer > 0) {
          this.restoreYoinkState();
        }

        const stolenWeapon = target.weapon ? { ...target.weapon } : null;
        if (stolenWeapon) {
          stolenWeapon.owner = this.owner;
        }

        if (stolenWeapon) {
          this.owner.weapon = stolenWeapon;
          this.stolenThing = target.base.Weapon ?? target.weapon?.name ?? "Weapon";
        } else if (target.base.Ability) {
          this.stolenThing = target.base.Ability;
        } else {
          this.stolenThing = "None";
        }
        applyDamage(this.owner, target, 1);
        this.disabledTarget = target;
        this.disabledWeapon = target.weapon;
        this.disabledAbility = target.ability;
        this.disabledAbilityName = target.abilityName;
        target.weapon = null;
        target.ability = null;
        target.abilityName = null;
        target.isDisarmed = true;
        this.activeTimer = 240;
        this.timer = 180;
        playSound(sounds.yoink);
      },
      restoreYoinkState() {
        this.owner.weapon = this.originalWeapon ? { ...this.originalWeapon } : null;
        if (this.owner.weapon) {
          this.owner.weapon.owner = this.owner;
        }

        if (this.disabledTarget) {
          this.disabledTarget.weapon = this.disabledWeapon;
          if (this.disabledTarget.weapon) {
            this.disabledTarget.weapon.owner = this.disabledTarget;
          }
          this.disabledTarget.ability = this.disabledAbility;
          this.disabledTarget.abilityName = this.disabledAbilityName;
          this.disabledTarget.isDisarmed = false;
        }

        this.disabledTarget = null;
        this.disabledWeapon = null;
        this.disabledAbility = null;
        this.disabledAbilityName = null;
        this.stolenThing = null;
        this.activeTimer = 0;
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
        for (let index = hazards.length - 1; index >= 0; index -= 1) {
          if (hazards[index].type === "shard" && hazards[index].owner === this.owner) {
            hazards.splice(index, 1);
          }
        }
        spawnShards(this.owner.x, this.owner.y, 1, this.owner, 180);
      },
    };
  },
  Fortress() {
    return {
      owner: null,
      init(owner) {
        this.owner = owner;
      },
      onHit() {
        this.owner.shield += 1;
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
  Phase() {
    return {
      owner: null,
      cooldown: 180,
      activeTimer: 0,
      phaseLength: 90,
      init(owner) {
        this.owner = owner;
      },
      tick() {
        if (this.activeTimer > 0) {
          this.activeTimer -= 1;
          this.owner.isPhasing = true;
          if (this.activeTimer === 0) {
            this.owner.isPhasing = false;
            this.cooldown = 180;
          }
          return;
        }

        this.owner.isPhasing = false;
        this.cooldown -= 1;
        if (this.cooldown <= 0) {
          this.activeTimer = this.phaseLength;
        }
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

function applyDamage(source, target, amount) {
  if (!target || amount <= 0) {
    return 0;
  }

  let remaining = amount;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
  }

  if (remaining > 0) {
    target.hp -= remaining;
  }

  return remaining;
}

function spawnShards(x, y, count, owner, ttl = 600) {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count;
    hazards.push({
      type: "shard",
      x: x + Math.cos(angle) * 28,
      y: y + Math.sin(angle) * 28,
      radius: 8,
      ttl,
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

function spawnExplosion(x, y, radius, damage, owner, color = "#ff9c2f") {
  hazards.push({
    type: "explosion",
    x,
    y,
    radius,
    ttl: 14,
    color,
  });

  for (const fighter of fighters) {
    if (fighter === owner) {
      continue;
    }
    if (fighter.isPhasing) {
      continue;
    }
    if (Math.hypot(fighter.x - x, fighter.y - y) <= fighter.size + radius) {
      applyDamage(owner, fighter, damage);
      fighter.ability?.onDamaged?.(owner);
      owner?.ability?.onHit?.(fighter);
    }
  }
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

function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const abLengthSq = abx * abx + aby * aby;
  if (abLengthSq === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = clamp(((px - ax) * abx + (py - ay) * aby) / abLengthSq, 0, 1);
  const closestX = ax + abx * t;
  const closestY = ay + aby * t;
  return Math.hypot(px - closestX, py - closestY);
}

function areFamilySafe(source, target) {
  if (!source || !target) {
    return false;
  }

  if (source === target) {
    return true;
  }

  const sourceParent = source.isChild ? source.parent : source;
  const targetParent = target.isChild ? target.parent : target;
  return Boolean(sourceParent && targetParent && sourceParent === targetParent);
}

function getFortressShieldPoints(fighter) {
  if (fighter.abilityName !== "Fortress" || !fighter.ability) {
    return [];
  }

  const points = [];
  const shieldCount = Math.max(1, Math.floor(fighter.shield || 1));
  const orbitRadius = fighter.size + 22;

  for (let index = 0; index < shieldCount; index += 1) {
    const angle =
      fighter.ability.angle + (Math.PI * 2 * index) / shieldCount;
    points.push({
      x: fighter.x + Math.cos(angle) * orbitRadius,
      y: fighter.y + Math.sin(angle) * orbitRadius,
      radius: fighter.ability.hitRadius ?? 16,
      angle,
    });
  }

  return points;
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

function spawnChild(owner, direction) {
  const babyBase = roster?.Baby ?? {};
  const childBase = {
    HP: 30,
    Size: babyBase.Size ?? 24,
    Speed: babyBase.Speed ?? 2,
    Weight: babyBase.Weight ?? 0.7,
    Color: babyBase.Color ?? "pink",
    HPColor: babyBase.HPColor ?? "black",
    Ability: null,
    Weapon: null,
  };

  const child = createFighter(
    `${owner.name} Child`,
    childBase,
    owner.x + direction * ((owner.size ?? 30) + (childBase.Size ?? 24) + 8),
    owner.y - 8,
  );
  child.isChild = true;
  child.parent = owner;
  child.vx = direction * 2;
  child.vy = -2;
  return child;
}

weaponFactories.Bow = function BowFactory() {
  return {
    name: "Bow",
    angle: 0,
    rotationSpeed: 0.1,
    cooldown: 12,
    fireRate: 12,
    arrowCount: 1,
  };
};

weaponFactories.Needle = function NeedleFactory() {
  return {
    name: "Needle",
    hitRadius: 12,
    angle: 0,
    rotationSpeed: 0.12,
    onHit(target) {
      const initialInterval = 600;
      const intervalStep = 30;
      const minimumInterval = 6;

      if (!target.needleInterval) {
        target.needleInterval = initialInterval;
        target.needleTimer = initialInterval;
        return;
      }

      target.needleInterval = Math.max(
        minimumInterval,
        target.needleInterval - intervalStep,
      );
      target.needleTimer = Math.max(1, target.needleTimer - intervalStep);
    },
  };
};

weaponFactories.Mace = function MaceFactory() {
  return {
    name: "Mace",
    hitRadius: 18,
    angle: 0,
    rotationSpeed: 0.09,
    stunLength: 36,
    onHit(target) {
      applyDamage(this.owner, target, 1);
      target.stunTimer = Math.max(target.stunTimer ?? 0, this.stunLength);
      this.stunLength += 1;
    },
  };
};

weaponFactories.Concussor = function ConcussorFactory() {
  return {
    name: "Concussor",
    hitRadius: 20,
    angle: 0,
    rotationSpeed: 0.09,
    stunLength: 42,
    onHit(target) {
      applyDamage(this.owner, target, 1);
      target.stunTimer = Math.max(target.stunTimer ?? 0, this.stunLength);
      target.disarmTimer = Math.max(
        target.disarmTimer ?? 0,
        this.stunLength,
      );
      this.stunLength += 1;
    },
  };
};

abilityFactories.Parry = function ParryFactory() {
  return {
    owner: null,
    cooldown: 240,
    activeTimer: 0,
    activeLength: 48,
    init(owner) {
      this.owner = owner;
    },
    tick() {
      if (this.activeTimer > 0) {
        this.activeTimer -= 1;
        this.owner.isParrying = true;
        return;
      }

      this.owner.isParrying = false;
      this.cooldown -= 1;
      if (this.cooldown <= 0) {
        this.activeTimer = this.activeLength;
        this.cooldown = 240;
      }
    },
    onParry() {
      this.activeLength += 2;
    },
  };
};

abilityFactories.Stunlock = function StunlockFactory() {
  return {
    owner: null,
    cooldown: 270,
    activeTimer: 0,
    activeLength: 56,
    init(owner) {
      this.owner = owner;
    },
    tick() {
      if (this.activeTimer > 0) {
        this.activeTimer -= 1;
        this.owner.isParrying = true;
        return;
      }

      this.owner.isParrying = false;
      this.cooldown -= 1;
      if (this.cooldown <= 0) {
        this.activeTimer = this.activeLength;
        this.cooldown = 270;
      }
    },
    onParry(source) {
      this.activeLength += 2;
      if (!source) {
        return;
      }
      source.stunTimer = Math.max(source.stunTimer ?? 0, this.activeLength);
      source.disarmTimer = Math.max(source.disarmTimer ?? 0, this.activeLength);
    },
  };
};

abilityFactories.Mother = function MotherFactory() {
  return {
    owner: null,
    timer: 600,
    children: [],
    init(owner) {
      this.owner = owner;
      this.timer = 600;
      this.children = [];
    },
    tick() {
      this.timer -= 1;
      this.children = this.children.filter((child) => fighters.includes(child));
      if (this.timer <= 0 && this.children.length === 0) {
        this.children.push(spawnChild(this.owner, -1));
        this.children.push(spawnChild(this.owner, 1));
        this.timer = 600;
      }
    },
  };
};

abilityFactories.Daycare = function DaycareFactory() {
  return {
    owner: null,
    timer: 600,
    children: [],
    init(owner) {
      this.owner = owner;
      this.timer = 600;
      this.children = [];
    },
    tick() {
      this.timer -= 1;
      this.children = this.children.filter((child) => fighters.includes(child));
      if (this.timer <= 0 && this.children.length === 0) {
        this.children.push(spawnChild(this.owner, -1));
        this.children.push(spawnChild(this.owner, 1));
        this.timer = 600;
      }

      for (const child of this.children) {
        if (Math.hypot(child.x - this.owner.x, child.y - this.owner.y) <= child.size + this.owner.size) {
          child.hp = Math.min(child.maxHp, child.hp + 1);
          this.owner.hp = Math.min(this.owner.maxHp, this.owner.hp + 1);
        }
      }
    },
  };
};

abilityFactories.Fortress = function FortressFactory() {
  return {
    owner: null,
    angle: 0,
    rotationSpeed: 0.08,
    hitRadius: 16,
    init(owner) {
      this.owner = owner;
      owner.shield = Math.max(1, owner.shield || 1);
    },
    tick() {
      this.angle += this.rotationSpeed;
    },
    onHit() {
      this.owner.shield += 1;
    },
  };
};

const originalApplyDamage = applyDamage;
applyDamage = function applyDamageOverride(source, target, amount, ignoreParry = false) {
  const dealt = originalApplyDamage(source, target, amount, ignoreParry);
  if (dealt > 0 && source?.weapon?.name === "Bow") {
    source.weapon.arrowCount = (source.weapon.arrowCount ?? 1) + 1;
  }
  return dealt;
};

const originalSpawnExplosion = spawnExplosion;
spawnExplosion = function spawnExplosionOverride(...args) {
  playSound(sounds.explosionQuiet);
  return originalSpawnExplosion(...args);
};

const originalGetBodyDamage = getBodyDamage;
getBodyDamage = function getBodyDamageOverride(attacker, target) {
  if (attacker?.abilityName === "Lasso") {
    return 2;
  }
  return originalGetBodyDamage(attacker, target);
};

fireArrow = function fireArrowOverride(owner, weapon) {
  const arrowCount = Math.max(1, weapon.arrowCount ?? 1);
  const spread = Math.min(0.45, 0.06 * (arrowCount - 1));

  for (let index = 0; index < arrowCount; index += 1) {
    const offset =
      arrowCount === 1 ? 0 : -spread / 2 + (spread * index) / (arrowCount - 1);
    const angle = weapon.angle + offset;
    projectiles.push({
      type: "arrow",
      x: owner.x + Math.cos(angle) * (owner.size + 5),
      y: owner.y + Math.sin(angle) * (owner.size + 5),
      vx: Math.cos(angle) * 8,
      vy: Math.sin(angle) * 8,
      owner,
      damage: 1,
      size: owner.size * 2.4,
    });
  }

  weapon.cooldown = weapon.fireRate;
  playSound(sounds.arrow);
};

applyShovelEffect = function applyShovelEffectOverride(attacker, target) {
  const reduction = Math.max(target.maxSize / 12, 1);
  const minSize = target.maxSize / 12;
  const nextSize = Math.max(minSize, target.size - reduction);
  const hitMinimum = target.size > minSize && nextSize <= minSize;
  target.size = nextSize;

  if (hitMinimum) {
    applyDamage(attacker, target, 10);
  }

  if (attacker.base.Weapon === "Split") {
    const hpLoss = Math.max(target.maxHp / 12, 1);
    applyDamage(attacker, target, hpLoss);
    spawnHealCube(target.x, target.y, hpLoss);
  }
};

const previousCreateFighter = createFighter;
createFighter = function createFighterOverride(name, base, x, y, isDuplicate = false) {
  const fighter = previousCreateFighter(name, base, x, y, isDuplicate);
  if (fighter.weapon?.name === "Bow") {
    fighter.weapon.cooldown = 12;
    fighter.weapon.fireRate = 12;
    fighter.weapon.arrowCount = Math.max(1, fighter.weapon.arrowCount ?? 1);
  }
  if (fighter.abilityName === "Fortress") {
    fighter.shield = Math.max(1, fighter.shield || 1);
  }
  return fighter;
};

abilityFactories.Glass = function GlassFactory() {
  return {
    owner: null,
    init(owner) {
      this.owner = owner;
    },
    onDamaged() {
      spawnShards(this.owner.x, this.owner.y, 1, this.owner, 999999);
      const shard = hazards[hazards.length - 1];
      if (shard) {
        shard.persistent = true;
      }
    },
  };
};

spawnShards = function spawnShardsOverride(x, y, count, owner, ttl = 999999) {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / Math.max(count, 1);
    hazards.push({
      type: "shard",
      x: x + Math.cos(angle) * 28,
      y: y + Math.sin(angle) * 28,
      radius: 10,
      damage: 1,
      owner,
      ttl,
      persistent: true,
    });
  }
};

updateHazards = function updateHazardsOverride() {
  for (const hazard of hazards) {
    if (!hazard.persistent) {
      hazard.ttl -= 1;
    }

    for (const fighter of fighters) {
      if (hazard.type === "shard" && hazard.owner === fighter) {
        continue;
      }

      if (hazard.type === "shard" && areFamilySafe(hazard.owner, fighter)) {
        continue;
      }

      if (Math.hypot(fighter.x - hazard.x, fighter.y - hazard.y) > fighter.size + hazard.radius) {
        continue;
      }

      if (hazard.type === "shard") {
        applyDamage(hazard.owner, fighter, hazard.damage);
        if (!hazard.persistent) {
          hazard.dead = true;
        }
      }

      if (hazard.type === "heal") {
        fighter.hp = Math.min(fighter.maxHp, fighter.hp + hazard.amount);
        hazard.dead = true;
      }

      if (hazard.type === "explosion") {
        applyDamage(hazard.owner, fighter, hazard.damage);
      }
    }
  }

  for (let index = hazards.length - 1; index >= 0; index -= 1) {
    const hazard = hazards[index];
    if (hazard.dead || (!hazard.persistent && hazard.ttl <= 0)) {
      hazards.splice(index, 1);
    }
  }
};

abilityFactories.Yoink = function YoinkFactory() {
  return {
    owner: null,
    timer: 180,
    activeTimer: 0,
    stealCooldown: 0,
    stolenThing: null,
    originalWeapon: null,
    originalWeaponLabel: null,
    disabledTarget: null,
    disabledWeapon: null,
    disabledAbility: null,
    disabledAbilityName: null,
    init(owner) {
      this.owner = owner;
      this.originalWeapon = owner.weapon ? { ...owner.weapon } : null;
      if (this.originalWeapon) {
        this.originalWeapon.owner = owner;
      }
      this.originalWeaponLabel = owner.base.Weapon;
    },
    tick() {
      this.timer = Math.max(0, this.timer - 1);
      this.stealCooldown = Math.max(0, this.stealCooldown - 1);
      if (this.activeTimer > 0) {
        this.activeTimer -= 1;
        if (this.activeTimer <= 0) {
          this.restoreYoinkState();
        }
      }
    },
    onHit(target) {
      if (!target || this.stealCooldown > 0) {
        return;
      }

      if (this.activeTimer > 0) {
        this.restoreYoinkState();
      }

      if (target.weapon) {
        this.owner.weapon = { ...target.weapon };
        this.owner.weapon.owner = this.owner;
        this.stolenThing = target.base.Weapon;
      } else {
        this.owner.weapon = null;
        this.stolenThing = target.base.Ability ?? "None";
      }

      applyDamage(this.owner, target, 1);
      this.disabledTarget = target;
      this.disabledWeapon = target.weapon;
      this.disabledAbility = target.ability;
      this.disabledAbilityName = target.abilityName;
      target.weapon = null;
      target.ability = null;
      target.abilityName = null;
      target.isDisarmed = true;
      this.activeTimer = 240;
      this.timer = 180;
      this.stealCooldown = 120;
      playSound(sounds.yoink);
    },
    restoreYoinkState() {
      this.owner.weapon = this.originalWeapon ? { ...this.originalWeapon } : null;
      if (this.owner.weapon) {
        this.owner.weapon.owner = this.owner;
      }

      if (this.disabledTarget) {
        this.disabledTarget.weapon = this.disabledWeapon;
        if (this.disabledTarget.weapon) {
          this.disabledTarget.weapon.owner = this.disabledTarget;
        }
        this.disabledTarget.ability = this.disabledAbility;
        this.disabledTarget.abilityName = this.disabledAbilityName;
        this.disabledTarget.isDisarmed = false;
      }

      this.disabledTarget = null;
      this.disabledWeapon = null;
      this.disabledAbility = null;
      this.disabledAbilityName = null;
      this.stolenThing = null;
      this.activeTimer = 0;
    },
  };
};

abilityFactories.Parry = function WorkingParryFactory() {
  return {
    owner: null,
    cooldownMax: 240,
    cooldown: 90,
    activeTimer: 0,
    activeLength: 54,
    init(owner) {
      this.owner = owner;
    },
    tick() {
      if (this.activeTimer > 0) {
        this.activeTimer -= 1;
        this.owner.isParrying = true;
        return;
      }

      this.owner.isParrying = false;
      this.cooldown -= 1;
      if (this.cooldown <= 0) {
        this.activeTimer = this.activeLength;
        this.cooldown = this.cooldownMax;
      }
    },
    onParry() {
      this.activeLength += 2;
    },
  };
};

abilityFactories.Stunlock = function WorkingStunlockFactory() {
  return {
    owner: null,
    cooldownMax: 270,
    cooldown: 100,
    activeTimer: 0,
    activeLength: 62,
    init(owner) {
      this.owner = owner;
    },
    tick() {
      if (this.activeTimer > 0) {
        this.activeTimer -= 1;
        this.owner.isParrying = true;
        return;
      }

      this.owner.isParrying = false;
      this.cooldown -= 1;
      if (this.cooldown <= 0) {
        this.activeTimer = this.activeLength;
        this.cooldown = this.cooldownMax;
      }
    },
    onParry(source) {
      this.activeLength += 2;
      if (!source) {
        return;
      }
      source.stunTimer = Math.max(source.stunTimer ?? 0, this.activeLength);
      source.disarmTimer = Math.max(source.disarmTimer ?? 0, this.activeLength);
    },
  };
};

getFortressShieldPoints = function getFortressShieldPointsOverride(fighter) {
  if (fighter.abilityName !== "Fortress" || !fighter.ability) {
    return [];
  }

  const points = [];
  const shieldCount = Math.max(1, Math.floor(fighter.shield || 1));
  const orbitRadius = fighter.size + 22;

  for (let index = 0; index < shieldCount; index += 1) {
    const angle =
      fighter.ability.angle + (Math.PI * 2 * index) / shieldCount;
    points.push({
      x: fighter.x + Math.cos(angle) * orbitRadius,
      y: fighter.y + Math.sin(angle) * orbitRadius,
      radius: fighter.ability.hitRadius ?? 16,
      angle,
    });
  }

  return points;
};

const previousResolveWeaponCollisions = resolveWeaponCollisions;
resolveWeaponCollisions = function resolveWeaponCollisionsOverride() {
  const disabledBowWeapons = [];
  for (const fighter of fighters) {
    if (fighter.weapon?.name === "Bow") {
      disabledBowWeapons.push([fighter, fighter.weapon]);
      fighter.weapon = null;
    }
  }

  previousResolveWeaponCollisions();

  for (const [fighter, weapon] of disabledBowWeapons) {
    fighter.weapon = weapon;
  }
};

applyDamage = function applyDamageFinalOverride(source, target, amount, ignoreParry = false) {
  if (!target || amount <= 0) {
    return 0;
  }

  if (areFamilySafe(source, target)) {
    return 0;
  }

  if (
    !ignoreParry &&
    source &&
    target.ability &&
    target.ability.activeTimer > 0 &&
    (target.abilityName === "Parry" || target.abilityName === "Stunlock")
  ) {
    target.ability.onParry?.(source);
    applyDamage(target, source, amount + 1, true);
    return 0;
  }

  target.hp -= amount;

  if (source?.weapon?.name === "Bow") {
    source.weapon.arrowCount = (source.weapon.arrowCount ?? 1) + 1;
    source.weapon.fireRate = Math.max(4, source.weapon.fireRate - 1);
    source.weapon.cooldown = Math.min(source.weapon.cooldown, source.weapon.fireRate);
  }

  return amount;
};

weaponFactories.Bow = function BowFactory() {
  return {
    name: "Bow",
    angle: 0,
    rotationSpeed: 0.1,
    cooldown: 35,
    fireRate: 14,
  };
};

abilityFactories.Parry = function ParryFactory() {
  return {
    owner: null,
    cooldown: 240,
    activeTimer: 0,
    activeLength: 48,
    init(owner) {
      this.owner = owner;
    },
    tick() {
      if (this.activeTimer > 0) {
        this.activeTimer -= 1;
        this.owner.isParrying = true;
        return;
      }

      this.owner.isParrying = false;
      this.cooldown -= 1;
      if (this.cooldown <= 0) {
        this.activeTimer = this.activeLength;
        this.cooldown = 240;
      }
    },
    onParry() {
      this.activeLength += 2;
    },
  };
};

abilityFactories.Stunlock = function StunlockFactory() {
  return {
    owner: null,
    cooldown: 270,
    activeTimer: 0,
    activeLength: 56,
    init(owner) {
      this.owner = owner;
    },
    tick() {
      if (this.activeTimer > 0) {
        this.activeTimer -= 1;
        this.owner.isParrying = true;
        return;
      }

      this.owner.isParrying = false;
      this.cooldown -= 1;
      if (this.cooldown <= 0) {
        this.activeTimer = this.activeLength;
        this.cooldown = 270;
      }
    },
    onParry(source) {
      this.activeLength += 2;
      if (!source) {
        return;
      }
      source.stunTimer = Math.max(source.stunTimer ?? 0, this.activeLength);
      source.disarmTimer = Math.max(source.disarmTimer ?? 0, this.activeLength);
    },
  };
};

abilityFactories.Mother = function MotherFactory() {
  return {
    owner: null,
    timer: 600,
    children: [],
    init(owner) {
      this.owner = owner;
      this.timer = 600;
      this.children = [];
    },
    tick() {
      this.timer -= 1;
      this.children = this.children.filter((child) => fighters.includes(child));
      if (this.timer <= 0 && this.children.length === 0) {
        this.children.push(spawnChild(this.owner, -1));
        this.children.push(spawnChild(this.owner, 1));
        this.timer = 600;
      }
    },
  };
};

abilityFactories.Daycare = function DaycareFactory() {
  return {
    owner: null,
    timer: 600,
    children: [],
    init(owner) {
      this.owner = owner;
      this.timer = 600;
      this.children = [];
    },
    tick() {
      this.timer -= 1;
      this.children = this.children.filter((child) => fighters.includes(child));
      if (this.timer <= 0 && this.children.length === 0) {
        this.children.push(spawnChild(this.owner, -1));
        this.children.push(spawnChild(this.owner, 1));
        this.timer = 600;
      }

      for (const child of this.children) {
        if (Math.hypot(child.x - this.owner.x, child.y - this.owner.y) <= child.size + this.owner.size) {
          child.hp = Math.min(child.maxHp, child.hp + 1);
          this.owner.hp = Math.min(this.owner.maxHp, this.owner.hp + 1);
        }
      }
    },
  };
};

weaponFactories.Mace = function MaceFactory() {
  return {
    name: "Mace",
    hitRadius: 18,
    angle: 0,
    rotationSpeed: 0.09,
    stunLength: 36,
    onHit(target) {
      applyDamage(this.owner, target, 1);
      target.stunTimer = Math.max(target.stunTimer ?? 0, this.stunLength);
      this.stunLength += 1;
    },
  };
};

weaponFactories.Concussor = function ConcussorFactory() {
  return {
    name: "Concussor",
    hitRadius: 20,
    angle: 0,
    rotationSpeed: 0.09,
    stunLength: 42,
    onHit(target) {
      applyDamage(this.owner, target, 1);
      target.stunTimer = Math.max(target.stunTimer ?? 0, this.stunLength);
      target.disarmTimer = Math.max(target.disarmTimer ?? 0, Math.floor(this.stunLength / 2));
      this.stunLength += 1;
    },
  };
};

fireArrow = function fireArrowOverride(owner, weapon) {
  projectiles.push({
    type: "arrow",
    x: owner.x + Math.cos(weapon.angle) * (owner.size + 5),
    y: owner.y + Math.sin(weapon.angle) * (owner.size + 5),
    vx: Math.cos(weapon.angle) * 8,
    vy: Math.sin(weapon.angle) * 8,
    owner,
    damage: 1,
    size: owner.size * 2.4,
  });

  weapon.cooldown = weapon.fireRate;
  playSound(sounds.arrow);
};

function resolveWeaponBallCollisions() {
  for (const fighter of fighters) {
    const weapon = fighter.weapon;
    if (
      !weapon ||
      fighter.disarmTimer > 0 ||
      weapon.name === "Bow" ||
      weapon.name === "RPG" ||
      weapon.name === "Demo" ||
      weapon.name === "Ruler"
    ) {
      continue;
    }

    const point = getWeaponPoint(fighter);
    const weaponRadius = (weapon.hitRadius ?? 15) + 6;

    for (const other of fighters) {
      if (other === fighter || other.isPhasing || areFamilySafe(fighter, other)) {
        continue;
      }

      const hitDistance = pointToSegmentDistance(
        other.x,
        other.y,
        fighter.x,
        fighter.y,
        point.x,
        point.y,
      );

      if (hitDistance >= other.size + weaponRadius) {
        continue;
      }

      const dx = other.x - point.x;
      const dy = other.y - point.y;
      const distance = Math.max(Math.hypot(dx, dy), 0.1);
      const nx = dx / distance;
      const ny = dy / distance;

      other.vx += nx * 0.45;
      other.vy += ny * 0.45;
      fighter.vx -= nx * 0.2;
      fighter.vy -= ny * 0.2;
    }
  }
}

const originalResolveWeaponCollisions = resolveWeaponCollisions;
let clashSoundCooldown = 0;

resolveWeaponCollisions = function wrappedResolveWeaponCollisions() {
  if (clashSoundCooldown > 0) {
    clashSoundCooldown -= 1;
  }

  let hasClash = false;
  for (let index = 0; index < fighters.length && !hasClash; index += 1) {
    const fighter = fighters[index];
    if (!fighter.weapon || fighter.disarmTimer > 0) {
      continue;
    }

    const a = getWeaponPoint(fighter);
    const aRadius = fighter.weapon.hitRadius ?? 15;

    for (let otherIndex = index + 1; otherIndex < fighters.length; otherIndex += 1) {
      const other = fighters[otherIndex];
      if (!other.weapon || other.disarmTimer > 0) {
        continue;
      }

      const b = getWeaponPoint(other);
      const bRadius = other.weapon.hitRadius ?? 15;
      if (Math.hypot(a.x - b.x, a.y - b.y) < aRadius + bRadius) {
        hasClash = true;
        break;
      }
    }
  }

  resolveWeaponBallCollisions();
  originalResolveWeaponCollisions();

  if (hasClash && clashSoundCooldown === 0) {
    playSound(sounds.clash);
    clashSoundCooldown = 8;
  }
};


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

function slowBattle() {
  battleSpeed = Math.max(0.25, battleSpeed - 0.25);
}

function speedBattle() {
  battleSpeed = Math.min(3, battleSpeed + 0.25);
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
  duplicate.shield = owner.shield;
  duplicate.isPhasing = owner.isPhasing;
  duplicate.pendingHeal = owner.pendingHeal;
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

  if (!a.weapon && !b.isPhasing) {
    applyDamage(a, b, aBodyDamage);
  }
  if (!b.weapon && !a.isPhasing) {
    applyDamage(b, a, bBodyDamage);
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
    type: "arrow",
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

function fireRocket(owner, weapon, type = "rocket") {
  if (type === "grenade") {
    projectiles.push({
      type: "grenade",
      x: owner.x,
      y: owner.y,
      vx: 0,
      vy: 0,
      owner,
      damage: 3,
      explosionRadius: weapon.explosionRadius,
      color: "#4f9d69",
      size: 9,
      fuse: 36,
    });
    return;
  }

  const speed = 6;
  projectiles.push({
    type,
    x: owner.x + Math.cos(weapon.angle) * (owner.size + 8),
    y: owner.y + Math.sin(weapon.angle) * (owner.size + 8),
    vx: Math.cos(weapon.angle) * speed,
    vy: Math.sin(weapon.angle) * speed,
    owner,
    damage: 2,
    explosionRadius: weapon.explosionRadius,
    color: "#5a5a5a",
    size: 11,
  });
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

  if (weapon.name === "RPG" || weapon.name === "Demo") {
    weapon.angle += weapon.rotationSpeed;

    weapon.cooldown = Math.max(0, weapon.cooldown - 1);
    if (weapon.cooldown === 0) {
      fireRocket(fighter, weapon, "rocket");
      weapon.explosionRadius += 1;
      weapon.cooldown = weapon.fireRate;
    }

    if (weapon.name === "Demo") {
      weapon.grenadeCooldown = Math.max(0, weapon.grenadeCooldown - 1);
      if (weapon.grenadeCooldown === 0) {
        fireRocket(fighter, weapon, "grenade");
        weapon.grenadeCooldown = weapon.grenadeRate;
      }
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
    if (other.isPhasing) {
      continue;
    }

    const hitDistance = pointToSegmentDistance(
      other.x,
      other.y,
      fighter.x,
      fighter.y,
      weaponX,
      weaponY,
    );

    if (hitDistance < other.size + weaponRadius) {
      weapon.hitCooldowns.set(other, now);
      weapon.onHit?.(other);
      fighter.ability?.onHit?.(other);
      other.ability?.onDamaged?.(fighter);
      if (fighter.pendingHeal > 0) {
        fighter.hp = Math.min(fighter.maxHp, fighter.hp + fighter.pendingHeal);
        fighter.pendingHeal = 0;
      }
    }
  }
}

function applyShovelEffect(attacker, target) {
  const reduction = Math.max(target.maxSize / 5, 1);
  target.size = Math.max(target.maxSize / 5, target.size - reduction);

  if (attacker.base.Weapon === "Split") {
    const hpLoss = Math.max(target.maxHp / 5, 1);
    applyDamage(attacker, target, hpLoss);
    spawnHealCube(target.x, target.y, hpLoss);
  }
}

function updateProjectiles() {
  for (const projectile of projectiles) {
    projectile.x += projectile.vx;
    projectile.y += projectile.vy;
    if (projectile.type === "grenade") {
      projectile.fuse -= 1;
      if (projectile.fuse <= 0) {
        spawnExplosion(
          projectile.x,
          projectile.y,
          projectile.explosionRadius,
          projectile.damage,
          projectile.owner,
          "#77c86a",
        );
        projectile.dead = true;
      }
    }

    for (const fighter of fighters) {
      if (fighter === projectile.owner) {
        continue;
      }
      if (fighter.isPhasing) {
        continue;
      }

      if (Math.hypot(fighter.x - projectile.x, fighter.y - projectile.y) < fighter.size) {
        if (projectile.type === "arrow") {
          projectile.dead = true;
          applyDamage(projectile.owner, fighter, projectile.damage);
          projectile.owner.ability?.onHit?.(fighter);
          fighter.ability?.onDamaged?.(projectile.owner);
        } else if (projectile.type === "rocket") {
          projectile.dead = true;
          spawnExplosion(
            projectile.x,
            projectile.y,
            projectile.explosionRadius,
            projectile.damage,
            projectile.owner,
            projectile.type === "grenade" ? "#77c86a" : "#ff8c42",
          );
        }

        if (projectile.type === "arrow" && projectile.owner.weapon?.name === "Bow") {
          const bow = projectile.owner.weapon;
          bow.fireRate = Math.max(5, bow.fireRate - 1);
          bow.cooldown = Math.min(bow.cooldown, bow.fireRate);
        }
      }
    }
  }

  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = projectiles[index];
    const hitsWall =
      projectile.x < 0 ||
      projectile.x > canvas.width ||
      projectile.y < 0 ||
      projectile.y > canvas.height;
    if (projectile.type === "rocket" && hitsWall) {
      spawnExplosion(
        clamp(projectile.x, 0, canvas.width),
        clamp(projectile.y, 0, canvas.height),
        projectile.explosionRadius,
        projectile.damage,
        projectile.owner,
        projectile.type === "grenade" ? "#77c86a" : "#ff8c42",
      );
      projectile.dead = true;
    }

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
        applyDamage(hazard.owner, fighter, hazard.damage);
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

function resolveWeaponCollisions() {
  for (let i = 0; i < fighters.length; i += 1) {
    for (let j = i + 1; j < fighters.length; j += 1) {
      const a = fighters[i];
      const b = fighters[j];
      if (!a.weapon || !b.weapon) {
        continue;
      }
      if (a.isPhasing || b.isPhasing) {
        continue;
      }

      const aPoint = getWeaponPoint(a);
      const bPoint = getWeaponPoint(b);
      const aRadius = a.weapon.hitRadius ?? 15;
      const bRadius = b.weapon.hitRadius ?? 15;
      const distance = Math.hypot(aPoint.x - bPoint.x, aPoint.y - bPoint.y);
      if (distance >= aRadius + bRadius) {
        continue;
      }

      a.weapon.clashCooldowns ??= new Map();
      b.weapon.clashCooldowns ??= new Map();
      const now = performance.now();
      const aLast = a.weapon.clashCooldowns.get(b);
      const bLast = b.weapon.clashCooldowns.get(a);
      if ((aLast && now - aLast < CONFIG.hitCooldownMs) || (bLast && now - bLast < CONFIG.hitCooldownMs)) {
        continue;
      }

      a.weapon.clashCooldowns.set(b, now);
      b.weapon.clashCooldowns.set(a, now);

      const safeDistance = distance || 0.1;
      const nx = (bPoint.x - aPoint.x) / safeDistance;
      const ny = (bPoint.y - aPoint.y) / safeDistance;
      const clashForce = 3;

      a.vx -= (nx * clashForce) / a.base.Weight;
      a.vy -= (ny * clashForce) / a.base.Weight;
      b.vx += (nx * clashForce) / b.base.Weight;
      b.vy += (ny * clashForce) / b.base.Weight;

      if (typeof a.weapon.angle === "number") {
        a.weapon.angle -= 0.08;
      }
      if (typeof b.weapon.angle === "number") {
        b.weapon.angle += 0.08;
      }
    }
  }
}

function resolveFighterCollisions() {
  for (let i = 0; i < fighters.length; i += 1) {
    for (let j = i + 1; j < fighters.length; j += 1) {
      const a = fighters[i];
      const b = fighters[j];
      if (a.isPhasing || b.isPhasing) {
        continue;
      }
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
  if (projectile.type === "rocket" || projectile.type === "grenade") {
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(Math.atan2(projectile.vy, projectile.vx));
    ctx.fillStyle = projectile.color;
    ctx.fillRect(-projectile.size, -projectile.size / 2, projectile.size * 2, projectile.size);
    ctx.fillStyle = "#f6d365";
    ctx.fillRect(projectile.size, -projectile.size / 3, projectile.size, (projectile.size * 2) / 3);
    ctx.restore();
    return;
  }

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

  if (hazard.type === "explosion") {
    ctx.globalAlpha = hazard.ttl / 14;
    ctx.fillStyle = hazard.color;
    ctx.beginPath();
    ctx.arc(0, 0, hazard.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawFallbackWeapon(fighter) {
  const point = getWeaponPoint(fighter);
  const weapon = fighter.weapon;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(weapon.angle);

  if (weapon.name === "Staff") {
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(-3, -18, 6, 36);
    ctx.beginPath();
    ctx.fillStyle = "#38b26d";
    ctx.arc(0, -20, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (weapon.name === "RPG" || weapon.name === "Demo") {
    ctx.fillStyle = "#3f4a59";
    ctx.fillRect(-16, -5, 32, 10);
    ctx.fillStyle = "#d5a021";
    ctx.fillRect(10, -3, 10, 6);
  } else {
    ctx.fillStyle = "#222";
    ctx.fillRect(-14, -4, 28, 8);
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

  ctx.save();
  ctx.globalAlpha = fighter.isPhasing ? 0.45 : 1;
  ctx.beginPath();
  ctx.arc(fighter.x, fighter.y, fighter.size, 0, Math.PI * 2);
  ctx.fillStyle = fighter.base.Color;
  ctx.fill();

  ctx.fillStyle = fighter.base.HPColor;
  ctx.font = `${fighter.size * 0.8}px Courier New`;
  ctx.fillText(Math.floor(fighter.hp), fighter.x, fighter.y);

  if (fighter.abilityName === "Fortress") {
    ctx.strokeStyle = "#7d8a97";
    ctx.lineWidth = 6 + Math.min(fighter.shield, 6);
    ctx.beginPath();
    ctx.arc(fighter.x, fighter.y, fighter.size + 8, -0.8, 0.8);
    ctx.stroke();
  }

  if (!fighter.weapon) {
    ctx.restore();
    return;
  }

  const point = getWeaponPoint(fighter);
  const weaponX = point.x;
  const weaponY = point.y;

  ctx.save();
  ctx.translate(weaponX, weaponY);
  ctx.rotate(fighter.weapon.angle);
  if (images[fighter.weapon.name]) {
    ctx.drawImage(images[fighter.weapon.name], -15, -15, 30, 30);
  } else {
    ctx.restore();
    drawFallbackWeapon(fighter);
    ctx.restore();
    return;
  }
  ctx.restore();
  ctx.restore();
}

function getBattleDetails(fighter) {
  const weapon = fighter.weapon;
  const ability = fighter.base.Ability;
  if (fighter.abilityName === "Fortress") {
    return [
      `HP: ${Math.floor(fighter.hp)}`,
      `SHIELD: ${fighter.shield}`,
    ];
  }
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
    if (fighter.isDisarmed) {
      lines.push("DISABLED");
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
  if (weapon.name === "RPG" || weapon.name === "Demo") {
    const lines = [
      `HP: ${Math.floor(fighter.hp)}`,
      `BLAST: ${Math.floor(weapon.explosionRadius)}`,
      `CD: ${weapon.fireRate}`,
    ];
    if (weapon.name === "Demo") {
      lines.push(`GRN: ${weapon.grenadeRate}`);
    }
    return lines;
  }
  if (weapon.name === "Staff") {
    return [
      `HP: ${Math.floor(fighter.hp)}`,
      "STAFF: HEAL",
    ];
  }

  if (ability === "Phase") {
    const phase = fighter.ability;
    return [
      `HP: ${Math.floor(fighter.hp)}`,
      `PHASE: ${fighter.isPhasing ? "ON" : "OFF"}`,
      `CD: ${fighter.isPhasing ? Math.ceil(phase.activeTimer / 60) : Math.ceil(phase.cooldown / 60)}`,
    ];
  }

  return [`HP: ${Math.floor(fighter.hp)}`];
}

function renderHud() {
  const left = fighters[0];
  const right = fighters[1];

  ui.leftName.textContent = left?.name ?? "";
  ui.rightName.textContent = right ? `${right.name}  x${battleSpeed.toFixed(2)}` : "";
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

  const steps = Math.max(1, Math.round(battleSpeed));
  const shouldSkipFrame = battleSpeed < 1 && Math.random() > battleSpeed;

  if (!shouldSkipFrame) {
    for (let step = 0; step < steps; step += 1) {
      if (freezeFrames > 0) {
        freezeFrames -= 1;
      } else {
        updateFighters();
      }

      updateProjectiles();
      updateHazards();
      resolveWeaponCollisions();
      resolveFighterCollisions();
      pruneDefeated();
    }
  }

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
