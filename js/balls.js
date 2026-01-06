export const balls = [];

export function makeBall(x, y, team = "left") {
    balls.push({
        x, y,
        vx: Math.random() * 2 - 1,
        vy: Math.random() * 2 - 1,
        r: 14,
        hp: 10,
        team
    });
}

export function updateBalls() {
    for (const b of balls) {
        b.vy += 0.1;
        b.x += b.vx;
        b.y += b.vy;

        if (b.y + b.r > 500) {
            b.y = 500 - b.r;
            b.vy *= -0.7;
        }
        if (b.x < b.r || b.x > 500 - b.r) b.vx *= -1;
    }
}

export function drawBalls(ctx) {
    for (const b of balls) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.team === "left" ? "cyan" : "red";
        ctx.fill();
    }
}
