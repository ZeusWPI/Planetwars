import { removeEl, newDiv, newInput, newLabel, addChildren, newButton } from './util'

const gridConfig = document.getElementById("gridConfig");
let width = 4;
let sep = 100;

function addGrid() {

    const grid = newDiv(["prop", "gridline"]);

    const w = newDiv(["item"]);
    const wi = newLabel("Line width", ["input"]);
    const wv = newInput("number", width + "");
    addChildren(w, [wi, wv]);

    const s = newDiv(["item"]);
    const si = newLabel("Seperation", ["input"]);
    const sv = newInput("number", sep + "");
    addChildren(s, [si, sv]);

    const c = newDiv(["item"]);
    const ci = newLabel("Color", ["input"]);
    const cv = newInput("text", "#333");
    addChildren(c, [ci, cv]);

    const hr = document.createElement("hr");

    const d = newButton("", ["btn", "delete"]);
    d.onclick = () => {
        removeEl(grid);
        removeEl(hr);

        width *= 2;
        sep *= 5;
    }

    addChildren(grid, [w, s, c, d]);

    gridConfig.appendChild(grid);
    gridConfig.appendChild(hr);

    width /= 2;
    if (width < 1) width = 1;
    sep /= 5;
    if (sep < 1) sep = 1;
}


export function init_grid() {
    document.getElementById("addbtn").onclick = () => addGrid();
    addGrid();
}
