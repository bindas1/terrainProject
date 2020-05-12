attribute vec2 position;

uniform vec2 viewer_position;
uniform float viewer_scale;

varying vec2 v2f_tex_coords;

void main() {
	vec2 off = vec2(1.,0);
	vec2 local_coord = position+ off  * viewer_scale;
	v2f_tex_coords = viewer_position + local_coord;

	gl_Position = vec4(position, 0.0, 1.0);
}

