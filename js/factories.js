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
  Ruler() {
    return {
      name: "Ruler",
      hitRadius: 16,
      angle: 0,
      rotationSpeed: 0.08,
      cooldown: 0,
      fireRate: 120,
      onHit(target) {
        applyDamage(this.owner, target, 1);
        this.fireRate = Math.max(20, this.fireRate - 1);
      },
    };
  },
  Portal() {
    return {
      name: "Portal",
      angle: 0,
      rotationSpeed: 0.08,
      cooldown: 60,
      fireRate: 120,
      nextColor: "orange",
      portalDamage: 1,
      teleportCooldown: 0,
      portals: {
        orange: null,
        blue: null,
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
      recentHooked: null,
      recentHitTimer: 0,
      init(owner) {
        this.owner = owner;
      },
      tick() {
        this.cooldown = Math.max(0, this.cooldown - 1);
        this.recentHitTimer = Math.max(0, this.recentHitTimer - 1);
        if (this.recentHitTimer === 0) {
          this.recentHooked = null;
        }

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
          this.recentHooked = this.hooked;
          this.recentHitTimer = 18;
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
    damage,
    owner,
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

