precision highp float;
uniform sampler2D buffer_to_draw;
varying vec2 v2f_tex_coords;

void main() {
	//commented it out because i think we never use for terrain
	gl_FragColor = vec4(texture2D(buffer_to_draw, v2f_tex_coords).rgb, 1.0);
}

