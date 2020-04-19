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

        const own_map = {};
        planets.forEach((p, i)=>own_map[to_key(p)] = i);

        // This voronoi sorts the planets, then owners don't align anymore
        this.vor = voronoi.compute(planets, bbox);

        const a_pos = [];
        const a_own = [];
        const ids = [];

        let vertCount = 0;

        for (let i = 0; i < this.vor.cells.length; i++) {
            const cell = this.vor.cells[i];
            const planetId = own_map[to_key(cell.site)];

            const centerId = vertCount++;
            a_pos.push(cell.site.x, cell.site.y);
            a_own.push(planetId);

            for (let edge of cell.halfedges) {
                const start = edge.getStartpoint();
                const end = edge.getEndpoint();
                const center = {'x': (start.x + end.x) / 2, 'y': (start.y + end.y) / 2};

                ids.push(centerId);
                ids.push(vertCount++);
                a_pos.push(start.x, start.y);
                a_own.push(-1);

                // ids.push(vertCount++);
                // a_pos.push(center.x, center.y);
                // a_own.push(planetId);

                // ids.push(centerId);
                // ids.push(vertCount-1);
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
