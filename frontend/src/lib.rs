extern crate serde;
#[macro_use]
extern crate serde_derive;
extern crate serde_json;
extern crate octoon_math;

use octoon_math::{Mat3, Vec3};

mod utils;
mod types;

use std::collections::HashMap;
use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[derive(Debug, Clone)]
pub struct Circle {
    r: f32,
    x: f32,
    y: f32,
    a1: f32,
    a2: f32,
    distance: usize,
}

impl Circle {
    pub fn new(p1: &types::Planet, p2: &types::Planet) -> Self {
        let x1 = p1.x;
        let y1 = p1.y;
        let x2 = p2.x;
        let y2 = p2.y;

        let q = ((x2-x1).powi(2) + (y2-y1).powi(2)).sqrt();
        let x3 = (x1+x2)/2.0;
        let y3 = (y1+y2)/2.0;

        let r = q * 1.1;

        let (x, y) = if true {
            (
                x3 + (r.powi(2)-(q/2.0).powi(2)).sqrt() * (y1-y2)/q,
                y3 + (r.powi(2)-(q/2.0).powi(2)).sqrt() * (x2-x1)/q
            )
        } else {
            (
                x3 - (r.powi(2)-(q/2.0).powi(2)).sqrt() * (y1-y2)/q,
                y3 - (r.powi(2)-(q/2.0).powi(2)).sqrt() * (x2-x1)/q
            )
        };

        let a1 = (y - y1).atan2(x - x1);
        let a2 = (y - y2).atan2(x - x2);

        let distance = q.ceil() as usize + 1;

        Self {
            r, x, y, a1, a2, distance
        }
    }

    pub fn get_for_remaining(&self, remaining: usize) -> (Mat3<f32>, Mat3<f32>) {
        (
            self.get_remaining(remaining),
            self.get_remaining((remaining + 1).min(self.distance - 1)),
        )
    }

    fn get_remaining(&self, remaining: usize) -> Mat3<f32> {
        let alpha = (self.a1 * remaining as f32 + (self.distance - remaining) as f32 * self.a2) / self.distance as f32;

        let cos = alpha.cos();
        let sin = alpha.sin();
        Mat3::new(
            0.3, 0.0, 0.0,
            0.0, 0.4, 0.0,
            -self.x + cos * self.r, -self.y + sin * self.r, 0.3,
        ) * Mat3::rotate_z(alpha)
    }
}

// struct Line {
//     x1: f32,
//     y1: f32,
//     x2: f32,
//     y2: f32,
//     a: f32,
//     d: usize,
// }
// impl Line {
//     pub fn new(p1: &types::Planet, p2: &types::Planet) -> Self {
//         let dx = p1.x - p2.x;
//         let dy = p1.y - p2.y;
//         let a = dy.atan2(dx);
//         // let a = (dy / dx).atan();
//         let d = (dx * dx + dy * dy).sqrt().ceil() as usize + 1;

//         Self {
//             x1: p1.x,
//             x2: p2.x,
//             y1: p1.y,
//             y2: p2.y,
//             d, a,
//         }
//     }

//     pub fn get_for_remaining(&self, remaining: usize) -> (Mat3<f32>, Mat3<f32>) {
//         (
//             self.get_remaining(remaining),
//             self.get_remaining((remaining + 1).min(self.d - 1)),
//         )
//     }

//     fn get_remaining(&self, remaining: usize) -> Mat3<f32> {
//         let x = (self.x1 * remaining as f32 + (self.d - remaining) as f32 * self.x2) / self.d as f32;
//         // let x = self.x1 + (remaining as f32 / self.d as f32) * (self.x2 - self.x1);
//         let y = (self.y1 * remaining as f32 + (self.d - remaining) as f32 * self.y2) / self.d as f32;

//         // let y = self.y1 + (remaining as f32 / self.d as f32) * (self.y2 - self.y1);
//         Mat3::new(
//             0.3, 0.0, 0.0,
//             0.0, 0.3, 0.0,
//             x, y, 0.3,
//         ) * Mat3::rotate_z(self.a)
//     }
// }


#[wasm_bindgen]
pub struct Game {
    states: Vec<types::State>,
    turn: usize,

    planet_map: HashMap<(String, String), Circle>,

    /* put extra shit here */
    view_box: Vec<f32>,

    planets: Vec<Vec3<f32>>,

    ship_locations: Vec<[f32;9]>,
    ship_colours: Vec<Vec3<f32>>,
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

        let mut planet_map = HashMap::new();

        // Iterator?
        for p1 in states[0].planets.iter() {
            for p2 in states[0].planets.iter() {
                planet_map.insert((p1.name.clone(), p2.name.clone()), Circle::new(&p1, &p2));
            }
        }

        Self {
            planets: utils::get_planets(&states[0].planets, 2.0),
            view_box: utils::caclulate_viewbox(&states[0].planets),

            planet_map,
            turn: 0,
            states,
            ship_locations: Vec::new(),
            ship_colours: Vec::new(),
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

    pub fn update_turn(&mut self, turn: usize) -> usize {
        self.turn = turn.min(self.states.len() -1);

        self.update_planet_colours();
        self.update_ship_locations();

        self.turn
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
        let mut new_vec = Vec::new();
        for ship in self.states[self.turn].expeditions.iter() {
            let (o1, o2) = self.planet_map.get(&(ship.origin.clone(), ship.destination.clone())).unwrap().get_for_remaining(ship.turns_remaining as usize);
            new_vec.push(o1.to_array());
            new_vec.push(o2.to_array());
        }
        self.ship_locations = new_vec;

        self.ship_colours = self.states[self.turn].expeditions.iter().map(|s| {
            utils::COLORS[s.owner as usize % utils::COLORS.len()].into()
        }).collect();
    }

    pub fn get_max_ships(&self) -> usize {
        self.states.iter().map(|s| s.expeditions.len()).max().unwrap()
    }

    pub fn get_ship_count(&self) -> usize {
        self.states[self.turn].expeditions.len()
    }

    pub fn get_ship_locations(&self) -> *const [f32;9] {
        self.ship_locations.as_ptr()
    }

    pub fn get_ship_colours(&self) -> *const Vec3<f32> {
        self.ship_colours.as_ptr()
    }
}


#[wasm_bindgen]
extern {
    fn alert(s: &str);
}
