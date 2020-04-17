import { Renderable } from './renderer';
import { Shader, Uniform } from './shader';
import { Dictionary } from './util';

function createAndSetupTexture(gl: WebGLRenderingContext): WebGLTexture {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Set up texture so we can render any size image and so we are
    // working with pixels.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    return texture;
}

export class Foo implements Renderable {
    uniforms: Dictionary<Uniform>;

    stages: Stage[];

    textures: WebGLTexture[];
    framebuffers: WebGLFramebuffer[];

    width: number;
    height: number;


    constructor(gl: WebGLRenderingContext, width: number, height: number) {
        this.uniforms = {};
        this.width = width;
        this.height = height;

        for (let ii = 0; ii < 2; ++ii) {
            const texture = createAndSetupTexture(gl);
            this.textures.push(texture);

            // make the texture the same size as the image
            gl.texImage2D(
                gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0,
                gl.RGBA, gl.UNSIGNED_BYTE, null);

            // Create a framebuffer
            const fbo = gl.createFramebuffer();
            this.framebuffers.push(fbo);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

            // Attach a texture to it.
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        }
    }

    getUniforms(): Dictionary<Uniform> {
        return this.uniforms;
    }

    render(gl: WebGLRenderingContext) {
        this.stages.forEach( (item, i) => {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[i%2]);
            item.render(gl);
            gl.bindTexture(gl.TEXTURE_2D, this.textures[i % 2]);
        });
    }
}

class Stage implements Renderable {
    program: Shader;
    uniforms: Dictionary<Uniform>;

    getUniforms(): Dictionary<Uniform> {
        return this.uniforms;
    }

    render(gl: WebGLRenderingContext) {
        this.program.bind(gl);

        for (let name in this.uniforms) {
            this.program.uniform(gl, name, this.uniforms[name]);
        }
    }
}
