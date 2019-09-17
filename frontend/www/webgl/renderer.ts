
import { IndexBuffer } from './buffer';
import { Shader, Uniform1i } from './shader';
import { VertexArray } from './vertexBufferLayout';
import { Texture } from './texture';

export interface Renderable {
    render(gl: WebGLRenderingContext): void;
}

export class Renderer {
    renderables: Renderable[];

    indexBuffers: IndexBuffer[];
    vertexArrays: VertexArray[];
    shaders: Shader[];
    textures: Texture[];

    constructor() {
        this.indexBuffers = [];
        this.vertexArrays = [];
        this.shaders = [];
        this.textures = [];
    }

    addRenderable(item: Renderable) {
        this.renderables.push(item);
    }

    addToDraw(indexBuffer: IndexBuffer, vertexArray: VertexArray, shader: Shader, texture?: Texture): number {
        this.indexBuffers.push(indexBuffer);
        this.vertexArrays.push(vertexArray);
        this.shaders.push(shader);
        this.textures.push(texture);

        return this.indexBuffers.length - 1;
    }

    render(gl: WebGLRenderingContext) {
        const maxTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
        let texLocation = 0;

        for(let i = 0; i < this.indexBuffers.length; i ++) {
            const indexBuffer = this.indexBuffers[i];
            const vertexArray = this.vertexArrays[i];
            const shader = this.shaders[i];
            const texture = this.textures[i];

            if (texture) {

                shader.uniform(gl, texture.name, new Uniform1i(texLocation));
                texture.bind(gl, texLocation);

                texLocation ++;
                if (texLocation > maxTextures) {
                    console.error("Using too many textures, this is not supported yet\nUndefined behaviour!");
                }
            }
            
            if (vertexArray && shader) {
                vertexArray.bind(gl, shader);
                
                if (indexBuffer) {
                    indexBuffer.bind(gl);
                    gl.drawElements(gl.TRIANGLES, indexBuffer.getCount(), gl.UNSIGNED_SHORT, 0);
                } else {
                    console.error("IndexBuffer is required to render, for now");
                }
            }
        }
    }
}
