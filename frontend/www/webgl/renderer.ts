
import { IndexBuffer } from './buffer';
import { Shader, Uniform1i, Uniform } from './shader';
import { VertexArray } from './vertexBufferLayout';
import { Texture } from './texture';
import { Dictionary } from './util';

export interface Renderable {
    render(gl: WebGLRenderingContext): void;
}

export class Renderer {
    renderables: Renderable[];

    indexBuffers: IndexBuffer[];
    vertexArrays: VertexArray[];
    shaders: Shader[];
    textures: Texture[];
    uniforms: Dictionary<Uniform>[];

    constructor() {
        this.indexBuffers = [];
        this.vertexArrays = [];
        this.shaders = [];
        this.textures = [];
        this.uniforms = [];
    }

    updateUniform(i: number, f: (uniforms: Dictionary<Uniform>) => void) {
        f(this.uniforms[i]);
    }

    addRenderable(item: Renderable) {
        this.renderables.push(item);
    }

    addToDraw(indexBuffer: IndexBuffer, vertexArray: VertexArray, shader: Shader, uniforms: Dictionary<Uniform>,texture?: Texture): number {
        this.indexBuffers.push(indexBuffer);
        this.vertexArrays.push(vertexArray);
        this.shaders.push(shader);
        this.textures.push(texture);

        this.uniforms.push(uniforms);


        return this.indexBuffers.length - 1;
    }

    render(gl: WebGLRenderingContext, frameBuffer?: WebGLFramebuffer, width?: number, height?: number) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        gl.viewport(0, 0, width || gl.canvas.width, height || gl.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const maxTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
        let texLocation = 0;

        for(let i = 0; i < this.indexBuffers.length; i ++) {
            const indexBuffer = this.indexBuffers[i];
            const vertexArray = this.vertexArrays[i];
            const uniforms = this.uniforms[i];

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

            if (vertexArray && shader && uniforms) {
                for(let key in uniforms) {
                    shader.uniform(gl, key, uniforms[key]);
                }

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
