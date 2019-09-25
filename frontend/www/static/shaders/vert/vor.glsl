#ifdef GL_ES
precision mediump float;
#endif

attribute vec2 a_pos;

uniform vec4 u_viewbox;         // [x, y, width, height]
uniform vec2 u_resolution;

varying vec2 v_pos;

void main() {

    vec2 uv = (a_pos.xy + 1.0) * 0.5;
    uv = 1.0 - uv;
    // uv *= -1.0;

    // Viewbox's center is top left, a_position's is in the center to the screen
    // So translate and scale the viewbox**
    uv *= u_viewbox.zw;
    uv -= u_viewbox.xy + u_viewbox.zw;

    v_pos = uv.xy;

    gl_Position = vec4(a_pos, 0.0, 1.0);
}
