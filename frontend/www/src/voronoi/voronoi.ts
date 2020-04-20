import { Shader } from "../webgl/shader";
import { BBox, Point, VoronoiDiagram } from "./voronoi-core";
import Voronoi = require("./voronoi-core");
import { DefaultRenderable } from "../webgl/renderer";
import { IndexBuffer, VertexBuffer } from "../webgl/buffer";
import { VertexBufferLayout, VertexArray } from "../webgl/vertexBufferLayout";

function arcctg(x: number): number { return Math.PI / 2 - Math.atan(x); }

function to_key(p: Point): string {
    return [p.x, p.y] + "";
}

function round_point(center: Point, point: Point, amount_fn = (b: number) => 0.7): Point {
    const d = dist(center, point, true);
    console.log("f:", amount_fn(d));
    const x = center.x + amount_fn(d) * (point.x - center.x);
    const y = center.y + amount_fn(d) * (point.y - center.y);
    return { 'x': x, 'y': y };
}

function median_point(c: Point, p: Point, n: Point, d = 0.1): number[] {
    const dd = 1.0 - 2 * d;
    return [
        dd * c.x + d * p.x + d * n.x,
        dd * c.y + d * p.y + d * n.y,
    ]
}

function build_point_map(es: Voronoi.HalfEdge[]): (point: Point) => Point {
    const mean = es.map(e => dist(e.getStartpoint(), e.getEndpoint())).reduce((a, b) => a + b, 0) / es.length;
    const map = {};

    for (let edge of es) {
        const start = edge.getStartpoint();
        const end = edge.getEndpoint();

        if (dist(start, end) < 0.1 * mean) {    // These points have to be merged
            const middle = { 'x': (start.x + end.x) / 2, 'y': (start.y + end.y) / 2 };
            map[to_key(start)] = middle;
            map[to_key(end)] = middle;
        }
    }

    return (p) => map[to_key(p)] || p;
}

function get_round_fn(dist_mean: number, amount = 0.7): (d: number) => number {
    return (d) => {
        console.log(arcctg(d - dist_mean));
        return arcctg((d - dist_mean) * 3) / Math.PI / 2 + 0.5
    }
}

function dist(a: Point, b: Point, norm = false): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    if (norm) return Math.sqrt(dx * dx + dy * dy);
    return dx * dx + dy * dy;
}

export class VoronoiBuilder {
    inner: DefaultRenderable;

    vor: VoronoiDiagram;
    a_own: number[];

    constructor(gl: WebGLRenderingContext, shader: Shader, planets: Point[], bbox: BBox) {
        const voronoi = new Voronoi();

        // This voronoi sorts the planets, then owners don't align anymore
        const own_map = {};
        planets.forEach((p, i) => own_map[to_key(p)] = i);

        this.vor = voronoi.compute(planets, bbox);

        const a_pos = [];
        const a_own = [];
        const ids = [];

        let vertCount = 0;

        for (let i = 0; i < this.vor.cells.length; i++) {
            const cell = this.vor.cells[i];
            const planetId = own_map[to_key(cell.site)];
            const point_map = build_point_map(cell.halfedges);

            const centerId = vertCount++;

            a_pos.push(cell.site.x, cell.site.y);
            a_own.push(planetId);

            const dist_mean = cell.halfedges.map(e => dist(cell.site, e.getStartpoint(), true)).reduce((a, b) => a + b, 0) / cell.halfedges.length;
            const round_fn = get_round_fn(dist_mean);

            for (let edge of cell.halfedges) {
                let start = point_map(edge.getStartpoint());
                let end = point_map(edge.getEndpoint());
                let center = { 'x': (start.x + end.x) / 2, 'y': (start.y + end.y) / 2 };

                if (to_key(start) == to_key(end)) continue;

                start = round_point(cell.site, start, round_fn);
                center = round_point(cell.site, center, round_fn);
                end = round_point(cell.site, end, round_fn);

                ids.push(centerId);
                ids.push(vertCount++);
                a_pos.push(start.x, start.y);
                a_own.push(-1);

                ids.push(vertCount++);
                a_pos.push(center.x, center.y);
                a_own.push(-1);

                ids.push(centerId);
                ids.push(vertCount - 1);

                ids.push(vertCount++);
                a_pos.push(end.x, end.y);
                a_own.push(-1);
            }
        }

        const ib = new IndexBuffer(gl, ids);
        const vb_pos = new VertexBuffer(gl, a_pos);
        const vb_own = new VertexBuffer(gl, a_own);

        const layout_pos = new VertexBufferLayout();
        layout_pos.push(gl.FLOAT, 2, 4, "a_pos");

        const layout_own = new VertexBufferLayout();
        layout_own.push(gl.FLOAT, 1, 4, "a_own");

        const vao = new VertexArray();
        vao.addBuffer(vb_pos, layout_pos);
        vao.addBuffer(vb_own, layout_own);

        this.inner = new DefaultRenderable(ib, vao, shader, [], {});

        this.a_own = a_own;
    }

    getRenderable(): DefaultRenderable {
        return this.inner;
    }

    updateOwners(gl: WebGLRenderingContext, planets_owners: number[]) {
        // planets_owners.forEach((own, i) => this.a_own[i] = own);
        // this.inner.updateVAOBuffer(gl, 1, this.a_own);
    }
}
