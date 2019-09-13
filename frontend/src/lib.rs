extern crate serde;
#[macro_use]
extern crate serde_derive;
extern crate serde_json;

#[macro_use]
extern crate lazy_static;

use std::sync::{Arc, Mutex};

mod utils;
mod types;

use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

lazy_static! {
    static ref STATE: Mutex<Box<types::State>> = Mutex::new(Box::new(types::State {
        planets: Vec::new(),
        expeditions: Vec::new(),
    }));
}

#[wasm_bindgen]
extern {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn set_state(state: &str) {
    let deserialized: types::State = serde_json::from_str(state).unwrap();
    *STATE.lock().unwrap() = Box::new(deserialized);
}
