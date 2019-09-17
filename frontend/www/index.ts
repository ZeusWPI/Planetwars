import { Game } from "planetwars";
import { memory } from "planetwars/plantwars_bg";
import { Resizer, resizeCanvasToDisplaySize, FPSCounter } from "./webgl/util";
import { Shader, Uniform4f, Uniform2fv, Uniform3fv, Uniform1i, Uniform1f, Uniform2f, ShaderFactory } from './webgl/shader';
import { Renderer } from "./webgl/renderer";
import { VertexBuffer, IndexBuffer } from "./webgl/buffer";
import { VertexBufferLayout, VertexArray } from "./webgl/vertexBufferLayout";
import { callbackify } from "util";

const COUNTER = new FPSCounter();
const LOADER = document.getElementById("loader");

function set_loading(loading: boolean) {
    if (loading) {
        if (!LOADER.classList.contains("loading")) {
            LOADER.classList.add("loading");
        }
    } else {
        LOADER.classList.remove("loading");
    }
}

const URL = window.location.origin+window.location.pathname;
const LOCATION = URL.substring(0, URL.lastIndexOf("/") + 1);
const CANVAS = <HTMLCanvasElement>document.getElementById("c");
const RESOLUTION = [CANVAS.width, CANVAS.height];

const GL = CANVAS.getContext("webgl");
resizeCanvasToDisplaySize(<HTMLCanvasElement>GL.canvas);
GL.viewport(0, 0, GL.canvas.width, GL.canvas.height);

GL.clearColor(0, 0, 0, 0);
GL.clear(GL.COLOR_BUFFER_BIT);

GL.enable(GL.BLEND);
GL.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);

const positionBuffer = new VertexBuffer(GL, [
    -1, -1,
    -1, 1,
    1, -1,
    1, 1,
]);

const layout = new VertexBufferLayout();
layout.push(GL.FLOAT, 2, 4, "a_position");
const vao = new VertexArray();
vao.addBuffer(positionBuffer, layout);

const indexBuffer = new IndexBuffer(GL, [
    0, 1, 2,
    1, 2, 3,
]);

var SHADERFACOTRY: ShaderFactory;
ShaderFactory.create_factory(
    LOCATION + "static/shaders/frag/simple.glsl", LOCATION + "static/shaders/vert/simple.glsl"
).then((e) => SHADERFACOTRY = e);


function create_array(ptr: number, size: number): Float64Array {
    return new Float64Array(memory.buffer, ptr, size);
}

class GameInstance {
    resizer: Resizer;
    game: Game;
    shader: Shader;
    renderer: Renderer;

    constructor(game: Game)  {
        this.game = game;
        this.shader = SHADERFACOTRY.create_shader(GL, {"MAX_CIRCLES": "50"});
        this.resizer = new Resizer(CANVAS, [...create_array(game.get_viewbox(), 4)], true);
        this.renderer = new Renderer();
        this.renderer.addToDraw(indexBuffer, vao, this.shader);
    }

    render(time: number) {
        this.shader.uniform(GL, "u_circle_count", new Uniform1i(3));

        this.shader.uniform(GL, "u_time", new Uniform1f(time * 0.001));
        this.shader.uniform(GL, "u_mouse", new Uniform2f(this.resizer.get_mouse_pos()));
        this.shader.uniform(GL, "u_viewbox", new Uniform4f(this.resizer.get_viewbox()));
        this.shader.uniform(GL, "u_resolution", new Uniform2f(RESOLUTION));

        this.shader.uniform(GL, "u_circles", new Uniform3fv([
            0, 0, 3.5,
            -2, -2, 2,
            5, 2, 4,
        ]));
        this.shader.uniform(GL, "u_color", new Uniform4f([1, 1, 0, 1]));

        this.renderer.render(GL);
        COUNTER.frame(time);
    }
}

var game_instance: GameInstance;

export function set_instance(game: Game) {
    game_instance = new GameInstance(game);

    console.log(game.turn_count());

    console.log(create_array(game.get_viewbox(), 4));
}


function step(time: number) {
    if (game_instance) {
        game_instance.render(time);
        set_loading(false);
    } else {
        set_loading(true);
    }

    requestAnimationFrame(step);
}
set_loading(true);

requestAnimationFrame(step);
