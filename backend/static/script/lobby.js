const ids = {};
["map_holder", "name", "turns", "nop", "lobby"].forEach(id => ids[id] = document.getElementById(id));

var last_map;
var last_url;

async function handle_map_click(url, event) {
    if (last_map) {
        last_map.classList.remove("selected");
    }
    last_map = event.target;
    event.target.classList.add("selected");
    last_url = url;
    const c = await fetch(url);
    ids["map_holder"].innerHTML = await c.text();
}

async function refresh_state() {
    const c = await fetch("/partial/state");
    ids["lobby"].innerHTML = await c.text();
}

async function start_game() {
    const obj = {
        "nop": parseInt(ids["nop"].value),
        "name": ids["name"].value,
        "map": last_url,
        "max_turns": parseInt(ids["turns"].value),
    };

    const xhr = new XMLHttpRequest();

    xhr.onreadystatechange = async function() {
        console.log(this);
        // TODO: make response visible
    };

    xhr.open("POST", "/lobby");
    xhr.addEventListener("loadend", refresh_state);

    xhr.send(JSON.stringify(obj));
}

window.onload = () => refresh_state();