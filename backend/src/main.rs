#![feature(proc_macro_hygiene)]

extern crate serde;
#[macro_use]
extern crate serde_derive;
extern crate serde_json;

extern crate async_std;
extern crate futures;
extern crate mozaic;
extern crate rand;

extern crate tracing;
extern crate tracing_futures;
extern crate tracing_subscriber;

#[macro_use]
extern crate rocket;
extern crate rocket_contrib;

extern crate ini;

use tracing_subscriber::{EnvFilter, FmtSubscriber};

use std::net::SocketAddr;

use mozaic::modules::{game};

use futures::executor::ThreadPool;
use futures::future::FutureExt;

use mozaic::graph;
use mozaic::modules::*;

mod planetwars;
mod routes;
mod util;
use util::Games;

use rocket_contrib::templates::{Template, Engines};
use rocket_contrib::templates::tera::{self, Value};

use std::collections::HashMap;

const COLOURS: [&'static str; 9] = ["grey", "blue", "cyan", "green", "yellow", "orange", "red", "pink", "purple"];

fn calc_viewbox(value: Value, _: HashMap<String, Value>) -> tera::Result<Value> {
    let mut min_x = std::f64::MAX;
    let mut min_y = std::f64::MAX;
    let mut max_x = std::f64::MIN;
    let mut max_y = std::f64::MIN;
    for v in value.as_array().unwrap() {
        let x = v.get("x").and_then(|v| v.as_f64()).unwrap();
        let y = v.get("y").and_then(|v| v.as_f64()).unwrap();
        if x < min_x { min_x = x; }
        if x > max_x { max_x = x; }
        if y < min_y { min_y = y; }
        if y > max_y { max_y = y; }
    }

    return Ok(Value::String(format!("{} {} {} {}", min_x - 3., min_y - 3., (max_x - min_x) + 6., (max_y - min_y) + 6.)));
}

fn get_colour(value: Value, _: HashMap<String, Value>) -> tera::Result<Value> {
    return Ok(Value::String(COLOURS[value.as_u64().unwrap_or(0) as usize].to_string()));
}

#[async_std::main]
async fn main() {
    let fut = graph::set_default();

    let sub = FmtSubscriber::builder()
        .with_env_filter(EnvFilter::from_default_env())
        .finish();
    tracing::subscriber::set_global_default(sub).unwrap();

    let pool = ThreadPool::new().unwrap();
    pool.spawn_ok(fut.map(|_| ()));
    let gm = create_game_manager("0.0.0.0:9142", pool.clone());


    let mut routes = Vec::new();
    routes::fuel(&mut routes);

    let tera = Template::custom(|engines: &mut Engines| {
        engines.tera.register_filter("calc_viewbox", calc_viewbox);
        engines.tera.register_filter("get_colour", get_colour);
    });


    rocket::ignite()
        .manage(gm)
        .manage(pool)
        .manage(Games::new())
        .attach(tera)
        .mount("/", routes)
        .launch()
        .unwrap();
}

fn create_game_manager(tcp: &str, pool: ThreadPool) -> game::Manager {
    let addr = tcp.parse::<SocketAddr>().unwrap();
    let (gmb, handle) = game::Manager::builder(pool.clone());
    pool.spawn_ok(handle.map(|_| ()));
    let ep = TcpEndpoint::new(addr, pool.clone());

    let gmb = gmb.add_endpoint(ep, "TCP endpoint");
    gmb.build()
}
