
import { set_loading, LOCATION, set_instance } from './index'
import { ConfigIniParser } from 'config-ini-parser'

const OPTIONS = document.getElementById("options");


const game_location = LOCATION + "static/games/mod.ini";

fetch(game_location)
    .then((r) => r.text())
    .then((response) => {
        parse_ini(response);
    }).catch(console.error);

export function handle(location) {
    set_loading(true);

    fetch(location)
        .then((r) => r.text())
        .then((response) => {
            set_instance(response);
        }).catch(console.error);
}


function create_option(location: string, name: string, turns: string, players: string): HTMLElement {
    const div = document.createElement("div");
    div.className = "option";
    div.onclick = (_) => handle(location);

    let ps = "";

    if (players) {
        ps += "<p>Players</p>";

        for (let [index, player] of players.split('"').entries()) {
            if (index % 2 == 0) {
                continue;
            }
            console.log(player);
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
