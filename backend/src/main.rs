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

use tracing_subscriber::{EnvFilter, FmtSubscriber};

use std::net::SocketAddr;
use std::{env, time};

use mozaic::modules::types::*;
use mozaic::modules::{game, StepLock};

use futures::executor::ThreadPool;
use futures::future::FutureExt;

use mozaic::graph;
use mozaic::modules::*;

mod planetwars;

// Load the config and start the game.
#[async_std::main]
async fn main() {
    let args: Vec<String> = env::args().collect();
    let name = args[0].clone();
    match run(args).await {
        None => print_info(&name),
        _ => {}
    };
}

fn build_builder(
    pool: ThreadPool,
    number_of_clients: u64,
    max_turns: u64,
    map: &str,
    location: &str,
) -> game::Builder<planetwars::PlanetWarsGame> {
    let config = planetwars::Config {
        map_file: map.to_string(),
        max_turns: max_turns,
    };

    let game =
        planetwars::PlanetWarsGame::new(config.create_game(number_of_clients as usize), location);

    let players: Vec<PlayerId> = (0..number_of_clients).collect();

    game::Builder::new(players.clone(), game).with_step_lock(
        StepLock::new(players.clone(), pool.clone())
            .with_timeout(std::time::Duration::from_secs(1)),
    )
}

async fn run(args: Vec<String>) -> Option<()> {
    let fut = graph::set_default();

    let sub = FmtSubscriber::builder()
        .with_env_filter(EnvFilter::from_default_env())
        .finish();
    tracing::subscriber::set_global_default(sub).unwrap();

    let addr = "127.0.0.1:9142".parse::<SocketAddr>().unwrap();

    let map = args.get(1)?;
    let number_of_clients = args
        .get(2)
        .map(|x| x.parse().expect("Client number should be a number"))
        .unwrap_or(1);
    let location = args.get(3).map(|x| x.as_str()).unwrap_or("game.json");
    let max_turns: u64 = args
        .get(4)
        .map(|x| x.parse().expect("Max turns should be a number"))
        .unwrap_or(500);

    let pool = ThreadPool::new().ok()?;
    pool.spawn_ok(fut.map(|_| ()));

    let (gmb, handle) = game::Manager::builder(pool.clone());
    let ep = TcpEndpoint::new(addr, pool.clone());
    let gmb = gmb.add_endpoint(ep, "TCP endpoint");
    let mut gm = gmb.build();

    let game_builder = build_builder(pool.clone(), number_of_clients, max_turns, map, location);
    std::thread::sleep(time::Duration::from_millis(3000));

    let mut current_game = gm.start_game(game_builder).await.unwrap();

    loop {
        match gm.get_state(current_game).await {
            None => {
                println!("Game finished, let's play a new one");
                let game_builder =
                    build_builder(pool.clone(), number_of_clients, max_turns, map, location);
                current_game = gm.start_game(game_builder).await.unwrap();
            }
            Some(state) => {
                println!("{:?}", state);
            }
        }
        std::thread::sleep(time::Duration::from_millis(3000));
    }

    handle.await;

    std::thread::sleep(time::Duration::from_millis(100));

    Some(())
}

fn print_info(name: &str) {
    println!(
        "Usage: {} map_location [number_of_clients [output [max_turns]]]",
        name
    );
}
