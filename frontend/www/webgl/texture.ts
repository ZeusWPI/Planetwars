

// TODO: fix texture locations, not use only 0
export class Texture {
    texture: WebGLTexture;
    image: HTMLImageElement;
    loaded: boolean;
    name: string;

    constructor(
        gl: WebGLRenderingContext,
        path: string,
        name: string,
    ) {
        this.loaded = false;
        this.name = name;

        this.image = new Image();
        this.image.onload = () => this.handleImageLoaded(gl);
        this.image.onerror = error;
        this.image.src = path;

        this.texture = gl.createTexture();
        this.bind(gl);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA,
            gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 0, 255]));
    }

    handleImageLoaded(gl: WebGLRenderingContext) {
        console.log('handling image loaded');
        this.bind(gl);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);

        this.unbind(gl);

        this.loaded = true;
    }

    bind(gl: WebGLRenderingContext, location=0) {
        gl.activeTexture(gl.TEXTURE0 + location);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }

    unbind(gl: WebGLRenderingContext) {
        gl.bindTexture(gl.TEXTURE_2D, null);
    }


    getWidth(): number {
        return this.image.width;
    }

    getHeight(): number {
        return this.image.height;
    }
}

function error(e: any) {
    console.error("IMAGE LOAD ERROR");
    console.error(e);
}
