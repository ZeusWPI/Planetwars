#ifdef GL_ES
precision mediump float;
#endif

uniform int u_circle_count;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec4 u_viewbox;         // [x, y, width, height]
uniform vec2 u_resolution;
uniform vec3 u_circles[$MAX_CIRCLES];
uniform vec4 u_color;

varying vec2 v_pos;

void main() {
    vec2 uv = v_pos;

    float alpha = 0.0;
    for (int i = 0; i < $MAX_CIRCLES; i++ ){
        if (i >= u_circle_count) { break; }
        float d = distance(uv.xy, u_circles[i].xy);
        alpha = max(1.0 -  d/u_circles[i].z, alpha);
    }

    gl_FragColor = u_color;
    gl_FragColor.w *= alpha;
}
