import { create } from "domain";


export class Vertex {
    coords: [number, number];
    incident_edge: HalfEdge;

    constructor(x: number, y: number) {
        this.coords = [x, y];
    }

    get_all(): HalfEdge[] {
        const out = [];

        let current = this.incident_edge;
        do {
            out.push(current);
            current = current.twin.next;
        } while (current != this.incident_edge);

        return out;
    }
}

export class Face {
    attributes: any;

    outer_component: HalfEdge;
    inner_components: HalfEdge[];

    constructor(attributes?: any) {
        this.attributes = attributes;
    }

    loop(): [number, number][] {
        const out = [];
        let iter = 0;

        let current = this.outer_component;
        do {
            if (iter > 100) {
                throw new Error("Fuck off");
            }
            iter += 1;
            console.log(current.id, current.face.attributes, current.origin.coords);
            out.push(current.origin.coords);
            current = current.next;
        } while (current != this.outer_component);

        return out;
    }
}

var id = 0;
function next_id(): number {
    id += 1;
    return id;
}

export class HalfEdge {
    origin: Vertex;
    // destination = twin.origin

    next: HalfEdge;
    prev: HalfEdge;
    twin: HalfEdge;

    face: Face;

    id: number;

    constructor(origin: Vertex, f1: Face, f2?: Face) {
        this.id = next_id();

        this.origin = origin;
        this.next = this;
        this.prev = this;

        if (f2) {
            this.twin = new HalfEdge(origin, f2);
        } else {
            this.twin = this;
        }

        this.face = f1;
    }

    insert(at: Vertex, update_twin = true): HalfEdge {
        const new_edge = new HalfEdge(at, this.face);

        new_edge.next = this.next;
        new_edge.prev = this;
        new_edge.twin = this.twin;
        this.next.prev = new_edge;
        this.next = new_edge;

        if (update_twin) {
            this.twin = this.twin.insert(at, false);
        }

        return new_edge;
    }

    split(to: Vertex) {
        const e_to = new HalfEdge(this.origin, this.face);
        const e_from = new HalfEdge(to, this.face);
        e_to.twin = e_from;
        e_from.twin = e_to;

        e_to.prev = this.prev;
        e_to.next = e_from;
        e_from.next = this;
        e_from.prev = e_to;

        this.prev.next = e_to;
        this.prev = e_from;
    }

    add_face() {

    }

    to_string(): string {
        return `Halfedge from ${this.origin ? this.origin.coords : undefined} face1 ${this.face ? this.face.attributes : undefined}`;
    }
}

export function test() {
    const f1 = new Face("Face 1");
    const f2 = new Face("Face 2");

    const v1 = new Vertex(0, 0);
    const v2 = new Vertex(1, 1);
    const v3 = new Vertex(-1, 0);
    const v4 = new Vertex(2, 0);

    const e1 = new HalfEdge(v1, f1, f2);
    f1.outer_component = e1;
    const e2 = e1.insert(v2);
    const e3 = e2.split(v3);
    const e4 = e2.insert(v4);

    e1.twin.next = e4.twin;
    f2.outer_component = e4.twin;
    // const e3 = e1.insert(v3);

    console.log(f1.loop());
    console.log(f2.loop());
}
