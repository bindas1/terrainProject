
attribute vec3 position;

varying vec3 v2f_position_view;

uniform mat4 mat_mvp;
uniform mat4 mat_model_view;

void main() {
	vec4 position_v4 = vec4(position, 1);

	v2f_position_view = (mat_model_view * position_v4).xyz;
	gl_Position = mat_mvp * position_v4;
}
