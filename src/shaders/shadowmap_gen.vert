
attribute vec3 position;

varying vec3 v2f_position_view;

uniform mat4 mat_mvp;
uniform mat4 mat_model_view;
uniform sampler2D height_map;

void main() {
	vec4 position_v4 = vec4(position, 1);

    if (position_v4.z > 0.3){
        float terrain_size = 25.; //indicates size of  terrain, so we can shrink the x,y down using this value back to values between [0,1]
        float reverse_terrain_size = 1./terrain_size;
        vec2 scaled_positions = vec2(position_v4.x*reverse_terrain_size+0.5, position_v4.y*reverse_terrain_size+0.5);
        position_v4.z = length(texture2D(height_map, scaled_positions).rgb) - 0.5;
        
    }

	v2f_position_view = (mat_model_view * position_v4).xyz;
	gl_Position = mat_mvp * position_v4;
}
