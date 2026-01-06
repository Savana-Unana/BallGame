import { shootArrow } from "./arrows.js";

export const Weapons = {
    Bow: {
        tick(owner) {
            if (Math.random() < 0.01) {
                shootArrow(owner.x, owner.y, owner.team === "left" ? 1 : -1);
            }
        }
    }
};
