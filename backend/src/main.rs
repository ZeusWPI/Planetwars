extern crate serde;
#[macro_use]
extern crate serde_derive;
extern crate serde_json;

extern crate tokio;
extern crate futures;
extern crate mozaic;
extern crate rand;

use std::env;
use std::net::SocketAddr;
use mozaic::messaging::types::*;
use mozaic::errors;

use mozaic::modules::{Aggregator, Steplock, game};


mod planetwars;

// Load the config and start the game.
fn main() {
    run(env::args().collect());
}

use mozaic::server::runtime::{Broker};
use rand::Rng;
use errors::Consumable;
use mozaic::modules::ConnectionManager;
use mozaic::modules::util;
use std::collections::HashMap;

pub fn run(args : Vec<String>) {

    let addr = "127.0.0.1:9142".parse::<SocketAddr>().unwrap();

    let manager_id: ReactorId = rand::thread_rng().gen();
    let welcomer_id: ReactorId = rand::thread_rng().gen();
    let aggregator_id: ReactorId = rand::thread_rng().gen();
    let steplock_id: ReactorId = rand::thread_rng().gen();

    let number_of_clients = args.get(1).map(|x| x.parse().unwrap_or(1)).unwrap_or(1);

    let ids: HashMap<util::Identifier, util::PlayerId> = (0..number_of_clients).map(|x| (rand::thread_rng().gen::<u64>().into(), x.into())).collect();

    let config = planetwars::Config { map_file: String::from("hex.json"), max_turns: 500 };
    let game = planetwars::PlanetWarsGame::new(config.create_game(number_of_clients as usize));

    println!("Tokens:");
    let keys: Vec<u64> = ids.keys().map(|&x| x.into()).collect();
    for key in keys {
        println!("key {}", key);
    }

    tokio::run(futures::lazy(move || {
        let mut broker = Broker::new().unwrap();

        broker.spawn(welcomer_id.clone(), game::GameReactor::params(steplock_id.clone(), Box::new(game)), "Main").display();
        broker.spawn(steplock_id.clone(), Steplock::new(broker.clone(), ids.values().cloned().collect(), welcomer_id.clone(), aggregator_id.clone()).with_timeout(5000).params(), "Steplock").display();
        broker.spawn(aggregator_id.clone(), Aggregator::params(manager_id.clone(), steplock_id.clone()), "Aggregator").display();
        broker.spawn(
            manager_id.clone(),
            ConnectionManager::params(broker.clone(), ids, aggregator_id.clone(), addr),
            "Connection Manager"
        ).display();

        Ok(())
    }));
}