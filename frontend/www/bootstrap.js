// A dependency graph that contains any wasm must all be imported
// asynchronously. This `bootstrap.js` file does the single async import, so
// that no one else needs to worry about it again.
// Import index.js that executes index.ts
var h = (a, b) => {}

export function handle(loc, e) {
    console.log("handle");
    h(loc, e);
}

import ("./index.js")
.then(e => {
        console.log(e.handle);
        h = e.handle;
    })
    .catch(e => console.error("Error importing `index.js`:", e));

window.setTimeout(() => handle("static/games/spiral2.json", "spiral2"), 3000);