
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
    hoovering: boolean;
    dragging: boolean;

    mouse_pos: number[];
    last_drag: number[];

    viewbox: number[];
    orig_viewbox: number[];

    el_width: number;

    scaleX = 1;
    scaleY = 1;

    constructor(el: HTMLCanvasElement, viewbox: number[], keep_aspect_ratio=false) {
      console.log("viewbox:" + viewbox);
        this.hoovering = false;
        this.dragging = false;

        this.mouse_pos = [0, 0];
        this.last_drag = [0, 0];

        this.viewbox = [...viewbox];

        if (keep_aspect_ratio) {
            const or_width = this.viewbox[2];
            const or_height = this.viewbox[3];
            const scaleX = el.height / el.width;
            if (scaleX < 1) {
                this.scaleX= 1 / scaleX;

                this.viewbox[2] *= this.scaleX;
            } else {
                this.scaleY = scaleX;
                this.viewbox[3] *= scaleX;
            }

            this.viewbox[0] -= (this.viewbox[2] - or_width) / 2;
            this.viewbox[1] -= (this.viewbox[3] - or_height) / 2;
        }

        this.orig_viewbox = [...this.viewbox];

        this.el_width = el.width;

        el.addEventListener("mouseenter", this.mouseenter.bind(this), { capture: false, passive: true});
        el.addEventListener("mouseleave", this.mouseleave.bind(this), { capture: false, passive: true});
        el.addEventListener("mousemove", this.mousemove.bind(this), { capture: false, passive: true});
        el.addEventListener("mousedown", this.mousedown.bind(this), { capture: false, passive: true});
        el.addEventListener("mouseup", this.mouseup.bind(this), { capture: false, passive: true});

        window.addEventListener('wheel', this.wheel.bind(this), { capture: false, passive: true});
    }

    clip_viewbox() {
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
        this.dragging = false;
    }

    mousemove(e: MouseEvent) {
        this.mouse_pos = [e.offsetX, this.el_width - e.offsetY];

        if (this.dragging) {
            const scale = this.viewbox[3] / this.orig_viewbox[3];
            this.viewbox[0] += (this.last_drag[0] - this.mouse_pos[0]) * scale;
            this.viewbox[1] += (this.last_drag[1] - this.mouse_pos[1]) * scale;

            this.last_drag = [...this.mouse_pos];

            this.clip_viewbox();
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
            const dx =  e.deltaY * this.scaleX;
            this.viewbox[2] += dx;
            this.viewbox[0] -= dx / 2;
            this.viewbox[2] = Math.min(this.viewbox[2], this.orig_viewbox[2]);

            const dy = e.deltaY * this.scaleY;
            this.viewbox[3] += dy;
            this.viewbox[1] -= dy / 2;
            this.viewbox[3] = Math.min(this.viewbox[3], this.orig_viewbox[3]);

            this.clip_viewbox();
        }
    }

    get_viewbox(): number[] {
        return this.viewbox;
    }

    get_mouse_pos(): number[] {
        return this.mouse_pos;
    }
}
