extern crate serde;
#[macro_use]
extern crate serde_derive;
extern crate serde_json;

mod utils;
mod types;

use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub struct Game {
    states : Vec<types::State>,
    /* put extra shit here */
}

#[wasm_bindgen]
impl Game {
    pub fn new(file: &str) -> Self {
        utils::set_panic_hook();

        // First line is fucked but we just filter out things that cannot parse
        let states = file.split("\n").filter_map(|line|
            serde_json::from_str(line).ok()
        ).collect();

        Self {
            states
        }
    }

    pub fn turn_count(&self) -> usize {
        self.states.len()
    }
}


#[wasm_bindgen]
extern {
    fn alert(s: &str);
}
