import { Game } from "planetwars";
import { memory } from "planetwars/plantwars_bg";
import { Resizer, resizeCanvasToDisplaySize, FPSCounter, url_to_mesh, Mesh } from "./webgl/util";
import { Shader, Uniform4f, Uniform2fv, Uniform3fv, Uniform1i, Uniform1f, Uniform2f, ShaderFactory, Uniform3f, UniformMatrix3fv } from './webgl/shader';
import { Renderer } from "./webgl/renderer";
import { VertexBuffer, IndexBuffer } from "./webgl/buffer";
import { VertexBufferLayout, VertexArray } from "./webgl/vertexBufferLayout";
import { callbackify } from "util";

function f32v(ptr: number, size: number): Float32Array {
    return new Float32Array(memory.buffer, ptr, size);
}

function i32v(ptr: number, size: number): Int32Array {
    return new Int32Array(memory.buffer, ptr, size);
}

const COUNTER = new FPSCounter();
const LOADER = document.getElementById("loader");

const SLIDER = <HTMLInputElement>document.getElementById("turnSlider");
const FILESELECTOR = <HTMLInputElement> document.getElementById("fileselect");

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

var SHADERFACOTRY: ShaderFactory;
ShaderFactory.create_factory(
    LOCATION + "static/shaders/frag/simple.glsl", LOCATION + "static/shaders/vert/simple.glsl"
).then((e) => SHADERFACOTRY = e);



class GameInstance {
    resizer: Resizer;
    game: Game;
    shader: Shader;
    renderer: Renderer;
    planet_count: number;

    playing = true;    // 0 is paused, 1 is playing but not rerendered, 2 is playing and rerendered
    time_stopped_delta = 0;
    last_time = 0;
    frame = -1;

    ship_indices: number[];

    constructor(game: Game, meshes: Mesh[], ship_mesh: Mesh)  {
        this.game = game;
        this.planet_count = this.game.get_planet_count();
        this.shader = SHADERFACOTRY.create_shader(GL, {"MAX_CIRCLES": ''+this.planet_count});
        this.resizer = new Resizer(CANVAS, [...f32v(game.get_viewbox(), 4)], true);
        this.renderer = new Renderer();
        this.game.update_turn(0);

        // Setup key handling
        document.addEventListener('keydown', this.handleKey.bind(this));

        const planets = f32v(game.get_planets(), this.planet_count * 3);

        for(let i=0; i < this.planet_count; i++){

            const transform = new UniformMatrix3fv([
                1, 0, 0,
                0, 1, 0,
                -planets[i*3], -planets[i*3+1], 1,
            ]);

            const indexBuffer = new IndexBuffer(GL, meshes[i % meshes.length].cells);
            const positionBuffer = new VertexBuffer(GL, meshes[i % meshes.length].positions);

            const layout = new VertexBufferLayout();
            layout.push(GL.FLOAT, 3, 4, "a_position");
            const vao = new VertexArray();
            vao.addBuffer(positionBuffer, layout);

            this.renderer.addToDraw(
                indexBuffer,
                vao,
                this.shader,
                {
                    "u_trans": transform,
                    "u_trans_next": transform,
                }
            );
        }

        this.ship_indices = [];
        const ship_ibo = new IndexBuffer(GL, ship_mesh.cells);
        const ship_positions = new VertexBuffer(GL, ship_mesh.positions);
        const ship_layout = new VertexBufferLayout();
        ship_layout.push(GL.FLOAT, 3, 4, "a_position");
        const ship_vao = new VertexArray();
        ship_vao.addBuffer(ship_positions, ship_layout);

        for (let i = 0; i < this.game.get_max_ships(); i++) {
            this.ship_indices.push(
                this.renderer.addToDraw(
                    ship_ibo,
                    ship_vao,
                    this.shader,
                    {}
                )
            );
        }

        // Set slider correctly
        SLIDER.max = this.game.turn_count() - 1 + '';
    }

    _update_state() {
        const colours = f32v(this.game.get_planet_colors(), this.planet_count * 6);
        for(let i=0; i < this.planet_count; i++){
            const u = new Uniform3f(colours[i*6], colours[i*6 + 1], colours[i*6 + 2]);
            this.renderer.updateUniform(i, (us) => us["u_color"] = u);
            const u2 = new Uniform3f(colours[i*6 + 3], colours[i*6 + 4], colours[i*6 + 5]);
            this.renderer.updateUniform(i, (us) => us["u_color_next"] = u2);
        }

        const ships = f32v(this.game.get_ship_locations(), this.game.get_ship_count() * 9 * 2);
        const ship_colours = f32v(this.game.get_ship_colours(), this.game.get_ship_count() * 3);

        for (let i=0; i < this.game.get_max_ships(); i++) {
            const index = this.ship_indices[i];
            if (i < this.game.get_ship_count()) {

                this.renderer.enableRendershit(index);

                const u = new Uniform3f(ship_colours[i*3], ship_colours[i*3 + 1], ship_colours[i*3 + 2]);
                // const t1 = new UniformMatrix3fv(new Float32Array(ships, i * 18, 9));
                // const t2 = new UniformMatrix3fv(new Float32Array(ships, i * 18 + 9, 9));

                const t1 = new UniformMatrix3fv(ships.slice(i * 18, i * 18 + 9));
                const t2 = new UniformMatrix3fv(ships.slice(i * 18 + 9, i * 18 + 18));

                this.renderer.updateUniform(index, (us) => {
                    us["u_color"] = u;
                    us["u_color_next"] = u;
                    us["u_trans"] = t1;
                    us["u_trans_next"] = t2;
                });
            } else {
                this.renderer.disableRenderShift(index);
            }
        }
    }

    render(time: number) {
        COUNTER.frame(time);

        if (!this.playing) {
            this.last_time = time;
            return;
        }
        if (time > this.last_time + 500) {

            this.last_time = time;
            this.updateTurn(this.frame + 1);
        }

        GL.bindFramebuffer(GL.FRAMEBUFFER, null);
        GL.viewport(0, 0, GL.canvas.width, GL.canvas.height);
        GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

        this.shader.uniform(GL, "u_time", new Uniform1f((time - this.last_time) / 500));
        this.shader.uniform(GL, "u_mouse", new Uniform2f(this.resizer.get_mouse_pos()));
        this.shader.uniform(GL, "u_viewbox", new Uniform4f(this.resizer.get_viewbox()));
        this.shader.uniform(GL, "u_resolution", new Uniform2f(RESOLUTION));

        this.shader.uniform(GL, "u_animated", new Uniform1i(+this.playing));

        this.renderer.render(GL);
    }

    updateTurn(turn: number) {
        this.frame = Math.max(0, turn);
        const new_frame = this.game.update_turn(this.frame);
        if (new_frame < this.frame) {
            this.frame = new_frame;
            this.playing = false;
        } else {
            this._update_state();
            this.playing = true;
        }

        SLIDER.value = this.frame + '';
    }

    handleKey(event: KeyboardEvent) {
        // Space
        if (event.keyCode == 32) {
            if (this.playing) {
                this.playing = false;
            } else {
                this.playing = true;
            }
        }

        // Arrow left
        if (event.keyCode == 37) {
            // This feels more natural than -1 what it should be, I think
            this.updateTurn(this.frame - 2);
        }

        // Arrow right
        if (event.keyCode == 39) {
            this.updateTurn(this.frame + 1);
        }
    }
}

var game_instance: GameInstance;

export async function set_instance(game: Game) {
    const meshes = await Promise.all(
        ["ship.svg", "earth.svg", "mars.svg", "venus.svg"].map(
            (name) => "static/res/assets/" + name
        ).map(url_to_mesh)
    );
    game_instance = new GameInstance(game, meshes.slice(1), meshes[0]);
}

SLIDER.oninput = function() {
    if (game_instance) {
        game_instance.updateTurn(parseInt(SLIDER.value));
    }
}

FILESELECTOR.onchange = function(){
    const file = FILESELECTOR.files[0];
    var reader = new FileReader();

    reader.onload = function() {
        console.log(reader.result);
      set_instance(Game.new(<string> reader.result));
    }

    reader.readAsText(file);
}

function step(time: number) {
    if (game_instance) {
        set_loading(false);
        game_instance.render(time);
    } else {
        set_loading(true);
    }

    requestAnimationFrame(step);
}
set_loading(true);

requestAnimationFrame(step);
