precision mediump float;

varying vec2 v2f_position;

uniform sampler2D shadowmap_to_show;

void main () {
	vec4 cubemap_value = texture2D(shadowmap_to_show, v2f_position);

	gl_FragColor = vec4(vec3(sin(cubemap_value.r)), 1.0);
}
