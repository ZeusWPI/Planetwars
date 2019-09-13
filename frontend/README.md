# Planetwars frontend

This is the main folder of the Planetwars frontend.
Here you can compile the rust wasm files needed in the 'WWW' folder that is actually used to host the server.
When making changes make sure you recompile them using `wasm-pack build`
and webpack is running in www with `npm start` from the www folder.

### Build

wasm-pack build

### Dependencies

- rustup, rustc, cargo
- npm
- wasm-pack
- nightly, wasm32-unknown-unknown target

...

Follow this link https://rustwasm.github.io/docs/book/game-of-life/setup.html
