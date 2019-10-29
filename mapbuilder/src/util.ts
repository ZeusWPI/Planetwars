
// DOM manipulation

export function removeEl(el: any) {
    el.remove();
}

export function newLabel(label = "", classes: string[] = []): HTMLLabelElement {
    const out: HTMLLabelElement = document.createElement("label");
    out.classList.add("input");
    out.appendChild(document.createTextNode(label));

    for(let c of classes) {
        out.classList.add(c);
    }

    return out;
}

export function newInput(type: string, value = "", classes: string[] = []): HTMLInputElement {
    const out: HTMLInputElement = document.createElement("input");

    out.type = type;
    out.value = value;

    for(let c of classes) {
        out.classList.add(c);
    }

    return out;
}

export function newDiv(classes: string[] = []): HTMLDivElement {
    const out: HTMLDivElement = document.createElement("div");

    for(let c of classes) {
        out.classList.add(c);
    }

    return out;
}

export function addChildren(div: HTMLDivElement, els: HTMLElement[]) {
    for(let c of els) {
        div.appendChild(c);
    }
}

export function newButton(value = "", classes: string[] = []): HTMLButtonElement {
    const out = document.createElement("button");
    out.appendChild(document.createTextNode(value));

    for(let c of classes) {
        out.classList.add(c);
    }

    return out;
}
