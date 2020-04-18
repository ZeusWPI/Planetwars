import { Shader } from "../webgl/shader";
import { BBox, Point, VoronoiDiagram } from "./voronoi-core";
import Voronoi = require("./voronoi-core");
import { DefaultRenderable } from "../webgl/renderer";
import { IndexBuffer, VertexBuffer } from "../webgl/buffer";
import { VertexBufferLayout, VertexArray } from "../webgl/vertexBufferLayout";

function to_key(p: Point): string {
    return [p.x, p.y] + "";
}

export class VoronoiBuilder {
    inner: DefaultRenderable;

    vor: VoronoiDiagram;
    a_own: number[];

    constructor(gl: WebGLRenderingContext, shader: Shader, planets: Point[], bbox: BBox) {
        const voronoi = new Voronoi();
        this.vor = voronoi.compute(planets, bbox);

        const a_pos = planets.concat(this.vor.vertices).reduce((a, b) => a.concat([-b.x, -b.y]), []);
        const a_own = new Array(planets.length + this.vor.vertices.length).fill(-1);

        const vert_indcs = {};
        planets.concat(this.vor.vertices).forEach((p, i) => vert_indcs[to_key(p)] = i);

        const ids = [];

        for (let cell of this.vor.cells) {
            const baseIndx = vert_indcs[to_key(cell.site)];
            console.log(baseIndx);
            for (let edge of cell.halfedges) {
                ids.push(baseIndx);

                ids.push(vert_indcs[to_key(edge.getStartpoint())]);
                ids.push(vert_indcs[to_key(edge.getEndpoint())])
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
        planets_owners.forEach((own, i) => this.a_own[i] = own);
        this.inner.updateVAOBuffer(gl, 1, this.a_own);
    }
}
