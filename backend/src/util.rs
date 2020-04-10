use crate::planetwars::FinishedState;
use mozaic::util::request::Connect;
use serde_json::Value;

use std::cmp::Ordering;
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

static NAV: [(&'static str, &'static str); 6] = [
    ("/", "Home"),
    ("/mapbuilder", "Map Builder"),
    ("/lobby", "Lobby"),
    ("/visualizer", "Visualizer"),
    ("/debug", "Debug Station"),
    ("/info", "Info"),
];

pub static COLOURS: [&'static str; 9] = [
    "gray", "blue", "cyan", "green", "yellow", "orange", "red", "pink", "purple",
];

/// The state of a player, in a running game.
/// This represents actual players or connection keys.
#[derive(Serialize, Educe)]
#[educe(PartialEq, Eq, PartialOrd, Ord)]
pub struct PlayerStatus {
    pub waiting: bool,
    pub connected: bool,
    pub reconnecting: bool,
    pub value: String,
}
impl From<Connect> for PlayerStatus {
    fn from(value: Connect) -> Self {
        match value {
            Connect::Connected(_, name) => PlayerStatus {
                waiting: false,
                connected: true,
                reconnecting: false,
                value: name,
            },
            Connect::Reconnecting(_, name) => PlayerStatus {
                waiting: false,
                connected: true,
                reconnecting: true,
                value: name,
            },
            Connect::Waiting(_, key) => PlayerStatus {
                waiting: true,
                connected: false,
                reconnecting: false,
                value: format!("Key: {}", key),
            },
            _ => panic!("No playerstatus possible from Connect::Request"),
        }
    }
}

fn partial_cmp(a: &SystemTime, b: &SystemTime) -> Option<Ordering> {
    b.partial_cmp(a)
}

/// The GameState is the state of a game.
/// Either Finished, so the game is done, not running, and there is a posible visualization.
/// Or Playing, the game is still being managed by the mozaic framework.
#[derive(Serialize, Educe)]
#[serde(tag = "type")]
#[educe(PartialEq, Eq, PartialOrd, Ord)]
pub enum GameState {
    #[educe(PartialOrd(rank = 1))]
    Playing {
        #[educe(PartialOrd(method = "partial_cmp"))]
        time: SystemTime,

        name: String,
        map: String,
        players: Vec<PlayerStatus>,
        connected: usize,
        total: usize,
        #[educe(Ord(ignore), PartialOrd(ignore))]
        state: Value,
    },
    #[educe(PartialOrd(rank = 2))]
    Finished {
        #[educe(PartialOrd(method = "partial_cmp"))]
        time: SystemTime,
        name: String,
        map: String,

        players: Vec<(String, bool)>,
        turns: u64,
        file: String,
    },
}

impl From<FinishedState> for GameState {
    fn from(mut state: FinishedState) -> Self {
        state.players.sort_by_key(|x| x.0);

        GameState::Finished {
            players: state
                .players
                .iter()
                .map(|(id, name)| (name.clone(), state.winners.contains(&id)))
                .collect(),
            map: state.map,
            name: state.name,
            turns: state.turns,
            file: state.file,
            time: state.time,
        }
    }
}

/// Link struct, holding all necessary information
#[derive(Serialize)]
struct Link {
    name: String,
    href: String,
    active: bool,
}

impl Link {
    fn build_nav(active: &str) -> Vec<Link> {
        NAV.iter()
            .map(|(href, name)| Link {
                name: name.to_string(),
                href: href.to_string(),
                active: *name == active,
            })
            .collect()
    }
}

/// Context used as template context.
/// This way you know to add nav bar support etc.
/// This T can be anything that is serializable, like json!({}) macro.
#[derive(Serialize)]
pub struct Context<T> {
    pub name: String,
    nav: Vec<Link>,

    #[serde(flatten)]
    pub t: Option<T>,
}

impl<T> Context<T> {
    pub fn new_with(active: &str, t: T) -> Self {
        let nav = Link::build_nav(active);

        Context {
            nav,
            name: String::from(""),
            t: Some(t),
        }
    }
}

impl Context<()> {
    pub fn new(active: &str) -> Self {
        let nav = Link::build_nav(active);

        Context {
            nav,
            name: String::from(""),
            t: None,
        }
    }
}

/// State of current live games
pub struct Games {
    inner: Arc<Mutex<Vec<(String, u64, SystemTime)>>>,
}

impl Games {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn add_game(&self, name: String, id: u64) {
        self.inner
            .lock()
            .unwrap()
            .push((name, id, SystemTime::now()));
    }

    pub fn get_games(&self) -> Vec<(String, u64, SystemTime)> {
        self.inner.lock().unwrap().clone()
    }
}
