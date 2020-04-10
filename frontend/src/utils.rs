pub fn set_panic_hook() {
    // When the `console_error_panic_hook` feature is enabled, we can call the
    // `set_panic_hook` function at least once during initialization, and then
    // we will get better error messages if our code ever panics.
    //
    // For more details see
    // https://github.com/rustwasm/console_error_panic_hook#readme
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

use octoon_math::{Vec3};

/// this is total extra, so it the planet viewbox is like 100px wide, it will now be in total 110 pixels wide
static VIEWBOX_SCALE: f32 = 0.1;

pub static COLORS: [[f32; 3]; 10] = [
    [0.5 , 0.5 , 0.5 ],
    [1.0 , 0.5 , 0.0 ],    // #FF8000
    [0.05, 0.77, 1.0 ],    // #0DC5FF
    [0.1 , 0.31, 1.0 ],    // #1950FF
    [0.01, 1.0 , 0.72],    // #19FFB7
    [1.0 , 0.4 , 0.58],    // #FF6693
    [1.0 , 0.25, 0.05],    // #FF3F0D
    [0.25, 1.0 , 0.22],    // #40FF56
    [1.0 , 0.97, 0.0 ],    // #FFED00
    [0.41, 0.15, 1.0 ],    // #6826FF
];

use super::types;

pub fn caclulate_viewbox(planets: &Vec<types::Planet>) -> Vec<f32> {
    let mut iter = planets.iter();

    let init = match iter.next() {
        Some(p) => (p.x, p.y, p.x, p.y),
        None => return vec![0.0, 0.0, 0.0, 0.0],
    };
    let (min_x, min_y, max_x, max_y) = planets
        .iter()
        .fold(init, |(min_x, min_y, max_x, max_y), p| (min_x.min(p.x), min_y.min(p.y), max_x.max(p.x), max_y.max(p.y)));

    let (width, height) = (max_x - min_x, max_y - min_y);
    let (dx, dy) = ((VIEWBOX_SCALE * width).max(6.0), (VIEWBOX_SCALE * height).max(6.0));

    vec![min_x - dx/2.0, min_y - dy/2.0, width + dx, height + dy]
}

pub fn get_planets(planets: &Vec<types::Planet>, r: f32) -> Vec<Vec3<f32>> {
    planets.iter().map(|p| Vec3::new(p.x, p.y, r)).collect()
}
