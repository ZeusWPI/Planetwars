
import { set_game_name, set_loading, LOCATION, set_instance } from './index'
import { ConfigIniParser } from 'config-ini-parser'

const OPTIONS = document.getElementById("options");

const game_location = LOCATION + "static/games/mod.ini";

var game_name, game_file;

document.getElementById("addbutton").onclick = function() {
    const loc = window.location;
    const query = `?game=${game_file}&name=${game_name}`;
    navigator.clipboard.writeText(loc.origin+loc.pathname+encodeURI(query)).then(() => {
        console.log("Success");
    }, () => {
        console.log("Failed");
    });
}

async function on_load() {
    console.log("ON LOAD");
    if (OPTIONS) {
        const r = await fetch(game_location);
        const response = await r.text();
        parse_ini(response);
    } else {
        const options = document.getElementsByClassName("options");
        const urlVars = new URLSearchParams(window.location.search);

        if (urlVars.get("game") && urlVars.get("name")) {
            console.log(urlVars.get("game")+' '+urlVars.get("name"))
            handle(urlVars.get("game"),urlVars.get("name"))
        } else if (options[0]) {
            const options_div = <HTMLDivElement> options[0];
            if (options_div.children[0]) {
                options_div.children[0].dispatchEvent(new Event('click'));
            }
        }
    }
}
// window.addEventListener("load", on_load, false);

export function handle(location, name: string) {
    game_file = location;
    game_name = name;

    set_loading(true);

    fetch(location)
        .then((r) => r.text())
        .then((response) => {
            set_instance(response);
            set_game_name(name);
        }).catch(console.error);
}


function create_option(location: string, name: string, turns: string, players: string): HTMLElement {
    const div = document.createElement("div");
    div.className = "option";
    div.onclick = (_) => handle(location, name);
    console.log("hello there");
    console.log(`"${location}, "${name}"`);
    let ps = "";

    if (players) {
        ps += "<p>Players</p>";

        for (let [index, player] of players.split('"').entries()) {
            if (index % 2 == 0) {
                continue;
            }
            ps += `<p>${player}</p>`;
        }
    }

    const html = `
        <p>${name}</p>
        <p>Turns: ${turns}</p>
    ` + ps;

    div.innerHTML = html;

    return div;
}

function parse_ini(inifile: string) {
    const parser = new ConfigIniParser();
    parser.parse(inifile);

    const loc = parser.get(undefined, "path");

    OPTIONS.innerHTML = '';

    for (let name of parser.sections()) {
        const game = parser.get(name, "name");
        const turns = parser.get(name, "turns");
        const players = parser.get(name, "players")
        OPTIONS.appendChild(
            create_option(loc+name, game , turns, players)
        );
    }
}

on_load();
