import { Game } from "planetwars";
import { memory } from "planetwars/planetwars_bg";
import {
  Resizer,
  resizeCanvasToDisplaySize,
  FPSCounter,
  url_to_mesh,
  Mesh,
  Dictionary,
} from "./webgl/util";
import {
  Shader,
  Uniform4f,
  Uniform3fv,
  Uniform1f,
  Uniform2f,
  ShaderFactory,
  Uniform3f,
  UniformMatrix3fv,
  UniformBool,
} from "./webgl/shader";
import { Renderer } from "./webgl/renderer";
import { VertexBuffer, IndexBuffer } from "./webgl/buffer";
import { VertexBufferLayout, VertexArray } from "./webgl/vertexBufferLayout";
import { defaultLabelFactory, LabelFactory, Align, Label } from "./webgl/text";
import { VoronoiBuilder } from "./voronoi/voronoi";
import { BBox } from "./voronoi/voronoi-core";

function to_bbox(box: number[]): BBox {
  return {
    xl: box[0],
    xr: box[0] + box[2],
    yt: box[1],
    yb: box[1] + box[3],
  };
}

function f32v(ptr: number, size: number): Float32Array {
  return new Float32Array(memory.buffer, ptr, size);
}

function i32v(ptr: number, size: number): Int32Array {
  return new Int32Array(memory.buffer, ptr, size);
}

export function set_game_name(name: string) {
  ELEMENTS["name"].innerHTML = name;
}

export function set_loading(loading: boolean) {
  if (loading) {
    if (!ELEMENTS["main"].classList.contains("loading")) {
      ELEMENTS["main"].classList.add("loading");
    }
  } else {
    ELEMENTS["main"].classList.remove("loading");
  }
}

const ELEMENTS = {};
[
  "name",
  "turnCounter",
  "main",
  "turnSlider",
  "fileselect",
  "speed",
  "canvas",
].forEach((n) => (ELEMENTS[n] = document.getElementById(n)));

const CANVAS = ELEMENTS["canvas"];
const RESOLUTION = [CANVAS.width, CANVAS.height];

const LAYERS = {
  vor: -1, // Background
  planet: 1,
  planet_label: 2,
  ship: 3,
  ship_label: 4,
};

const COUNTER = new FPSCounter();

var ms_per_frame = parseInt(ELEMENTS["speed"].value);

const GL = CANVAS.getContext("webgl");

GL.clearColor(0, 0, 0, 1);
GL.clear(GL.COLOR_BUFFER_BIT);

GL.enable(GL.BLEND);
GL.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);

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
  playing = true;
  time_stopped_delta = 0;
  last_time = 0;
  frame = -1;

  turn_count = 0;

  constructor(
    game: Game,
    meshes: Mesh[],
    ship_mesh: Mesh,
    shaders: Dictionary<ShaderFactory>
  ) {
    this.game = game;
    this.planet_count = this.game.get_planet_count();

    this.shader = shaders["normal"].create_shader(GL, {
      MAX_CIRCLES: "" + this.planet_count,
    });
    this.image_shader = shaders["image"].create_shader(GL);
    this.vor_shader = shaders["vor"].create_shader(GL, {
      PLANETS: "" + this.planet_count,
    });

    this.text_factory = defaultLabelFactory(GL, this.image_shader);
    this.planet_labels = [];
    this.ship_labels = [];

    this.resizer = new Resizer(CANVAS, [...game.get_viewbox()], true);
    this.renderer = new Renderer();
    this.game.update_turn(0);

    // Setup key handling
    document.addEventListener("keydown", this.handleKey.bind(this));

    // List of [(x, y, r)] for all planets
    const planets = game.get_planets();
    this._create_voronoi(planets);
    this._create_planets(planets, meshes);
    this._create_shipes(ship_mesh);

    // Set slider correctly
    this.turn_count = game.turn_count();
    ELEMENTS["turnSlider"].max = this.turn_count - 1 + "";
  }

  _create_voronoi(planets: Float32Array) {
    const planet_points = [];
    for (let i = 0; i < planets.length; i += 3) {
      planet_points.push({ x: -planets[i], y: -planets[i + 1] });
    }

    const bbox = to_bbox(this.resizer.get_viewbox());

    this.vor_builder = new VoronoiBuilder(
      GL,
      this.vor_shader,
      planet_points,
      bbox
    );
    this.renderer.addRenderable(this.vor_builder.getRenderable(), LAYERS.vor);
  }

  _create_planets(planets: Float32Array, meshes: Mesh[]) {
    for (let i = 0; i < this.planet_count; i++) {
      {
        const transform = new UniformMatrix3fv([
          1,
          0,
          0,
          0,
          1,
          0,
          -planets[i * 3],
          -planets[i * 3 + 1],
          1,
        ]);

        const indexBuffer = new IndexBuffer(
          GL,
          meshes[i % meshes.length].cells
        );
        const positionBuffer = new VertexBuffer(
          GL,
          meshes[i % meshes.length].positions
        );

        const layout = new VertexBufferLayout();
        layout.push(GL.FLOAT, 3, 4, "a_position");
        const vao = new VertexArray();
        vao.addBuffer(positionBuffer, layout);

        this.renderer.addToDraw(
          indexBuffer,
          vao,
          this.shader,
          {
            u_trans: transform,
            u_trans_next: transform,
          },
          [],
          LAYERS.planet
        );
      }

      {
        const transform = new UniformMatrix3fv([
          1,
          0,
          0,
          0,
          1,
          0,
          -planets[i * 3],
          -planets[i * 3 + 1] - 1.2,
          1,
        ]);

        const label = this.text_factory.build(GL, transform);
        this.planet_labels.push(label);
        this.renderer.addRenderable(label.getRenderable(), LAYERS.planet_label);
      }
    }
  }

  _create_shipes(ship_mesh: Mesh) {
    const ship_ibo = new IndexBuffer(GL, ship_mesh.cells);
    const ship_positions = new VertexBuffer(GL, ship_mesh.positions);
    const ship_layout = new VertexBufferLayout();
    ship_layout.push(GL.FLOAT, 3, 4, "a_position");
    const ship_vao = new VertexArray();
    ship_vao.addBuffer(ship_positions, ship_layout);

    for (let i = 0; i < this.game.get_max_ships(); i++) {
      this.renderer.addToDraw(
        ship_ibo,
        ship_vao,
        this.shader,
        {},
        [],
        LAYERS.ship
      );

      const label = this.text_factory.build(GL);
      this.ship_labels.push(label);
      this.renderer.addRenderable(label.getRenderable(), LAYERS.ship_label);
    }
  }

  on_resize() {
    this.resizer = new Resizer(CANVAS, [...this.game.get_viewbox()], true);
    const bbox = to_bbox(this.resizer.get_viewbox());
    this.vor_builder.resize(GL, bbox);
  }

  _update_state() {
    this._update_planets();
    this._update_ships();
  }

  _update_planets() {
    const colours = this.game.get_planet_colors();
    const planet_ships = this.game.get_planet_ships();

    this.vor_shader.uniform(GL, "u_planet_colours", new Uniform3fv(colours));

    for (let i = 0; i < this.planet_count; i++) {
      const u = new Uniform3f(
        colours[i * 6],
        colours[i * 6 + 1],
        colours[i * 6 + 2]
      );
      this.renderer.updateUniform(
        i,
        (us) => (us["u_color"] = u),
        LAYERS.planet
      );
      const u2 = new Uniform3f(
        colours[i * 6 + 3],
        colours[i * 6 + 4],
        colours[i * 6 + 5]
      );
      this.renderer.updateUniform(
        i,
        (us) => (us["u_color_next"] = u2),
        LAYERS.planet
      );

      this.planet_labels[i].setText(
        GL,
        "*" + planet_ships[i],
        Align.Middle,
        Align.Begin
      );
    }
  }

  _update_ships() {
    const ship_count = this.game.get_ship_count();
    const ships = this.game.get_ship_locations();
    const labels = this.game.get_ship_label_locations();
    const ship_counts = this.game.get_ship_counts();
    const ship_colours = this.game.get_ship_colours();

    for (let i = 0; i < this.game.get_max_ships(); i++) {
      if (i < ship_count) {
        this.ship_labels[i].setText(
          GL,
          "" + ship_counts[i],
          Align.Middle,
          Align.Middle
        );

        this.renderer.enableRenderable(i, LAYERS.ship);
        this.renderer.enableRenderable(i, LAYERS.ship_label);

        const u = new Uniform3f(
          ship_colours[i * 3],
          ship_colours[i * 3 + 1],
          ship_colours[i * 3 + 2]
        );

        const t1 = new UniformMatrix3fv(ships.slice(i * 18, i * 18 + 9));
        const t2 = new UniformMatrix3fv(ships.slice(i * 18 + 9, i * 18 + 18));

        const tl1 = new UniformMatrix3fv(labels.slice(i * 18, i * 18 + 9));
        const tl2 = new UniformMatrix3fv(labels.slice(i * 18 + 9, i * 18 + 18));

        this.renderer.updateUniform(
          i,
          (us) => {
            us["u_color"] = u;
            us["u_color_next"] = u;
            us["u_trans"] = t1;
            us["u_trans_next"] = t2;
          },
          LAYERS.ship
        );

        this.renderer.updateUniform(
          i,
          (us) => {
            us["u_trans"] = tl1;
            us["u_trans_next"] = tl2;
          },
          LAYERS.ship_label
        );
      } else {
        this.renderer.disableRenderable(i, LAYERS.ship);
        this.renderer.disableRenderable(i, LAYERS.ship_label);
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

    // If not playing, still reder with different viewbox, so people can still pan etc.
    if (!this.playing) {
      this.last_time = time;

      this.shader.uniform(
        GL,
        "u_viewbox",
        new Uniform4f(this.resizer.get_viewbox())
      );
      this.vor_shader.uniform(
        GL,
        "u_viewbox",
        new Uniform4f(this.resizer.get_viewbox())
      );
      this.image_shader.uniform(
        GL,
        "u_viewbox",
        new Uniform4f(this.resizer.get_viewbox())
      );

      this.renderer.render(GL);
      return;
    }

    // Check if turn is still correct
    if (time > this.last_time + ms_per_frame) {
      this.last_time = time;
      this.updateTurn(this.frame + 1);
    }

    // Do GL things
    GL.bindFramebuffer(GL.FRAMEBUFFER, null);
    GL.viewport(0, 0, GL.canvas.width, GL.canvas.height);
    GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

    this.vor_shader.uniform(
      GL,
      "u_time",
      new Uniform1f((time - this.last_time) / ms_per_frame)
    );
    this.vor_shader.uniform(
      GL,
      "u_viewbox",
      new Uniform4f(this.resizer.get_viewbox())
    );
    this.vor_shader.uniform(GL, "u_resolution", new Uniform2f(RESOLUTION));
    this.vor_shader.uniform(GL, "u_vor", new UniformBool(this.use_vor));

    this.shader.uniform(
      GL,
      "u_time",
      new Uniform1f((time - this.last_time) / ms_per_frame)
    );
    this.shader.uniform(
      GL,
      "u_mouse",
      new Uniform2f(this.resizer.get_mouse_pos())
    );
    this.shader.uniform(
      GL,
      "u_viewbox",
      new Uniform4f(this.resizer.get_viewbox())
    );
    this.shader.uniform(GL, "u_resolution", new Uniform2f(RESOLUTION));

    this.image_shader.uniform(
      GL,
      "u_time",
      new Uniform1f((time - this.last_time) / ms_per_frame)
    );
    this.image_shader.uniform(
      GL,
      "u_mouse",
      new Uniform2f(this.resizer.get_mouse_pos())
    );
    this.image_shader.uniform(
      GL,
      "u_viewbox",
      new Uniform4f(this.resizer.get_viewbox())
    );
    this.image_shader.uniform(GL, "u_resolution", new Uniform2f(RESOLUTION));

    // Render
    this.renderer.render(GL);

    COUNTER.frame_end();
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

    ELEMENTS["turnCounter"].innerHTML =
      this.frame + " / " + (this.turn_count - 1);
    ELEMENTS["turnSlider"].value = this.frame + "";
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
      ELEMENTS["speed"].value = ms_per_frame + 10 + "";
      ELEMENTS["speed"].onchange(undefined);
    }

    // a key
    if (event.keyCode == 65) {
      ELEMENTS["speed"].value = Math.max(ms_per_frame - 10, 0) + "";
      ELEMENTS["speed"].onchange(undefined);
    }
  }
}

var game_instance: GameInstance;
var meshes: Mesh[];
var shaders: Dictionary<ShaderFactory>;

export async function set_instance(source: string) {
  if (!meshes || !shaders) {
    const mesh_promises = ["ship.svg", "earth.svg", "mars.svg", "venus.svg"]
      .map((name) => "static/res/assets/" + name)
      .map(url_to_mesh);

    const shader_promies = [
      (async () =>
        <[string, ShaderFactory]>[
          "normal",
          await ShaderFactory.create_factory(
            "static/shaders/frag/simple.glsl",
            "static/shaders/vert/simple.glsl"
          ),
        ])(),
      (async () =>
        <[string, ShaderFactory]>[
          "vor",
          await ShaderFactory.create_factory(
            "static/shaders/frag/vor.glsl",
            "static/shaders/vert/vor.glsl"
          ),
        ])(),
      (async () =>
        <[string, ShaderFactory]>[
          "image",
          await ShaderFactory.create_factory(
            "static/shaders/frag/image.glsl",
            "static/shaders/vert/simple.glsl"
          ),
        ])(),
    ];
    let shaders_array: [string, ShaderFactory][];
    [meshes, shaders_array] = await Promise.all([
      Promise.all(mesh_promises),
      Promise.all(shader_promies),
    ]);

    shaders = {};
    shaders_array.forEach(([name, fac]) => (shaders[name] = fac));
  }

  resizeCanvasToDisplaySize(CANVAS);

  game_instance = new GameInstance(
    Game.new(source),
    meshes.slice(1),
    meshes[0],
    shaders
  );

  set_loading(false);
}

window.addEventListener(
  "resize",
  function () {
    resizeCanvasToDisplaySize(CANVAS);

    if (game_instance) {
      game_instance.on_resize();
    }
  },
  { capture: false, passive: true }
);

ELEMENTS["turnSlider"].oninput = function () {
  if (game_instance) {
    game_instance.updateTurn(parseInt(ELEMENTS["turnSlider"].value));
  }
};

ELEMENTS["speed"].onchange = function () {
  ms_per_frame = parseInt(ELEMENTS["speed"].value);
};

function step(time: number) {
  if (game_instance) {
    game_instance.render(time);
  }

  requestAnimationFrame(step);
}

requestAnimationFrame(step);
