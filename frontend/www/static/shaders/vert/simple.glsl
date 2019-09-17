#ifdef GL_ES
precision mediump float;
#endif

attribute vec2 a_position;

uniform vec4 u_viewbox;         // [x, y, width, height]
uniform vec2 u_resolution;

varying vec2 v_pos;

void main() {

    vec2 uv = ( a_position.xy + 1.0 ) * 0.5;

    uv *= u_viewbox.zw;
    uv += u_viewbox.xy;

    v_pos = uv.xy;

    gl_Position = vec4(a_position.xy, 0.0, 1.0);
}
