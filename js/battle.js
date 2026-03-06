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
    tickInterval: 360,
    onHit(target) {
      const intervalStep = 30;
      const minimumInterval = 6;

      this.tickInterval = Math.max(
        minimumInterval,
        this.tickInterval - intervalStep,
      );
      target.needleInterval = this.tickInterval;
      if (!target.needleTimer || target.needleTimer <= 0) {
        target.needleTimer = this.tickInterval;
      } else {
        target.needleTimer = Math.max(1, target.needleTimer - intervalStep);
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
    stunLength: 60,
    onHit(target) {
      applyDamage(this.owner, target, target.stunTimer > 0 ? 2 : 1);
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
    stunLength: 70,
    onHit(target) {
      applyDamage(this.owner, target, target.stunTimer > 0 ? 2 : 1);
      target.stunTimer = Math.max(target.stunTimer ?? 0, this.stunLength);
      if (!target.isDisarmed) {
        target.disabledWeapon = target.weapon;
        target.disabledAbility = target.ability;
        target.disabledAbilityName = target.abilityName;
        target.weapon = null;
        target.ability = null;
        target.abilityName = null;
        target.isDisarmed = true;
      }
      target.disarmTimer = Math.max(
        target.disarmTimer ?? 0,
        Math.floor(this.stunLength * 2),
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
    timer: 180,
    children: [],
    init(owner) {
      this.owner = owner;
      this.timer = 180;
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
      this.hitCooldowns = new Map();
    },
    tick() {
      this.angle += this.rotationSpeed;
    },
    onHit() {
      this.owner.shield = Math.max(1, this.owner.shield || 1);
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
  if (attacker?.abilityName === "Fortress") {
    return 0;
  }
  if (
    attacker?.abilityName === "Lasso" &&
    (
      attacker.ability?.hooked === target ||
      (
        attacker.ability?.recentHooked === target &&
        (attacker.ability?.recentHitTimer ?? 0) > 0
      )
    )
  ) {
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

function spawnSpeedTrail(owner, x, y, ttl = 180) {
  hazards.push({
    type: "fire",
    x,
    y,
    radius: Math.max(8, owner.size * 0.35),
    damage: 1,
    owner,
    ttl,
  });
}

function spawnSpeedLightning(owner) {
  const target = fighters.find((fighter) => fighter !== owner && fighter.hp > 0);
  if (!target) {
    return;
  }

  hazards.push({
    type: "lightning",
    x: target.x,
    y: target.y,
    radius: Math.max(12, target.size * 0.45),
    damage: 2,
    owner,
    ttl: 12,
  });
}

abilityFactories.Speed = function SpeedFactory() {
  return {
    owner: null,
    bonusSpeed: 0,
    dashTimer: 0,
    trailDistance: 0,
    lastX: 0,
    lastY: 0,
    init(owner) {
      this.owner = owner;
      this.lastX = owner.x;
      this.lastY = owner.y;
    },
    tick() {
      const moved = Math.hypot(this.owner.x - this.lastX, this.owner.y - this.lastY);
      this.lastX = this.owner.x;
      this.lastY = this.owner.y;

      if (this.dashTimer > 0) {
        this.dashTimer -= 1;
        const vx = this.owner.vx;
        const vy = this.owner.vy;
        const distance = Math.max(Math.hypot(vx, vy), 0.1);
        const boost = 0.22 + this.bonusSpeed * 0.04;
        this.owner.vx = clamp(vx + (vx / distance) * boost, -12, 12);
        this.owner.vy = clamp(vy + (vy / distance) * boost, -12, 12);

        this.trailDistance += moved;
        while (this.trailDistance >= 28) {
          spawnSpeedTrail(this.owner, this.owner.x, this.owner.y);
          this.trailDistance -= 28;
        }
      } else {
        this.trailDistance = 0;
      }
    },
    onHit() {
      this.bonusSpeed += 1;
      this.dashTimer = 60;
    },
  };
};

abilityFactories.SpeedForce = function SpeedForceFactory() {
  return {
    owner: null,
    bonusSpeed: 0,
    dashTimer: 0,
    trailDistance: 0,
    lastX: 0,
    lastY: 0,
    phasePulse: 0,
    init(owner) {
      this.owner = owner;
      this.lastX = owner.x;
      this.lastY = owner.y;
    },
    tick() {
      const moved = Math.hypot(this.owner.x - this.lastX, this.owner.y - this.lastY);
      this.lastX = this.owner.x;
      this.lastY = this.owner.y;
      this.phasePulse = Math.max(0, this.phasePulse - 1);

      if (this.dashTimer > 0) {
        this.dashTimer -= 1;
        const vx = this.owner.vx;
        const vy = this.owner.vy;
        const distance = Math.max(Math.hypot(vx, vy), 0.1);
        const boost = 0.28 + this.bonusSpeed * 0.05;
        this.owner.vx = clamp(vx + (vx / distance) * boost, -14, 14);
        this.owner.vy = clamp(vy + (vy / distance) * boost, -14, 14);

        this.trailDistance += moved;
        while (this.trailDistance >= 24) {
          spawnSpeedTrail(this.owner, this.owner.x, this.owner.y, 210);
          this.trailDistance -= 24;
        }

        if (this.phasePulse === 0 && Math.random() < 0.08) {
          this.owner.isPhasing = true;
          this.phasePulse = 10;
        } else if (this.phasePulse <= 2) {
          this.owner.isPhasing = false;
        }

        if (this.dashTimer === 0) {
          this.owner.isPhasing = false;
          spawnSpeedLightning(this.owner);
        }
      } else {
        this.owner.isPhasing = false;
        this.trailDistance = 0;
      }
    },
    onHit() {
      this.bonusSpeed += 1;
      this.dashTimer = 60;
    },
  };
};

abilityFactories.Time = function TimeFactory() {
  return {
    owner: null,
    cycleTimer: 180,
    rewindTimer: 0,
    history: [],
    init(owner) {
      this.owner = owner;
    },
    tick() {
      this.history.push({
        x: this.owner.x,
        y: this.owner.y,
        vx: this.owner.vx,
        vy: this.owner.vy,
        hp: this.owner.hp,
      });
      if (this.history.length > 180) {
        this.history.shift();
      }

      if (this.rewindTimer > 0) {
        this.rewindTimer -= 1;
        const snapshot = this.history.shift();
        if (snapshot) {
          this.owner.x = snapshot.x;
          this.owner.y = snapshot.y;
          this.owner.vx = -snapshot.vx;
          this.owner.vy = -snapshot.vy;
          this.owner.hp = Math.min(this.owner.maxHp, Math.max(this.owner.hp, snapshot.hp));
        }
        if (this.rewindTimer === 0) {
          this.cycleTimer = 180;
        }
        return;
      }

      this.cycleTimer -= 1;
      if (this.cycleTimer <= 0 && this.history.length >= 120) {
        this.rewindTimer = 120;
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

      if ((hazard.type === "fire" || hazard.type === "lightning") && hazard.owner === fighter) {
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

      if (hazard.type === "fire") {
        applyDamage(hazard.owner, fighter, hazard.damage);
      }

      if (hazard.type === "lightning") {
        applyDamage(hazard.owner, fighter, hazard.damage);
        hazard.dead = true;
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
    originalAbility: null,
    originalAbilityName: null,
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
      this.originalAbility = owner.ability;
      this.originalAbilityName = owner.abilityName;
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
      if (!target || this.stealCooldown > 0 || this.activeTimer > 0) {
        return;
      }

      if (target.weapon) {
        this.owner.weapon = { ...target.weapon };
        this.owner.weapon.owner = this.owner;
        this.owner.ability = this.originalAbility;
        this.owner.abilityName = this.originalAbilityName;
        this.stolenThing = target.base.Weapon;
      } else {
        this.owner.weapon = null;
        if (target.abilityName && abilityFactories[target.abilityName]) {
          this.owner.abilityName = target.abilityName;
          this.owner.ability = abilityFactories[target.abilityName]();
          this.owner.ability.init?.(this.owner);
          this.stolenThing = target.base.Ability ?? target.abilityName;
        } else {
          this.owner.ability = this.originalAbility;
          this.owner.abilityName = this.originalAbilityName;
          this.stolenThing = target.base.Ability ?? "None";
        }
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
      this.stealCooldown = 180;
      playSound(sounds.yoink);
    },
    restoreYoinkState() {
      this.owner.weapon = this.originalWeapon ? { ...this.originalWeapon } : null;
      if (this.owner.weapon) {
        this.owner.weapon.owner = this.owner;
      }
      this.owner.ability = this.originalAbility;
      this.owner.abilityName = this.originalAbilityName;

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
      this.stealCooldown = Math.max(this.stealCooldown, 180);
    },
  };
};

abilityFactories.Grapple = function GrappleFactory() {
  return {
    owner: null,
    hook: null,
    cooldown: 0,
    grappleTimer: 0,
    grappleTarget: null,
    init(owner) {
      this.owner = owner;
    },
    tick() {
      this.cooldown = Math.max(0, this.cooldown - 1);
      this.grappleTimer = Math.max(0, this.grappleTimer - 1);

      if (this.grappleTarget && (this.grappleTarget.hp <= 0 || this.grappleTimer <= 0)) {
        this.grappleTarget = null;
      }

      if (this.grappleTarget) {
        const dx = this.grappleTarget.x - this.owner.x;
        const dy = this.grappleTarget.y - this.owner.y;
        const distance = Math.max(Math.hypot(dx, dy), 0.1);
        this.owner.vx += (dx / distance) * 0.7;
        this.owner.vy += (dy / distance) * 0.7;

        if (distance <= this.owner.size + this.grappleTarget.size + 8) {
          applyDamage(this.owner, this.grappleTarget, 1);
        }
        return;
      }

      if (!this.hook && this.cooldown === 0) {
        const target = fighters.find((fighter) => fighter !== this.owner);
        if (!target) {
          return;
        }
        const angle = Math.atan2(target.y - this.owner.y, target.x - this.owner.x);
        this.hook = {
          x: this.owner.x,
          y: this.owner.y,
          vx: Math.cos(angle) * 9,
          vy: Math.sin(angle) * 9,
          ttl: 40,
        };
      }

      if (!this.hook) {
        return;
      }

      this.hook.x += this.hook.vx;
      this.hook.y += this.hook.vy;
      this.hook.ttl -= 1;

      for (const target of fighters) {
        if (target === this.owner || target.isPhasing) {
          continue;
        }
        if (Math.hypot(target.x - this.hook.x, target.y - this.hook.y) <= target.size) {
          this.grappleTarget = target;
          this.grappleTimer = 90;
          this.owner.vx = this.hook.vx * 0.7;
          this.owner.vy = this.hook.vy * 0.7;
          this.hook = null;
          this.cooldown = 120;
          return;
        }
      }

      if (
        this.hook.ttl <= 0 ||
        this.hook.x < 0 ||
        this.hook.x > canvas.width ||
        this.hook.y < 0 ||
        this.hook.y > canvas.height
      ) {
        this.hook = null;
        this.cooldown = 60;
      }
    },
  };
};

abilityFactories.Portal = function PortalFactory() {
  return {
    owner: null,
    reload: 0,
    fireRate: 180,
    portals: [],
    lastTeleport: 0,
    init(owner) {
      this.owner = owner;
    },
    tick() {
      this.reload = Math.max(0, this.reload - 1);
      this.lastTeleport = Math.max(0, this.lastTeleport - 1);

      if (this.portals.length < 2 && this.reload === 0) {
        const target = fighters.find((fighter) => fighter !== this.owner) ?? this.owner;
        const angle = Math.atan2(target.y - this.owner.y, target.x - this.owner.x);
        const distance = 90 + this.portals.length * 70;
        const spread = this.portals.length === 0 ? 1 : -1;
        this.portals.push({
          color: this.portals.length === 0 ? "#ff8c2f" : "#2f7fff",
          x: clamp(this.owner.x + Math.cos(angle + spread * 0.5) * distance, 30, canvas.width - 30),
          y: clamp(this.owner.y + Math.sin(angle + spread * 0.5) * distance, 30, canvas.height - 30),
          radius: 18,
        });
        this.reload = this.fireRate;
      }

      if (this.portals.length < 2 || this.lastTeleport > 0) {
        return;
      }

      const [a, b] = this.portals;
      for (const fighter of fighters) {
        if (Math.hypot(fighter.x - a.x, fighter.y - a.y) <= fighter.size + a.radius) {
          fighter.x = b.x;
          fighter.y = b.y;
          const opponent = fighters.find((other) => other !== fighter);
          if (opponent) {
            applyDamage(this.owner, opponent, 1);
          }
          this.lastTeleport = 24;
          return;
        }
        if (Math.hypot(fighter.x - b.x, fighter.y - b.y) <= fighter.size + b.radius) {
          fighter.x = a.x;
          fighter.y = a.y;
          const opponent = fighters.find((other) => other !== fighter);
          if (opponent) {
            applyDamage(this.owner, opponent, 1);
          }
          this.lastTeleport = 24;
          return;
        }
      }
    },
    onHit() {
      this.fireRate = Math.max(60, this.fireRate - 1);
      this.reload = Math.min(this.reload, this.fireRate);
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
  const disabledRangedWeapons = [];
  for (const fighter of fighters) {
    if (fighter.weapon?.name === "Bow" || fighter.weapon?.name === "Portal") {
      disabledRangedWeapons.push([fighter, fighter.weapon]);
      fighter.weapon = null;
    }
  }

  previousResolveWeaponCollisions();

  for (const [fighter, weapon] of disabledRangedWeapons) {
    fighter.weapon = weapon;
  }
};

applyDamage = function applyDamageFinalOverride(source, target, amount, ignoreParry = false) {
  if (!target || !Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  if (source && (source.stunTimer ?? 0) > 0) {
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
    stunLength: 60,
    onHit(target) {
      applyDamage(this.owner, target, target.stunTimer > 0 ? 2 : 1);
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
    stunLength: 70,
    onHit(target) {
      applyDamage(this.owner, target, target.stunTimer > 0 ? 2 : 1);
      target.stunTimer = Math.max(target.stunTimer ?? 0, this.stunLength);
      if (!target.isDisarmed) {
        target.disabledWeapon = target.weapon;
        target.disabledAbility = target.ability;
        target.disabledAbilityName = target.abilityName;
        target.weapon = null;
        target.ability = null;
        target.abilityName = null;
        target.isDisarmed = true;
      }
      target.disarmTimer = Math.max(
        target.disarmTimer ?? 0,
        Math.floor(this.stunLength * 1.5),
      );
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
      weapon.name === "Portal" ||
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

      if (
        (weapon.name === "Mace" || weapon.name === "Concussor") &&
        (other.stunTimer ?? 0) > 0
      ) {
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

function resolveFortressShieldHits() {
  for (const fighter of fighters) {
    if (fighter.abilityName !== "Fortress" || !fighter.ability) {
      continue;
    }

    const shieldPoints = getFortressShieldPoints(fighter);
    for (const shieldPoint of shieldPoints) {
      for (const other of fighters) {
        if (other === fighter || other.isPhasing || areFamilySafe(fighter, other)) {
          continue;
        }

        const distance = Math.hypot(other.x - shieldPoint.x, other.y - shieldPoint.y);
        if (distance >= other.size + shieldPoint.radius) {
          continue;
        }

        fighter.ability.hitCooldowns ??= new Map();
        const key = `${other.name}-${Math.round(shieldPoint.angle * 1000)}`;
        const now = performance.now();
        const lastHit = fighter.ability.hitCooldowns.get(key);
        if (lastHit && now - lastHit < CONFIG.hitCooldownMs) {
          continue;
        }
        fighter.ability.hitCooldowns.set(key, now);

        applyDamage(fighter, other, 1);
        fighter.shield = Math.max(1, (fighter.shield || 1) - 1);
        const safeDistance = Math.max(distance, 0.1);
        const nx = (other.x - shieldPoint.x) / safeDistance;
        const ny = (other.y - shieldPoint.y) / safeDistance;
        other.vx += nx * 0.9;
        other.vy += ny * 0.9;
        fighter.vx -= nx * 0.25;
        fighter.vy -= ny * 0.25;
      }
    }
  }
}

const previousWrappedResolveWeaponCollisions = resolveWeaponCollisions;
resolveWeaponCollisions = function fortressResolveWeaponCollisions() {
  resolveFortressShieldHits();

  for (let i = 0; i < fighters.length; i += 1) {
    const fighter = fighters[i];
    if (fighter.abilityName !== "Fortress" || !fighter.ability) {
      continue;
    }

    const shieldPoints = getFortressShieldPoints(fighter);
    for (let j = 0; j < fighters.length; j += 1) {
      const other = fighters[j];
      if (other === fighter || !other.weapon || other.isPhasing) {
        continue;
      }

      const weaponPoint = getWeaponPoint(other);
      const weaponRadius = other.weapon.hitRadius ?? 15;
      for (const shieldPoint of shieldPoints) {
        const distance = Math.hypot(weaponPoint.x - shieldPoint.x, weaponPoint.y - shieldPoint.y);
        if (distance >= weaponRadius + shieldPoint.radius) {
          continue;
        }

        fighter.ability.hitCooldowns ??= new Map();
        const key = `weapon-${j}-${Math.round(shieldPoint.angle * 1000)}`;
        const now = performance.now();
        const lastHit = fighter.ability.hitCooldowns.get(key);
        if (lastHit && now - lastHit < CONFIG.hitCooldownMs) {
          continue;
        }
        fighter.ability.hitCooldowns.set(key, now);

        const safeDistance = Math.max(distance, 0.1);
        const nx = (weaponPoint.x - shieldPoint.x) / safeDistance;
        const ny = (weaponPoint.y - shieldPoint.y) / safeDistance;
        const clashForce = 3;
        applyDamage(fighter, other, 1);
        fighter.shield = Math.max(1, (fighter.shield || 1) - 1);
        fighter.vx -= (nx * clashForce) / fighter.base.Weight;
        fighter.vy -= (ny * clashForce) / fighter.base.Weight;
        other.vx += (nx * clashForce) / other.base.Weight;
        other.vy += (ny * clashForce) / other.base.Weight;
        if (typeof other.weapon.angle === "number") {
          other.weapon.angle += 0.08;
        }
      }
    }
  }

  previousWrappedResolveWeaponCollisions();
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
  duplicate.isParrying = owner.isParrying;
  duplicate.stunTimer = owner.stunTimer;
  duplicate.disarmTimer = owner.disarmTimer;
  duplicate.needleInterval = owner.needleInterval;
  duplicate.needleTimer = owner.needleTimer;
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
  const maceStunLock =
    ((a.weapon?.name === "Mace" || a.weapon?.name === "Concussor") && (b.stunTimer ?? 0) > 0) ||
    ((b.weapon?.name === "Mace" || b.weapon?.name === "Concussor") && (a.stunTimer ?? 0) > 0);
  const knockbackScale = maceStunLock ? 0 : isLassoCollisionPair(a, b) ? 0.2 : 1;

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

function placePortal(owner, weapon, color, x, y) {
  weapon.portals[color] = {
    color,
    x: clamp(x, 26, canvas.width - 26),
    y: clamp(y, 26, canvas.height - 26),
    radius: 18,
    tint: color === "orange" ? "#ff8c2f" : "#2f7fff",
  };
}

function firePortalShot(owner, weapon) {
  const portalColor = weapon.nextColor;
  projectiles.push({
    type: "portalShot",
    x: owner.x + Math.cos(weapon.angle) * (owner.size + 10),
    y: owner.y + Math.sin(weapon.angle) * (owner.size + 10),
    vx: Math.cos(weapon.angle) * 7,
    vy: Math.sin(weapon.angle) * 7,
    owner,
    portalColor,
    size: 12,
    ttl: 80,
  });
  weapon.nextColor = portalColor === "orange" ? "blue" : "orange";
  weapon.portalDamage += 1;
  weapon.cooldown = weapon.fireRate;
}

function updatePortalWeapon(fighter, weapon) {
  weapon.angle += weapon.rotationSpeed;
  weapon.cooldown = Math.max(0, weapon.cooldown - 1);
  weapon.teleportCooldown = Math.max(0, weapon.teleportCooldown - 1);

  if (weapon.cooldown === 0) {
    firePortalShot(fighter, weapon);
  }

  const orangePortal = weapon.portals.orange;
  const bluePortal = weapon.portals.blue;
  if (!orangePortal || !bluePortal || weapon.teleportCooldown > 0) {
    return;
  }

  for (const target of fighters) {
    if (
      Math.hypot(target.x - orangePortal.x, target.y - orangePortal.y) <=
      target.size + orangePortal.radius
    ) {
      target.x = bluePortal.x;
      target.y = bluePortal.y;
      const opponent = fighters.find((other) => other !== target);
      if (opponent) {
        applyDamage(fighter, opponent, weapon.portalDamage);
      }
      weapon.teleportCooldown = 24;
      return;
    }

    if (
      Math.hypot(target.x - bluePortal.x, target.y - bluePortal.y) <=
      target.size + bluePortal.radius
    ) {
      target.x = orangePortal.x;
      target.y = orangePortal.y;
      const opponent = fighters.find((other) => other !== target);
      if (opponent) {
        applyDamage(fighter, opponent, weapon.portalDamage);
      }
      weapon.teleportCooldown = 24;
      return;
    }
  }
}

function updateWeapon(fighter) {
  const weapon = fighter.weapon;
  if (!weapon || fighter.disarmTimer > 0) {
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

  if (weapon.name === "Portal") {
    updatePortalWeapon(fighter, weapon);
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

  if (weapon.name === "Ruler") {
    weapon.angle += weapon.rotationSpeed;
    weapon.cooldown = Math.max(0, weapon.cooldown - 1);
    if (weapon.cooldown === 0) {
      const target = fighters.find((other) => other !== fighter);
      if (target) {
        const angle = Math.atan2(target.y - fighter.y, target.x - fighter.x);
        const distance = fighter.size + target.size + 12;
        fighter.x = target.x - Math.cos(angle) * distance;
        fighter.y = target.y - Math.sin(angle) * distance;
        weapon.angle = angle;
        weapon.cooldown = weapon.fireRate;
      }
    }
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
    if (projectile.type === "portalShot") {
      projectile.ttl -= 1;
    }
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
    if (projectile.type === "portalShot" && (hitsWall || projectile.ttl <= 0)) {
      const weapon = projectile.owner?.weapon;
      if (weapon?.name === "Portal") {
        placePortal(
          projectile.owner,
          weapon,
          projectile.portalColor,
          clamp(projectile.x, 26, canvas.width - 26),
          clamp(projectile.y, 26, canvas.height - 26),
        );
      }
      projectile.dead = true;
    }
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

