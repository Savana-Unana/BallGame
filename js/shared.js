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

