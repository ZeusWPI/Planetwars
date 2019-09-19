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
    planets: Vec<Vec3<f32>>,
    view_box: Vec<f32>,

    ship_locations: Vec<Mat3<f32>>,
    current_planet_colours: Vec<Vec3<f32>>,
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
            planets: utils::get_planets(&states[0].planets, 2.0),
            view_box: utils::caclulate_viewbox(&states[0].planets),
            turn: 0,
            states,
            ship_locations: Vec::new(),
            current_planet_colours: Vec::new(),
        }
    }

    pub fn get_viewbox(&self) -> *const f32 {
        self.view_box.as_ptr()
    }

    pub fn get_planets(&self) -> *const Vec3<f32> {
        self.planets.as_ptr()
    }

    pub fn get_planet_colors(&self) -> *const Vec3<f32> {
        self.current_planet_colours.as_ptr()
    }

    pub fn get_planet_count(&self) -> usize {
        self.planets.len()
    }

    pub fn turn_count(&self) -> usize {
        self.states.len()
    }

    pub fn update_turn(&mut self, turn: usize) {
        self.turn = turn.min(self.states.len() -1);

        self.update_planet_colours();
        self.update_ship_locations()
    }

    fn update_planet_colours(&mut self) {
        let mut new_vec = Vec::new();
        let planets_now = self.states[self.turn].planets.iter();
        let planets_later = self.states[(self.turn + 1).min(self.states.len() - 1)].planets.iter();

        for (p1, p2) in planets_now.zip(planets_later) {
            new_vec.push(
                utils::COLORS[p1.owner.unwrap_or(0) as usize % utils::COLORS.len()].into()
            );
            new_vec.push(
                utils::COLORS[p2.owner.unwrap_or(0) as usize % utils::COLORS.len()].into()
            );
        }

        self.current_planet_colours = new_vec;
    }

    fn update_ship_locations(&mut self) {

    }

    // pub fn add_location(&mut self, x: f32, y: f32, angle: f32) {
    //     self.current_turn.push(
    //         Location { x, y, angle}
    //     );
    // }

    pub fn location_count(&self) -> usize {
        self.ship_locations.len()
    }

    pub fn get_ship_locations(&self) -> *const Mat3<f32> {
        self.ship_locations.as_ptr()
    }
}


#[wasm_bindgen]
extern {
    fn alert(s: &str);
}
