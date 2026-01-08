const c = document.getElementById("c"), x = c.getContext("2d");
c.width = 500; c.height = 500;
x.textAlign = "center"; x.textBaseline = "middle";

const leftName = document.getElementById("leftName");
const rightName = document.getElementById("rightName");
const leftStats = document.getElementById("leftStats");
const rightStats = document.getElementById("rightStats");

let balls = [], arrows = [];
const GRAVITY = 0.1, HIT_COOLDOWN = 300, KNOCKBACK_FORCE = 10, FREEZE_FRAMES = 10;
let gameFreeze = 0;

// Images
const images = {};
for (let n of ["Sword","Dagger","Axe","Shovel","Bow"]) {
    let i = new Image(); i.src = `assets/${n}.png`; images[n] = i;
}
const arrowImg = new Image();
arrowImg.src = "assets/Arrow.png";


// Sounds
const sounds = {
    hit: new Audio("assets/hit.mp3"),
    arrow: new Audio("assets/yoink.mp3"),
    yoink: new Audio("assets/yoink.mp3")
};

// Weapons
const Weapons = {
    Sword: () => ({n:"Sword", dmg:1, angle:0, rotationSpeed:0.1, onHit(t){t.hp-=this.dmg; this.dmg++;}}),
    Bow: () => ({
        n: "Bow",
        cooldown: 0,
        fireRate: 30,      // max cooldown
        angle: 0,
        rotationSpeed: 0.1,
        arrowsLeft: 1,     // current arrows available
        maxArrows: 1,      // starting max arrows
        fire(o){
            if(this.cooldown > 0 || this.arrowsLeft <= 0) return;

            this.cooldown = this.fireRate;
            this.arrowsLeft--;

            arrows.push({
                x: o.x + Math.cos(this.angle) * (o.size + 5), // shoot from edge
                y: o.y + Math.sin(this.angle) * (o.size + 5),
                vx: Math.cos(this.angle) * 8,
                vy: Math.sin(this.angle) * 8,
                owner: o,
                dmg: 1,
                size: o.size / 2        // arrow size relative to owner
            });

            sounds.arrow.play().catch(()=>{});
        }
    }),
    Dagger: () => ({n:"Dagger", s:0.5, angle:0, rotationSpeed:0.01, onHit(t){t.hp-=1; this.s+=0.1;}}),
    Axe: () => ({n:"Axe", Damage:1, critChance:0, critDamage:1, angle:0, rotationSpeed:0.1, onHit(t){
        let d = Math.random()<this.critChance ? this.critDamage : this.Damage;
        t.hp -= d; this.critDamage *= 2; this.critChance += 0.01;
    }}),
    Shovel: () => ({n:"Shovel", sizeAlt:100, angle:0, rotationSpeed:0.1, onHit(t){
        t.hp-=0.5; t.size=Math.max(5,t.size*0.9); this.sizeAlt=Math.max(0,this.sizeAlt*0.9);
    }})
};

// Abilities
const Abilities = {
    Speed: () => ({owner:null, speedGain:0.15, maxSpeed:8, init(o){this.owner=o;}, onHit(){
        let o=this.owner; o.vx=Math.max(-this.maxSpeed,Math.min(this.maxSpeed,o.vx*(1+this.speedGain)));
        o.vy=Math.max(-this.maxSpeed,Math.min(this.maxSpeed,o.vy*(1+this.speedGain)));
    }}),
    Duplicate: () => ({owner:null, t:900, init(o){this.owner=o;}, tick(){if(--this.t<=0){spawnDuplicate(this.owner);this.t=900;}}, onHit(){this.t=Math.max(60,this.t-1);}}),
    Yoink: () => ({owner:null, t:180, init(o){this.owner=o;}, tick(){this.t--;}, onHit(b){
        if(this.t<=0){
            if(b.weapon) this.owner.weapon={...b.weapon};
            if(b.abilityName){this.owner.ability=Abilities[b.abilityName]?.(); this.owner.ability?.init(this.owner);}
            this.t=180; sounds.yoink.play().catch(()=>{});
        }
    }}),
    Lasso: () => ({owner:null, init(o){this.owner=o; this.hooked=null;}, tick(){if(this.hooked && this.owner){let dx=this.hooked.x-this.owner.x, dy=this.hooked.y-this.owner.y; this.owner.vx+=dx*0.05; this.owner.vy+=dy*0.05;}}}),
    Grapple: () => ({owner:null, init(o){this.owner=o; this.target=null;}, tick(){if(this.target){this.owner.x=this.target.x; this.owner.y=this.target.y;}}}),
    Portal: () => ({owner:null, init(o){this.owner=o; this.target={x:o.x,y:o.y};}, onHit(b){let tmp={x:b.x,y:b.y}; b.x=this.target.x;b.y=this.target.y; this.target=tmp;}}),
    Math: () => ({owner:null, init(o){this.owner=o; this.stack=[];}, onHit(b){this.stack.push(b.hp);}})
};

// Make Ball
function make(name, base, x, y, isDuplicate=false){
    let o={
        name, base, x, y,
        vx:(base.Speed??0)+1, vy:-1+Math.random()*2,
        hp:base.HP, size:base.Size, rotation:0, spinSpeed:Math.random()*0.2+0.1,
        weapon:null, ability:null, abilityName:base.Ability,
        isDuplicate, hitCooldowns:new Map()
    };
    if(base.Weapon) o.weapon=Weapons[base.Weapon]();
    if(base.Ability){o.ability=Abilities[base.Ability]?.(); o.ability?.init(o);}
    balls.push(o); return o;
}

// Spawn Duplicate
function spawnDuplicate(o){
    let d = make(o.name,o.base,o.x+20,o.y+20,true);
    if(o.weapon) d.weapon={...o.weapon};
    if(o.ability){d.ability=Abilities[o.abilityName]?.(); d.ability?.init(d);}
}

// Hit
function hit(a,b){
    if(gameFreeze) return;
    let now = performance.now();
    if(a.hitCooldowns.get(b)&&now-a.hitCooldowns.get(b)<HIT_COOLDOWN) return;
    a.hitCooldowns.set(b,now); b.hitCooldowns.set(a,now);

    let dx=b.x-a.x, dy=b.y-a.y, d=Math.max(Math.hypot(dx,dy),0.1);
    let nx=dx/d, ny=dy/d;
    a.vx -= nx*KNOCKBACK_FORCE/a.base.Weight; a.vy -= ny*KNOCKBACK_FORCE/a.base.Weight;
    b.vx += nx*KNOCKBACK_FORCE/b.base.Weight; b.vy += ny*KNOCKBACK_FORCE/b.base.Weight;

    gameFreeze=FREEZE_FRAMES;
    sounds.hit.currentTime=0; sounds.hit.play().catch(()=>{});

    if(!a.weapon) b.hp--; if(!b.weapon) a.hp--;
    a.ability?.onHit?.(b); b.ability?.onHit?.(a);
}

// Dagger Tracking
function updateDagger(o){
    let w=o.weapon; if(!w||w.n!=="Dagger") return;
    let t=null,m=Infinity;
    for(let b of balls){if(b===o) continue; let d=Math.hypot(b.x-o.x,b.y-o.y); if(d<m){m=d;t=b;}}
    if(!t) return;
    let desired=Math.atan2(t.y-o.y,t.x-o.x), diff=((desired-w.angle+Math.PI)%(Math.PI*2))-Math.PI;
    w.angle+=Math.max(-w.rotationSpeed*w.s, Math.min(w.rotationSpeed*w.s, diff));
}

// Weapon Hit
function weaponHitCheck(o){
    let w=o.weapon; if(!w||w.n==="Bow") return;
    w.angle+=w.rotationSpeed;
    let r=o.size+15, wx=o.x+r*Math.cos(w.angle), wy=o.y+r*Math.sin(w.angle);
    w.hitCooldowns ??= new Map();
    for(let b of balls){if(b===o) continue;
        let now=performance.now(); if(w.hitCooldowns.get(b)&&now-w.hitCooldowns.get(b)<HIT_COOLDOWN) continue;
        if(Math.hypot(b.x-wx,b.y-wy)<b.size+15){w.hitCooldowns.set(b,now); w.onHit(b);}
    }
}

// Draw Ball
function draw(o){
    x.beginPath(); x.arc(o.x,o.y,o.size,0,7); x.fillStyle=o.base.Color; x.fill();
    x.fillStyle=o.base.HPColor; x.font=`${o.size*0.8}px Courier New`; x.fillText(Math.floor(o.hp),o.x,o.y);
    if(o.weapon && images[o.weapon.n]){
        let r=o.size+15, wx=o.x+r*Math.cos(o.weapon.angle), wy=o.y+r*Math.sin(o.weapon.angle);
        x.save(); x.translate(wx,wy); x.rotate(o.weapon.angle); x.drawImage(images[o.weapon.n],-15,-15,30,30); x.restore();
    }
}

// Weapon Stats
function getWeaponStats(o){
    let w=o.weapon; if(!w) return "";
    if(w.n==="Sword") return `DMG:${w.dmg}`;
    if(w.n==="Axe") return `CRIT:${(w.critChance*100).toFixed(1)}% DMG:${w.critDamage}`;
    if(w.n === "Bow") return `CD:${w.fireRate} AR:${w.maxArrows}`;
    if(w.n==="Shovel") return `DUG:${Math.floor(100-w.sizeAlt)}%`;
    if(w.n==="Dagger") return `SPD:${w.s.toFixed(1)}`;
    return "";
}

// Main Loop
function loop(){
    x.clearRect(0,0,c.width,c.height);
    if(gameFreeze) gameFreeze--; 
    else for(let o of balls){
        o.rotation+=o.spinSpeed; o.vy+=GRAVITY; o.x+=o.vx; o.y+=o.vy;
        if(o.x<o.size){o.x=o.size;o.vx=Math.abs(o.vx);}
        if(o.x>c.width-o.size){o.x=c.width-o.size;o.vx=-Math.abs(o.vx);}
        if(o.y<o.size){o.y=o.size;o.vy=Math.abs(o.vy);}
        if(o.y>c.height-o.size){o.y=c.height-o.size;o.vy=-Math.abs(o.vy);}
        if(o.weapon?.n==="Bow"){
            let w = o.weapon;
            w.angle += w.rotationSpeed;
            if(w.cooldown > 0) w.cooldown--;
            if(w.arrowsLeft > 0 && w.cooldown === 0){
                arrows.push({
                    x: o.x,
                    y: o.y,
                    vx: Math.cos(w.angle)*8,
                    vy: Math.sin(w.angle)*8,
                    owner: o,
                    dmg: 1
                });
                w.arrowsLeft--;
                w.cooldown = w.fireRate;
                sounds.arrow.play().catch(()=>{});
            }
        }
        o.ability?.tick?.(); updateDagger(o); weaponHitCheck(o);
    }
    for (let a of arrows){
    a.x += a.vx;
    a.y += a.vy;

    for(let b of balls){
      if(b === a.owner) continue;

      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.hypot(dx, dy);
      if(dist < b.size){
          b.hp -= a.dmg;
          a.dead = true;

          if(a.owner.weapon?.n === "Bow"){
              let w = a.owner.weapon;
              w.arrowsLeft++;
              w.maxArrows = Math.max(w.maxArrows, w.arrowsLeft);
              w.cooldown = Math.max(0, w.cooldown - 1);
          }
      }
    }
    x.save();
    x.translate(a.x, a.y);
    x.rotate(Math.atan2(a.vy, a.vx));
    x.drawImage(arrowImg, -a.size/2, -a.size/8, a.size, a.size/4);
    x.restore();

}
    // Collisions
    for(let i=0;i<balls.length;i++) for(let j=i+1;j<balls.length;j++){
        let a=balls[i],b=balls[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
        if(d<a.size+b.size){let nx=dx/d,ny=dy/d,overlap=a.size+b.size-d; a.x-=nx*overlap/2; a.y-=ny*overlap/2; b.x+=nx*overlap/2; b.y+=ny*overlap/2; hit(a,b);}
    }

    balls=balls.filter(o=>o.hp>0); balls.forEach(draw);
    if(balls[0]){leftName.textContent=balls[0].name; leftStats.textContent=`HP:${Math.floor(balls[0].hp)} ${getWeaponStats(balls[0])}`;}
    if(balls[1]){rightName.textContent=balls[1].name; rightStats.textContent=`HP:${Math.floor(balls[1].hp)} ${getWeaponStats(balls[1])}`;}
    requestAnimationFrame(loop);
}

fetch("balls.json").then(r=>r.json()).then(d=>{
//make("Pacifist", d.Pacifist, 350, 250);
make("Sword", d.Sword, 150, 250);
//make("Speed", d.Speed, 350, 250);
//make("Dagger", d.Dagger, 150, 250);
//make("Bow", d.Bow, 350, 250);
//make("Shovel", d.Shovel, 350, 250);
//make("Duplicator", d.Duplicator, 350, 250);
//make("RPG", d.RPG, 350, 250);
//make("Glass", d.Glass, 350, 250);
//make("Thief", d.Thief, 350, 250);
//make("Math", d.Math, 350, 250);
//make("Heavy", d.Heavy, 350, 250);
//make("Portal", d.Portal, 350, 250);
//make("Lasso", d.Lasso, 350, 250);
//make("Grapple", d.Grapple, 350, 250);
make("Baby", d.Baby, 350, 250);
loop()
})
