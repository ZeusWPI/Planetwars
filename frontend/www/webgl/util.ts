var loadSvg = require('load-svg')
var parsePath = require('extract-svg-path').parse
var svgMesh3d = require('svg-mesh-3d')

export interface Dictionary<T> {
  [Key: string]: T;
}


interface OnLoadable {
  onload: any;
}

export function onload2promise<T extends OnLoadable>(obj: T): Promise<T> {
  return new Promise(resolve => {
    obj.onload = () => resolve(obj);
  });
}

export function resizeCanvasToDisplaySize(
    canvas: HTMLCanvasElement,
    multiplier?: number,
): boolean {
    multiplier = multiplier || 1;
    var width  = canvas.clientWidth  * multiplier | 0;
    var height = canvas.clientHeight * multiplier | 0;
    if (canvas.width !== width ||  canvas.height !== height) {
      canvas.width  = width;
      canvas.height = height;
      return true;
    }
    return false;
}

export class FPSCounter {
  last: number;
  count: number;
  constructor() {
    this.last = 0;
    this.count = 0;
  }

  frame(now: number) {
    this.count += 1;
    if (now - this.last > 1000) {
      this.last = now;
      console.log(this.count + " fps");
      this.count = 0;
    }
  }
}

export class Resizer {
    hoovering = false;
    dragging = false;

    mouse_pos = [0, 0];
    last_drag = [0, 0];

    viewbox: number[];
    orig_viewbox: number[];

    el_box: number[];

    scaleX = 1;
    scaleY = 1;

    constructor(el: HTMLCanvasElement, viewbox: number[], keep_aspect_ratio=false) {

        this.viewbox = [...viewbox];
        this.el_box = [el.width, el.height];

        if (keep_aspect_ratio) {
            const or_width = this.viewbox[2];
            const or_height = this.viewbox[3];

            const width_percentage =  this.viewbox[2] / el.width;
            const height_percentage = this.viewbox[3] / el.height;

            if (width_percentage < height_percentage) {
                // width should be larger
                this.viewbox[2] = height_percentage * el.width;
            } else {
                this.viewbox[3] = width_percentage * el.height;
                // height should be larger
            }

            this.viewbox[0] -= (this.viewbox[2] - or_width) / 2;
            this.viewbox[1] -= (this.viewbox[3] - or_height) / 2;

            this.scaleX = this.viewbox[2] / this.viewbox[3];
        }

        this.orig_viewbox = [...this.viewbox];

        el.addEventListener("mouseenter", this.mouseenter.bind(this), { capture: false, passive: true});
        el.addEventListener("mouseleave", this.mouseleave.bind(this), { capture: false, passive: true});
        el.addEventListener("mousemove", this.mousemove.bind(this), { capture: false, passive: true});
        el.addEventListener("mousedown", this.mousedown.bind(this), { capture: false, passive: true});
        el.addEventListener("mouseup", this.mouseup.bind(this), { capture: false, passive: true});

        window.addEventListener('wheel', this.wheel.bind(this), { capture: false, passive: true});
    }

    _clip_viewbox() {
        this.viewbox[0] = Math.max(this.viewbox[0], this.orig_viewbox[0]);
        this.viewbox[1] = Math.max(this.viewbox[1], this.orig_viewbox[1]);

        this.viewbox[0] = Math.min(this.viewbox[0] + this.viewbox[2], this.orig_viewbox[0] + this.orig_viewbox[2]) - this.viewbox[2];
        this.viewbox[1] = Math.min(this.viewbox[1] + this.viewbox[3], this.orig_viewbox[1] + this.orig_viewbox[3]) - this.viewbox[3];
    }

    mouseenter() {
        this.hoovering = true;
    }

    mouseleave() {
        this.hoovering = false;
    }

    mousemove(e: MouseEvent) {
        this.mouse_pos = [e.offsetX, this.el_box[1] - e.offsetY];

        if (this.dragging) {
            const scaleX = this.viewbox[2] / this.el_box[0];
            const scaleY = this.viewbox[3] / this.el_box[1];

            this.viewbox[0] += (this.last_drag[0] - this.mouse_pos[0]) * scaleX;
            this.viewbox[1] += (this.last_drag[1] - this.mouse_pos[1]) * scaleY;

            this.last_drag = [...this.mouse_pos];

            this._clip_viewbox();
        }
    }

    mousedown() {
        this.dragging = true;
        this.last_drag = [...this.mouse_pos];
    }

    mouseup() {
        this.dragging = false;
    }

    wheel(e: WheelEvent) {
        if (this.hoovering) {
            const delta = e.deltaY > 0 ? 0.1 * this.viewbox[2] : -0.1 * this.viewbox[2];
            const dx =  delta * this.scaleX;

            this.viewbox[2] += dx;
            this.viewbox[0] -= dx / 2;
            this.viewbox[2] = Math.min(this.viewbox[2], this.orig_viewbox[2]);

            const dy = delta * this.scaleY;
            this.viewbox[3] += dy;
            this.viewbox[1] -= dy / 2;
            this.viewbox[3] = Math.min(this.viewbox[3], this.orig_viewbox[3]);

            this._clip_viewbox();
        }
    }

    get_viewbox(): number[] {
      return this.viewbox;
        // return [this.viewbox[0] / this.orig_viewbox[0], this.viewbox[1] / this.orig_viewbox[1], this.viewbox[2] / this.orig_viewbox[2], this.viewbox[3] / this.orig_viewbox[3],];
    }

    get_mouse_pos(): number[] {
        return this.mouse_pos;
    }
}

export class Mesh {
  cells: number[];
  positions: number[];

  constructor(mesh: any) {
      this.cells = mesh.cells.flat();
      this.positions = mesh.positions.flat();
  }
}

export async function url_to_mesh(url: string): Promise<Mesh> {

    return new Promise(function(resolve) {
      loadSvg(url, function (err: any, svg: any) {
        if (err) throw err;

        var svgPath = parsePath(svg);
        var mesh = svgMesh3d(svgPath, {
            delaunay: false,
            scale: 10,
        });

        resolve(new Mesh(mesh));
      });
    });
}
