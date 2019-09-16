import { Dictionary } from './util';

function error(msg: string) {
  console.log(msg);
}

const defaultShaderType = [
  "VERTEX_SHADER",
  "FRAGMENT_SHADER"
];

function loadShader(
  gl: WebGLRenderingContext,
  shaderSource: string,
  shaderType: number,
  opt_errorCallback: any,
): WebGLShader {
  var errFn = opt_errorCallback || error;
  // Create the shader object
  var shader = gl.createShader(shaderType);

  // Load the shader source
  gl.shaderSource(shader, shaderSource);

  // Compile the shader
  gl.compileShader(shader);

  // Check the compile status
  var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!compiled) {
    // Something went wrong during compilation; get the error
    var lastError = gl.getShaderInfoLog(shader);
    errFn("*** Error compiling shader '" + shader + "':" + lastError);
    gl.deleteShader(shader);
    return null;
  }

  console.log("created shader with source");
  console.log(shaderSource);

  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  shaders: WebGLShader[],
  opt_attribs: string[],
  opt_locations: number[],
  opt_errorCallback: any,
): WebGLProgram {
  var errFn = opt_errorCallback || error;
  var program = gl.createProgram();
  shaders.forEach(function (shader) {
    gl.attachShader(program, shader);
  });
  if (opt_attribs) {
    opt_attribs.forEach(function (attrib, ndx) {
      gl.bindAttribLocation(
        program,
        opt_locations ? opt_locations[ndx] : ndx,
        attrib);
    });
  }
  gl.linkProgram(program);

  // Check the link status
  var linked = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!linked) {
    // something went wrong with the link
    var lastError = gl.getProgramInfoLog(program);
    errFn("Error in program linking:" + lastError);

    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function createShaderFromScript(
  gl: WebGLRenderingContext,
  scriptId: string,
  context: Dictionary<any>,
  opt_shaderType: number,
  opt_errorCallback: any,
): WebGLShader {
  var shaderSource = "";
  var shaderType;
  var shaderScript = document.getElementById(scriptId) as HTMLScriptElement;
  if (!shaderScript) {
    console.log("*** Error: unknown script element" + scriptId);
  }
  shaderSource = shaderScript.text;

  for (let key in context) {
    console.log("substitute " + key);
    shaderSource = shaderSource.replace(new RegExp("\\$" + key, 'g'), context[key]);
  }

  if (!opt_shaderType) {
    if (shaderScript.type === "x-shader/x-vertex") {
      shaderType = 35633;
    } else if (shaderScript.type === "x-shader/x-fragment") {
      shaderType = 35632;
    } else if (shaderType !== gl.VERTEX_SHADER && shaderType !== gl.FRAGMENT_SHADER) {
      console.log("*** Error: unknown shader type");
    }
  }

  return loadShader(
    gl, shaderSource, opt_shaderType ? opt_shaderType : shaderType,
    opt_errorCallback);
}

export class Shader {
  shader: WebGLProgram;
  uniformCache: Dictionary<WebGLUniformLocation>;
  attribCache: Dictionary<number>;

  static createProgramFromScripts(
    gl: WebGLRenderingContext,
    shaderScriptIds: string[],
    context = {},
    opt_attribs?: string[],
    opt_locations?: number[],
    opt_errorCallback?: any,
  ): Shader {
    var shaders = [];
    for (var ii = 0; ii < shaderScriptIds.length; ++ii) {
      shaders.push(createShaderFromScript(
        gl, shaderScriptIds[ii], context, (gl as any)[defaultShaderType[ii % 2]] as number, opt_errorCallback));
    }
    return new Shader(createProgram(gl, shaders, opt_attribs, opt_locations, opt_errorCallback));
  }

  static async createProgramFromUrls(
    gl: WebGLRenderingContext,
    vert_url: string,
    frag_url: string,
    context?: Dictionary<string>,
    opt_attribs?: string[],
    opt_locations?: number[],
    opt_errorCallback?: any,
  ): Promise<Shader> {
    const sources = (await Promise.all([
      fetch(vert_url).then((r) => r.text()),
      fetch(frag_url).then((r) => r.text()),
    ])).map(x => {
      for (let key in context) {
        x = x.replace(new RegExp("\\$" + key, 'g'), context[key]);
      }
      return x;
    });

    const shaders = [
      loadShader(gl, sources[0], 35633, opt_errorCallback),
      loadShader(gl, sources[1], 35632, opt_errorCallback),
    ];
    return new Shader(createProgram(gl, shaders, opt_attribs, opt_locations, opt_errorCallback));
  }

  constructor(shader: WebGLProgram) {
    this.shader = shader;
    this.uniformCache = {};
    this.attribCache = {};
  }

  bind(gl: WebGLRenderingContext) {
    gl.useProgram(this.shader);
  }

  // Different locations have different types :/
  getUniformLocation(gl: WebGLRenderingContext, name: string): WebGLUniformLocation {
    if (this.uniformCache[name] === undefined) {
      this.uniformCache[name] = gl.getUniformLocation(this.shader, name);
    }

    return this.uniformCache[name];
  }

  getAttribLocation(gl: WebGLRenderingContext, name: string): number {
    if (this.attribCache[name] === undefined) {
      this.attribCache[name] = gl.getAttribLocation(this.shader, name);
    }

    return this.attribCache[name];
  }

  uniform<T extends Uniform>(
    gl: WebGLRenderingContext,
    name: string,
    uniform: T,
  ) {
    this.bind(gl);
    const location = this.getUniformLocation(gl, name);
    if (location < 0) {
      console.log("No location found with name " + name);
    }

    uniform.setUniform(gl, location);
  }
}

export interface Uniform {
  setUniform(gl: WebGLRenderingContext, location: WebGLUniformLocation): void;
}

export class Uniform2fv implements Uniform {
  data: number[];
  constructor(data: number[]) {
    this.data = data;
  }

  setUniform(gl: WebGLRenderingContext, location: WebGLUniformLocation) {
    gl.uniform2fv(location, this.data);
  }
}

export class Uniform3fv implements Uniform {
  data: number[];
  constructor(data: number[]) {
    this.data = data;
  }

  setUniform(gl: WebGLRenderingContext, location: WebGLUniformLocation) {
    gl.uniform3fv(location, this.data);
  }
}

export class Uniform1iv implements Uniform {
  data: number[];
  constructor(data: number[]) {
    this.data = data;
  }

  setUniform(gl: WebGLRenderingContext, location: WebGLUniformLocation) {
    gl.uniform1iv(location, this.data);
  }
}

export class Uniform1i implements Uniform {
  texture: number;

  constructor(texture: number) {
    this.texture = texture;
  }

  setUniform(gl: WebGLRenderingContext, location: WebGLUniformLocation) {
    gl.uniform1i(location, this.texture);
  }
}

export class Uniform1f implements Uniform {
  texture: number;

  constructor(texture: number) {
    this.texture = texture;
  }

  setUniform(gl: WebGLRenderingContext, location: WebGLUniformLocation) {
    gl.uniform1f(location, this.texture);
  }
}

export class Uniform2f implements Uniform {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setUniform(gl: WebGLRenderingContext, location: WebGLUniformLocation) {
    gl.uniform2f(location, this.x, this.y);
  }
}

export class Uniform4f implements Uniform {
  v0: number;
  v1: number;
  v2: number;
  v3: number;

  constructor(vec: number[]) {
    this.v0 = vec[0];
    this.v1 = vec[1];
    this.v2 = vec[2];
    this.v3 = vec[3];
  }

  setUniform(gl: WebGLRenderingContext, location: WebGLUniformLocation) {
    gl.uniform4f(location, this.v0, this.v1, this.v2, this.v3);
  }
}

export class UniformMatrix3fv implements Uniform {
  data: number[];
  constructor(data: number[]) {
    this.data = data;
  }

  setUniform(gl: WebGLRenderingContext, location: WebGLUniformLocation) {
    gl.uniformMatrix3fv(location, false, this.data);
  }
}
