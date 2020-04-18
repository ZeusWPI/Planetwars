import { Game } from "planetwars";
import { memory } from "planetwars/planetwars_bg";
import { Resizer, resizeCanvasToDisplaySize, FPSCounter, url_to_mesh, Mesh } from "./webgl/util";
import { Shader, Uniform4f, Uniform2fv, Uniform3fv, Uniform1i, Uniform1f, Uniform2f, ShaderFactory, Uniform3f, UniformMatrix3fv, UniformBool } from './webgl/shader';
import { Renderer } from "./webgl/renderer";
import { VertexBuffer, IndexBuffer } from "./webgl/buffer";
import { VertexBufferLayout, VertexArray } from "./webgl/vertexBufferLayout";
import { Texture } from "./webgl/texture";
import { callbackify } from "util";
import { defaultLabelFactory, LabelFactory, Align, Label } from "./webgl/text";
import Voronoi = require("./voronoi/voronoi-core");
import { VoronoiBuilder } from "./voronoi/voronoi";

function f32v(ptr: number, size: number): Float32Array {
    return new Float32Array(memory.buffer, ptr, size);
}

function i32v(ptr: number, size: number): Int32Array {
    return new Int32Array(memory.buffer, ptr, size);
}

export function set_game_name(name: string) {
    GAMENAME.innerHTML = name;
}

const GAMENAME = document.getElementById("name");

const TURNCOUNTER = document.getElementById("turnCounter");

const COUNTER = new FPSCounter();
const LOADER = document.getElementById("main");

const SLIDER = <HTMLInputElement>document.getElementById("turnSlider");
const FILESELECTOR = <HTMLInputElement>document.getElementById("fileselect");
const SPEED = <HTMLInputElement>document.getElementById("speed");

export function set_loading(loading: boolean) {
    if (loading) {
        if (!LOADER.classList.contains("loading")) {
            LOADER.classList.add("loading");
        }
    } else {
        LOADER.classList.remove("loading");
    }
}

const URL = window.location.origin + window.location.pathname;
export const LOCATION = URL.substring(0, URL.lastIndexOf("/") + 1);
const CANVAS = <HTMLCanvasElement>document.getElementById("c");
const RESOLUTION = [CANVAS.width, CANVAS.height];

const GL = CANVAS.getContext("webgl");

var ms_per_frame = parseInt(SPEED.value);

resizeCanvasToDisplaySize(CANVAS);

GL.clearColor(0, 0, 0, 0);
GL.clear(GL.COLOR_BUFFER_BIT);

GL.enable(GL.BLEND);
GL.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);

// TODO: fix this
var SHADERFACOTRY: ShaderFactory;
ShaderFactory.create_factory(
    LOCATION + "static/shaders/frag/simple.glsl", LOCATION + "static/shaders/vert/simple.glsl"
).then((e) => SHADERFACOTRY = e);

var VOR_SHADER_FACTORY: ShaderFactory;
ShaderFactory.create_factory(
    LOCATION + "static/shaders/frag/vor.glsl", LOCATION + "static/shaders/vert/vor.glsl"
).then((e) => VOR_SHADER_FACTORY = e);

var IMAGE_SHADER_FACTORY: ShaderFactory;
ShaderFactory.create_factory(
    LOCATION + "static/shaders/frag/image.glsl", LOCATION + "static/shaders/vert/simple.glsl"
).then((e) => IMAGE_SHADER_FACTORY = e);

class GameInstance {
    resizer: Resizer;
    game: Game;

    shader: Shader;
    vor_shader: Shader;
    image_shader: Shader;

    text_factory: LabelFactory;
    planet_labels: Label[];
    ship_labels: Label[];

    renderer: Renderer;
    planet_count: number;

    vor_builder: VoronoiBuilder;

    vor_counter = 3;
    use_vor = true;
    playing = true;    // 0 is paused, 1 is playing but not rerendered, 2 is playing and rerendered
    time_stopped_delta = 0;
    last_time = 0;
    frame = -1;

    ship_indices: number[];

    turn_count = 0;

    constructor(game: Game, meshes: Mesh[], ship_mesh: Mesh) {
        this.game = game;
        this.planet_count = this.game.get_planet_count();

        this.shader = SHADERFACOTRY.create_shader(GL, { "MAX_CIRCLES": '' + this.planet_count });
        this.image_shader = IMAGE_SHADER_FACTORY.create_shader(GL);
        this.vor_shader = VOR_SHADER_FACTORY.create_shader(GL, { "PLANETS": '' + this.planet_count });

        this.text_factory = defaultLabelFactory(GL, this.image_shader);
        this.planet_labels = [];
        this.ship_labels = [];

        this.resizer = new Resizer(CANVAS, [...f32v(game.get_viewbox(), 4)], true);
        this.renderer = new Renderer();
        this.game.update_turn(0);

        // Setup key handling
        document.addEventListener('keydown', this.handleKey.bind(this));

        // List of [(x, y, r)] for all planets
        const planets = f32v(game.get_planets(), this.planet_count * 3);

        const planet_points = [];
        for(let i = 0; i < planets.length; i += 3) {
            planet_points.push({'x': planets[i], 'y': planets[i+1]});
        }
        const _bbox = this.resizer.get_viewbox();
        const bbox = {
            'xl': _bbox[0], 'xr': _bbox[0] + _bbox[2],
            'yt': _bbox[1], 'yb': _bbox[1] + _bbox[3]
        };

        this.vor_builder = new VoronoiBuilder(GL, this.vor_shader, planet_points, bbox);
        this.renderer.addRenderable(this.vor_builder.getRenderable());

        for (let i = 0; i < this.planet_count; i++) {
            {
                const transform = new UniformMatrix3fv([
                    1, 0, 0,
                    0, 1, 0,
                    -planets[i * 3], -planets[i * 3 + 1], 1,
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

            {
                const transform = new UniformMatrix3fv([
                    1., 0, 0,
                    0, 1., 0,
                    -planets[i * 3], -planets[i * 3 + 1] -1.2, 1.,
                ]);

                const label = this.text_factory.build(GL, transform);
                this.planet_labels.push(label);
                this.renderer.addRenderable(label.getRenderable());
            }
        }

        this.turn_count = game.turn_count();

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

            const label = this.text_factory.build(GL);
            this.ship_labels.push(label);
            this.renderer.addRenderable(label.getRenderable())
        }

        // this.vor_shader.uniform(GL, "u_planets", new Uniform3fv(planets));

        // Set slider correctly
        SLIDER.max = this.turn_count - 1 + '';
    }

    on_resize() {
        this.resizer = new Resizer(CANVAS, [...f32v(this.game.get_viewbox(), 4)], true);
    }

    _update_state() {
        const colours = f32v(this.game.get_planet_colors(), this.planet_count * 6);
        const planet_ships = i32v(this.game.get_planet_ships(), this.planet_count);

        this.vor_shader.uniform(GL, "u_planet_colours", new Uniform3fv(colours));

        for (let i = 0; i < this.planet_count; i++) {
            const u = new Uniform3f(colours[i * 6], colours[i * 6 + 1], colours[i * 6 + 2]);
            this.renderer.updateUniform(2 * i + 1, (us) => us["u_color"] = u);
            const u2 = new Uniform3f(colours[i * 6 + 3], colours[i * 6 + 4], colours[i * 6 + 5]);
            this.renderer.updateUniform(2 * i + 1, (us) => us["u_color_next"] = u2);

            this.planet_labels[i].setText(GL, "*"+planet_ships[i], Align.Middle, Align.Begin);
        }

        const ship_count = this.game.get_ship_count();
        const ships = f32v(this.game.get_ship_locations(), ship_count * 9 * 2);
        const labels = f32v(this.game.get_ship_label_locations(), ship_count * 9 * 2);
        const ship_counts = i32v(this.game.get_ship_counts(), ship_count);
        const ship_colours = f32v(this.game.get_ship_colours(), ship_count * 3);

        for (let i = 0; i < this.game.get_max_ships(); i++) {
            const index = this.ship_indices[i];
            if (i < ship_count) {

                this.ship_labels[i].setText(GL, ""+ship_counts[i], Align.Middle, Align.Middle);

                this.renderer.enableRenderable(index);
                this.renderer.enableRenderable(index+1);

                const u = new Uniform3f(ship_colours[i * 3], ship_colours[i * 3 + 1], ship_colours[i * 3 + 2]);
                // const t1 = new UniformMatrix3fv(new Float32Array(ships, i * 18, 9));
                // const t2 = new UniformMatrix3fv(new Float32Array(ships, i * 18 + 9, 9));

                const t1 = new UniformMatrix3fv(ships.slice(i * 18, i * 18 + 9));
                const t2 = new UniformMatrix3fv(ships.slice(i * 18 + 9, i * 18 + 18));

                const tl1 = new UniformMatrix3fv(labels.slice(i * 18, i * 18 + 9));
                const tl2 = new UniformMatrix3fv(labels.slice(i * 18 + 9, i * 18 + 18));

                this.renderer.updateUniform(index, (us) => {
                    us["u_color"] = u;
                    us["u_color_next"] = u;
                    us["u_trans"] = t1;
                    us["u_trans_next"] = t2;
                });

                this.renderer.updateUniform(index+1, (us) => {
                    us["u_trans"] = tl1;
                    us["u_trans_next"] = tl2;
                });

            } else {
                this.renderer.disableRenderable(index);
                this.renderer.disableRenderable(index+1);
            }
        }
    }

    render(time: number) {
        COUNTER.frame(time);

        if (COUNTER.delta(time) < 30) {
            this.vor_counter = Math.min(3, this.vor_counter + 1);
        } else {
            this.vor_counter = Math.max(-3, this.vor_counter - 1);
        }

        if (this.vor_counter < -2) {
            this.use_vor = false;
        }

        if (!this.playing) {
            this.last_time = time;

            this.shader.uniform(GL, "u_viewbox", new Uniform4f(this.resizer.get_viewbox()));
            this.vor_shader.uniform(GL, "u_viewbox", new Uniform4f(this.resizer.get_viewbox()));
            this.image_shader.uniform(GL, "u_viewbox", new Uniform4f(this.resizer.get_viewbox()));

            this.renderer.render(GL);
            return;
        }
        if (time > this.last_time + ms_per_frame) {

            this.last_time = time;
            this.updateTurn(this.frame + 1);
        }

        GL.bindFramebuffer(GL.FRAMEBUFFER, null);
        GL.viewport(0, 0, GL.canvas.width, GL.canvas.height);
        GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

        this.vor_shader.uniform(GL, "u_viewbox", new Uniform4f(this.resizer.get_viewbox()));
        this.vor_shader.uniform(GL, "u_resolution", new Uniform2f(RESOLUTION));
        this.vor_shader.uniform(GL, "u_vor", new UniformBool(this.use_vor));

        this.shader.uniform(GL, "u_time", new Uniform1f((time - this.last_time) / ms_per_frame));
        this.shader.uniform(GL, "u_mouse", new Uniform2f(this.resizer.get_mouse_pos()));
        this.shader.uniform(GL, "u_viewbox", new Uniform4f(this.resizer.get_viewbox()));
        this.shader.uniform(GL, "u_resolution", new Uniform2f(RESOLUTION));

        this.image_shader.uniform(GL, "u_time", new Uniform1f((time - this.last_time) / ms_per_frame));
        this.image_shader.uniform(GL, "u_mouse", new Uniform2f(this.resizer.get_mouse_pos()));
        this.image_shader.uniform(GL, "u_viewbox", new Uniform4f(this.resizer.get_viewbox()));
        this.image_shader.uniform(GL, "u_resolution", new Uniform2f(RESOLUTION));

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

        TURNCOUNTER.innerHTML = this.frame + " / " + this.turn_count;
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

        // d key
        if (event.keyCode == 68) {
            SPEED.value = ms_per_frame + 10 + '';
            SPEED.onchange(undefined);
        }

        // a key
        if (event.keyCode == 65) {
            SPEED.value = Math.max(ms_per_frame - 10, 0) + '';
            SPEED.onchange(undefined);
        }
    }
}

var game_instance: GameInstance;
var meshes;

export async function set_instance(source: string) {
    if (!meshes) {
        meshes = await Promise.all(
            ["ship.svg", "earth.svg", "mars.svg", "venus.svg"].map(
                (name) => "static/res/assets/" + name
            ).map(url_to_mesh)
        );
    }

    resizeCanvasToDisplaySize(CANVAS);

    game_instance = new GameInstance(Game.new(source), meshes.slice(1), meshes[0]);

    set_loading(false);
}

window.addEventListener('resize', function () {
    resizeCanvasToDisplaySize(CANVAS);

    if (game_instance) {
        game_instance.on_resize();
    }
}, { capture: false, passive: true })

SLIDER.oninput = function () {
    if (game_instance) {
        game_instance.updateTurn(parseInt(SLIDER.value));
    }
}

FILESELECTOR.onchange = function () {
    const file = FILESELECTOR.files[0];
    if (!file) { return; }
    var reader = new FileReader();

    reader.onload = function () {
        set_instance(<string>reader.result);
    }

    reader.readAsText(file);
}

SPEED.onchange = function () {
    ms_per_frame = parseInt(SPEED.value);
}

function step(time: number) {
    if (game_instance) {
        game_instance.render(time);
    }

    requestAnimationFrame(step);
}
// set_loading(false);

requestAnimationFrame(step);
