const ids = {};
["map_holder", "name", "turns", "nop"].forEach(id => ids[id] = document.getElementById(id));

var last_map;

async function handle_map_click(url, event) {
    if (last_map) {
        last_map.classList.remove("selected");
    }
    last_map = event.target;
    event.target.classList.add("selected");
    const c = await fetch(url);
    ids["map_holder"].innerHTML = await c.text();
}

async function start_game() {

}