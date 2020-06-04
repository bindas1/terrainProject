// Per-vertex outputs passed on to the fragment shader
varying vec2 v2f_tex_coord;

// Vertex attributes, specified in the "attributes" entry of the pipeline
attribute vec3 position;

// Global variables specified in "uniforms" entry of the pipeline
uniform mat4 mat_mvp;

void main() {
	v2f_tex_coord = position.xy;
	gl_Position = mat_mvp * vec4(position, 1);

}
