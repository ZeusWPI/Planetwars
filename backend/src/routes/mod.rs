use crate::planetwars::FinishedState;
use crate::util::*;

use rocket::response::NamedFile;
use rocket::Route;
use rocket_contrib::templates::Template;

use async_std::fs;
use async_std::io::BufReader;
use async_std::prelude::*;

use futures::stream::StreamExt;

use std::path::{Path, PathBuf};

mod info;
mod lobby;
mod maps;

/// Handles all files located in the static folder
#[get("/<file..>", rank = 6)]
async fn files(file: PathBuf) -> Option<NamedFile> {
    NamedFile::open(Path::new("static/").join(file)).ok()
}

/// Routes the index page, rendering the index Template.
#[get("/")]
async fn index() -> Template {
    let context = Context::new("Home");
    Template::render("index", &context)
}

/// Routes the mapbuilder page, rendering the mapbuilder Template.
#[get("/mapbuilder")]
async fn builder_get() -> Result<Template, String> {
    let context = Context::new("Map Builder");
    Ok(Template::render("mapbuilder", &context))
}

/// Routes the debug page, rendering the debug Template.
#[get("/debug")]
async fn debug_get() -> Result<Template, String> {
    let context = Context::new("Debug Station");
    Ok(Template::render("debug", &context))
}

/// Routes the visualizer page, rendering the visualizer Template.
#[get("/visualizer")]
async fn visualizer_get() -> Template {
    let mut game_options: Vec<GameState> = get_played_games().await;
    game_options.sort();

    let context = Context::new_with(
        "Visualizer",
        json!({"games": game_options, "colours": COLOURS}),
    );
    Template::render("visualizer", &context)
}

/// Fuels all routes
pub fn fuel(routes: &mut Vec<Route>) {
    routes.extend(routes![
        files,
        index,
        builder_get,
        visualizer_get,
        debug_get
    ]);
    lobby::fuel(routes);
    maps::fuel(routes);
    info::fuel(routes);
}

/// Reads games.ini
/// File that represents all played games
/// Ready to be visualized
async fn get_played_games() -> Vec<GameState> {
    match fs::File::open("games.ini").await {
        Ok(file) => {
            let file = BufReader::new(file);
            file.lines()
                .filter_map(move |maybe| async {
                    maybe
                        .ok()
                        .and_then(|line| serde_json::from_str::<FinishedState>(&line).ok())
                })
                .map(|state| state.into())
                .collect()
                .await
        }
        Err(_) => Vec::new(),
    }
}
