import { Texture } from "./texture";
import { Dictionary } from "./util";
import { Renderable, RenderShit } from "./renderer";
import { Uniform, Shader, UniformMatrix3fv } from "./shader";
import { IndexBuffer, VertexBuffer } from "./buffer";
import { VertexBufferLayout, VertexArray } from "./vertexBufferLayout";


export enum Align {
    Left,
    Right,
    Center,
}

export class GlypInfo {
    x: number;
    y: number;
    width: number;
}

export class FontInfo {
    letterHeight: number;
    spaceWidth: number;
    spacing: number;
    textureWidth: number;
    textureHeight: number;
    glyphInfos: Dictionary<GlypInfo>;
}

export class LabelFactory {
    texture: Texture;
    font: FontInfo;
    shader: Shader;

    constructor(gl: WebGLRenderingContext, loc: string, font: FontInfo, shader: Shader) {
        this.texture = Texture.fromImage(gl, loc, 'font');
        this.font = font;
        this.shader = shader;
    }

    build(gl: WebGLRenderingContext, transform?: UniformMatrix3fv): Label {
        return new Label(gl, this.shader, this.texture, this.font, transform);
    }
}

export class Label implements Renderable {
    inner: Renderable;
    ib: IndexBuffer;
    vb: VertexBuffer;

    font: FontInfo;

    constructor(gl: WebGLRenderingContext, shader: Shader, tex: Texture, font: FontInfo, transform?: UniformMatrix3fv) {
        this.font = font;

        const uniforms = transform ? { "u_trans": transform, "u_trans_next": transform, } : {};
        this.ib = new IndexBuffer(gl, []);
        this.vb = new VertexBuffer(gl, []);

        const layout = new VertexBufferLayout();
        layout.push(gl.FLOAT, 2, 4, "a_position");
        layout.push(gl.FLOAT, 2, 4, "a_texCoord");

        const vao = new VertexArray();
        vao.addBuffer(this.vb, layout);

        this.inner = new RenderShit(this.ib, vao, shader, [tex], uniforms);
    }

    getUniforms(): Dictionary<Uniform> {
        return this.inner.getUniforms();
    }

    render(gl: WebGLRenderingContext): void {
        return this.inner.render(gl);
    }

    setText(gl: WebGLRenderingContext, text: string, align?: Align) {
        align = align || Align.Left;

        const idxs = [];
        const verts = [];

        const letterHeight = this.font.letterHeight / this.font.textureHeight;
        let xPos = 0;

        switch (align) {
            case Align.Left:
                break;
            case Align.Right:
                xPos = -1 * [...text].map(n => this.font.glyphInfos[n] ? this.font.glyphInfos[n].width : this.font.spaceWidth).reduce((a, b) => a + b, 0) / this.font.letterHeight;
                break;
            case Align.Center:
                xPos = -1 * [...text].map(n => this.font.glyphInfos[n] ? this.font.glyphInfos[n].width : this.font.spaceWidth).reduce((a, b) => a + b, 0) / this.font.letterHeight / 2;
                break;
        }

        let j = 0;
        for (let i = 0; i < text.length; i++) {
            const info = this.font.glyphInfos[text[i]];
            if (info) {
                const dx = info.width / this.font.letterHeight;
                const letterWidth = info.width / this.font.textureWidth;
                const x0 = info.x / this.font.textureWidth;
                const y0 = info.y / this.font.textureHeight;
                verts.push(xPos, 0, x0, y0);
                verts.push(xPos + dx, 0, x0 + letterWidth, y0);
                verts.push(xPos, -1, x0, y0 + letterHeight);
                verts.push(xPos + dx, -1, x0 + letterWidth, y0 + letterHeight);
                xPos += dx;

                idxs.push(j + 0, j + 1, j + 2, j + 1, j + 2, j + 3);
                j += 4;
            } else {
                // Just move xPos
                xPos += this.font.spaceWidth / this.font.letterHeight;
            }
        }

        this.ib.updateData(gl, idxs);
        this.vb.updateData(gl, verts);
    }
}

export function defaultLabelFactory(gl: WebGLRenderingContext, shader: Shader): LabelFactory {
    const fontInfo = {
        letterHeight: 8,
        spaceWidth: 8,
        spacing: -1,
        textureWidth: 64,
        textureHeight: 40,
        glyphInfos: {
            'a': { x: 0, y: 0, width: 8, },
            'b': { x: 8, y: 0, width: 8, },
            'c': { x: 16, y: 0, width: 8, },
            'd': { x: 24, y: 0, width: 8, },
            'e': { x: 32, y: 0, width: 8, },
            'f': { x: 40, y: 0, width: 8, },
            'g': { x: 48, y: 0, width: 8, },
            'h': { x: 56, y: 0, width: 8, },
            'i': { x: 0, y: 8, width: 8, },
            'j': { x: 8, y: 8, width: 8, },
            'k': { x: 16, y: 8, width: 8, },
            'l': { x: 24, y: 8, width: 8, },
            'm': { x: 32, y: 8, width: 8, },
            'n': { x: 40, y: 8, width: 8, },
            'o': { x: 48, y: 8, width: 8, },
            'p': { x: 56, y: 8, width: 8, },
            'q': { x: 0, y: 16, width: 8, },
            'r': { x: 8, y: 16, width: 8, },
            's': { x: 16, y: 16, width: 8, },
            't': { x: 24, y: 16, width: 8, },
            'u': { x: 32, y: 16, width: 8, },
            'v': { x: 40, y: 16, width: 8, },
            'w': { x: 48, y: 16, width: 8, },
            'x': { x: 56, y: 16, width: 8, },
            'y': { x: 0, y: 24, width: 8, },
            'z': { x: 8, y: 24, width: 8, },
            '0': { x: 16, y: 24, width: 8, },
            '1': { x: 24, y: 24, width: 8, },
            '2': { x: 32, y: 24, width: 8, },
            '3': { x: 40, y: 24, width: 8, },
            '4': { x: 48, y: 24, width: 8, },
            '5': { x: 56, y: 24, width: 8, },
            '6': { x: 0, y: 32, width: 8, },
            '7': { x: 8, y: 32, width: 8, },
            '8': { x: 16, y: 32, width: 8, },
            '9': { x: 24, y: 32, width: 8, },
            '-': { x: 32, y: 32, width: 8, },
            '*': { x: 40, y: 32, width: 8, },
            '!': { x: 48, y: 32, width: 8, },
            '?': { x: 56, y: 32, width: 8, },
        },
    };

    return new LabelFactory(gl, 'static/res/assets/font.png', fontInfo, shader);
}
