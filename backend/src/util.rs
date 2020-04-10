use crate::planetwars::FinishedState;
use mozaic::util::request::Connect;
use serde_json::Value;

use std::cmp::Ordering;
use std::sync::{Arc, Mutex};

static NAV: [(&'static str, &'static str); 6] = [
    ("/", "Home"),
    ("/mapbuilder", "Map Builder"),
    ("/lobby", "Lobby"),
    ("/visualizer", "Visualizer"),
    ("/debug", "Debug Station"),
    ("/info", "Info"),
];

pub static COLOURS: [&'static str; 10] = [
    "#808080", "#FF8000", "#0080ff", "#FF6693", "#3fcb55", "#cbc33f", "#cf40e9", "#FF3F0D", "#1beef0", "#0DC5FF"
];

/// The state of a player, in a running game.
/// This represents actual players or connection keys.
#[derive(Serialize, Eq, PartialEq)]
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

/// The GameState is the state of a game.
/// Either Finished, so the game is done, not running, and there is a posible visualization.
/// Or Playing, the game is still being managed by the mozaic framework.
#[derive(Serialize, Eq, PartialEq)]
#[serde(tag = "type")]
pub enum GameState {
    Finished {
        name: String,
        map: String,
        players: Vec<(String, bool)>,
        turns: u64,
        file: String,
    },
    Playing {
        name: String,
        map: String,
        players: Vec<PlayerStatus>,
        connected: usize,
        total: usize,
        state: Value,
    },
}

impl PartialOrd for GameState {
    fn partial_cmp(&self, other: &GameState) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for GameState {
    fn cmp(&self, other: &GameState) -> Ordering {
        match self {
            GameState::Finished { name, .. } => match other {
                GameState::Finished { name: _name, .. } => name.cmp(_name),
                _ => Ordering::Greater,
            },
            GameState::Playing { name, .. } => match other {
                GameState::Playing { name: _name, .. } => name.cmp(_name),
                _ => Ordering::Less,
            },
        }
    }
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

/// Games is the game manager wrapper so Rocket can manage it
pub struct Games {
    inner: Arc<Mutex<Vec<(String, u64)>>>,
}

impl Games {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn add_game(&self, name: String, id: u64) {
        self.inner.lock().unwrap().push((name, id));
    }

    pub fn get_games(&self) -> Vec<(String, u64)> {
        self.inner.lock().unwrap().clone()
    }
}
