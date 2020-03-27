const ids = {};
["map_holder", "name", "turns", "nop"].forEach(id => ids[id] = document.getElementById(id));

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

async function start_game() {
    const obj = {
        "nop": parseInt(ids["nop"].value),
        "name": ids["name"].value,
        "map": last_url,
        "max_turns": parseInt(ids["turns"].value),
    };

    console.log(obj);

    const xhr = new XMLHttpRequest();

    xhr.onreadystatechange = async function() {
        console.log(this);
        console.log(await this.text());

        // TODO: make response visible
    };

    xhr.open("POST", "/lobby");
    xhr.send(JSON.stringify(obj));
}
