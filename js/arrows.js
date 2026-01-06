export const arrows = [];

export function shootArrow(x, y, dir) {
    arrows.push({
        x, y,
        vx: dir * 6,
        vy: 0,
        life: 120
    });
}

export function updateArrows() {
    for (const a of arrows) {
        a.x += a.vx;
        a.life--;
    }

    for (let i = arrows.length - 1; i >= 0; i--) {
        if (arrows[i].life <= 0) arrows.splice(i, 1);
    }
}

export function drawArrows(ctx) {
    ctx.strokeStyle = "yellow";
    for (const a of arrows) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x - a.vx, a.y);
        ctx.stroke();
    }
}
