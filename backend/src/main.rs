#![feature(proc_macro_hygiene, async_closure, decl_macro)]

extern crate serde;
#[macro_use]
extern crate serde_derive;
#[macro_use]
extern crate serde_json;

extern crate async_std;
extern crate futures;
extern crate mozaic;
extern crate rand;

extern crate figment;

extern crate tracing;
extern crate tracing_futures;
extern crate tracing_subscriber;

#[macro_use]
extern crate rocket;
extern crate rocket_contrib;

#[macro_use]
extern crate educe;

use figment::{providers::{Serialized, Env}};
use tracing_subscriber::{EnvFilter, FmtSubscriber};

use std::net::SocketAddr;

use mozaic::modules::game;

use futures::executor::ThreadPool;
use futures::future::FutureExt;

use mozaic::graph;
use mozaic::modules::*;

mod planetwars;
mod routes;
mod util;
use util::Games;
use util::COLOURS;

use rocket::fairing::AdHoc;
use rocket_contrib::templates::tera::{self, Value};
use rocket_contrib::templates::{Engines, Template};

use std::collections::HashMap;

/// Config for the planetwars server
#[derive(Deserialize, Serialize, Debug)]
pub struct PWConfig {
    host_name: String,
    address: String,
    port: u16,
}

impl Default for PWConfig {
    fn default() -> Self {
        Self {
            host_name: String::from("localhost"),
            address: String::from("0.0.0.0"),
            port: 8000,
        }
    }
}

/// Calculate viewbox from array of points (used in map preview), added to Tera engine.
/// So this function can be called in template.
fn calc_viewbox(value: &Value, _: &HashMap<String, Value>) -> tera::Result<Value> {
    let mut min_x = std::f64::MAX;
    let mut min_y = std::f64::MAX;
    let mut max_x = std::f64::MIN;
    let mut max_y = std::f64::MIN;
    for v in value.as_array().unwrap() {
        let x = v.get("x").and_then(|v| v.as_f64()).unwrap();
        let y = v.get("y").and_then(|v| v.as_f64()).unwrap();
        if x < min_x {
            min_x = x;
        }
        if x > max_x {
            max_x = x;
        }
        if y < min_y {
            min_y = y;
        }
        if y > max_y {
            max_y = y;
        }
    }

    return Ok(Value::String(format!(
        "{} {} {} {}",
        min_x - 3.,
        min_y - 3.,
        (max_x - min_x) + 6.,
        (max_y - min_y) + 6.
    )));
}

/// Get's the right colour for planets
fn get_colour(value: &Value, _: &HashMap<String, Value>) -> tera::Result<Value> {
    return Ok(Value::String(
        COLOURS[value.as_u64().unwrap_or(0) as usize].to_string(),
    ));
}

fn get_host_name(host_name: &str) -> impl Fn(&HashMap<String, Value>) -> tera::Result<Value> + Sync + Send {
    let host_name = host_name.to_string();

    move |_| Ok(Value::String(host_name.clone()))
}

/// Async main function, starting logger, graph and rocket
#[rocket::launch]
async fn rocket() -> rocket::Rocket {
    let fut = graph::set_default();

    let sub = FmtSubscriber::builder()
        .with_env_filter(EnvFilter::from_default_env())
        .finish();
    tracing::subscriber::set_global_default(sub).unwrap();

    let pool = ThreadPool::builder().create().unwrap();
    pool.spawn_ok(fut.map(|_| ()));
    let gm = create_game_manager("0.0.0.0:9142", pool.clone()).await;

    async_std::task::sleep(std::time::Duration::from_millis(200)).await;

    let mut routes = Vec::new();
    routes::fuel(&mut routes);

    let figment = rocket::Config::figment()
        .merge(Serialized::defaults(PWConfig::default()))   // Extend but not overwrite
        .merge(Env::prefixed("PW_"));                       // Overwrite

    rocket::custom(figment)
        .manage(gm)
        .manage(pool)
        .manage(Games::new())
        .attach(AdHoc::config::<PWConfig>())    // Manage the config
        .mount("/", routes)
        .attach(AdHoc::on_attach("Assets Config", async move |rocket| {
            let pw_config = rocket.figment().extract::<PWConfig>().unwrap_or_default();
            println!("PW Config {:?}", pw_config);
            let host_name = pw_config.host_name.clone();

            let tera = Template::custom(move |engines: &mut Engines| {
                engines.tera.register_filter("calc_viewbox", calc_viewbox);
                engines.tera.register_filter("get_colour", get_colour);
                engines.tera.register_function("get_host_name", get_host_name(&host_name));
            });

            Ok(rocket.attach(tera))
        }))
}

/// Creates the actual game_manager
/// Opening tcp socket etc..
async fn create_game_manager(tcp: &str, pool: ThreadPool) -> game::Manager {
    let addr = tcp.parse::<SocketAddr>().unwrap();
    let (gmb, handle) = game::Manager::builder(pool.clone());
    pool.spawn_ok(handle.map(|_| {println!("I'm done")}));
    let ep = TcpEndpoint::new(addr, pool.clone());

    let gmb = gmb.add_endpoint(ep, "TCP endpoint");
    gmb.build("games/games.json", pool).await.unwrap()
}
