extern crate serde;
#[macro_use]
extern crate serde_derive;
extern crate serde_json;
extern crate octoon_math;

use octoon_math::{Mat3, Vec3};

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
    states: Vec<types::State>,
    turn: usize,

    /* put extra shit here */
    planets: Vec<Vec3<f64>>,
    view_box: Vec<f64>,

    ship_locations: Vec<Mat3<f64>>,
    current_planet_colours: Vec<Vec3<f64>>,
}

#[wasm_bindgen]
impl Game {
    pub fn new(file: &str) -> Self {
        utils::set_panic_hook();

        // First line is fucked but we just filter out things that cannot parse
        let states: Vec<types::State> = file.split("\n").filter_map(|line|
            serde_json::from_str(line).ok()
        ).collect();

        Self {
            planets: utils::get_planets(&states[0].planets, 10.0),
            view_box: utils::caclulate_viewbox(&states[0].planets),
            turn: 0,
            states,
            ship_locations: Vec::new(),
            current_planet_colours: Vec::new(),
        }
    }

    pub fn get_viewbox(&self) -> *const f64 {
        self.view_box.as_ptr()
    }

    pub fn get_planets(&self) -> *const Vec3<f64> {
        self.planets.as_ptr()
    }

    pub fn get_planet_colors(&self) -> *const Vec3<f64> {
        self.current_planet_colours.as_ptr()
    }

    pub fn get_planet_count(&self) -> usize {
        self.planets.len()
    }

    pub fn turn_count(&self) -> usize {
        self.states.len()
    }

    pub fn update_turn(&mut self, turn: usize) {
        self.turn = turn.min(self.states.len());

        self.update_planet_colours();
        self.update_ship_locations()
    }

    fn update_planet_colours(&mut self) {
        self.current_planet_colours = self.states[self.turn].planets
            .iter()
            .map(|p| utils::COLORS[p.owner.unwrap_or(0) as usize % utils::COLORS.len()].into())
            .collect();
    }

    fn update_ship_locations(&mut self) {

    }

    // pub fn add_location(&mut self, x: f64, y: f64, angle: f64) {
    //     self.current_turn.push(
    //         Location { x, y, angle}
    //     );
    // }

    pub fn location_count(&self) -> usize {
        self.ship_locations.len()
    }

    pub fn get_ship_locations(&self) -> *const Mat3<f64> {
        self.ship_locations.as_ptr()
    }
}


#[wasm_bindgen]
extern {
    fn alert(s: &str);
}
