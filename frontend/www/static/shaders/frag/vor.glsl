#ifdef GL_ES
precision mediump float;
#endif

uniform vec3 u_planet_colours[$PLANETS * 2];

uniform float u_step_interval;
uniform float u_time;
uniform bool u_vor;

varying vec3 v_color;
varying vec2 v_pos;

void main() {
    gl_FragColor = vec4(v_color, 0.6);
}
