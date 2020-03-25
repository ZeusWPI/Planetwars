const ids = {};
["map_holder"].forEach(id => ids[id] = document.getElementById(id));

async function handle_map_click(url) {
    console.log(url);
    const c = await fetch(url);
    ids["map_holder"].innerHTML = await c.text();
}
