use rocket::{Route};
use rocket::response::Redirect;

use rocket_contrib::templates::Template;

use crate::util::*;

const MAX: usize = 6;

/// Redirects to the first info page
#[get("/info")]
fn info_base() -> Redirect {
    Redirect::to("/info/1")
}

/// Renders the <page> info page
#[get("/info/<page>")]
async fn info(page: usize) -> Template {
    let context = Context::new_with("info", json!({
        "page": page,
        "next": if page + 1 <= MAX { Some(page + 1) } else { None },
        "prev": if page - 1 > 0 { Some(page - 1) } else { None }
    }));

    Template::render(format!("info/info_{}", page), &context)
}

pub fn fuel(routes: &mut Vec<Route>) {
    routes.extend(routes![info_base, info]);
}
