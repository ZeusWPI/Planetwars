#ifdef GL_ES
precision mediump float;
#endif

uniform int u_circle_count;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec4 u_viewbox;         // [x, y, width, height]
uniform vec2 u_resolution;
uniform vec3 u_circles[$MAX_CIRCLES];
uniform vec3 u_colors[$MAX_CIRCLES];

varying vec2 v_pos;

void main() {
    vec2 uv = v_pos;

    float alpha = 0.0;
    vec3 color;
    for (int i = 0; i < $MAX_CIRCLES; i++ ){
        if (i >= u_circle_count) { break; }
        float d = distance(uv.xy, u_circles[i].xy);
        float a = 1.0 - d/u_circles[i].z;
        if (a > alpha) {
            alpha = a;
            color = u_colors[i];
        }
    }

    gl_FragColor = vec4(color, alpha);
    // gl_FragColor.w *= alpha;
}
