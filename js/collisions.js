import { balls } from "./balls.js";
import { arrows } from "./arrows.js";

export function handleCollisions() {
    for (const a of arrows) {
        for (const b of balls) {
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            if (dx * dx + dy * dy < b.r * b.r) {
                b.hp -= 2;
                a.life = 0;
            }
        }
    }
}
