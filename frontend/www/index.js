import { Game } from "planetwars";
import { memory } from "planetwars/plantwars_bg"
import { Shader } from "./webgl/shader"

const URL = window.location.origin+window.location.pathname;
const LOCATION = URL.substring(0, URL.lastIndexOf("/") + 1);

const game_location = LOCATION + "static/game.json";

// fetch(game_location)
//     .then((r) => r.text())
//     .then((response) => {
//         console.log(response);
//         let game = Game.new(response);
//         console.log(game.turn_count());
//     }).catch(console.error);


const g = Game.new("");

const p1 = g.locations();
const s1 = g.location_count();
console.log(p1, s1);
const a1 = new Float64Array(memory.buffer, p1, s1 * 3);
console.log(a1);

g.add_location(0.5, 1.2, 3.14);

const p2 = g.locations();
const s2 = g.location_count();
const a2 = new Float64Array(memory.buffer, p2, s2 * 3);
console.log(a2);
