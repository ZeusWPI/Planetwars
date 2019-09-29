import { Heap } from 'ts-heap'
import { HalfEdge, Face, Vertex } from './dcel';

interface WithPriority {
    get_priority(): number;
}

export class Point {
    x: number;
    y: number;
    face?: Face;

    constructor(x: number, y: number, face? :Face) {
        this.x = x;
        this.y = y;
        this.face = face;
    }

    equals(other: Point): boolean {
        return Math.abs(this.x - other.x) + Math.abs(this.y - other.y) < 0.00001;
    }

    toString(): string {
        return `{x: ${this.x}, y: ${this.y}}`;
    }
}

class CircleEvent implements WithPriority {
    y: number;
    alive: boolean = true;
    center: Vertex;
    leaf: Leaf;

    from: Point[];

    static
    from_sites(s1: Point, s2: Point, s3: Point, leaf: Leaf): CircleEvent {
        const a = s1.x * (s2.y - s3.y) - s1.y*(s2.x - s3.x) + s2.x*s3.y - s3.x * s2.y;
        const b = (s1.x ** 2 + s1.y ** 2) * (s3.y - s2.y) + (s2.x ** 2 + s2.y ** 2)*(s1.y - s3.y) + (s3.x ** 2 + s3.y ** 2) * (s2.y - s1.y);
        const c = (s1.x ** 2 + s1.y ** 2) * (s2.x - s3.x) + (s2.x ** 2 + s2.y ** 2)*(s3.x - s1.x) + (s3.x ** 2 + s3.y ** 2) * (s1.x - s2.x);
        const d = (s1.x ** 2 + s1.y ** 2) * (s3.x*s2.y - s2.x*s3.y) + (s2.x ** 2 + s2.y ** 2)*(s1.x*s3.y - s3.x*s1.y) + (s3.x ** 2 + s3.y ** 2) * (s2.x*s1.y - s1.x*s2.y);

        const center = new Vertex(-b / (2. * a), -c / (2. * a));
        const r = Math.sqrt((b ** 2 + c ** 2 - 4. * a * d) / (4. * a ** 2));
        const y = center.coords[1] - r;

        const out = new CircleEvent();
        out.y = y;
        out.center = center;
        out.leaf = leaf;

        out.from = [s1, s2, s3];

        return out;
    }

    get_priority(): number {
        return this.y;
    }

    print() {
        console.log(`Circle event at ${this.y} ${JSON.stringify(this.center)}, ${this.leaf.point.toString()} from ${JSON.stringify(this.from.map((e) => e.toString()))}`);
    }
}

class SiteEvent implements WithPriority{
    face: Face;
    point: Point;

    constructor(point: Point) {
        this.face = new Face(point);
        this.point = point;
        this.point.face = this.face;
    }

    get_priority(): number {
        return this.point.y;
    }

    print() {
        console.log(`Site event ${this.point.toString()}`);
    }
}

function calc_x(left: Point, right: Point, y: number): number {
    const [a1, b1, c1] = from_focus_vertex(left, y);
    const [a2, b2, c2] = from_focus_vertex(right, y);

    if (Math.abs(a1 - a2) < 0.0001) {
        return (left.x + right.x) / 2.;
    }

    const da = a1 - a2;
    const db = b1 - b2;
    const dc = c1 - c2;

    const d = db * db - 4. * da * dc;

    if (d <= 0.) {
        throw new Error(`D is less then 0 ${d}`);
    }

    const dd = Math.sqrt(d);

    const x = (-db + dd) / (2. * da);

    return x;
}

function from_focus_vertex(focus: Point, y: number): number[] {
    const a = (focus.y - y) / 2;
    const h = focus.x;
    const k = focus.y - a;

    return [1 / (4. * a), -h / (2 * a), (h ** 2 / (4 * a)) + k]
}

function cmp_event(e1: WithPriority, e2: WithPriority) {
    return e2.get_priority() - e1.get_priority();
}

type Queue = Heap<WithPriority>;

type Node = Leaf | Breakpoint;

type Parent = Breakpoint | State;

class Leaf {
    point: Point;
    event: CircleEvent | undefined;

    left: Leaf | undefined;
    right: Leaf | undefined;
    parent: Parent;

    half_edge: HalfEdge;

    constructor(point: Point, parent: Parent) {
        this.point = point;
        this.parent = parent;
        this.half_edge = new HalfEdge(undefined, undefined);
    }

    false_alarm() {
        if(this.event) {
            console.log(`False alarm ${JSON.stringify(this.event.center)} ${this.event.y}`);
            this.event.alive = false;
        }
    }

    update_left(leaf: Leaf) {
        if (this.left) {
            this.left.right = leaf;
        }
        leaf.left = this.left;
    }

    update_right(leaf: Leaf) {
        if (this.right) {
            this.right.left = leaf;
        }
        leaf.right = this.right;
    }

    split(point: Point, events: Queue) {
        this.false_alarm();

        if (this.point.y == point.y) {
            const middle = new Leaf(point, undefined);
            const parent = this.parent;

            if (this.point.x > point.x) {
                const br = new Breakpoint([point, middle], [this.point, this], this.parent);

                if (this.left) this.left.right = middle;
                this.left = middle;
                middle.right = this;

                if (parent instanceof Breakpoint) {
                    parent.set_me(this, br);
                } else {
                    parent.root = br;
                }

                const maybe_left = middle.check_circles(point.y, events);

                if (maybe_left && maybe_left.center.coords[0] < middle.point.x) {
                    console.log(`Adding circle`);
                    maybe_left.print();
                    middle.event = maybe_left;
                    events.add(maybe_left);
                }

                const maybe_right = this.check_circles(point.y, events);
                if (maybe_right && maybe_right.center.coords[0] >= middle.point.x) {
                    console.log(`Adding circle`);
                    maybe_right.print();
                    this.event = maybe_right;
                    events.add(maybe_right);
                }

            } else {
                const br = new Breakpoint([this.point, this], [point, middle], this.parent);

                if (this.right) this.right.left = middle;
                this.right = middle;
                middle.left = this;

                if (parent instanceof Breakpoint) {
                    parent.set_me(this, br);
                } else {
                    parent.root = br;
                }

                const maybe_left = this.check_circles(point.y, events);

                if (maybe_left && maybe_left.center.coords[0] < middle.point.x) {
                    console.log(`Adding circle`);
                    maybe_left.print();
                    this.event = maybe_left;
                    events.add(maybe_left);
                }

                const maybe_right = middle.check_circles(point.y, events);
                if (maybe_right && maybe_right.center.coords[0] >= middle.point.x) {
                    console.log(`Adding circle`);
                    maybe_right.print();
                    middle.event = maybe_right;
                    events.add(maybe_right);
                }
            }

            return;
        }

        const left = new Leaf(this.point, undefined);
        left.left = this.left;
        if (this.left) this.left.right = left;

        const right = new Leaf(this.point, undefined);
        right.right = this.right;
        if (this.right) this.right.left = right;

        const middle = new Leaf(point, undefined);
        middle.left = left;
        middle.right = right;

        right.left = middle;
        left.right = middle;

        const br1 = new Breakpoint([this.point, left], [point, middle], undefined);
        const br2 = new Breakpoint([point, br1], [this.point, right], this.parent);
        br1.parent = br2;

        if (this.parent instanceof Breakpoint) {
            this.parent.set_me(this, br2);
        } else {
            this.parent.root = br2;
        }

        const maybe_left = left.check_circles(point.y, events);
        if (maybe_left && maybe_left.center.coords[0] < middle.point.x) {
            console.log(`Adding circle`);
            maybe_left.print();
            left.event = maybe_left;
            events.add(maybe_left);
        }

        const maybe_right = right.check_circles(point.y, events);
        if (maybe_right && maybe_right.center.coords[0] >= middle.point.x) {
            console.log(`Adding circle`);
            maybe_right.print();
            right.event = maybe_right;
            events.add(maybe_right);
        }
    }

    check_circles(y: number, events: Queue): CircleEvent | undefined {
        const left = this.left;
        const right = this.right;

        if (left && right) {
            const circle = CircleEvent.from_sites(left.point, this.point, right.point, this);
            console.log(`${circle.y} < ${y}`);
            if (circle.y < y ) {
                return circle;
            }
        }
    }

    delete(vertex: Vertex) {
        if (this.parent instanceof Breakpoint) {
            this.parent.remove_me(this.point, vertex);
        } else {
            console.error("Shouldnt be here");
        }
    }

    print(indent: string) {
        console.log(`${indent}Leaf from ${this.point.toString()} vertex: ${this.half_edge.to_string()}`);
    }
}

class Breakpoint {
    left: [Point, Node];
    right: [Point, Node];
    parent: Parent;
    half_edge: HalfEdge;

    constructor(left: [Point, Node], right: [Point, Node], parent: Parent) {
        this.left = left;
        this.right = right;
        this.left[1].parent = this;
        this.right[1].parent = this;
        this.parent = parent;

        this.half_edge = new HalfEdge(undefined, left[0].face, right[0].face);
    }

    remove_me(point: Point, vertex: Vertex) {
        const edge = this.half_edge.insert(vertex);
        const other = this.get_other(point);
        if (this.parent instanceof Breakpoint) {
            this.parent.set_me(this, other);
            this.parent.set_edge(edge);
        } else {
            this.parent.root = other;
        }

    }

    set_edge(edge: HalfEdge) {
        this.left[1].half_edge = edge;
        this.right[1].half_edge = edge.split(edge.origin);
    }

    set_me(old_me: Node, new_me: Node) {
        if (this.left[1] == old_me) {
            this.left[1] = new_me;
        } else {
            this.right[1] = new_me;
        }
    }

    get(point: Point): Leaf {
        const { x, y } = point;
        const test_x = calc_x(this.left[0], this.right[0], y);

        if (test_x >= x) {
            if (this.left[1] instanceof Leaf) {
                return this.left[1];
            } else {
                return this.left[1].get(point);
            }
        } else {
            if (this.right[1] instanceof Leaf) {
                return this.right[1];
            } else {
                return this.right[1].get(point);
            }
        }
    }

    get_other(point: Point): Node {
        if (this.left[0].equals(point)) {
            return this.right[1];
        } else {
            return this.left[1];
        }
    }

    print(indent: string) {
        console.log(`${indent}vertex: ${this.half_edge.to_string()}`);
        console.log(`${indent}left`);
        this.left[1].print(indent + '  ');
        console.log(`${indent}right`);
        this.right[1].print(indent + '  ');
    }
}

function get_from_node(root: Node, point: Point): Leaf {
    if (root instanceof Leaf) {
        return root;
    } else {
        return root.get(point);
    }
}

class State {
    root: Node | undefined;

    print() {
        if (this.root) {
            this.root.print('');
        } else {
            console.log("No root no tree");
        }
    }
}

export function voronoi(points: Point[]): Point[] {
    const out = [];
    const state = new State;
    const queue = new Heap<WithPriority>(cmp_event);


    for (let point of points) {
        queue.add(new SiteEvent(point));
    }

    let event;
    while (event = queue.pop()){
        console.log('---------------------------');
        event.print();

        if (event instanceof SiteEvent) {
            handle_site_event(event, queue, state, out);
        } else {
            if (!event.alive) {
                console.log("Dead");
                continue;
            }
            handle_circle_event(event, queue, state, out);
        }
        state.print();
        console.log(queue);
        print_leaves(get_from_node(state.root, new Point(0, 0)));
    }

    return out;
}

function handle_site_event(event: SiteEvent, queue: Queue, state: State, out: Point[]) {
    if (state.root) {
        const leaf = get_from_node(state.root, event.point);
        leaf.split(event.point, queue);

    } else {
        state.root = new Leaf(event.point, state);
    }
}

function handle_circle_event(event: CircleEvent, queue: Queue, state: State, out: [number, number][]) {
    if (!event.alive) return;

    event.leaf.delete(event.center);
    const right = event.leaf.right;
    const left = event.leaf.left;

    if (right) {
        right.false_alarm();
        // if (right.right) right.right.false_alarm();

        right.left = left;
        const maybe_right = right.check_circles(event.y, queue);
        if (maybe_right){
            console.log(`Adding circle event`);
            maybe_right.print();
            right.event = maybe_right;
            queue.add(maybe_right);
        }
    }

    if (left) {
        left.false_alarm();
        // if (left.left) left.left.false_alarm();
        left.right = right;
        const maybe_left = left.check_circles(event.y, queue);

        if (maybe_left){
            console.log(`Adding circle event`);
            maybe_left.print();
            left.event = maybe_left;
            queue.add(maybe_left);
        }
    }

    out.push(event.center.coords);
}

function print_leaves(start: Leaf) {
    let current = start;

    while (current.left) {
        current = current.left;
    }

    const points = [current.point];

    while (current.right) {
        current = current.right;
        points.push(current.point);
    }

    console.log(JSON.stringify(points.map((p) => p.toString())));
}
