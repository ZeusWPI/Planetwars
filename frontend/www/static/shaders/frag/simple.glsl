#ifdef GL_ES
precision mediump float;
#endif

uniform float u_step_interval;
uniform float u_time;
uniform vec3 u_color;
uniform vec3 u_color_next;

uniform bool u_animated;

void main() {
    vec3 color;
    if (u_animated) {
        color = mix(u_color, u_color_next, u_time);
    } else {
        color = u_color;
    }
    gl_FragColor = vec4(color, 1.0);
}
