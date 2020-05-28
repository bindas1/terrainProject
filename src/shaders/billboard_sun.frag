precision mediump float;
const vec3 glow_color = vec3(1.0, 0.5, 0.0);
// Per-vertex outputs passed on to the fragment shader
varying vec2 v2f_tex_coord;

void main()
{
    gl_FragColor = vec4(glow_color, exp(-5.5 * (length(v2f_tex_coord) - 0.2)));
}
