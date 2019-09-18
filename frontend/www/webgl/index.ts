
import { Shader, Uniform4f, Uniform2fv, Uniform3fv, Uniform1i, Uniform1f, Uniform2f, ShaderFactory } from './shader';
import { resizeCanvasToDisplaySize, FPSCounter, onload2promise, Resizer } from "./util";
import { VertexBuffer, IndexBuffer } from './buffer';
import { VertexArray, VertexBufferLayout } from './vertexBufferLayout';
import { Renderer } from './renderer';
import { Texture } from './texture';


async function main() {

    const URL = window.location.origin+window.location.pathname;
    const LOCATION = URL.substring(0, URL.lastIndexOf("/") + 1);


    // Get A WebGL context
    var canvas = <HTMLCanvasElement>document.getElementById("c");
    const resolution = [canvas.width, canvas.height];

    const resizer = new Resizer(canvas, [-100, -10, 200, 20], true);

    var gl = canvas.getContext("webgl");
    if (!gl) {
        return;
    }

    const renderer = new Renderer();

    const factory = await ShaderFactory.create_factory(LOCATION + "static/shaders/frag/simple.glsl", LOCATION + "static/shaders/vert/simple.glsl");
    const program = factory.create_shader(gl, {"MAX_CIRCLES": "50"});

    var positions = [
        -1, -1, 0, 1,
        -1, 1, 0, 0,
        1, -1, 1, 1,
        1, 1, 1, 0,
    ];

    var positionBuffer = new VertexBuffer(gl, positions);
    var layout = new VertexBufferLayout();
    layout.push(gl.FLOAT, 2, 4, "a_position");
    layout.push(gl.FLOAT, 2, 4, "a_tex");

    const vao = new VertexArray();
    vao.addBuffer(positionBuffer, layout);

    resizeCanvasToDisplaySize(<HTMLCanvasElement>gl.canvas);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Clear the canvas
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    program.bind(gl);
    vao.bind(gl, program);

    var indices = [
        0, 1, 2,
        1, 2, 3,
    ];

    var indexBuffer = new IndexBuffer(gl, indices);
    indexBuffer.bind(gl);

    renderer.addToDraw(indexBuffer, vao, program);

    var blue = 1.0;
    var inc = 0.05;

    const counter = new FPSCounter();

    const step = function (time: number) {
        blue += inc;
        // if (blue > 1.0 || blue < 0.0) {
        //     inc = -1 * inc;
        //     blue += inc;
        // }

        program.uniform(gl, "u_circle_count", new Uniform1i(3));

        program.uniform(gl, "u_time", new Uniform1f(time * 0.001));
        program.uniform(gl, "u_mouse", new Uniform2f(resizer.get_mouse_pos()));
        program.uniform(gl, "u_viewbox", new Uniform4f(resizer.get_viewbox()));
        program.uniform(gl, "u_resolution", new Uniform2f(resolution));
        program.uniform(gl, "u_circles", new Uniform3fv([
            0, 0, 3.5,
            -2, -2, 2,
            5, 2, 4,
        ]));
        program.uniform(gl, "u_color", new Uniform4f([1, blue, 0, 1]));

        renderer.render(gl);

        counter.frame(time);
        requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}

main();

document.getElementById("loader").classList.remove("loading");

// const loader = document.getElementById("loader");
// setInterval(() => {
//     if (loader.classList.contains("loading")) {
//         loader.classList.remove("loading")
//     } else {
//         loader.classList.add("loading");
//     }
// }, 2000);
