import { Game } from "planetwars";
import { Shader } from "./webgl/shader"

import { set_instance } from './index.ts'

const URL = window.location.origin+window.location.pathname;
const LOCATION = URL.substring(0, URL.lastIndexOf("/") + 1);

const game_location = LOCATION + "static/game.json";

fetch(game_location)
    .then((r) => r.text())
    .then((response) => {
        set_instance(Game.new(response));
    }).catch(console.error);
