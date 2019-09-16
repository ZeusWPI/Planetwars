
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
    if (now - this.last > 1) {
      this.last = now;
      console.log(this.count + " fps");
      this.count = 0;
    }
  }
}

export class M3 {
  _data: any;

  constructor(data: any) {
    this._data = data;
  }

  static ident(): M3 {
    return new M3([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ]);
  }

  multiply(other: M3): M3 {
    const a = this._data;
    const b = other._data;

    var a00 = a[0 * 3 + 0];
    var a01 = a[0 * 3 + 1];
    var a02 = a[0 * 3 + 2];
    var a10 = a[1 * 3 + 0];
    var a11 = a[1 * 3 + 1];
    var a12 = a[1 * 3 + 2];
    var a20 = a[2 * 3 + 0];
    var a21 = a[2 * 3 + 1];
    var a22 = a[2 * 3 + 2];
    var b00 = b[0 * 3 + 0];
    var b01 = b[0 * 3 + 1];
    var b02 = b[0 * 3 + 2];
    var b10 = b[1 * 3 + 0];
    var b11 = b[1 * 3 + 1];
    var b12 = b[1 * 3 + 2];
    var b20 = b[2 * 3 + 0];
    var b21 = b[2 * 3 + 1];
    var b22 = b[2 * 3 + 2];

    return new M3([
      b00 * a00 + b01 * a10 + b02 * a20,
      b00 * a01 + b01 * a11 + b02 * a21,
      b00 * a02 + b01 * a12 + b02 * a22,
      b10 * a00 + b11 * a10 + b12 * a20,
      b10 * a01 + b11 * a11 + b12 * a21,
      b10 * a02 + b11 * a12 + b12 * a22,
      b20 * a00 + b21 * a10 + b22 * a20,
      b20 * a01 + b21 * a11 + b22 * a21,
      b20 * a02 + b21 * a12 + b22 * a22,
    ]);
  }

  translation(x: number, y: number): M3 {
    const out = [...this._data];
    out[6] += x;
    out[7] += y;
    return new M3(out);
  }

  rotate(rad: number): M3 {
    var c = Math.cos(rad);
    var s = Math.sin(rad);

    const out = new M3([...this._data]);

    return out.multiply(new M3([
      c, -s, 0,
      s, c, 0,
      0, 0, 1
    ]));
  }

  scale(s_x: number, s_y = s_x, s_z = 1): M3 {
    const out = new M3([...this._data]);
    return out.multiply(new M3([
      s_x, 0, 0,
      0, s_y, 0,
      0, 0, s_z,
    ]));
  }
}
