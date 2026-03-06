function drawProjectile(projectile) {
  if (projectile.type === "portalShot") {
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.strokeStyle = projectile.portalColor === "orange" ? "#ff8c2f" : "#2f7fff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, projectile.size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

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

  if (hazard.type === "fire") {
    ctx.globalAlpha = Math.min(1, Math.max(0.25, hazard.ttl / 180));
    ctx.fillStyle = "#ff7a1a";
    ctx.beginPath();
    ctx.arc(0, 0, hazard.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd34d";
    ctx.beginPath();
    ctx.arc(0, 0, hazard.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  if (hazard.type === "lightning") {
    ctx.strokeStyle = "#dff6ff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-hazard.radius * 0.6, -hazard.radius);
    ctx.lineTo(hazard.radius * 0.2, -hazard.radius * 0.2);
    ctx.lineTo(-hazard.radius * 0.1, hazard.radius * 0.1);
    ctx.lineTo(hazard.radius * 0.6, hazard.radius);
    ctx.stroke();
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
  } else if (weapon.name === "Ruler") {
    ctx.fillStyle = "#f5e3a1";
    ctx.fillRect(-18, -4, 36, 8);
    ctx.strokeStyle = "#8f7d39";
    ctx.lineWidth = 1;
    for (let mark = -14; mark <= 14; mark += 7) {
      ctx.beginPath();
      ctx.moveTo(mark, -4);
      ctx.lineTo(mark, mark % 14 === 0 ? -11 : -8);
      ctx.stroke();
    }
  } else if (weapon.name === "RPG" || weapon.name === "Demo") {
    ctx.fillStyle = "#3f4a59";
    ctx.fillRect(-16, -5, 32, 10);
    ctx.fillStyle = "#d5a021";
    ctx.fillRect(10, -3, 10, 6);
  } else if (weapon.name === "Portal") {
    ctx.fillStyle = "#d7dbe1";
    ctx.fillRect(-14, -6, 20, 12);
    ctx.fillStyle = "#444e5d";
    ctx.fillRect(-18, -4, 10, 8);
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 2;
    ctx.strokeRect(-14, -6, 20, 12);
    ctx.beginPath();
    ctx.strokeStyle = weapon.nextColor === "orange" ? "#ff8c2f" : "#2f7fff";
    ctx.arc(8, 0, 5, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#222";
    ctx.fillRect(-14, -4, 28, 8);
  }

  ctx.restore();
}

function drawFighter(fighter) {
  const weaponPortals =
    fighter.weapon?.name === "Portal" ? Object.values(fighter.weapon.portals ?? {}).filter(Boolean) : [];
  if (weaponPortals.length) {
    for (const portal of weaponPortals) {
      ctx.save();
      ctx.translate(portal.x, portal.y);
      ctx.strokeStyle = portal.tint;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, portal.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = portal.tint;
      ctx.beginPath();
      ctx.arc(0, 0, portal.radius - 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  if (fighter.abilityName === "Grapple" && fighter.ability?.hook) {
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fighter.x, fighter.y);
    ctx.lineTo(fighter.ability.hook.x, fighter.ability.hook.y);
    ctx.stroke();

    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(fighter.ability.hook.x, fighter.ability.hook.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (fighter.abilityName === "Grapple" && fighter.ability?.grappleTarget) {
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fighter.x, fighter.y);
    ctx.lineTo(fighter.ability.grappleTarget.x, fighter.ability.grappleTarget.y);
    ctx.stroke();
  }

  if (fighter.abilityName === "Portal" && fighter.ability?.portals?.length) {
    for (const portal of fighter.ability.portals) {
      ctx.save();
      ctx.translate(portal.x, portal.y);
      ctx.strokeStyle = portal.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, portal.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = portal.color;
      ctx.beginPath();
      ctx.arc(0, 0, portal.radius - 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

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
    const shieldPoints = getFortressShieldPoints(fighter);
    for (const shieldPoint of shieldPoints) {
      ctx.save();
      ctx.translate(shieldPoint.x, shieldPoint.y);
      ctx.rotate(shieldPoint.angle + Math.PI / 2);
      ctx.fillStyle = "#7d8a97";
      ctx.strokeStyle = "#3d4650";
      ctx.lineWidth = 2;
      ctx.fillRect(-12, -16, 24, 32);
      ctx.strokeRect(-12, -16, 24, 32);
      ctx.fillStyle = "#b9c3cc";
      ctx.fillRect(-4, -10, 8, 20);
      ctx.restore();
    }
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
  if (weapon.name === "Needle") {
    return [
      `HP: ${Math.floor(fighter.hp)}`,
      `TICK: ${((weapon.tickInterval ?? 360) / 60).toFixed(1)}S`,
    ];
  }
  if (weapon.name === "Mace") {
    return [
      `HP: ${Math.floor(fighter.hp)}`,
      `STUN: ${weapon.stunLength}`,
    ];
  }
  if (weapon.name === "Concussor") {
    return [
      `HP: ${Math.floor(fighter.hp)}`,
      `STUN: ${weapon.stunLength}`,
      "DISARM: ON HIT",
    ];
  }
  if (weapon.name === "Ruler") {
    return [
      `HP: ${Math.floor(fighter.hp)}`,
      `TP CD: ${weapon.fireRate}`,
    ];
  }
  if (weapon.name === "Portal") {
    const portalCount = Object.values(weapon.portals ?? {}).filter(Boolean).length;
    return [
      `HP: ${Math.floor(fighter.hp)}`,
      `PORTALS: ${portalCount}`,
      `DMG: ${weapon.portalDamage}`,
      `CD: ${Math.ceil((weapon.cooldown ?? 0) / 60)}s`,
    ];
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
  if (ability === "Grapple" || ability === "Ninja") {
    const grapple = fighter.ability;
    return [
      `HP: ${Math.floor(fighter.hp)}`,
      `HOOK: ${grapple?.hook || grapple?.grappleTarget ? "OUT" : "IN"}`,
      `CD: ${Math.ceil((grapple?.cooldown ?? 0) / 60)}`,
    ];
  }
  if (ability === "Speed") {
    const speed = fighter.ability;
    return [
      `HP: ${Math.floor(fighter.hp)}`,
      `SPD+: ${speed?.bonusSpeed ?? 0}`,
      `DASH: ${((speed?.dashTimer ?? 0) / 60).toFixed(1)}s`,
    ];
  }
  if (ability === "SpeedForce") {
    const speed = fighter.ability;
    return [
      `HP: ${Math.floor(fighter.hp)}`,
      `SPD+: ${speed?.bonusSpeed ?? 0}`,
      `DASH: ${((speed?.dashTimer ?? 0) / 60).toFixed(1)}s`,
      `PHASE: ${fighter.isPhasing ? "ON" : "OFF"}`,
    ];
  }
  if (ability === "Time") {
    const time = fighter.ability;
    return [
      `HP: ${Math.floor(fighter.hp)}`,
      `REWIND: ${time?.rewindTimer > 0 ? "ON" : "OFF"}`,
      `CD: ${Math.ceil(((time?.rewindTimer ?? 0) > 0 ? time.rewindTimer : (time?.cycleTimer ?? 0)) / 60)}s`,
    ];
  }
  if (ability === "Portal") {
    const portal = fighter.ability;
    return [
      `HP: ${Math.floor(fighter.hp)}`,
      `PORTALS: ${portal?.portals?.length ?? 0}`,
      `CD: ${Math.ceil((portal?.reload ?? 0) / 60)}`,
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
    if (fighter.stunTimer > 0) {
      fighter.stunTimer -= 1;
    }
    if (fighter.disarmTimer > 0) {
      fighter.disarmTimer -= 1;
      if (fighter.disarmTimer === 0 && fighter.isDisarmed) {
        fighter.weapon = fighter.disabledWeapon;
        if (fighter.weapon) {
          fighter.weapon.owner = fighter;
        }
        fighter.ability = fighter.disabledAbility;
        fighter.abilityName = fighter.disabledAbilityName;
        fighter.disabledWeapon = null;
        fighter.disabledAbility = null;
        fighter.disabledAbilityName = null;
        fighter.isDisarmed = false;
      }
    }
    if (fighter.needleInterval > 0) {
      fighter.needleTimer -= 1;
      if (fighter.needleTimer <= 0) {
        applyDamage(null, fighter, 1, true);
        fighter.needleTimer = fighter.needleInterval;
      }
    }

    fighter.rotation += fighter.spinSpeed;
    if (fighter.stunTimer <= 0) {
      fighter.vy += CONFIG.gravity;
      fighter.x += fighter.vx;
      fighter.y += fighter.vy;
      confineToArena(fighter);
      fighter.ability?.tick?.();
      updateDaggerTracking(fighter);
      updateWeapon(fighter);
      continue;
    }

    confineToArena(fighter);
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
