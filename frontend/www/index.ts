import { Game } from "planetwars";
import { memory } from "planetwars/plantwars_bg";

const CANVAS = <HTMLCanvasElement>document.getElementById("c");


function create_array(ptr: number, size: number): Float64Array {
    return new Float64Array(memory.buffer, ptr, size);
}

export function main(game: Game) {
    console.log(game.turn_count());

    console.log(create_array(game.get_viewbox(), 4));
}
