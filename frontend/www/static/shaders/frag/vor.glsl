#ifdef GL_ES
precision mediump float;
#endif

uniform vec3 u_planets[$PLANETS];
uniform vec3 u_planet_colours[$PLANETS * 2];

uniform float u_step_interval;
uniform float u_time;
uniform bool u_vor;

varying vec2 v_pos;

void main() {
    vec3 color = vec3(0.2);

    if (u_vor) {
        float dis = 1000000.0;

        for(int i = 0; i < $PLANETS; i++) {
            float d = distance(v_pos, u_planets[i].xy);
            if (d < dis) {
                dis = d;
                color = u_planet_colours[2 * i];
            }
        }
    }

    gl_FragColor = vec4(color, 0.2);
}
